import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";

import { isEvenHubHostAvailable } from "../utils/evenHub";
import type { SpeechClient } from "./SpeechClient";
import { EvenHubSpeechSource } from "./evenHubSpeechSource";
import type { SpeechPromptSource } from "./types";
import { WebSpeechSource } from "./webSpeechSource";

class UnsupportedSpeechSource implements SpeechPromptSource {
  isSupported(): boolean {
    return false;
  }

  isActive(): boolean {
    return false;
  }

  start(): void {
    // no-op
  }

  abort(): void {
    // no-op
  }
}

export async function createSpeechPromptSource(
  speechClient: SpeechClient
): Promise<SpeechPromptSource> {
  if (isEvenHubHostAvailable()) {
    try {
      const bridge = await waitForEvenAppBridge();
      return new EvenHubSpeechSource(bridge, speechClient);
    } catch (error) {
      console.warn("[ExEye] Even Hub speech unavailable", error);
    }
  }

  const webSpeech = new WebSpeechSource();
  if (webSpeech.isSupported()) {
    return webSpeech;
  }

  return new UnsupportedSpeechSource();
}
