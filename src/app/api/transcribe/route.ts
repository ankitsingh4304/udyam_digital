import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;
const MODELS = (process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo,whisper-large-v3").split(",").map((s) => s.trim());

/** Lets the phone know whether server speech-to-text is available. */
export async function GET() {
  return NextResponse.json({ available: !!process.env.GROQ_API_KEY });
}

/**
 * Speech to text with Whisper on Groq: works in every browser (including iPhone Safari and
 * Firefox, which lack built-in recognition) and handles Hindi and Hinglish well.
 * Audio is forwarded and not stored.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "transcribe", 300);
  if (limited) return limited;
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "Speech service not configured." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Recording is too long." }, { status: 413 });
  const lang = String(form?.get("lang") ?? "en");

  let lastError = "Speech service error.";
  for (const model of MODELS) {
    const out = new FormData();
    out.set("file", audio, audio.name || "speech.webm");
    out.set("model", model);
    out.set("response_format", "json");
    out.set("temperature", "0");
    // Hindi script for हिंदी; leave Hinglish/English to auto-detect so Latin-script words survive.
    if (lang === "hi") out.set("language", "hi");
    if (lang === "en") out.set("language", "en");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: out });
    if (res.ok) {
      const data = (await res.json()) as { text?: string };
      return NextResponse.json({ text: (data.text ?? "").trim() });
    }
    lastError = `${res.status}`;
    if (res.status === 401 || res.status === 429) break;
  }
  return NextResponse.json({ error: `Speech service error (${lastError}).` }, { status: 502 });
}
