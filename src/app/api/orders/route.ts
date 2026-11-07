import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { z } from "zod";
import { rebuildCart } from "@/domain/catalogue/addons";
import { CartChangeSchema } from "@/domain/catalogue/quote";
import { BusinessProfileSchema, type BusinessProfileInput } from "@/domain/catalogue/types";
import type { OrderPayload } from "@/domain/orders/tracker";
import { getCatalogue } from "@/server/data";
import { signToken, verifyToken } from "@/server/signed-token";

export const runtime = "nodejs";

const OrderRequest = z.object({
  kycToken: z.string().max(2000),
  quote: z.object({ profile: BusinessProfileSchema, cart: z.array(CartChangeSchema).max(30) }).optional(),
  demo: z.boolean().default(true),
});

/** Used when someone goes straight to the document check (e.g. a judge testing a sample applicant). */
const STARTER: { profile: BusinessProfileInput; cart: { productId: string; quantity: number }[] } = {
  profile: { segment: "prof", employees: 5, sites: 1, cityTier: 2, gstinStatus: "active" },
  cart: [{ productId: "P02", quantity: 1 }, { productId: "P08", quantity: 3 }, { productId: "P16", quantity: 5 }, { productId: "P09", quantity: 1 }],
};

/** Place an order: needs a signed passing KYC result; prices are recomputed here, never taken from the client. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "orders", 200);
  if (limited) return limited;
  const parsed = OrderRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid order", issues: parsed.error.issues }, { status: 400 });
  const kyc = verifyToken<{ caseId: string; verdict: string; business: string; iat: number }>(parsed.data.kycToken);
  if (!kyc) return NextResponse.json({ error: "Document check could not be confirmed. Check the documents again." }, { status: 403 });
  if (kyc.verdict !== "PASS" && kyc.verdict !== "PASS_WITH_WARNINGS")
    return NextResponse.json({ error: "Documents must pass the check before an order can be placed." }, { status: 409 });

  const quote = parsed.data.quote ?? STARTER;
  const catalogue = getCatalogue();
  const bundle = rebuildCart(quote.cart, quote.profile, catalogue);
  if (!bundle.lines.length) return NextResponse.json({ error: "The bundle is empty. Pick a bundle first." }, { status: 400 });

  const order: OrderPayload = {
    v: 1,
    id: `UD-${randomBytes(3).toString("hex").toUpperCase()}`,
    createdAt: new Date().toISOString(),
    business: kyc.business,
    lines: bundle.lines.map((l) => ({ productId: l.productId, name: l.name, quantity: l.quantity })),
    monthly: bundle.monthlyTotal,
    setup: bundle.setupTotal,
    contractMonths: bundle.contractMonths,
    installDays: bundle.maxInstallDays,
    caseId: kyc.caseId,
    speed: parsed.data.demo ? 1440 : 1,
  };
  return NextResponse.json({ orderId: order.id, token: signToken(order) });
}
