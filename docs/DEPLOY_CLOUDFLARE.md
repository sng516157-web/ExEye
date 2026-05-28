# Deploy ExEye vision backend on Cloudflare Workers (no sleep)

Cloudflare Workers is a good fit for ExEye because it does not use the sleep/wake model of free web services like Render.

This keeps `GET /health` and `POST /analyse-frame` available with low latency for G2 usage.

---

## 1) One-time setup

Install dependencies:

```bash
cd cloudflare-worker
npm install
```

Login to Cloudflare:

```bash
npx wrangler login
```

---

## 2) Configure env vars and secret

`wrangler.toml` already has safe defaults:

- `VISION_PROVIDER=gemini`
- `GEMINI_MODEL=gemini-2.5-flash`
- `MOCK_ON_AI_ERROR=0`

Set your Gemini key as a Worker secret:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Paste the key from Google AI Studio when prompted.

---

## 3) Deploy

```bash
npm run deploy
```

Wrangler prints the Worker URL, usually:

`https://exeye-vision.<your-subdomain>.workers.dev`

---

## 4) Verify

Health check:

```bash
curl https://YOUR-WORKER-URL.workers.dev/health
```

Expected:

```json
{"ok":true,"vision":"gemini","model":"gemini-2.5-flash","macCamera":null}
```

If `vision` is `mock`, verify `GEMINI_API_KEY` secret exists and redeploy.

---

## 5) Point ExEye app to Cloudflare URL

In project root:

```bash
cp .env.production.example .env.production.local
```

Edit `.env.production.local`:

```env
VITE_VISION_ENDPOINT=https://YOUR-WORKER-URL.workers.dev/analyse-frame
VITE_CAMERA_MODE=http
VITE_HTTP_CAMERA_URL=http://192.168.4.1/capture
```

Then build and package:

```bash
npm run build
npm run whitelist:sync
npm run pack
```

---

## 6) Even Hub whitelist

Make sure `app.json` whitelist includes your Worker origin:

```json
"whitelist": [
  "https://YOUR-WORKER-URL.workers.dev"
]
```

`npm run whitelist:sync` can automate this from your env file.

---

## Notes

- `/camera/snapshot` is intentionally not implemented on Workers (that route is Mac-only local dev).
- Cloudflare free usage still has limits, but no idle sleep delay like Render free web services.
- If you need a custom domain later, map one in Cloudflare dashboard and keep the same path `/analyse-frame`.
