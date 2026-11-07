import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAudit } from "@/server/audit-log";
import { decideReview } from "@/server/ops";
import { requireRole } from "@/server/session";

export const runtime = "nodejs";

/** A verification agent approves or rejects a KYC case the rules could not decide. */
export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  const s = requireRole("admin");
  if (!s) return NextResponse.json({ error: "Operations sign-in required." }, { status: 401 });
  const parsed = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().max(200).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  const r = await decideReview(params.caseId, parsed.data.decision, s.name, parsed.data.note);
  if (!r) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  await appendAudit("REVIEW_DECIDED", params.caseId, { decision: r.status });
  return NextResponse.json(r);
}
