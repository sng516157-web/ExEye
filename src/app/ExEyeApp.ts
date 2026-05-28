import { CameraSource } from "../camera/CameraSource";
import { WebcamCameraSource } from "../camera/WebcamCameraSource";
import { EXEYE_CONFIG } from "../config";
import { DisplayAdapter } from "../display/DisplayAdapter";
import { EXEYE_STARTUP_TEXT } from "../display/EvenG2DisplayAdapter";
import { truncateText } from "../utils/blob";
import { VisionClient } from "../vision/VisionClient";

const PROMPT_STORAGE_KEY = "exeye.visionPrompt";

export class ExEyeApp {
  private analysing = false;
  private periodicTimer?: ReturnType<typeof setInterval>;
  private periodicEnabled = EXEYE_CONFIG.periodicScanEnabled;
  private visionPrompt: string;

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
    await this.display.showText(EXEYE_STARTUP_TEXT);

    this.display.bindControls?.({
      onAnalyse: () => void this.analyseOnce(),
      onTogglePeriodic: () => this.togglePeriodicScan(),
      onExit: () => void this.shutdown(),
      prompt: {
        getPrompt: () => this.getVisionPrompt(),
        setPrompt: (p) => this.setVisionPrompt(p),
      },
    });

    if (this.periodicEnabled) {
      this.startPeriodicScan();
    }
  }

  async analyseOnce(): Promise<void> {
    if (this.analysing) {
      return;
    }

    this.analysing = true;

    try {
      await this.display.showText({
        phase: "capturing",
        message: "Fetching camera frame…",
      });

      const frame = await this.camera.captureFrame();

      await this.display.showText({
        phase: "analysing",
        message: "Sending to vision AI…",
      });

      const summary = await this.vision.analyseFrame(
        frame,
        this.visionPrompt
      );

      const clipped = truncateText(summary, EXEYE_CONFIG.maxSummaryChars);

      await this.display.showText({
        phase: "result",
        message: clipped,
      });
    } catch (error) {
      await this.display.showText({
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
