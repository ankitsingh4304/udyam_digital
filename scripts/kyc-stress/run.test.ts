import { appendFileSync, readFileSync } from "node:fs";
import { afterAll, it } from "vitest";
import { shutdownOcr } from "@/adapters/vision/extract";
import { getRegistry } from "@/server/data";
import { processKycDocuments } from "@/server/kyc-service";
import type { DocKind } from "@/domain/kyc/types";

const cases = JSON.parse(readFileSync(process.env.STRESS_CASES!, "utf8")) as { id: string; variant: string; expect: string[]; note: string; docs: Record<string, string>; declared: string | null }[];
const shard = Number(process.env.SHARD ?? 0), of = Number(process.env.SHARDS ?? 1);
const out = process.env.STRESS_OUT!;
afterAll(() => shutdownOcr());
it("stress", async () => {
  for (const [i, c] of cases.entries()) {
    if (i % of !== shard) continue;
    const t = Date.now();
    try {
      const docs = Object.entries(c.docs).map(([slot, p]) => ({ slot: slot as DocKind, buffer: readFileSync(p) }));
      const r = await processKycDocuments(docs, { registry: getRegistry(), forceReader: "ocr", declaredGstin: c.declared ?? undefined });
      appendFileSync(out, JSON.stringify({ id: c.id, variant: c.variant, expect: c.expect, verdict: r.verdict, ms: Date.now() - t,
        fails: r.checks.filter((x) => x.status === "fail").map((x) => `${x.code}:${x.message}`),
        q: r.documents.map((d) => `${d.slot}:${d.quality.blurScore}/${d.quality.skewDeg}/${d.detectedType ?? "-"}`) }) + "\n");
    } catch (e) {
      appendFileSync(out, JSON.stringify({ id: c.id, variant: c.variant, expect: c.expect, verdict: "CRASH", ms: Date.now() - t, error: String((e as Error).stack).slice(0, 400) }) + "\n");
    }
  }
}, 10_000_000);
