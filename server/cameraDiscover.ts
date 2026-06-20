import { networkInterfaces } from "node:os";

const CAMERA_PATHS = [
  "/capture",
  "/jpg",
  "/photo.jpg",
  "/cam-hi.jpg",
  "/",
];

const CAMERA_PORTS = [80, 81];
const MDNS_HOSTS = ["esp32-cam.local", "esp32.local", "esp32cam.local"];

const PROBE_TIMEOUT_MS = 800;
const SCAN_CONCURRENCY = 24;

export async function discoverEsp32Camera(
  subnet?: string
): Promise<string | null> {
  for (const host of MDNS_HOSTS) {
    const url = await probeHost(host);
    if (url) {
      return url;
    }
  }

  const scanSubnet = subnet?.trim() || resolveLocalSubnet();
  if (!scanSubnet) {
    return null;
  }

  const hosts: string[] = [];
  for (let i = 1; i <= 254; i += 1) {
    hosts.push(`${scanSubnet}.${i}`);
  }

  for (let i = 0; i < hosts.length; i += SCAN_CONCURRENCY) {
    const batch = hosts.slice(i, i + SCAN_CONCURRENCY);
    const results = await Promise.all(batch.map((host) => probeHost(host)));
    const found = results.find((url) => url !== null);
    if (found) {
      return found;
    }
  }

  return null;
}

async function probeHost(host: string): Promise<string | null> {
  for (const port of CAMERA_PORTS) {
    for (const path of CAMERA_PATHS) {
      const url = buildProbeUrl(host, port, path);
      if (await isCameraUrl(url)) {
        return url;
      }
    }
  }

  return null;
}

function buildProbeUrl(host: string, port: number, path: string): string {
  const authority = port === 80 ? host : `${host}:${port}`;
  return `http://${authority}${path}`;
}

async function isCameraUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType.includes("image/jpeg") ||
      contentType.includes("image/png")
    ) {
      return true;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return isJpeg(bytes) || isPng(bytes);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isJpeg(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function resolveLocalSubnet(): string | null {
  const nets = networkInterfaces();

  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family !== "IPv4" || net.internal || !net.address) {
        continue;
      }

      const parts = net.address.split(".");
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }
  }

  return null;
}
