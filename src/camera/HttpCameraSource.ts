import { EXEYE_CONFIG, resolveApiUrl } from "../config";
import { CameraSource } from "./CameraSource";

export class HttpCameraSource implements CameraSource {
  name = "http";

  constructor(private url: string) {}

  getCaptureUrl(): string {
    return this.url;
  }

  setCaptureUrl(url: string): void {
    this.url = url.trim();
  }

  async captureFrame(): Promise<Blob> {
    const response = await fetch(withCacheBust(resolveCameraFetchUrl(this.url)), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `HTTP camera failed with status ${response.status}`
      );
    }

    return await response.blob();
  }
}

function resolveCameraFetchUrl(cameraUrl: string): string {
  if (typeof window === "undefined") {
    return cameraUrl;
  }

  const fetchUrl = resolveApiUrl(cameraUrl);

  try {
    const target = new URL(fetchUrl);
    const pageOrigin = window.location.origin;
    const targetOrigin = `${target.protocol}//${target.host}`;

    if (targetOrigin !== pageOrigin) {
      const proxy = new URL(
        resolveApiUrl(EXEYE_CONFIG.cameraProxyEndpoint)
      );
      proxy.searchParams.set("url", cameraUrl);
      return proxy.toString();
    }
  } catch {
    return fetchUrl;
  }

  return fetchUrl;
}

function withCacheBust(url: string): string {
  try {
    const parsed = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );
    parsed.searchParams.set("t", String(Date.now()));
    return parsed.toString();
  } catch {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}t=${Date.now()}`;
  }
}
