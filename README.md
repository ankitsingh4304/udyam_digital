# Udyam Digital — Accel Business SMB onboarding (YTL Hackathon 2026, Track A)

Digital-first discovery → quote → Smart KYC → tracker for small businesses.
**The LLM talks; deterministic services decide.** Every product choice and KYC verdict comes from
pure, unit-tested TypeScript in `src/domain`.

## Run

```bash
npm install
npm test          # 44 tests: 15 advisor scenarios, cart rules, 2,000-profile fuzz, K01–K12 answer key
npm run typecheck
npm run dev       # http://localhost:3000
npx tsx scripts/kyc-report.ts   # print the K01–K12 verdict board
```

## What's built (steps 1–2 of the plan)

| Area | File | What it guarantees |
| --- | --- | --- |
| Catalogue rules | `src/domain/catalogue/eligibility.ts` | city tier, min staff, min sites, active GSTIN, `requires_one_of` |
| Bundle builder | `src/domain/catalogue/bundle-builder.ts` | picks base + add-ons, records every blocked item with a plain reason |
| Quote / cart | `src/domain/catalogue/quote.ts` | add-on toggles re-checked server-side; removing a base cascades |
| GSTIN | `src/domain/kyc/gstin.ts` | slot-by-slot format check + GSTN check digit; never auto-corrects |
| KYC decision | `src/domain/kyc/checks.ts` | blur/skew pre-flight, registry status, names, signatory, 90-day bill rule, Udyam auto-fetch |
| Registry | `src/adapters/registry/csv-registry.ts` | `IRegistryService` over the mock CSVs (swap for GSTN/DigiLocker later) |

API: `POST /api/recommend`, `POST /api/kyc/verify`, `GET /api/registry/gstin/:gstin`.

## KYC verdicts (tests/kyc.answer-key.test.ts)

| | Verdict | Reason |
| --- | --- | --- |
| K01 | REJECT | GSTIN Cancelled in registry; Udyam cert has no number |
| K02 | REJECT | deskewed 8°, then digit `0` in PAN letter slot |
| K03 | PASS | Udyam date differs from registry → shown, registry value used |
| K04 | NEEDS_REUPLOAD | GST certificate blurred (sharpness 1) |
| K05 | PASS (warn) | Udyam auto-fetched; LLP signatory needs e-signed authorisation |
| K06 | REJECT | GSTIN check digit fails (digits altered) |
| K07 | MANUAL_REVIEW | legal name doesn't match registry |
| K08 | REJECT | digit `0` in PAN letter slot |
| K09 | PASS | |
| K10 | PASS (warn) | LLP signatory authorisation |
| K11 | REJECT | electricity bill 257 days old |
| K12 | PASS | |

"Today" is fixed at 2026-07-15 per the dataset README.

## Next

3. Advisor chat (LLM extracts `BusinessProfile`, explains the computed bundle) → quote UI
4. KYC upload: real extraction (Tesseract + vision model) feeding `runKycChecks`, consent screen
5. Order tracker · 6. Partner rescue queue + propensity · 7. Hindi/voice, ops dashboard
