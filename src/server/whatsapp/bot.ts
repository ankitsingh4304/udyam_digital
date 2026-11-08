import { createHash } from "node:crypto";
import { LlmChain } from "@/adapters/llm/chain";
import { getLlm } from "@/adapters/llm";
import { inr } from "@/domain/advisor/copy";
import type { AdvisorState, Lang } from "@/domain/advisor/state";
import { LANG_LABEL } from "@/i18n";
import { handleAdvisorTurn, type AdvisorTurnResult } from "@/server/advisor-service";
import { appendAudit } from "@/server/audit-log";
import { getCatalogue, getRegistry } from "@/server/data";
import { signToken } from "@/server/signed-token";
import { getStore } from "@/server/store";
import { shortLink } from "@/server/shortlink";
import { createHandoff } from "./handoff";
import { LANG_MENU, MENU_LANGS, WA } from "./copy";
import { sendWhatsApp } from "./channels";
import { milestones, type OrderEvent, type OrderPayload } from "@/domain/orders/tracker";
import { getOrder } from "@/server/ops";

/**
 * WhatsApp front door. Channel-agnostic: Twilio, Meta Cloud API and the in-app simulator all call
 * handleWhatsApp() with plain text (voice notes are transcribed first) and send back the replies.
 * The same advisor and rules engine as the web app decide the bundle; the chat ends with a signed
 * link that opens the document check with the quote already filled in.
 */
export type Channel = "twilio" | "meta" | "sim";

export interface WaState {
  ref: string;
  channel: Channel;
  /** Address to reply to (e.g. "whatsapp:+9198…"). Personal data: deleted on STOP. */
  to: string;
  origin: string;
  lang?: Lang;
  stage: "lang" | "advisor" | "done";
  advisor?: AdvisorState;
  quick?: string[];
  multi?: boolean;
  orders: string[];
  /** Simulator only: messages pushed later (order updates), read by the simulator page. */
  outbox?: { ts: string; text: string }[];
  updatedAt: string;
}

export const waRefOf = (channel: Channel, to: string) => createHash("sha256").update(`${channel}:${to}`).digest("hex").slice(0, 16);
const key = (ref: string) => `wa:${ref}`;

export async function loadWa(ref: string): Promise<WaState | undefined> {
  const s = await getStore().get<WaState | null>(key(ref));
  return s ?? undefined;
}
export const saveWa = (s: WaState) => getStore().set(key(s.ref), { ...s, updatedAt: new Date().toISOString() });

/** Twilio answers in 15 s: if the AI is slow, finish the turn with the built-in parser instead. */
const BUDGET_MS = 9_000;
async function advisorTurn(input: { state?: AdvisorState; message: string; lang?: Lang }): Promise<AdvisorTurnResult> {
  const deps = { catalogue: getCatalogue(), registry: getRegistry() };
  const offline = () => handleAdvisorTurn(input, { ...deps, llm: new LlmChain([]) });
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), BUDGET_MS));
  try {
    return (await Promise.race([handleAdvisorTurn(input, { ...deps, llm: getLlm() }), timeout])) ?? (await offline());
  } catch {
    return offline();
  }
}

const numbered = (opts: string[]) => opts.map((o, i) => `${i + 1}. ${o}`).join("\n");

/** "2" → option 2; "1,3" or "1 3" → options 1 and 3 (multi-select only). Anything else is free text. */
function pickOptions(text: string, quick: string[] | undefined, multi: boolean): string | undefined {
  if (!quick?.length) return undefined;
  const nums = text.split(/[\s,]+/).filter(Boolean);
  if (!nums.every((n) => /^\d{1,2}$/.test(n))) return undefined;
  const idx = nums.map(Number).filter((n) => n >= 1 && n <= quick.length);
  if (!idx.length || (!multi && idx.length > 1)) return undefined;
  return [...new Set(idx)].map((n) => quick[n - 1]).join(", ");
}

function questionReplies(r: AdvisorTurnResult, lang: Lang): { text: string[]; multi: boolean } {
  const multi = r.state.lastAsked === "needs";
  const last = r.reply.at(-1) ?? "";
  const head = r.reply.slice(0, -1);
  const hint = `_${multi ? WA[lang].pickMany : WA[lang].pickOne} ${WA[lang].agentHint}._`;
  const body = r.quickReplies.length ? `${last}\n\n${numbered(r.quickReplies)}\n\n${hint}` : `${last}\n\n_${WA[lang].agentHint}._`;
  return { text: [...head, body], multi };
}

async function bundleReplies(r: AdvisorTurnResult, s: WaState): Promise<string[]> {
  const c = WA[s.lang ?? "en"];
  const b = r.bundle!;
  const lines = b.lines.map((l) => `• ${l.name}${l.quantity > 1 ? ` ×${l.quantity}` : ""} — ${inr(l.monthly)}`).join("\n");
  const link = await shortLink(
    s.origin,
    `/q/${encodeURIComponent(signToken({ v: 1, profile: r.profile, cart: b.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), lang: s.lang, waRef: s.ref, iat: Date.now() }))}`,
  );
  return [
    ...r.reply.slice(0, -1),
    `${c.bundle(inr(b.monthlyTotal))}\n${lines}\n${c.setup(inr(b.setupTotal), b.contractMonths)}`,
    `${c.why}\n${(r.explanation ?? []).slice(0, 3).map((x) => `• ${x}`).join("\n")}`,
    `${c.finish}\n${link}\n\n_${c.help}_`,
  ];
}

export async function handleWhatsApp(msg: { channel: Channel; from: string; text: string; origin: string }): Promise<string[]> {
  const ref = waRefOf(msg.channel, msg.from);
  const text = msg.text.trim().slice(0, 500);
  const cmd = text.toUpperCase();
  let s = await loadWa(ref);

  if (cmd === "STOP") {
    await getStore().set(key(ref), null);
    await appendAudit("WA_OPT_OUT", ref, { channel: msg.channel });
    return [WA[s?.lang ?? "en"].stopped];
  }
  const isGreeting = ["HI", "HELLO", "HEY", "START", "MENU", "RESTART", "NAMASTE"].includes(cmd) || /^join\s/i.test(text);
  if (!s || isGreeting || (s.stage === "lang" && scriptLang(text))) {
    if (!s) await appendAudit("WA_CHAT_STARTED", ref, { channel: msg.channel });
    s = { ref, channel: msg.channel, to: msg.from, origin: msg.origin, stage: "lang", orders: s?.orders ?? [], outbox: s?.outbox, updatedAt: "" };
    // Wrote in an Indian script (e.g. "नमस्ते", "வணக்கம்")? Start in that language, no menu.
    const auto = isGreeting ? undefined : scriptLang(text);
    if (auto) return startAdvisor(s, auto);
    await saveWa(s);
    return [LANG_MENU];
  }
  s = { ...s, to: msg.from, origin: msg.origin };
  const lang = s.lang ?? "en";

  if (cmd === "STATUS") return [await statusText(s)];

  if (s.stage === "lang") {
    const n = Number(text);
    const chosen = Number.isInteger(n) && n >= 1 && n <= MENU_LANGS.length ? MENU_LANGS[n - 1] : MENU_LANGS.find((l) => LANG_LABEL[l].toLowerCase() === text.toLowerCase());
    if (!chosen) return [LANG_MENU];
    return startAdvisor(s, chosen);
  }

  // "Talk to a person": works at any point after the language is chosen.
  if (cmd === "0" || cmd === "AGENT" || cmd === "HUMAN") return handoffToPartner(s);

  if (s.stage === "done") return [`${WA[lang].help}`];

  // Advisor turn: a number picks a shown option (localized text, which the advisor maps to its English twin).
  const answer = pickOptions(text, s.quick, !!s.multi) ?? text;
  const r = await advisorTurn({ state: s.advisor, message: answer });
  if (r.bundle) {
    await saveWa({ ...s, stage: "done", advisor: r.state, quick: [], multi: false });
    await appendAudit("WA_QUOTED", s.ref, { monthly: r.bundle.monthlyTotal, lang });
    return await bundleReplies(r, s);
  }
  const q = questionReplies(r, lang);
  await saveWa({ ...s, advisor: r.state, quick: r.quickReplies, multi: q.multi });
  return q.text;
}

async function startAdvisor(s: WaState, lang: Lang): Promise<string[]> {
  const r = await advisorTurn({ message: "", lang });
  const q = questionReplies(r, lang);
  await saveWa({ ...s, lang, stage: "advisor", advisor: r.state, quick: r.quickReplies, multi: q.multi });
  return q.text;
}

/** Script of the first message → language (Devanagari defaults to Hindi; Marathi users pick 4 from the menu). */
export function scriptLang(text: string): Lang | undefined {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return undefined;
}

async function handoffToPartner(s: WaState): Promise<string[]> {
  const lang = s.lang ?? "en";
  const d = s.advisor?.draft;
  const summary = d
    ? [d.businessType, d.employees != null ? `${d.employees} staff` : "", d.sites ? `${d.sites} site(s)` : "", d.city, d.gstinStatus ? `GSTIN ${d.gstinStatus}` : "", d.currentInternet ? `uses ${d.currentInternet}` : "", d.needs?.length ? `needs ${d.needs.join(", ")}` : ""].filter(Boolean).join(" · ")
    : "Asked for a person before answering";
  const contact = s.channel === "sim" ? "Simulator chat (demo)" : s.to.replace(/^whatsapp:/, "");
  await createHandoff({ ref: s.ref, city: d?.city, summary: summary || "Asked for a person", lang, channel: s.channel, contact });
  await appendAudit("WA_HANDOFF", s.ref, { city: d?.city ?? null });
  return [WA[lang].agentQueued(d?.city ?? "")];
}

/** Partner took the chat: tell the owner who will contact them. */
export async function notifyHandoffTaken(ref: string, partnerName: string): Promise<void> {
  const s = await loadWa(ref);
  if (s) await sendWhatsApp(s, WA[s.lang ?? "en"].agentTaken(partnerName));
}

async function statusText(s: WaState): Promise<string> {
  const lang = s.lang ?? "en";
  const c = WA[lang];
  if (!s.orders.length) return c.statusNone;
  const lines = await Promise.all(
    s.orders.slice(-5).map(async (id) => {
      const rec = await getOrder(id).catch(() => undefined);
      if (!rec) return `• ${id}`;
      const steps = milestones(rec.order, new Date(), lang, rec.events);
      const now = steps.find((x) => x.status === "current")?.title ?? steps.at(-1)!.title;
      return `• ${id}: ${now}
  ${c.track} ${await shortLink(s.origin, `/track/${encodeURIComponent(rec.token)}`)}`;
    }),
  );
  return `${c.statusHead}\n${lines.join("\n")}`;
}

/** Link an order to the chat it came from, and confirm it there. */
export async function linkOrder(ref: string, orderId: string, token: string): Promise<void> {
  const s = await loadWa(ref);
  if (!s) return;
  if (!s.orders.includes(orderId)) s.orders.push(orderId);
  await saveWa(s);
  const c = WA[s.lang ?? "en"];
  await sendWhatsApp(s, `${c.orderPlaced(orderId)}\n${c.track} ${await shortLink(s.origin, `/track/${encodeURIComponent(token)}`)}`);
}

/** Tell the owner on WhatsApp when operations move their order or report a delay. */
export async function notifyOrderUpdate(ref: string, orderId: string, token: string, ev: OrderEvent, order: OrderPayload, events: OrderEvent[]): Promise<void> {
  const s = await loadWa(ref);
  if (!s) return;
  const lang = s.lang ?? "en";
  const c = WA[lang];
  const steps = milestones(order, new Date(), lang, events);
  const step = steps.find((x) => x.key === ev.step);
  if (!step) return;
  const text =
    ev.kind === "done"
      ? c.update(orderId, step.title)
      : c.delayed(orderId, step.title, ev.reason ?? "", step.delay?.newDate ?? "");
  await sendWhatsApp(s, `${text}\n${c.track} ${await shortLink(s.origin, `/track/${encodeURIComponent(token)}`)}`);
}
