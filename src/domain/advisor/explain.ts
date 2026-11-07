import type { Bundle, Catalogue } from "../catalogue/types";
import { COPY, inr } from "./copy";
import type { Lang } from "./state";

const NEED_LABEL: Record<Lang, Record<string, string>> = {
  en: { pos: "billing and UPI", cctv: "CCTV", whatsapp: "WhatsApp", sms: "SMS", email: "business email", backup: "backup", security: "device security", failover: "backup internet", static_ip: "a fixed IP", website: "a website", telephony: "phone lines", tollfree: "a toll-free number", wifi: "Wi-Fi", iot: "machine monitoring", fleet: "vehicle tracking", sdwan: "multi-site management", firewall: "a firewall", leased_line: "a dedicated line" },
  hi: { pos: "बिलिंग और UPI", cctv: "CCTV", whatsapp: "WhatsApp", sms: "SMS", email: "बिज़नेस ईमेल", backup: "बैकअप", security: "डिवाइस सुरक्षा", failover: "बैकअप इंटरनेट", static_ip: "फ़िक्स्ड IP", website: "वेबसाइट", telephony: "फ़ोन लाइनें", tollfree: "टोल-फ़्री नंबर", wifi: "Wi-Fi", iot: "मशीन मॉनिटरिंग", fleet: "गाड़ी ट्रैकिंग", sdwan: "सभी ब्रांच का मैनेजमेंट", firewall: "फ़ायरवॉल", leased_line: "डेडिकेटेड लाइन" },
  hinglish: { pos: "billing aur UPI", cctv: "CCTV", whatsapp: "WhatsApp", sms: "SMS", email: "business email", backup: "backup", security: "device security", failover: "backup internet", static_ip: "fixed IP", website: "website", telephony: "phone lines", tollfree: "toll-free number", wifi: "Wi-Fi", iot: "machine monitoring", fleet: "vehicle tracking", sdwan: "sab branches ka management", firewall: "firewall", leased_line: "dedicated line" },
};

interface ExplainContext {
  businessType?: string;
  employees: number;
  sites: number;
  city?: string;
  needs: string[];
}

/** Deterministic explanation: always correct, used when no LLM is available or its output fails the guard. */
export function templateExplanation(bundle: Bundle, ctx: ExplainContext, lang: Lang = "en"): string[] {
  const base = bundle.lines[0];
  const needs = ctx.needs.map((n) => NEED_LABEL[lang][n]).filter(Boolean).join(", ");
  const where = ctx.city ?? "";
  const k = bundle.blocked.length;
  if (lang === "hi")
    return [
      `${ctx.employees} लोगों और ${ctx.sites} जगह${where ? ` (${where})` : ""} वाले बिज़नेस के लिए चुना गया।`,
      base ? `${base.name} मुख्य इंटरनेट है; बाकी सब इसी पर चलता है।` : "",
      needs ? `आपने जो माँगा वह शामिल है: ${needs}।` : "",
      k ? `${k} चीज़ें आपके बिज़नेस के साइज़ या शहर के नियमों की वजह से नहीं दी गईं; कारण नीचे हैं।` : "हर प्रोडक्ट आपके साइज़ और शहर के लिए उपलब्ध है।",
    ].filter(Boolean);
  if (lang === "hinglish")
    return [
      `${ctx.employees} logon aur ${ctx.sites} jagah${where ? ` (${where})` : ""} wale business ke liye chuna gaya.`,
      base ? `${base.name} main internet hai; baaki sab isi par chalta hai.` : "",
      needs ? `Aapne jo maanga woh shamil hai: ${needs}.` : "",
      k ? `${k} cheezein aapke business size ya city ke rules ki wajah se nahi di gayi; reason neeche hai.` : "Har product aapke size aur city ke liye available hai.",
    ].filter(Boolean);
  return [
    `Chosen for a ${ctx.businessType ?? "business"} with ${ctx.employees} staff at ${ctx.sites} site${ctx.sites > 1 ? "s" : ""}${where ? ` in ${where}` : ""}.`,
    base ? `${base.name} is the main connection; everything else runs on it.` : "",
    needs ? `Covers what you asked for: ${needs}.` : "",
    k ? `${k} item${k > 1 ? "s were" : " was"} left out because of size or city rules; the reasons are below.` : "Every product here is sold to businesses of your size in your city.",
  ].filter(Boolean);
}

export function priceSummary(bundle: Bundle, lang: Lang): string {
  const c = COPY[lang];
  const parts = [`${inr(bundle.monthlyTotal)}${c.perMonth}`];
  if (bundle.setupTotal) parts.push(`${inr(bundle.setupTotal)} ${c.setup}`);
  if (bundle.contractMonths) parts.push(c.contract(bundle.contractMonths));
  return parts.join(" · ");
}

/**
 * Guard for LLM-written explanations. Rejects text that mentions a product not in
 * the bundle (or its blocked list), a product code, or any rupee amount we didn't compute.
 */
export function explanationIsGrounded(bullets: string[], bundle: Bundle, catalogue: Catalogue): boolean {
  const text = bullets.join("\n");
  if (/\bP\d{2}\b/.test(text)) return false;
  const allowedIds = new Set([...bundle.lines.map((l) => l.productId), ...bundle.blocked.map((b) => b.productId)]);
  for (const p of catalogue.values()) {
    if (!allowedIds.has(p.id) && text.toLowerCase().includes(p.name.toLowerCase())) return false;
  }
  const allowedAmounts = new Set<number>([
    bundle.monthlyTotal,
    bundle.setupTotal,
    ...bundle.lines.flatMap((l) => [l.monthly, l.unitPrice, l.setup]),
  ]);
  const amounts = [...text.matchAll(/(?:₹|rs\.?|inr)\s?([\d,]+)/gi)].map((m) => Number(m[1].replace(/,/g, "")));
  return amounts.every((a) => allowedAmounts.has(a));
}
