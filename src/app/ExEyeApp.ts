import { CameraSource } from "../camera/CameraSource";
import { WebcamCameraSource } from "../camera/WebcamCameraSource";
import { EXEYE_CONFIG } from "../config";
import { DisplayAdapter } from "../display/DisplayAdapter";
import { EXEYE_STARTUP_TEXT } from "../display/EvenG2DisplayAdapter";
import { createSpeechPromptSource } from "../speech/createSpeechPromptSource";
import { SpeechClient } from "../speech/SpeechClient";
import type { SpeechPromptSource } from "../speech/types";
import type { DisplayUpdate } from "../display/displayUi";
import { VisionClient } from "../vision/VisionClient";

const PROMPT_STORAGE_KEY = "exeye.visionPrompt";

export class ExEyeApp {
  private analysing = false;
  private voiceListening = false;
  private activePrompt = "";
  private periodicTimer?: ReturnType<typeof setInterval>;
  private periodicEnabled = EXEYE_CONFIG.periodicScanEnabled;
  private visionPrompt: string;
  private speech: SpeechPromptSource = {
    isSupported: () => false,
    isActive: () => false,
    start: () => undefined,
    abort: () => undefined,
  };

  constructor(
    private readonly camera: CameraSource,
    private readonly vision: VisionClient,
    private readonly display: DisplayAdapter
  ) {
    this.visionPrompt = loadStoredPrompt() ?? EXEYE_CONFIG.defaultVisionPrompt;
  }

  getVisionPrompt(): string {
    return this.visionPrompt;
  }

  setVisionPrompt(prompt: string): void {
    const trimmed = prompt.trim();
    this.visionPrompt = trimmed || EXEYE_CONFIG.defaultVisionPrompt;
    saveStoredPrompt(this.visionPrompt);
  }

  async start(): Promise<void> {
    await this.display.init();

    this.speech = await createSpeechPromptSource(
      new SpeechClient(EXEYE_CONFIG.speechEndpoint)
    );

    this.display.bindControls?.({
      onAnalyse: () => void this.analyseOnce(),
      onVoicePrompt: () => this.startVoicePrompt(),
      onTogglePeriodic: () => this.togglePeriodicScan(),
      onExit: () => void this.shutdown(),
      isVoiceListening: () => this.voiceListening,
      isAnalysing: () => this.analysing,
      prompt: {
        getPrompt: () => this.getVisionPrompt(),
        setPrompt: (p) => this.setVisionPrompt(p),
        startVoicePrompt: () => this.startVoicePrompt(),
        isVoiceListening: () => this.voiceListening,
      },
    });

    await this.display.showText(EXEYE_STARTUP_TEXT);

    if (this.periodicEnabled) {
      this.startPeriodicScan();
    }
  }

  startVoicePrompt(): void {
    if (this.analysing || this.voiceListening) {
      return;
    }

    if (!this.speech.isSupported()) {
      this.showStatus({
        phase: "error",
        message:
          "Voice input is unavailable. Use the text prompt, or configure STT on the vision server (Groq/OpenAI/Gemini).",
      });
      return;
    }

    this.voiceListening = true;
    this.activePrompt = "";
    this.showStatus({
      phase: "listening",
      message: "Speak your prompt…",
    });

    void this.speech.start({
      onPartial: (transcript) => {
        if (isListeningActivity(transcript)) {
          this.showStatus({
            phase: "listening",
            message: transcript,
          });
          return;
        }

        this.showStatus({
          phase: "listening",
          message: "Listening…",
          prompt: transcript,
        });
      },
      onComplete: (transcript) => {
        this.voiceListening = false;

        const trimmed = transcript.trim();
        if (!trimmed) {
          this.showStatus({
            phase: "error",
            message:
              "Didn't catch speech. Tap temple, talk clearly, then pause when done.",
          });
          return;
        }

        this.activePrompt = trimmed;
        this.setVisionPrompt(trimmed);
        void this.analyseOnce();
      },
      onError: (message) => {
        this.voiceListening = false;
        this.showStatus({
          phase: "error",
          message,
        });
      },
    });
  }

  private showStatus(update: DisplayUpdate): Promise<void> {
    return this.display.showText({
      ...update,
      prompt: update.prompt ?? this.activePrompt,
    });
  }

  async analyseOnce(): Promise<void> {
    if (this.analysing || this.voiceListening) {
      return;
    }

    this.analysing = true;

    if (!this.activePrompt) {
      this.activePrompt = this.getVisionPrompt();
    }

    try {
      await this.showStatus({
        phase: "capturing",
        message: "Fetching camera frame…",
      });

      const frame = await this.camera.captureFrame();

      if (this.display.showViewfinder) {
        await this.display.showViewfinder(frame);
      }

      await this.showStatus({
        phase: "analysing",
        message: "Sending to vision AI…",
      });

      const summary = await this.vision.analyseFrame(
        frame,
        this.visionPrompt
      );

      await this.showStatus({
        phase: "result",
        message: summary,
      });
    } catch (error) {
      await this.showStatus({
        phase: "error",
        message: this.formatError(error),
      });
    } finally {
      this.analysing = false;
    }
  }

  togglePeriodicScan(): void {
    this.periodicEnabled = !this.periodicEnabled;

    if (this.periodicEnabled) {
      this.startPeriodicScan();
    } else {
      this.stopPeriodicScan();
    }
  }

  async shutdown(): Promise<void> {
    this.stopPeriodicScan();
    this.speech.abort();
    this.voiceListening = false;

    if (this.camera instanceof WebcamCameraSource) {
      this.camera.stop();
    }

    await this.display.shutdown?.();
  }

  private startPeriodicScan(): void {
    this.stopPeriodicScan();

    this.periodicTimer = setInterval(() => {
      void this.analyseOnce();
    }, EXEYE_CONFIG.periodicScanMs);
  }

  private stopPeriodicScan(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = undefined;
    }
  }

  private formatError(error: unknown): string {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");

    if (message.includes("HTTP camera failed")) {
      return `Camera unreachable.\n${message}`;
    }

    if (message.includes("Failed to fetch")) {
      return `Backend unreachable.\n${message}`;
    }

    if (
      message.includes("Vision backend failed") ||
      message.includes("Speech backend failed") ||
      message.includes("OpenAI error") ||
      message.includes("Gemini error") ||
      message.includes("insufficient_quota")
    ) {
      return `Vision API error.\n${message}`;
    }

    if (message.includes("empty summary")) {
      return `Empty AI response.\n${message}`;
    }

    if (
      message.includes("createStartUpPageContainer") ||
      message.includes("bridge")
    ) {
      return `Bridge error.\n${message}`;
    }

    if (message.includes("getUserMedia")) {
      return message;
    }

    return message;
  }
}

function loadStoredPrompt(): string | null {
  try {
    const value = localStorage.getItem(PROMPT_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function saveStoredPrompt(prompt: string): void {
  try {
    localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
  } catch {
    // WebView may block storage — prompt still works for this session
  }
}

function isListeningActivity(text: string): boolean {
  return (
    text.includes("█") ||
    text.includes("░") ||
    text.startsWith("Speak now") ||
    text.startsWith("Speak your") ||
    text === "Listening…" ||
    text.startsWith("Listening…\n") ||
    text === "Transcribing…" ||
    text === "Waiting for speech…"
  );
}
