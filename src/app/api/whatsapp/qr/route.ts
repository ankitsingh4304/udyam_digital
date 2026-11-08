import QRCode from "qrcode";
import { twilioConfigured } from "@/server/whatsapp/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** QR code that opens WhatsApp with the sandbox join text ready to send (or the simulator if not set up). */
export async function GET(req: Request) {
  const from = (process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886").replace(/^whatsapp:/, "").replace(/\D/g, "");
  const join = process.env.TWILIO_SANDBOX_JOIN;
  const target = twilioConfigured() && join ? `https://wa.me/${from}?text=${encodeURIComponent(join)}` : new URL("/whatsapp", req.url).toString();
  const svg = await QRCode.toString(target, { type: "svg", margin: 1, color: { dark: "#111b21", light: "#ffffff" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300" } });
}
