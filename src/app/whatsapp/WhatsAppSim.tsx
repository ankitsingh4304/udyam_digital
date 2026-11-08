"use client";

import { ArrowLeft, CheckCheck, Loader2, Mic, Phone, SendHorizontal, Square } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useVoiceInput } from "@/app/advisor/voice";
import type { Lang } from "@/domain/advisor/state";

interface Msg {
  from: "me" | "bot";
  text: string;
  ts: string;
}
interface Info {
  twilio: { number: string; join: string; link: string } | null;
}

/** *bold*, _italic_ and links, as WhatsApp shows them. */
function rich(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(https?:\/\/\S+|\*[^*]+\*|_[^_]+_)/g).map((part, j) =>
        /^https?:\/\//.test(part) ? (
          <a key={j} href={part} className="break-all text-[#027eb5] underline">
            {part.length > 48 ? `${part.slice(0, 45)}…` : part}
          </a>
        ) : /^\*[^*]+\*$/.test(part) ? (
          <strong key={j}>{part.slice(1, -1)}</strong>
        ) : /^_[^_]+_$/.test(part) ? (
          <em key={j} className="text-[#667781]">
            {part.slice(1, -1)}
          </em>
        ) : (
          part
        ),
      )}
    </Fragment>
  ));
}

const time = (ts: string) => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/**
 * WhatsApp-style simulator of the Accel Business chat. Runs the exact same bot as the real
 * WhatsApp number, so judges can try it without a phone or a sandbox join code.
 */
export function WhatsAppSim() {
  const [session, setSession] = useState<string>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<Lang>("hi");
  const [info, setInfo] = useState<Info>();
  const [notice, setNotice] = useState<string>();
  const seen = useRef(new Set<string>());
  const primed = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id: string | null = null;
    try {
      id = localStorage.getItem("udyam.wa.sim");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("udyam.wa.sim", id);
      }
    } catch {
      id = crypto.randomUUID();
    }
    setSession(id);
    fetch("/api/whatsapp/info").then((r) => r.json()).then(setInfo).catch(() => undefined);
  }, []);

  const send = useCallback(
    async (text: string, silent = false) => {
      const t = text.trim();
      if (!t || !session) return;
      if (!silent) setMsgs((m) => [...m, { from: "me", text: t, ts: new Date().toISOString() }]);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/whatsapp/sim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session, text: t }) });
        const data = await res.json();
        const now = new Date().toISOString();
        setMsgs((m) => [...m, ...(data.replies ?? [data.error ?? "…"]).map((r: string) => ({ from: "bot" as const, text: r, ts: now }))]);
      } catch {
        setMsgs((m) => [...m, { from: "bot", text: "Network error. Try again.", ts: new Date().toISOString() }]);
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  // Start the chat like a customer would: "Hi".
  const started = useRef(false);
  useEffect(() => {
    if (!session || started.current) return;
    started.current = true;
    void send("Hi");
  }, [session, send]);

  // Pushed messages (order placed / dispatched / delayed) arrive here, like real WhatsApp notifications.
  useEffect(() => {
    if (!session) return;
    const pull = async () => {
      try {
        const d = await fetch(`/api/whatsapp/sim?session=${session}`, { cache: "no-store" }).then((r) => r.json());
        if (d.lang) setLang(d.lang);
        const fresh = (d.outbox as { ts: string; text: string }[]).filter((o) => !seen.current.has(o.ts + o.text));
        fresh.forEach((o) => seen.current.add(o.ts + o.text));
        // The first pull only learns what was already there; later pulls show new pushes.
        if (fresh.length && primed.current) setMsgs((m) => [...m, ...fresh.map((o) => ({ from: "bot" as const, text: o.text, ts: o.ts }))]);
        primed.current = true;
      } catch {
        /* offline */
      }
    };
    void pull();
    const id = setInterval(pull, 5000);
    return () => clearInterval(id);
  }, [session]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const voice = useVoiceInput({ lang, onText: (t) => void send(t), onError: (m) => setNotice(m) });
  const listening = voice.state === "listening";

  return (
    <div className="flex h-dvh flex-col bg-[#efeae2]">
      <header className="flex items-center gap-3 bg-[#008069] px-3 pb-2.5 pt-[calc(0.6rem+env(safe-area-inset-top))] text-white">
        <Link href="/" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold text-[#E40000]" aria-hidden>
          A
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">Accel Business</p>
          <p className="truncate text-xs text-white/80">{busy ? "typing…" : "Business account · WhatsApp preview"}</p>
        </div>
        <Phone className="h-5 w-5 opacity-80" aria-hidden />
      </header>

      {info?.twilio && (
        <a href={info.twilio.link} className="block bg-[#d9fdd3] px-4 py-2 text-center text-sm text-[#111b21]">
          Try it on your own WhatsApp: send <strong>{info.twilio.join}</strong> to <strong>{info.twilio.number}</strong> →
        </a>
      )}

      <main className="flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
        <p className="mx-auto mb-3 w-fit rounded-lg bg-[#fff3c4] px-3 py-1.5 text-center text-xs text-[#54656f]">
          🔒 Same bot as the real WhatsApp number. Messages are not stored after you send STOP.
        </p>
        <ul className="space-y-1.5">
          {msgs.map((m, i) => (
            <li key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-2.5 pb-1 pt-1.5 text-[15px] leading-snug text-[#111b21] shadow-sm ${m.from === "me" ? "bg-[#d9fdd3]" : "bg-white"}`}>
                <div className="whitespace-pre-wrap break-words">{rich(m.text)}</div>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                  {time(m.ts)}
                  {m.from === "me" && <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-hidden />}
                </div>
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex justify-start">
              <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-[#667781]" aria-label="typing" />
              </div>
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </main>

      {notice && (
        <p role="status" className="bg-white px-4 py-2 text-sm text-[#b26a00]" onClick={() => setNotice(undefined)}>
          {notice}
        </p>
      )}
      <form
        className="flex items-end gap-2 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message"
          aria-label="Message"
          className="h-12 min-w-0 flex-1 rounded-full bg-white px-4 text-[16px] text-[#111b21] shadow-sm focus:outline-none"
        />
        {input.trim() ? (
          <button type="submit" disabled={busy} aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#008069] text-white disabled:opacity-60">
            <SendHorizontal className="h-5 w-5" />
          </button>
        ) : (
          <button type="button" onClick={voice.toggle} aria-label={listening ? "Stop recording" : "Send a voice note"} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white ${listening ? "bg-[#E40000]" : "bg-[#008069]"}`}>
            {listening ? <Square className="h-5 w-5" /> : voice.state === "transcribing" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
      </form>
    </div>
  );
}
