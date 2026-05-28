import { CameraSource } from "./CameraSource";

export class HttpCameraSource implements CameraSource {
  name = "http";

  constructor(private readonly url: string) {}

  async captureFrame(): Promise<Blob> {
    const response = await fetch(this.url, {
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
