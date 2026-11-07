/** Print the KYC verdict board for K01–K12: npx tsx scripts/kyc-report.ts */
import { runKycChecks } from "../src/domain/kyc/checks";
import { getRegistry } from "../src/server/data";
import { KYC_FIXTURES } from "../tests/fixtures/kyc-extracted";

for (const [id, docs] of Object.entries(KYC_FIXTURES)) {
  const r = runKycChecks(docs, getRegistry());
  console.log(`\n${id}  ${r.verdict}`);
  for (const c of r.checks.filter((c) => c.status !== "pass")) console.log(`   [${c.status}] ${c.code}: ${c.message}${c.suggestion ? `  -> ${c.suggestion}` : ""}`);
}
