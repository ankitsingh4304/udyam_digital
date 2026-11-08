import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { _useLocalStoreForTests } from "@/server/store";

_useLocalStoreForTests(path.join(mkdtempSync(path.join(tmpdir(), "wa-")), "store.json"));
// No API keys in tests: the advisor uses its built-in parser.
vi.mock("@/adapters/llm", async () => {
  const { LlmChain } = await import("@/adapters/llm/chain");
  return { getLlm: () => new LlmChain([]) };
});
const { handleWhatsApp, loadWa, waRefOf, linkOrder, notifyOrderUpdate } = await import("@/server/whatsapp/bot");
const { twilioSignatureOk } = await import("@/server/whatsapp/channels");
const { verifyToken } = await import("@/server/signed-token");

const chat = (from: string) => async (text: string) => handleWhatsApp({ channel: "sim", from, text, origin: "https://demo.example" });

describe("WhatsApp bot", () => {
  it("Hindi chat by numbers: language → 6 questions → bundle and a signed link to finish documents", async () => {
    const say = chat("sim:aaaaaaaaaaaaaaaa");
    expect((await say("Hi"))[0]).toContain("9. বাংলা");
    expect((await say("2")).join(" ")).toMatch(/[ऀ-ॿ]/); // Hindi greeting + first question
    await say("1"); // किराना दुकान
    await say("1"); // 2 स्टाफ, 1 दुकान
    await say("5"); // जयपुर
    await say("1"); // GSTIN नहीं
    await say("1"); // मोबाइल हॉटस्पॉट
    const end = await say("1,6"); // UPI बिलिंग, बस
    const text = end.join("\n");
    expect(text).toContain("₹2,196");
    const short = text.match(/https:\/\/demo\.example\/l\/(\S+)/)![1];
    const { resolveLink } = await import("@/server/shortlink");
    const link = (await resolveLink(short))!.replace(/^\/q\//, "");
    const q = verifyToken<{ cart: { productId: string }[]; waRef: string; lang: string }>(decodeURIComponent(link))!;
    expect(q.cart.map((c) => c.productId)).toContain("P01");
    expect(q.lang).toBe("hi");
    expect(q.waRef).toBe(waRefOf("sim", "sim:aaaaaaaaaaaaaaaa"));
  });

  it("order placed from the chat is confirmed there, and ops updates are pushed", async () => {
    const from = "sim:bbbbbbbbbbbbbbbb";
    const say = chat(from);
    await say("Hi");
    await say("1");
    const ref = waRefOf("sim", from);
    const order = { v: 1 as const, id: "UD-WA0001", createdAt: new Date().toISOString(), business: "B", lines: [], monthly: 999, setup: 0, contractMonths: 12, installDays: 5, caseId: "case_00000001", speed: 1, waRef: ref };
    await linkOrder(ref, order.id, "tok");
    await notifyOrderUpdate(ref, order.id, "tok", { ts: new Date().toISOString(), kind: "done", step: "dispatch", by: "ops" }, order, [{ ts: new Date().toISOString(), kind: "done", step: "dispatch", by: "ops" }]);
    const s = await loadWa(ref);
    expect(s!.orders).toEqual(["UD-WA0001"]);
    expect(s!.outbox!.map((o) => o.text).join(" ")).toMatch(/UD-WA0001.*placed[\s\S]*Equipment dispatched/);
    expect((await say("status"))[0]).toContain("UD-WA0001");
  });

  it("STOP deletes the chat data", async () => {
    const from = "sim:cccccccccccccccc";
    const say = chat(from);
    await say("Hi");
    await say("STOP");
    expect(await loadWa(waRefOf("sim", from))).toBeUndefined();
  });

  it("Twilio webhook signature is checked", () => {
    const url = "https://x.vercel.app/api/whatsapp/twilio";
    const params = { Body: "Hi", From: "whatsapp:+919800000000" };
    const sig = createHmac("sha1", "secret").update(url + "BodyHiFromwhatsapp:+919800000000").digest("base64");
    expect(twilioSignatureOk(url, params, sig, "secret")).toBe(true);
    expect(twilioSignatureOk(url, { ...params, Body: "tampered" }, sig, "secret")).toBe(false);
  });
});
