import type { BusinessProfileInput, Need } from "../catalogue/types";
import { findCity } from "./lexicon";
import { COPY } from "./copy";
import type { AdvisorState, Lang, ProfileDelta, ProfileDraft, Slot } from "./state";

/** Merge a delta into the draft. Later answers override earlier ones; needs accumulate. */
export function mergeDelta(draft: ProfileDraft, d: ProfileDelta): ProfileDraft {
  const out: ProfileDraft = { ...draft, needs: [...draft.needs], requestedProducts: [...draft.requestedProducts] };
  if (d.businessType) out.businessType = d.businessType;
  if (d.segment) out.segment = d.segment;
  if (d.employees) out.employees = d.employees;
  if (d.sites) out.sites = d.sites;
  if (d.city) {
    const c = findCity(d.city);
    out.city = c?.name ?? d.city;
    // Unknown city → tier 2, the conservative choice: only products sold everywhere.
    out.cityTier = c?.tier ?? 2;
    out.cityKnown = !!c;
  }
  if (d.hasGstin === false) out.gstinStatus = "none";
  if (d.needs) for (const n of d.needs) if (!out.needs.includes(n as Need)) out.needs.push(n as Need);
  if (d.fibreAvailable != null) out.fibreAvailable = d.fibreAvailable;
  if (d.wantsSpeed) out.wantsSpeed = d.wantsSpeed;
  if (d.mobileOnly != null) out.mobileOnly = d.mobileOnly;
  if (d.simCount) out.simCount = d.simCount;
  if (d.fleetSize) {
    out.fleetSize = d.fleetSize;
    if (!out.needs.includes("fleet")) out.needs.push("fleet");
  }
  if (d.currentInternet) {
    out.currentInternet = d.currentInternet;
    // A business already on a leased line needs a dedicated line again, not plain broadband.
    if (d.currentInternet === "leased_line" && !out.needs.includes("leased_line")) out.needs.push("leased_line");
  }
  if (d.currentProvider) out.currentProvider = d.currentProvider;
  if (d.hasPos != null) out.hasPos = d.hasPos;
  if (d.requestedProducts) for (const p of d.requestedProducts) if (!out.requestedProducts.includes(p)) out.requestedProducts.push(p);
  // A small business with 3+ sites is a multi-site business (case appendix A2).
  if (out.sites && out.sites >= 3 && (out.segment === "micro" || out.segment === "prof")) out.segment = "multi";
  return out;
}

const filled = (d: ProfileDraft): Record<Slot, boolean> => ({
  businessType: !!d.segment,
  size: d.employees != null && d.sites != null,
  city: d.cityTier != null,
  gstin: d.gstinStatus != null,
  tools: d.currentInternet != null,
  needs: d.needs.length > 0 || !!d.mobileOnly,
});

/** Next question to ask, or undefined when we can recommend. Each slot is asked at most twice. */
export function nextSlot(state: AdvisorState, needsAnswered: boolean): Slot | undefined {
  const f = filled(state.draft);
  const order: Slot[] = ["businessType", "size", "city", "gstin", "tools", "needs"];
  for (const slot of order) {
    if (slot === "needs") {
      if (!f.needs && !needsAnswered && !state.asked.includes("needs")) return "needs";
      continue;
    }
    // "Current tools" is asked once; the advice still works if the owner skips it.
    if (slot === "tools") {
      if (!f.tools && !state.asked.includes("tools") && !state.draft.mobileOnly) return "tools";
      continue;
    }
    if (!f[slot] && state.asked.filter((s) => s === slot).length < 2) return slot;
  }
  return undefined;
}

/** Fill gaps with safe defaults so a profile is always buildable. */
export function toProfile(d: ProfileDraft): BusinessProfileInput {
  return {
    segment: d.segment ?? "micro",
    businessType: d.businessType,
    employees: d.employees ?? 1,
    sites: d.sites ?? 1,
    cityTier: d.cityTier ?? 2,
    gstinStatus: d.gstinStatus ?? "none",
    needs: d.needs,
    fibreAvailable: d.fibreAvailable ?? true,
    wantsSpeed: d.wantsSpeed,
    mobileOnly: d.mobileOnly ?? false,
    simCount: d.simCount,
    fleetSize: d.fleetSize,
    requestedProducts: d.requestedProducts,
  };
}

/** One-line readback of the profile, so the owner can spot a misunderstanding before trusting the price. */
export function summarizeProfile(p: BusinessProfileInput, city: string | undefined, lang: Lang, current?: import("./state").CurrentInternet): string {
  const c = COPY[lang];
  const parts = [
    `${p.businessType ? `${p.businessType} (${c.segment[p.segment]})` : c.segment[p.segment]}`,
    c.staffSites(p.employees, p.sites),
    city ? `${city} (tier ${p.cityTier})` : `tier ${p.cityTier}`,
    c.gstin[p.gstinStatus],
  ];
  if (current) parts.push(`${c.todayLabel}: ${c.current[current]}`);
  if (p.needs?.length) parts.push(`${c.needsLabel}: ${p.needs.join(", ")}`);
  if (p.wantsSpeed) parts.push(p.wantsSpeed === "1g" ? "1 Gbps" : `${p.wantsSpeed} Mbps`);
  if (p.fibreAvailable === false) parts.push("no fibre");
  return parts.join("; ");
}
