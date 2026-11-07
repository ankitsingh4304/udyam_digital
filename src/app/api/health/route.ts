import { NextResponse } from "next/server";
import { getLlm } from "@/adapters/llm";
import { getCatalogue, getRegistry } from "@/server/data";
import { getStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deployment check: data loaded, which AI providers are configured, secrets present. No secrets returned. */
export async function GET() {
  const registry = getRegistry() as unknown as { gstins: Map<string, unknown>; udyams: Map<string, unknown> };
  const llm = getLlm();
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    region: process.env.VERCEL_REGION ?? "local",
    catalogue: getCatalogue().size,
    gstinRecords: registry.gstins.size,
    udyamRecords: registry.udyams.size,
    llmProviders: llm.names,
    visionReader: llm.hasVision ? "gemini" : "offline OCR",
    orderSecretSet: !!process.env.ORDER_SECRET,
    storage: getStore().mode,
  });
}
