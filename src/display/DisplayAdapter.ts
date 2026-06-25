import type { DisplayUpdate } from "./displayUi";

export interface PromptControls {
  getPrompt: () => string;
  setPrompt: (prompt: string) => void;
  startVoicePrompt?: () => void;
  isVoiceListening?: () => boolean;
}

export interface CameraControls {
  getCameraUrl: () => string;
  setCameraHost: (host: string, path?: string) => Promise<void>;
  discoverCamera: () => Promise<string | null>;
  testCamera: () => Promise<boolean>;
  useDevWebcam?: () => Promise<void>;
  isUsingDevWebcam?: () => boolean;
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
  camera?: CameraControls;
}

export interface DisplayAdapter {
  name: string;

  init(): Promise<void>;

  showText(update: string | DisplayUpdate): Promise<void>;

  /** Show a captured camera frame in the view finder. */
  showViewfinder?(image: Blob): Promise<void>;

  bindControls?(handlers: DisplayControls): void;

  shutdown?(): Promise<void>;
}
