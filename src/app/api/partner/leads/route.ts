import { NextResponse } from "next/server";
import { rescueLeads, rescueSummary } from "@/server/leads-service";

export const runtime = "nodejs";

/** Rescue queue for partners: dropped-but-recoverable leads, scored, filterable. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const all = rescueLeads();
  const city = q.get("city"), band = q.get("band"), channel = q.get("channel"), segment = q.get("segment");
  const leads = all.filter((l) => (!city || l.city === city) && (!band || l.band === band) && (!channel || l.channel === channel) && (!segment || l.segment === segment));
  const offset = Math.max(0, Number(q.get("offset")) || 0);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 25));
  return NextResponse.json({
    summary: rescueSummary(leads),
    cities: [...new Set(all.map((l) => l.city))].sort(),
    leads: leads.slice(offset, offset + limit),
  });
}
