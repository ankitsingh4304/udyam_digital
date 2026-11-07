import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WRITABLE_DIR } from "./paths";

/**
 * Small key-value + list store for state that several people share: order status updates,
 * the verification queue, consent state, partner lead claims and the audit log.
 *
 * - Shared mode: Upstash Redis over REST (free tier; added from the Vercel dashboard, which sets
 *   KV_REST_API_URL / KV_REST_API_TOKEN). Every server instance sees the same data.
 * - Local mode: memory + a JSON file. Right for `npm run dev`; on serverless hosting each
 *   instance keeps its own copy, which the operations panel says openly.
 */
export interface Store {
  mode: "shared" | "local";
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  push(key: string, value: unknown): Promise<void>;
  range<T>(key: string, start?: number, stop?: number): Promise<T[]>;
  /** Short exclusive lock (true if acquired). */
  lock(key: string, ttlMs: number): Promise<boolean>;
  unlock(key: string): Promise<void>;
}

class LocalStore implements Store {
  mode = "local" as const;
  private data: { kv: Record<string, unknown>; lists: Record<string, unknown[]> } | undefined;
  private locks = new Map<string, number>();
  constructor(private file: string) {}

  private load() {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(readFileSync(this.file, "utf8"));
    } catch {
      this.data = { kv: {}, lists: {} };
    }
    return this.data!;
  }
  private save() {
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.data));
    } catch {
      // Read-only filesystem: keep it in memory. Never fail a customer request over this.
    }
  }
  async get<T>(key: string) {
    return structuredClone(this.load().kv[key]) as T | undefined;
  }
  async set(key: string, value: unknown) {
    this.load().kv[key] = structuredClone(value);
    this.save();
  }
  async push(key: string, value: unknown) {
    (this.load().lists[key] ??= []).push(structuredClone(value));
    this.save();
  }
  async range<T>(key: string, start = 0, stop = -1) {
    const list = this.load().lists[key] ?? [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return structuredClone(list.slice(start < 0 ? Math.max(0, list.length + start) : start, end)) as T[];
  }
  async lock(key: string, ttlMs: number) {
    const now = Date.now();
    if ((this.locks.get(key) ?? 0) > now) return false;
    this.locks.set(key, now + ttlMs);
    return true;
  }
  async unlock(key: string) {
    this.locks.delete(key);
  }
}

class UpstashStore implements Store {
  mode = "shared" as const;
  constructor(private url: string, private token: string, private prefix = "udyam:") {}

  private async cmd<T>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const body = (await res.json()) as { result?: T; error?: string };
    if (!res.ok || body.error) throw new Error(`store: ${body.error ?? res.status}`);
    return body.result as T;
  }
  private k = (key: string) => this.prefix + key;
  async get<T>(key: string) {
    const v = await this.cmd<string | null>("GET", this.k(key));
    return v == null ? undefined : (JSON.parse(v) as T);
  }
  async set(key: string, value: unknown) {
    await this.cmd("SET", this.k(key), JSON.stringify(value));
  }
  async push(key: string, value: unknown) {
    await this.cmd("RPUSH", this.k(key), JSON.stringify(value));
  }
  async range<T>(key: string, start = 0, stop = -1) {
    const list = await this.cmd<string[]>("LRANGE", this.k(key), start, stop);
    return list.map((v) => JSON.parse(v) as T);
  }
  async lock(key: string, ttlMs: number) {
    return (await this.cmd<string | null>("SET", this.k(`lock:${key}`), "1", "NX", "PX", ttlMs)) === "OK";
  }
  async unlock(key: string) {
    await this.cmd("DEL", this.k(`lock:${key}`));
  }
}

let store: Store | undefined;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? new UpstashStore(url, token) : new LocalStore(process.env.UDYAM_STORE_FILE ?? path.join(WRITABLE_DIR, "store.json"));
  return store;
}

/** Test helper: a fresh local store at the given file. */
export function _useLocalStoreForTests(file: string) {
  store = new LocalStore(file);
  return store;
}

/** Run `fn` while holding a short lock; retries briefly, then runs anyway (never blocks a customer). */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const s = getStore();
  let held = false;
  for (let i = 0; i < 20 && !(held = await s.lock(key, 3000)); i++) await new Promise((r) => setTimeout(r, 50));
  try {
    return await fn();
  } finally {
    if (held) await s.unlock(key);
  }
}
