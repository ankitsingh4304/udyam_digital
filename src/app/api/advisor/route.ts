import { NextResponse } from "next/server";
import { rateLimit } from "@/server/rate-limit";
import { getLlm } from "@/adapters/llm";
import { AdvisorTurnSchema, handleAdvisorTurn } from "@/server/advisor-service";
import { getCatalogue, getRegistry } from "@/server/data";

export const runtime = "nodejs";

/** One advisor turn. The client keeps `state` and sends it back each time (no server session). */
export async function POST(req: Request) {
  const limited = rateLimit(req, "advisor", 400);
  if (limited) return limited;
  const parsed = AdvisorTurnSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const result = await handleAdvisorTurn(parsed.data, { catalogue: getCatalogue(), registry: getRegistry(), llm: getLlm() });
  return NextResponse.json(result);
}
