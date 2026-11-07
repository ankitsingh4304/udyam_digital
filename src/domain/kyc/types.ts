import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const QualitySchema = z.object({
  /** Variance of the Laplacian on the grayscale image. Legible scans score ~900+. */
  blurScore: z.number().nonnegative(),
  /** Estimated rotation in degrees (absolute). */
  skewDeg: z.number().nonnegative().default(0),
});

/** Fields read from each document by the extraction layer (OCR + vision model). */
export const ExtractedDocsSchema = z.object({
  gst: z
    .object({
      quality: QualitySchema,
      gstin: z.string().optional(),
      legalName: z.string().optional(),
      tradeName: z.string().optional(),
      constitution: z.string().optional(),
      address: z.string().optional(),
      dateOfLiability: date.optional(),
    })
    .optional(),
  udyam: z
    .object({
      quality: QualitySchema,
      udyamNumber: z.string().optional(),
      enterpriseName: z.string().optional(),
      majorActivity: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      dateOfRegistration: date.optional(),
    })
    .optional(),
  signatory: z
    .object({
      quality: QualitySchema,
      name: z.string().optional(),
      designation: z.string().optional(),
      business: z.string().optional(),
      validTill: date.optional(),
    })
    .optional(),
  addressProof: z
    .object({
      quality: QualitySchema,
      billedTo: z.string().optional(),
      address: z.string().optional(),
      billDate: date.optional(),
    })
    .optional(),
});
export type ExtractedDocs = z.infer<typeof ExtractedDocsSchema>;
export type ExtractedDocsInput = z.input<typeof ExtractedDocsSchema>;
export type DocKind = keyof ExtractedDocs;

export interface GstinRecord {
  gstin: string;
  legalName: string;
  tradeName: string;
  constitution: string;
  address: string;
  state: string;
  registrationDate: string;
  status: "Active" | "Cancelled" | "Suspended";
}

export interface UdyamRecord {
  udyamNumber: string;
  enterpriseName: string;
  enterpriseType: string;
  majorActivity: string;
  nicDescription: string;
  state: string;
  city: string;
  dateOfRegistration: string;
}

/** Port for GSTIN/Udyam lookups. CSV adapter today; GSTN / DigiLocker provider later. */
export interface IRegistryService {
  getGstin(gstin: string): GstinRecord | undefined;
  /** Records that look like the intended one: edit distance <= 2, or same trade name in the same city. */
  nearGstin(gstin: string, hint?: { tradeName?: string; city?: string }): GstinRecord[];
  getUdyam(udyamNumber: string): UdyamRecord | undefined;
  findUdyamByName(enterpriseName: string, city?: string): UdyamRecord[];
}

export type CheckStatus = "pass" | "info" | "warn" | "fail";
/** What a failure means for the case. */
export type CheckImpact = "reupload" | "reject" | "review" | "none";

export interface KycCheck {
  code: string;
  doc: DocKind | "case";
  status: CheckStatus;
  impact: CheckImpact;
  message: string;
  /** Registry-backed suggestion shown to the customer/agent; never auto-applied. */
  suggestion?: string;
}

export type KycVerdict = "PASS" | "PASS_WITH_WARNINGS" | "NEEDS_REUPLOAD" | "MANUAL_REVIEW" | "REJECT";

export interface KycResult {
  verdict: KycVerdict;
  checks: KycCheck[];
  /** Registry facts adopted as source of truth (shown masked in the UI). */
  verified: { gstin?: string; legalName?: string; udyamNumber?: string; udyamAutoFetched?: boolean };
  actions: string[];
}
