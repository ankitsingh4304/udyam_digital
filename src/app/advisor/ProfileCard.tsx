"use client";

import { fromPacks } from "@/i18n/packs";
import { useEffect, useState } from "react";
import { CITIES } from "@/domain/advisor/lexicon";
import type { Lang } from "@/domain/advisor/state";
import { NEEDS, SEGMENTS, type BusinessProfileInput, type Need } from "@/domain/catalogue/types";

const T: Record<Lang, Record<string, string>> = {
  en: { title: "What I understood", change: "Change", apply: "Update my bundle", cancel: "Cancel", type: "Business type", staff: "Staff", sites: "Sites", city: "City tier", gstin: "GSTIN", fibre: "Fibre available at the site", needs: "Needs", active: "Active", inactive: "Cancelled / suspended", none: "None", t1: "Tier 1 city", t2: "Tier 2 city" },
  hi: { title: "मैंने क्या समझा", change: "बदलें", apply: "बंडल अपडेट करें", cancel: "रद्द करें", type: "बिज़नेस का प्रकार", staff: "स्टाफ", sites: "जगहें", city: "शहर", gstin: "GSTIN", fibre: "साइट पर फ़ाइबर उपलब्ध", needs: "ज़रूरतें", active: "एक्टिव", inactive: "रद्द / निलंबित", none: "नहीं", t1: "टियर 1 शहर", t2: "टियर 2 शहर" },
  hinglish: { title: "Maine kya samjha", change: "Badlein", apply: "Bundle update karein", cancel: "Cancel", type: "Business type", staff: "Staff", sites: "Jagah", city: "City", gstin: "GSTIN", fibre: "Site par fibre available", needs: "Zaroorat", active: "Active", inactive: "Cancelled / suspended", none: "Nahi", t1: "Tier 1 city", t2: "Tier 2 city" },
  ...fromPacks("profile"),
};
const SEG: Record<(typeof SEGMENTS)[number], string> = { micro: "Shop / small service", prof: "Professional office", multi: "Multi-site", mfg: "Manufacturer" };

/**
 * Read-back of the profile the advisor extracted. The owner can correct any field; the bundle is
 * rebuilt by the rule engine, so a misheard answer never silently changes the price.
 */
export function ProfileCard({ profile, city, lang, busy, onApply }: { profile: BusinessProfileInput; city?: string; lang: Lang; busy: boolean; onApply: (p: BusinessProfileInput) => void }) {
  const t = T[lang];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  const needs = (draft.needs ?? []) as Need[];
  const set = (patch: Partial<BusinessProfileInput>) => setDraft((d) => ({ ...d, ...patch }));
  const field = "mt-1 w-full rounded-lg border border-rule bg-white px-2 py-1.5 text-sm";

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-card" aria-label={t.title}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{t.title}</h3>
        {!editing && (
          <button className="text-sm underline underline-offset-4" onClick={() => setEditing(true)}>
            {t.change}
          </button>
        )}
      </div>
      {!editing ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-soft">{t.type}</dt>
          <dd>
            {profile.businessType ? `${profile.businessType} · ` : ""}
            {SEG[profile.segment]}
          </dd>
          <dt className="text-ink-soft">{t.staff}</dt>
          <dd>
            {profile.employees} · {t.sites} {profile.sites}
          </dd>
          <dt className="text-ink-soft">{t.city}</dt>
          <dd>
            {city ? `${city} · ` : ""}
            {profile.cityTier === 1 ? t.t1 : t.t2}
          </dd>
          <dt className="text-ink-soft">{t.gstin}</dt>
          <dd>{t[profile.gstinStatus]}</dd>
          {(profile.needs?.length ?? 0) > 0 && (
            <>
              <dt className="text-ink-soft">{t.needs}</dt>
              <dd>{profile.needs!.join(", ")}</dd>
            </>
          )}
        </dl>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            onApply(draft);
          }}
        >
          <label className="block text-sm">
            {t.type}
            <select className={field} value={draft.segment} onChange={(e) => set({ segment: e.target.value as BusinessProfileInput["segment"] })}>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {SEG[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              {t.staff}
              <input type="number" min={1} className={field} value={draft.employees} onChange={(e) => set({ employees: Math.max(1, Number(e.target.value)) })} />
            </label>
            <label className="block text-sm">
              {t.sites}
              <input type="number" min={1} className={field} value={draft.sites} onChange={(e) => set({ sites: Math.max(1, Number(e.target.value)) })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              {t.city}
              <select className={field} value={draft.cityTier} onChange={(e) => set({ cityTier: Number(e.target.value) as 1 | 2 })}>
                <option value={1}>{t.t1}</option>
                <option value={2}>{t.t2}</option>
              </select>
            </label>
            <label className="block text-sm">
              {t.gstin}
              <select className={field} value={draft.gstinStatus} onChange={(e) => set({ gstinStatus: e.target.value as BusinessProfileInput["gstinStatus"] })}>
                <option value="active">{t.active}</option>
                <option value="inactive">{t.inactive}</option>
                <option value="none">{t.none}</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-soft">Tier 1: {CITIES.filter((c) => c.tier === 1).map((c) => c.name).join(", ")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.fibreAvailable !== false} onChange={(e) => set({ fibreAvailable: e.target.checked })} /> {t.fibre}
          </label>
          <fieldset>
            <legend className="text-sm">{t.needs}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {NEEDS.map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={needs.includes(n)}
                  onClick={() => set({ needs: needs.includes(n) ? needs.filter((x) => x !== n) : [...needs, n] })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${needs.includes(n) ? "border-brand bg-brand text-white" : "border-rule"}`}
                >
                  {n.replace("_", " ")}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2 pt-1">
            <button className="h-12 flex-1 rounded-full bg-brand font-semibold text-white disabled:opacity-50" disabled={busy}>
              {t.apply}
            </button>
            <button
              type="button"
              className="h-12 rounded-full border-2 border-rule px-4 font-semibold"
              onClick={() => {
                setDraft(profile);
                setEditing(false);
              }}
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
