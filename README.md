# ExEye

AI-assisted external vision for Even Realities G2 — collar camera → vision API → summary on the lenses.

**Tap** temple/ring to speak a prompt · **Analyse** runs vision on the camera frame · Results appear on the G2 display.

## Quick start (G2 hardware)

Phone, PC, and camera must be on the **same Wi‑Fi**.

```bash
# Terminal 1 — vision + speech backend
cd server && cp .env.example .env && npm install && npm run dev

# Terminal 2 — frontend (from repo root)
npm install
cp .env.development.example .env.development.local   # optional; defaults work
npm run dev:device

# Terminal 3 — sideload QR (auto-detects your PC's LAN IP)
npm run qr:device
```

Scan the QR in the Even app. No hardcoded LAN IP in `.env` — dev API calls use the Vite proxy on the same host as the QR URL.

### Wi‑Fi changed?

1. `npm run dev:device` (restart if already running)
2. `npm run qr:device` — scan the **new** QR

No `.env` edits. If you use an ESP32 camera, re-enter its IP on the new network (phone UI → **Find camera** or manual IP).

## Even Hub workflow

| Step | Command |
|------|---------|
| 1. Dev servers | `npm run dev:device` + `cd server && npm run dev` |
| 2. Simulator | `npm run simulator` (after `npm run dev`) |
| 3. G2 hardware | `npm run qr:device` → scan in Even app |
| 4. Package | `npm run pack` → `dist/exeye.ehpk` |
| 5. Submit | Upload via [Even Hub portal](https://hub.evenrealities.com/) |

Full guide: **[docs/EVEN_HUB_WORKFLOW.md](docs/EVEN_HUB_WORKFLOW.md)**  
Cloud deploy: **[docs/DEPLOY_CLOUDFLARE.md](docs/DEPLOY_CLOUDFLARE.md)** · **[docs/DEPLOY_SERVER.md](docs/DEPLOY_SERVER.md)**

## Architecture

```
[Camera] → CameraSource → VisionClient ─┐
[G2 mic] → SpeechClient → transcribe ───┼→ DisplayAdapter → G2 lenses
                                         ↑
                          PC server (dev) / cloud API (prod)
```

- **G2 path:** `EvenG2DisplayAdapter` + Even Hub SDK (temple tap → voice prompt)
- **Debug:** `BrowserDisplayAdapter` when the bridge is unavailable
- **Dev proxy:** Phone loads `http://<PC-IP>:5173`; Vite forwards `/analyse-frame`, `/transcribe-prompt`, `/camera/*` to `:3000`

## Features

| Feature | Notes |
|---------|--------|
| Voice prompts | G2 mic → server STT (Groq Whisper) → vision |
| Typed prompts | Phone UI + **Analyse** button |
| Vision | Groq Llama 4 Scout (Gemini fallback) — configure in `server/.env` |
| ESP32 camera | Phone UI: manual IP, **Find camera**, test; firmware in [`esp32/`](esp32/) |
| Dev webcam | `GET /camera/snapshot` via ffmpeg when no ESP32 |

## Scripts

| Script | Use |
|--------|-----|
| `npm run dev` | HTTPS — simulator / desktop |
| `npm run dev:device` | HTTP — **real G2 sideload** (prints LAN URL) |
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
| `VITE_VISION_ENDPOINT` | `/analyse-frame` | Vite → server proxy |
| `VITE_SPEECH_ENDPOINT` | `/transcribe-prompt` | Vite → server proxy |
| `VITE_HTTP_CAMERA_URL` | `/camera/snapshot` | Dev PC webcam stand-in |

Set full `http://…` URLs only for custom setups.

### Backend (`server/.env`)

See `server/.env.example`. Typical dev setup:

```env
VISION_PROVIDER=groq
GROQ_API_KEY=...
SPEECH_PROVIDER=groq
GEMINI_API_KEY=...   # optional fallback for vision
```

## ESP32 collar camera

Firmware for **Seeed XIAO ESP32S3 Sense** lives in [`esp32/`](esp32/). Based on the Arduino CameraWebServer example — serves `GET /capture` for ExEye.

1. Copy `esp32/exeye_cam.ino` into the CameraWebServer sketch folder (keep `app_httpd.cpp`)
2. Set Wi‑Fi credentials, enable **OPI PSRAM**, upload
3. In ExEye phone UI: **Find camera** or enter `http://<esp32-ip>/capture`

Details: **[esp32/README.md](esp32/README.md)**

## Camera notes

- **G2 + iPhone:** use `http` camera mode — `webcam` / `getUserMedia` is blocked in the Even WebView
- **ESP32:** same LAN as phone; server `/camera/discover` scans for devices
- **Production:** host vision API on HTTPS; update `app.json` whitelist + `.env.production.local`

## Debugging

- `window.exeye` in the phone WebView inspector
- Server health: `http://localhost:3000/health`
- `dev:device` prints the sideload URL on startup
