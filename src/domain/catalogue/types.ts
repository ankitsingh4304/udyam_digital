import { z } from "zod";

export const SEGMENTS = ["micro", "prof", "multi", "mfg"] as const;
export type Segment = (typeof SEGMENTS)[number];

export interface Product {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  priceMin: number;
  priceMax: number;
  setupFee: number;
  minContractMonths: number;
  cityTiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  requiresOneOf: string[];
  installDays: number;
  segments: Segment[];
}

export type Catalogue = ReadonlyMap<string, Product>;

export const NEEDS = [
  "pos",
  "cctv",
  "whatsapp",
  "sms",
  "email",
  "backup",
  "security",
  "failover",
  "static_ip",
  "website",
  "telephony",
  "tollfree",
  "wifi",
  "iot",
  "fleet",
  "sdwan",
  "firewall",
  "leased_line",
] as const;
export type Need = (typeof NEEDS)[number];

/**
 * What the advisor knows about the business. The LLM fills this from the chat;
 * everything downstream is deterministic.
 */
export const BusinessProfileSchema = z.object({
  segment: z.enum(SEGMENTS),
  businessType: z.string().optional(),
  employees: z.number().int().min(1),
  sites: z.number().int().min(1),
  cityTier: z.union([z.literal(1), z.literal(2)]),
  /** "active" only after a registry lookup confirms status = Active. */
  gstinStatus: z.enum(["active", "inactive", "none"]),
  needs: z.array(z.enum(NEEDS)).default([]),
  fibreAvailable: z.boolean().default(true),
  wantsSpeed: z.enum(["100", "300", "1g"]).optional(),
  mobileOnly: z.boolean().default(false),
  simCount: z.number().int().min(1).optional(),
  fleetSize: z.number().int().min(1).optional(),
  iotDevices: z.number().int().min(1).optional(),
  /** Product IDs the customer explicitly asked for. Still subject to every rule. */
  requestedProducts: z.array(z.string().regex(/^P\d{2}$/)).default([]),
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export type BusinessProfileInput = z.input<typeof BusinessProfileSchema>;

export type RuleCode =
  | "CITY_TIER"
  | "MIN_EMPLOYEES"
  | "MIN_SITES"
  | "REQUIRES_GSTIN"
  | "REQUIRES_BASE"
  | "NO_FIBRE"
  | "UNKNOWN_PRODUCT";

export interface RuleFailure {
  code: RuleCode;
  message: string;
}

export interface QuoteLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  monthly: number;
  setup: number;
  why: string;
}

export interface BlockedItem {
  productId: string;
  name: string;
  failures: RuleFailure[];
  alternative?: string;
}

export interface TraceEntry {
  step: string;
  detail: string;
}

export interface Bundle {
  lines: QuoteLine[];
  blocked: BlockedItem[];
  trace: TraceEntry[];
  monthlyTotal: number;
  setupTotal: number;
  contractMonths: number;
  maxInstallDays: number;
}
