import type { DisplayUpdate } from "./displayUi";

export interface PromptControls {
  getPrompt: () => string;
  setPrompt: (prompt: string) => void;
}

export interface DisplayControls {
  onAnalyse: () => void;
  onTogglePeriodic?: () => void;
  onExit?: () => void;
  prompt?: PromptControls;
}

export interface DisplayAdapter {
  name: string;

  init(): Promise<void>;

  showText(update: string | DisplayUpdate): Promise<void>;

  bindControls?(handlers: DisplayControls): void;

  shutdown?(): Promise<void>;
}
