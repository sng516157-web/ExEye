import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const key = process.env.GROQ_API_KEY?.trim();
console.log("GROQ_API_KEY set:", Boolean(key));

const models = await fetch("https://api.groq.com/openai/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});
console.log("models:", models.status, await models.text().then((t) => t.slice(0, 120)));

const wavPath = resolve(root, "test-tone.wav");
const buf = readFileSync(wavPath);
const form = new FormData();
form.append("file", new Blob([buf], { type: "audio/wav" }), "prompt.wav");
form.append("model", process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo");
form.append("language", "en");
form.append("response_format", "json");

const t0 = Date.now();
const tr = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
const body = await tr.text();
console.log("stt:", tr.status, `${Date.now() - t0}ms`, body.slice(0, 300));
