import type { z } from "zod";
import { RateLimitError, type JsonRequest, type LlmProvider } from "./types";

export interface ChainResult<T> {
  value: T;
  provider: string;
}

export interface ChainLog {
  provider: string;
  outcome: "ok" | "rate_limited" | "error" | "invalid_output" | "skipped_cooldown";
  detail?: string;
}

/**
 * Tries providers in order. A rate-limited or failing provider is put on cooldown
 * so later requests skip it. Output must pass the Zod schema, or the next provider
 * is tried. Returns null when every provider fails — callers then use the
 * deterministic (no-LLM) path, so the journey never breaks.
 */
export class LlmChain {
  private cooldownUntil = new Map<string, number>();
  readonly log: ChainLog[] = [];

  constructor(
    private providers: LlmProvider[],
    private now: () => number = Date.now,
    private errorCooldownMs = 30_000,
  ) {}

  get names() {
    return this.providers.map((p) => p.name);
  }

  async json<T>(schema: z.ZodType<T>, req: JsonRequest, opts: { vision?: boolean } = {}): Promise<ChainResult<T> | null> {
    for (const p of this.providers) {
      const until = this.cooldownUntil.get(p.name) ?? 0;
      if (this.now() < until) {
        this.record({ provider: p.name, outcome: "skipped_cooldown" });
        continue;
      }
      try {
        const text = await p.complete(req, { json: true, vision: opts.vision });
        const parsed = schema.safeParse(JSON.parse(stripFences(text)));
        if (!parsed.success) {
          this.record({ provider: p.name, outcome: "invalid_output", detail: parsed.error.issues[0]?.message });
          continue;
        }
        this.record({ provider: p.name, outcome: "ok" });
        return { value: parsed.data, provider: p.name };
      } catch (e) {
        if (e instanceof RateLimitError) {
          this.cooldownUntil.set(p.name, this.now() + e.retryAfterMs);
          this.record({ provider: p.name, outcome: "rate_limited", detail: `${e.retryAfterMs} ms` });
        } else {
          this.cooldownUntil.set(p.name, this.now() + this.errorCooldownMs);
          this.record({ provider: p.name, outcome: "error", detail: e instanceof Error ? e.message.slice(0, 160) : String(e) });
        }
      }
    }
    return null;
  }

  private record(entry: ChainLog) {
    this.log.push(entry);
    if (this.log.length > 200) this.log.shift();
  }
}

/** Remove code fences and reasoning blocks some models add around JSON. */
export function stripFences(text: string) {
  const t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}
