import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { z } from "zod";
import { listAddons, rebuildCart } from "@/domain/catalogue/addons";
import { CartChangeSchema } from "@/domain/catalogue/quote";
import { BusinessProfileSchema } from "@/domain/catalogue/types";
import { getCatalogue } from "@/server/data";

export const runtime = "nodejs";

const QuoteRequest = z.object({
  profile: BusinessProfileSchema,
  cart: z.array(CartChangeSchema).max(30),
  change: CartChangeSchema.optional(),
});

/** Re-price a cart. Every line is re-checked against the catalogue rules on the server. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "quote", 120);
  if (limited) return limited;
  const parsed = QuoteRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const { profile, cart, change } = parsed.data;
  const catalogue = getCatalogue();
  const merged = change ? [...cart.filter((c) => c.productId !== change.productId), change] : cart;
  const bundle = rebuildCart(merged, profile, catalogue);
  return NextResponse.json({ bundle, addons: listAddons(bundle, profile, catalogue) });
}
