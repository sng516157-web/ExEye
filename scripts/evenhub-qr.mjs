#!/usr/bin/env node
/**
 * Run evenhub qr for the current Vite dev server (Even Hub hardware sideload).
 * Always uses live LAN IP detection so Wi‑Fi changes only require re-running this.
 */
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectLanIp } from "./lan-ip.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.VITE_PORT ?? "5173";
const useHttp = process.argv.includes("--http");

const ip = detectLanIp();
const scheme = useHttp ? "http" : "https";
const url = `${scheme}://${ip}:${port}`;

console.log(`\nExEye sideload URL: ${url}`);
if (useHttp) {
  console.log(
    "Use HTTP dev server: npm run dev:device (HTTPS self-signed certs hang in the Even app)"
  );
  console.log(
    "After Wi‑Fi change: restart dev:device if needed, then run qr:device again.\n"
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
