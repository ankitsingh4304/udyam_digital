import { NextResponse } from "next/server";
import { auditEntries, verifyAuditChain } from "@/server/audit-log";
import { requireRole } from "@/server/session";

export const runtime = "nodejs";

/** Ops view: audit entries (no personal data) and whether the hash chain is intact. */
export async function GET(req: Request) {
  if (!requireRole("admin")) return NextResponse.json({ error: "Operations sign-in required." }, { status: 401 });
  const caseId = new URL(req.url).searchParams.get("caseId") ?? undefined;
  const all = await auditEntries();
  return NextResponse.json({ chain: verifyAuditChain(all), entries: all.filter((e) => !caseId || e.caseId === caseId).slice(-100) });
}
