export const CAMERA_URL_STORAGE_KEY = "exeye.httpCameraUrl";

export const ESP32_CAMERA_PATHS = [
  "/capture",
  "/jpg",
  "/photo.jpg",
  "/cam-hi.jpg",
] as const;

export type Esp32CameraPath = (typeof ESP32_CAMERA_PATHS)[number];

export function buildCameraUrl(
  hostOrUrl: string,
  path: string = "/capture"
): string {
  const trimmed = hostOrUrl.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `${parsed.protocol}//${parsed.host}${cleanPath}`;
    } catch {
      return trimmed;
    }
  }

  const host = trimmed.split("/")[0].split(":")[0];
  const portMatch = trimmed.match(/:(\d+)/);
  const port = portMatch ? `:${portMatch[1]}` : "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `http://${host}${port}${cleanPath}`;
}

export function parseCameraHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function parseCameraPath(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname || "/capture";
  } catch {
    return "/capture";
  }
}

export function subnetFromHost(host: string): string | undefined {
  const parts = host.trim().split(".");
  if (parts.length !== 4) {
    return undefined;
  }

  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function loadStoredCameraUrl(): string | null {
  try {
    const value = localStorage.getItem(CAMERA_URL_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function saveStoredCameraUrl(url: string): void {
  try {
    localStorage.setItem(CAMERA_URL_STORAGE_KEY, url);
  } catch {
    // WebView may block storage
  }
}

export function isDevWebcamSnapshotUrl(url: string): boolean {
  return url.includes("/camera/snapshot");
}
