"use client";

import { ArrowRight, ClipboardCheck, ShieldCheck, Store, Users } from "lucide-react";
import Link from "next/link";
import { BrandMark, LanguageSwitch } from "@/components/AppShell";
import { useLang } from "@/components/LangContext";
import type { Lang } from "@/domain/advisor/state";

const T: Record<Lang, { title: string; sub: string; owner: string; ownerSub: string; ownerCta: string; staff: string }> = {
  en: { title: "Welcome to Accel Business", sub: "Choose how you want to continue.", owner: "I run a business", ownerSub: "Get internet, phones and digital tools for your shop or office. No account needed.", ownerCta: "Start as a customer", staff: "Accel team and partners" },
  hi: { title: "Accel Business में आपका स्वागत है", sub: "चुनें कि आप कैसे आगे बढ़ना चाहते हैं।", owner: "मेरा बिज़नेस है", ownerSub: "अपनी दुकान या ऑफिस के लिए इंटरनेट, फ़ोन और डिजिटल टूल लें। कोई अकाउंट नहीं चाहिए।", ownerCta: "ग्राहक के रूप में शुरू करें", staff: "Accel टीम और पार्टनर" },
  hinglish: { title: "Accel Business mein swagat hai", sub: "Chunein ki aap kaise aage badhna chahte hain.", owner: "Mera business hai", ownerSub: "Apni dukaan ya office ke liye internet, phone aur digital tools lein. Koi account nahi chahiye.", ownerCta: "Customer ke roop mein shuru karein", staff: "Accel team aur partners" },
};

/** First page of the shared link: customer, partner or operations. Customers never need to sign in. */
export function RoleChooser() {
  const { lang } = useLang();
  const t = T[lang];
  const staff = [
    { href: "/login?role=partner", icon: Users, title: "Channel partner", sub: "Your city's lost leads, ranked by likelihood to buy.", demo: "Demo PIN 1234" },
    { href: "/login?role=admin", icon: ShieldCheck, title: "Accel operations", sub: "Verification queue, orders to fulfil, the 5 metrics, audit log.", demo: "Demo ID ADMIN · PIN 9999" },
    { href: "/judge", icon: ClipboardCheck, title: "Judges: rule tester", sub: "Any business in, bundle and refusals out. Run all 15 checks.", demo: "No sign-in" },
  ];
  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 border-b border-rule bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
          <BrandMark />
          <LanguageSwitch />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-8">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{t.title}</h1>
        <p className="mt-2 text-lg text-ink-soft">{t.sub}</p>

        <Link href="/business" className="group mt-6 block rounded-3xl bg-brand p-6 text-white shadow-card transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
            <Store className="h-8 w-8" aria-hidden />
          </span>
          <span className="mt-4 block text-2xl font-bold">{t.owner}</span>
          <span className="mt-1 block text-white/90">{t.ownerSub}</span>
          <span className="mt-5 inline-flex h-14 items-center gap-2 rounded-full bg-white px-6 text-lg font-semibold text-brand">
            {t.ownerCta} <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-ink-soft">{t.staff}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {staff.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-card hover:ring-2 hover:ring-brand/30">
                <s.icon className="h-7 w-7 text-brand" aria-hidden />
                <span className="mt-3 text-lg font-bold">{s.title}</span>
                <span className="mt-1 flex-1 text-sm text-ink-soft">{s.sub}</span>
                <span className="mt-3 rounded-full bg-page px-3 py-1 text-xs font-semibold self-start">{s.demo}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-xs text-ink-soft">Accel Telecom is the fictional operator from the hackathon case. All businesses, people and identifiers are synthetic.</p>
      </main>
    </div>
  );
}
