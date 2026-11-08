"use client";

import { fromPacks } from "@/i18n/packs";
import { BadgeIndianRupee, FileCheck2, Headphones, Mic, ReceiptText, Truck, Wrench, MessageCircle, IndianRupee } from "lucide-react";
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
    voice: "You can speak in Hindi or English",
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
    voice: "आप हिंदी या अंग्रेज़ी में बोल सकते हैं",
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
    voice: "Aap Hindi ya English mein bol sakte hain",
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

const FINDINGS = [
  { figure: "7.4%", text: "of 5,000 leads became customers last quarter, at ₹15,053 acquisition cost each." },
  { figure: "48", text: "of 368 activated customers were sold a bundle the catalogue doesn't allow. This advisor can't do that." },
  { figure: "6% → 28%", text: "six-month churn as status-chasing calls rise from 1 to 5. The tracker removes those calls." },
];

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
          <ul className="mt-4 grid gap-3">
            {t.perks.map(([title, body], i) => {
              const Icon = PERK_ICONS[i];
              return (
                <li key={title} className="rounded-2xl bg-white p-5 shadow-card">
                  <Icon className="h-8 w-8 text-brand" aria-hidden />
                  <p className="mt-3 text-lg font-bold">{title}</p>
                  <p className="mt-1 text-ink-soft">{body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-14 grid gap-6 border-t border-rule pt-10">
          <div>
            <h2 className="text-xl font-bold">What last quarter&apos;s leads told us</h2>
            <dl className="mt-4 space-y-4">
              {FINDINGS.map((f) => (
                <div key={f.figure} className="grid grid-cols-[7rem_1fr] items-baseline gap-4">
                  <dt className="text-2xl font-bold text-brand">{f.figure}</dt>
                  <dd className="text-ink-soft">{f.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <aside className="rounded-2xl bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Truck className="h-5 w-5 text-brand" aria-hidden /> For judges and partners
            </h2>
            <ul className="mt-3 space-y-3 text-[15px]">
              <li>
                <Link className="font-semibold text-brand underline underline-offset-4" href="/judge">
                  Rule tester
                </Link>
                <span className="block text-sm text-ink-soft">Any business in, bundle and refusals out; 15 one-click checks.</span>
              </li>
              <li>
                <Link className="font-semibold text-brand underline underline-offset-4" href="/kyc">
                  Document check
                </Link>
                <span className="block text-sm text-ink-soft">Load sample applicants K01–K12 in one tap.</span>
              </li>
              <li>
                <Link className="font-semibold text-brand underline underline-offset-4" href="/login?role=partner">
                  Partner panel
                </Link>
                <span className="block text-sm text-ink-soft">Lost leads in the partner&apos;s city, ranked by likelihood to buy. Demo PIN 1234.</span>
              </li>
              <li>
                <Link className="font-semibold text-brand underline underline-offset-4" href="/login?role=admin">
                  Operations dashboard
                </Link>
                <span className="block text-sm text-ink-soft">The 5 metrics vs targets, live activity, audit log. ID ADMIN, PIN 9999.</span>
              </li>
              <li>
                <a className="font-semibold text-brand underline underline-offset-4" href="/api/health">
                  System health
                </a>
              </li>
            </ul>
          </aside>
        </section>
        <p className="mt-12 text-xs text-ink-soft">Accel Telecom is the fictional operator from the YTL Hackathon 2026 case. All businesses, people and identifiers are synthetic.</p>
      </main>
    </AppShell>
  );
}
