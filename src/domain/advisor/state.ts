import { z } from "zod";
import { NEEDS, SEGMENTS } from "../catalogue/types";

export const LANGS = ["en", "hi", "hinglish"] as const;
export type Lang = (typeof LANGS)[number];

/** Questions the advisor can ask, in order. At most one round of each. */
export const SLOTS = ["businessType", "size", "city", "gstin", "needs"] as const;
export type Slot = (typeof SLOTS)[number];

/** What one user message adds. Produced by the LLM or the offline parser. */
export const ProfileDeltaSchema = z.object({
  businessType: z.string().max(60).nullish(),
  segment: z.enum(SEGMENTS).nullish(),
  employees: z.number().int().min(1).max(5000).nullish(),
  sites: z.number().int().min(1).max(500).nullish(),
  city: z.string().max(40).nullish(),
  gstin: z.string().max(20).nullish(),
  hasGstin: z.boolean().nullish(),
  needs: z.array(z.enum(NEEDS)).nullish(),
  fibreAvailable: z.boolean().nullish(),
  wantsSpeed: z.enum(["100", "300", "1g"]).nullish(),
  mobileOnly: z.boolean().nullish(),
  simCount: z.number().int().min(1).max(500).nullish(),
  fleetSize: z.number().int().min(1).max(1000).nullish(),
  requestedProducts: z.array(z.string().regex(/^P\d{2}$/)).nullish(),
  noMoreNeeds: z.boolean().nullish(),
});
export type ProfileDelta = z.infer<typeof ProfileDeltaSchema>;

export const ProfileDraftSchema = z.object({
  businessType: z.string().optional(),
  segment: z.enum(SEGMENTS).optional(),
  employees: z.number().int().optional(),
  sites: z.number().int().optional(),
  city: z.string().optional(),
  cityTier: z.union([z.literal(1), z.literal(2)]).optional(),
  cityKnown: z.boolean().optional(),
  gstinStatus: z.enum(["active", "inactive", "none"]).optional(),
  gstinMasked: z.string().optional(),
  /** Full GSTIN as the owner typed it; stays in their browser state and pre-fills the document check. */
  gstin: z.string().optional(),
  needs: z.array(z.enum(NEEDS)).default([]),
  fibreAvailable: z.boolean().optional(),
  wantsSpeed: z.enum(["100", "300", "1g"]).optional(),
  mobileOnly: z.boolean().optional(),
  simCount: z.number().int().optional(),
  fleetSize: z.number().int().optional(),
  requestedProducts: z.array(z.string()).default([]),
});
export type ProfileDraft = z.infer<typeof ProfileDraftSchema>;

export const AdvisorStateSchema = z.object({
  lang: z.enum(LANGS).default("en"),
  draft: ProfileDraftSchema.default({ needs: [], requestedProducts: [] }),
  asked: z.array(z.enum(SLOTS)).default([]),
  lastAsked: z.enum(SLOTS).optional(),
  done: z.boolean().default(false),
});
export type AdvisorState = z.infer<typeof AdvisorStateSchema>;
