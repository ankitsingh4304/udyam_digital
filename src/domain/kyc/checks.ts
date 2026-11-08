import { STATE_CODES, UDYAM_REGEX, editDistance, maskGstin, validateGstin } from "./gstin";
import {
  ExtractedDocsSchema,
  type DocKind,
  type ExtractedDocsInput,
  type GstinRecord,
  type IRegistryService,
  type KycCheck,
  type KycResult,
  type KycVerdict,
} from "./types";

export interface KycOptions {
  /** Fixed "today" for the hackathon dataset. */
  today: string;
  maxBillAgeDays: number;
  minBlurScore: number;
  maxSkewDeg: number;
  nameSimilarity: number;
}

export const DEFAULT_KYC_OPTIONS: KycOptions = {
  today: "2026-07-15",
  maxBillAgeDays: 90,
  minBlurScore: 100,
  maxSkewDeg: 15,
  nameSimilarity: 0.92,
};

const DOC_LABEL: Record<DocKind, string> = {
  gst: "GST certificate",
  udyam: "Udyam certificate",
  signatory: "Signatory ID",
  addressProof: "Address proof",
};

const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ratio = (x: string, y: string) => (!x && !y ? 1 : 1 - editDistance(x, y) / Math.max(x.length, y.length));
/** Name similarity that ignores case, punctuation and spacing ("AnitaShah" = "Anita Shah"). */
export const similarity = (a = "", b = "") => {
  const x = norm(a), y = norm(b);
  return Math.max(ratio(x, y), ratio(x.replace(/ /g, ""), y.replace(/ /g, "")));
};
/**
 * PIN code from an address, tolerant of how readers return wrapped lines ("75 2083", "75\n2083")
 * and look-alike letters inside the number ("752O83"). Takes the last 6-digit run.
 */
export const pinOf = (addr = "") => {
  const compact = addr.replace(/\s+/g, "").replace(/(?<=\d)[Oo](?=\d)|(?<=\d)[Oo]$/g, "0").replace(/(?<=\d)[Il](?=\d)/g, "1");
  const runs = compact.match(/\d{6}(?!\d)/g);
  return runs?.at(-1);
};
/** Address without the PIN, for a fallback comparison when no PIN could be read. */
const streetOf = (addr = "") => norm(addr.replace(/[-–]?\s*[\dOo\s]{5,}\.?\s*$/, ""));
const cityOf = (addr = "") => {
  const parts = addr.split(",").map((s) => s.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
};
/** A reader sometimes picks up a stray 1–2 letter fragment from the card edge before a name ("hn Thomas Kulkarni"). */
const dropStray = (name = "") => name.replace(/^(?:\S{1,2}\s+)+(?=\S{3,})/, "");
const proprietorOf = (legalName = "") => legalName.match(/^(.*?)\s*\(Prop\./i)?.[1]?.trim();
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Deterministic KYC decision. Input = fields the extraction layer read + image quality.
 * The registry is the source of truth; documents are evidence checked against it.
 */
export function runKycChecks(
  input: ExtractedDocsInput,
  registry: IRegistryService,
  options: Partial<KycOptions> = {},
): KycResult {
  const o = { ...DEFAULT_KYC_OPTIONS, ...options };
  const docs = ExtractedDocsSchema.parse(input);
  const checks: KycCheck[] = [];
  const actions: string[] = [];
  const verified: KycResult["verified"] = {};
  const add = (c: KycCheck, action?: string) => {
    checks.push(c);
    if (action && !actions.includes(action)) actions.push(action);
  };

  // 1. Pre-flight image quality. A document that fails is not read further.
  const usable = new Set<DocKind>();
  for (const kind of ["gst", "udyam", "signatory", "addressProof"] as const) {
    const doc = docs[kind];
    if (!doc) continue;
    const q = doc.quality;
    if (q.blurScore < o.minBlurScore) {
      add(
        { code: "IMAGE_BLUR", doc: kind, status: "fail", impact: "reupload", message: `${DOC_LABEL[kind]} is too blurry to read (sharpness ${Math.round(q.blurScore)}, need ${o.minBlurScore}+).` },
        `Retake the ${DOC_LABEL[kind]} photo in good light, flat and in focus.`,
      );
      continue;
    }
    if (q.skewDeg > o.maxSkewDeg) {
      add(
        { code: "IMAGE_SKEW", doc: kind, status: "fail", impact: "reupload", message: `${DOC_LABEL[kind]} is rotated ${q.skewDeg.toFixed(0)}°, too far to straighten reliably.` },
        `Retake the ${DOC_LABEL[kind]} photo straight-on.`,
      );
      continue;
    }
    if (q.skewDeg > 2)
      add({ code: "IMAGE_DESKEWED", doc: kind, status: "info", impact: "none", message: `${DOC_LABEL[kind]} was straightened by ${q.skewDeg.toFixed(0)}° before reading.` });
    usable.add(kind);
  }
  if (!docs.gst)
    add({ code: "MISSING_DOC", doc: "gst", status: "fail", impact: "reupload", message: "GST certificate is required." }, "Upload the GST registration certificate.");

  // 2. GSTIN: format, checksum, registry status, state, names.
  let rec: GstinRecord | undefined;
  const gst = docs.gst;
  if (gst && usable.has("gst")) {
    if (!gst.gstin) {
      add({ code: "GSTIN_UNREADABLE", doc: "gst", status: "fail", impact: "reupload", message: "No GSTIN could be read on the certificate." }, "Upload a clearer GST certificate.");
    } else {
      const v = validateGstin(gst.gstin);
      const near = () =>
        registry.nearGstin(gst.gstin!, { tradeName: gst.tradeName, city: cityOf(gst.address) }).map((r) => r.gstin);
      if (!v.ok) {
        const slot = v.issues.find((i) => i.code !== "CHECKSUM");
        const candidates = near();
        add(
          {
            code: slot ? "GSTIN_FORMAT" : "GSTIN_CHECKSUM",
            doc: "gst",
            status: "fail",
            impact: "reject",
            message: `GSTIN on the certificate is invalid: ${(slot ?? v.issues[0]).message}`,
            suggestion: candidates.length ? `Registry has a similar record: ${candidates.map(maskGstin).join(", ")}. Confirm with the customer; never auto-correct.` : undefined,
          },
          "Ask for the original GST certificate or verify the GSTIN directly on the GST portal.",
        );
      } else {
        add({ code: "GSTIN_FORMAT", doc: "gst", status: "pass", impact: "none", message: "GSTIN format and check digit are valid." });
        rec = registry.getGstin(gst.gstin);
        if (!rec) {
          add({ code: "REGISTRY_FOUND", doc: "gst", status: "fail", impact: "reject", message: "GSTIN is well-formed but not in the GST registry." });
        } else if (rec.status !== "Active") {
          add(
            { code: "REGISTRY_ACTIVE", doc: "gst", status: "fail", impact: "reject", message: `GST registration is ${rec.status} in the registry. Telecom services needing a GSTIN can't be activated.` },
            "Offer the no-GST bundle, or proceed once the GST registration is restored.",
          );
        } else {
          add({ code: "REGISTRY_ACTIVE", doc: "gst", status: "pass", impact: "none", message: "GSTIN is Active in the registry." });
          verified.gstin = rec.gstin;
          verified.legalName = rec.legalName;
        }
      }
    }
  }

  if (rec && gst) {
    const stateName = STATE_CODES[rec.gstin.slice(0, 2)];
    if (stateName && stateName !== rec.state)
      add({ code: "GSTIN_STATE", doc: "gst", status: "fail", impact: "reject", message: `GSTIN state code means ${stateName}, but the registered address is in ${rec.state}.` });
    const legalOk = similarity(gst.legalName, rec.legalName) >= o.nameSimilarity;
    const tradeOk = similarity(gst.tradeName, rec.tradeName) >= o.nameSimilarity;
    if (!legalOk || !tradeOk)
      add(
        {
          code: "NAME_MATCH",
          doc: "gst",
          status: "fail",
          impact: "review",
          message: (() => {
            const [label, read, want] = !legalOk ? ["Legal name", gst.legalName, rec.legalName] : ["Trade name", gst.tradeName, rec.tradeName];
            return read ? `${label} "${read}" doesn't match the registry ("${want}"). Possible tampering.` : `${label} couldn't be read on the certificate, so it can't be matched to the registry ("${want}").`;
          })(),
        },
        "Send to a verification agent before activation.",
      );
    else add({ code: "NAME_MATCH", doc: "gst", status: "pass", impact: "none", message: "Legal and trade names match the registry." });
  }

  // 3. Signatory.
  const sig = docs.signatory;
  if (!sig) {
    add({ code: "MISSING_DOC", doc: "signatory", status: "fail", impact: "reupload", message: "Authorised signatory ID is required." }, "Upload the authorised signatory's ID.");
  } else if (usable.has("signatory") && rec) {
    if (sig.validTill && sig.validTill < o.today)
      add({ code: "SIGNATORY_EXPIRED", doc: "signatory", status: "fail", impact: "reupload", message: `Signatory ID expired on ${sig.validTill}.` }, "Upload a valid signatory ID.");
    const proprietor = proprietorOf(rec.legalName);
    if (rec.constitution === "Proprietorship" && proprietor) {
      if (similarity(sig.name, proprietor) >= o.nameSimilarity || similarity(dropStray(sig.name), proprietor) >= o.nameSimilarity)
        add({ code: "SIGNATORY_MATCH", doc: "signatory", status: "pass", impact: "none", message: `Signatory ${sig.name} is the registered proprietor.` });
      else
        add({ code: "SIGNATORY_MATCH", doc: "signatory", status: "fail", impact: "review", message: `Signatory ${sig.name} is not the registered proprietor (${proprietor}).` }, "Collect an authorisation letter signed by the proprietor.");
    } else {
      add(
        { code: "SIGNATORY_AUTH", doc: "signatory", status: "warn", impact: "none", message: `${rec.constitution}: the GST registry doesn't list partners or directors, so ${sig.name ?? "the signatory"}'s authority needs a signed authorisation.` },
        "Get the partner/board authorisation e-signed during checkout.",
      );
    }
    if (sig.business && similarity(sig.business, rec.tradeName) < o.nameSimilarity)
      add({ code: "SIGNATORY_BUSINESS", doc: "signatory", status: "fail", impact: "review", message: `Signatory ID is for "${sig.business}", not "${rec.tradeName}".` });
  }

  // 4. Address proof: age and match.
  const bill = docs.addressProof;
  if (!bill) {
    add({ code: "MISSING_DOC", doc: "addressProof", status: "fail", impact: "reupload", message: "Address proof is required." }, "Upload a recent electricity bill.");
  } else if (usable.has("addressProof")) {
    if (!bill.billDate) {
      add({ code: "ADDRESS_PROOF_DATE", doc: "addressProof", status: "fail", impact: "reupload", message: "Bill date could not be read." }, "Upload a clearer address proof.");
    } else {
      const age = daysBetween(bill.billDate, o.today);
      if (age < 0)
        add({ code: "ADDRESS_PROOF_AGE", doc: "addressProof", status: "fail", impact: "review", message: `Bill is dated ${bill.billDate}, after today (${o.today}).` });
      else if (age > o.maxBillAgeDays)
        add(
          { code: "ADDRESS_PROOF_AGE", doc: "addressProof", status: "fail", impact: "reject", message: `Bill dated ${bill.billDate} is ${age} days old; it must be ${o.maxBillAgeDays} days or newer.` },
          `Upload an electricity bill dated ${addDays(o.today, -o.maxBillAgeDays)} or later.`,
        );
      else add({ code: "ADDRESS_PROOF_AGE", doc: "addressProof", status: "pass", impact: "none", message: `Bill is ${age} days old.` });
    }
    if (rec) {
      const billPin = pinOf(bill.address);
      const nameOk = similarity(bill.billedTo, rec.tradeName) >= o.nameSimilarity || similarity(bill.billedTo, rec.legalName) >= o.nameSimilarity;
      // No PIN readable: fall back to the street and city. A different PIN is still a mismatch.
      const streetOk = !billPin && ratio(streetOf(bill.address), streetOf(rec.address)) >= 0.85;
      const pinOk = (!!billPin && billPin === pinOf(rec.address)) || streetOk;
      if (streetOk && nameOk)
        add({ code: "ADDRESS_MATCH", doc: "addressProof", status: "pass", impact: "none", message: "Bill name and street address match the registered place of business (PIN not readable on the bill)." });
      else if (pinOk && nameOk) add({ code: "ADDRESS_MATCH", doc: "addressProof", status: "pass", impact: "none", message: "Bill name and PIN match the registered place of business." });
      else
        add(
          { code: "ADDRESS_MATCH", doc: "addressProof", status: "fail", impact: "review", message: `Bill ${!pinOk ? `PIN ${billPin ?? "(not readable)"} doesn't match registry PIN ${pinOf(rec.address)}` : `is billed to "${bill.billedTo}", not the registered business`}.` },
          "Confirm the installation address with the customer.",
        );
    }
  }

  // 5. Udyam (optional for telecom; a registry hit is still used).
  const udyam = docs.udyam;
  const tradeName = rec?.tradeName ?? gst?.tradeName;
  const city = cityOf(rec?.address ?? gst?.address);
  const lookupByName = () => (tradeName ? registry.findUdyamByName(tradeName, city) : []);
  if (!udyam) {
    const hit = lookupByName();
    if (hit.length === 1) {
      verified.udyamNumber = hit[0].udyamNumber;
      verified.udyamAutoFetched = true;
      add({ code: "UDYAM_AUTOFETCH", doc: "udyam", status: "pass", impact: "none", message: `Udyam certificate not uploaded; found ${hit[0].udyamNumber} in the Udyam registry. No upload needed.` });
    } else add({ code: "UDYAM_OPTIONAL", doc: "udyam", status: "info", impact: "none", message: "Udyam not provided and not found by name. It's optional for these products." });
  } else if (usable.has("udyam")) {
    const num = udyam.udyamNumber?.replace(/\s+/g, "").toUpperCase();
    if (!num || !UDYAM_REGEX.test(num)) {
      const hit = lookupByName();
      if (hit.length === 1) {
        verified.udyamNumber = hit[0].udyamNumber;
        verified.udyamAutoFetched = true;
        add({ code: "UDYAM_NUMBER", doc: "udyam", status: "warn", impact: "none", message: `No valid Udyam number on the certificate; matched ${hit[0].udyamNumber} by name in the registry.` });
      } else
        add({ code: "UDYAM_NUMBER", doc: "udyam", status: "warn", impact: "none", message: "The Udyam certificate has no valid Udyam number and no registry match. Udyam is not counted for this application." });
    } else {
      const u = registry.getUdyam(num);
      if (!u) add({ code: "UDYAM_FOUND", doc: "udyam", status: "fail", impact: "review", message: `${num} is not in the Udyam registry.` });
      else if (similarity(udyam.enterpriseName, u.enterpriseName) < o.nameSimilarity)
        add({ code: "UDYAM_NAME", doc: "udyam", status: "fail", impact: "review", message: `Udyam ${num} belongs to "${u.enterpriseName}", not "${udyam.enterpriseName}".` });
      else if (rec && similarity(u.enterpriseName, rec.tradeName) < o.nameSimilarity && similarity(u.enterpriseName, rec.legalName) < o.nameSimilarity)
        add({ code: "UDYAM_NAME", doc: "udyam", status: "fail", impact: "review", message: `Udyam ${num} is registered to "${u.enterpriseName}", a different business from the GST certificate ("${rec.tradeName}").` });
      else {
        verified.udyamNumber = u.udyamNumber;
        add({ code: "UDYAM_FOUND", doc: "udyam", status: "pass", impact: "none", message: `Udyam ${num} found; enterprise name matches.` });
        const diffs: string[] = [];
        if (udyam.dateOfRegistration && udyam.dateOfRegistration !== u.dateOfRegistration)
          diffs.push(`registration date ${udyam.dateOfRegistration} vs registry ${u.dateOfRegistration}`);
        if (udyam.majorActivity && norm(udyam.majorActivity) !== norm(u.majorActivity))
          diffs.push(`activity ${udyam.majorActivity} vs registry ${u.majorActivity}`);
        if (diffs.length)
          add({ code: "UDYAM_DETAILS", doc: "udyam", status: "info", impact: "none", message: `Certificate differs from the registry (${diffs.join("; ")}). Registry values used.` });
      }
    }
  }

  return { verdict: decide(checks), checks, verified, actions };
}

export function decide(checks: KycCheck[]): KycVerdict {
  const failed = (impact: KycCheck["impact"]) => checks.some((c) => c.status === "fail" && c.impact === impact);
  if (failed("reject")) return "REJECT";
  if (failed("reupload")) return "NEEDS_REUPLOAD";
  if (failed("review")) return "MANUAL_REVIEW";
  if (checks.some((c) => c.status === "warn")) return "PASS_WITH_WARNINGS";
  return "PASS";
}
