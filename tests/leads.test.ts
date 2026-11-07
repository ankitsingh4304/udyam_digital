import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { RESCUE, scoreLead } from "@/domain/leads/propensity";
import { readDataFile } from "@/server/data";
import { rescueLeads, rescueSummary } from "@/server/leads-service";

const rows = Papa.parse<Record<string, string>>(readDataFile("smb_leads.csv").trim(), { header: true }).data;

function auc(scores: number[], labels: number[]) {
  const idx = scores.map((s, i) => [s, labels[i]] as const).sort((a, b) => a[0] - b[0]);
  let rankSum = 0, pos = 0;
  idx.forEach(([, y], i) => { if (y) { rankSum += i + 1; pos++; } });
  const neg = labels.length - pos;
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

describe("propensity scorer (TypeScript port of the trained model)", () => {
  it("ranks leads as well as the Python model (AUC ≥ 0.70 on all 5,000)", () => {
    const scores = rows.map((r) => scoreLead({ ...r, monthly_telecom_spend_inr: +r.monthly_telecom_spend_inr, employee_count: +r.employee_count, num_sites: +r.num_sites } as never).probability);
    expect(auc(scores, rows.map((r) => (r.outcome === "Activated" ? 1 : 0)))).toBeGreaterThan(0.7);
  });

  it("every drop reason in the data has a rescue action", () => {
    const reasons = new Set(rows.filter((r) => r.drop_reason).map((r) => r.drop_reason));
    for (const r of reasons) expect(RESCUE[r], r).toBeDefined();
  });

  it("queue is sorted by expected value and hides full contact names", () => {
    const q = rescueLeads();
    expect(q[0].expectedMonthly).toBeGreaterThanOrEqual(q[10].expectedMonthly);
    expect(q[0].contact).toMatch(/^\S+ [A-Z]\.,/);
    const s = rescueSummary(q);
    expect(s.total).toBe(4632);
    expect(s.digitalFixable).toBeGreaterThan(2000);
  });
});
