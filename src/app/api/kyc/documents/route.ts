import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { getLlm } from "@/adapters/llm";
import type { DocKind } from "@/domain/kyc/types";
import { activeConsent, appendAudit } from "@/server/audit-log";
import { getRegistry } from "@/server/data";
import { DOC_SLOTS, processKycDocuments } from "@/server/kyc-service";
import { signToken, verifyToken } from "@/server/signed-token";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Multipart upload: caseId + up to four files named gst, udyam, signatory, addressProof. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "kyc", 120);
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the documents as multipart form data." }, { status: 400 });
  const caseId = String(form.get("caseId") ?? "");
  const signed = verifyToken<{ caseId: string; purposes: Record<string, boolean> }>(String(form.get("consentToken") ?? ""));
  const consent = signed?.caseId === caseId ? signed.purposes : activeConsent(caseId);
  if (!consent?.kyc) return NextResponse.json({ error: "Consent for verification is needed before documents can be checked." }, { status: 403 });

  const docs: { slot: DocKind; buffer: Buffer }[] = [];
  for (const slot of DOC_SLOTS) {
    const file = form.get(slot);
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `${slot}: file is larger than 8 MB.` }, { status: 413 });
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: `${slot}: upload a PNG, JPG or WebP photo.` }, { status: 415 });
    docs.push({ slot, buffer: Buffer.from(await file.arrayBuffer()) });
  }
  if (!docs.length) return NextResponse.json({ error: "Upload at least the GST certificate." }, { status: 400 });

  const declaredGstin = String(form.get("declaredGstin") ?? "").slice(0, 20) || undefined;
  const result = await processKycDocuments(docs, { registry: getRegistry(), llm: getLlm(), declaredGstin });
  // Buffers go out of scope here: images are never written to disk.
  appendAudit("KYC_PROCESSED", caseId, {
    verdict: result.verdict,
    failed: result.checks.filter((c) => c.status === "fail").map((c) => c.code),
    readers: result.documents.map((d) => `${d.slot}:${d.reader ?? "preflight"}`),
  });
  appendAudit("DOCS_DISCARDED", caseId, { count: docs.length });
  // Signed proof of the verdict, so the order step can trust it without shared server memory.
  const business = result.documents.find((d) => d.slot === "gst")?.fields?.tradeName ?? "Your business";
  const kycToken = signToken({ caseId, verdict: result.verdict, business, iat: Date.now() });
  return NextResponse.json({ caseId, kycToken, ...result });
}
