import Papa from "papaparse";
import { SEGMENTS, type Catalogue, type Product, type Segment } from "./types";

const splitList = (v: string | undefined, sep: string) =>
  (v ?? "")
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);

/** Parse product_catalogue.csv text into a Catalogue. Pure: no fs, so it runs on server or client. */
export function parseCatalogue(csvText: string): Catalogue {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText.trim(), { header: true });
  if (errors.length) throw new Error(`Catalogue CSV error: ${errors[0].message}`);
  const map = new Map<string, Product>();
  for (const r of data) {
    const segments = splitList(r.target_segments, ";").filter((s): s is Segment =>
      (SEGMENTS as readonly string[]).includes(s),
    );
    map.set(r.product_id, {
      id: r.product_id,
      category: r.category,
      name: r.product_name,
      description: r.description,
      unit: r.unit,
      priceMin: Number(r.price_min_inr_per_month),
      priceMax: Number(r.price_max_inr_per_month),
      setupFee: Number(r.one_time_setup_inr || 0),
      minContractMonths: Number(r.min_contract_months),
      cityTiers: splitList(r.available_city_tiers, ";").map(Number),
      minEmployees: Number(r.min_employees || 1),
      minSites: Number(r.min_sites || 1),
      requiresGstin: r.requires_gstin === "Y",
      requiresOneOf: splitList(r.requires_one_of, "|"),
      installDays: Number(r.typical_install_days),
      segments,
    });
  }
  return map;
}
