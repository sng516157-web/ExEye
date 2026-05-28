#!/usr/bin/env node
/**
 * Merge VITE_VISION_ENDPOINT origin into app.json network whitelist before pack.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appJsonPath = resolve(root, "app.json");
const envPath = resolve(root, ".env.production.local");

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnvFile(envPath);
const endpoint = env.VITE_VISION_ENDPOINT ?? process.env.VITE_VISION_ENDPOINT;

if (!endpoint) {
  console.error(
    "Set VITE_VISION_ENDPOINT in .env.production.local before packing."
  );
  process.exit(1);
}

let origin;
try {
  origin = new URL(endpoint).origin;
} catch {
  console.error(`Invalid VITE_VISION_ENDPOINT: ${endpoint}`);
  process.exit(1);
}

const app = JSON.parse(readFileSync(appJsonPath, "utf8"));
const network = app.permissions?.find((p) => p.name === "network");

if (!network) {
  console.error("app.json missing network permission.");
  process.exit(1);
}

const list = new Set(network.whitelist ?? []);
list.add(origin);
network.whitelist = [...list];

writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);
console.log(`Added ${origin} to app.json network whitelist.`);
