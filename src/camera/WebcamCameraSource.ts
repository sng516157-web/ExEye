import { CameraSource } from "./CameraSource";

export class WebcamCameraSource implements CameraSource {
  name = "webcam";

  private video?: HTMLVideoElement;
  private stream?: MediaStream;

  async init(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Phone camera unavailable in Even app (no getUserMedia). " +
          "Use cameraMode \"http\" with a WiFi camera or Mac snapshot URL " +
          "(http://YOUR_MAC_IP:3000/camera/snapshot)."
      );
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    this.video = document.createElement("video");

    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;

    await this.video.play();
  }

  async captureFrame(): Promise<Blob> {
    if (!this.video) {
      await this.init();
    }

    if (!this.video) {
      throw new Error("Webcam not initialised");
    }

    const canvas = document.createElement("canvas");

    canvas.width = this.video.videoWidth || 640;
    canvas.height = this.video.videoHeight || 480;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas unavailable");
    }

    ctx.drawImage(this.video, 0, 0);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to capture webcam frame"));
        } else {
          resolve(blob);
        }
      }, "image/jpeg", 0.85);
    });
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
  }
}
