import { LlmChain } from "./chain";
import { GeminiProvider, GroqProvider, modelList } from "./providers";
import type { LlmProvider } from "./types";

/** Tried in order; overloaded or retired models are skipped automatically. Override with comma lists in .env.local. */
export const DEFAULT_MODELS = {
  // Flash-Lite first: extraction is simple, Lite answers faster and has more free quota.
  gemini: ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
  groqChat: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
  // No image model on our Groq free tier (Nov 2026); documents fall back to Tesseract.
  groqVision: [] as string[],
};

export function providersFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider[] {
  const providers: LlmProvider[] = [];
  if (env.GEMINI_API_KEY) providers.push(new GeminiProvider(env.GEMINI_API_KEY, modelList(env.GEMINI_MODEL, DEFAULT_MODELS.gemini)));
  if (env.GROQ_API_KEY)
    providers.push(
      new GroqProvider(env.GROQ_API_KEY, modelList(env.GROQ_CHAT_MODEL, DEFAULT_MODELS.groqChat), modelList(env.GROQ_VISION_MODEL, DEFAULT_MODELS.groqVision)),
    );
  return providers;
}

let chain: LlmChain | undefined;

/** Server-only. Gemini first, Groq as fallback; empty chain when no keys (offline mode). */
export function getLlm(): LlmChain {
  chain ??= new LlmChain(providersFromEnv());
  return chain;
}
