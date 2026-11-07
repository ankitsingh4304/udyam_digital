import { NextResponse } from "next/server";
import { z } from "zod";
import { activeConsent, appendAudit } from "@/server/audit-log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = z.object({ caseId: z.string().regex(/^case_[a-f0-9]{8}$/) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid case" }, { status: 400 });
  if (!activeConsent(parsed.data.caseId)) return NextResponse.json({ error: "No active consent for this case" }, { status: 404 });
  const entry = appendAudit("CONSENT_WITHDRAWN", parsed.data.caseId, {});
  return NextResponse.json({ withdrawn: true, recordedAt: entry.ts });
}
