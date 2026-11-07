"use client";

import { Activity, ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck, Target, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BackOfficeShell, type BackOfficeUser } from "@/components/BackOfficeShell";
import type { adminMetrics } from "@/server/admin-metrics";
import { OpsQueues } from "./OpsQueues";

type Data = Awaited<ReturnType<typeof adminMetrics>>;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const VERDICT_CLS: Record<string, string> = {
  PASS: "bg-ok-soft text-ok",
  PASS_WITH_WARNINGS: "bg-ok-soft text-ok",
  NEEDS_REUPLOAD: "bg-hold-soft text-hold",
  MANUAL_REVIEW: "bg-hold-soft text-hold",
  REJECT: "bg-brand-soft text-brand",
};
const VERDICT_LABEL: Record<string, string> = { PASS: "Pass", PASS_WITH_WARNINGS: "Pass (note)", NEEDS_REUPLOAD: "Re-upload", MANUAL_REVIEW: "Agent review", REJECT: "Reject" };
const EVENT_LABEL: Record<string, string> = { CONSENT_GIVEN: "Consent given", CONSENT_WITHDRAWN: "Consent withdrawn", KYC_PROCESSED: "Documents checked", DOCS_DISCARDED: "Images discarded", ORDER_PLACED: "Order placed", ESIGN_COMPLETED: "Form e-signed", REVIEW_DECIDED: "Agent decided", ORDER_UPDATED: "Order updated", LEAD_CLAIMED: "Partner took lead" };

export function AdminApp({ user }: { user: BackOfficeUser }) {
  const [d, setD] = useState<Data>();
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/metrics", { cache: "no-store" });
    if (res.ok) setD(await res.json());
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const card = "rounded-2xl bg-white p-5 shadow-card";
  return (
    <BackOfficeShell user={user} title="Operations">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-bold">Operations dashboard</h1>
        <p className="mt-1 text-ink-soft">Today&apos;s work queues, then the baseline from last quarter&apos;s 5,000 leads, the targets we commit to, and what the live system is doing.</p>
        <OpsQueues />

        {!d ? (
          <p className="mt-8 text-ink-soft">Loading…</p>
        ) : (
          <>
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Target className="h-5 w-5 text-brand" aria-hidden /> The five metrics that matter
              </h2>
              <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-card">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="text-sm text-ink-soft">
                    <tr className="border-b border-rule">
                      <th className="px-4 py-3 font-semibold">Metric</th>
                      <th className="px-4 py-3 font-semibold">Last quarter</th>
                      <th className="px-4 py-3 font-semibold">12-month target</th>
                      <th className="px-4 py-3 font-semibold">How the product moves it</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {d.metrics.map((m) => (
                      <tr key={m.key}>
                        <td className="px-4 py-3 font-semibold">{m.name}</td>
                        <td className="px-4 py-3 text-ink-soft">{m.baseline}</td>
                        <td className="px-4 py-3 font-bold text-brand">{m.target}</td>
                        <td className="px-4 py-3 text-sm">{m.lever}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-2">
              {d.guardrails.map((g) => (
                <div key={g.name} className={card}>
                  <p className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="h-5 w-5 text-brand" aria-hidden /> {g.name}
                  </p>
                  <p className="mt-3 flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-ink-soft line-through decoration-2">{g.before}</span>
                    <ArrowRight className="h-5 w-5 text-ink-soft" aria-hidden />
                    <span className="text-4xl font-bold text-ok">{g.now}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">Last quarter → with this system. {g.note}.</p>
                </div>
              ))}
            </section>

            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Activity className="h-5 w-5 text-brand" aria-hidden /> Live activity
              </h2>
              <dl className="mt-3 grid gap-px overflow-hidden rounded-2xl bg-rule shadow-card sm:grid-cols-5">
                {[
                  ["Consents", d.live.consents],
                  ["Document checks", d.live.kycChecks],
                  ["E-signed forms", d.live.esigns],
                  ["Orders placed", d.live.orders],
                  ["New monthly revenue", inr(d.live.monthlyRevenue)],
                  ["Consent → order (median)", d.live.medianMinutesConsentToOrder == null ? "—" : `${d.live.medianMinutesConsentToOrder.toFixed(1)} min`],
                ].map(([k, v]) => (
                  <div key={String(k)} className="bg-white p-4">
                    <dt className="text-sm text-ink-soft">{k}</dt>
                    <dd className="text-2xl font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {Object.entries(d.live.verdicts).map(([v, n]) => (
                  <span key={v} className={`rounded-full px-3 py-1 font-semibold ${VERDICT_CLS[v] ?? "bg-page"}`}>
                    {VERDICT_LABEL[v] ?? v}: {n}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
                <div className={card}>
                  <p className="font-semibold">Audit log (latest events, no personal data)</p>
                  <ol className="mt-2 divide-y divide-rule text-sm">
                    {d.live.recent.length === 0 && <li className="py-2 text-ink-soft">No activity yet. Run a document check to see events appear.</li>}
                    {d.live.recent.map((e) => (
                      <li key={e.seq} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                        <span>
                          <span className="font-semibold">#{e.seq} {EVENT_LABEL[e.type] ?? e.type}</span> <span className="text-ink-soft">{e.caseId}</span>
                          {e.type === "KYC_PROCESSED" && <span className="ml-1 text-ink-soft">→ {VERDICT_LABEL[String(e.data.verdict)] ?? String(e.data.verdict)}</span>}
                        </span>
                        <span className="text-xs text-ink-soft">
                          {new Date(e.ts).toLocaleTimeString("en-IN")} · {e.hash}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className={card}>
                  <p className="flex items-center gap-2 font-semibold">
                    {d.live.chain.ok ? <ShieldCheck className="h-5 w-5 text-ok" /> : <XCircle className="h-5 w-5 text-brand" />} Audit chain {d.live.chain.ok ? "intact" : `broken at #${d.live.chain.brokenAt}`}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">Every entry carries the hash of the one before it, so editing or deleting any past event is detected here.</p>
                  {d.live.perInstance && <p className="mt-2 text-xs text-ink-soft">Shared storage is not connected, so this log is per server instance.</p>}
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_22rem]">
              <div className={card}>
                <p className="font-semibold">Document check answer board (sample applicants K01–K12)</p>
                <ul className="mt-2 divide-y divide-rule text-sm">
                  {d.kycBoard.map((k) => (
                    <li key={k.id} className="flex items-start gap-3 py-2">
                      <span className="w-10 shrink-0 font-bold">{k.id}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERDICT_CLS[k.verdict]}`}>{VERDICT_LABEL[k.verdict]}</span>
                      <span className="text-ink-soft">{k.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={card}>
                <p className="font-semibold">Partner rescue queue</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-ink-soft">Recoverable leads</dt><dd className="font-bold">{d.rescue.total.toLocaleString("en-IN")}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-soft">Fixable by a link</dt><dd className="font-bold">{d.rescue.digitalFixable.toLocaleString("en-IN")}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-soft">High likelihood</dt><dd className="font-bold">{d.rescue.high.toLocaleString("en-IN")}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-soft">Expected monthly revenue</dt><dd className="font-bold text-brand">{inr(d.rescue.expectedMonthly)}</dd></div>
                </dl>
                <Link href="/partner" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-semibold text-white">
                  Open the queue <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/judge" className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full border-2 border-rule font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Rule tester
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </BackOfficeShell>
  );
}
