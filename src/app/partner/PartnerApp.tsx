"use client";

import { BackOfficeShell, type BackOfficeUser } from "@/components/BackOfficeShell";
import { useCallback, useEffect, useState } from "react";
import { WhatsAppHandoffs } from "./WhatsAppHandoffs";
import type { RescueLead, rescueSummary } from "@/server/leads-service";

type Summary = ReturnType<typeof rescueSummary>;
type Lead = RescueLead & { claim: { mine: boolean; by: string; at: string } | null };
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const BAND_CLS: Record<string, string> = { High: "bg-ok text-white", Medium: "bg-hold/15 text-hold", Low: "bg-rule text-ink-soft" };
const CHANNEL: Record<string, string> = { digital: "Fix by link, no visit", call: "Needs a call", visit: "Needs a visit", later: "Follow up later" };

export function PartnerApp({ user }: { user: BackOfficeUser }) {
  const [filters, setFilters] = useState({ city: "", band: "", channel: "", segment: "" });
  const [data, setData] = useState<{ summary: Summary; cities: string[]; leads: Lead[] }>();
  const [busy, setBusy] = useState<string>();
  const [claimError, setClaimError] = useState<string>();
  const [copied, setCopied] = useState<string>();

  const load = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    qs.set("limit", "30");
    const res = await fetch(`/api/partner/leads?${qs}`);
    if (res.ok) setData(await res.json());
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  // Taking a lead is saved on the server, so another partner or field agent sees it is taken.
  const take = async (id: string) => {
    setBusy(id);
    setClaimError(undefined);
    const res = await fetch(`/api/partner/leads/${id}/claim`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(undefined);
    if (!res.ok) setClaimError(body.error ?? "Couldn't take this lead.");
    await load();
  };

  const message = (l: Lead) =>
    `Namaste ${l.contact.split(",")[0]}! Accel Business here. You can now see your exact monthly price and finish sign-up on your phone in 5 minutes, no visit needed: ${typeof window !== "undefined" ? window.location.origin : ""}/advisor`;

  const select = "rounded-lg border border-rule bg-white px-3 py-2 text-sm";
  const s = data?.summary;

  return (
    <BackOfficeShell user={user} title={user.role === "admin" ? "Operations" : "Partner portal"}>
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <h1 className="mt-2 text-3xl font-bold">{user.city ? `Rescue queue · ${user.city}` : "Rescue queue · all cities"}</h1>
      <p className="mt-1 max-w-prose text-ink-soft">
        Leads that dropped out but can still be won, ranked by likely monthly value. You keep the commission whether the customer finishes online or with your help.
      </p>

      {s && (
        <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-rule shadow-card sm:grid-cols-4">
          <div className="bg-white p-4">
            <dt className="text-sm text-ink-soft">Recoverable leads</dt>
            <dd className="text-2xl font-bold">{s.total.toLocaleString("en-IN")}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-sm text-ink-soft">Fixable by a link, no visit</dt>
            <dd className="text-2xl font-bold">{s.digitalFixable.toLocaleString("en-IN")}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-sm text-ink-soft">High likelihood to buy</dt>
            <dd className="text-2xl font-bold">{s.high.toLocaleString("en-IN")}</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-sm text-ink-soft">Expected monthly revenue</dt>
            <dd className="text-2xl font-bold text-khata">{inr(s.expectedMonthly)}</dd>
          </div>
        </dl>
      )}
      {s && (
        <p className="mt-2 text-xs text-ink-soft">
          Likelihood model trained on last quarter&apos;s 5,000 leads: the top 30% of scored leads held {Math.round(s.model.top30Capture * 100)}% of all activations (AUC {s.model.auc}).
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3" role="group" aria-label="Filters">
        {user.role === "admin" && (
        <select className={select} aria-label="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })}>
          <option value="">All cities</option>
          {data?.cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        )}
        <select className={select} aria-label="Likelihood" value={filters.band} onChange={(e) => setFilters({ ...filters, band: e.target.value })}>
          <option value="">Any likelihood</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <select className={select} aria-label="How to fix" value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
          <option value="">Any fix</option>
          {Object.entries(CHANNEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className={select} aria-label="Segment" value={filters.segment} onChange={(e) => setFilters({ ...filters, segment: e.target.value })}>
          <option value="">All segments</option>
          <option>Micro retail & services</option>
          <option>Professional offices</option>
          <option>Small multi-site businesses</option>
          <option>Small manufacturers</option>
        </select>
      </div>

      <WhatsAppHandoffs canTake={user.role === "partner"} />

      {claimError && <p className="mt-4 rounded-2xl bg-brand-soft p-3 text-sm text-brand">{claimError}</p>}
      <ol className="mt-4 space-y-3">
        {data?.leads.map((l) => (
          <li key={l.id} className={`rounded-2xl bg-white shadow-card p-5 ${l.claim && !l.claim.mine ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{l.business}</p>
                <p className="text-sm text-ink-soft">
                  {l.businessType}, {l.city} · {l.contact} · prefers {l.language}
                </p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${BAND_CLS[l.band]}`}>{l.band} · {Math.round(l.probability * 100)}%</span>
                <p className="mt-1 text-sm text-ink-soft">≈ {inr(l.expectedMonthly)}/month expected</p>
              </div>
            </div>
            <p className="mt-3">
              <span className="text-ink-soft">Dropped at {l.stage.toLowerCase()}:</span> {l.dropReason}
            </p>
            <p className="mt-1 font-medium">
              {l.action} <span className="text-sm font-normal text-ink-soft">({CHANNEL[l.channel]})</span>
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Why this score:{" "}
              {l.reasons.map((r, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span className={r.effect === "up" ? "text-ok" : "text-khata"}>{r.effect === "up" ? "▲" : "▼"}</span> {r.label}
                </span>
              ))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {l.channel === "digital" && (
                <button
                  className="h-11 rounded-full border-2 border-brand px-5 font-semibold text-brand"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(message(l));
                      setCopied(l.id);
                    } catch {
                      setCopied(undefined);
                    }
                  }}
                >
                  {copied === l.id ? "Message copied" : "Copy WhatsApp message"}
                </button>
              )}
              {user.role === "partner" ? (
                <button className="h-11 rounded-full bg-brand px-5 font-semibold text-white disabled:opacity-50" disabled={!!l.claim || busy === l.id} onClick={() => take(l.id)}>
                  {l.claim ? (l.claim.mine ? "Taken by you" : `Taken by ${l.claim.by}`) : "Take this lead"}
                </button>
              ) : (
                l.claim && <span className="flex h-11 items-center rounded-full bg-page px-4 text-sm font-semibold">Taken by {l.claim.by}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </main>
    </BackOfficeShell>
  );
}
