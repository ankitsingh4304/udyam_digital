import { LlmChain } from "./chain";
import { GeminiProvider, GroqProvider, modelList } from "./providers";
import type { LlmProvider } from "./types";

/** Tried in order; overloaded or retired models are skipped automatically. Override with comma lists in .env.local. */
export const DEFAULT_MODELS = {
  gemini: ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  groqChat: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"],
  groqVision: ["meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"],
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
