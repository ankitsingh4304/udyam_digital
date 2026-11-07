import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkForSpeech, pickVoice } from "@/app/advisor/voice";
import { GET, POST } from "@/app/api/transcribe/route";

const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

describe("read aloud", () => {
  it("splits long replies into whole sentences so nothing is cut off", () => {
    const reply = "Here's what I understood: clinic (professional office); 4 staff, 1 site; Nagpur (tier 2); GSTIN active; 1 Gbps. If anything is wrong, change it on the quote.";
    const parts = chunkForSpeech(reply);
    expect(parts.join(" ")).toBe(reply);
    expect(parts.every((p) => p.length <= 180)).toBe(true);
    expect(chunkForSpeech("मैंने यह समझा। कुछ गलत हो तो बदल दें।")).toEqual(["मैंने यह समझा।", "कुछ गलत हो तो बदल दें।"]);
  });

  it("picks a Hindi voice for Hindi, preferring natural/online voices; English voice for English", () => {
    const voices = [v("Microsoft Ravi", "en-IN"), v("Microsoft Hemant", "hi-IN"), v("Google हिन्दी", "hi-IN"), v("Google UK English", "en-GB")];
    expect(pickVoice(voices, "hi")?.name).toBe("Google हिन्दी");
    expect(pickVoice(voices, "en")?.name).toBe("Microsoft Ravi");
    expect(pickVoice([v("Google US English", "en-US")], "hi")).toBeUndefined();
  });
});

describe("/api/transcribe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reports unavailable without a Groq key", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(await (await GET()).json()).toEqual({ available: false });
  });

  it("forwards audio to Whisper with the Hindi language hint and returns the text", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    const seen: FormData[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      seen.push(init.body as FormData);
      return new Response(JSON.stringify({ text: " मेरी डेंटल क्लिनिक है " }), { status: 200 });
    }));
    const form = new FormData();
    form.set("audio", new File([new Uint8Array(2000)], "speech.webm", { type: "audio/webm" }));
    form.set("lang", "hi");
    const res = await POST(new Request("http://x/api/transcribe", { method: "POST", body: form }));
    expect(await res.json()).toEqual({ text: "मेरी डेंटल क्लिनिक है" });
    expect(seen[0].get("language")).toBe("hi");
    expect(seen[0].get("model")).toBe("whisper-large-v3-turbo");
  });

  it("Hinglish leaves language to auto-detect", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    const seen: FormData[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => (seen.push(init.body as FormData), new Response(JSON.stringify({ text: "meri dukaan hai" })))));
    const form = new FormData();
    form.set("audio", new File([new Uint8Array(500)], "s.webm", { type: "audio/webm" }));
    form.set("lang", "hinglish");
    await POST(new Request("http://x/api/transcribe", { method: "POST", body: form }));
    expect(seen[0].get("language")).toBeNull();
  });
});
