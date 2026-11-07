import { NextResponse } from "next/server";
import { appendAudit } from "@/server/audit-log";
import { rescueLeads } from "@/server/leads-service";
import { claimLead } from "@/server/ops";
import { requireRole } from "@/server/session";

export const runtime = "nodejs";

/** A partner takes a lead, so no other partner or field agent calls the same owner. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const s = requireRole("partner");
  if (!s) return NextResponse.json({ error: "Sign in as a partner." }, { status: 401 });
  const lead = rescueLeads().find((l) => l.id === params.id);
  // Purpose limitation: only leads in the partner's own city can be taken.
  if (!lead || lead.city !== s.city) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const r = await claimLead(lead.id, s.id, s.name);
  if (!r.ok) return NextResponse.json({ error: `Already taken by ${r.claim.partnerName}`, claim: r.claim }, { status: 409 });
  await appendAudit("LEAD_CLAIMED", lead.id, { partnerId: s.id });
  return NextResponse.json(r.claim);
}
