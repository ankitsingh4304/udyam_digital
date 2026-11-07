import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Isolated cache (set before modules load) so this test really runs Tesseract on every image.
vi.hoisted(() => {
  const { mkdtempSync } = require("node:fs") as typeof import("node:fs");
  const { tmpdir } = require("node:os") as typeof import("node:os");
  const { join } = require("node:path") as typeof import("node:path");
  process.env.UDYAM_EXTRACT_CACHE = join(mkdtempSync(join(tmpdir(), "cache-")), "c.json");
});
import { shutdownOcr } from "@/adapters/vision/extract";
import type { KycVerdict } from "@/domain/kyc/types";
import { DOC_SLOTS, processKycDocuments, type KycCaseResult } from "@/server/kyc-service";
import { DATA_DIR, getRegistry } from "@/server/data";

/** End to end on the real specimen images, using only the offline reader (no API keys). */
const FILE: Record<string, string> = { gst: "gst_certificate", udyam: "udyam_certificate", signatory: "signatory_id", addressProof: "address_proof" };
const EXPECTED: Record<string, KycVerdict> = {
  K01: "REJECT", K02: "REJECT", K03: "PASS", K04: "NEEDS_REUPLOAD", K05: "PASS_WITH_WARNINGS", K06: "REJECT",
  K07: "MANUAL_REVIEW", K08: "REJECT", K09: "PASS", K10: "PASS_WITH_WARNINGS", K11: "REJECT", K12: "PASS",
};
const results: Record<string, KycCaseResult> = {};

beforeAll(async () => {
  for (const id of Object.keys(EXPECTED)) {
    const docs = DOC_SLOTS.map((slot) => path.join(DATA_DIR, "kyc_documents", `${id}_${FILE[slot]}.png`))
      .map((p, i) => ({ p, slot: DOC_SLOTS[i] }))
      .filter(({ p }) => existsSync(p))
      .map(({ p, slot }) => ({ slot, buffer: readFileSync(p) }));
    results[id] = await processKycDocuments(docs, { registry: getRegistry(), forceReader: "ocr" });
  }
}, 240_000);
afterAll(() => shutdownOcr());

describe("Smart KYC on the real images (offline OCR path)", () => {
  for (const [id, verdict] of Object.entries(EXPECTED)) {
    it(`${id} → ${verdict}`, () => {
      const r = results[id];
      expect(r.verdict, JSON.stringify(r.checks.filter((c) => c.status !== "pass"))).toBe(verdict);
    });
  }
  it("K02 is straightened before reading; K04 is stopped at pre-flight", () => {
    expect(Math.abs(results.K02.documents.find((d) => d.slot === "gst")!.quality.skewDeg)).toBeGreaterThan(5);
    expect(results.K04.documents.find((d) => d.slot === "gst")!.reader).toBeUndefined();
  });
  it("K10: OCR's I/J misread is repaired only because the registry confirms it", () => {
    expect(results.K10.checks.some((c) => c.code === "OCR_REPAIR")).toBe(true);
  });
  it("identifiers leave the server masked", () => {
    expect(JSON.stringify(results.K12)).not.toContain("37NBLXS1145E1ZU");
  });
});
