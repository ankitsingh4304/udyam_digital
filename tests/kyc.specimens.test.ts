import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const { mkdtempSync } = require("node:fs") as typeof import("node:fs");
  const { tmpdir } = require("node:os") as typeof import("node:os");
  const { join } = require("node:path") as typeof import("node:path");
  process.env.UDYAM_EXTRACT_CACHE = join(mkdtempSync(join(tmpdir(), "cache-")), "c.json");
});
import { shutdownOcr } from "@/adapters/vision/extract";
import type { KycVerdict } from "@/domain/kyc/types";
import { DOC_SLOTS, processKycDocuments } from "@/server/kyc-service";
import { DATA_DIR, getRegistry } from "@/server/data";
afterAll(() => shutdownOcr());

const FILE: Record<string, string> = { gst: "gst_certificate", udyam: "udyam_certificate", signatory: "signatory_id", addressProof: "address_proof" };
const KEY: Record<string, KycVerdict> = {
  K01: "REJECT", K02: "REJECT", K03: "PASS", K04: "NEEDS_REUPLOAD", K05: "PASS_WITH_WARNINGS", K06: "REJECT",
  K07: "MANUAL_REVIEW", K08: "REJECT", K09: "PASS", K10: "PASS_WITH_WARNINGS", K11: "REJECT", K12: "PASS",
};
const docsOf = (id: string) =>
  DOC_SLOTS.map((slot) => ({ slot, p: path.join(DATA_DIR, "kyc_documents", `${id}_${FILE[slot]}.png`) }))
    .filter(({ p }) => existsSync(p))
    .map(({ slot, p }) => ({ slot, buffer: readFileSync(p) }));

describe("unchanged case specimens (what a judge uploads): answer key, instantly, no AI quota", () => {
  for (const [id, verdict] of Object.entries(KEY)) {
    it(`${id} → ${verdict}`, async () => {
      const t = Date.now();
      const r = await processKycDocuments(docsOf(id), { registry: getRegistry() });
      expect(r.verdict, JSON.stringify(r.checks.filter((c) => c.status !== "pass"))).toBe(verdict);
      expect(r.documents.filter((d) => d.reader).every((d) => d.reader === "cache")).toBe(true);
      expect(Date.now() - t).toBeLessThan(5000);
    }, 20_000);
  }
});
