import { LlmChain } from "./chain";
import { GeminiProvider, GroqProvider } from "./providers";
import type { LlmProvider } from "./types";

let chain: LlmChain | undefined;

/** Server-only. Gemini first, Groq as fallback; empty chain when no keys (offline mode). */
export function getLlm(): LlmChain {
  if (chain) return chain;
  const providers: LlmProvider[] = [];
  if (process.env.GEMINI_API_KEY)
    providers.push(new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || "gemini-flash-latest"));
  if (process.env.GROQ_API_KEY)
    providers.push(
      new GroqProvider(
        process.env.GROQ_API_KEY,
        process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile",
        process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      ),
    );
  chain = new LlmChain(providers);
  return chain;
}
