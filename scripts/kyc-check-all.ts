/**
 * Runs Smart KYC on all 12 sample applicants with the real pipeline and prints the verdicts.
 * With GEMINI_API_KEY set, AI reads are saved to data/extract-cache.json, so later runs
 * (and the live demo) reuse them without spending API quota.
 *   npx tsx scripts/kyc-check-all.ts          (AI reader if available)
 *   npx tsx scripts/kyc-check-all.ts --ocr    (offline reader only)
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

(async () => {
  const { getLlm } = await import("../src/adapters/llm/index");
  const { shutdownOcr } = await import("../src/adapters/vision/extract");
  const { DATA_DIR, getRegistry } = await import("../src/server/data");
  const { DOC_SLOTS, processKycDocuments } = await import("../src/server/kyc-service");
  const FILE: Record<string, string> = { gst: "gst_certificate", udyam: "udyam_certificate", signatory: "signatory_id", addressProof: "address_proof" };
  const EXPECTED: Record<string, string> = {
    K01: "REJECT", K02: "REJECT", K03: "PASS", K04: "NEEDS_REUPLOAD", K05: "PASS_WITH_WARNINGS", K06: "REJECT",
    K07: "MANUAL_REVIEW", K08: "REJECT", K09: "PASS", K10: "PASS_WITH_WARNINGS", K11: "REJECT", K12: "PASS",
  };
  const ocrOnly = process.argv.includes("--ocr");
  const llm = getLlm();
  console.log(ocrOnly ? "Reader: offline OCR only\n" : `Reader: ${llm.hasVision ? "Gemini vision (cached after first read), OCR as backup" : "offline OCR (no GEMINI_API_KEY)"}\n`);
  let ok = 0;
  for (const [id, expected] of Object.entries(EXPECTED)) {
    const docs = DOC_SLOTS.flatMap((slot) => {
      const p = path.join(DATA_DIR, "kyc_documents", `${id}_${FILE[slot]}.png`);
      return existsSync(p) ? [{ slot, buffer: readFileSync(p) }] : [];
    });
    const t = Date.now();
    const r = await processKycDocuments(docs, { registry: getRegistry(), llm, forceReader: ocrOnly ? "ocr" : undefined });
    const pass = r.verdict === expected;
    if (pass) ok++;
    const readers = r.documents.map((d) => `${d.slot}:${d.reader ?? "preflight"}`).join(" ");
    console.log(`${pass ? "✓" : "✗"} ${id} ${r.verdict.padEnd(18)} expected ${expected.padEnd(18)} ${String(Date.now() - t).padStart(6)} ms  ${readers}`);
    if (!pass) {
      for (const c of r.checks.filter((c) => c.status === "fail" || c.status === "warn")) console.log(`     [${c.status}] ${c.code}: ${c.message}`);
      for (const d of r.documents) console.log(`     read ${d.slot}: ${JSON.stringify(d.fields ?? {})}`);
    }
  }
  console.log(`\n${ok}/12 match the expected verdicts`);
  await shutdownOcr();
})();
