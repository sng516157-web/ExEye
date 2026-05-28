# Host the ExEye vision server (free tier)

The G2 app (`.ehpk`) calls **your** HTTPS API. This guide uses [Render](https://render.com) free tier — no credit card for the starter web service.

**Free tier caveats:** service sleeps after ~15 min idle; first request after sleep can take 30–60s. Fine for personal / demo use.

Alternatives with free tiers: [Fly.io](https://fly.io), [Google Cloud Run](https://cloud.google.com/run).

---

## Step 1 — Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. Keep it secret (only on the server, never in the frontend)

---

## Step 2 — Deploy on Render

1. Push your repo to GitHub (already done: `sng516157-web/ExEye`)
2. Sign up at [render.com](https://render.com) → **New +** → **Web Service**
3. Connect **ExEye** repository
4. Settings:

| Field | Value |
|-------|--------|
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance type** | Free |

5. **Environment variables** (Environment tab):

| Key | Value |
|-----|--------|
| `VISION_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | your key |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

6. Create Web Service → wait for deploy
7. Copy your URL, e.g. `https://exeye-vision.onrender.com`

### Test

```bash
curl https://YOUR-SERVICE.onrender.com/health
```

Expect: `"vision":"gemini"`

---

## Step 3 — Point the G2 app at the hosted API

```bash
cd /path/to/ExEye
cp .env.production.example .env.production.local
```

Edit `.env.production.local`:

```env
VITE_VISION_ENDPOINT=https://YOUR-SERVICE.onrender.com/analyse-frame
VITE_CAMERA_MODE=http
VITE_HTTP_CAMERA_URL=http://192.168.4.1/capture
```

(`httpCameraUrl` is per-user / ESP32 — not your Render URL.)

Build and pack:

```bash
npm run build
```

Edit `app.json` — add your Render origin to whitelist:

```json
"whitelist": [
  "https://YOUR-SERVICE.onrender.com"
]
```

Or:

```bash
npm run whitelist:sync
npm run pack
```

Upload `dist/exeye.ehpk` to the Even Hub developer portal.

---

## What does **not** run on Render

- **`/camera/snapshot`** (Mac webcam) — needs `ffmpeg` on your Mac; use only in local dev
- **ESP32 camera** — stays on the user’s Wi‑Fi; phone fetches it directly

---

## Local dev vs production

| | Local | Production |
|--|--------|------------|
| Vision API | `http://MAC_IP:3000` | `https://….onrender.com` |
| App | `npm run qr:device` | `.ehpk` on Even Hub |
| Gemini key | `server/.env` | Render env vars |
