import { NextResponse } from "next/server";
import { auditEntries, verifyAuditChain } from "@/server/audit-log";

export const runtime = "nodejs";

/** Ops view: audit entries (no personal data) and whether the hash chain is intact. */
export async function GET(req: Request) {
  const caseId = new URL(req.url).searchParams.get("caseId") ?? undefined;
  return NextResponse.json({ chain: verifyAuditChain(), entries: auditEntries(caseId).slice(-100) });
}
