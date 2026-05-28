import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Capture one JPEG frame from the Mac webcam via ffmpeg (dev helper for G2 on iPhone). */
export async function captureMacWebcamJpeg(): Promise<Buffer> {
  const device = process.env.MAC_CAMERA_DEVICE?.trim() || "0";

  try {
    const { stdout } = await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "avfoundation",
        "-video_size",
        "640x480",
        "-framerate",
        "30",
        "-i",
        device,
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
    const hint =
      "Install ffmpeg: brew install ffmpeg. List cameras: ffmpeg -f avfoundation -list_devices true -i \"\"";
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Mac webcam capture failed. ${message}. ${hint}`);
  }
}
