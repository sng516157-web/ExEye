import type { DisplayUpdate } from "./displayUi";

export interface PromptControls {
  getPrompt: () => string;
  setPrompt: (prompt: string) => void;
  startVoicePrompt?: () => void;
  isVoiceListening?: () => boolean;
}

export interface DisplayControls {
  onAnalyse: () => void;
  /** Single temple/ring tap — speak a voice prompt (G2). */
  onVoicePrompt?: () => void;
  onTogglePeriodic?: () => void;
  onExit?: () => void;
  isVoiceListening?: () => boolean;
  isAnalysing?: () => boolean;
  prompt?: PromptControls;
}

export interface DisplayAdapter {
  name: string;

  init(): Promise<void>;

  showText(update: string | DisplayUpdate): Promise<void>;

  /** Show the latest camera frame in the view finder (persists until replaced). */
  showViewfinder?(image: Blob): Promise<void>;

  bindControls?(handlers: DisplayControls): void;

  shutdown?(): Promise<void>;
}
