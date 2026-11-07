import { NextResponse } from "next/server";
import { runKycChecks } from "@/domain/kyc/checks";
import { maskGstin } from "@/domain/kyc/gstin";
import { ExtractedDocsSchema } from "@/domain/kyc/types";
import { getRegistry } from "@/server/data";

export const runtime = "nodejs";

/** POST extracted document fields; returns the verdict with check-by-check reasons. Identifiers are masked. */
export async function POST(req: Request) {
  const parsed = ExtractedDocsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid documents", issues: parsed.error.issues }, { status: 400 });
  const result = runKycChecks(parsed.data, getRegistry());
  return NextResponse.json({
    ...result,
    verified: { ...result.verified, gstin: result.verified.gstin && maskGstin(result.verified.gstin) },
  });
}
