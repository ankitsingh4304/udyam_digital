import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit } from "@/server/audit-log";
import { rateLimit } from "@/server/rate-limit";
import { verifyEsign } from "@/server/esign";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = rateLimit(req, "esign-verify", 200);
  if (limited) return limited;
  const parsed = z.object({ challenge: z.string().max(2000), otp: z.string().max(10) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = verifyEsign(parsed.data.challenge, parsed.data.otp.trim());
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  await appendAudit("ESIGN_COMPLETED", r.esign.caseId, { requestId: r.esign.requestId, method: r.esign.method });
  return NextResponse.json({ esignToken: r.esignToken, signedAt: r.esign.signedAt });
}
