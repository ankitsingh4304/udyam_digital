"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, ExternalLink, PackageCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { OrderEvent } from "@/domain/orders/tracker";
import type { ReviewCase } from "@/server/ops";

interface OpsOrder {
  id: string;
  business: string;
  createdAt: string;
  monthly: number;
  lines: number;
  spotCheck: boolean;
  mode: string;
  current: string;
  next: string | null;
  promisedBy: string;
  delayed: boolean;
  events: OrderEvent[];
  trackUrl: string;
}
interface Ops {
  storage: "shared" | "local";
  reviews: ReviewCase[];
  orders: OpsOrder[];
  deletions: { caseId: string; orderId: string; at: string }[];
}

const STEP_ACTION: Record<string, string> = {
  dispatch: "Mark equipment dispatched",
  technician: "Assign technician",
  install: "Mark installed and tested",
  live: "Mark services live",
};
const STEP_NAME: Record<string, string> = { kyc: "Documents", dispatch: "Dispatch", technician: "Technician", install: "Installation", live: "Live" };
const DELAY_REASONS = ["Technician unavailable, visit moved", "Equipment out of stock at warehouse", "Site not ready (customer request)", "Fibre route permission pending"];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Work queues for operations: the KYC cases a person must decide, and orders to move forward. */
export function OpsQueues() {
  const [ops, setOps] = useState<Ops>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [delayFor, setDelayFor] = useState<string>();
  const [reason, setReason] = useState(DELAY_REASONS[0]);
  const [days, setDays] = useState(2);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ops", { cache: "no-store" });
    if (res.ok) setOps(await res.json());
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 8_000);
    return () => clearInterval(t);
  }, [load]);

  const post = async (key: string, url: string, body: unknown) => {
    setBusy(key);
    setError(undefined);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(undefined);
    if (!res.ok) setError(data.error ?? "That didn't work. Try again.");
    await load();
    return res.ok;
  };

  const card = "rounded-2xl bg-white p-5 shadow-card";
  if (!ops) return null;
  const pending = ops.reviews.filter((r) => r.status === "pending");
  const decided = ops.reviews.filter((r) => r.status !== "pending").slice(0, 5);

  return (
    <section className="mt-6 space-y-4" aria-label="Work queues">
      {ops.storage === "local" && (
        <p className="rounded-2xl bg-hold-soft p-3 text-sm text-hold">
          Shared storage is not connected, so queues and status updates live on this server only. Connect Upstash Redis in the hosting dashboard to share them across servers.
        </p>
      )}
      {error && <p className="rounded-2xl bg-brand-soft p-3 text-sm text-brand">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Verification queue */}
        <div className={card}>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ClipboardCheck className="h-5 w-5 text-brand" aria-hidden /> Verification queue
            <span className="ml-auto rounded-full bg-page px-3 py-0.5 text-sm font-semibold">{pending.length} waiting</span>
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Cases the rules could not decide alone (e.g. a name that doesn&apos;t match the registry). The owner&apos;s screen updates as soon as you decide.</p>
          <ul className="mt-3 space-y-3">
            {pending.length === 0 && <li className="text-sm text-ink-soft">Nothing waiting. Try sample applicant K07 on the document check to see a case arrive.</li>}
            {pending.map((r) => (
              <li key={r.caseId} className="rounded-2xl border-2 border-rule p-4">
                <p className="font-semibold">
                  {r.business} <span className="text-sm font-normal text-ink-soft">· {r.caseId}{r.gstinMasked ? ` · ${r.gstinMasked}` : ""}</span>
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {r.issues.slice(0, 3).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={!!busy} onClick={() => post(r.caseId, `/api/admin/reviews/${r.caseId}`, { decision: "approved", note: "Checked by verification agent" })} className="flex h-11 items-center gap-2 rounded-full bg-ok px-5 font-semibold text-white disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve
                  </button>
                  <button disabled={!!busy} onClick={() => post(r.caseId, `/api/admin/reviews/${r.caseId}`, { decision: "rejected", note: "Documents do not match the registry" })} className="flex h-11 items-center gap-2 rounded-full border-2 border-brand px-5 font-semibold text-brand disabled:opacity-50">
                    <XCircle className="h-4 w-4" aria-hidden /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {decided.length > 0 && (
            <ul className="mt-3 divide-y divide-rule text-sm">
              {decided.map((r) => (
                <li key={r.caseId} className="flex justify-between gap-2 py-1.5">
                  <span>{r.business}</span>
                  <span className={r.status === "approved" ? "font-semibold text-ok" : "font-semibold text-brand"}>
                    {r.status === "approved" ? "Approved" : "Rejected"} by {r.decidedBy}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Orders */}
        <div className={card}>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <PackageCheck className="h-5 w-5 text-brand" aria-hidden /> Orders to fulfil
            <span className="ml-auto rounded-full bg-page px-3 py-0.5 text-sm font-semibold">{ops.orders.filter((o) => o.next).length} open</span>
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Each update appears on the owner&apos;s tracker within seconds. In production the warehouse, the technician app and network activation send these same updates.
          </p>
          <ul className="mt-3 space-y-3">
            {ops.orders.length === 0 && <li className="text-sm text-ink-soft">No orders yet. Place one from the document check.</li>}
            {ops.orders.map((o) => (
              <li key={o.id} className="rounded-2xl border-2 border-rule p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {o.id} · {o.business}
                  </p>
                  <a href={o.trackUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-brand">
                    Owner&apos;s view <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {inr(o.monthly)}/month · {o.lines} items · promised by {o.promisedBy} · {o.mode === "demo clock" ? "moving on demo clock" : "updated by operations"}
                </p>
                <p className="mt-2 text-sm">
                  Now: <span className="font-semibold">{o.current}</span>
                  {o.delayed && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-hold-soft px-2 py-0.5 text-xs font-semibold text-hold">
                      <AlertTriangle className="h-3 w-3" aria-hidden /> Delayed
                    </span>
                  )}
                  {o.spotCheck && <span className="ml-2 rounded-full bg-page px-2 py-0.5 text-xs font-semibold">Spot-check documents before marking live</span>}
                </p>
                {o.next ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={!!busy} onClick={() => post(o.id, `/api/admin/orders/${o.id}/events`, { kind: "done" })} className="h-11 rounded-full bg-brand px-5 font-semibold text-white disabled:opacity-50">
                      {STEP_ACTION[o.next] ?? "Next step"}
                    </button>
                    <button disabled={!!busy} onClick={() => setDelayFor(delayFor === o.id ? undefined : o.id)} className="h-11 rounded-full border-2 border-rule px-5 font-semibold">
                      Report a delay
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-ok">Live: all services active</p>
                )}
                {delayFor === o.id && o.next && (
                  <div className="mt-3 grid gap-2 rounded-2xl bg-page p-3 sm:grid-cols-[1fr_auto_auto]">
                    <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Delay reason" className="h-11 rounded-full border-2 border-rule bg-white px-3 text-sm">
                      {DELAY_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Days of delay" className="h-11 rounded-full border-2 border-rule bg-white px-3 text-sm">
                      {[1, 2, 3, 5, 7].map((n) => (
                        <option key={n} value={n}>
                          +{n} day{n > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!!busy}
                      onClick={async () => {
                        if (await post(o.id, `/api/admin/orders/${o.id}/events`, { kind: "delay", reason, days })) setDelayFor(undefined);
                      }}
                      className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Tell the owner
                    </button>
                  </div>
                )}
                {o.events.length > 0 && (
                  <ol className="mt-3 space-y-0.5 text-xs text-ink-soft">
                    {o.events.map((e, i) => (
                      <li key={i}>
                        {new Date(e.ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {e.kind === "done" ? `${STEP_NAME[e.step]} done` : `${STEP_NAME[e.step]} delayed: ${e.reason}`} · {e.by}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {ops.deletions.length > 0 && (
        <div className={card}>
          <h2 className="text-lg font-bold">Data deletion requests ({ops.deletions.length})</h2>
          <p className="text-sm text-ink-soft">Owners asked from their order page. Erase within 30 days, keeping only what telecom record rules require.</p>
          <ul className="mt-2 divide-y divide-rule text-sm">
            {ops.deletions.map((d) => (
              <li key={d.caseId} className="flex justify-between gap-2 py-1.5">
                <span>
                  {d.orderId} · {d.caseId}
                </span>
                <span className="text-ink-soft">{new Date(d.at).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
