import { NextResponse } from "next/server";
import { z } from "zod";
import { MILESTONE_KEYS, nextStep, plannedDate, type MilestoneKey, type OrderEvent } from "@/domain/orders/tracker";
import { appendAudit } from "@/server/audit-log";
import { addOrderEvent, getOrder } from "@/server/ops";
import { requireRole } from "@/server/session";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("done") }),
  z.object({ kind: z.literal("delay"), reason: z.string().min(3).max(140), days: z.number().int().min(1).max(30) }),
]);

/**
 * Operations moves an order forward (the next step only, so steps can't be skipped) or reports a
 * delay with a reason and a new date. The owner's tracker follows these events from then on.
 * Production: the same call is made by the warehouse, field-force app and network provisioning.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = requireRole("admin");
  if (!s) return NextResponse.json({ error: "Operations sign-in required." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update", issues: parsed.error.issues }, { status: 400 });
  const rec = await getOrder(params.id);
  if (!rec) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const step: MilestoneKey | undefined = nextStep(rec.events);
  if (!step) return NextResponse.json({ error: "This order is already live." }, { status: 409 });
  const b = parsed.data;
  const now = new Date();
  const ev: OrderEvent =
    b.kind === "done"
      ? { ts: now.toISOString(), kind: "done", step, by: s.name }
      : {
          ts: now.toISOString(),
          kind: "delay",
          step,
          reason: b.reason,
          days: b.days,
          newDate: plannedDate(rec.order, step, [...rec.events, { ts: "", kind: "delay", step, days: b.days, by: "" }]).toISOString(),
          by: s.name,
        };
  const updated = await addOrderEvent(params.id, ev);
  await appendAudit("ORDER_UPDATED", rec.order.caseId, { orderId: params.id, kind: ev.kind, step: MILESTONE_KEYS.indexOf(step) >= 0 ? step : "?", ...(ev.kind === "delay" ? { days: b.kind === "delay" ? b.days : 0 } : {}) });
  return NextResponse.json({ ok: true, events: updated?.events ?? [] });
}
