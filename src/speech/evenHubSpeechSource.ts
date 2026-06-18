import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";

import {
  concatPcm,
  G2_PCM_FRAME_BYTES,
  G2_PCM_SAMPLE_RATE,
  isSpeechChunk,
  micLevelMeter,
  pcmPeak16le,
  pcmToWav,
} from "./pcm";
import type { SpeechClient } from "./SpeechClient";
import type { SpeechPromptHandlers, SpeechPromptSource } from "./types";

/** Pause after speech before auto-stop. */
const SILENCE_AFTER_SPEECH_MS = 1800;
/** Max wait for the user to start speaking. */
const FIRST_SPEECH_TIMEOUT_MS = 25_000;
const MAX_RECORD_MS = 45_000;
const MIN_FINISH_BYTES = G2_PCM_FRAME_BYTES;

export class EvenHubSpeechSource implements SpeechPromptSource {
  private active = false;
  private aborted = false;
  private finishing = false;
  private speechDetected = false;
  private handlers?: SpeechPromptHandlers;
  private unsubscribe?: () => void;
  private chunks: Uint8Array[] = [];
  private totalBytes = 0;
  private lastVoiceAt = 0;
  private startedAt = 0;
  private silenceTimer?: ReturnType<typeof setInterval>;
  private lastMeter = "";

  constructor(
    private readonly bridge: EvenAppBridge,
    private readonly speechClient: SpeechClient
  ) {}

  isSupported(): boolean {
    return true;
  }

  isActive(): boolean {
    return this.active;
  }

  async start(handlers: SpeechPromptHandlers): Promise<void> {
    if (this.active) {
      return;
    }

    this.handlers = handlers;
    this.aborted = false;
    this.finishing = false;
    this.speechDetected = false;
    this.chunks = [];
    this.totalBytes = 0;
    this.lastMeter = "";
    this.lastVoiceAt = 0;
    this.startedAt = Date.now();
    this.active = true;

    this.unsubscribe = this.bridge.onEvenHubEvent((event) => {
      if (!this.active || !event.audioEvent?.audioPcm) {
        return;
      }

      this.onPcm(event.audioEvent.audioPcm);
    });

    const opened = await this.bridge.audioControl(true);
    if (!opened) {
      this.cleanup();
      handlers.onError("Could not open the glasses microphone.");
      return;
    }

    handlers.onPartial("Listening…");

    this.silenceTimer = window.setInterval(() => {
      void this.checkSilence();
    }, 200);
  }

  abort(): void {
    if (!this.active) {
      return;
    }

    this.aborted = true;
    void this.finish(false);
  }

  private onPcm(chunk: Uint8Array): void {
    if (!this.active || chunk.byteLength === 0) {
      return;
    }

    this.chunks.push(chunk);
    this.totalBytes += chunk.byteLength;

    const peak = pcmPeak16le(chunk);

    if (isSpeechChunk(chunk)) {
      this.speechDetected = true;
      this.lastVoiceAt = Date.now();
    } else if (
      !this.speechDetected &&
      this.totalBytes >= G2_PCM_FRAME_BYTES * 3 &&
      Date.now() - this.startedAt >= 1000
    ) {
      this.speechDetected = true;
      this.lastVoiceAt = Date.now();
    }

    const meter = micLevelMeter(peak);
    const label = this.speechDetected ? "Listening…" : "Speak now…";
    const display = `${label}\n${meter}`;

    if (display !== this.lastMeter) {
      this.lastMeter = display;
      this.handlers?.onPartial(display);
    }

    if (Date.now() - this.startedAt > MAX_RECORD_MS) {
      void this.finish(true);
    }
  }

  private async checkSilence(): Promise<void> {
    if (!this.active || this.finishing) {
      return;
    }

    const elapsed = Date.now() - this.startedAt;

    if (!this.speechDetected) {
      if (elapsed >= FIRST_SPEECH_TIMEOUT_MS) {
        await this.finish(true);
      }
      return;
    }

    if (Date.now() - this.lastVoiceAt >= SILENCE_AFTER_SPEECH_MS) {
      await this.finish(true);
    }
  }

  private async finish(transcribe: boolean): Promise<void> {
    if (this.finishing) {
      return;
    }

    this.finishing = true;
    const handlers = this.handlers;
    const shouldTranscribe = transcribe && !this.aborted;
    const pcm = concatPcm(this.chunks);
    const bytes = this.totalBytes;
    const hadSpeech = this.speechDetected;

    this.cleanup();

    try {
      await this.bridge.audioControl(false);
    } catch (error) {
      console.warn("[ExEye] audioControl(false) failed", error);
    }

    if (!shouldTranscribe || !handlers) {
      return;
    }

    if (!hadSpeech || bytes < MIN_FINISH_BYTES) {
      handlers.onComplete("");
      return;
    }

    handlers.onPartial("Transcribing…");

    try {
      const wav = pcmToWav(pcm, G2_PCM_SAMPLE_RATE);
      const transcript = await this.speechClient.transcribe(wav);
      handlers.onComplete(transcript.trim());
    } catch (error) {
      handlers.onError(
        error instanceof Error ? error.message : "Speech transcription failed."
      );
    }
  }

  private cleanup(): void {
    this.active = false;

    if (this.silenceTimer) {
      window.clearInterval(this.silenceTimer);
      this.silenceTimer = undefined;
    }

    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
