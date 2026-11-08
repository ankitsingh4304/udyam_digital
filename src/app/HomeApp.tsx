"use client";

import { fromPacks } from "@/i18n/packs";
import { BadgeIndianRupee, FileCheck2, Headphones, Mic, ReceiptText, Wrench, MessageCircle, IndianRupee } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/components/LangContext";
import { ButtonLink } from "@/components/ui";
import type { Lang } from "@/domain/advisor/state";

const T: Record<Lang, { title: string; sub: string; start: string; voice: string; how: string; steps: [string, string][]; why: string; perks: [string, string][] }> = {
  en: {
    title: "Internet, phones and digital tools for your business",
    sub: "Answer a few easy questions. See one clear monthly price. Upload documents from your phone. No sales visit needed.",
    start: "Start now",
    voice: "You can speak in your own language",
    how: "How it works",
    steps: [
      ["Tell us about your shop or office", "Tap the answers or just speak"],
      ["See your price", "One monthly bill, nothing hidden"],
      ["Upload documents", "Take photos with your phone"],
      ["Get installed", "Track every step here, no calls needed"],
    ],
    why: "Why business owners choose this",
    perks: [
      ["One bill for everything", "Internet, SIMs, billing machine, CCTV"],
      ["Price shown before you sign", "If something isn't allowed, we tell you why"],
      ["Help when you need it", "A local partner can visit if you ask"],
    ],
  },
  hi: {
    title: "आपके बिज़नेस के लिए इंटरनेट, फ़ोन और डिजिटल टूल",
    sub: "कुछ आसान सवालों के जवाब दें। एक साफ़ मासिक कीमत देखें। फ़ोन से डॉक्यूमेंट अपलोड करें। किसी विज़िट की ज़रूरत नहीं।",
    start: "अभी शुरू करें",
    voice: "आप अपनी भाषा में बोल सकते हैं",
    how: "यह कैसे काम करता है",
    steps: [
      ["अपनी दुकान या ऑफिस के बारे में बताएँ", "जवाब दबाएँ या बस बोलें"],
      ["अपनी कीमत देखें", "एक मासिक बिल, कुछ छिपा नहीं"],
      ["डॉक्यूमेंट अपलोड करें", "फ़ोन से फ़ोटो लें"],
      ["इंस्टॉलेशन", "हर कदम यहीं देखें, कॉल की ज़रूरत नहीं"],
    ],
    why: "बिज़नेस मालिक इसे क्यों चुनते हैं",
    perks: [
      ["सबके लिए एक बिल", "इंटरनेट, सिम, बिलिंग मशीन, CCTV"],
      ["साइन करने से पहले कीमत", "कुछ नहीं मिल सकता तो कारण बताते हैं"],
      ["ज़रूरत पर मदद", "आप चाहें तो लोकल पार्टनर आएँगे"],
    ],
  },
  hinglish: {
    title: "Aapke business ke liye internet, phone aur digital tools",
    sub: "Kuch aasaan sawaalon ke jawab dein. Ek clear monthly price dekhein. Phone se documents upload karein. Koi visit nahi chahiye.",
    start: "Abhi shuru karein",
    voice: "Aap apni bhasha mein bol sakte hain",
    how: "Yeh kaise kaam karta hai",
    steps: [
      ["Apni dukaan ya office ke baare mein batayein", "Jawab dabayein ya bas bolein"],
      ["Apni price dekhein", "Ek monthly bill, kuch chhupa nahi"],
      ["Documents upload karein", "Phone se photo lein"],
      ["Installation", "Har step yahin dekhein, call ki zaroorat nahi"],
    ],
    why: "Business owners ise kyun chunte hain",
    perks: [
      ["Sab ke liye ek bill", "Internet, SIM, billing machine, CCTV"],
      ["Sign se pehle price", "Kuch nahi mil sakta to reason batate hain"],
      ["Zaroorat par madad", "Aap chahein to local partner aayenge"],
    ],
  },
  ...fromPacks("home"),
};

const STEP_ICONS = [MessageCircle, IndianRupee, FileCheck2, Wrench];
const PERK_ICONS = [ReceiptText, BadgeIndianRupee, Headphones];

export function HomeApp() {
  const { lang } = useLang();
  const t = T[lang];
  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 pb-16 pt-4">
        <section className="overflow-hidden rounded-3xl bg-brand px-6 py-9 text-white">
          <h1 className="text-[2rem] font-bold leading-tight">{t.title}</h1>
          <p className="mt-3 text-lg text-white/90">{t.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/advisor" className="inline-flex h-16 w-full items-center justify-center rounded-full bg-white px-10 text-xl font-bold text-brand active:bg-brand-soft">
              {t.start} →
            </Link>
            <span className="flex items-center gap-2 text-white/90">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
                <Mic className="h-5 w-5" aria-hidden />
              </span>
              {t.voice}
            </span>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">{t.how}</h2>
          <ol className="mt-4 grid gap-3">
            {t.steps.map(([title, body], i) => {
              const Icon = STEP_ICONS[i];
              return (
                <li key={title} className="flex gap-4 rounded-2xl bg-white p-5 shadow-card">
                  <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <Icon className="h-7 w-7" aria-hidden />
                    <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-snug">{title}</p>
                    <p className="mt-1 text-ink-soft">{body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-6">
            <ButtonLink href="/advisor" className="w-full">{t.start} →</ButtonLink>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">{t.why}</h2>
          <ul className="mt-4 divide-y divide-rule overflow-hidden rounded-2xl bg-white shadow-card">
            {t.perks.map(([title, body], i) => {
              const Icon = PERK_ICONS[i];
              return (
                <li key={title} className="flex items-start gap-4 px-5 py-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-lg font-bold leading-snug">{title}</span>
                    <span className="block text-ink-soft">{body}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-10 text-center text-[15px] text-ink-soft">
          <Link href="/" className="font-semibold text-ink underline underline-offset-4">
            Partner or Accel team? Sign in from the start page
          </Link>
        </p>
        <p className="mt-12 text-xs text-ink-soft">Accel Telecom is the fictional operator from the YTL Hackathon 2026 case. All businesses, people and identifiers are synthetic.</p>
      </main>
    </AppShell>
  );
}
