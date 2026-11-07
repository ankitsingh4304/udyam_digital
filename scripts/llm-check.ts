/**
 * Checks the LLM keys: lists the models each key can use, tests each provider,
 * then the fallback chain. Run: npx tsx scripts/llm-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { LlmChain, stripFences } from "../src/adapters/llm/chain";
import { DEFAULT_MODELS, providersFromEnv } from "../src/adapters/llm/index";
import { GeminiProvider, listGeminiModels, listGroqModels, modelList } from "../src/adapters/llm/providers";
import type { LlmProvider } from "../src/adapters/llm/types";
import { ProfileDeltaSchema } from "../src/domain/advisor/state";

// Load .env.local without extra dependencies.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const env = process.env;
const mask = (k?: string) => (k ? `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} chars)` : "MISSING");

const req = {
  system: "Extract business facts. Return only JSON with keys segment (micro|prof|multi|mfg), employees (int), city (string).",
  messages: [{ role: "user" as const, content: "Meri dental clinic hai Pune mein, 6 log kaam karte hain" }],
};

async function test(p: LlmProvider) {
  const t = Date.now();
  try {
    const text = await p.complete(req, { json: true });
    const parsed = ProfileDeltaSchema.safeParse(JSON.parse(stripFences(text)));
    const ms = Date.now() - t;
    if (!parsed.success) return console.log(`✗ ${p.name}: replied, but not in the expected shape (${ms} ms)\n  ${text.slice(0, 200)}`);
    const d = parsed.data;
    const right = d.segment === "prof" && d.employees === 6 && /pune/i.test(d.city ?? "");
    console.log(`${right ? "✓" : "~"} ${p.name}: ${JSON.stringify(d)} (${ms} ms)`);
  } catch (e) {
    console.log(`✗ ${p.name}: ${e instanceof Error ? e.message.slice(0, 220) : e}`);
  }
}

function report(name: string, available: string[], wanted: string[]) {
  if (!wanted.length) return console.log(`  ${name}: not used (documents are read by Gemini, then Tesseract)`);
  const usable = wanted.filter((m) => available.includes(m));
  console.log(`  ${name}: ${usable.length ? `will use ${usable.join(" → ")}` : "NONE of the configured models are available"}`);
  if (!usable.length) console.log(`  available: ${available.slice(0, 25).join(", ")}`);
}

(async () => {
  console.log(`GEMINI_API_KEY ${mask(env.GEMINI_API_KEY)}`);
  console.log(`GROQ_API_KEY   ${mask(env.GROQ_API_KEY)}\n`);

  console.log("0) Models your keys can use");
  if (env.GEMINI_API_KEY) {
    try {
      report("gemini", await listGeminiModels(env.GEMINI_API_KEY), modelList(env.GEMINI_MODEL, DEFAULT_MODELS.gemini));
    } catch (e) {
      console.log(`  gemini: ✗ ${(e as Error).message.slice(0, 200)}`);
    }
  }
  if (env.GROQ_API_KEY) {
    try {
      const groq = await listGroqModels(env.GROQ_API_KEY);
      report("groq chat", groq, modelList(env.GROQ_CHAT_MODEL, DEFAULT_MODELS.groqChat));
      report("groq vision", groq, modelList(env.GROQ_VISION_MODEL, DEFAULT_MODELS.groqVision));
    } catch (e) {
      console.log(`  groq: ✗ ${(e as Error).message.slice(0, 200)}`);
    }
  }

  const providers = providersFromEnv(env);
  console.log("\n1) Each provider alone (overloaded models retry, then the next model is tried)");
  for (const p of providers) await test(p);

  console.log("\n2) Fallback: Gemini with a wrong key → should land on Groq");
  const groq = providers.find((p) => p.name === "groq");
  if (groq) {
    const chain = new LlmChain([new GeminiProvider("bad-key", ["gemini-flash-latest"]), groq]);
    const r = await chain.json(ProfileDeltaSchema, req);
    console.log(r?.provider === "groq" ? "✓ fell back to groq" : `✗ fallback failed ${JSON.stringify(chain.log).slice(0, 300)}`);
  } else console.log("skipped (no GROQ_API_KEY)");

  console.log("\n3) No providers → app uses the built-in parser");
  console.log((await new LlmChain([]).json(ProfileDeltaSchema, req)) === null ? "✓ returns null → offline path" : "✗ unexpected");
})();
