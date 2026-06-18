#!/usr/bin/env node
/**
 * Run evenhub qr for the current Vite dev server (Even Hub hardware sideload).
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.VITE_PORT ?? "5173";
const useHttp = process.argv.includes("--http");

function isRfc1918(ip) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function readDevHostFromEnv() {
  const envPath = resolve(root, ".env.development.local");
  try {
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^VITE_DEV_HOST=(.+)$/m);
    if (!match) return null;
    const host = match[1].trim();
    if (!host || host === "YOUR_MAC_LAN_IP") return null;
    return host;
  } catch {
    return null;
  }
}

function detectLanIp() {
  const fromEnv = process.env.VITE_DEV_HOST?.trim() || readDevHostFromEnv();
  if (fromEnv) return fromEnv;

  const nets = os.networkInterfaces();
  const preferred = [];
  const fallback = [];

  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      const family = iface.family;
      if (family !== "IPv4" && family !== 4) continue;
      if (iface.internal) continue;

      const ip = iface.address;
      if (ip.startsWith("169.254.")) continue;

      if (isRfc1918(ip)) preferred.push(ip);
      else fallback.push(ip);
    }
  }

  return preferred[0] ?? fallback[0] ?? "127.0.0.1";
}

const ip = detectLanIp();
const scheme = useHttp ? "http" : "https";
const url = `${scheme}://${ip}:${port}`;

console.log(`\nExEye sideload URL: ${url}`);
if (useHttp) {
  console.log(
    "Use HTTP dev server: npm run dev:device (HTTPS self-signed certs hang in the Even app)\n"
  );
} else {
  console.log(
    "For G2 hardware, prefer: npm run dev:device && npm run qr:device\n"
  );
}

if (process.argv.includes("--print-only")) {
  console.log(`npx evenhub qr --url "${url}"${useHttp ? "" : " --https"}`);
  process.exit(0);
}

const qrArgs = useHttp
  ? `npx evenhub qr --url "${url}"`
  : `npx evenhub qr --url "${url}" --https`;

execSync(qrArgs, { stdio: "inherit", cwd: root });
