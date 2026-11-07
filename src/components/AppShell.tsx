"use client";

import { ArrowLeft, FileCheck2, IndianRupee, MessageCircle, Wrench } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@/domain/advisor/state";
import { useLang } from "./LangContext";

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "hinglish", label: "Hinglish" },
];

const STEPS: Record<Lang, string[]> = {
  en: ["Your business", "Your price", "Documents", "Installation"],
  hi: ["आपका बिज़नेस", "आपकी कीमत", "डॉक्यूमेंट", "इंस्टॉलेशन"],
  hinglish: ["Aapka business", "Aapki price", "Documents", "Installation"],
};
const STEP_ICONS = [MessageCircle, IndianRupee, FileCheck2, Wrench];
const STEP_HREF = ["/advisor", "/advisor#quote", "/kyc", undefined];

/** Brand mark: original red tile with a white signal arc (not any real operator's logo). */
export function BrandMark({ small = false, href = "/" }: { small?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Accel Business home">
      <span className={`grid place-items-center rounded-xl bg-brand text-white ${small ? "h-8 w-8" : "h-10 w-10"}`} aria-hidden>
        <svg viewBox="0 0 24 24" className={small ? "h-5 w-5" : "h-6 w-6"} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M5 16a9 9 0 0 1 14 0" />
          <path d="M8.5 18.5a5 5 0 0 1 7 0" />
          <circle cx="12" cy="20.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="leading-none">
        <span className={`block font-bold ${small ? "text-base" : "text-lg"}`}>Accel</span>
        <span className="block text-xs font-medium text-brand">Business</span>
      </span>
    </Link>
  );
}

export function LanguageSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div role="radiogroup" aria-label="Language / भाषा" className="flex rounded-full bg-page p-1">
      {LANGS.map((l) => (
        <button
          key={l.id}
          role="radio"
          aria-checked={lang === l.id}
          onClick={() => setLang(l.id)}
          className={`h-10 rounded-full px-2.5 text-sm font-semibold ${lang === l.id ? "bg-white text-brand shadow-card" : "text-ink-soft"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** Journey progress: big numbered steps with icons, so it's clear where you are and what's next. */
export function Stepper({ step, wide = false }: { step: 1 | 2 | 3 | 4; wide?: boolean }) {
  const { lang } = useLang();
  return (
    <nav aria-label="Progress" className="border-b border-rule bg-white">
      <ol className={`mx-auto flex items-center gap-1 overflow-x-auto px-3 py-2.5 ${wide ? "max-w-6xl sm:gap-2 sm:px-6" : "max-w-lg"}`}>
        {STEPS[lang].map((label, i) => {
          const n = i + 1;
          const Icon = STEP_ICONS[i];
          const state = n < step ? "done" : n === step ? "now" : "next";
          const inner = (
            <span className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-semibold ${state === "now" ? "bg-brand text-white" : state === "done" ? "bg-ok-soft text-ok" : "text-ink-soft"}`}>
              <Icon className="h-4 w-4" aria-hidden />
              <span className={state === "now" ? "" : wide ? "hidden md:inline" : "hidden"}>
                {n}. {label}
              </span>
              {state !== "now" && <span className={wide ? "md:hidden" : ""}>{n}</span>}
            </span>
          );
          return (
            <li key={label} className="flex items-center gap-1 sm:gap-2" aria-current={state === "now" ? "step" : undefined}>
              {i > 0 && <span className={`h-0.5 ${wide ? "w-3 sm:w-6" : "w-2"} ${n <= step ? "bg-ok" : "bg-rule"}`} aria-hidden />}
              {state === "done" && STEP_HREF[i] ? <Link href={STEP_HREF[i]!}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Phone-first: content is one app-width column on every screen; `wide` is for back-office pages. */
export function AppShell({ step, back, wide = false, children }: { step?: 1 | 2 | 3 | 4; back?: { href: string; label: string }; wide?: boolean; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-2 px-3 py-2 ${wide ? "max-w-6xl sm:px-6" : "max-w-lg"}`}>
          <div className="flex items-center gap-2">
            {back && (
              <Link href={back.href} className="grid h-11 w-11 place-items-center rounded-full hover:bg-page" aria-label={back.label}>
                <ArrowLeft className="h-6 w-6" />
              </Link>
            )}
            <BrandMark small={!!back} href="/business" />
          </div>
          <LanguageSwitch />
        </div>
        {step && <Stepper step={step} wide={wide} />}
      </header>
      {children}
    </div>
  );
}
