export type CameraMode = "mock" | "webcam" | "http";

export const DEFAULT_VISION_PROMPT =
  "Describe only useful navigation-relevant visual information in 2–3 short sentences.";

function envString(key: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function envCameraMode(fallback: CameraMode): CameraMode {
  const value = envString("VITE_CAMERA_MODE", fallback);
  if (value === "mock" || value === "webcam" || value === "http") {
    return value;
  }
  return fallback;
}

const devHost = envString("VITE_DEV_HOST", "localhost");

if (import.meta.env.DEV && devHost === "localhost") {
  console.warn(
    "[ExEye] For G2 hardware, copy .env.development.example to .env.development.local and set VITE_DEV_HOST to your Mac LAN IP."
  );
}

export const EXEYE_CONFIG = {
  cameraMode: envCameraMode("http"),

  httpCameraUrl: envString(
    "VITE_HTTP_CAMERA_URL",
    `http://${devHost}:3000/camera/snapshot`
  ),

  visionEndpoint: envString(
    "VITE_VISION_ENDPOINT",
    import.meta.env.PROD
      ? "https://api.yourdomain.com/analyse-frame"
      : `http://${devHost}:3000/analyse-frame`
  ),

  defaultVisionPrompt: DEFAULT_VISION_PROMPT,

  periodicScanEnabled: false,

  periodicScanMs: 3000,
};
