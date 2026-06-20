import cors from "cors";
import express from "express";
import multer from "multer";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { captureWebcamJpeg } from "./webcamCapture.js";
import { discoverEsp32Camera } from "./cameraDiscover.js";
import { augmentVisionPrompt, stripMarkdownFormatting } from "./prompt.js";
import { resolveSttProvider, transcribeAudio } from "./stt.js";
import {
  analyseImage,
  mockSummary,
  resolveVisionConfig,
  shortenErrorMessage,
} from "./vision.js";

loadEnvFile();

const visionConfig = resolveVisionConfig();
const MOCK_ON_AI_ERROR = process.env.MOCK_ON_AI_ERROR === "1";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const PORT = Number(process.env.PORT) || 3000;

const DEFAULT_PROMPT =
  "Describe only useful navigation-relevant visual information in 2–3 short sentences.";

app.use(cors());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    vision: visionConfig.provider,
    model: visionConfig.model,
    visionFallback: visionConfig.fallback?.provider ?? null,
    speech: resolveSttProvider(),
    macCamera: "/camera/snapshot",
  });
});

// Dev helper: host machine webcam as HTTP camera (G2 + iPhone — WebView has no getUserMedia)
app.get("/camera/snapshot", async (_req, res) => {
  try {
    const jpeg = await captureWebcamJpeg();
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "no-store");
    res.send(jpeg);
  } catch (error) {
    console.error("[ExEye] /camera/snapshot failed", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Webcam capture failed",
    });
  }
});

app.get("/camera/discover", async (req, res) => {
  try {
    const subnet =
      typeof req.query.subnet === "string" ? req.query.subnet : undefined;
    const url = await discoverEsp32Camera(subnet);
    res.json({ url, found: Boolean(url) });
  } catch (error) {
    console.error("[ExEye] /camera/discover failed", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Camera discovery failed",
    });
  }
});

app.get("/camera/proxy", async (req, res) => {
  const target = typeof req.query.url === "string" ? req.query.url.trim() : "";

  if (!target.startsWith("http://") && !target.startsWith("https://")) {
    res.status(400).json({ error: "Missing or invalid camera url" });
    return;
  }

  try {
    const upstream = await fetch(target, { cache: "no-store" });

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `Camera returned HTTP ${upstream.status}`,
      });
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.set(
      "Content-Type",
      upstream.headers.get("content-type") ?? "image/jpeg"
    );
    res.set("Cache-Control", "no-store");
    res.send(body);
  } catch (error) {
    console.error("[ExEye] /camera/proxy failed", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Camera proxy failed",
    });
  }
});

app.post("/transcribe-prompt", upload.single("audio"), async (req, res) => {
  if (!req.file?.buffer?.length) {
    res.status(400).json({ error: "Missing audio upload" });
    return;
  }

  try {
    const transcript = await transcribeAudio(req.file.buffer);
    res.json({ transcript: transcript.trim() });
  } catch (error) {
    console.error("[ExEye] /transcribe-prompt failed", error);
    const message =
      error instanceof Error ? error.message : "Speech transcription failed";
    res.status(500).json({
      error: shortenErrorMessage(message),
    });
  }
});

app.post("/analyse-frame", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing image upload" });
    return;
  }

  const prompt = augmentVisionPrompt(
    typeof req.body?.prompt === "string" && req.body.prompt.trim()
      ? req.body.prompt.trim()
      : DEFAULT_PROMPT
  );

  try {
    let summary: string;

    if (visionConfig.provider === "mock") {
      summary = mockSummary();
    } else {
      try {
        summary = await analyseImage(
          visionConfig,
          req.file.buffer,
          req.file.mimetype,
          prompt
        );
      } catch (error) {
        console.error(`[ExEye] ${visionConfig.provider} failed`, error);

        if (MOCK_ON_AI_ERROR) {
          summary = mockSummary();
        } else {
          throw error;
        }
      }
    }

    res.json({ summary: stripMarkdownFormatting(summary) });
  } catch (error) {
    console.error("[ExEye] analyse-frame failed", error);
    const message =
      error instanceof Error ? error.message : "Vision analysis failed";
    res.status(500).json({
      error: shortenErrorMessage(message),
    });
  }
});

app.listen(PORT, () => {
  console.log(`ExEye vision backend listening on http://localhost:${PORT}`);
  const fallback = visionConfig.fallback
    ? ` · fallback: ${visionConfig.fallback.provider} (${visionConfig.fallback.model})`
    : "";
  console.log(
    `Vision: ${visionConfig.provider}${
      visionConfig.model ? ` (${visionConfig.model})` : ""
    }${fallback}`
  );
  console.log(`Speech: ${resolveSttProvider()} at POST /transcribe-prompt`);

  if (
    visionConfig.provider !== "openai" &&
    process.env.OPENAI_API_KEY?.trim()
  ) {
    console.warn(
      "[ExEye] OPENAI_API_KEY is set but ignored (VISION_PROVIDER is not openai)."
    );
  }
});

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
