import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider, GroqProvider } from "@/adapters/llm/providers";

const req = { system: "s", messages: [{ role: "user" as const, content: "hi" }] };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const geminiOk = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };

afterEach(() => vi.unstubAllGlobals());

describe("model fallback inside a provider", () => {
  it("Gemini 503 twice on the first model → retries, then uses the second model", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url.includes("model-a") ? "a" : "b");
      return url.includes("model-a") ? reply(503, { error: "busy" }) : reply(200, geminiOk);
    }));
    const text = await new GeminiProvider("k", ["model-a", "model-b"]).complete(req, { json: true });
    expect(text).toBe('{"ok":true}');
    expect(calls).toEqual(["a", "a", "b"]);
  });

  it("Groq 404 (retired model) → next model immediately, no retry", async () => {
    const models: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const m = JSON.parse(String(init.body)).model as string;
      models.push(m);
      return m === "old" ? reply(404, { error: { code: "model_not_found" } }) : reply(200, { choices: [{ message: { content: "{}" } }] });
    }));
    await new GroqProvider("k", ["old", "new"], ["v"]).complete(req, { json: true });
    expect(models).toEqual(["old", "new"]);
  });

  it("a model that doesn't answer in time is skipped, not retried", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      seen.push(url.includes("slow") ? "slow" : "fast");
      if (url.includes("slow")) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      return reply(200, geminiOk);
    }));
    await new GeminiProvider("k", ["slow", "fast"]).complete(req, { json: true });
    expect(seen).toEqual(["slow", "fast"]);
  });

  it("vision with no image model configured fails fast, so the caller uses Tesseract", async () => {
    await expect(new GroqProvider("k", ["c"], []).complete({ ...req, image: { base64: "x", mimeType: "image/png" } }, { json: true })).rejects.toThrow("no model configured");
  });

  it("bad key (400/401) is not retried, so the chain can switch provider", async () => {
    const f = vi.fn(async () => reply(400, { error: "API key not valid" }));
    vi.stubGlobal("fetch", f);
    await expect(new GeminiProvider("bad", ["a", "b"]).complete(req, { json: true })).rejects.toThrow("400");
    expect(f).toHaveBeenCalledTimes(1);
  });
});
