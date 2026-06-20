import { EXEYE_CONFIG, resolveApiUrl } from "../config";

export interface CameraDiscoveryResult {
  url: string | null;
  found: boolean;
}

export async function discoverCameraOnNetwork(
  subnet?: string
): Promise<string | null> {
  const result = await fetchCameraDiscovery(subnet);
  return result.url;
}

export async function fetchCameraDiscovery(
  subnet?: string
): Promise<CameraDiscoveryResult> {
  const endpoint = new URL(resolveApiUrl(EXEYE_CONFIG.cameraDiscoverEndpoint));

  if (subnet) {
    endpoint.searchParams.set("subnet", subnet);
  }

  const response = await fetch(endpoint.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Camera discovery failed (${response.status})`);
  }

  const data = (await response.json()) as CameraDiscoveryResult;
  return {
    url: typeof data.url === "string" ? data.url : null,
    found: Boolean(data.found && data.url),
  };
}
