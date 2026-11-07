import { z } from "zod";
import { checkDependency, checkEligibility } from "./eligibility";
import { summarise } from "./bundle-builder";
import {
  BusinessProfileSchema,
  type BlockedItem,
  type Bundle,
  type BusinessProfileInput,
  type Catalogue,
  type QuoteLine,
} from "./types";

export const CartChangeSchema = z.object({
  productId: z.string().regex(/^P\d{2}$/),
  /** 0 removes the product. */
  quantity: z.number().int().min(0).max(500),
});
export type CartChange = z.infer<typeof CartChangeSchema>;

/**
 * Apply add-on toggles from the quote screen. Every change is re-checked against
 * the catalogue, so the cart can never hold an ineligible product — even if the
 * client is tampered with. Removing a base also removes add-ons that depended on it.
 */
export function applyCartChanges(
  bundle: Bundle,
  changes: CartChange[],
  profileInput: BusinessProfileInput,
  catalogue: Catalogue,
): Bundle {
  const profile = BusinessProfileSchema.parse(profileInput);
  const lines = new Map<string, QuoteLine>(bundle.lines.map((l) => [l.productId, { ...l }]));
  const blocked: BlockedItem[] = [];
  const trace = [...bundle.trace];

  for (const change of changes.map((c) => CartChangeSchema.parse(c))) {
    const product = catalogue.get(change.productId);
    if (!product) continue;
    if (change.quantity === 0) {
      lines.delete(product.id);
      trace.push({ step: "cart-remove", detail: product.id });
      continue;
    }
    const failures = [
      ...checkEligibility(product, profile),
      ...checkDependency(product, [...lines.keys()], catalogue),
    ];
    if (failures.length) {
      blocked.push({ productId: product.id, name: product.name, failures });
      trace.push({ step: "cart-blocked", detail: product.id });
      continue;
    }
    lines.set(product.id, {
      productId: product.id,
      name: product.name,
      quantity: change.quantity,
      unitPrice: product.priceMin,
      monthly: product.priceMin * change.quantity,
      setup: product.setupFee * change.quantity,
      why: lines.get(product.id)?.why ?? product.description,
    });
    trace.push({ step: "cart-set", detail: `${product.id} x${change.quantity}` });
  }

  // Cascade: drop add-ons whose base dependency was removed.
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...lines.keys()]) {
      const product = catalogue.get(id)!;
      const dep = checkDependency(product, [...lines.keys()], catalogue);
      if (dep.length) {
        lines.delete(id);
        blocked.push({ productId: id, name: product.name, failures: dep });
        trace.push({ step: "cart-cascade-remove", detail: id });
        changed = true;
      }
    }
  }

  return summarise([...lines.values()], blocked, trace, catalogue);
}
