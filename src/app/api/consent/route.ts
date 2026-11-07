import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { ConsentRequestSchema, NOTICE_VERSION, REQUIRED_PURPOSES } from "@/domain/kyc/consent";
import { appendAudit, newCaseId } from "@/server/audit-log";
import { signToken } from "@/server/signed-token";

export const runtime = "nodejs";

/** Record consent for the itemised purposes. Required purposes must be accepted to continue. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "consent", 200);
  if (limited) return limited;
  const parsed = ConsentRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent", issues: parsed.error.issues }, { status: 400 });
  const { purposes, lang } = parsed.data;
  const missing = REQUIRED_PURPOSES.filter((p) => !purposes[p]);
  if (missing.length) return NextResponse.json({ error: "These purposes are needed to open a connection", missing }, { status: 422 });
  const caseId = newCaseId();
  const entry = appendAudit("CONSENT_GIVEN", caseId, { purposes, lang, noticeVersion: NOTICE_VERSION });
  // Signed consent travels with the case, so any server instance can verify it.
  const consentToken = signToken({ caseId, purposes, noticeVersion: NOTICE_VERSION, iat: Date.now() });
  return NextResponse.json({ caseId, consentToken, consentRef: entry.hash.slice(0, 12), recordedAt: entry.ts });
}
