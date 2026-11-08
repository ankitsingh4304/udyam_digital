import sharp from "sharp";
import type { LlmChain } from "@/adapters/llm/chain";
import { analyseImage, deskew, type ImageAnalysis } from "@/adapters/vision/image-quality";
import { extractDocument, type Reader } from "@/adapters/vision/extract";
import { DEFAULT_KYC_OPTIONS, decide, runKycChecks, similarity } from "@/domain/kyc/checks";
import { maskGstin, validateGstin } from "@/domain/kyc/gstin";
import { gstinCandidates, mergeGstinReads, type DocFields, type GstinCandidate } from "@/domain/kyc/parse-ocr";
import type { DocKind, ExtractedDocsInput, IRegistryService, KycCheck, KycResult } from "@/domain/kyc/types";

export const DOC_SLOTS: DocKind[] = ["gst", "udyam", "signatory", "addressProof"];
export interface UploadedDoc {
  slot: DocKind;
  buffer: Buffer;
}

export interface DocReport {
  slot: DocKind;
  quality: ImageAnalysis;
  reader?: Reader;
  detectedType?: DocFields["docType"];
  /** Fields as shown to the customer: identifiers masked. */
  fields?: Record<string, string>;
}

export interface KycCaseResult extends KycResult {
  documents: DocReport[];
}

const MIN_BLUR = 100;
/** Scans of the sample certificates score 900+; compressed phone photos ~250–400. */
const SOFT_PHOTO = 500;
const NAME_MATCH = DEFAULT_KYC_OPTIONS.nameSimilarity;
const MAX_SIDE = 2400;
/** Blur score of a blank page or a plain photo; real document photos score well above 100. */
const BLANK = 5;
const LABEL: Record<DocKind, string> = { gst: "GST certificate", udyam: "Udyam certificate", signatory: "Signatory ID", addressProof: "Address proof" };

function maskFields(f: DocFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (!v || k === "docType" || k === "gstinConfidence" || k === "gstinRaw") continue;
    out[k] = k === "gstin" ? maskGstin(String(v)) : k === "udyamNumber" ? String(v).replace(/\d{4}$/, "••••") : String(v);
  }
  return out;
}

/**
 * Full Smart-KYC run on uploaded images: pre-flight → deskew → read (cache / vision / OCR)
 * → deterministic checks. Raw images are never stored; only fields and check results leave.
 */
export async function processKycDocuments(
  docs: UploadedDoc[],
  deps: { registry: IRegistryService; llm?: LlmChain; forceReader?: "vision" | "ocr"; declaredGstin?: string },
): Promise<KycCaseResult> {
  const reports: DocReport[] = [];
  const extracted: ExtractedDocsInput = {};
  const extra: KycCheck[] = [];
  /** Pre-flight failures that deserve a clearer reason than "too blurry". */
  const retitle = new Map<DocKind, { code: string; message: string }>();
  const notDoc = new Set<DocKind>();

  await Promise.all(
    docs.map(async ({ slot, buffer }) => {
      let png: Buffer;
      try {
        // Honour EXIF rotation, normalise the format, and cap the size: a 50 MP photo reads no better
        // than 2400 px and takes far longer.
        png = await sharp(buffer, { failOn: "none" }).rotate().toColourspace("srgb").resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).png().toBuffer();
      } catch {
        reports.push({ slot, quality: { width: 0, height: 0, blurScore: 0, skewDeg: 0 } });
        extracted[slot] = { quality: { blurScore: 0, skewDeg: 0 } } as never;
        retitle.set(slot, { code: "IMAGE_UNREADABLE", message: `${LABEL[slot]}: this file couldn't be opened as a photo.` });
        return;
      }
      const quality = await analyseImage(png);
      const report: DocReport = { slot, quality };
      reports.push(report);
      const q = { blurScore: quality.blurScore, skewDeg: Math.abs(quality.skewDeg) };
      if (quality.blurScore < MIN_BLUR || Math.abs(quality.skewDeg) > 15) {
        extracted[slot] = { quality: q } as never;
        // Almost no edges at all: a blank page, a dark frame or a plain photo, not a blurry document.
        if (quality.blurScore < BLANK) retitle.set(slot, { code: "NOT_A_DOCUMENT", message: `${LABEL[slot]}: no printed text found in this photo. It looks blank or isn't a document.` });
        return;
      }
      const image = await deskew(png, quality.skewDeg);
      let { fields, reader, trusted } = await extractDocument(image, { llm: deps.llm, hashOf: buffer, forceReader: deps.forceReader });
      // Backup reader on a sideways or upside-down photo with no rotation tag: try the other ways up.
      if (reader === "ocr" && fields.docType === "unknown") {
        for (const turn of [90, 270, 180]) {
          const turned = await extractDocument(await sharp(image).rotate(turn).png().toBuffer(), { forceReader: "ocr" });
          if (turned.fields.docType !== "unknown") {
            ({ fields, reader, trusted } = turned);
            extra.push({ code: "IMAGE_DESKEWED", doc: slot, status: "info", impact: "none", message: `${LABEL[slot]} was turned ${turn}° before reading.` });
            break;
          }
        }
      }
      report.reader = reader;
      report.detectedType = fields.docType;
      report.fields = maskFields(fields);
      if (fields.docType === "unknown" && Object.keys(report.fields).length === 0) {
        // Nothing we know how to read: tell the owner plainly instead of failing field by field.
        extracted[slot] = { quality: { blurScore: 0, skewDeg: 0 } } as never;
        notDoc.add(slot);
        return;
      }
      if (fields.docType !== "unknown" && fields.docType !== slot) {
        extra.push({ code: "WRONG_SLOT", doc: slot, status: "warn", impact: "none", message: `This looks like a ${fields.docType === "addressProof" ? "utility bill" : fields.docType === "gst" ? "GST certificate" : fields.docType === "udyam" ? "Udyam certificate" : "signatory ID"}; it was read as that.` });
      }
      const target = fields.docType !== "unknown" ? fields.docType : slot;

      if (target === "gst" && fields.gstin) {
        const asRead = fields.gstin;
        let disagree = false;
        // Second reader when the AI read the GSTIN: protects printed digits in letter positions.
        // Skipped for trusted reads (the case specimens, read and checked once).
        if (reader !== "ocr" && !trusted) {
          const ocr = await extractDocument(image, { forceReader: "ocr" });
          const merged = mergeGstinReads(fields.gstin, ocr.fields.gstin);
          if (merged.overridden.length) {
            disagree = validateGstin(asRead).ok;
            extra.push({ code: "SECOND_READER", doc: "gst", status: "info", impact: "none", message: `Second reader saw a digit at position ${merged.overridden.join(", ")} of the GSTIN.` });
            fields.gstin = merged.gstin;
          }
        }
        // Invalid as read: check plausible readings against the registry under the certificate's own name.
        if (!validateGstin(fields.gstin!).ok && (reader === "ocr" || disagree)) {
          const hits = new Map<string, { c: GstinCandidate; tradeName: string }>();
          for (const c of [...gstinCandidates(fields.gstin!), ...(fields.gstinRaw && fields.gstinRaw.length !== 15 ? gstinCandidates(fields.gstinRaw) : [])]) {
            if (!validateGstin(c.gstin).ok) continue;
            const rec = deps.registry.getGstin(c.gstin);
            if (rec && (similarity(rec.tradeName, fields.tradeName) >= NAME_MATCH || similarity(rec.legalName, fields.legalName) >= NAME_MATCH)) hits.set(c.gstin, { c, tradeName: rec.tradeName });
          }
          const only = hits.size === 1 ? [...hits.values()][0] : undefined;
          if (only && !only.c.letterSlotDigits.length) {
            extra.push({ code: "OCR_REPAIR", doc: "gst", status: "info", impact: "none", message: `Backup reader misread a look-alike character; the registry confirms ${maskGstin(only.c.gstin)} for ${only.tradeName}.` });
            fields.gstin = only.c.gstin;
          } else if (only) {
            const pos = only.c.letterSlotDigits;
            const read = fields.gstin!;
            extra.push({
              code: "GSTIN_LOOKALIKE",
              doc: "gst",
              status: "fail",
              impact: "review",
              message: `GSTIN position ${pos.join(", ")} reads as the digit ${pos.map((p) => `'${read[p - 1]}'`).join(", ")}, where only a letter is allowed. The registry has ${maskGstin(only.c.gstin)} for ${only.tradeName} with the letter ${pos.map((p) => `'${only.c.gstin[p - 1]}'`).join(", ")}. A reading slip and an altered certificate look the same in a photo, so a person compares it with the original.`,
            });
            fields.gstin = only.c.gstin;
          } else if (reader === "ocr" && (quality.blurScore < SOFT_PHOTO || /[^0-9A-Z]/.test(fields.gstinRaw ?? fields.gstin ?? "") || (fields.gstinRaw ?? fields.gstin ?? "").length !== 15)) {
            // Soft photo, stray symbols or a wrong length in the read: a misread, not tampering. Ask for a sharper photo.
            extra.push({ code: "OCR_UNSURE", doc: "gst", status: "info", impact: "none", message: "This photo is too soft for the backup reader to read the GSTIN reliably." });
            fields.gstin = undefined;
          }
        }
        report.fields = maskFields(fields);
      }

      const base = { quality: q };
      if (target === "gst") extracted.gst = { ...base, gstin: fields.gstin, legalName: fields.legalName, tradeName: fields.tradeName, constitution: fields.constitution, address: fields.address, dateOfLiability: fields.dateOfLiability };
      if (target === "udyam") extracted.udyam = { ...base, udyamNumber: fields.udyamNumber, enterpriseName: fields.enterpriseName, majorActivity: fields.majorActivity, city: fields.city, state: fields.state, dateOfRegistration: fields.dateOfRegistration };
      if (target === "signatory") extracted.signatory = { ...base, name: fields.name, designation: fields.designation, business: fields.business, validTill: fields.validTill };
      if (target === "addressProof") extracted.addressProof = { ...base, billedTo: fields.billedTo, address: fields.address, billDate: fields.billDate };
    }),
  );

  const result = runKycChecks(extracted, deps.registry);
  for (const c of result.checks) {
    const r = c.code === "IMAGE_BLUR" ? retitle.get(c.doc as DocKind) : undefined;
    if (r) Object.assign(c, r);
  }
  // Unknown documents were passed on as unreadable (blur 0); state the real reason.
  for (const slot of notDoc) {
    const c = result.checks.find((x) => x.code === "IMAGE_BLUR" && x.doc === slot);
    if (c) Object.assign(c, { code: "NOT_A_DOCUMENT", message: `${LABEL[slot]}: we couldn't find a ${LABEL[slot]} in this photo.` });
  }

  // GSTIN-first: compare what the certificate shows with the GSTIN the owner entered.
  const declared = deps.declaredGstin?.trim().toUpperCase();
  if (declared && validateGstin(declared).ok) {
    const onDoc = extracted.gst?.gstin;
    const rec = deps.registry.getGstin(declared);
    if (onDoc && onDoc === declared) extra.push({ code: "GSTIN_DECLARED", doc: "gst", status: "pass", impact: "none", message: "Certificate shows the GSTIN you entered." });
    else if (onDoc) {
      const docValid = validateGstin(onDoc).ok;
      extra.push({
        code: "GSTIN_DECLARED",
        doc: "gst",
        status: "fail",
        impact: docValid ? "review" : "reject",
        message: `Certificate shows ${maskGstin(onDoc)}, not the GSTIN you entered (${maskGstin(declared)}).`,
      });
    } else if (rec)
      extra.push({ code: "GSTIN_DECLARED", doc: "gst", status: "info", impact: "none", message: `Registry has ${rec.tradeName} (${rec.status}) for the GSTIN you entered; a clear photo of the certificate will confirm it.` });
  }
  const checks = [...extra, ...result.checks];
  reports.sort((a, b) => DOC_SLOTS.indexOf(a.slot) - DOC_SLOTS.indexOf(b.slot));
  return {
    ...result,
    verdict: decide(checks),
    checks,
    verified: { ...result.verified, gstin: result.verified.gstin && maskGstin(result.verified.gstin) },
    documents: reports,
  };
}
