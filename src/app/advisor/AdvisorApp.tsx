"use client";

import { fromPacks } from "@/i18n/packs";
import {
  Briefcase,
  CheckCircle2,
  CreditCard,
  Factory,
  Mail,
  MessageCircle,
  Mic,
  RadioTower,
  RotateCcw,
  SendHorizontal,
  Square,
  Stethoscope,
  Store,
  UtensilsCrossed,
  Video,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/components/LangContext";
import type { AdvisorState, Lang } from "@/domain/advisor/state";
import type { AdvisorTurnResult } from "@/server/advisor-service";
import { QuoteLedger } from "./QuoteLedger";
import { speakTexts, stopSpeaking, useVoiceInput } from "./voice";

interface Bubble {
  from: "advisor" | "owner";
  text: string;
}

const PROVIDER_LABEL: Record<string, string> = { gemini: "Gemini", groq: "Groq", offline: "built-in rules" };
const BUSINESS_ICONS: LucideIcon[] = [Store, Stethoscope, Briefcase, UtensilsCrossed, Factory];
const NEED_ICONS: LucideIcon[] = [CreditCard, Video, MessageCircle, Mail, RadioTower];

const UI: Record<Lang, Record<string, string>> = {
  en: { showChat: "Show the whole chat", placeholder: "Type here, or tap the mic", send: "Send", listen: "Tap and speak", listening: "Listening… tap to stop", readAloud: "Read replies aloud", restart: "Start again", source: "Understood by", pickMany: "Tap all that you need, then continue", next: "Continue", none: "Nothing else", seeBundle: "See my bundle", perMonth: "/month", thinking: "Thinking…", noVoice: "Voice input isn't available in this browser. Please type, or use Chrome.", failed: "The advisor didn't answer. Check your internet and send again.", micBlocked: "Microphone is blocked. Tap the lock icon in the address bar and allow the microphone.", noSpeech: "I didn't hear anything. Tap the mic and speak a little louder.", sttFailed: "Couldn't understand the recording. Please try again or type.", transcribing: "Writing down what you said…", ttsNoVoice: "This phone has no Hindi voice installed. Add Hindi in your phone's text-to-speech settings, or switch to Hinglish.", ttsUnsupported: "Read aloud isn't supported in this browser.", replay: "Listen" },
  hi: { showChat: "पूरी चैट देखें", placeholder: "यहाँ लिखें, या माइक दबाएँ", send: "भेजें", listen: "दबाएँ और बोलें", listening: "सुन रहे हैं… रोकने के लिए दबाएँ", readAloud: "जवाब सुनाएँ", restart: "फिर से शुरू करें", source: "समझा गया:", pickMany: "जो चाहिए सब चुनें, फिर आगे बढ़ें", next: "आगे बढ़ें", none: "और कुछ नहीं", seeBundle: "मेरा बंडल देखें", perMonth: "/महीना", thinking: "सोच रहे हैं…", noVoice: "इस ब्राउज़र में आवाज़ नहीं चलती। कृपया लिखें या Chrome इस्तेमाल करें।", failed: "जवाब नहीं आया। इंटरनेट जाँचें और फिर भेजें।", micBlocked: "माइक बंद है। एड्रेस बार में ताले के निशान को दबाकर माइक की अनुमति दें।", noSpeech: "कुछ सुनाई नहीं दिया। माइक दबाकर थोड़ा ज़ोर से बोलें।", sttFailed: "रिकॉर्डिंग समझ नहीं आई। फिर कोशिश करें या लिखें।", transcribing: "आपकी बात लिख रहे हैं…", ttsNoVoice: "इस फ़ोन में हिंदी आवाज़ नहीं है। फ़ोन की टेक्स्ट-टू-स्पीच सेटिंग में हिंदी जोड़ें, या Hinglish चुनें।", ttsUnsupported: "इस ब्राउज़र में सुनने की सुविधा नहीं है।", replay: "सुनें" },
  hinglish: { showChat: "Poori chat dekhein", placeholder: "Yahan likhein, ya mic dabayein", send: "Bhejein", listen: "Dabayein aur bolein", listening: "Sun rahe hain… rokne ke liye dabayein", readAloud: "Jawab sunayein", restart: "Phir se shuru karein", source: "Samjha gaya:", pickMany: "Jo chahiye sab chunein, phir aage badhein", next: "Aage badhein", none: "Aur kuch nahi", seeBundle: "Mera bundle dekhein", perMonth: "/month", thinking: "Soch rahe hain…", noVoice: "Is browser mein voice nahi chalti. Please likhein ya Chrome use karein.", failed: "Jawab nahi aaya. Internet check karke phir bhejein.", micBlocked: "Mic blocked hai. Address bar mein lock icon dabakar mic allow karein.", noSpeech: "Kuch sunai nahi diya. Mic dabakar thoda zor se bolein.", sttFailed: "Recording samajh nahi aayi. Phir try karein ya likhein.", transcribing: "Aapki baat likh rahe hain…", ttsNoVoice: "Is phone mein Hindi voice nahi hai. Phone ki text-to-speech setting mein Hindi add karein.", ttsUnsupported: "Is browser mein sunne ki suvidha nahi hai.", replay: "Sunein" },
  ...fromPacks("advisorUi"),
};


export function AdvisorApp() {
  const { lang, ready } = useLang();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [state, setState] = useState<AdvisorState | undefined>();
  const [quick, setQuick] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string>("offline");
  const [result, setResult] = useState<AdvisorTurnResult | undefined>();
  const [notice, setNotice] = useState<string>();
  const [speakOn, setSpeakOn] = useState(false);
  const [total, setTotal] = useState<number>();
  const [ctaVisible, setCtaVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Hide the phone price bar while the bundle's own "Next" button is on screen.
  useEffect(() => {
    if (!result) return;
    const el = document.getElementById("quote-cta");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [result, total]);
  const endRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const ui = UI[lang];

  const lastSpoken = useRef<string[]>([]);
  const speak = useCallback(
    async (texts: string[], force = false) => {
      if (!force && !speakOn) return;
      lastSpoken.current = texts;
      const r = await speakTexts(texts, lang);
      if (r === "noVoice") setNotice(UI[lang].ttsNoVoice);
      if (r === "unsupported") setNotice(UI[lang].ttsUnsupported);
    },
    [speakOn, lang],
  );

  const turn = useCallback(
    async (message: string, opts: { state?: AdvisorState; lang?: Lang } = {}) => {
      const gen = generation.current;
      setBusy(true);
      try {
        const res = await fetch("/api/advisor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, state: opts.state, lang: opts.lang }),
        });
        if (!res.ok) throw new Error(`Advisor returned ${res.status}`);
        const r = (await res.json()) as AdvisorTurnResult;
        if (gen !== generation.current) return; // a restart (e.g. language change) happened meanwhile
        setState(r.state);
        setQuick(r.quickReplies);
        setPicked([]);
        setProvider(r.provider);
        setBubbles((b) => [...b, ...r.reply.map((text) => ({ from: "advisor" as const, text }))]);
        if (r.bundle) setResult(r);
        void speak(r.reply);
      } catch {
        setBubbles((b) => [...b, { from: "advisor", text: UI[opts.lang ?? lang].failed }]);
      } finally {
        setBusy(false);
      }
    },
    [speak, lang],
  );

  const start = useCallback(
    (l: Lang) => {
      generation.current += 1;
      setBubbles([]);
      setShowAll(false);
      setResult(undefined);
      setState(undefined);
      void turn("", { lang: l });
    },
    [turn],
  );

  // Start (and restart when the language changes). Guarded against React Strict Mode double effects.
  const startedFor = useRef<Lang | null>(null);
  useEffect(() => {
    if (!ready || startedFor.current === lang) return;
    startedFor.current = lang;
    start(lang);
  }, [lang, ready, start]);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, which React would treat as a cleanup.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, busy]);

  const sendRef = useRef<(t: string) => void>(() => {});
  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy || state?.done) return;
    setBubbles((b) => [...b, { from: "owner", text: t }]);
    setInput("");
    setQuick([]);
    void turn(t, { state });
  };
  sendRef.current = send;

  const voice = useVoiceInput({
    lang,
    onInterim: (t) => setInput(t),
    onText: (t) => {
      setInput("");
      setNotice(undefined);
      sendRef.current(t);
    },
    onError: (code) => setNotice(UI[lang][code] ?? UI[lang].sttFailed),
  });
  const listening = voice.state === "listening";
  const transcribing = voice.state === "transcribing";
  const toggleListen = () => {
    stopSpeaking();
    setNotice(undefined);
    voice.toggle();
  };

  const slot = state?.lastAsked;
  const done = !!state?.done;

  return (
    <AppShell step={result ? 2 : 1}>
      <div className="mx-auto flex max-w-lg flex-col pb-28">
        <section className={`flex flex-col bg-white ${done ? "" : "min-h-[calc(100dvh-7.5rem)]"}`} aria-label="Advisor chat">
          <ol className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5" aria-live="polite">
            {done && !showAll && bubbles.length > 3 && (
              <li className="flex justify-center">
                <button onClick={() => setShowAll(true)} className="rounded-full bg-page px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
                  {ui.showChat} ({bubbles.length - 2})
                </button>
              </li>
            )}
            {(done && !showAll ? bubbles.slice(-2) : bubbles).map((b, i, list) => {
              const lastAdvisor = b.from === "advisor" && !list.slice(i + 1).some((x) => x.from === "advisor");
              const startsGroup = i === 0 || list[i - 1].from !== b.from;
              return (
                <li key={`${i}-${b.text.slice(0, 12)}`} className={`flex items-end gap-2 ${b.from === "owner" ? "justify-end" : "justify-start"} ${startsGroup ? "pt-2" : ""}`}>
                  {b.from === "advisor" && (
                    <span className={`mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white ${startsGroup ? "" : "invisible"}`} aria-hidden>
                      <MessageCircle className="h-4 w-4" />
                    </span>
                  )}
                  <p className={`max-w-[80%] whitespace-pre-line rounded-[1.4rem] px-4 py-3 text-[17px] leading-relaxed ${b.from === "owner" ? "rounded-br-md bg-brand-soft font-medium text-ink" : "rounded-bl-md bg-page text-ink"}`}>{b.text}</p>
                  {lastAdvisor && (
                    <button onClick={() => void speak([b.text], true)} aria-label={`${ui.replay}: ${b.text.slice(0, 40)}`} title={ui.replay} className="mb-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-page hover:text-brand">
                      <Volume2 className="h-5 w-5" />
                    </button>
                  )}
                </li>
              );
            })}
            {busy && (
              <li className="flex items-center gap-2 pl-10 text-ink-soft" aria-label={ui.thinking}>
                <span className="inline-flex gap-1" aria-hidden>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-soft [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-soft" />
                </span>
              </li>
            )}
            <div ref={endRef} />
          </ol>

          {/* Answer buttons: big, with pictures, so nobody has to type */}
          {quick.length > 0 && !busy && !done && (
            <div className="border-t border-rule px-4 pb-1 pt-3">
              {slot === "businessType" ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {quick.map((q, i) => {
                    const Icon = BUSINESS_ICONS[i] ?? Store;
                    return (
                      <button key={q} onClick={() => send(q)} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-rule bg-white p-3 text-center font-semibold hover:border-brand hover:bg-brand-soft">
                        <Icon className="h-8 w-8 text-brand" aria-hidden />
                        <span className="leading-tight">{q}</span>
                      </button>
                    );
                  })}
                </div>
              ) : slot === "needs" ? (
                <div>
                  <p className="mb-2 text-sm text-ink-soft">{ui.pickMany}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {quick.slice(0, -1).map((q, i) => {
                      const Icon = NEED_ICONS[i] ?? CheckCircle2;
                      const on = picked.includes(q);
                      return (
                        <button
                          key={q}
                          aria-pressed={on}
                          onClick={() => setPicked(on ? picked.filter((x) => x !== q) : [...picked, q])}
                          className={`flex min-h-14 items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left font-semibold ${on ? "border-brand bg-brand-soft text-brand" : "border-rule bg-white"}`}
                        >
                          <Icon className="h-6 w-6 shrink-0" aria-hidden />
                          <span className="leading-tight">{q}</span>
                          {on && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => send(picked.length ? picked.join(", ") : quick.at(-1)!)} className="mt-3 h-14 w-full rounded-full bg-brand text-lg font-semibold text-white hover:bg-brand-dark">
                    {picked.length ? `${ui.next} (${picked.length})` : ui.none}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {quick.map((q) => (
                    <button key={q} onClick={() => send(q)} className="h-12 rounded-full border-2 border-rule bg-white px-5 font-semibold hover:border-brand hover:bg-brand-soft">
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <footer className="sticky bottom-0 border-t border-rule bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            {(notice || transcribing) && (
              <p role="status" className={`mb-2 rounded-2xl px-4 py-2 text-sm font-semibold ${transcribing ? "bg-page text-ink-soft" : "bg-hold-soft text-hold"}`}>
                {transcribing ? ui.transcribing : notice}
              </p>
            )}
            {done ? (
              <button onClick={() => start(lang)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-rule font-semibold">
                <RotateCcw className="h-5 w-5" aria-hidden />
                {ui.restart}
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={toggleListen}
                  aria-pressed={listening}
                  disabled={transcribing || busy}
                  aria-label={listening ? ui.listening : ui.listen}
                  title={listening ? ui.listening : ui.listen}
                  className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-white ${listening ? "pulse-ring bg-brand-dark" : "bg-brand hover:bg-brand-dark"}`}
                >
                  {listening ? <Square className="h-6 w-6" fill="currentColor" /> : <Mic className="h-7 w-7" />}
                </button>
                <label className="sr-only" htmlFor="answer">
                  {ui.placeholder}
                </label>
                <input
                  id="answer"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={listening ? ui.listening : ui.placeholder}
                  autoComplete="off"
                  className="h-14 min-w-0 flex-1 rounded-full border-2 border-rule bg-page px-5 text-[17px] outline-none focus:border-brand focus:bg-white"
                />
                <button type="submit" disabled={busy || !input.trim()} aria-label={ui.send} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-30">
                  <SendHorizontal className="h-6 w-6" />
                </button>
              </form>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
              <button
                onClick={() => {
                  const on = !speakOn;
                  setSpeakOn(on);
                  if (on) {
                    const last = bubbles.filter((x) => x.from === "advisor").slice(-2).map((x) => x.text);
                    void speak(last, true);
                  } else stopSpeaking();
                }}
                aria-pressed={speakOn} className={`flex h-9 items-center gap-1.5 rounded-full px-3 font-semibold ${speakOn ? "bg-brand-soft text-brand" : "bg-page"}`}>
                {speakOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {ui.readAloud}
              </button>
              <span>
                {ui.source} {PROVIDER_LABEL[provider] ?? provider}
              </span>
            </div>
          </footer>
        </section>

        <QuoteLedger result={result} lang={lang} onTotal={setTotal} />
      </div>

      {/* Phone: once there is a price, keep it and the next step in reach */}
      {result?.bundle && !ctaVisible && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,.06)]">
          <div className="mx-auto max-w-lg">
          <a href="#quote" className="flex h-14 w-full items-center justify-between rounded-full bg-brand px-6 text-white">
            <span className="text-lg font-bold">
              ₹{(total ?? result.bundle.monthlyTotal).toLocaleString("en-IN")}
              <span className="text-sm font-medium opacity-90">{ui.perMonth}</span>
            </span>
            <span className="font-semibold">{ui.seeBundle} ↓</span>
          </a>
          </div>
        </div>
      )}
    </AppShell>
  );
}
