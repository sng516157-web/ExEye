export type SttProvider = "openai" | "groq" | "gemini" | "none";

export function resolveSttProvider(): SttProvider {
  const explicit = process.env.STT_PROVIDER?.trim().toLowerCase();

  if (explicit === "groq" && process.env.GROQ_API_KEY?.trim()) {
    return "groq";
  }

  if (explicit === "openai" && process.env.OPENAI_API_KEY?.trim()) {
    return "openai";
  }

  if (explicit === "gemini" && process.env.GEMINI_API_KEY?.trim()) {
    return "gemini";
  }

  // Prefer dedicated speech models over Gemini multimodal for accuracy/speed.
  if (process.env.GROQ_API_KEY?.trim()) {
    return "groq";
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return "openai";
  }

  if (process.env.GEMINI_API_KEY?.trim()) {
    return "gemini";
  }

  return "none";
}

export async function transcribeAudio(wavBuffer: Buffer): Promise<string> {
  if (!wavHasSpeech(wavBuffer)) {
    return "";
  }

  const provider = resolveSttProvider();
  let transcript: string;

  switch (provider) {
    case "groq":
      transcript = await transcribeWithGroq(wavBuffer);
      break;
    case "openai":
      transcript = await transcribeWithOpenAI(wavBuffer);
      break;
    case "gemini":
      transcript = await transcribeWithGemini(wavBuffer);
      break;
    default:
      throw new Error(
        "No speech API key configured. Set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in server/.env"
      );
  }

  return sanitizeTranscript(transcript);
}

function wavHasSpeech(wavBuffer: Buffer, minRms = 0.012): boolean {
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

  const response = await fetch(url, {
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
  const transcript = data.text?.trim();

  if (!transcript) {
    throw new Error("STT returned empty transcript");
  }

  return transcript;
}

async function transcribeWithGemini(wavBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = process.env.GEMINI_STT_MODEL?.trim() || "gemini-2.5-flash";
  const base64 = wavBuffer.toString("base64");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
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

  const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!transcript) {
    throw new Error("Gemini STT returned empty transcript");
  }

  return transcript;
}
