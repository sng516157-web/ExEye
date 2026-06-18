export type VisionProvider = "mock" | "gemini" | "ollama" | "openai";

export interface VisionConfig {
  provider: VisionProvider;
  model: string | null;
}

export function resolveVisionConfig(): VisionConfig {
  const explicit = process.env.VISION_PROVIDER?.trim().toLowerCase();

  if (explicit === "mock") {
    return { provider: "mock", model: null };
  }

  if (explicit === "gemini" || (!explicit && process.env.GEMINI_API_KEY?.trim())) {
    return {
      provider: "gemini",
      // 2.0-flash free tier gets 429 quickly; 2.5-flash works on free tier (2025).
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    };
  }

  if (explicit === "ollama" || (!explicit && process.env.OLLAMA_MODEL?.trim())) {
    return {
      provider: "ollama",
      model: process.env.OLLAMA_MODEL?.trim() || "moondream",
    };
  }

  if (explicit === "openai" || (!explicit && process.env.OPENAI_API_KEY?.trim())) {
    return {
      provider: "openai",
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  return { provider: "mock", model: null };
}

export async function analyseImage(
  config: VisionConfig,
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<string> {
  switch (config.provider) {
    case "gemini":
      return analyseWithGemini(imageBuffer, mimeType, prompt, config.model!);
    case "ollama":
      return analyseWithOllama(imageBuffer, prompt, config.model!);
    case "openai":
      return analyseWithOpenAI(imageBuffer, mimeType, prompt, config.model!);
    case "mock":
    default:
      return mockSummary();
  }
}

export function mockSummary(): string {
  return "Mock vision: clear path ahead. Object detected on the left.";
}

export function shortenErrorMessage(message: string): string {
  if (message.includes("insufficient_quota")) {
    return "OpenAI billing/quota issue. Remove OPENAI_API_KEY and use Gemini or Ollama.";
  }

  if (message.includes("Gemini error 429") || message.includes("RESOURCE_EXHAUSTED")) {
    return "Gemini free-tier rate limit. Wait ~1 min, set GEMINI_MODEL=gemini-2.5-flash, or use Ollama.";
  }

  if (message.includes("invalid_api_key") || message.includes("API_KEY_INVALID")) {
    return "Invalid API key. Check server/.env";
  }

  if (message.includes("Ollama")) {
    return message.length > 200 ? `${message.slice(0, 199)}…` : message;
  }

  if (message.startsWith("OpenAI error") || message.startsWith("Gemini error")) {
    const jsonStart = message.indexOf("{");
    if (jsonStart > 0) {
      return message.slice(0, jsonStart).trim();
    }
  }

  return message.length > 200 ? `${message.slice(0, 199)}…` : message;
}

async function analyseWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  model: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const mediaType = mimeType || "image/jpeg";
  const base64 = imageBuffer.toString("base64");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
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
  });

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

async function analyseWithOllama(
  imageBuffer: Buffer,
  prompt: string,
  model: string
): Promise<string> {
  const baseUrl =
    process.env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434";
  const base64 = imageBuffer.toString("base64");

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: prompt,
          images: [base64],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Ollama error ${response.status}. Is Ollama running? Try: ollama pull ${model}. ${detail}`
    );
  }

  const data = (await response.json()) as {
    message?: { content?: string };
  };

  const summary = data.message?.content?.trim();

  if (!summary) {
    throw new Error("Ollama returned empty summary");
  }

  return summary;
}

async function analyseWithOpenAI(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  model: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const mediaType = mimeType || "image/jpeg";
  const base64 = imageBuffer.toString("base64");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const summary = data.choices?.[0]?.message?.content?.trim();

  if (!summary) {
    throw new Error("OpenAI returned empty summary");
  }

  return summary;
}
