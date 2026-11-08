/**
 * Speech to text with Whisper on Groq. Audio is forwarded and not stored.
 * Used by the web mic and by WhatsApp voice notes.
 */
const MODELS = (process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo,whisper-large-v3").split(",").map((s) => s.trim());
// Native script for each Indian language; Hinglish auto-detects so Latin-script words survive.
const WHISPER: Record<string, string> = { en: "en", hi: "hi", mr: "mr", gu: "gu", kn: "kn", te: "te", ta: "ta", bn: "bn" };

export const speechAvailable = () => !!process.env.GROQ_API_KEY;

export async function transcribe(audio: Blob, filename: string, lang: string): Promise<{ text: string } | { error: string; status: number }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { error: "Speech service not configured.", status: 503 };
  let lastError = "Speech service error.";
  for (const model of MODELS) {
    const out = new FormData();
    out.set("file", audio, filename);
    out.set("model", model);
    out.set("response_format", "json");
    out.set("temperature", "0");
    if (WHISPER[lang]) out.set("language", WHISPER[lang]);
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: out });
    if (res.ok) return { text: (((await res.json()) as { text?: string }).text ?? "").trim() };
    lastError = `${res.status}`;
    if (res.status === 401 || res.status === 429) break;
  }
  return { error: `Speech service error (${lastError}).`, status: 502 };
}
