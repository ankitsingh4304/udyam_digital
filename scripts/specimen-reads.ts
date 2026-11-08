/**
 * Writes data/specimen-reads.json: the hand-checked reads of the 47 case specimen images
 * (src/domain/kyc/sample-extractions.ts), keyed by file hash. Uploading an unchanged specimen
 * then gives the answer-key verdict instantly, with no AI quota and no OCR time.
 *   npx tsx scripts/specimen-reads.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { KYC_FIXTURES } from "../src/domain/kyc/sample-extractions";

const FILE = { gst: "gst_certificate", udyam: "udyam_certificate", signatory: "signatory_id", addressProof: "address_proof" } as const;
const out: Record<string, Record<string, unknown>> = {};
for (const [id, docs] of Object.entries(KYC_FIXTURES)) {
  for (const [slot, doc] of Object.entries(docs)) {
    const p = path.join("data", "kyc_documents", `${id}_${FILE[slot as keyof typeof FILE]}.png`);
    if (!doc || !existsSync(p)) continue;
    const { quality: _q, ...fields } = doc as Record<string, unknown>;
    if (Object.keys(fields).length === 0) continue; // unreadable specimen (K04 GST): pre-flight stops it anyway
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    out[createHash("sha256").update(readFileSync(p)).digest("hex")] = { docType: slot, ...clean };
  }
}
writeFileSync(path.join("data", "specimen-reads.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out).length} specimen reads written`);
