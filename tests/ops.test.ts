import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { milestones, nextStep, promisedBy, type OrderEvent, type OrderPayload } from "@/domain/orders/tracker";
import { _useLocalStoreForTests } from "@/server/store";

_useLocalStoreForTests(path.join(mkdtempSync(path.join(tmpdir(), "ops-")), "store.json"));
const ops = await import("@/server/ops");

const order: OrderPayload = {
  v: 1, id: "UD-OPS001", createdAt: "2026-07-15T04:30:00.000Z", business: "Star Electronics",
  lines: [{ productId: "P02", name: "Biz Fibre 300", quantity: 1 }], monthly: 1499, setup: 0, contractMonths: 12, installDays: 5, caseId: "case_aaaa0001", speed: 1440,
};
const ev = (kind: OrderEvent["kind"], step: OrderEvent["step"], extra: Partial<OrderEvent> = {}): OrderEvent => ({ ts: "2026-07-15T05:00:00.000Z", kind, step, by: "Accel Operations", ...extra });

describe("tracker driven by operations", () => {
  it("without updates it follows the demo clock; with updates it follows operations only", () => {
    const later = new Date(Date.parse(order.createdAt) + 60 * 60_000); // demo clock would say "live"
    expect(milestones(order, later).every((m) => m.status === "done")).toBe(true);
    const s = milestones(order, later, "en", [ev("done", "dispatch")]);
    expect(s.map((m) => m.status)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expect(nextStep([ev("done", "dispatch")])).toBe("technician");
  });

  it("a delay shows its reason, and pushes the step and every later date back", () => {
    const delay = ev("delay", "technician", { reason: "Technician unavailable, visit moved", days: 3 });
    const s = milestones(order, new Date(), "en", [ev("done", "dispatch"), delay]);
    expect(s.find((m) => m.key === "technician")?.delay?.reason).toContain("Technician unavailable");
    // 5-day fibre install promised for 20 Jul; a 3-day delay moves it (and every later step) to 23 Jul.
    expect(promisedBy(order)).toContain("20 Jul");
    expect(promisedBy(order, [delay])).toContain("23 Jul");
    expect(s.find((m) => m.key === "install")?.detail).toContain("23 Jul");
  });

  it("orders and their events are stored for everyone to see", async () => {
    await ops.registerOrder(order, "token");
    await ops.addOrderEvent(order.id, ev("done", "dispatch"));
    expect((await ops.orderEvents(order.id)).length).toBe(1);
    expect((await ops.listOrders())[0].order.id).toBe(order.id);
  });
});

describe("verification queue", () => {
  it("a manual-review case waits, then the agent's decision is final", async () => {
    await ops.openReview({ caseId: "case_bbbb0002", business: "Neelgiri Physio", reason: "Name mismatch", issues: ["Name mismatch"] });
    expect((await ops.getReview("case_bbbb0002"))?.status).toBe("pending");
    await ops.decideReview("case_bbbb0002", "approved", "Accel Operations");
    // A second decision can't overturn the first.
    expect((await ops.decideReview("case_bbbb0002", "rejected", "Someone else"))?.status).toBe("approved");
  });
});

describe("consent, data rights and partner claims", () => {
  it("withdrawal is remembered", async () => {
    await ops.setConsent("case_cccc0003", { status: "given", purposes: { kyc: true }, at: "x" });
    expect(await ops.isWithdrawn("case_cccc0003")).toBe(false);
    await ops.setConsent("case_cccc0003", { status: "withdrawn", purposes: { kyc: true }, at: "y" });
    expect(await ops.isWithdrawn("case_cccc0003")).toBe(true);
  });

  it("a deletion request is recorded once and listed for operations", async () => {
    await ops.requestDeletion("case_dddd0004", "UD-X");
    await ops.requestDeletion("case_dddd0004", "UD-X");
    expect((await ops.listDeletions()).filter((d) => d.caseId === "case_dddd0004")).toHaveLength(1);
  });

  it("only one partner can take a lead", async () => {
    expect((await ops.claimLead("L00001", "P-NAG-01", "Sharma Telecom")).ok).toBe(true);
    const second = await ops.claimLead("L00001", "P-NAG-02", "Other Partner");
    expect(second.ok).toBe(false);
    expect((await ops.claimsFor(["L00001", "L00002"]))["L00001"].partnerName).toBe("Sharma Telecom");
  });
});
