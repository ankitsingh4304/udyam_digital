import { createHash, randomUUID } from "node:crypto";
import { getStore, withLock } from "./store";

/**
 * Append-only, hash-chained audit log (DPDP: accountability). Each entry stores the hash of
 * the previous one, so editing or deleting any past line breaks the chain and is detectable.
 * Entries carry no raw identifiers: case IDs, purposes, verdicts, check codes only.
 * Stored in the shared store, so every server instance appends to one chain.
 */
export type AuditType =
  | "CONSENT_GIVEN"
  | "CONSENT_WITHDRAWN"
  | "KYC_PROCESSED"
  | "DOCS_DISCARDED"
  | "REVIEW_DECIDED"
  | "ESIGN_COMPLETED"
  | "ORDER_PLACED"
  | "ORDER_UPDATED"
  | "LEAD_CLAIMED"
  | "DATA_DELETION_REQUESTED"
  | "WA_OPT_OUT"
  | "WA_CHAT_STARTED"
  | "WA_QUOTED"
  | "WA_HANDOFF";

export interface AuditEntry {
  seq: number;
  ts: string;
  type: AuditType;
  caseId: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

const LIST = "audit";
const HEAD = "audit:head";
const GENESIS = "0".repeat(64);
/** Last resort if the store itself is unreachable: keep entries in memory, never fail the request. */
const fallback: AuditEntry[] = [];

const hashOf = (e: Omit<AuditEntry, "hash">) =>
  createHash("sha256").update(JSON.stringify([e.seq, e.ts, e.type, e.caseId, e.data, e.prevHash])).digest("hex");

export async function appendAudit(type: AuditType, caseId: string, data: Record<string, unknown>, now = new Date()): Promise<AuditEntry> {
  const build = (prev?: { seq: number; hash: string }): AuditEntry => {
    const base = { seq: (prev?.seq ?? 0) + 1, ts: now.toISOString(), type, caseId, data, prevHash: prev?.hash ?? GENESIS };
    return { ...base, hash: hashOf(base) };
  };
  try {
    const s = getStore();
    return await withLock(LIST, async () => {
      const entry = build(await s.get<{ seq: number; hash: string }>(HEAD));
      await s.push(LIST, entry);
      await s.set(HEAD, { seq: entry.seq, hash: entry.hash });
      return entry;
    });
  } catch (e) {
    console.warn(`audit log not persisted: ${(e as Error).message}`);
    const entry = build(fallback.at(-1));
    fallback.push(entry);
    return entry;
  }
}

export function verifyAuditChain(list: AuditEntry[]): { ok: boolean; brokenAt?: number } {
  let prev = GENESIS;
  for (const e of list) {
    const { hash, ...rest } = e;
    if (e.prevHash !== prev || hashOf(rest) !== hash) return { ok: false, brokenAt: e.seq };
    prev = hash;
  }
  return { ok: true };
}

export async function auditEntries(caseId?: string): Promise<AuditEntry[]> {
  let list: AuditEntry[];
  try {
    list = await getStore().range<AuditEntry>(LIST);
  } catch {
    list = [...fallback];
  }
  return list.filter((e) => !caseId || e.caseId === caseId);
}

export const newCaseId = () => `case_${randomUUID().slice(0, 8)}`;
