import { describe, expect, it } from "vitest";
import { LlmChain } from "@/adapters/llm/chain";
import { COPY } from "@/domain/advisor/copy";
import { SLOTS, type Lang } from "@/domain/advisor/state";
import { NOTICE } from "@/domain/kyc/consent";
import { milestones, type OrderPayload } from "@/domain/orders/tracker";
import { PACKS } from "@/i18n/packs";
import { handleAdvisorTurn, type AdvisorTurnResult } from "@/server/advisor-service";
import { getCatalogue, getRegistry } from "@/server/data";

const deps = { catalogue: getCatalogue(), registry: getRegistry(), llm: new LlmChain([]) };
const REGIONAL = Object.keys(PACKS) as Lang[];
const SCRIPT: Record<string, RegExp> = { mr: /[ऀ-ॿ]/, gu: /[઀-૿]/, kn: /[ಀ-೿]/, te: /[ఀ-౿]/, ta: /[஀-௿]/, bn: /[ঀ-৿]/ };

/** Tap quick replies by position: the same taps in every language. */
async function tapThrough(lang: Lang, picks: Record<string, number>) {
  let r: AdvisorTurnResult = await handleAdvisorTurn({ message: "", lang }, deps);
  for (let i = 0; i < 8 && !r.state.done; i++) {
    const slot = r.state.lastAsked!;
    r = await handleAdvisorTurn({ state: r.state, message: COPY[lang].quick[slot][picks[slot]] }, deps);
  }
  return r;
}

describe("regional languages", () => {
  it("every pack offers the same quick replies, in the same order, as English", () => {
    for (const lang of REGIONAL) for (const slot of SLOTS) expect(COPY[lang].quick[slot].length, `${lang}.${slot}`).toBe(COPY.en.quick[slot].length);
  });

  it("tapping the same answers gives the same bundle in every language, even with no AI available", async () => {
    // Kirana store · 2 staff, 1 shop · Jaipur · no GSTIN · mobile hotspot · that's all
    const picks = { businessType: 0, size: 0, city: 4, gstin: 0, tools: 0, needs: 5 };
    const en = await tapThrough("en", picks);
    expect(en.state.done).toBe(true);
    for (const lang of REGIONAL) {
      const r = await tapThrough(lang, picks);
      expect(r.state.done, lang).toBe(true);
      expect(r.bundle!.lines.map((l) => l.productId), lang).toEqual(en.bundle!.lines.map((l) => l.productId));
      expect(r.reply.join(" "), lang).toMatch(SCRIPT[lang]); // replies come back in the owner's script
      expect(r.explanation!.join(" "), lang).toMatch(SCRIPT[lang]);
    }
  });

  it("consent notice and tracker exist in every language", () => {
    const order: OrderPayload = { v: 1, id: "UD-X", createdAt: "2026-07-15T04:30:00.000Z", business: "B", lines: [], monthly: 1, setup: 0, contractMonths: 12, installDays: 5, caseId: "case_00000000", speed: 1 };
    for (const lang of REGIONAL) {
      expect(NOTICE[lang].purposes.kyc.label, lang).toMatch(SCRIPT[lang]);
      expect(milestones(order, new Date(), lang)[0].title, lang).toMatch(SCRIPT[lang]);
    }
  });
});
