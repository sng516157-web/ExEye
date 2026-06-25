#!/usr/bin/env node
import { detectLanIp } from "./lan-ip.mjs";

const ip = detectLanIp();
const port = process.env.VITE_PORT ?? "5173";

console.log("");
console.log(`[ExEye] Phone / G2 sideload URL: http://${ip}:${port}`);
console.log("[ExEye] API calls use same host (Vite proxy) — Wi‑Fi IP changes only need a new QR.");
console.log("[ExEye] Run both dev servers (auto-restart on save): npm run dev:stack:device");
console.log(`[ExEye] QR code: npm run qr:device`);
console.log("");
