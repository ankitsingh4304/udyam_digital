import sharp from "sharp";
import type { LlmChain } from "@/adapters/llm/chain";
import { analyseImage, deskew, type ImageAnalysis } from "@/adapters/vision/image-quality";
import { extractDocument, type Reader } from "@/adapters/vision/extract";
import { decide, runKycChecks } from "@/domain/kyc/checks";
import { maskGstin, validateGstin } from "@/domain/kyc/gstin";
import { lookalikeVariants, mergeGstinReads, type DocFields } from "@/domain/kyc/parse-ocr";
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

function maskFields(f: DocFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (!v || k === "docType" || k === "gstinConfidence") continue;
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

  await Promise.all(
    docs.map(async ({ slot, buffer }) => {
      const png = await sharp(buffer).rotate().png().toBuffer(); // honour EXIF rotation, normalise format
      const quality = await analyseImage(png);
      const report: DocReport = { slot, quality };
      reports.push(report);
      const q = { blurScore: quality.blurScore, skewDeg: Math.abs(quality.skewDeg) };
      if (quality.blurScore < MIN_BLUR || Math.abs(quality.skewDeg) > 15) {
        extracted[slot] = { quality: q } as never;
        return;
      }
      const image = await deskew(png, quality.skewDeg);
      const { fields, reader } = await extractDocument(image, { llm: deps.llm, hashOf: buffer, forceReader: deps.forceReader });
      report.reader = reader;
      report.detectedType = fields.docType;
      report.fields = maskFields(fields);
      if (fields.docType !== "unknown" && fields.docType !== slot) {
        extra.push({ code: "WRONG_SLOT", doc: slot, status: "warn", impact: "none", message: `This looks like a ${fields.docType === "addressProof" ? "utility bill" : fields.docType === "gst" ? "GST certificate" : fields.docType === "udyam" ? "Udyam certificate" : "signatory ID"}; it was read as that.` });
      }
      const target = fields.docType !== "unknown" ? fields.docType : slot;

      // Second reader for the GSTIN when the AI read it: protects printed digits in letter positions.
      if (reader !== "ocr" && target === "gst" && fields.gstin) {
        const ocr = await extractDocument(image, { forceReader: "ocr" });
        const merged = mergeGstinReads(fields.gstin, ocr.fields.gstin);
        if (merged.overridden.length) {
          extra.push({ code: "SECOND_READER", doc: "gst", status: "info", impact: "none", message: `Second reader kept the printed digit at position ${merged.overridden.join(", ")} of the GSTIN.` });
          fields.gstin = merged.gstin;
          report.fields = maskFields(fields);
        }
      }

      // Backup OCR only: a checksum failure may be one misread look-alike character.
      // Accept a variant ONLY if it is valid AND the registry has it under the same trade name.
      if (reader === "ocr" && target === "gst" && fields.gstin) {
        const v = validateGstin(fields.gstin);
        const onlyChecksum = !v.ok && v.issues.every((i) => i.code === "CHECKSUM");
        if (onlyChecksum) {
          const hit = lookalikeVariants(fields.gstin).find((g) => {
            const rec = validateGstin(g).ok ? deps.registry.getGstin(g) : undefined;
            return rec && rec.tradeName.toLowerCase() === (fields.tradeName ?? "").toLowerCase();
          });
          if (hit) {
            extra.push({ code: "OCR_REPAIR", doc: "gst", status: "info", impact: "none", message: `Backup OCR misread one look-alike character; the registry confirms ${maskGstin(hit)} for ${fields.tradeName}.` });
            fields.gstin = hit;
          }
        }
      }

      // Backup OCR on a soft photo: a failed GSTIN check is more likely a misread than tampering.
      // Ask for a sharper photo instead of rejecting the customer.
      if (reader === "ocr" && target === "gst" && fields.gstin && !validateGstin(fields.gstin).ok && quality.blurScore < SOFT_PHOTO) {
        extra.push({ code: "OCR_UNSURE", doc: "gst", status: "info", impact: "none", message: "This photo is too soft for the backup reader to read the GSTIN reliably." });
        fields.gstin = undefined;
      }

      const base = { quality: q };
      if (target === "gst") extracted.gst = { ...base, gstin: fields.gstin, legalName: fields.legalName, tradeName: fields.tradeName, constitution: fields.constitution, address: fields.address, dateOfLiability: fields.dateOfLiability };
      if (target === "udyam") extracted.udyam = { ...base, udyamNumber: fields.udyamNumber, enterpriseName: fields.enterpriseName, majorActivity: fields.majorActivity, city: fields.city, state: fields.state, dateOfRegistration: fields.dateOfRegistration };
      if (target === "signatory") extracted.signatory = { ...base, name: fields.name, designation: fields.designation, business: fields.business, validTill: fields.validTill };
      if (target === "addressProof") extracted.addressProof = { ...base, billedTo: fields.billedTo, address: fields.address, billDate: fields.billDate };
    }),
  );

  const result = runKycChecks(extracted, deps.registry);

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
