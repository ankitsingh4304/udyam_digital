import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderPayload } from "@/domain/orders/tracker";
import { appendAudit, auditEntries } from "@/server/audit-log";
import { getConsent, orderEvents, requestDeletion } from "@/server/ops";
import { rateLimit } from "@/server/rate-limit";
import { verifyToken } from "@/server/signed-token";

export const runtime = "nodejs";

const Body = z.object({ token: z.string().max(4000), action: z.enum(["download", "delete"]) });

/**
 * DPDP rights from the order page. The signed order token proves it's the owner.
 * download: everything we hold about this case (order, consent, status updates, audit events).
 * delete: records an erasure request for operations (telecom record-keeping rules may require
 * keeping the verified business details; everything else is erased).
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "my-data", 120);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const order = parsed.success ? verifyToken<OrderPayload>(parsed.data.token) : undefined;
  if (!parsed.success || !order?.caseId) return NextResponse.json({ error: "Unknown order" }, { status: 404 });

  if (parsed.data.action === "delete") {
    const r = await requestDeletion(order.caseId, order.id);
    await appendAudit("DATA_DELETION_REQUESTED", order.caseId, { orderId: order.id });
    return NextResponse.json({ requested: true, at: r.at });
  }
  const [consent, events, audit] = await Promise.all([getConsent(order.caseId).catch(() => undefined), orderEvents(order.id), auditEntries(order.caseId)]);
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    note: "Document images are not included because we do not keep them: they were discarded right after the check.",
    order,
    consent: consent ?? null,
    statusUpdates: events,
    activityLog: audit.map(({ ts, type, data }) => ({ ts, type, data })),
  });
}
