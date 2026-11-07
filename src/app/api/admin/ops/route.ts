import { NextResponse } from "next/server";
import { milestones, nextStep, promisedBy } from "@/domain/orders/tracker";
import { listDeletions, listOrders, listReviews } from "@/server/ops";
import { requireRole } from "@/server/session";
import { getStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operations work queues: KYC cases waiting for a person, and orders to move forward. */
export async function GET() {
  if (!requireRole("admin")) return NextResponse.json({ error: "Operations sign-in required." }, { status: 401 });
  const [orders, reviews, deletions] = await Promise.all([listOrders(), listReviews(), listDeletions()]);
  const now = new Date();
  return NextResponse.json({
    storage: getStore().mode,
    reviews,
    deletions,
    orders: orders.map(({ order, token, events }) => {
      const steps = milestones(order, now, "en", events);
      return {
        id: order.id,
        business: order.business,
        createdAt: order.createdAt,
        monthly: order.monthly,
        lines: order.lines.length,
        spotCheck: !!order.spotCheck,
        mode: events.length ? "operations" : "demo clock",
        current: steps.find((s) => s.status === "current")?.title ?? "Live",
        next: nextStep(events) ?? null,
        promisedBy: promisedBy(order, events),
        delayed: steps.some((s) => s.delay),
        events,
        trackUrl: `/track/${encodeURIComponent(token)}`,
      };
    }),
  });
}
