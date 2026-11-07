import type { OrderEvent, OrderPayload } from "@/domain/orders/tracker";
import { getStore, withLock } from "./store";

/**
 * Shared operational state: who updates what after the owner leaves the screen.
 *  - consent state per case (withdrawal must stop processing on every server)
 *  - verification queue (KYC cases a person must decide)
 *  - orders and their status events (operations update the owner's tracker)
 *  - partner lead claims (so two partners don't call the same owner)
 */

// ---------- Consent ----------
export interface ConsentState {
  status: "given" | "withdrawn";
  purposes: Record<string, boolean>;
  at: string;
}
export const setConsent = (caseId: string, c: ConsentState) => getStore().set(`consent:${caseId}`, c);
export const getConsent = (caseId: string) => getStore().get<ConsentState>(`consent:${caseId}`);
export async function isWithdrawn(caseId: string) {
  try {
    return (await getConsent(caseId))?.status === "withdrawn";
  } catch {
    return false;
  }
}

// ---------- Verification queue ----------
export interface ReviewCase {
  caseId: string;
  business: string;
  gstinMasked?: string;
  reason: string;
  issues: string[];
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}
export async function openReview(r: Omit<ReviewCase, "status" | "createdAt">, now = new Date()) {
  const s = getStore();
  const existing = await s.get<ReviewCase>(`review:${r.caseId}`);
  await s.set(`review:${r.caseId}`, { ...r, status: "pending", createdAt: now.toISOString() } satisfies ReviewCase);
  if (!existing) await s.push("reviews", r.caseId);
}
export const getReview = (caseId: string) => getStore().get<ReviewCase>(`review:${caseId}`);
export async function decideReview(caseId: string, decision: "approved" | "rejected", by: string, note?: string, now = new Date()) {
  const r = await getReview(caseId);
  if (!r) return undefined;
  if (r.status !== "pending") return r;
  const out: ReviewCase = { ...r, status: decision, decidedAt: now.toISOString(), decidedBy: by, note };
  await getStore().set(`review:${caseId}`, out);
  return out;
}
export async function listReviews(): Promise<ReviewCase[]> {
  const ids = [...new Set(await getStore().range<string>("reviews"))].reverse().slice(0, 50);
  return (await Promise.all(ids.map(getReview))).filter((r): r is ReviewCase => !!r);
}

// ---------- Orders ----------
export interface OrderRecord {
  order: OrderPayload;
  token: string;
  events: OrderEvent[];
}
export async function registerOrder(order: OrderPayload, token: string) {
  const s = getStore();
  await s.set(`order:${order.id}`, { order, token, events: [] } satisfies OrderRecord);
  await s.push("orders", order.id);
}
export const getOrder = (id: string) => getStore().get<OrderRecord>(`order:${id}`);
export async function orderEvents(id: string): Promise<OrderEvent[]> {
  try {
    return (await getOrder(id))?.events ?? [];
  } catch {
    return [];
  }
}
export async function addOrderEvent(id: string, ev: OrderEvent) {
  return withLock(`order:${id}`, async () => {
    const rec = await getOrder(id);
    if (!rec) return undefined;
    rec.events.push(ev);
    await getStore().set(`order:${id}`, rec);
    return rec;
  });
}
export async function listOrders(): Promise<OrderRecord[]> {
  const ids = [...new Set(await getStore().range<string>("orders"))].reverse().slice(0, 50);
  return (await Promise.all(ids.map(getOrder))).filter((o): o is OrderRecord => !!o);
}

// ---------- Partner claims ----------
export interface LeadClaim {
  partnerId: string;
  partnerName: string;
  at: string;
}
export async function claimLead(leadId: string, partnerId: string, partnerName: string, now = new Date()) {
  return withLock(`claim:${leadId}`, async () => {
    const s = getStore();
    const existing = await s.get<LeadClaim>(`claim:${leadId}`);
    if (existing && existing.partnerId !== partnerId) return { ok: false as const, claim: existing };
    const claim: LeadClaim = existing ?? { partnerId, partnerName, at: now.toISOString() };
    await s.set(`claim:${leadId}`, claim);
    return { ok: true as const, claim };
  });
}
export async function claimsFor(leadIds: string[]): Promise<Record<string, LeadClaim>> {
  const s = getStore();
  const out: Record<string, LeadClaim> = {};
  await Promise.all(
    leadIds.map(async (id) => {
      const c = await s.get<LeadClaim>(`claim:${id}`).catch(() => undefined);
      if (c) out[id] = c;
    }),
  );
  return out;
}

// ---------- Data rights ----------
export interface DeletionRequest {
  caseId: string;
  orderId: string;
  at: string;
}
export async function requestDeletion(caseId: string, orderId: string, now = new Date()) {
  const s = getStore();
  const existing = await s.get<DeletionRequest>(`deletion:${caseId}`);
  if (existing) return existing;
  const r: DeletionRequest = { caseId, orderId, at: now.toISOString() };
  await s.set(`deletion:${caseId}`, r);
  await s.push("deletions", caseId);
  return r;
}
export async function listDeletions(): Promise<DeletionRequest[]> {
  const ids = [...new Set(await getStore().range<string>("deletions"))].reverse().slice(0, 20);
  return (await Promise.all(ids.map((id) => getStore().get<DeletionRequest>(`deletion:${id}`)))).filter((d): d is DeletionRequest => !!d);
}
