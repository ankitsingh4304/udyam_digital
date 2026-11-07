# Udyam Digital — Accel Business SMB onboarding (YTL Hackathon 2026, Track A)

Digital-first discovery → quote → Smart KYC → tracker for small businesses.
**The LLM talks; deterministic services decide.** Every product choice and KYC verdict comes from
pure, unit-tested TypeScript in `src/domain`.

## Run

```bash
npm install
npm test          # 83 tests incl. K01–K12 end to end on the real images (~40 s)
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

## Advisor (step 3)

Open http://localhost:3000 → chat in English, हिंदी or Hinglish (voice input in Chrome/Edge) → live quote with add-on toggles.

- `src/adapters/llm` — Gemini first, Groq as fallback, with rate-limit cooldown. No keys? It runs on the built-in parser.
- `src/domain/advisor` — question flow (max 5), offline English/Hindi/Hinglish parser, explanation guard
  (an LLM explanation that mentions a product or ₹ amount we didn't compute is discarded).
- `src/server/advisor-service.ts` — one turn: extract → GSTIN registry check → next question or bundle.
- API: `POST /api/advisor`, `POST /api/quote`.

Keys: copy `.env.example` to `.env.local` and fill `GEMINI_API_KEY`, `GROQ_API_KEY`.

## Smart KYC (step 4)

`/kyc`: DPDP consent (itemised purposes, nothing pre-ticked) → upload 4 documents or pick a sample applicant K01–K12 →
verdict with a check-by-check card per document.

- `src/adapters/vision/image-quality.ts` — blur score (Laplacian variance) and skew angle (projection profile); auto-straighten up to 15°.
- `src/adapters/vision/extract.ts` — cache (by image SHA-256) → Gemini vision → Tesseract offline. No API keys? Still 12/12.
- Second reader on the GSTIN: a digit Tesseract sees in a letter position beats an AI "correction" (K08 stays caught).
- `src/server/audit-log.ts` — append-only, hash-chained log of consent and KYC events (no personal data). `GET /api/audit` verifies the chain.
- Images are never written to disk; responses carry masked identifiers.

```bash
npx tsx scripts/kyc-check-all.ts        # all 12 applicants through the real pipeline (fills the AI read cache)
npx tsx scripts/kyc-check-all.ts --ocr  # offline reader only
```

## Tracker, judges, partners (steps 5–7)

- `/` — role chooser: customer (no sign-in) → `/business`, partner, operations, judges. One link to share.
- `/track/[token]` — order status. Until operations touch the order it follows the catalogue install days at demo speed
  (1 day = 1 minute); once operations post an update (dispatched, technician, installed, live, or a delay with reason)
  it follows those updates only. Owner can download their data or ask for deletion here.
- `/admin` (ADMIN / 9999) — work queues: **verification queue** (KYC cases needing a person, e.g. K07; the owner's
  screen continues as soon as the agent approves) and **orders to fulfil** (move to next step, report a delay);
  then the 5 KPIs, guardrails, live funnel, hash-chained audit log, data-deletion requests.
- `/partner` (PIN 1234) — city-scoped rescue queue; "Take this lead" is saved, so others see it is taken.
- `/judge` — any business profile → bundle, refusals with rule codes, rule trace; 15 one-click scenario checks.
- `/partner` — rescue queue of 4,632 dropped leads with the action per drop reason, likelihood to buy
  (logistic regression, AUC 0.71, `scripts/train-propensity.py` → `src/domain/leads/propensity-model.json`).
- Production: rate limits, CSP/HSTS headers, `/api/health`, Vercel config (Mumbai region). See `DEPLOY.md`.

## Who updates what

| Event | Demo | Production |
|---|---|---|
| Documents verified | KYC rules (instant) or agent in `/admin` | same |
| Dispatched / technician / installed / live | operations in `/admin` | warehouse, field-force app, network activation call the same API |
| Delay | operations in `/admin`, with reason | field-force app |
| Consent withdrawn | owner on `/kyc` → blocks KYC, e-sign and order | same |

## Next

3. ~~Advisor chat (LLM extracts `BusinessProfile`, explains the computed bundle) → quote UI~~ done
4. ~~KYC upload, real extraction, consent screen~~ done
5. Order tracker · 6. Partner rescue queue + propensity · 7. Hindi/voice, ops dashboard
