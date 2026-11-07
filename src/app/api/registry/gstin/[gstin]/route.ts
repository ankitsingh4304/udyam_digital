import { NextResponse } from "next/server";
import { maskGstin, validateGstin } from "@/domain/kyc/gstin";
import { getRegistry } from "@/server/data";

export const runtime = "nodejs";

/** Mock GSTIN lookup. Returns only what the journey needs (data minimisation). */
export async function GET(_req: Request, { params }: { params: { gstin: string } }) {
  const gstin = decodeURIComponent(params.gstin).toUpperCase();
  const v = validateGstin(gstin);
  if (!v.ok) return NextResponse.json({ valid: false, issues: v.issues }, { status: 422 });
  const rec = getRegistry().getGstin(gstin);
  if (!rec) return NextResponse.json({ valid: true, found: false }, { status: 404 });
  return NextResponse.json({
    valid: true,
    found: true,
    gstin: maskGstin(rec.gstin),
    tradeName: rec.tradeName,
    constitution: rec.constitution,
    state: rec.state,
    status: rec.status,
  });
}
