import { execFile, execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let ffmpegPath: string | undefined;

function resolveFfmpegPath(): string {
  if (ffmpegPath) {
    return ffmpegPath;
  }

  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    ffmpegPath = fromEnv;
    return ffmpegPath;
  }

  if (platform() === "win32") {
    const fromWhere = findFfmpegWithWhere();
    if (fromWhere) {
      ffmpegPath = fromWhere;
      return ffmpegPath;
    }

    const fromWinget = findWingetFfmpeg();
    if (fromWinget) {
      ffmpegPath = fromWinget;
      return ffmpegPath;
    }
  }

  ffmpegPath = "ffmpeg";
  return ffmpegPath;
}

function findFfmpegWithWhere(): string | null {
  try {
    const output = execFileSync("where.exe", ["ffmpeg"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();

    const first = output.split(/\r?\n/).find((line) => line.trim().length > 0);
    if (first && existsSync(first.trim())) {
      return first.trim();
    }
  } catch {
    // where.exe failed — try other discovery methods
  }

  return null;
}

function findWingetFfmpeg(): string | null {
  const packagesDir = join(
    homedir(),
    "AppData",
    "Local",
    "Microsoft",
    "WinGet",
    "Packages"
  );

  if (!existsSync(packagesDir)) {
    return null;
  }

  for (const pkg of readdirSync(packagesDir)) {
    if (!pkg.toLowerCase().includes("ffmpeg")) {
      continue;
    }

    const candidate = join(packagesDir, pkg);
    const found = findFileNamed(candidate, "ffmpeg.exe", 5);
    if (found) {
      return found;
    }
  }

  return null;
}

function findFileNamed(
  dir: string,
  fileName: string,
  maxDepth: number
): string | null {
  if (maxDepth < 0 || !existsSync(dir)) {
    return null;
  }

  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((entry) =>
      entry.isDirectory() ? `${entry.name}/` : entry.name
    );
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (entry === fileName) {
      const full = join(dir, entry);
      return existsSync(full) ? full : null;
    }
  }

  for (const entry of entries) {
    if (!entry.endsWith("/")) {
      continue;
    }

    const found = findFileNamed(join(dir, entry.slice(0, -1)), fileName, maxDepth - 1);
    if (found) {
      return found;
    }
  }

  return null;
}

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
  const ffmpeg = resolveFfmpegPath();
  let output = "";

  try {
    const { stderr } = await execFileAsync(
      ffmpeg,
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
  const ffmpeg = resolveFfmpegPath();

  try {
    const { stdout } = await execFileAsync(
      ffmpeg,
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
