import { Agent } from "undici";

export type SttProvider = "openai" | "groq" | "gemini" | "none";

const STT_HTTP_AGENT = new Agent({
  connect: { timeout: 30_000 },
  headersTimeout: 60_000,
  bodyTimeout: 120_000,
});

export function resolveSttFallbackChain(): SttProvider[] {
  const explicit = process.env.STT_PROVIDER?.trim().toLowerCase();
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());

  if (explicit === "gemini") {
    return hasGemini ? ["gemini"] : ["none"];
  }

  if (explicit === "openai") {
    return hasOpenai ? ["openai"] : ["none"];
  }

  if (explicit === "groq") {
    const chain: SttProvider[] = hasGroq ? ["groq"] : [];
    if (hasGemini) {
      chain.push("gemini");
    }
    if (hasOpenai) {
      chain.push("openai");
    }
    return chain.length ? chain : ["none"];
  }

  const chain: SttProvider[] = [];
  if (hasGroq) {
    chain.push("groq");
  }
  if (hasGemini) {
    chain.push("gemini");
  }
  if (hasOpenai) {
    chain.push("openai");
  }

  return chain.length ? chain : ["none"];
}

export function resolveSttProvider(): SttProvider {
  return resolveSttFallbackChain()[0] ?? "none";
}

export async function transcribeAudio(wavBuffer: Buffer): Promise<string> {
  if (!wavHasSpeech(wavBuffer)) {
    return "";
  }

  const providers = resolveSttFallbackChain();
  let lastError: Error | undefined;

  for (const provider of providers) {
    if (provider === "none") {
      break;
    }

    try {
      const transcript = await transcribeWithRetries(provider, wavBuffer);
      return sanitizeTranscript(transcript);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[ExEye] STT ${provider} failed`, error);
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    "No speech API key configured. Set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in server/.env"
  );
}

async function transcribeWithRetries(
  provider: SttProvider,
  wavBuffer: Buffer,
  attempts = 2
): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await transcribeWithProvider(provider, wavBuffer);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < attempts && isRetryableSttError(lastError)) {
        await delay(400 * attempt);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error(`STT ${provider} failed`);
}

async function transcribeWithProvider(
  provider: SttProvider,
  wavBuffer: Buffer
): Promise<string> {
  switch (provider) {
    case "groq":
      return transcribeWithGroq(wavBuffer);
    case "openai":
      return transcribeWithOpenAI(wavBuffer);
    case "gemini":
      return transcribeWithGemini(wavBuffer);
    default:
      throw new Error(`Unsupported STT provider: ${provider}`);
  }
}

function isRetryableSttError(error: Error): boolean {
  const message = error.message;
  const cause = (error as Error & { cause?: unknown }).cause;
  const causeText =
    cause instanceof Error
      ? `${cause.name} ${cause.message}`
      : String(cause ?? "");

  const combined = `${message} ${causeText}`;

  return (
    combined.includes("fetch failed") ||
    combined.includes("CONNECT_TIMEOUT") ||
    combined.includes("UND_ERR_CONNECT_TIMEOUT") ||
    combined.includes("ECONNRESET") ||
    combined.includes("ETIMEDOUT") ||
    combined.includes("STT error 429") ||
    combined.includes("STT error 502") ||
    combined.includes("STT error 503") ||
    combined.includes("Gemini STT error 429") ||
    combined.includes("RESOURCE_EXHAUSTED")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** G2 mic audio can be quiet — keep threshold low. */
function wavHasSpeech(wavBuffer: Buffer, minRms = 0.006): boolean {
  if (wavBuffer.byteLength <= 44) {
    return false;
  }

  const pcm = wavBuffer.subarray(44);
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const samples = Math.floor(pcm.byteLength / 2);

  if (samples < 160) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const sample = view.getInt16(i * 2, true) / 32768;
    sum += sample * sample;
  }

  return Math.sqrt(sum / samples) >= minRms;
}

const HALLUCINATION_PATTERNS = [
  /^thank(s| you) for watching/i,
  /^ご視聴ありがとうございました/,
  /^字幕/,
  /^\[.*\]$/,
  /^\.+$/,
];

function sanitizeTranscript(text: string): string {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "";
  }

  return trimmed;
}

async function transcribeWithGroq(wavBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const model =
    process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo";

  return postWhisperCompatible(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    apiKey,
    wavBuffer,
    model
  );
}

async function transcribeWithOpenAI(wavBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.OPENAI_STT_MODEL?.trim() || "whisper-1";

  return postWhisperCompatible(
    "https://api.openai.com/v1/audio/transcriptions",
    apiKey,
    wavBuffer,
    model
  );
}

async function postWhisperCompatible(
  url: string,
  apiKey: string,
  wavBuffer: Buffer,
  model: string
): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(wavBuffer)], { type: "audio/wav" }),
    "prompt.wav"
  );
  form.append("model", model);
  form.append("language", process.env.STT_LANGUAGE?.trim() || "en");
  form.append("response_format", "json");

  const response = await sttFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`STT error ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

async function transcribeWithGemini(wavBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = process.env.GEMINI_STT_MODEL?.trim() || "gemini-2.5-flash";
  const base64 = wavBuffer.toString("base64");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await sttFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "Transcribe the spoken English audio. Return only the spoken words, nothing else.",
            },
            {
              inline_data: {
                mime_type: "audio/wav",
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini STT error ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

function sttFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    dispatcher: STT_HTTP_AGENT,
  } as RequestInit & { dispatcher: Agent });
}
