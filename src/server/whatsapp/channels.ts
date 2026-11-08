import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@/server/store";
import type { WaState } from "./bot";

/**
 * Sending and receiving per channel.
 * - Twilio WhatsApp sandbox: anyone can join with a code; replies go back as TwiML, pushes via REST.
 * - Meta WhatsApp Cloud API: the production path (webhook + Graph API).
 * - Simulator: pushes are kept in the chat state and read by the simulator page.
 */
const twilio = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
});
const meta = () => ({ token: process.env.META_WA_TOKEN, phoneId: process.env.META_WA_PHONE_NUMBER_ID, appSecret: process.env.META_APP_SECRET, verify: process.env.META_WA_VERIFY_TOKEN });

export const twilioConfigured = () => !!(twilio().sid && twilio().token);
export const metaConfigured = () => !!(meta().token && meta().phoneId);

export async function sendWhatsApp(s: WaState, text: string): Promise<boolean> {
  try {
    if (s.channel === "sim") {
      const outbox = [...(s.outbox ?? []), { ts: new Date().toISOString(), text }].slice(-20);
      const cur = await getStore().get<WaState | null>(`wa:${s.ref}`);
      if (cur) await getStore().set(`wa:${s.ref}`, { ...cur, outbox });
      return true;
    }
    if (s.channel === "twilio") {
      const t = twilio();
      if (!t.sid || !t.token) return false;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/Messages.json`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${t.sid}:${t.token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: t.from, To: s.to, Body: text.slice(0, 1500) }),
      });
      return res.ok;
    }
    const m = meta();
    if (!m.token || !m.phoneId) return false;
    const res = await fetch(`https://graph.facebook.com/v21.0/${m.phoneId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${m.token}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: s.to, type: "text", text: { body: text.slice(0, 4000), preview_url: true } }),
    });
    return res.ok;
  } catch (e) {
    console.warn(`whatsapp send failed: ${(e as Error).message}`);
    return false;
  }
}

/** Twilio request signature: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)). */
export function twilioSignatureOk(url: string, params: Record<string, string>, signature: string | null, token = twilio().token): boolean {
  if (!token) return true; // not configured: nothing to verify against (the route is rate-limited)
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Meta webhook signature: "sha256=" + HMAC-SHA256(appSecret, raw body). */
export function metaSignatureOk(raw: string, header: string | null, secret = meta().appSecret): boolean {
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  return expected.length === header.length && timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}
export const metaVerifyToken = () => meta().verify;

/** Download a voice note from Twilio (basic auth) or Meta (media id → URL → bearer). */
export async function fetchTwilioMedia(url: string): Promise<Blob | undefined> {
  const t = twilio();
  const res = await fetch(url, { headers: t.sid && t.token ? { authorization: `Basic ${Buffer.from(`${t.sid}:${t.token}`).toString("base64")}` } : {} });
  return res.ok ? res.blob() : undefined;
}
export async function fetchMetaMedia(id: string): Promise<Blob | undefined> {
  const m = meta();
  if (!m.token) return undefined;
  const info = await fetch(`https://graph.facebook.com/v21.0/${id}`, { headers: { authorization: `Bearer ${m.token}` } });
  if (!info.ok) return undefined;
  const { url } = (await info.json()) as { url?: string };
  if (!url) return undefined;
  const res = await fetch(url, { headers: { authorization: `Bearer ${m.token}` } });
  return res.ok ? res.blob() : undefined;
}
