import {
  augmentVisionPrompt,
  stripMarkdownFormatting,
} from "../utils/markdown";

export class VisionClient {
  constructor(private readonly endpoint: string) {}

  async analyseFrame(image: Blob, prompt: string): Promise<string> {
    const formData = new FormData();

    formData.append("image", image, "frame.jpg");
    formData.append("prompt", augmentVisionPrompt(prompt));

    const response = await fetch(this.endpoint, {
      method: "POST",
      body: formData,
    });

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
          ? `Vision backend failed (${response.status}): ${detail}`
          : `Vision backend failed with status ${response.status}`
      );
    }

    const data = await response.json();

    const summary = String(data.summary ?? "").trim();

    if (!summary) {
      throw new Error("Vision backend returned empty summary");
    }

    return stripMarkdownFormatting(summary);
  }
}
