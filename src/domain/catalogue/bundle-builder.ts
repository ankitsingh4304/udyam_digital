import { checkDependency, checkEligibility } from "./eligibility";
import {
  BusinessProfileSchema,
  type BlockedItem,
  type Bundle,
  type BusinessProfile,
  type BusinessProfileInput,
  type Catalogue,
  type Need,
  type Product,
  type QuoteLine,
  type RuleFailure,
  type Segment,
  type TraceEntry,
} from "./types";

/** Connectivity bases: exactly one per site. */
const BASES = ["P01", "P02", "P03", "P04", "P05", "P06"] as const;
const FIBRE_BASES = new Set(["P01", "P02", "P03", "P05", "P06"]);

const NEED_TO_PRODUCT: Record<Exclude<Need, "leased_line">, string> = {
  pos: "P19",
  cctv: "P23",
  whatsapp: "P15",
  sms: "P14",
  email: "P16",
  backup: "P17",
  security: "P20",
  failover: "P09",
  static_ip: "P11",
  website: "P18",
  telephony: "P12",
  tollfree: "P13",
  wifi: "P22",
  iot: "P24",
  fleet: "P25",
  sdwan: "P10",
  firewall: "P21",
};

/** Sensible add-ons per segment, added only when eligible. Never reported as blocked. */
const SEGMENT_DEFAULTS: Record<Segment, Need[]> = {
  micro: ["pos"],
  prof: ["email", "backup", "security", "failover"],
  multi: ["failover", "wifi", "cctv", "pos"],
  mfg: ["firewall", "security", "email"],
};

const WHY: Record<string, string> = {
  P01: "100 Mbps business fibre: enough for UPI, billing and video calls",
  P02: "300 Mbps business fibre: room for a full office on one line",
  P03: "1 Gbps fibre with priority support for heavy traffic",
  P04: "5G wireless broadband, plug-and-play where fibre isn't available",
  P05: "Dedicated 20 Mbps line with a 99.5% uptime SLA",
  P06: "Dedicated 100 Mbps line with a 99.9% uptime SLA",
  P07: "Business mobile lines with 50 GB data each",
  P08: "Business mobile lines with 150 GB data, roaming and priority care",
  P09: "Backup 4G/5G router so you stay online when the main line is down",
  P10: "Manage all your sites' internet from one dashboard",
  P11: "A fixed IP for CCTV, servers or remote access",
  P12: "Business phone lines with IVR and call recording",
  P13: "A 1800 number customers can call free",
  P14: "10,000 SMS a month for alerts and offers",
  P15: "Verified WhatsApp channel with a catalogue for your customers",
  P16: "Email on your own domain, documents and video meetings",
  P17: "Automatic 1 TB backup of your PCs and phones",
  P18: "A 5-page website with your own domain",
  P19: "GST-ready billing and UPI/card payments on a tablet",
  P20: "Antivirus and ransomware protection for every device",
  P21: "Managed firewall watched by the Accel security team",
  P22: "Managed Wi-Fi with a separate customer network",
  P23: "HD camera with 30 days of cloud recording",
  P24: "Sensors that track machine uptime and energy use",
  P25: "GPS tracking for every vehicle",
};

interface Candidate {
  id: string;
  explicit: boolean;
}

function baseCandidates(p: BusinessProfile): Candidate[] {
  const c: Candidate[] = [];
  const push = (id: string, explicit: boolean) => {
    if (!c.some((x) => x.id === id)) c.push({ id, explicit });
  };
  for (const id of p.requestedProducts) if ((BASES as readonly string[]).includes(id)) push(id, true);
  if (p.needs.includes("leased_line")) {
    if (p.wantsSpeed === "100" || p.wantsSpeed === "1g") push("P06", true);
    push("P05", true);
  }
  if (p.wantsSpeed === "1g") push("P03", true);
  if (p.wantsSpeed === "300") push("P02", true);
  if (p.wantsSpeed === "100") push("P01", true);
  if (!p.fibreAvailable) push("P04", false);
  const defaults: Record<Segment, string[]> = {
    micro: ["P01", "P04"],
    prof: ["P02", "P01", "P04"],
    multi: ["P02", "P01", "P04"],
    mfg: ["P05", "P02", "P01", "P04"],
  };
  for (const id of defaults[p.segment]) push(id, false);
  return c;
}

function addonQuantity(id: string, p: BusinessProfile): number {
  switch (id) {
    case "P09":
    case "P10":
    case "P19":
    case "P21":
    case "P22":
      return p.sites;
    case "P23":
      return 2 * p.sites;
    case "P16":
    case "P20":
      return p.employees;
    case "P12":
      return 2;
    case "P24":
      return p.iotDevices ?? 5;
    case "P25":
      return p.fleetSize ?? 1;
    default:
      return 1;
  }
}

function simQuantity(p: BusinessProfile): number {
  if (p.simCount) return p.simCount;
  switch (p.segment) {
    case "micro":
      return Math.min(2, p.employees);
    case "prof":
      return Math.min(3, p.employees);
    case "multi":
      return Math.min(2 * p.sites, 10);
    case "mfg":
      return 3;
  }
}

function makeLine(product: Product, quantity: number): QuoteLine {
  return {
    productId: product.id,
    name: product.name,
    quantity,
    unitPrice: product.priceMin,
    monthly: product.priceMin * quantity,
    setup: product.setupFee * quantity,
    why: WHY[product.id] ?? product.description,
  };
}

/**
 * Deterministic bundle builder. The only place products are chosen.
 * Every product in the result has passed every catalogue rule.
 */
export function buildBundle(input: BusinessProfileInput, catalogue: Catalogue): Bundle {
  const p = BusinessProfileSchema.parse(input);
  const trace: TraceEntry[] = [];
  const blocked: BlockedItem[] = [];
  const lines: QuoteLine[] = [];
  const get = (id: string) => {
    const product = catalogue.get(id);
    if (!product) throw new Error(`Catalogue is missing ${id}`);
    return product;
  };
  const block = (product: Product, failures: RuleFailure[], alternative?: string) => {
    if (blocked.some((b) => b.productId === product.id)) return;
    blocked.push({ productId: product.id, name: product.name, failures, alternative });
    trace.push({ step: "blocked", detail: `${product.id}: ${failures.map((f) => f.code).join(", ")}` });
  };

  trace.push({
    step: "profile",
    detail: `segment=${p.segment} staff=${p.employees} sites=${p.sites} tier=${p.cityTier} gstin=${p.gstinStatus} fibre=${p.fibreAvailable}`,
  });

  // 1. Connectivity base (skipped for mobile-only customers).
  let base: Product | undefined;
  if (!p.mobileOnly) {
    const rejected: { product: Product; failures: RuleFailure[] }[] = [];
    for (const cand of baseCandidates(p)) {
      const product = get(cand.id);
      const failures = checkEligibility(product, p);
      if (!p.fibreAvailable && FIBRE_BASES.has(product.id)) {
        failures.push({ code: "NO_FIBRE", message: `${product.name} needs fibre, which isn't available at this site.` });
      }
      if (failures.length === 0) {
        base = product;
        break;
      }
      if (cand.explicit) rejected.push({ product, failures });
    }
    for (const r of rejected) block(r.product, r.failures, base?.name);
    if (base) {
      lines.push(makeLine(base, p.sites));
      trace.push({ step: "base", detail: `${base.id} x${p.sites}` });
    }
  }

  // 2. Mobile lines.
  const sim = get(p.segment === "micro" ? "P07" : "P08");
  const simFailures = checkEligibility(sim, p);
  if (simFailures.length === 0) lines.push(makeLine(sim, simQuantity(p)));
  else block(sim, simFailures);

  // 3. Add-ons: explicit needs + explicit product requests, then segment defaults.
  if (!p.mobileOnly) {
    const explicitIds = new Set<string>();
    for (const need of p.needs) if (need !== "leased_line") explicitIds.add(NEED_TO_PRODUCT[need]);
    for (const id of p.requestedProducts) if (!(BASES as readonly string[]).includes(id)) explicitIds.add(id);

    const candidates: Candidate[] = [...explicitIds].map((id) => ({ id, explicit: true }));
    for (const need of SEGMENT_DEFAULTS[p.segment]) {
      const id = NEED_TO_PRODUCT[need as Exclude<Need, "leased_line">];
      if (!explicitIds.has(id)) candidates.push({ id, explicit: false });
    }

    for (const cand of candidates) {
      if (lines.some((l) => l.productId === cand.id)) continue;
      const product = catalogue.get(cand.id);
      if (!product) continue;
      const failures = [
        ...checkEligibility(product, p),
        ...checkDependency(product, lines.map((l) => l.productId), catalogue),
      ];
      if (failures.length === 0) {
        lines.push(makeLine(product, addonQuantity(product.id, p)));
        trace.push({ step: cand.explicit ? "addon" : "default-addon", detail: product.id });
      } else if (cand.explicit) {
        block(product, failures);
      } else {
        trace.push({ step: "skip-default", detail: `${product.id}: ${failures.map((f) => f.code).join(", ")}` });
      }
    }
  }

  return summarise(lines, blocked, trace, catalogue);
}

export function summarise(
  lines: QuoteLine[],
  blocked: BlockedItem[],
  trace: TraceEntry[],
  catalogue: Catalogue,
): Bundle {
  const products = lines.map((l) => catalogue.get(l.productId)!);
  return {
    lines,
    blocked,
    trace,
    monthlyTotal: lines.reduce((s, l) => s + l.monthly, 0),
    setupTotal: lines.reduce((s, l) => s + l.setup, 0),
    contractMonths: Math.max(0, ...products.map((x) => x.minContractMonths)),
    maxInstallDays: Math.max(0, ...products.map((x) => x.installDays)),
  };
}
