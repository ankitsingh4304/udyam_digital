import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit } from "@/server/audit-log";
import { getConsent, setConsent } from "@/server/ops";
import { verifyToken } from "@/server/signed-token";

export const runtime = "nodejs";

/** Withdraw consent: every later step (KYC, e-sign, order) checks this and stops. */
export async function POST(req: Request) {
  const parsed = z.object({ caseId: z.string().regex(/^case_[a-f0-9]{8}$/), consentToken: z.string().max(2000).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid case" }, { status: 400 });
  const { caseId, consentToken } = parsed.data;
  const stored = await getConsent(caseId).catch(() => undefined);
  const signed = consentToken ? verifyToken<{ caseId: string; purposes: Record<string, boolean> }>(consentToken) : undefined;
  const purposes = stored?.purposes ?? (signed?.caseId === caseId ? signed.purposes : undefined);
  if (!purposes || stored?.status === "withdrawn") return NextResponse.json({ error: "No active consent for this case" }, { status: 404 });
  const entry = await appendAudit("CONSENT_WITHDRAWN", caseId, {});
  await setConsent(caseId, { status: "withdrawn", purposes, at: entry.ts });
  return NextResponse.json({ withdrawn: true, recordedAt: entry.ts });
}
