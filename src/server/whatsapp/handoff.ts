import { getStore } from "@/server/store";

/**
 * "Talk to a person" from WhatsApp: the chat lands in the local partner's queue (or operations,
 * if no partner covers the city). Partners see the answers so far; the contact address is only
 * shown to the partner who takes it, because the owner asked to be contacted.
 */
export interface Handoff {
  id: string; // "wa-<ref>"
  ref: string;
  city?: string;
  summary: string;
  lang: string;
  channel: string;
  contact: string;
  at: string;
  takenBy?: { partnerId: string; partnerName: string; at: string };
}

export async function createHandoff(h: Omit<Handoff, "id" | "at">, now = new Date()): Promise<Handoff> {
  const s = getStore();
  const id = `wa-${h.ref}`;
  const existing = await s.get<Handoff>(`handoff:${id}`);
  const rec: Handoff = { ...existing, ...h, id, at: now.toISOString(), takenBy: existing?.takenBy };
  await s.set(`handoff:${id}`, rec);
  if (!existing) await s.push("handoffs", id);
  return rec;
}

export const getHandoff = (id: string) => getStore().get<Handoff>(`handoff:${id}`);

export async function listHandoffs(city?: string): Promise<Handoff[]> {
  const ids = [...new Set(await getStore().range<string>("handoffs"))].reverse().slice(0, 50);
  const all = (await Promise.all(ids.map(getHandoff))).filter((h): h is Handoff => !!h);
  return city ? all.filter((h) => h.city === city) : all;
}

export async function takeHandoff(id: string, partnerId: string, partnerName: string, now = new Date()) {
  const h = await getHandoff(id);
  if (!h) return undefined;
  if (h.takenBy && h.takenBy.partnerId !== partnerId) return { ok: false as const, h };
  const out: Handoff = { ...h, takenBy: h.takenBy ?? { partnerId, partnerName, at: now.toISOString() } };
  await getStore().set(`handoff:${id}`, out);
  return { ok: true as const, h: out };
}
