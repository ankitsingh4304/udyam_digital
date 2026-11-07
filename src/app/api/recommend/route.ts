import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { buildBundle } from "@/domain/catalogue/bundle-builder";
import { BusinessProfileSchema } from "@/domain/catalogue/types";
import { getCatalogue } from "@/server/data";

export const runtime = "nodejs";

/** POST a BusinessProfile; returns the rule-checked bundle, blocked items and trace. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "recommend", 120);
  if (limited) return limited;
  const parsed = BusinessProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile", issues: parsed.error.issues }, { status: 400 });
  return NextResponse.json(buildBundle(parsed.data, getCatalogue()));
}
