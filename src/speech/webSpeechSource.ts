import type { SpeechPromptHandlers, SpeechPromptSource } from "./types";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechSource implements SpeechPromptSource {
  private recognition: SpeechRecognition | null = null;
  private active = false;
  private aborted = false;
  private finalTranscript = "";
  private startedAt = 0;

  isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  isActive(): boolean {
    return this.active;
  }

  start(handlers: SpeechPromptHandlers): void {
    const Ctor = getSpeechRecognitionCtor();

    if (!Ctor) {
      handlers.onError("Voice input is not supported in this browser.");
      return;
    }

    this.abort();

    this.aborted = false;
    this.finalTranscript = "";
    this.startedAt = Date.now();
    this.active = true;

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalChunk += text;
        } else {
          interim += text;
        }
      }

      if (finalChunk) {
        this.finalTranscript = `${this.finalTranscript}${finalChunk}`.trim();
      }

      const display = (this.finalTranscript || interim).trim();
      if (display) {
        handlers.onPartial(display);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }

      this.active = false;
      handlers.onError(speechErrorMessage(event.error));
    };

    recognition.onend = () => {
      this.recognition = null;
      this.active = false;

      if (this.aborted) {
        this.aborted = false;
        return;
      }

      const transcript = this.finalTranscript.trim();
      const listenedMs = Date.now() - this.startedAt;

      if (!transcript && listenedMs < 2500) {
        handlers.onError(
          "Didn't catch speech. Tap Speak again and talk right away."
        );
        return;
      }

      handlers.onComplete(transcript);
    };

    this.recognition = recognition;

    try {
      recognition.start();
    } catch (error) {
      this.active = false;
      this.recognition = null;
      handlers.onError(
        error instanceof Error ? error.message : "Could not start voice input."
      );
    }
  }

  abort(): void {
    if (!this.recognition) {
      this.active = false;
      return;
    }

    this.aborted = true;
    this.recognition.abort();
    this.recognition = null;
    this.active = false;
  }
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Microphone access denied. Allow the mic in your browser settings.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Voice input needs a network connection.";
    case "service-not-allowed":
      return "Speech recognition is disabled in this browser.";
    default:
      return `Voice input failed (${code}).`;
  }
}
