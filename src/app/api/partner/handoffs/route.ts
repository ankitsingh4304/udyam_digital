import { NextResponse } from "next/server";
import { requireRole } from "@/server/session";
import { listHandoffs } from "@/server/whatsapp/handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** WhatsApp chats where the owner asked for a person. Partners see their city; contact only once taken. */
export async function GET() {
  const s = requireRole("partner", "admin");
  if (!s) return NextResponse.json({ error: "Sign in as a partner or operations user." }, { status: 401 });
  const list = await listHandoffs(s.role === "partner" ? s.city ?? "__none__" : undefined);
  return NextResponse.json({
    handoffs: list.map((h) => ({
      id: h.id,
      city: h.city ?? null,
      summary: h.summary,
      lang: h.lang,
      at: h.at,
      takenBy: h.takenBy ? { name: h.takenBy.partnerName, mine: h.takenBy.partnerId === s.id } : null,
      contact: s.role === "admin" || h.takenBy?.partnerId === s.id ? h.contact : null,
    })),
  });
}
