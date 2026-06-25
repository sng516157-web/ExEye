# ExEye

AI-assisted external vision for Even Realities G2 — collar camera → vision API → summary on the lenses.

**Tap** temple/ring to speak a prompt · **Analyse** sends your prompt to AI · Visual questions also use the camera frame · Results appear on the G2 display.

## Quick start (G2 hardware)

Phone, PC, and camera must be on the **same Wi‑Fi**.

```bash
# One terminal — frontend + API (auto-restart on server changes)
npm install
cd server && cp .env.example .env && npm install && cd ..
npm run dev:stack:device

# Second terminal — sideload QR (auto-detects your PC's LAN IP)
npm run qr:device
```

Scan the QR in the Even app. Dev API calls use the Vite proxy on the same host as the QR URL — no hardcoded LAN IP.

**Split terminals** (optional): `npm run dev:device` + `npm run dev:api`

### Wi‑Fi changed?

1. Restart `npm run dev:stack:device` if needed
2. `npm run qr:device` — scan the **new** QR

No `.env` edits. If you use an ESP32 camera, re-enter its IP on the new network (phone UI → **Laptop webcam (dev)** until ESP32 is ready, or **Find ESP32** / manual IP).

## Even Hub workflow

| Step | Command |
|------|---------|
| 1. Dev stack | `npm run dev:stack:device` |
| 2. Simulator | `npm run simulator` (after `npm run dev`) |
| 3. G2 hardware | `npm run qr:device` → scan in Even app |
| 4. Package | `npm run pack` → `dist/exeye.ehpk` |
| 5. Submit | Upload via [Even Hub portal](https://hub.evenrealities.com/) |

Full guide: **[docs/EVEN_HUB_WORKFLOW.md](docs/EVEN_HUB_WORKFLOW.md)**  
Cloud deploy: **[docs/DEPLOY_CLOUDFLARE.md](docs/DEPLOY_CLOUDFLARE.md)** · **[docs/DEPLOY_SERVER.md](docs/DEPLOY_SERVER.md)**

## Architecture

```
[Camera] ──(visual prompts only)──→ VisionClient.analyseFrame ──┐
[G2 mic] → SpeechClient → transcribe ─────────────────────────────┼→ DisplayAdapter → G2 lenses
Text prompts ──────────────────→ VisionClient.analysePrompt ──────┘
                                         ↑
                          PC server (dev) / cloud API (prod)
```

- **G2 path:** `EvenG2DisplayAdapter` + Even Hub SDK (temple tap → voice prompt)
- **Debug:** `BrowserDisplayAdapter` when the bridge is unavailable
- **Dev proxy:** Phone loads `http://<PC-IP>:5173`; Vite forwards `/analyse-frame`, `/analyse-prompt`, `/transcribe-prompt`, `/camera/*` to `:3000`

## Features

| Feature | Notes |
|---------|--------|
| Voice prompts | G2 mic → server STT (Groq Whisper, Gemini fallback) |
| Typed prompts | Phone UI + **Analyse** button |
| Smart camera use | Camera only for visual prompts (“what do you see”, signs, obstacles); other prompts go to text AI without capture |
| Vision | Groq Llama 4 Scout + image (`/analyse-frame`); Gemini fallback |
| Text AI | Groq Llama 3.3 70B (`/analyse-prompt`); Gemini fallback |
| ESP32 camera | Phone UI: **Laptop webcam (dev)**, manual IP, **Find ESP32**, test; firmware in [`esp32/`](esp32/) |
| Dev webcam | `GET /camera/snapshot` via ffmpeg when no ESP32 |
| Viewfinder | Single frame on analyse (no live stream) |

## Scripts

| Script | Use |
|--------|-----|
| `npm run dev:stack:device` | **Recommended** — Vite (HTTP) + API with auto-restart |
| `npm run dev:stack` | Vite (HTTPS) + API — simulator |
| `npm run dev:device` | Vite only — HTTP sideload |
| `npm run dev:api` | Vision/speech server only (watches `server/**/*.ts` + `.env`) |
| `npm run dev` | HTTPS — simulator / desktop |
| `npm run qr:device` | QR code with **live** LAN IP detection |
| `npm run simulator` | EvenHub simulator (HTTPS dev) |
| `npm run build` | Typecheck + `dist/` |
| `npm run pack` | Build + `.ehpk` for Even Hub |
| `npm run whitelist:sync` | Add production API origin to `app.json` |

## Configuration

### Frontend (`.env.development.local`)

Optional. Defaults are Wi‑Fi resilient:

| Variable | Dev default | Purpose |
|----------|-------------|---------|
| `VITE_CAMERA_MODE` | `http` | `mock` \| `webcam` \| `http` |
| `VITE_VISION_ENDPOINT` | `/analyse-frame` | Image + prompt → vision AI |
| `VITE_TEXT_PROMPT_ENDPOINT` | `/analyse-prompt` | Text-only prompts (no camera) |
| `VITE_SPEECH_ENDPOINT` | `/transcribe-prompt` | G2 mic transcription |
| `VITE_HTTP_CAMERA_URL` | `/camera/snapshot` | Dev PC webcam stand-in |

Set full `http://…` URLs only for custom setups.

### Backend (`server/.env`)

See `server/.env.example`. Typical dev setup:

```env
VISION_PROVIDER=groq
GROQ_API_KEY=...
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_STT_MODEL=whisper-large-v3-turbo
GEMINI_API_KEY=...   # optional fallback for vision, speech, and text
```

Speech STT auto-falls back Groq → Gemini → OpenAI when keys are set. Requires **ffmpeg** on PATH for dev webcam (`winget install Gyan.FFmpeg`).

## ESP32 collar camera

Firmware for **Seeed XIAO ESP32S3 Sense** lives in [`esp32/`](esp32/). Based on the Arduino CameraWebServer example — serves `GET /capture` for ExEye.

1. Copy `esp32/exeye_cam.ino` into the CameraWebServer sketch folder (keep `app_httpd.cpp`)
2. Set Wi‑Fi credentials, enable **OPI PSRAM**, upload
3. In ExEye phone UI: **Find ESP32** or enter `http://<esp32-ip>/capture`

Until the ESP32 is ready, tap **Laptop webcam (dev)** in the phone UI.

Details: **[esp32/README.md](esp32/README.md)**

## Camera notes

- **G2 + iPhone:** use `http` camera mode — `webcam` / `getUserMedia` is blocked in the Even WebView
- **Dev:** defaults to laptop webcam at `/camera/snapshot`; stored ESP32 URLs are ignored until you save one explicitly
- **ESP32:** same LAN as phone; server `/camera/discover` scans for devices
- **Production:** host vision API on HTTPS; update `app.json` whitelist + `.env.production.local`

## API (dev server `:3000`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Provider status |
| `/analyse-frame` | POST | Image + prompt → vision summary |
| `/analyse-prompt` | POST | JSON `{ "prompt" }` → text summary (no camera) |
| `/transcribe-prompt` | POST | Audio → transcript |
| `/camera/snapshot` | GET | Dev PC webcam JPEG |
| `/camera/discover` | GET | LAN scan for ESP32 |
| `/camera/proxy` | GET | Cross-origin camera fetch |

## Debugging

- `window.exeye` in the phone WebView inspector
- Server health: `http://localhost:3000/health`
- `dev:stack:device` prints the sideload URL on startup
