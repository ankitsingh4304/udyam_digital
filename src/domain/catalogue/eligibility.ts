import type { BusinessProfile, Catalogue, Product, RuleFailure } from "./types";

type SizeFacts = Pick<BusinessProfile, "cityTier" | "employees" | "sites" | "gstinStatus">;

/** Product-level rules: city tier, staff, sites, GSTIN. Pure and order-independent. */
export function checkEligibility(product: Product, p: SizeFacts): RuleFailure[] {
  const failures: RuleFailure[] = [];
  if (!product.cityTiers.includes(p.cityTier)) {
    failures.push({
      code: "CITY_TIER",
      message: `${product.name} is only sold in tier ${product.cityTiers.join("/")} cities; this business is in a tier ${p.cityTier} city.`,
    });
  }
  if (p.employees < product.minEmployees) {
    failures.push({
      code: "MIN_EMPLOYEES",
      message: `${product.name} needs at least ${product.minEmployees} staff; this business has ${p.employees}.`,
    });
  }
  if (p.sites < product.minSites) {
    failures.push({
      code: "MIN_SITES",
      message: `${product.name} needs at least ${product.minSites} sites; this business has ${p.sites}.`,
    });
  }
  if (product.requiresGstin && p.gstinStatus !== "active") {
    failures.push({
      code: "REQUIRES_GSTIN",
      message:
        p.gstinStatus === "inactive"
          ? `${product.name} needs an active GSTIN; the registry shows this GSTIN as cancelled or suspended.`
          : `${product.name} needs a valid, active GSTIN.`,
    });
  }
  return failures;
}

/** Bundle-level rule: requires_one_of must be satisfied by another product in the same bundle. */
export function checkDependency(product: Product, bundleIds: Iterable<string>, catalogue: Catalogue): RuleFailure[] {
  if (product.requiresOneOf.length === 0) return [];
  const ids = new Set(bundleIds);
  if (product.requiresOneOf.some((id) => ids.has(id))) return [];
  const names = product.requiresOneOf.map((id) => catalogue.get(id)?.name ?? id).join(", ");
  return [
    {
      code: "REQUIRES_BASE",
      message: `${product.name} only works with one of: ${names}.`,
    },
  ];
}

export interface BundleViolation {
  productId: string;
  failures: RuleFailure[];
}

/** Audit any bundle (ours, or a historical sale) against every catalogue rule. */
export function validateBundle(
  productIds: string[],
  p: SizeFacts,
  catalogue: Catalogue,
): BundleViolation[] {
  const out: BundleViolation[] = [];
  for (const id of new Set(productIds)) {
    const product = catalogue.get(id);
    if (!product) {
      out.push({ productId: id, failures: [{ code: "UNKNOWN_PRODUCT", message: `Unknown product ${id}.` }] });
      continue;
    }
    const failures = [...checkEligibility(product, p), ...checkDependency(product, productIds, catalogue)];
    if (failures.length) out.push({ productId: id, failures });
  }
  return out;
}
