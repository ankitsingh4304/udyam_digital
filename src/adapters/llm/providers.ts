import { ProviderError, RateLimitError, type JsonRequest, type LlmProvider } from "./types";

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "a, b ,c" → ["a","b","c"] */
export const modelList = (v: string | undefined, fallback: string[]) => {
  const list = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
};

async function post(provider: string, url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new RateLimitError(provider, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60_000);
    }
    if (!res.ok) throw new ProviderError(provider, res.status, (await res.text()).slice(0, 300));
    return (await res.json()) as unknown;
  } catch (e) {
    // Our own timeout: report it as a gateway timeout so the next model gets a turn.
    if (e instanceof Error && e.name === "AbortError" && !signal?.aborted) throw new ProviderError(provider, 504, `no answer within ${TIMEOUT_MS} ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Errors worth trying the next model for: overloaded (500/502/503), timed out (504) or model missing (404). */
const tryNextModel = (e: unknown) => e instanceof ProviderError && [404, 500, 502, 503, 504].includes(e.status);

/**
 * Walk a model list: on overload, retry once after a short pause, then move to the next
 * model; on "model not found", move on immediately. Auth errors and rate limits stop here
 * so the chain can switch provider.
 */
async function withModels<T>(provider: string, models: string[], call: (model: string) => Promise<T>): Promise<T> {
  if (!models.length) throw new ProviderError(provider, 404, "no model configured for this task");
  let last: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await call(model);
      } catch (e) {
        last = e;
        if (!tryNextModel(e)) throw e;
        if ([404, 504].includes((e as ProviderError).status)) break; // missing or slow: move on, don't wait again
        if (attempt === 0) await sleep(1200);
      }
    }
  }
  throw last;
}

/** Google Gemini via the Generative Language REST API (free tier works). */
export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  readonly supportsVision = true;
  constructor(
    private apiKey: string,
    private models: string[],
  ) {}

  async complete(req: JsonRequest, opts: { json: boolean; signal?: AbortSignal }) {
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] as unknown[] }));
    if (req.image && contents.length) {
      contents[contents.length - 1].parts.push({ inline_data: { mime_type: req.image.mimeType, data: req.image.base64 } });
    }
    return withModels(this.name, this.models, async (model) => {
      const data = (await post(
        this.name,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": this.apiKey },
        {
          systemInstruction: { parts: [{ text: req.system }] },
          contents,
          generationConfig: {
            temperature: req.temperature ?? 0,
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        },
        opts.signal,
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new ProviderError(this.name, 502, "empty response");
      return text;
    });
  }
}

/** Groq via its OpenAI-compatible endpoint (free tier works). */
export class GroqProvider implements LlmProvider {
  readonly name = "groq";
  readonly supportsVision: boolean;
  constructor(
    private apiKey: string,
    private chatModels: string[],
    private visionModels: string[],
  ) {
    this.supportsVision = visionModels.length > 0;
  }

  async complete(req: JsonRequest, opts: { json: boolean; vision?: boolean; signal?: AbortSignal }) {
    const messages: unknown[] = [{ role: "system", content: req.system }];
    req.messages.forEach((m, i) => {
      const last = i === req.messages.length - 1;
      if (last && req.image) {
        messages.push({
          role: m.role,
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } },
          ],
        });
      } else messages.push({ role: m.role, content: m.content });
    });
    const models = req.image || opts.vision ? this.visionModels : this.chatModels;
    return withModels(this.name, models, async (model) => {
      const data = (await post(
        this.name,
        "https://api.groq.com/openai/v1/chat/completions",
        { authorization: `Bearer ${this.apiKey}` },
        {
          model,
          messages,
          temperature: req.temperature ?? 0,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        },
        opts.signal,
      )) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) throw new ProviderError(this.name, 502, "empty response");
      return text;
    });
  }
}

/** Model IDs the key can use, for the setup check. */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": apiKey } });
  if (!res.ok) throw new ProviderError("gemini", res.status, (await res.text()).slice(0, 200));
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
}

export async function listGroqModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new ProviderError("groq", res.status, (await res.text()).slice(0, 200));
  const data = (await res.json()) as { data?: { id: string; active?: boolean }[] };
  return (data.data ?? []).filter((m) => m.active !== false).map((m) => m.id);
}
