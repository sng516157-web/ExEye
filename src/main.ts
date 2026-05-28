import { ExEyeApp } from "./app/ExEyeApp";
import { CameraSource } from "./camera/CameraSource";
import { HttpCameraSource } from "./camera/HttpCameraSource";
import { MockCameraSource } from "./camera/MockCameraSource";
import { WebcamCameraSource } from "./camera/WebcamCameraSource";
import { EXEYE_CONFIG } from "./config";
import { BrowserDisplayAdapter } from "./display/BrowserDisplayAdapter";
import { DisplayAdapter } from "./display/DisplayAdapter";
import { EvenG2DisplayAdapter } from "./display/EvenG2DisplayAdapter";
import { isEvenHubHostAvailable } from "./utils/evenHub";
import { VisionClient } from "./vision/VisionClient";

declare global {
  interface Window {
    exeye?: ExEyeApp;
  }
}

function createCameraSource(): CameraSource {
  switch (EXEYE_CONFIG.cameraMode) {
    case "webcam":
      return new WebcamCameraSource();
    case "http":
      return new HttpCameraSource(EXEYE_CONFIG.httpCameraUrl);
    case "mock":
    default:
      return new MockCameraSource();
  }
}

function createDisplayAdapter(root: HTMLElement): DisplayAdapter {
  if (isEvenHubHostAvailable()) {
    return new EvenG2DisplayAdapter(root);
  }

  return new BrowserDisplayAdapter(root);
}

async function startWithFallback(
  root: HTMLElement,
  camera: CameraSource,
  vision: VisionClient,
  display: DisplayAdapter
): Promise<ExEyeApp> {
  const app = new ExEyeApp(camera, vision, display);

  try {
    await app.start();
    return app;
  } catch (error) {
    if (display.name !== "even-g2") {
      throw error;
    }

    console.warn(
      "[ExEye] EvenHub display init failed, falling back to browser mode",
      error
    );

    const fallbackDisplay = new BrowserDisplayAdapter(root);
    const fallbackApp = new ExEyeApp(camera, vision, fallbackDisplay);
    await fallbackApp.start();
    return fallbackApp;
  }
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");

  if (!root) {
    throw new Error("#app element not found");
  }

  const camera = createCameraSource();
  const vision = new VisionClient(EXEYE_CONFIG.visionEndpoint);
  const display = createDisplayAdapter(root);
  const app = await startWithFallback(root, camera, vision, display);

  window.exeye = app;
}

bootstrap().catch((error) => {
  console.error("[ExEye] bootstrap failed", error);

  const root = document.getElementById("app");

  if (root) {
    root.textContent = `ExEye failed to start: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
});
