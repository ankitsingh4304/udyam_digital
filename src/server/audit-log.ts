import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { WRITABLE_DIR } from "./paths";

/**
 * Append-only, hash-chained audit log (DPDP: accountability). Each entry stores the hash of
 * the previous one, so editing or deleting any past line breaks the chain and is detectable.
 * Entries carry no raw identifiers: case IDs, purposes, verdicts, check codes only.
 */
export interface AuditEntry {
  seq: number;
  ts: string;
  type: "CONSENT_GIVEN" | "CONSENT_WITHDRAWN" | "KYC_PROCESSED" | "DOCS_DISCARDED" | "ORDER_PLACED" | "ESIGN_COMPLETED";
  caseId: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

const FILE = process.env.UDYAM_AUDIT_LOG ?? path.join(WRITABLE_DIR, "audit.jsonl");
const GENESIS = "0".repeat(64);
let entries: AuditEntry[] | undefined;

const hashOf = (e: Omit<AuditEntry, "hash">) =>
  createHash("sha256").update(JSON.stringify([e.seq, e.ts, e.type, e.caseId, e.data, e.prevHash])).digest("hex");

function load(): AuditEntry[] {
  if (entries) return entries;
  try {
    entries = existsSync(FILE) ? readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEntry) : [];
  } catch {
    entries = [];
  }
  return entries;
}

export function appendAudit(type: AuditEntry["type"], caseId: string, data: Record<string, unknown>, now = new Date()): AuditEntry {
  const log = load();
  const prev = log.at(-1);
  const base = { seq: (prev?.seq ?? 0) + 1, ts: now.toISOString(), type, caseId, data, prevHash: prev?.hash ?? GENESIS };
  const entry: AuditEntry = { ...base, hash: hashOf(base) };
  log.push(entry);
  try {
    mkdirSync(path.dirname(FILE), { recursive: true });
    appendFileSync(FILE, JSON.stringify(entry) + "\n");
  } catch (e) {
    // Never fail the customer's request because the log file can't be written; keep it in memory.
    console.warn(`audit log not persisted: ${(e as Error).message}`);
  }
  return entry;
}

export function verifyAuditChain(list: AuditEntry[] = load()): { ok: boolean; brokenAt?: number } {
  let prev = GENESIS;
  for (const e of list) {
    const { hash, ...rest } = e;
    if (e.prevHash !== prev || hashOf(rest) !== hash) return { ok: false, brokenAt: e.seq };
    prev = hash;
  }
  return { ok: true };
}

export const auditEntries = (caseId?: string) => load().filter((e) => !caseId || e.caseId === caseId);

/** Current consent state for a case: the latest consent event wins. */
export function activeConsent(caseId: string): Record<string, boolean> | undefined {
  const last = load().filter((e) => e.caseId === caseId && (e.type === "CONSENT_GIVEN" || e.type === "CONSENT_WITHDRAWN")).at(-1);
  return last?.type === "CONSENT_GIVEN" ? (last.data.purposes as Record<string, boolean>) : undefined;
}

export const newCaseId = () => `case_${randomUUID().slice(0, 8)}`;

/** Test helper. */
export function _resetAuditForTests(list: AuditEntry[] = []) {
  entries = list;
}
