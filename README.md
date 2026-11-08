# Udyam Digital

A small business gets connected in one sitting, not 17 days.
Built by **CyberNomads_NITRAIPUR** (Singh Ankitkumar Ishwardayal, Sankalp Mittal) for Airtel SYNC Hackathon 2026, Enterprise Track A, for the fictional operator **Accel Business**.

**Try it:** [udyam-digital-lilac.vercel.app](https://udyam-digital-lilac.vercel.app)

| Who | Where | Sign-in |
| --- | --- | --- |
| Business owner (web) | `/` → "Start as a customer" | none |
| Business owner (WhatsApp) | scan the QR below, send the join text, then **Hi** · or open `/whatsapp` in a browser | none |
| Channel partner | `/login?role=partner` | Sharma Telecom (Nagpur), PIN **1234** |
| Accel operations | `/login?role=admin` | **ADMIN**, PIN **9999** |
| Judges' rule tester | `/judge` → Run all 15 | none |

<p>
  <img src="docs/live-qr.png" width="140" alt="QR code: live app" />
  &nbsp;&nbsp;
  <img src="docs/whatsapp-qr.png" width="140" alt="QR code: WhatsApp chat (send join own-spell to +1 415 523 8886)" />
</p>

Left: live app. Right: WhatsApp (sandbox number +1 415 523 8886, join text `join own-spell`, lasts 72 hours per phone).

## What the owner gets

1. **Advisor**, on the web or WhatsApp, in 9 languages (English, Hindi, Hinglish, Marathi, Gujarati, Kannada, Telugu, Tamil, Bengali). Six questions (type, size, city, GSTIN, what they use today, needs), answered by tapping, typing or voice.
2. **Quote**: one monthly price built by catalogue rules, never by the AI; add-ons to switch on and off; anything not offered says why.
3. **Smart KYC**: consent per purpose, photo pre-checks (blur, tilt), reading of 4 documents, live GSTIN/Udyam registry checks, verdict in seconds, results in the owner's language. Unclear cases go to a person.
4. **E-sign** with a one-time code (mock), then the order.
5. **Tracker**: operations post each step and any delay; the owner sees it on the page and in WhatsApp. Data download and deletion requests from the order page.

Behind it: a **partner panel** (own city's drop-outs ranked by a win-back model, WhatsApp "talk to a person" chats) and an **operations panel** (agent review queue, orders to fulfil, the 5 case metrics with targets, WhatsApp funnel, tamper-evident audit log).

## How it maps to the case

| Case asks for | Where |
| --- | --- |
| Advisor: type, size, locations, current tools; explains why | `src/domain/advisor`, `src/server/advisor-service.ts` |
| Chat or voice, Hindi and regional languages | `src/i18n/packs`, `src/app/advisor/voice.ts` (Whisper speech-to-text) |
| Transparent monthly price, toggles | `src/domain/catalogue`, `src/app/advisor/QuoteLedger.tsx` |
| Smart KYC with mocked GSTIN/Udyam lookups and consent | `src/domain/kyc`, `src/server/kyc-service.ts`, `src/adapters/vision` |
| Order status instead of calling support | `src/domain/orders/tracker.ts`, `/admin` order updates |
| Stretch: voice or WhatsApp front end | `src/server/whatsapp` (Twilio sandbox, Meta Cloud API, in-app preview) |
| Stretch: back office for leads not closed; propensity score | `/partner`, `scripts/train-propensity.py` (AUC 0.71) |
| DPDP: consent, purpose limitation, minimisation | consent notice, masking, images never stored, withdrawal blocks every step |

**Design rule: the AI talks, rules decide.** The language model only extracts facts and writes explanations. Eligibility, prices, KYC verdicts and order totals come from deterministic, tested code, so a prompt can't unlock a product or change a price. Every AI step has an offline fallback.

## KYC answer key (all 12 sample applicants)

| | Verdict | Why |
| --- | --- | --- |
| K01 | Reject | GSTIN cancelled in the registry |
| K02 | Reject | Photo straightened 7°, then a digit in a PAN letter position |
| K03 | Pass | Udyam details differ from the registry; registry values used |
| K04 | Re-upload | GST certificate too blurry to read |
| K05 | Pass, one step left | LLP signatory: authorisation e-signed at checkout |
| K06 | Reject | GSTIN check digit fails (altered) |
| K07 | Agent review | Legal name doesn't match the registry |
| K08 | Reject | Digit `0` in a PAN letter position |
| K09 | Pass | |
| K10 | Pass, one step left | LLP signatory authorisation |
| K11 | Reject | Electricity bill 257 days old |
| K12 | Pass | |

"Today" is fixed at 2026-07-15, as the dataset README says.

## Run it locally

```bash
npm install
cp .env.example .env.local   # all keys optional: without them the app uses its built-in parser and offline OCR
npm run dev                  # http://localhost:3000
npm test                     # 148 tests, incl. K01–K12 on the real images (~60 s)
npm run typecheck && npm run lint
```

Optional keys (`.env.example`): `GEMINI_API_KEY`, `GROQ_API_KEY`, `ORDER_SECRET`, Upstash (`KV_REST_API_URL`/`KV_REST_API_TOKEN`, any Vercel prefix works), Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SANDBOX_JOIN`). Deployment steps: [DEPLOY.md](DEPLOY.md).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · zod · Vercel (Mumbai) · Upstash Redis · Gemini → Groq → offline parser · Whisper on Groq · sharp + tesseract.js · Twilio / Meta WhatsApp · Vitest.

## Who updates what

| Event | Demo | Production |
| --- | --- | --- |
| Documents verified | KYC rules (instant) or an agent in `/admin` | same |
| Dispatched / technician / installed / live | operations in `/admin` | warehouse, field-force app, network activation call the same API |
| Delay | operations in `/admin`, with a reason | field-force app |
| WhatsApp updates | pushed in the chat within WhatsApp's 24-hour window | Accel's own number with approved templates |
| Consent withdrawn | owner on `/kyc` → blocks KYC, e-sign and order | same |

All businesses, people and identifiers are synthetic (case data pack). Accel Telecom is the fictional operator from the case.
