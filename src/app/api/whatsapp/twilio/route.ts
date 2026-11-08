import { rateLimit } from "@/server/rate-limit";
import { transcribe } from "@/server/speech";
import { handleWhatsApp, loadWa, waRefOf } from "@/server/whatsapp/bot";
import { fetchTwilioMedia, twilioSignatureOk } from "@/server/whatsapp/channels";
import { WA } from "@/server/whatsapp/copy";

export const runtime = "nodejs";
export const maxDuration = 30;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const twiml = (msgs: string[]) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${msgs.map((m) => `<Message>${xml(m)}</Message>`).join("")}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });

/** Twilio WhatsApp webhook (sandbox or a registered sender). Replies go back in the response. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "wa-twilio", 600);
  if (limited) return limited;
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const url = `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host")}${new URL(req.url).pathname}`;
  if (!twilioSignatureOk(url, params, req.headers.get("x-twilio-signature"))) return new Response("Invalid signature", { status: 403 });

  const from = params.From ?? "";
  if (!from) return twiml([]);
  let text = params.Body ?? "";
  // Voice note → text with Whisper, in the language the owner picked.
  if (!text && Number(params.NumMedia ?? 0) > 0 && (params.MediaContentType0 ?? "").startsWith("audio/")) {
    const lang = (await loadWa(waRefOf("twilio", from)))?.lang ?? "hi";
    const audio = await fetchTwilioMedia(params.MediaUrl0);
    const r = audio ? await transcribe(audio, "voice.ogg", lang) : undefined;
    if (!r || "error" in r || !r.text) return twiml([WA[lang].voiceFailed]);
    text = r.text;
  }
  const origin = new URL(url).origin;
  return twiml(await handleWhatsApp({ channel: "twilio", from, text, origin }));
}
