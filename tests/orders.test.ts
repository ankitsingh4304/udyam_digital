import { describe, expect, it } from "vitest";
import { milestones, type OrderPayload } from "@/domain/orders/tracker";
import { signToken, verifyToken } from "@/server/signed-token";

const order: OrderPayload = {
  v: 1, id: "UD-ABC123", createdAt: "2026-07-15T04:30:00.000Z", business: "Kaveri Insurance Advisors",
  lines: [{ productId: "P02", name: "Biz Fibre 300", quantity: 1 }], monthly: 1499, setup: 0, contractMonths: 12, installDays: 5, caseId: "case_12345678", speed: 1,
};
const at = (h: number) => new Date(Date.parse(order.createdAt) + h * 3_600_000);
const statuses = (now: Date) => milestones(order, now).map((m) => m.status);

describe("order tracker", () => {
  it("moves through the milestones on the catalogue's install days (fibre: 5 days)", () => {
    expect(statuses(at(1))).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);
    expect(statuses(at(30))).toEqual(["done", "done", "done", "current", "upcoming"]);
    expect(statuses(at(5 * 24 + 3))).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("demo speed compresses a 5-day install into minutes", () => {
    const fast = { ...order, speed: 1440 };
    expect(milestones(fast, new Date(Date.parse(order.createdAt) + 6 * 60_000)).every((m) => m.status === "done")).toBe(true);
  });

  it("is deterministic per order: same technician and courier number every time", () => {
    expect(milestones(order, at(30))).toEqual(milestones(order, at(30)));
    expect(milestones(order, at(30)).find((m) => m.key === "dispatch")!.detail).toMatch(/ACL\d{10}/);
  });

  it("speaks Hindi", () => {
    expect(milestones(order, at(1), "hi")[0].title).toBe("डॉक्यूमेंट सत्यापित");
  });
});

describe("signed tokens", () => {
  it("round-trips and rejects any edit (e.g. a cheaper price)", () => {
    const t = signToken(order);
    expect(verifyToken<OrderPayload>(t)?.monthly).toBe(1499);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...order, monthly: 1 })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`)).toBeUndefined();
    expect(verifyToken(`${body}.x${sig.slice(1)}`)).toBeUndefined();
  });
});
