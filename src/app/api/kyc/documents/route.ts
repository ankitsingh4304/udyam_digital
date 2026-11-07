import { NextResponse } from "next/server";
import { getLlm } from "@/adapters/llm";
import type { DocKind } from "@/domain/kyc/types";
import { activeConsent, appendAudit } from "@/server/audit-log";
import { getRegistry } from "@/server/data";
import { DOC_SLOTS, processKycDocuments } from "@/server/kyc-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Multipart upload: caseId + up to four files named gst, udyam, signatory, addressProof. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the documents as multipart form data." }, { status: 400 });
  const caseId = String(form.get("caseId") ?? "");
  const consent = activeConsent(caseId);
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

  const result = await processKycDocuments(docs, { registry: getRegistry(), llm: getLlm() });
  // Buffers go out of scope here: images are never written to disk.
  appendAudit("KYC_PROCESSED", caseId, {
    verdict: result.verdict,
    failed: result.checks.filter((c) => c.status === "fail").map((c) => c.code),
    readers: result.documents.map((d) => `${d.slot}:${d.reader ?? "preflight"}`),
  });
  appendAudit("DOCS_DISCARDED", caseId, { count: docs.length });
  return NextResponse.json({ caseId, ...result });
}
