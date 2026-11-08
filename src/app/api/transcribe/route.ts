import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { speechAvailable, transcribe } from "@/server/speech";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;

/** Lets the phone know whether server speech-to-text is available. */
export async function GET() {
  return NextResponse.json({ available: speechAvailable() });
}

/**
 * Speech to text with Whisper on Groq: works in every browser (including iPhone Safari and
 * Firefox, which lack built-in recognition) and handles Indian languages well.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "transcribe", 300);
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Recording is too long." }, { status: 413 });
  const r = await transcribe(audio, audio.name || "speech.webm", String(form?.get("lang") ?? "en"));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
