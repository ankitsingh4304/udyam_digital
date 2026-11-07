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

Notes
- Every push to `main` redeploys automatically.
- Serverless instances share no memory: orders, consent and KYC results travel as signed tokens,
  so any instance can verify them. The audit log is per instance (/tmp) on Vercel; production would use Postgres.
- `data/extract-cache.json` (committed) holds AI reads of the sample documents, so the demo spends no API quota.
