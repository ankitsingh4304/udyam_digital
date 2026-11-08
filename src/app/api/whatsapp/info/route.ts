import { NextResponse } from "next/server";
import { metaConfigured, twilioConfigured } from "@/server/whatsapp/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the "Try on WhatsApp" card shows: the sandbox number and join code, if set up. */
export async function GET() {
  const from = (process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886").replace(/^whatsapp:/, "");
  const join = process.env.TWILIO_SANDBOX_JOIN; // e.g. "join silver-tiger"
  return NextResponse.json({
    twilio: twilioConfigured() && join ? { number: from, join, link: `https://wa.me/${from.replace(/\D/g, "")}?text=${encodeURIComponent(join)}` } : null,
    meta: metaConfigured(),
  });
}
