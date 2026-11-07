import { ProviderError, RateLimitError, type JsonRequest, type LlmProvider } from "./types";

const TIMEOUT_MS = 12_000;

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
  } finally {
    clearTimeout(timer);
  }
}

/** Google Gemini via the Generative Language REST API (free tier works). */
export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async complete(req: JsonRequest, opts: { json: boolean; signal?: AbortSignal }) {
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] as unknown[] }));
    if (req.image && contents.length) {
      contents[contents.length - 1].parts.push({ inline_data: { mime_type: req.image.mimeType, data: req.image.base64 } });
    }
    const data = (await post(
      this.name,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
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
    if (!text) throw new ProviderError(this.name, 200, "empty response");
    return text;
  }
}

/** Groq via its OpenAI-compatible endpoint (free tier works). */
export class GroqProvider implements LlmProvider {
  readonly name = "groq";
  constructor(
    private apiKey: string,
    private chatModel: string,
    private visionModel: string,
  ) {}

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
    const data = (await post(
      this.name,
      "https://api.groq.com/openai/v1/chat/completions",
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: req.image || opts.vision ? this.visionModel : this.chatModel,
        messages,
        temperature: req.temperature ?? 0,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      },
      opts.signal,
    )) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new ProviderError(this.name, 200, "empty response");
    return text;
  }
}
