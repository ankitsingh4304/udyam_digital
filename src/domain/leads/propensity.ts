import model from "./propensity-model.json";

/** Lead fields known before any sales contact (no outcome leakage). */
export interface LeadFeatures {
  lead_source: string;
  segment: string;
  city_tier: string;
  preferred_language: string;
  annual_turnover_band: string;
  has_gstin: string;
  has_udyam: string;
  current_internet: string;
  current_provider: string;
  contact_role: string;
  monthly_telecom_spend_inr: number;
  employee_count: number;
  num_sites: number;
  products_of_interest: string;
}

export type Band = "High" | "Medium" | "Low";
export interface PropensityScore {
  probability: number;
  band: Band;
  reasons: { label: string; effect: "up" | "down" }[];
}

const CATS = ["lead_source", "segment", "city_tier", "preferred_language", "annual_turnover_band", "has_gstin", "has_udyam", "current_internet", "current_provider", "contact_role"] as const;

const LABEL: Record<string, (v: string) => string> = {
  lead_source: (v) => `Came via ${v.toLowerCase()}`,
  segment: (v) => v,
  city_tier: (v) => `Tier ${v} city`,
  preferred_language: (v) => `Prefers ${v}`,
  annual_turnover_band: (v) => `Turnover ${v}`,
  has_gstin: (v) => (v === "Y" ? "Has a GSTIN" : "No GSTIN"),
  has_udyam: (v) => (v === "Y" ? "Udyam registered" : "No Udyam"),
  current_internet: (v) => `Uses ${v.toLowerCase()} today`,
  current_provider: (v) => `With ${v} today`,
  contact_role: (v) => `Contact is ${v.toLowerCase()}`,
};

/** Logistic-regression score from exported coefficients (scripts/train-propensity.py). Explainable: top 3 drivers. */
export function scoreLead(l: LeadFeatures): PropensityScore {
  const parts: { label: string; w: number }[] = [];
  let z = model.intercept;
  for (const c of CATS) {
    const v = String(l[c]);
    const w = (model.categorical as Record<string, number>)[`${c}=${v}`] ?? 0;
    z += w;
    if (w) parts.push({ label: LABEL[c](v), w });
  }
  const num: Record<string, number> = {
    log_spend: Math.log1p(l.monthly_telecom_spend_inr),
    log_staff: Math.log1p(l.employee_count),
    sites: l.num_sites,
    interests: l.products_of_interest ? l.products_of_interest.split(";").length : 1,
  };
  for (const [k, x] of Object.entries(num)) {
    const m = (model.numeric as Record<string, { weight: number; mean: number }>)[k];
    if (!m) continue;
    const w = m.weight * (x - m.mean);
    z += w;
    const name = { log_spend: "Telecom spend", log_staff: "Team size", sites: "Number of sites", interests: "Products asked about" }[k]!;
    parts.push({ label: `${name} ${x > m.mean ? "above" : "below"} average`, w });
  }
  const probability = 1 / (1 + Math.exp(-z));
  const band: Band = probability >= model.bands.high ? "High" : probability >= model.bands.medium ? "Medium" : "Low";
  const reasons = parts
    .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
    .slice(0, 3)
    .map((p) => ({ label: p.label, effect: p.w > 0 ? ("up" as const) : ("down" as const) }));
  return { probability, band, reasons };
}

export const MODEL_STATS = { auc: model.auc, top30Capture: model.top30Capture, medianBundleBySegment: model.medianBundleBySegment as Record<string, number> };

/** What a partner should do for each drop reason, and whether it can be fixed without a visit. */
export const RESCUE: Record<string, { action: string; channel: "digital" | "visit" | "call" | "later" }> = {
  "Unreachable after 3 attempts": { action: "Send the self-serve advisor link on WhatsApp; no call needed", channel: "digital" },
  "Wrong or invalid number": { action: "Verify the number from the GST registry contact, then send the advisor link", channel: "digital" },
  "Owner had no time for a visit": { action: "Send the advisor link: quote and documents done on the phone in one sitting", channel: "digital" },
  "Visit not scheduled by sales": { action: "Send the advisor link now; book a visit only if they ask", channel: "digital" },
  "Quote too complex to understand": { action: "Share the one-price quote link with plain-language reasons", channel: "digital" },
  "Quote took too long to arrive": { action: "Share an instant quote link", channel: "digital" },
  "Price too high": { action: "Offer the lower-priced eligible bundle the advisor computes", channel: "call" },
  "Competitor offered cheaper plan": { action: "Call with a matched eligible bundle and the single-bill benefit", channel: "call" },
  "Missing GST or Udyam document": { action: "Udyam is fetched from the registry; collect only the GST certificate", channel: "digital" },
  "Found paperwork too long": { action: "Doorstep help: photograph documents with them in 5 minutes", channel: "visit" },
  "Authorised signatory not available": { action: "Send an e-sign link to the signatory", channel: "digital" },
  "Document details did not match": { action: "Visit with the check report; collect the correct document", channel: "visit" },
  "Installation delayed beyond 21 days": { action: "Escalate install; offer 5G AirFiber live in 2 days meanwhile", channel: "call" },
  "Site not feasible for fibre": { action: "Offer 5G AirFiber (no fibre needed, 2-day install)", channel: "call" },
  "First payment failed": { action: "Send a UPI payment link", channel: "digital" },
  "Customer cancelled before install": { action: "Call to understand why; offer a shorter install date", channel: "call" },
  "Locked in with current provider": { action: "Schedule a callback before their contract ends", channel: "later" },
  "Only wanted a mobile plan": { action: "Send the mobile-only plan link", channel: "digital" },
  "Not interested on first call": { action: "Nurture: WhatsApp a relevant offer in 30 days", channel: "later" },
  "Decided to wait": { action: "Nurture: WhatsApp reminder in 2 weeks", channel: "later" },
};
