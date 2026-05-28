# ExEye

AI-assisted external vision for Even Realities G2 — collar camera → vision API → summary on the lenses.

## Even Hub workflow (quick)

Aligned with [Even Hub docs](https://hub.evenrealities.com/docs/getting-started/overview):

| Step | Command |
|------|---------|
| 1. Dev server | `npm run dev:device` + `cd server && npm run dev` |
| 2. Simulator | `npm run simulator` (after `npm run dev`) |
| 3. G2 hardware | `npm run qr:device` → scan in Even app |
| 4. Package | `npm run pack` → `dist/exeye.ehpk` |
| 5. Submit | Upload via Even Hub portal |

Full guide: **[docs/EVEN_HUB_WORKFLOW.md](docs/EVEN_HUB_WORKFLOW.md)**

## First-time setup

```bash
npm install
cd server && npm install && cd ..

cp .env.development.example .env.development.local
# Edit .env.development.local — set VITE_DEV_HOST to your Mac LAN IP (ipconfig getifaddr en0)
```

## Architecture

```
[Camera] → CameraSource → VisionClient → DisplayAdapter → G2 lenses
                              ↑
                    Mac server (dev) / cloud API (prod)
```

- **Production path:** `EvenG2DisplayAdapter` + Even Hub SDK  
- **Debug fallback:** `BrowserDisplayAdapter` (no bridge)  
- **Manifest:** `app.json` for `evenhub pack`

## Scripts

| Script | Use |
|--------|-----|
| `npm run dev` | HTTPS — simulator / desktop |
| `npm run dev:device` | HTTP — **real G2 sideload** |
| `npm run simulator` | EvenHub simulator (HTTPS dev) |
| `npm run simulator:device` | Simulator with HTTP dev server |
| `npm run qr:device` | QR code for hardware sideload |
| `npm run build` | Typecheck + `dist/` |
| `npm run pack` | Build + whitelist sync + `.ehpk` |
| `npm run evenhub:init` | Regenerate `app.json` template |

## Configuration

Environment variables (see `.env.development.example`):

- `VITE_DEV_HOST` — Mac LAN IP for phone/G2  
- `VITE_VISION_ENDPOINT` — e.g. `http://MAC_IP:3000/analyse-frame`  
- `VITE_CAMERA_MODE` — `mock` \| `webcam` \| `http`  
- `VITE_HTTP_CAMERA_URL` — ESP32-CAM or `http://MAC_IP:3000/camera/snapshot`  

`src/config.ts` reads these at build time.

## Vision backend

```bash
cd server
cp .env.example .env   # Gemini / Ollama / mock — see server/.env.example
npm run dev
```

## Camera notes

- **G2 + iPhone:** use `http` camera mode (not `webcam` — blocked in Even WebView).  
- **ESP32-CAM:** join home Wi‑Fi; phone and camera on same LAN.  
- **Distributed app:** host vision API on HTTPS; update `app.json` whitelist + `.env.production.local`.

## Debugging

- `window.exeye` in WebView inspector  
- Display `init()` runs once in `ExEyeApp.start()` only
