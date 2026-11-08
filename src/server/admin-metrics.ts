import Papa from "papaparse";
import { validateBundle } from "@/domain/catalogue/eligibility";
import { runKycChecks } from "@/domain/kyc/checks";
import { KYC_FIXTURES } from "@/domain/kyc/sample-extractions";
import { auditEntries, verifyAuditChain } from "./audit-log";
import { getStore } from "./store";
import { getCatalogue, getRegistry, readDataFile } from "./data";
import { rescueLeads, rescueSummary } from "./leads-service";

export interface Metric {
  key: string;
  name: string;
  baseline: string;
  target: string;
  lever: string;
}

let baselineCache: ReturnType<typeof computeBaseline> | undefined;

/** Last quarter's numbers from smb_leads.csv: the "before" for every metric. */
function computeBaseline() {
  const rows = Papa.parse<Record<string, string>>(readDataFile("smb_leads.csv").trim(), { header: true }).data;
  const act = rows.filter((r) => r.outcome === "Activated");
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const cac = rows.reduce((s, r) => s + Number(r.acquisition_cost_inr || 0), 0) / act.length;
  const registry = getRegistry();
  const catalogue = getCatalogue();
  const misSold = act.filter((r) =>
    validateBundle(
      r.bundle_products.split(";").map((x) => x.split("x")[0]),
      { employees: Number(r.employee_count), sites: Number(r.num_sites), cityTier: Number(r.city_tier) as 1 | 2, gstinStatus: r.has_gstin === "Y" ? "active" : "none" },
      catalogue,
    ).length > 0,
  ).length;
  const deadGstin = act.filter((r) => r.gstin && registry.getGstin(r.gstin) && registry.getGstin(r.gstin)!.status !== "Active").length;
  return {
    leads: rows.length,
    activated: act.length,
    conversion: act.length / rows.length,
    days: avg(act.map((r) => Number(r.days_lead_to_activation))),
    cac,
    calls: avg(act.map((r) => Number(r.customer_follow_up_calls))),
    churn: act.filter((r) => r.churned_within_6_months === "Y").length / act.length,
    misSold,
    deadGstin,
  };
}

export async function adminMetrics() {
  const b = (baselineCache ??= computeBaseline());
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const metrics: Metric[] = [
    { key: "conversion", name: "Lead → activation", baseline: pct(b.conversion), target: "12%", lever: "Instant advisor (no callbacks), one clear price, rescue queue for drop-outs" },
    { key: "time", name: "Lead → live service", baseline: `${b.days.toFixed(1)} days`, target: "7 days fibre · 48 h SIM/AirFiber", lever: "Quote and documents in one sitting; install slot booked at order" },
    { key: "cac", name: "Acquisition cost per customer", baseline: `₹${Math.round(b.cac).toLocaleString("en-IN")}`, target: "₹6,000", lever: "Discovery is self-serve; partners paid per assist, not per visit" },
    { key: "calls", name: "Status-chasing calls per customer", baseline: b.calls.toFixed(1), target: "≤ 0.5", lever: "Live tracker page and milestone updates" },
    { key: "churn", name: "6-month churn", baseline: pct(b.churn), target: "< 10%", lever: "No mis-sold bundles; fewer chase calls (6% churn at 1 call vs 28% at 5)" },
  ];

  // Answer key: verdicts for the 12 sample applicants, computed now by the same rules the app uses.
  const kycBoard = Object.entries(KYC_FIXTURES).map(([id, docs]) => {
    const r = runKycChecks(docs, getRegistry());
    return { id, verdict: r.verdict, reason: r.checks.find((c) => c.status === "fail")?.message ?? r.checks.find((c) => c.status === "warn")?.message ?? "All checks passed" };
  });

  // Live activity (audit log has no personal data).
  const entries = await auditEntries();
  const count = (t: string) => entries.filter((e) => e.type === t).length;
  const verdicts: Record<string, number> = {};
  for (const e of entries.filter((x) => x.type === "KYC_PROCESSED")) verdicts[String(e.data.verdict)] = (verdicts[String(e.data.verdict)] ?? 0) + 1;
  const durations: number[] = [];
  for (const o of entries.filter((x) => x.type === "ORDER_PLACED")) {
    const c = entries.find((x) => x.type === "CONSENT_GIVEN" && x.caseId === o.caseId);
    if (c) durations.push((Date.parse(o.ts) - Date.parse(c.ts)) / 60_000);
  }
  const revenue = entries.filter((e) => e.type === "ORDER_PLACED").reduce((s, e) => s + Number(e.data.monthly ?? 0), 0);

  return {
    baseline: b,
    metrics,
    guardrails: [
      { name: "Bundles sold that break catalogue rules", before: b.misSold, now: 0, note: "Advisor and cart re-check every rule on the server" },
      { name: "Activations on cancelled/suspended GSTINs", before: b.deadGstin, now: 0, note: "Live registry status check at the advisor and at KYC" },
    ],
    kycBoard,
    live: {
      consents: count("CONSENT_GIVEN"),
      withdrawn: count("CONSENT_WITHDRAWN"),
      kycChecks: count("KYC_PROCESSED"),
      verdicts,
      esigns: count("ESIGN_COMPLETED"),
      whatsapp: {
        chats: count("WA_CHAT_STARTED"),
        quoted: count("WA_QUOTED"),
        handoffs: count("WA_HANDOFF"),
        orders: entries.filter((e) => e.type === "ORDER_PLACED" && e.data.channel === "whatsapp").length,
      },
      orders: count("ORDER_PLACED"),
      monthlyRevenue: revenue,
      medianMinutesConsentToOrder: durations.length ? durations.sort((x, y) => x - y)[Math.floor(durations.length / 2)] : null,
      recent: entries.slice(-12).reverse().map((e) => ({ seq: e.seq, ts: e.ts, type: e.type, caseId: e.caseId, data: e.data, hash: e.hash.slice(0, 10) })),
      chain: verifyAuditChain(entries),
      storage: getStore().mode,
      perInstance: getStore().mode === "local" && !!process.env.VERCEL,
    },
    rescue: rescueSummary(rescueLeads()),
  };
}
