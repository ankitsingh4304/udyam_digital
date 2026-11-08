"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/domain/advisor/state";
import { LANG_TAG } from "@/i18n";

export type VoiceState = "idle" | "listening" | "transcribing";
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
  start: () => void;
  stop: () => void;
};

const SPEECH_LANG: Record<Lang, string> = LANG_TAG;

/**
 * Voice input. Preferred: record with the microphone and transcribe with Whisper on our server
 * (works on every browser, good with Hindi/Hinglish). It stops by itself after ~1.5 s of silence.
 * Fallback: the browser's built-in speech recognition.
 */
export function useVoiceInput(opts: { lang: Lang; onText: (text: string) => void; onInterim?: (text: string) => void; onError: (message: string) => void }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [serverStt, setServerStt] = useState<boolean | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((d: { available: boolean }) => setServerStt(!!d.available))
      .catch(() => setServerStt(false));
  }, []);

  const startRecorder = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      optsRef.current.onError("micBlocked");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    // Silence detection: stop ~1.5 s after the owner stops talking.
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();
    let spoke = false;
    let lastLoud = Date.now();
    // Adapt to the room: learn the background level in the first 400 ms (a busy shop is louder than an office).
    let floor = 0;
    let floorSamples = 0;
    if (ctx.state === "suspended") void ctx.resume();
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) * (v - 128);
      const rms = Math.sqrt(sum / buf.length);
      if (Date.now() - startedAt < 400) {
        floor = (floor * floorSamples + rms) / ++floorSamples;
        return;
      }
      if (rms > Math.max(8, floor * 2.5)) {
        spoke = true;
        lastLoud = Date.now();
      }
      const now = Date.now();
      if ((spoke && now - lastLoud > 1500) || (!spoke && now - startedAt > 7000) || now - startedAt > 20000) stop();
    }, 100);

    const stop = () => {
      clearInterval(timer);
      if (rec.state !== "inactive") rec.stop();
    };
    stopRef.current = stop;

    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      if (!spoke || !chunks.length) {
        setState("idle");
        optsRef.current.onError("noSpeech");
        return;
      }
      setState("transcribing");
      try {
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
        const form = new FormData();
        form.set("audio", new File(chunks, `speech.${ext}`, { type }));
        form.set("lang", optsRef.current.lang);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !data.text) throw new Error(data.error ?? "empty");
        optsRef.current.onText(data.text);
      } catch {
        optsRef.current.onError("sttFailed");
      } finally {
        setState("idle");
      }
    };
    rec.start(250);
    setState("listening");
  }, []);

  const startBrowser = useCallback(() => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      optsRef.current.onError("noVoice");
      return;
    }
    const rec = new Ctor();
    rec.lang = SPEECH_LANG[optsRef.current.lang];
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      optsRef.current.onInterim?.(finalText + interim);
    };
    rec.onerror = (e) => optsRef.current.onError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "micBlocked" : e.error === "no-speech" ? "noSpeech" : "sttFailed");
    rec.onend = () => {
      setState("idle");
      if (finalText.trim()) optsRef.current.onText(finalText.trim());
    };
    stopRef.current = () => rec.stop();
    setState("listening");
    rec.start();
  }, []);

  const toggle = useCallback(() => {
    if (state === "listening") return stopRef.current();
    if (state !== "idle") return;
    const canRecord = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    if (serverStt && canRecord) void startRecorder();
    else startBrowser();
  }, [state, serverStt, startRecorder, startBrowser]);

  return { state, toggle };
}

// ---------- Read aloud ----------

let voicesCache: SpeechSynthesisVoice[] = [];
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve((voicesCache = now));
  return new Promise((resolve) => {
    const done = () => resolve((voicesCache = synth.getVoices()));
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Best installed voice: exact language, then same language family; prefer natural/online voices. */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | undefined {
  const code = LANG_TAG[lang].split("-")[0];
  const want = lang === "en" ? ["en-IN", "en-GB", "en-US", "en"] : lang === "hinglish" ? ["hi-IN", "hi", "en-IN"] : [LANG_TAG[lang], code];
  const score = (v: SpeechSynthesisVoice) => (/(google|natural|online|neural)/i.test(v.name) ? 1 : 0);
  for (const w of want) {
    const matches = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(w.toLowerCase()));
    if (matches.length) return matches.sort((a, b) => score(b) - score(a))[0];
  }
  return undefined;
}

/** Split into sentence-sized pieces: Chrome cuts off long utterances after ~15 seconds. */
export function chunkForSpeech(text: string, max = 180): string[] {
  const clean = text.replace(/\s+/g, " ").replace(/₹\s?([\d,]+)/g, "₹$1 ").trim();
  const sentences = clean.match(/[^.!?।\n]+[.!?।]?/g) ?? [clean];
  const out: string[] = [];
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    if (s.length <= max) out.push(s);
    else for (const part of s.split(/(?<=[,;:])\s+/)) if (part.trim()) out.push(part.trim());
  }
  return out;
}

export type SpeakResult = "ok" | "unsupported" | "noVoice";

/** Read text aloud completely, in the chosen language's voice. Cancels anything already speaking. */
export async function speakTexts(texts: string[], lang: Lang): Promise<SpeakResult> {
  if (typeof window === "undefined" || !window.speechSynthesis) return "unsupported";
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = voicesCache.length ? voicesCache : await loadVoices();
  const voice = pickVoice(voices, lang);
  // Indian scripts need a voice for that language; an English voice would read only the Latin words.
  const nonLatin = texts.some((t) => /[\u0900-\u0DFF]/.test(t));
  const code = LANG_TAG[lang].split("-")[0];
  if (nonLatin && !(voice && voice.lang.toLowerCase().startsWith(code))) return "noVoice";
  // Small pause after cancel(): Chrome sometimes drops an utterance queued immediately after it.
  await new Promise((r) => setTimeout(r, 120));
  for (const piece of texts.flatMap((t) => chunkForSpeech(t))) {
    const u = new SpeechSynthesisUtterance(piece);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? LANG_TAG[lang];
    u.rate = 0.95;
    synth.speak(u);
  }
  return "ok";
}

export function stopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
