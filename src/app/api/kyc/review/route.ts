import { NextResponse } from "next/server";
import { z } from "zod";
import { getReview, isWithdrawn } from "@/server/ops";
import { rateLimit } from "@/server/rate-limit";
import { signToken, verifyToken } from "@/server/signed-token";

export const runtime = "nodejs";

/**
 * The owner's screen asks: has an agent decided my case? On approval it receives a new signed
 * KYC result (verdict PASS, approvedBy) so e-sign and ordering can continue.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "kyc-review", 600);
  if (limited) return limited;
  const parsed = z.object({ kycToken: z.string().max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const kyc = verifyToken<{ caseId: string; verdict: string; business: string; backupRead?: boolean }>(parsed.data.kycToken);
  if (!kyc || kyc.verdict !== "MANUAL_REVIEW") return NextResponse.json({ error: "This case is not waiting for review." }, { status: 409 });
  if (await isWithdrawn(kyc.caseId)) return NextResponse.json({ status: "withdrawn" });
  const r = await getReview(kyc.caseId);
  if (!r) return NextResponse.json({ status: "pending" });
  if (r.status === "approved") {
    const kycToken = signToken({ caseId: kyc.caseId, verdict: "PASS", business: kyc.business, backupRead: kyc.backupRead, approvedBy: "agent", iat: Date.now() });
    return NextResponse.json({ status: "approved", kycToken, note: r.note });
  }
  return NextResponse.json({ status: r.status, note: r.note });
}
