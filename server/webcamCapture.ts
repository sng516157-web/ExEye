import { execFile } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

/** Capture one JPEG frame from the dev machine webcam via ffmpeg. */
export async function captureWebcamJpeg(): Promise<Buffer> {
  if (platform() === "darwin") {
    return captureMacWebcamJpeg();
  }

  if (platform() === "win32") {
    return captureWindowsWebcamJpeg();
  }

  throw new Error(
    `Webcam snapshot is only supported on macOS and Windows (got ${platform()}). ` +
      "Use an ESP32-CAM URL in VITE_HTTP_CAMERA_URL instead."
  );
}

async function captureMacWebcamJpeg(): Promise<Buffer> {
  const device = process.env.MAC_CAMERA_DEVICE?.trim() || "0";
  return runFfmpegSnapshot([
    "-f",
    "avfoundation",
    "-video_size",
    "640x480",
    "-framerate",
    "30",
    "-i",
    device,
  ]);
}

async function captureWindowsWebcamJpeg(): Promise<Buffer> {
  const device =
    process.env.WIN_CAMERA_DEVICE?.trim() ||
    process.env.CAMERA_DEVICE?.trim() ||
    (await detectWindowsCameraDevice());

  return runFfmpegSnapshot([
    "-f",
    "dshow",
    "-video_size",
    "640x480",
    "-i",
    `video=${device}`,
  ]);
}

async function detectWindowsCameraDevice(): Promise<string> {
  let output = "";

  try {
    const { stderr } = await execFileAsync(
      FFMPEG,
      ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
    );
    output = stderr;
  } catch (error) {
    const execError = error as { stderr?: string };
    output = execError.stderr ?? "";
    if (!output) {
      const hint =
        "Install ffmpeg (winget install Gyan.FFmpeg). " +
        "List cameras: ffmpeg -list_devices true -f dshow -i dummy. " +
        "Set WIN_CAMERA_DEVICE to your camera name in server/.env";
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Windows camera detection failed. ${message}. ${hint}`);
    }
  }

  const devices = parseDshowVideoDevices(output);
  if (devices.length === 0) {
    throw new Error(
      "No DirectShow video devices found. Set WIN_CAMERA_DEVICE in server/.env"
    );
  }

  const physical = devices.filter(
    (name) => !/broadcast|obs|virtual/i.test(name)
  );
  return physical[0] ?? devices[0];
}

function parseDshowVideoDevices(output: string): string[] {
  const devices: string[] = [];

  for (const line of output.split("\n")) {
    const match = line.match(/"([^"]+)"\s*\(video\)/i);
    if (match) {
      devices.push(match[1]);
    }
  }

  return devices;
}

async function runFfmpegSnapshot(inputArgs: string[]): Promise<Buffer> {
  try {
    const { stdout } = await execFileAsync(
      FFMPEG,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        ...inputArgs,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ],
      {
        encoding: "buffer",
        maxBuffer: 15 * 1024 * 1024,
        timeout: 20_000,
      }
    );

    if (!stdout || stdout.length < 100) {
      throw new Error("ffmpeg returned an empty image");
    }

    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      throw new Error(
        "ffmpeg not found. Install it (winget install Gyan.FFmpeg) or set FFMPEG_PATH in server/.env"
      );
    }

    throw new Error(`Webcam capture failed: ${message}`);
  }
}
