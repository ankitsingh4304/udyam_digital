import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/server/rate-limit";
import { startEsign } from "@/server/esign";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = rateLimit(req, "esign", 200);
  if (limited) return limited;
  const parsed = z.object({ kycToken: z.string().max(2000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = startEsign(parsed.data.kycToken);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
