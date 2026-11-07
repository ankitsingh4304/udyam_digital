"use client";

import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { CITIES } from "@/domain/advisor/lexicon";
import { SCENARIOS, evaluateScenario } from "@/domain/catalogue/scenarios";
import { NEEDS, SEGMENTS, type Bundle, type BusinessProfileInput, type Need } from "@/domain/catalogue/types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const SEGMENT_LABEL: Record<(typeof SEGMENTS)[number], string> = { micro: "Micro retail & services", prof: "Professional office", multi: "Multi-site business", mfg: "Small manufacturer" };
const NEED_LABEL: Record<Need, string> = {
  pos: "POS / UPI billing", cctv: "CCTV", whatsapp: "WhatsApp API", sms: "Bulk SMS", email: "Business email", backup: "Cloud backup", security: "Endpoint security",
  failover: "Backup internet", static_ip: "Static IP", website: "Website", telephony: "Cloud telephony", tollfree: "Toll-free number", wifi: "Guest Wi-Fi",
  iot: "Machine IoT", fleet: "Fleet tracking", sdwan: "SD-WAN", firewall: "Managed firewall", leased_line: "Leased line",
};

async function recommend(profile: BusinessProfileInput): Promise<Bundle> {
  const res = await fetch("/api/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
  if (!res.ok) throw new Error((await res.json()).error ?? `Error ${res.status}`);
  return res.json();
}

function BundleView({ b }: { b: Bundle }) {
  return (
    <div className="space-y-4">
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-khata">{inr(b.monthlyTotal)}</span>
        <span className="text-ink-soft">
          a month · {b.setupTotal ? `${inr(b.setupTotal)} setup` : "no setup fee"} · {b.contractMonths}-month contract · live in ~{b.maxInstallDays} days
        </span>
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-ink-soft">
          <tr>
            <th className="py-1 font-medium">Product</th>
            <th className="py-1 text-right font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Monthly</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {b.lines.map((l) => (
            <tr key={l.productId}>
              <td className="py-1.5">
                <span className="text-ink-soft">{l.productId}</span> {l.name}
              </td>
              <td className="py-1.5 text-right">{l.quantity}</td>
              <td className="py-1.5 text-right">{inr(l.monthly)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {b.blocked.length > 0 && (
        <div>
          <p className="font-bold">Refused by the rules</p>
          <ul className="mt-1 space-y-1 text-sm">
            {b.blocked.map((x) => (
              <li key={x.productId} className="border-l-2 border-hold pl-3">
                <span className="font-medium">
                  {x.productId} {x.name}
                </span>{" "}
                <span className="text-ink-soft">
                  [{x.failures.map((f) => f.code).join(", ")}] {x.failures.map((f) => f.message).join(" ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-soft">Rule trace ({b.trace.length} steps)</summary>
        <ol className="mt-1 list-decimal pl-6 font-[ui-monospace,monospace] text-xs leading-relaxed">
          {b.trace.map((t, i) => (
            <li key={i}>
              {t.step}: {t.detail}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export function JudgeApp() {
  const [profile, setProfile] = useState<BusinessProfileInput>({ segment: "prof", employees: 4, sites: 1, cityTier: 1, gstinStatus: "active", needs: [], fibreAvailable: true, mobileOnly: false, requestedProducts: [] });
  const [city, setCity] = useState("Mumbai");
  const [bundle, setBundle] = useState<Bundle>();
  const [error, setError] = useState<string>();
  const [runs, setRuns] = useState<{ id: number; pass: boolean; problems: string[]; b: Bundle }[]>([]);
  const [running, setRunning] = useState(false);

  const set = (patch: Partial<BusinessProfileInput>) => setProfile((p) => ({ ...p, ...patch }));
  const needs = (profile.needs ?? []) as Need[];

  const run = async (p = profile) => {
    setError(undefined);
    try {
      setBundle(await recommend(p));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runAll = async () => {
    setRunning(true);
    const out = [];
    for (const s of SCENARIOS) {
      const b = await recommend(s.profile);
      out.push({ id: s.id, ...evaluateScenario(s, b), b });
      setRuns([...out]);
    }
    setRunning(false);
  };

  const field = "mt-1 w-full rounded-lg border border-rule bg-white px-3 py-2";

  return (
    <AppShell wide back={{ href: "/", label: "Home" }}>
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <h1 className="mt-2 text-3xl font-bold">Test the advisor&apos;s rules</h1>
      <p className="mt-1 max-w-prose text-ink-soft">
        Describe any business and see exactly what the advisor would offer, what it refuses and why. The AI only writes the explanation; these choices come from the catalogue rules.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <form
          className="space-y-3 rounded-2xl bg-white shadow-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <label className="block text-sm">
            Business type
            <select className={field} value={profile.segment} onChange={(e) => set({ segment: e.target.value as BusinessProfileInput["segment"] })}>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Staff
              <input type="number" min={1} className={field} value={profile.employees} onChange={(e) => set({ employees: Math.max(1, Number(e.target.value)) })} />
            </label>
            <label className="block text-sm">
              Sites
              <input type="number" min={1} className={field} value={profile.sites} onChange={(e) => set({ sites: Math.max(1, Number(e.target.value)) })} />
            </label>
          </div>
          <label className="block text-sm">
            City
            <select
              className={field}
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                set({ cityTier: CITIES.find((c) => c.name === e.target.value)?.tier ?? 2 });
              }}
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} (tier {c.tier})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            GSTIN in the registry
            <select className={field} value={profile.gstinStatus} onChange={(e) => set({ gstinStatus: e.target.value as BusinessProfileInput["gstinStatus"] })}>
              <option value="active">Active</option>
              <option value="inactive">Cancelled or suspended</option>
              <option value="none">No GSTIN</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Speed asked for
              <select className={field} value={profile.wantsSpeed ?? ""} onChange={(e) => set({ wantsSpeed: (e.target.value || undefined) as BusinessProfileInput["wantsSpeed"] })}>
                <option value="">Not stated</option>
                <option value="100">100 Mbps</option>
                <option value="300">300 Mbps</option>
                <option value="1g">1 Gbps</option>
              </select>
            </label>
            <label className="block text-sm">
              Vehicles
              <input type="number" min={0} className={field} value={profile.fleetSize ?? 0} onChange={(e) => set({ fleetSize: Number(e.target.value) || undefined })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={profile.fibreAvailable !== false} onChange={(e) => set({ fibreAvailable: e.target.checked })} /> Fibre available at the site
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!profile.mobileOnly} onChange={(e) => set({ mobileOnly: e.target.checked })} /> Only wants mobile lines
          </label>
          <fieldset>
            <legend className="text-sm">Needs</legend>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {NEEDS.map((n) => (
                <label key={n} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={needs.includes(n)} onChange={(e) => set({ needs: e.target.checked ? [...needs, n] : needs.filter((x) => x !== n) })} />
                  {NEED_LABEL[n]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            Products asked for by code (e.g. P03, P10)
            <input
              className={field}
              value={(profile.requestedProducts ?? []).join(", ")}
              onChange={(e) => set({ requestedProducts: e.target.value.toUpperCase().match(/P\d{2}/g) ?? [] })}
            />
          </label>
          <button className="h-14 w-full rounded-full bg-brand text-lg font-semibold text-white hover:bg-brand-dark">Recommend</button>
        </form>

        <section className="rounded-2xl bg-white shadow-card p-5" aria-live="polite">
          {error && <p className="text-khata">{error}</p>}
          {bundle ? <BundleView b={bundle} /> : <p className="text-ink-soft">Set up a business on the left and press Recommend.</p>}
        </section>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Rule checks we run on every build</h2>
          <button onClick={runAll} disabled={running} className="h-12 rounded-full border-2 border-brand px-6 font-semibold text-brand disabled:opacity-50">
            {running ? `Running ${runs.length}/${SCENARIOS.length}…` : `Run all ${SCENARIOS.length}`}
          </button>
        </div>
        <ol className="mt-4 divide-y divide-rule rounded-2xl bg-white shadow-card">
          {SCENARIOS.map((s) => {
            const r = runs.find((x) => x.id === s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className={`w-6 font-bold ${r ? (r.pass ? "text-ok" : "text-khata") : "text-ink-soft"}`} aria-label={r ? (r.pass ? "Passed" : "Failed") : "Not run"}>
                  {r ? (r.pass ? "✓" : "✕") : "·"}
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    {s.id}. {s.title}
                  </p>
                  {r && (
                    <p className="text-sm text-ink-soft">
                      Offered {r.b.lines.map((l) => l.productId).join(", ") || "nothing"}
                      {r.b.blocked.length > 0 && ` · refused ${r.b.blocked.map((b) => `${b.productId} (${b.failures.map((f) => f.code).join("/")})`).join(", ")}`}
                      {!r.pass && ` · ${r.problems.join("; ")}`}
                    </p>
                  )}
                </div>
                <button
                  className="text-sm underline underline-offset-4"
                  onClick={() => {
                    setProfile({ needs: [], requestedProducts: [], fibreAvailable: true, mobileOnly: false, ...s.profile });
                    void run(s.profile);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Open
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
    </AppShell>
  );
}
