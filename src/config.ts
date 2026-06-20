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

function envOptional(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Dev default: relative paths on the Vite dev server (same IP as sideload QR).
 * Survives Wi‑Fi changes — only rescan QR after your PC gets a new address.
 * Set explicit http://… URLs in .env only if you need a custom layout.
 */
function resolveEndpoint(
  envKey: keyof ImportMetaEnv,
  devPath: string,
  prodDefault: string
): string {
  const explicit = envOptional(envKey);

  if (import.meta.env.PROD) {
    return explicit || prodDefault;
  }

  if (
    explicit.startsWith("http://") ||
    explicit.startsWith("https://") ||
    explicit.startsWith("/")
  ) {
    return explicit;
  }

  return devPath;
}

/** Hostname for LAN discovery — page host in dev, parsed URL in prod. */
export function apiHostForDiscovery(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    try {
      return new URL(endpoint).hostname;
    } catch {
      return "";
    }
  }

  if (typeof window !== "undefined") {
    return window.location.hostname;
  }

  return "";
}

/** Resolve relative dev API paths against the current page origin. */
export function resolveApiUrl(endpoint: string): string {
  if (
    endpoint.startsWith("http://") ||
    endpoint.startsWith("https://") ||
    typeof window === "undefined"
  ) {
    return endpoint;
  }

  if (endpoint.startsWith("/")) {
    return new URL(endpoint, window.location.origin).href;
  }

  return endpoint;
}

export const EXEYE_CONFIG = {
  cameraMode: envCameraMode("http"),

  httpCameraUrl: resolveEndpoint(
    "VITE_HTTP_CAMERA_URL",
    "/camera/snapshot",
    "http://192.168.4.1/capture"
  ),

  visionEndpoint: resolveEndpoint(
    "VITE_VISION_ENDPOINT",
    "/analyse-frame",
    "https://api.yourdomain.com/analyse-frame"
  ),

  speechEndpoint: resolveEndpoint(
    "VITE_SPEECH_ENDPOINT",
    "/transcribe-prompt",
    "https://api.yourdomain.com/transcribe-prompt"
  ),

  cameraDiscoverEndpoint: resolveEndpoint(
    "VITE_CAMERA_DISCOVER_ENDPOINT",
    "/camera/discover",
    "https://api.yourdomain.com/camera/discover"
  ),

  cameraProxyEndpoint: resolveEndpoint(
    "VITE_CAMERA_PROXY_ENDPOINT",
    "/camera/proxy",
    "https://api.yourdomain.com/camera/proxy"
  ),

  defaultVisionPrompt: DEFAULT_VISION_PROMPT,

  periodicScanEnabled: false,

  periodicScanMs: 3000,
};
