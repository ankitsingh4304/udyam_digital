/**
 * Checks each LLM provider on its own, then the full fallback chain.
 * Run: npx tsx scripts/llm-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { LlmChain } from "../src/adapters/llm/chain";
import { GeminiProvider, GroqProvider } from "../src/adapters/llm/providers";
import type { LlmProvider } from "../src/adapters/llm/types";
import { ProfileDeltaSchema } from "../src/domain/advisor/state";

// Load .env.local without extra dependencies.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const env = process.env;
const mask = (k?: string) => (k ? `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} chars)` : "MISSING");
console.log(`GEMINI_API_KEY ${mask(env.GEMINI_API_KEY)}  model=${env.GEMINI_MODEL || "gemini-flash-latest"}`);
console.log(`GROQ_API_KEY   ${mask(env.GROQ_API_KEY)}  chat=${env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile"}\n`);

const req = {
  system: "Extract business facts. Return JSON with keys segment (micro|prof|multi|mfg), employees (int), city (string).",
  messages: [{ role: "user" as const, content: "Meri dental clinic hai Pune mein, 6 log kaam karte hain" }],
};
const expectOk = (d: z.infer<typeof ProfileDeltaSchema>) => d.segment === "prof" && d.employees === 6 && /pune/i.test(d.city ?? "");

async function one(p: LlmProvider) {
  const t = Date.now();
  try {
    const text = await p.complete(req, { json: true });
    const parsed = ProfileDeltaSchema.safeParse(JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()));
    const ms = Date.now() - t;
    if (!parsed.success) return console.log(`✗ ${p.name}: replied but JSON didn't match the schema (${ms} ms)\n  ${text.slice(0, 200)}`);
    console.log(`${expectOk(parsed.data) ? "✓" : "~"} ${p.name}: ${JSON.stringify(parsed.data)} (${ms} ms)`);
  } catch (e) {
    console.log(`✗ ${p.name}: ${e instanceof Error ? e.message : e}`);
  }
}

(async () => {
  const providers: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) providers.push(new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-flash-latest"));
  if (env.GROQ_API_KEY)
    providers.push(new GroqProvider(env.GROQ_API_KEY, env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile", env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"));

  console.log("1) Each provider alone");
  for (const p of providers) await one(p);

  console.log("\n2) Fallback: Gemini with a wrong key → should land on Groq");
  if (env.GROQ_API_KEY) {
    const chain = new LlmChain([new GeminiProvider("bad-key", "gemini-flash-latest"), ...providers.filter((p) => p.name === "groq")]);
    const r = await chain.json(ProfileDeltaSchema, req);
    console.log(r?.provider === "groq" ? "✓ fell back to groq" : "✗ fallback failed", JSON.stringify(chain.log));
  } else console.log("skipped (no GROQ_API_KEY)");

  console.log("\n3) No providers → app uses the built-in parser");
  console.log((await new LlmChain([]).json(ProfileDeltaSchema, req)) === null ? "✓ returns null → offline path" : "✗ unexpected");
})();
