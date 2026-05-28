type VisionProvider = "mock" | "gemini";

interface Env {
  VISION_PROVIDER?: string;
  GEMINI_MODEL?: string;
  GEMINI_API_KEY?: string;
  MOCK_ON_AI_ERROR?: string;
}

interface VisionConfig {
  provider: VisionProvider;
  model: string | null;
}

const DEFAULT_PROMPT =
  "Describe only useful navigation-relevant visual information in 2-3 short sentences.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const visionConfig = resolveVisionConfig(env);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(
        {
          ok: true,
          vision: visionConfig.provider,
          model: visionConfig.model,
          macCamera: null,
        },
        200
      );
    }

    if (request.method === "POST" && url.pathname === "/analyse-frame") {
      try {
        const form = await request.formData();
        const image = form.get("image");
        if (!(image instanceof File)) {
          return json({ error: "Missing image upload" }, 400);
        }

        const promptRaw = form.get("prompt");
        const prompt =
          typeof promptRaw === "string" && promptRaw.trim()
            ? promptRaw.trim()
            : DEFAULT_PROMPT;

        let summary: string;
        if (visionConfig.provider === "mock") {
          summary = mockSummary();
        } else {
          try {
            summary = await analyseWithGemini(
              env,
              image,
              prompt,
              visionConfig.model ?? "gemini-2.5-flash"
            );
          } catch (error) {
            if (env.MOCK_ON_AI_ERROR === "1") {
              summary = mockSummary();
            } else {
              throw error;
            }
          }
        }

        return json({ summary }, 200);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Vision analysis failed";
        return json({ error: shortenErrorMessage(message) }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};

function resolveVisionConfig(env: Env): VisionConfig {
  const explicit = env.VISION_PROVIDER?.trim().toLowerCase();
  if (explicit === "mock") {
    return { provider: "mock", model: null };
  }

  if (explicit === "gemini" || (!explicit && env.GEMINI_API_KEY?.trim())) {
    return {
      provider: "gemini",
      model: env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    };
  }

  return { provider: "mock", model: null };
}

async function analyseWithGemini(
  env: Env,
  image: File,
  prompt: string,
  model: string
): Promise<string> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const imageData = await image.arrayBuffer();
  const base64 = arrayBufferToBase64(imageData);
  const mediaType = image.type || "image/jpeg";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mediaType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini error ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!summary) {
    throw new Error("Gemini returned empty summary");
  }

  return summary;
}

function mockSummary(): string {
  return "Mock vision: clear path ahead. Object detected on the left.";
}

function shortenErrorMessage(message: string): string {
  if (message.includes("Gemini error 429") || message.includes("RESOURCE_EXHAUSTED")) {
    return "Gemini free-tier rate limit. Wait ~1 min or keep GEMINI_MODEL=gemini-2.5-flash.";
  }

  if (message.includes("invalid_api_key") || message.includes("API_KEY_INVALID")) {
    return "Invalid API key. Check GEMINI_API_KEY on Cloudflare.";
  }

  if (message.startsWith("Gemini error")) {
    const jsonStart = message.indexOf("{");
    if (jsonStart > 0) {
      return message.slice(0, jsonStart).trim();
    }
  }

  return message.length > 200 ? `${message.slice(0, 199)}...` : message;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
