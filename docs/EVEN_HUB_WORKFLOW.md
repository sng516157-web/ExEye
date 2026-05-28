# ExEye × Even Hub workflow

This project follows the [Even Hub development process](https://hub.evenrealities.com/docs/getting-started/overview):

```
1. Write code      →  Vite + @evenrealities/even_hub_sdk
2. Preview locally →  evenhub-simulator
3. Test on device  →  evenhub qr (sideload)
4. Package         →  evenhub pack → .ehpk
5. Submit          →  Even Hub developer portal
```

## Phase 1 — Local development

### Install

```bash
npm install
cd server && npm install && cd ..
cp .env.development.example .env.development.local
# Edit .env.development.local — set VITE_DEV_HOST to your Mac LAN IP
```

### Vision backend (separate terminal)

```bash
cd server
npm run dev
```

### Frontend

| Goal | Command | URL |
|------|---------|-----|
| Simulator / desktop | `npm run dev` | `https://localhost:5173` |
| **Real G2 hardware** | `npm run dev:device` | `http://YOUR_MAC_IP:5173` |

Use **HTTP** (`dev:device`) for phone sideload — HTTPS self-signed certs often hang in the Even app WebView.

## Phase 2 — Simulator

With `npm run dev` running:

```bash
npm run simulator
# or HTTP parity with hardware:
npm run simulator:device   # requires npm run dev:device
```

## Phase 3 — Hardware (G2 + phone)

1. G2 paired in **Even Realities** app  
2. Phone + Mac on **same Wi‑Fi**  
3. `npm run dev:device` + `cd server && npm run dev`  
4. Generate QR:

```bash
npm run qr:device
```

5. Scan in the Even app (prototype / sideload flow)  
6. **Tap** temple/ring → analyse · **Double tap** → exit  

During sideload, `app.json` network whitelist is **not enforced** ([Networking guide](https://hub.evenrealities.com/docs/guides/networking)).

## Phase 4 — Package (.ehpk)

Production builds need:

- Hosted **HTTPS** vision API (not your Mac IP)
- `app.json` **network.whitelist** includes your API origin
- CORS headers on the API ([Networking](https://hub.evenrealities.com/docs/guides/networking))

```bash
cp .env.production.example .env.production.local
# Set VITE_VISION_ENDPOINT=https://api.yourdomain.com/analyse-frame

npm run whitelist:sync   # optional: add API origin to app.json from .env.production.local
npm run pack
# → dist/exeye.ehpk
```

`whitelist:sync` reads `VITE_VISION_ENDPOINT` from `.env.production.local` and adds its origin to `app.json` (review before commit).

## Phase 5 — Submit

Upload `dist/exeye.ehpk` via the [Even Hub developer portal](https://hub.evenrealities.com/).

Before submit, verify:

- [ ] `entrypoint` is `index.html` inside `dist/`
- [ ] Every `fetch()` domain is in `app.json` whitelist (HTTPS in production)
- [ ] Vision API returns CORS headers
- [ ] `min_sdk_version` matches SDK (`0.0.10`)

## Config files

| File | Purpose |
|------|---------|
| `app.json` | Even Hub manifest (pack / distribution) |
| `.env.development.local` | LAN IP, camera URL, dev vision endpoint (gitignored) |
| `.env.production.local` | Hosted API URL for `npm run build` (gitignored) |
| `src/config.ts` | Reads `VITE_*` env vars |

## Official references

- [First app](https://hub.evenrealities.com/docs/getting-started/first-app)
- [Packaging](https://hub.evenrealities.com/docs/reference/packaging)
- [Networking & whitelist](https://hub.evenrealities.com/docs/guides/networking)
- [CLI](https://hub.evenrealities.com/docs/reference/cli)
