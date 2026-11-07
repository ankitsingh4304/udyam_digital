import Papa from "papaparse";
import { MODEL_STATS, RESCUE, scoreLead, type Band, type LeadFeatures } from "@/domain/leads/propensity";
import { readDataFile } from "./data";

export interface RescueLead {
  id: string;
  business: string;
  businessType: string;
  segment: string;
  city: string;
  language: string;
  contact: string;
  stage: string;
  dropReason: string;
  action: string;
  channel: string;
  source: string;
  probability: number;
  band: Band;
  reasons: { label: string; effect: "up" | "down" }[];
  expectedMonthly: number;
}

let cache: RescueLead[] | undefined;

/** "Prakash Shah" → "Prakash S." — partners see enough to greet, not the full name (data minimisation). */
const shortName = (n: string) => {
  const [first, ...rest] = n.split(" ");
  return rest.length ? `${first} ${rest.at(-1)![0]}.` : first;
};

/** Dropped leads that a partner can still recover, scored and ranked by expected monthly value. */
export function rescueLeads(): RescueLead[] {
  if (cache) return cache;
  const rows = Papa.parse<Record<string, string>>(readDataFile("smb_leads.csv").trim(), { header: true }).data;
  cache = rows
    .filter((r) => r.outcome === "Dropped" && RESCUE[r.drop_reason])
    .map((r) => {
      const f: LeadFeatures = {
        lead_source: r.lead_source,
        segment: r.segment,
        city_tier: r.city_tier,
        preferred_language: r.preferred_language,
        annual_turnover_band: r.annual_turnover_band,
        has_gstin: r.has_gstin,
        has_udyam: r.has_udyam,
        current_internet: r.current_internet,
        current_provider: r.current_provider,
        contact_role: r.contact_role,
        monthly_telecom_spend_inr: Number(r.monthly_telecom_spend_inr),
        employee_count: Number(r.employee_count),
        num_sites: Number(r.num_sites),
        products_of_interest: r.products_of_interest,
      };
      const s = scoreLead(f);
      const median = MODEL_STATS.medianBundleBySegment[r.segment] ?? 2500;
      return {
        id: r.lead_id,
        business: r.business_name,
        businessType: r.business_type,
        segment: r.segment,
        city: r.city,
        language: r.preferred_language,
        contact: `${shortName(r.contact_name)}, ${r.contact_role}`,
        stage: r.stage_reached,
        dropReason: r.drop_reason,
        action: RESCUE[r.drop_reason].action,
        channel: RESCUE[r.drop_reason].channel,
        source: r.lead_source,
        probability: s.probability,
        band: s.band,
        reasons: s.reasons,
        expectedMonthly: Math.round(s.probability * median),
      };
    })
    .sort((a, b) => b.expectedMonthly - a.expectedMonthly);
  return cache;
}

export function rescueSummary(leads: RescueLead[]) {
  const by = <K extends keyof RescueLead>(k: K) =>
    Object.entries(leads.reduce<Record<string, number>>((acc, l) => ({ ...acc, [String(l[k])]: (acc[String(l[k])] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  return {
    total: leads.length,
    digitalFixable: leads.filter((l) => l.channel === "digital").length,
    high: leads.filter((l) => l.band === "High").length,
    expectedMonthly: leads.reduce((s, l) => s + l.expectedMonthly, 0),
    byReason: by("dropReason"),
    byChannel: by("channel"),
    model: { auc: MODEL_STATS.auc, top30Capture: MODEL_STATS.top30Capture },
  };
}
