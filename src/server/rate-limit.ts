import { NextResponse } from "next/server";

/**
 * Per-IP sliding-window limit (per server instance). Protects the free LLM quota and OCR CPU
 * from a stuck client or a scraper. Production: move to a shared store (Redis) or the edge.
 */
const hits = new Map<string, number[]>();

export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 60_000): NextResponse | undefined {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retry = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return NextResponse.json({ error: `Too many requests. Try again in ${retry} seconds.` }, { status: 429, headers: { "retry-after": String(retry) } });
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return undefined;
}
