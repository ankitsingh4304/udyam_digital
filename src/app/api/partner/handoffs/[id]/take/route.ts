import { NextResponse } from "next/server";
import { appendAudit } from "@/server/audit-log";
import { requireRole } from "@/server/session";
import { notifyHandoffTaken } from "@/server/whatsapp/bot";
import { getHandoff, takeHandoff } from "@/server/whatsapp/handoff";

export const runtime = "nodejs";

/** A partner takes a WhatsApp chat; the owner is told who will contact them. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const s = requireRole("partner");
  if (!s) return NextResponse.json({ error: "Sign in as a partner." }, { status: 401 });
  const h = await getHandoff(params.id);
  if (!h || h.city !== s.city) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  const r = await takeHandoff(h.id, s.id, s.name);
  if (!r?.ok) return NextResponse.json({ error: `Already taken by ${r?.h.takenBy?.partnerName}` }, { status: 409 });
  await appendAudit("LEAD_CLAIMED", h.id, { partnerId: s.id, source: "whatsapp" });
  await notifyHandoffTaken(h.ref, s.name).catch(() => undefined);
  return NextResponse.json({ ok: true, contact: h.contact });
}
