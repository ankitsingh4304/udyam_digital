"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdvisorState, Lang } from "@/domain/advisor/state";
import type { AdvisorTurnResult } from "@/server/advisor-service";
import { QuoteLedger } from "./QuoteLedger";

interface Bubble {
  from: "advisor" | "owner";
  text: string;
}

const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "हिंदी", hinglish: "Hinglish" };
const SPEECH_LANG: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", hinglish: "en-IN" };
const PROVIDER_LABEL: Record<string, string> = { gemini: "Gemini", groq: "Groq", offline: "built-in rules" };
const UI: Record<Lang, { placeholder: string; send: string; listen: string; stop: string; speak: string; restart: string; source: string }> = {
  en: { placeholder: "Type your answer", send: "Send", listen: "Speak", stop: "Stop", speak: "Read replies aloud", restart: "Start again", source: "Understood by" },
  hi: { placeholder: "अपना जवाब लिखें", send: "भेजें", listen: "बोलें", stop: "रोकें", speak: "जवाब सुनें", restart: "फिर से शुरू करें", source: "समझा गया:" },
  hinglish: { placeholder: "Apna jawab likhein", send: "Bhejein", listen: "Bolein", stop: "Rokein", speak: "Jawab sunein", restart: "Phir se shuru karein", source: "Samjha gaya:" },
};

type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };

export function AdvisorApp() {
  const [lang, setLang] = useState<Lang>("en");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [state, setState] = useState<AdvisorState | undefined>();
  const [quick, setQuick] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string>("offline");
  const [result, setResult] = useState<AdvisorTurnResult | undefined>();
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const speak = useCallback(
    (texts: string[]) => {
      if (!speakOn || typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texts.join(" "));
      u.lang = SPEECH_LANG[lang];
      window.speechSynthesis.speak(u);
    },
    [speakOn, lang],
  );

  const turn = useCallback(
    async (message: string, opts: { state?: AdvisorState; lang?: Lang } = {}) => {
      setBusy(true);
      try {
        const res = await fetch("/api/advisor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, state: opts.state, lang: opts.lang }),
        });
        if (!res.ok) throw new Error(`Advisor returned ${res.status}`);
        const r = (await res.json()) as AdvisorTurnResult;
        setState(r.state);
        setQuick(r.quickReplies);
        setProvider(r.provider);
        setBubbles((b) => [...b, ...r.reply.map((text) => ({ from: "advisor" as const, text }))]);
        if (r.bundle) setResult(r);
        speak(r.reply);
      } catch {
        setBubbles((b) => [...b, { from: "advisor", text: "The advisor didn't respond. Check your connection and send your answer again." }]);
      } finally {
        setBusy(false);
      }
    },
    [speak],
  );

  const start = useCallback(
    (l: Lang) => {
      setBubbles([]);
      setResult(undefined);
      setState(undefined);
      void turn("", { lang: l });
    },
    [turn],
  );

  const started = useRef(false);
  useEffect(() => {
    // Guard against React Strict Mode running mount effects twice in development.
    if (started.current) return;
    started.current = true;
    start("en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, which React would treat as a cleanup.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, busy]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy || state?.done) return;
    setBubbles((b) => [...b, { from: "owner", text: t }]);
    setInput("");
    setQuick([]);
    void turn(t, { state });
  };

  const toggleListen = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setBubbles((b) => [...b, { from: "advisor", text: "Voice input needs Chrome or Edge. You can type your answer instead." }]);
      return;
    }
    const rec = new Ctor();
    rec.lang = SPEECH_LANG[lang];
    rec.interimResults = false;
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const ui = UI[lang];

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row lg:gap-10 lg:px-8 lg:py-8">
      <section className="flex min-h-dvh flex-1 flex-col bg-white lg:min-h-0 lg:max-w-xl lg:rounded-2xl lg:border lg:border-rule" aria-label="Advisor chat">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
          <div>
            <p className="text-lg font-bold leading-tight">Accel Business</p>
            <p className="text-sm text-ink-soft">Advisor for shops, clinics, offices and factories</p>
          </div>
          <div role="radiogroup" aria-label="Language" className="flex rounded-full border border-rule p-0.5 text-sm">
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={lang === l}
                onClick={() => {
                  setLang(l);
                  start(l);
                }}
                className={`rounded-full px-3 py-1 ${lang === l ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </header>

        <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-5" aria-live="polite">
          {bubbles.map((b, i) => (
            <li key={i} className={`flex ${b.from === "owner" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[17px] leading-relaxed ${
                  b.from === "owner" ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm bg-page text-ink"
                }`}
              >
                {b.text}
              </p>
            </li>
          ))}
          {busy && (
            <li className="text-sm text-ink-soft" aria-label="Advisor is typing">
              …
            </li>
          )}
          <div ref={endRef} />
        </ol>

        {quick.length > 0 && !busy && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {quick.map((q) => (
              <button key={q} onClick={() => send(q)} className="rounded-full border border-ink/25 px-3.5 py-1.5 text-[15px] hover:border-ink hover:bg-page">
                {q}
              </button>
            ))}
          </div>
        )}

        <footer className="border-t border-rule px-4 py-3">
          {state?.done ? (
            <button onClick={() => start(lang)} className="w-full rounded-xl border border-ink py-3 font-medium">
              {ui.restart}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <label className="sr-only" htmlFor="answer">
                {ui.placeholder}
              </label>
              <input
                id="answer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={ui.placeholder}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-rule px-4 py-3 text-[17px] outline-none focus:border-ink"
              />
              <button type="button" onClick={toggleListen} aria-pressed={listening} className={`rounded-xl border px-3 ${listening ? "border-khata text-khata" : "border-rule text-ink"}`}>
                {listening ? ui.stop : ui.listen}
              </button>
              <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-ink px-4 font-medium text-white disabled:opacity-40">
                {ui.send}
              </button>
            </form>
          )}
          <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={speakOn} onChange={(e) => setSpeakOn(e.target.checked)} />
              {ui.speak}
            </label>
            <span>
              {ui.source} {PROVIDER_LABEL[provider] ?? provider}
            </span>
          </div>
        </footer>
      </section>

      <QuoteLedger result={result} lang={lang} />
    </div>
  );
}
