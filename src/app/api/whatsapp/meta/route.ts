import { NextResponse } from "next/server";
import { transcribe } from "@/server/speech";
import { handleWhatsApp, loadWa, waRefOf } from "@/server/whatsapp/bot";
import { fetchMetaMedia, metaSignatureOk, metaVerifyToken, sendWhatsApp } from "@/server/whatsapp/channels";
import { WA } from "@/server/whatsapp/copy";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Meta WhatsApp Cloud API webhook verification. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const token = metaVerifyToken();
  if (q.get("hub.mode") === "subscribe" && token && q.get("hub.verify_token") === token) return new Response(q.get("hub.challenge") ?? "");
  return new Response("Forbidden", { status: 403 });
}

interface MetaMessage { from: string; type: string; text?: { body: string }; audio?: { id: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } } }

/** Meta WhatsApp Cloud API: the production channel. Replies are sent through the Graph API. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!metaSignatureOk(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 403 });
  const body = JSON.parse(raw || "{}");
  const msg: MetaMessage | undefined = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return NextResponse.json({ ok: true }); // delivery/read receipts
  const origin = new URL(req.url).origin;
  const ref = waRefOf("meta", msg.from);
  let text = msg.text?.body ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "";
  if (!text && msg.type === "audio" && msg.audio) {
    const lang = (await loadWa(ref))?.lang ?? "hi";
    const audio = await fetchMetaMedia(msg.audio.id);
    const r = audio ? await transcribe(audio, "voice.ogg", lang) : undefined;
    text = r && !("error" in r) ? r.text : "";
    if (!text) {
      await sendWhatsApp({ ref, channel: "meta", to: msg.from, origin, stage: "lang", orders: [], updatedAt: "" }, WA[lang].voiceFailed);
      return NextResponse.json({ ok: true });
    }
  }
  const replies = await handleWhatsApp({ channel: "meta", from: msg.from, text, origin });
  const state = await loadWa(ref);
  for (const r of replies) await sendWhatsApp(state ?? { ref, channel: "meta", to: msg.from, origin, stage: "lang", orders: [], updatedAt: "" }, r);
  return NextResponse.json({ ok: true });
}
