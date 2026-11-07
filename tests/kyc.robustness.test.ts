import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";
import { shutdownOcr } from "@/adapters/vision/extract";
import { DATA_DIR, getRegistry } from "@/server/data";
import { processKycDocuments } from "@/server/kyc-service";

vi.hoisted(() => {
  const { mkdtempSync } = require("node:fs") as typeof import("node:fs");
  const { tmpdir } = require("node:os") as typeof import("node:os");
  const { join } = require("node:path") as typeof import("node:path");
  process.env.UDYAM_EXTRACT_CACHE = join(mkdtempSync(join(tmpdir(), "cache-")), "c.json");
});
afterAll(() => shutdownOcr());

const img = (id: string, doc: string) => readFileSync(path.join(DATA_DIR, "kyc_documents", `${id}_${doc}.png`));
const phoneQuality = (buf: Buffer) => sharp(buf).resize({ width: 700 }).jpeg({ quality: 45 }).toBuffer();
const docsFor = async (id: string, gst?: Buffer) => [
  { slot: "gst" as const, buffer: gst ?? img(id, "gst_certificate") },
  { slot: "signatory" as const, buffer: img(id, "signatory_id") },
  { slot: "addressProof" as const, buffer: img(id, "address_proof") },
];
const run = async (id: string, opts: { gst?: Buffer; declared?: string } = {}) =>
  processKycDocuments(await docsFor(id, opts.gst), { registry: getRegistry(), forceReader: "ocr", declaredGstin: opts.declared });

describe("GSTIN-first", () => {
  it("K12: certificate matches the GSTIN the owner typed", async () => {
    const r = await run("K12", { declared: "37NBLXS1145E1ZU" });
    expect(r.verdict).toBe("PASS");
    expect(r.checks.find((c) => c.code === "GSTIN_DECLARED")?.status).toBe("pass");
  }, 60_000);

  it("K08: owner types the real GSTIN, certificate prints 24X0R… → still rejected", async () => {
    const r = await run("K08", { declared: "24XORXG9365M1Z3" });
    expect(r.verdict).toBe("REJECT");
    expect(r.checks.find((c) => c.code === "GSTIN_DECLARED")?.message).toContain("not the GSTIN you entered");
  }, 60_000);
});

describe("soft phone photos with only the backup reader", () => {
  it("K10 photographed badly: asks for a retake instead of rejecting a genuine business", async () => {
    const r = await run("K10", { gst: await phoneQuality(img("K10", "gst_certificate")) });
    expect(r.verdict).not.toBe("REJECT");
  }, 60_000);

  it("K06 (tampered) photographed badly: never approved", async () => {
    const r = await run("K06", { gst: await phoneQuality(img("K06", "gst_certificate")) });
    expect(["REJECT", "NEEDS_REUPLOAD", "MANUAL_REVIEW"]).toContain(r.verdict);
  }, 60_000);

  it("K12 photographed badly but read correctly: still passes", async () => {
    const r = await run("K12", { gst: await phoneQuality(img("K12", "gst_certificate")) });
    expect(["PASS", "PASS_WITH_WARNINGS"]).toContain(r.verdict);
  }, 60_000);
});
