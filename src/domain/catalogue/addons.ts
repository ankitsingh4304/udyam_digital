import { checkDependency, checkEligibility } from "./eligibility";
import { summarise } from "./bundle-builder";
import { applyCartChanges, type CartChange } from "./quote";
import { BusinessProfileSchema, type Bundle, type BusinessProfileInput, type Catalogue } from "./types";

const BASES = new Set(["P01", "P02", "P03", "P04", "P05", "P06"]);

export interface AddonOption {
  productId: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  setupFee: number;
  inCart: boolean;
  quantity: number;
  available: boolean;
  reason?: string;
}

/** Every non-base product with whether the owner can toggle it, and why not. */
export function listAddons(bundle: Bundle, profileInput: BusinessProfileInput, catalogue: Catalogue): AddonOption[] {
  const profile = BusinessProfileSchema.parse(profileInput);
  const ids = bundle.lines.map((l) => l.productId);
  return [...catalogue.values()]
    .filter((p) => !BASES.has(p.id))
    .map((p) => {
      const line = bundle.lines.find((l) => l.productId === p.id);
      const failures = [...checkEligibility(p, profile), ...checkDependency(p, ids, catalogue)];
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        unitPrice: p.priceMin,
        setupFee: p.setupFee,
        inCart: !!line,
        quantity: line?.quantity ?? 0,
        available: failures.length === 0,
        reason: failures[0]?.message,
      };
    });
}

/** Rebuild a cart from scratch (bases first) so every line is re-validated server-side. */
export function rebuildCart(cart: CartChange[], profile: BusinessProfileInput, catalogue: Catalogue): Bundle {
  const ordered = [...cart].sort((a, b) => Number(BASES.has(b.productId)) - Number(BASES.has(a.productId)));
  return applyCartChanges(summarise([], [], [], catalogue), ordered, profile, catalogue);
}
