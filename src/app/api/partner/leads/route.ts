import { NextResponse } from "next/server";
import { rescueLeads, rescueSummary } from "@/server/leads-service";
import { requireRole } from "@/server/session";

export const runtime = "nodejs";

/** Rescue queue for partners: dropped-but-recoverable leads, scored, filterable. */
export async function GET(req: Request) {
  const session = requireRole("partner", "admin");
  if (!session) return NextResponse.json({ error: "Sign in as a partner or operations user." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const all = rescueLeads();
  // Purpose limitation: a partner only ever receives leads from their own city.
  const city = session.role === "partner" ? session.city ?? "__none__" : q.get("city"), band = q.get("band"), channel = q.get("channel"), segment = q.get("segment");
  const leads = all.filter((l) => (!city || l.city === city) && (!band || l.band === band) && (!channel || l.channel === channel) && (!segment || l.segment === segment));
  const offset = Math.max(0, Number(q.get("offset")) || 0);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 25));
  return NextResponse.json({
    summary: rescueSummary(leads),
    cities: session.role === "partner" ? [session.city] : [...new Set(all.map((l) => l.city))].sort(),
    leads: leads.slice(offset, offset + limit),
  });
}
