import {
  ESP32_CAMERA_PATHS,
  isDevWebcamSnapshotUrl,
  parseCameraHost,
  parseCameraPath,
  type Esp32CameraPath,
} from "../camera/cameraUrl";
import type { CameraControls } from "../display/DisplayAdapter";

export const CAMERA_PANEL_HTML = `
  <section class="exeye-camera-panel" aria-label="Camera source">
    <label class="exeye-prompt-label" for="exeye-camera-ip">
      Camera
    </label>
    <p class="exeye-prompt-hint">
      Dev: use Laptop webcam until your ESP32 is ready. Later, enter the ESP32 IP or tap Find camera.
    </p>
    <div class="exeye-camera-row">
      <input
        id="exeye-camera-ip"
        class="exeye-camera-input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        spellcheck="false"
        placeholder="192.168.0.50"
      />
      <select id="exeye-camera-path" class="exeye-camera-path" aria-label="Capture path">
        ${ESP32_CAMERA_PATHS.map(
          (path) => `<option value="${path}">${path}</option>`
        ).join("")}
      </select>
    </div>
    <div class="exeye-prompt-actions">
      <button type="button" class="exeye-btn exeye-btn--primary" id="exeye-camera-webcam">
        Laptop webcam (dev)
      </button>
      <button type="button" class="exeye-btn" id="exeye-camera-save">
        Save ESP32
      </button>
      <button type="button" class="exeye-btn" id="exeye-camera-test">
        Test
      </button>
      <button type="button" class="exeye-btn" id="exeye-camera-discover">
        Find ESP32
      </button>
    </div>
    <p class="exeye-prompt-status" id="exeye-camera-status" aria-live="polite"></p>
  </section>
`;

export function bindCameraPanel(
  root: ParentNode,
  controls: CameraControls
): void {
  const ipInput = root.querySelector("#exeye-camera-ip");
  const pathSelect = root.querySelector("#exeye-camera-path");
  const saveBtn = root.querySelector("#exeye-camera-save");
  const testBtn = root.querySelector("#exeye-camera-test");
  const discoverBtn = root.querySelector("#exeye-camera-discover");
  const webcamBtn = root.querySelector("#exeye-camera-webcam");
  const status = root.querySelector("#exeye-camera-status");

  if (!(ipInput instanceof HTMLInputElement)) {
    return;
  }

  const setStatus = (message: string) => {
    if (status) {
      status.textContent = message;
    }
  };

  const readPath = (): string => {
    if (pathSelect instanceof HTMLSelectElement) {
      return pathSelect.value;
    }
    return "/capture";
  };

  const syncFromControls = () => {
    const url = controls.getCameraUrl();

    if (controls.isUsingDevWebcam?.() || isDevWebcamSnapshotUrl(url)) {
      ipInput.value = "";
      ipInput.placeholder = "Using this laptop webcam";
      setStatus("Using laptop webcam (/camera/snapshot).");
      return;
    }

    ipInput.placeholder = "192.168.0.50";
    ipInput.value = parseCameraHost(url);
    if (pathSelect instanceof HTMLSelectElement) {
      const path = parseCameraPath(url);
      if (ESP32_CAMERA_PATHS.includes(path as Esp32CameraPath)) {
        pathSelect.value = path;
      }
    }
  };

  syncFromControls();

  webcamBtn?.addEventListener("click", async () => {
    if (!controls.useDevWebcam) {
      return;
    }

    setStatus("Switching to laptop webcam…");
    webcamBtn.setAttribute("disabled", "");

    try {
      await controls.useDevWebcam();
      syncFromControls();
      setStatus("Laptop webcam active.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Laptop webcam failed. Is the vision server running with ffmpeg?"
      );
    } finally {
      webcamBtn.removeAttribute("disabled");
    }
  });

  saveBtn?.addEventListener("click", async () => {
    const host = ipInput.value.trim();
    if (!host) {
      setStatus("Enter a camera IP or hostname.");
      return;
    }

    try {
      await controls.setCameraHost(host, readPath());
      syncFromControls();
      setStatus(`Camera saved — ${controls.getCameraUrl()}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to save camera URL."
      );
    }
  });

  testBtn?.addEventListener("click", async () => {
    if (controls.isUsingDevWebcam?.()) {
      setStatus("Testing laptop webcam…");
      testBtn.setAttribute("disabled", "");

      try {
        const ok = await controls.testCamera();
        setStatus(
          ok
            ? "Laptop webcam reachable — frame captured."
            : "Webcam did not return a valid image."
        );
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Webcam test failed."
        );
      } finally {
        testBtn.removeAttribute("disabled");
      }
      return;
    }

    const host = ipInput.value.trim();
    if (!host) {
      setStatus("Enter a camera IP before testing.");
      return;
    }

    setStatus("Testing camera…");
    testBtn.setAttribute("disabled", "");

    try {
      await controls.setCameraHost(host, readPath());
      const ok = await controls.testCamera();
      setStatus(
        ok
          ? "Camera reachable — frame captured."
          : "Camera did not return a valid image."
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Camera test failed."
      );
    } finally {
      testBtn.removeAttribute("disabled");
    }
  });

  discoverBtn?.addEventListener("click", async () => {
    setStatus("Scanning network for ESP32 camera…");
    discoverBtn.setAttribute("disabled", "");
    saveBtn?.setAttribute("disabled", "");
    testBtn?.setAttribute("disabled", "");

    try {
      const url = await controls.discoverCamera();
      if (!url) {
        setStatus(
          "No camera found. Check ESP32 is on the same Wi‑Fi, then enter IP manually."
        );
        return;
      }

      syncFromControls();
      setStatus(`Found camera — ${url}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Network scan failed."
      );
    } finally {
      discoverBtn.removeAttribute("disabled");
      saveBtn?.removeAttribute("disabled");
      testBtn?.removeAttribute("disabled");
    }
  });
}
