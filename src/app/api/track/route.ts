import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderPayload } from "@/domain/orders/tracker";
import { orderEvents } from "@/server/ops";
import { rateLimit } from "@/server/rate-limit";
import { verifyToken } from "@/server/signed-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status updates for one order. The signed order token is the owner's proof of access. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "track", 1200);
  if (limited) return limited;
  const parsed = z.object({ token: z.string().max(4000) }).safeParse(await req.json().catch(() => null));
  const order = parsed.success ? verifyToken<OrderPayload>(parsed.data.token) : undefined;
  if (!order?.id) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  return NextResponse.json({ events: await orderEvents(order.id) });
}
