"use client";

import { fromPacks } from "@/i18n/packs";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AddonOption } from "@/domain/catalogue/addons";
import type { Bundle, BusinessProfileInput } from "@/domain/catalogue/types";
import { ProfileCard } from "./ProfileCard";
import type { Lang } from "@/domain/advisor/state";
import type { AdvisorTurnResult } from "@/server/advisor-service";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const T: Record<Lang, Record<string, string>> = {
  en: {
    title: "Your bundle", empty: "Answer a few questions and your bundle, with one monthly price, appears here.",
    month: "a month", setup: "One-time setup", contract: "Contract", months: "months", live: "Ready to use in about", days: "days after documents",
    why: "Why this fits", blocked: "Not offered, and why", addons: "Add or remove", unavailable: "Not available for your business",
    next: "Next: upload documents  →", qty: "Quantity", none: "No setup fee", remove: "Remove", add: "Add",
  },
  hi: {
    title: "आपका बंडल", empty: "कुछ सवालों के जवाब दें, आपका बंडल और एक मासिक कीमत यहाँ दिखेगी।",
    month: "हर महीने", setup: "एक बार का सेटअप", contract: "कॉन्ट्रैक्ट", months: "महीने", live: "डॉक्यूमेंट के बाद लगभग", days: "दिन में चालू",
    why: "यह क्यों सही है", blocked: "ये नहीं मिल सकते, और क्यों", addons: "जोड़ें या हटाएँ", unavailable: "आपके बिज़नेस के लिए उपलब्ध नहीं",
    next: "आगे: डॉक्यूमेंट अपलोड करें  →", qty: "संख्या", none: "कोई सेटअप फ़ीस नहीं", remove: "हटाएँ", add: "जोड़ें",
  },
  hinglish: {
    title: "Aapka bundle", empty: "Kuch sawaalon ke jawab dein, aapka bundle aur ek monthly price yahan dikhega.",
    month: "har mahine", setup: "One-time setup", contract: "Contract", months: "mahine", live: "Documents ke baad lagbhag", days: "din mein chalu",
    why: "Yeh kyun sahi hai", blocked: "Yeh nahi mil sakte, aur kyun", addons: "Jodein ya hatayein", unavailable: "Aapke business ke liye available nahi",
    next: "Aage: documents upload karein  →", qty: "Quantity", none: "Koi setup fee nahi", remove: "Hatayein", add: "Jodein",
  },
  ...fromPacks("quote"),
};

export function QuoteLedger({ result, lang, onTotal }: { result?: AdvisorTurnResult; lang: Lang; onTotal?: (monthly: number) => void }) {
  const t = T[lang];
  const [bundle, setBundle] = useState<Bundle | undefined>();
  const [addons, setAddons] = useState<AddonOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<BusinessProfileInput | undefined>();
  const [blocked, setBlocked] = useState<Bundle["blocked"]>([]);
  const [edited, setEdited] = useState(false);

  const reprice = async (b: Bundle, change?: { productId: string; quantity: number }, p: BusinessProfileInput | undefined = profile, keepBlocked = blocked) => {
    if (!p) return;
    setBusy(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: p, cart: b.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), change }),
      });
      if (res.ok) {
        const data = (await res.json()) as { bundle: Bundle; addons: AddonOption[] };
        // Keep the advisor's plain-language reasons and blocked list from the recommendation.
        setBundle({ ...data.bundle, blocked: keepBlocked });
        onTotal?.(data.bundle.monthlyTotal);
        setAddons(data.addons);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setBundle(result?.bundle);
    setAddons([]);
    setProfile(result?.profile);
    setBlocked(result?.bundle?.blocked ?? []);
    setEdited(false);
    if (result?.bundle) void reprice(result.bundle, undefined, result.profile, result.bundle.blocked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  /** Owner corrected what the advisor understood: rebuild the bundle with the rule engine. */
  const applyProfile = async (p: BusinessProfileInput) => {
    setBusy(true);
    try {
      const res = await fetch("/api/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
      if (!res.ok) return;
      const fresh = (await res.json()) as Bundle;
      setProfile(p);
      setBlocked(fresh.blocked);
      setEdited(true);
      await reprice(fresh, undefined, p, fresh.blocked);
    } finally {
      setBusy(false);
    }
  };

  const defaultQty = (a: AddonOption) => {
    const p = profile;
    if (!p) return 1;
    if (a.unit === "per site" || a.unit === "per counter") return p.sites ?? 1;
    if (a.unit === "per camera") return 2 * (p.sites ?? 1);
    if (a.unit === "per user" || a.unit === "per device") return p.employees ?? 1;
    if (a.unit === "per line") return Math.min(p.employees ?? 1, 5);
    return 1;
  };

  if (!bundle) return null;

  const available = addons.filter((a) => a.available || a.inCart);
  const unavailable = addons.filter((a) => !a.available && !a.inCart);

  return (
    <aside className="scroll-mt-28 px-4 py-6" id="quote" aria-label={t.title} aria-busy={busy}>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="bg-brand px-5 pb-5 pt-5 text-white">
          <h2 className="text-xl font-bold">{t.title}</h2>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="price-tick text-5xl font-bold tracking-tight">{inr(bundle.monthlyTotal)}</span>
            <span className="text-white/85">{t.month}</span>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-white/90">
            <dt className="text-white/75">{t.setup}</dt>
            <dd className="text-right">{bundle.setupTotal ? inr(bundle.setupTotal) : t.none}</dd>
            <dt className="text-white/75">{t.contract}</dt>
            <dd className="text-right">
              {bundle.contractMonths} {t.months}
            </dd>
            <dt className="text-white/75">{t.live}</dt>
            <dd className="text-right">
              {bundle.maxInstallDays} {t.days}
            </dd>
          </dl>
        </div>

        <ul className="ledger px-5">
          {bundle.lines.map((l) => (
            <li key={l.productId} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium leading-snug">{l.name}</p>
                <p className="text-sm leading-snug text-ink-soft">{l.why}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium">{inr(l.monthly)}</p>
                <div className="mt-1 flex items-center justify-end gap-1 text-sm" aria-label={`${t.qty} ${l.name}`}>
                  <button className="grid h-10 w-10 place-items-center rounded-full border-2 border-rule text-lg font-bold hover:border-brand" aria-label={`− ${l.name}`} onClick={() => reprice(bundle, { productId: l.productId, quantity: l.quantity - 1 })} disabled={busy}>
                    −
                  </button>
                  <span className="w-7 text-center text-lg font-semibold">{l.quantity}</span>
                  <button className="grid h-10 w-10 place-items-center rounded-full border-2 border-rule text-lg font-bold hover:border-brand" aria-label={`+ ${l.name}`} onClick={() => reprice(bundle, { productId: l.productId, quantity: l.quantity + 1 })} disabled={busy}>
                    +
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="px-5 py-4">
          <Link
            id="quote-cta"
            href="/kyc"
            onClick={() => {
              try {
                sessionStorage.setItem("udyam.quote", JSON.stringify({ profile, gstin: result?.state.draft.gstin, cart: bundle.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) }));
              } catch {
                /* private mode: the order step falls back to a starter bundle */
              }
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-lg font-semibold text-white hover:bg-brand-dark"
          >
            {t.next}
          </Link>
        </div>
      </div>

      {profile && <ProfileCard profile={profile} city={result?.state.draft.city} lang={lang} busy={busy} onApply={applyProfile} />}

      {result?.explanation && !edited && (
        <section className="mt-6">
          <h3 className="font-bold">{t.why}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
            {result.explanation.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      {bundle.blocked.length > 0 && (
        <section className="mt-6">
          <h3 className="font-bold">{t.blocked}</h3>
          <ul className="mt-2 space-y-2 text-[15px]">
            {bundle.blocked.map((b) => (
              <li key={b.productId} className="border-l-2 border-hold pl-3">
                <span className="font-medium">{b.name}</span>
                <span className="block text-ink-soft">
                  {b.failures.map((f) => f.message).join(" ")}
                  {b.alternative ? ` → ${b.alternative}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {available.length > 0 && (
        <section className="mt-6">
          <h3 className="font-bold">{t.addons}</h3>
          <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-2xl bg-white shadow-card">
            {available.map((a) => (
              <li key={a.productId} className="flex min-h-16 items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[15px] leading-snug">{a.name}</p>
                  <p className="text-xs text-ink-soft">
                    {inr(a.unitPrice)} {a.unit}
                    {a.setupFee ? ` + ${inr(a.setupFee)} setup` : ""}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={a.inCart}
                  aria-label={`${a.inCart ? t.remove : t.add} ${a.name}`}
                  disabled={busy}
                  onClick={() => reprice(bundle, { productId: a.productId, quantity: a.inCart ? 0 : defaultQty(a) })}
                  className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${a.inCart ? "bg-ok" : "bg-rule"}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${a.inCart ? "left-7" : "left-1"}`} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unavailable.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-soft">
            {t.unavailable} ({unavailable.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {unavailable.map((a) => (
              <li key={a.productId}>
                <span className="font-medium">{a.name}</span>: <span className="text-ink-soft">{a.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}
