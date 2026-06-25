import { resolveApiUrl } from "../config";
import {
  augmentVisionPrompt,
  stripMarkdownFormatting,
} from "../utils/markdown";

export class VisionClient {
  constructor(
    private readonly visionEndpoint: string,
    private readonly textPromptEndpoint: string
  ) {}

  async analyseFrame(image: Blob, prompt: string): Promise<string> {
    const formData = new FormData();

    formData.append("image", image, "frame.jpg");
    formData.append("prompt", augmentVisionPrompt(prompt));

    const response = await fetch(resolveApiUrl(this.visionEndpoint), {
      method: "POST",
      body: formData,
    });

    return parseSummaryResponse(response, "Vision");
  }

  async analysePrompt(prompt: string): Promise<string> {
    const response = await fetch(resolveApiUrl(this.textPromptEndpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: augmentVisionPrompt(prompt) }),
    });

    return parseSummaryResponse(response, "AI");
  }
}

async function parseSummaryResponse(
  response: Response,
  label: string
): Promise<string> {
  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = String(errBody.error ?? errBody.message ?? "").trim();
    } catch {
      detail = await response.text().catch(() => "");
    }

    throw new Error(
      detail
        ? `${label} backend failed (${response.status}): ${detail}`
        : `${label} backend failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as { summary?: string };
  const summary = String(data.summary ?? "").trim();

  if (!summary) {
    throw new Error(`${label} backend returned empty summary`);
  }

  return stripMarkdownFormatting(summary);
}
