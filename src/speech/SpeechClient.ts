import { resolveApiUrl } from "../config";

export class SpeechClient {
  constructor(private readonly endpoint: string) {}

  async transcribe(wav: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", wav, "prompt.wav");

    const response = await fetch(resolveApiUrl(this.endpoint), {
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
          ? `Speech backend failed (${response.status}): ${detail}`
          : `Speech backend failed with status ${response.status}`
      );
    }

    const data = (await response.json()) as { transcript?: string };
    return String(data.transcript ?? "").trim();
  }
}
