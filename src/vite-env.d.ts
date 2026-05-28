/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_HOST?: string;
  readonly VITE_VISION_ENDPOINT?: string;
  readonly VITE_CAMERA_MODE?: string;
  readonly VITE_HTTP_CAMERA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
