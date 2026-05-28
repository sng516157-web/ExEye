import { CameraSource } from "./CameraSource";

export class MockCameraSource implements CameraSource {
  name = "mock";

  async captureFrame(): Promise<Blob> {
    const canvas = document.createElement("canvas");

    canvas.width = 640;
    canvas.height = 480;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas unavailable");
    }

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.font = "32px sans-serif";
    ctx.fillText("ExEye Mock Frame", 140, 220);

    ctx.fillStyle = "#999";
    ctx.font = "18px sans-serif";
    ctx.fillText(new Date().toISOString(), 140, 260);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create mock frame"));
        } else {
          resolve(blob);
        }
      }, "image/jpeg", 0.85);
    });
  }
}
