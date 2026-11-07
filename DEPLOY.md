# Deploy to Vercel (free)

1. vercel.com → sign in with GitHub → **Add New… → Project** → import the repo.
2. Framework: Next.js (auto). Root directory: the folder with `package.json`.
3. **Environment variables** (Settings → Environment Variables, all environments):
   - `GEMINI_API_KEY` — your key
   - `GROQ_API_KEY` — your key
   - `ORDER_SECRET` — a long random string (e.g. output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
4. **Deploy.** Region is pinned to Mumbai (`bom1`) in `vercel.json`.
5. Check `https://<your-app>.vercel.app/api/health`:
   `catalogue: 25`, `gstinRecords: 3534`, `llmProviders: ["gemini","groq"]`, `orderSecretSet: true`.

6. **Shared storage (2 minutes, free) — needed for the operations features on Vercel.**
   Vercel project → **Storage** → **Create Database** → **Upstash for Redis** (Marketplace, free plan) →
   region Mumbai if offered → **Connect** to this project (all environments). This adds
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Then **Deployments → ⋯ → Redeploy**.
   The operations panel's yellow "Shared storage is not connected" note disappears when it works.

Notes
- Every push to `main` redeploys automatically.
- Orders, consent and KYC results travel as signed tokens, so any server instance can verify them.
- What needs shared storage (Upstash): the audit log, consent withdrawals, the verification queue,
  order status updates from operations, partner lead claims and data-deletion requests.
  Without it each serverless instance keeps its own copy, so an update made on one may not show on another.
- `data/extract-cache.json` (committed) holds AI reads of the sample documents, so the demo spends no API quota.
