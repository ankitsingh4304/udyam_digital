import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { LlmChain } from "@/adapters/llm/chain";
import { parseOcrText, type DocFields } from "@/domain/kyc/parse-ocr";
import { IS_SERVERLESS, WRITABLE_DIR } from "@/server/paths";

export type Reader = "vision" | "ocr" | "cache";

const opt = z.string().max(200).nullish().transform((v) => v ?? undefined);
const VisionSchema = z.object({
  docType: z.enum(["gst", "udyam", "signatory", "addressProof", "unknown"]),
  gstin: opt, legalName: opt, tradeName: opt, constitution: opt, address: opt, dateOfLiability: opt,
  udyamNumber: opt, enterpriseName: opt, majorActivity: opt, city: opt, state: opt, dateOfRegistration: opt,
  name: opt, designation: opt, business: opt, validTill: opt, billedTo: opt, billDate: opt,
});

const VISION_PROMPT = `You read one Indian business KYC document image and return JSON only.
docType: "gst" (GST Registration Certificate), "udyam" (Udyam Registration Certificate), "signatory" (Authorised Signatory ID), "addressProof" (electricity bill), else "unknown".
Fields by type (omit what is not printed):
gst: gstin, legalName, tradeName, constitution, address (join wrapped lines; keep the 6-digit PIN code), dateOfLiability (YYYY-MM-DD)
udyam: udyamNumber, enterpriseName, majorActivity, city, state, dateOfRegistration (YYYY-MM-DD)
signatory: name, designation, business, validTill (YYYY-MM-DD)
addressProof: billedTo, address (join wrapped lines; keep the 6-digit PIN code), billDate (YYYY-MM-DD)
Keep normal spaces between words in names and addresses.
CRITICAL: copy every identifier EXACTLY as printed, character by character. Do not correct, complete or normalise anything.
If a GSTIN prints the digit zero where a letter would be expected, output the digit 0. If a field is blank on the document, omit it.`;

/**
 * Cache of reads keyed by image hash ("<sha>" = AI read, "ocr:<sha>" = Tesseract read), so repeat
 * uploads and the demo spend no API quota and no OCR time. The committed file ships with the app;
 * on read-only hosts new entries go to a writable overlay instead.
 */
const CACHE_FILE = process.env.UDYAM_EXTRACT_CACHE ?? path.join(process.cwd(), "data", "extract-cache.json");
const OVERLAY_FILE = IS_SERVERLESS ? path.join(WRITABLE_DIR, "extract-cache.json") : CACHE_FILE;
let cache: Record<string, DocFields> | undefined;
const readJson = (f: string): Record<string, DocFields> => {
  try {
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, DocFields>) : {};
  } catch {
    return {};
  }
};
const loadCache = () => (cache ??= { ...readJson(CACHE_FILE), ...(OVERLAY_FILE !== CACHE_FILE ? readJson(OVERLAY_FILE) : {}) });
function saveCache() {
  try {
    mkdirSync(path.dirname(OVERLAY_FILE), { recursive: true });
    writeFileSync(OVERLAY_FILE, JSON.stringify(cache, null, 1));
  } catch {
    // Read-only filesystem: keep the in-memory cache only.
  }
}

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

let worker: Promise<import("tesseract.js").Worker> | undefined;
async function ocrText(buf: Buffer): Promise<{ text: string; gstinConfidence?: number }> {
  worker ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const langPath = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int");
    return createWorker("eng", 1, { langPath, gzip: true, cachePath: path.join(WRITABLE_DIR, "tesseract") });
  })();
  const w = await worker;
  const { data } = await w.recognize(buf);
  // Tesseract's own confidence (0–100) for the word that looks like a GSTIN.
  const word = data.words?.find((x) => /^[0-9O][0-9O][A-Z0-9]{11,13}$/.test(x.text.replace(/\s/g, "").toUpperCase()));
  return { text: data.text, gstinConfidence: word ? Math.round(word.confidence) : undefined };
}

export interface ExtractResult {
  fields: DocFields;
  reader: Reader;
}

/**
 * Read one (already deskewed) document image. Order: cache → vision model → Tesseract.
 * `hashOf` is the ORIGINAL upload, so the cache key doesn't depend on deskewing.
 */
export async function extractDocument(
  image: Buffer,
  opts: { llm?: LlmChain; hashOf?: Buffer; useCache?: boolean; forceReader?: "vision" | "ocr" } = {},
): Promise<ExtractResult> {
  const key = sha256(opts.hashOf ?? image);
  if (opts.useCache !== false && !opts.forceReader) {
    const hit = loadCache()[key];
    if (hit) return { fields: hit, reader: "cache" };
  }
  if (opts.forceReader !== "ocr" && opts.llm?.hasVision) {
    const r = await opts.llm.json(
      VisionSchema,
      { system: VISION_PROMPT, messages: [{ role: "user", content: "Read this document." }], image: { base64: image.toString("base64"), mimeType: "image/png" } },
      { vision: true },
    );
    if (r) {
      const fields = { ...r.value, gstin: r.value.gstin?.replace(/\s+/g, "").toUpperCase(), udyamNumber: r.value.udyamNumber?.replace(/\s+/g, "").toUpperCase() } as DocFields;
      loadCache()[key] = fields;
      saveCache();
      return { fields, reader: "vision" };
    }
  }
  const ocrKey = `ocr:${key}`;
  if (opts.useCache !== false && loadCache()[ocrKey]) return { fields: loadCache()[ocrKey], reader: "ocr" };
  const ocr = await ocrText(image);
  const fields: DocFields = { ...parseOcrText(ocr.text), gstinConfidence: ocr.gstinConfidence };
  loadCache()[ocrKey] = fields;
  saveCache();
  return { fields, reader: "ocr" };
}

export async function shutdownOcr() {
  if (worker) await (await worker).terminate();
  worker = undefined;
}
