#!/usr/bin/env node
/**
 * Run evenhub qr for the current Vite dev server (Even Hub hardware sideload).
 */
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.VITE_PORT ?? "5173";
const useHttp = process.argv.includes("--http");

function detectLanIp() {
  const nets = os.networkInterfaces();

  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "127.0.0.1";
}

const ip = detectLanIp();
const scheme = useHttp ? "http" : "https";
const url = `${scheme}://${ip}:${port}`;

console.log(`\nExEye sideload URL: ${url}\n`);

if (process.argv.includes("--print-only")) {
  console.log(`npx evenhub qr --url "${url}"${useHttp ? "" : " --https"}`);
  process.exit(0);
}

const qrArgs = useHttp
  ? `npx evenhub qr --url "${url}"`
  : `npx evenhub qr --url "${url}" --https`;

execSync(qrArgs, { stdio: "inherit", cwd: root });
