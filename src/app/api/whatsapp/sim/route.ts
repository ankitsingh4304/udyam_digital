import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { handleWhatsApp, loadWa, waRefOf } from "@/server/whatsapp/bot";

export const runtime = "nodejs";
export const maxDuration = 30;

const Session = z.string().regex(/^[a-f0-9-]{16,40}$/);

/** In-app WhatsApp simulator: same bot, no phone or account needed. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "wa-sim", 600);
  if (limited) return limited;
  const parsed = z.object({ session: Session, text: z.string().max(500) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const replies = await handleWhatsApp({ channel: "sim", from: `sim:${parsed.data.session}`, text: parsed.data.text, origin: new URL(req.url).origin });
  return NextResponse.json({ replies });
}

/** Messages the bot pushed later (order placed, dispatched, delayed…). */
export async function GET(req: Request) {
  const session = Session.safeParse(new URL(req.url).searchParams.get("session"));
  if (!session.success) return NextResponse.json({ outbox: [] });
  const s = await loadWa(waRefOf("sim", `sim:${session.data}`));
  return NextResponse.json({ outbox: s?.outbox ?? [], lang: s?.lang ?? null });
}
