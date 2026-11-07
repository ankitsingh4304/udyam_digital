import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { buildBundle } from "@/domain/catalogue/bundle-builder";
import { validateBundle } from "@/domain/catalogue/eligibility";
import { applyCartChanges } from "@/domain/catalogue/quote";
import { NEEDS, SEGMENTS, type BusinessProfileInput } from "@/domain/catalogue/types";
import { getCatalogue, readDataFile } from "@/server/data";

const cat = getCatalogue();
const ids = (p: BusinessProfileInput) => buildBundle(p, cat).lines.map((l) => l.productId);
const blockedCodes = (p: BusinessProfileInput, id: string) =>
  buildBundle(p, cat).blocked.find((b) => b.productId === id)?.failures.map((f) => f.code) ?? [];

const GST_PRODUCTS = ["P03", "P05", "P06", "P10", "P12", "P13", "P14", "P15", "P21", "P24"];

describe("15 advisor scenarios", () => {
  it("1. kirana, no GSTIN, wants UPI + WhatsApp: no WhatsApp API, POS included", () => {
    const p: BusinessProfileInput = { segment: "micro", employees: 2, sites: 1, cityTier: 2, gstinStatus: "none", needs: ["pos", "whatsapp"] };
    expect(ids(p)).toEqual(expect.arrayContaining(["P01", "P07", "P19"]));
    expect(ids(p)).not.toContain("P15");
    expect(blockedCodes(p, "P15")).toContain("REQUIRES_GSTIN");
  });

  it("2. clinic with 4 staff asks for 1 Gbps: P03 blocked on staff, P02 offered", () => {
    const p: BusinessProfileInput = { segment: "prof", employees: 4, sites: 1, cityTier: 1, gstinStatus: "active", wantsSpeed: "1g" };
    expect(ids(p)).not.toContain("P03");
    expect(ids(p)).toContain("P02");
    expect(blockedCodes(p, "P03")).toEqual(["MIN_EMPLOYEES"]);
  });

  it("3. CA firm in a tier-2 city asks for 1 Gbps: P03 blocked on tier", () => {
    const p: BusinessProfileInput = { segment: "prof", employees: 12, sites: 1, cityTier: 2, gstinStatus: "active", wantsSpeed: "1g" };
    expect(ids(p)).not.toContain("P03");
    expect(blockedCodes(p, "P03")).toEqual(["CITY_TIER"]);
  });

  it("4. restaurant chain with 2 sites wants SD-WAN: blocked on sites", () => {
    const p: BusinessProfileInput = { segment: "multi", employees: 30, sites: 2, cityTier: 1, gstinStatus: "active", needs: ["sdwan"] };
    expect(ids(p)).not.toContain("P10");
    expect(blockedCodes(p, "P10")).toEqual(["MIN_SITES"]);
  });

  it("5. 8 staff wants a managed firewall: blocked on staff", () => {
    const p: BusinessProfileInput = { segment: "prof", employees: 8, sites: 1, cityTier: 1, gstinStatus: "active", needs: ["firewall"] };
    expect(blockedCodes(p, "P21")).toEqual(["MIN_EMPLOYEES"]);
  });

  it("6. static IP for CCTV with only AirFiber available: P11 blocked, needs fibre", () => {
    const p: BusinessProfileInput = { segment: "micro", employees: 3, sites: 1, cityTier: 1, gstinStatus: "none", fibreAvailable: false, needs: ["static_ip", "cctv"] };
    expect(ids(p)).toContain("P04");
    expect(ids(p)).toContain("P23"); // CCTV works on AirFiber
    expect(blockedCodes(p, "P11")).toEqual(["REQUIRES_BASE"]);
  });

  it("7. failover on AirFiber: P09 blocked", () => {
    const p: BusinessProfileInput = { segment: "prof", employees: 6, sites: 1, cityTier: 1, gstinStatus: "active", fibreAvailable: false, needs: ["failover"] };
    expect(ids(p)).not.toContain("P09");
    expect(blockedCodes(p, "P09")).toEqual(["REQUIRES_BASE"]);
  });

  it("8. factory with 20 staff wants a 100 Mbps leased line: P06 blocked, P05 offered", () => {
    const p: BusinessProfileInput = { segment: "mfg", employees: 20, sites: 1, cityTier: 2, gstinStatus: "active", needs: ["leased_line"], wantsSpeed: "100" };
    expect(ids(p)).toContain("P05");
    expect(blockedCodes(p, "P06")).toEqual(["MIN_EMPLOYEES"]);
  });

  it("9. cloud telephony for 2 staff: blocked", () => {
    const p: BusinessProfileInput = { segment: "prof", employees: 2, sites: 1, cityTier: 1, gstinStatus: "active", needs: ["telephony"] };
    expect(blockedCodes(p, "P12")).toEqual(["MIN_EMPLOYEES"]);
  });

  it("10. GSTIN cancelled in the registry: every GST-only product blocked", () => {
    const p: BusinessProfileInput = {
      segment: "multi", employees: 60, sites: 5, cityTier: 1, gstinStatus: "inactive",
      needs: ["sdwan", "firewall", "whatsapp", "sms", "telephony", "tollfree", "iot", "leased_line"], wantsSpeed: "1g",
    };
    const got = ids(p);
    for (const id of GST_PRODUCTS) expect(got).not.toContain(id);
    expect(blockedCodes(p, "P15")).toEqual(["REQUIRES_GSTIN"]);
    expect(got).toContain("P02");
  });

  it("11. no fibre at the site: AirFiber, no failover", () => {
    const p: BusinessProfileInput = { segment: "micro", employees: 2, sites: 1, cityTier: 2, gstinStatus: "none", fibreAvailable: false };
    expect(ids(p)).toContain("P04");
    for (const id of ["P01", "P02", "P03", "P09"]) expect(ids(p)).not.toContain(id);
  });

  it("12. fleet of 6 vans: 6 trackers, no GSTIN needed", () => {
    const p: BusinessProfileInput = { segment: "multi", employees: 20, sites: 3, cityTier: 2, gstinStatus: "none", needs: ["fleet"], fleetSize: 6 };
    expect(buildBundle(p, cat).lines.find((l) => l.productId === "P25")?.quantity).toBe(6);
  });

  it("13. same facts in any language give the same bundle (engine is deterministic)", () => {
    const p: BusinessProfileInput = { segment: "prof", employees: 9, sites: 1, cityTier: 1, gstinStatus: "active", needs: ["email", "backup"] };
    expect(buildBundle(p, cat)).toEqual(buildBundle(structuredClone(p), cat));
  });

  it("14. only wants a mobile plan: mobile lines only", () => {
    const p: BusinessProfileInput = { segment: "prof", employees: 5, sites: 1, cityTier: 1, gstinStatus: "active", mobileOnly: true, simCount: 4 };
    const b = buildBundle(p, cat);
    expect(b.lines).toHaveLength(1);
    expect(b.lines[0]).toMatchObject({ productId: "P08", quantity: 4 });
  });

  it("15. prompt injection that requests P03 directly: still refused", () => {
    const p: BusinessProfileInput = { segment: "micro", employees: 2, sites: 1, cityTier: 2, gstinStatus: "none", requestedProducts: ["P03", "P10", "P21"] };
    const got = ids(p);
    for (const id of ["P03", "P10", "P21"]) expect(got).not.toContain(id);
    expect(blockedCodes(p, "P03")).toEqual(expect.arrayContaining(["CITY_TIER", "MIN_EMPLOYEES", "REQUIRES_GSTIN"]));
  });
});

describe("quote and cart", () => {
  const profile: BusinessProfileInput = { segment: "prof", employees: 6, sites: 1, cityTier: 1, gstinStatus: "active" };

  it("prices = list minimum x quantity; contract = longest minimum", () => {
    const b = buildBundle(profile, cat);
    for (const l of b.lines) expect(l.monthly).toBe(cat.get(l.productId)!.priceMin * l.quantity);
    expect(b.monthlyTotal).toBe(b.lines.reduce((s, l) => s + l.monthly, 0));
    expect(b.contractMonths).toBe(12);
  });

  it("a tampered cart cannot add an ineligible product", () => {
    const b = applyCartChanges(buildBundle(profile, cat), [{ productId: "P10", quantity: 1 }], profile, cat);
    expect(b.lines.map((l) => l.productId)).not.toContain("P10");
    expect(b.blocked[0].productId).toBe("P10");
  });

  it("removing the fibre base cascades to add-ons that need it", () => {
    const b0 = buildBundle({ ...profile, needs: ["static_ip"] }, cat);
    expect(b0.lines.map((l) => l.productId)).toEqual(expect.arrayContaining(["P02", "P09", "P11"]));
    const b = applyCartChanges(b0, [{ productId: "P02", quantity: 0 }], profile, cat);
    const got = b.lines.map((l) => l.productId);
    expect(got).not.toContain("P09");
    expect(got).not.toContain("P11");
  });

  it("toggling CCTV on recalculates the total", () => {
    const b0 = buildBundle(profile, cat);
    const b = applyCartChanges(b0, [{ productId: "P23", quantity: 2 }], profile, cat);
    expect(b.monthlyTotal - b0.monthlyTotal).toBe(2 * cat.get("P23")!.priceMin);
    expect(b.setupTotal - b0.setupTotal).toBe(2 * cat.get("P23")!.setupFee);
  });
});

describe("safety properties", () => {
  it("2,000 random profiles: every recommended bundle passes every catalogue rule", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
    for (let i = 0; i < 2000; i++) {
      const p: BusinessProfileInput = {
        segment: pick(SEGMENTS),
        employees: 1 + Math.floor(rnd() * 150),
        sites: 1 + Math.floor(rnd() * 12),
        cityTier: pick([1, 2] as const),
        gstinStatus: pick(["active", "inactive", "none"] as const),
        needs: NEEDS.filter(() => rnd() < 0.25),
        fibreAvailable: rnd() < 0.8,
        wantsSpeed: pick([undefined, "100", "300", "1g"] as const),
        requestedProducts: rnd() < 0.2 ? [pick([...cat.keys()])] : [],
      };
      const b = buildBundle(p, cat);
      const violations = validateBundle(b.lines.map((l) => l.productId), { employees: p.employees, sites: p.sites, cityTier: p.cityTier, gstinStatus: p.gstinStatus }, cat);
      expect(violations, JSON.stringify(p)).toEqual([]);
    }
  });

  it("the same rules flag the 48 mis-sold bundles in smb_leads.csv", () => {
    const rows = Papa.parse<Record<string, string>>(readDataFile("smb_leads.csv").trim(), { header: true }).data;
    const misSold = rows
      .filter((r) => r.outcome === "Activated")
      .filter((r) => {
        const productIds = r.bundle_products.split(";").map((x) => x.split("x")[0]);
        return validateBundle(productIds, {
          employees: Number(r.employee_count),
          sites: Number(r.num_sites),
          cityTier: Number(r.city_tier) as 1 | 2,
          gstinStatus: r.has_gstin === "Y" ? "active" : "none",
        }, cat).length > 0;
      });
    expect(misSold).toHaveLength(48);
  });
});

import { SCENARIOS, evaluateScenario } from "@/domain/catalogue/scenarios";
describe("judge-mode scenarios (shown on /judge)", () => {
  for (const s of SCENARIOS) it(`${s.id}. ${s.title}`, () => expect(evaluateScenario(s, buildBundle(s.profile, cat)).problems).toEqual([]));
});
