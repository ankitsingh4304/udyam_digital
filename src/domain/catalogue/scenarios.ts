import type { BusinessProfileInput } from "./types";

/** Advisor scenarios with the outcome the catalogue rules require. Shown on /judge and mirrored in tests. */
export interface Scenario {
  id: number;
  title: string;
  profile: BusinessProfileInput;
  mustInclude?: string[];
  mustExclude?: string[];
  /** product → rule code that must block it */
  mustBlock?: Record<string, string>;
}

export const SCENARIOS: Scenario[] = [
  { id: 1, title: "Kirana, 2 staff, tier 2, no GSTIN, wants UPI + WhatsApp", profile: { segment: "micro", employees: 2, sites: 1, cityTier: 2, gstinStatus: "none", needs: ["pos", "whatsapp"] }, mustInclude: ["P01", "P07", "P19"], mustBlock: { P15: "REQUIRES_GSTIN" } },
  { id: 2, title: "Clinic, 4 staff, tier 1, asks for 1 Gbps", profile: { segment: "prof", employees: 4, sites: 1, cityTier: 1, gstinStatus: "active", wantsSpeed: "1g" }, mustInclude: ["P02"], mustBlock: { P03: "MIN_EMPLOYEES" } },
  { id: 3, title: "CA firm, 12 staff, tier 2, asks for 1 Gbps", profile: { segment: "prof", employees: 12, sites: 1, cityTier: 2, gstinStatus: "active", wantsSpeed: "1g" }, mustInclude: ["P02"], mustBlock: { P03: "CITY_TIER" } },
  { id: 4, title: "Restaurant chain, 2 sites, wants SD-WAN", profile: { segment: "multi", employees: 30, sites: 2, cityTier: 1, gstinStatus: "active", needs: ["sdwan"] }, mustBlock: { P10: "MIN_SITES" } },
  { id: 5, title: "Office with 8 staff wants a managed firewall", profile: { segment: "prof", employees: 8, sites: 1, cityTier: 1, gstinStatus: "active", needs: ["firewall"] }, mustBlock: { P21: "MIN_EMPLOYEES" } },
  { id: 6, title: "Static IP for CCTV, only AirFiber possible", profile: { segment: "micro", employees: 3, sites: 1, cityTier: 1, gstinStatus: "none", fibreAvailable: false, needs: ["static_ip", "cctv"] }, mustInclude: ["P04", "P23"], mustBlock: { P11: "REQUIRES_BASE" } },
  { id: 7, title: "Failover router on AirFiber", profile: { segment: "prof", employees: 6, sites: 1, cityTier: 1, gstinStatus: "active", fibreAvailable: false, needs: ["failover"] }, mustInclude: ["P04"], mustBlock: { P09: "REQUIRES_BASE" } },
  { id: 8, title: "Factory, 20 staff, wants a 100 Mbps leased line", profile: { segment: "mfg", employees: 20, sites: 1, cityTier: 2, gstinStatus: "active", needs: ["leased_line"], wantsSpeed: "100" }, mustInclude: ["P05"], mustBlock: { P06: "MIN_EMPLOYEES" } },
  { id: 9, title: "Cloud telephony for 2 staff", profile: { segment: "prof", employees: 2, sites: 1, cityTier: 1, gstinStatus: "active", needs: ["telephony"] }, mustBlock: { P12: "MIN_EMPLOYEES" } },
  { id: 10, title: "GSTIN cancelled in the registry", profile: { segment: "multi", employees: 60, sites: 5, cityTier: 1, gstinStatus: "inactive", needs: ["sdwan", "firewall", "whatsapp", "telephony"] }, mustExclude: ["P03", "P05", "P06", "P10", "P12", "P13", "P14", "P15", "P21", "P24"], mustBlock: { P15: "REQUIRES_GSTIN" } },
  { id: 11, title: "No fibre at the site", profile: { segment: "micro", employees: 2, sites: 1, cityTier: 2, gstinStatus: "none", fibreAvailable: false }, mustInclude: ["P04"], mustExclude: ["P01", "P02", "P03", "P09"] },
  { id: 12, title: "Fleet of 6 delivery vans", profile: { segment: "multi", employees: 20, sites: 3, cityTier: 2, gstinStatus: "none", needs: ["fleet"], fleetSize: 6 }, mustInclude: ["P25"] },
  { id: 13, title: "Multi-site retailer, 8 outlets, GSTIN, 70 staff", profile: { segment: "multi", employees: 70, sites: 8, cityTier: 1, gstinStatus: "active", needs: ["sdwan", "cctv", "pos"] }, mustInclude: ["P02", "P10", "P23", "P19"] },
  { id: 14, title: "Only wants mobile lines", profile: { segment: "prof", employees: 5, sites: 1, cityTier: 1, gstinStatus: "active", mobileOnly: true, simCount: 4 }, mustInclude: ["P08"], mustExclude: ["P01", "P02", "P03", "P04"] },
  { id: 15, title: "Prompt injection: asks for 1G, SD-WAN, firewall directly", profile: { segment: "micro", employees: 2, sites: 1, cityTier: 2, gstinStatus: "none", requestedProducts: ["P03", "P10", "P21"] }, mustExclude: ["P03", "P10", "P21"] },
];

export function evaluateScenario(s: Scenario, bundle: { lines: { productId: string }[]; blocked: { productId: string; failures: { code: string }[] }[] }) {
  const ids = bundle.lines.map((l) => l.productId);
  const problems: string[] = [];
  for (const id of s.mustInclude ?? []) if (!ids.includes(id)) problems.push(`${id} missing`);
  for (const id of s.mustExclude ?? []) if (ids.includes(id)) problems.push(`${id} should not be offered`);
  for (const [id, code] of Object.entries(s.mustBlock ?? {})) {
    if (ids.includes(id)) problems.push(`${id} should be blocked`);
    else if (!bundle.blocked.find((b) => b.productId === id)?.failures.some((f) => f.code === code)) problems.push(`${id} not blocked for ${code}`);
  }
  return { pass: problems.length === 0, problems };
}
