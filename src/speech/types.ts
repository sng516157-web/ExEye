export interface SpeechPromptHandlers {
  onPartial: (transcript: string) => void;
  onComplete: (transcript: string) => void;
  onError: (message: string) => void;
}

export interface SpeechPromptSource {
  isSupported(): boolean;
  isActive(): boolean;
  start(handlers: SpeechPromptHandlers): void | Promise<void>;
  abort(): void;
}
