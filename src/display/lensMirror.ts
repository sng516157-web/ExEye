import type { ViewfinderLayout } from "./g2Layout";
import { formatG2Header } from "./displayUi";
import type { DisplayUpdate } from "./displayUi";
import { stripMarkdownFormatting } from "../utils/markdown";
import { createViewfinderPreviewUrl } from "../utils/g2Image";

let viewfinderObjectUrl: string | undefined;

export function updateLensMirror(
  root: ParentNode,
  update: DisplayUpdate
): void {
  const screen = root.querySelector("#exeye-screen");
  const hdr = root.querySelector("#exeye-g2-hdr");
  const promptEl = root.querySelector<HTMLElement>("#exeye-g2-prompt");
  const body = root.querySelector("#exeye-g2-body");

  screen?.setAttribute("data-phase", update.phase);

  if (hdr) {
    hdr.textContent = formatG2Header(update.phase);
  }

  const prompt = stripMarkdownFormatting(update.prompt?.trim() ?? "");

  if (promptEl) {
    if (prompt) {
      promptEl.textContent = prompt;
      promptEl.removeAttribute("hidden");
    } else {
      promptEl.textContent = "";
      promptEl.hidden = true;
    }
  }

  if (body) {
    body.textContent = stripMarkdownFormatting(update.message);
  }
}

export function updateViewfinderMirror(
  root: ParentNode,
  image: Blob,
  layout: ViewfinderLayout
): void {
  const img = root.querySelector<HTMLImageElement>("#exeye-vf-image");
  const frame = root.querySelector<HTMLElement>("#exeye-vf-frame");
  const placeholder = root.querySelector<HTMLElement>("#exeye-vf-placeholder");

  if (!img && !frame) {
    return;
  }

  if (viewfinderObjectUrl) {
    URL.revokeObjectURL(viewfinderObjectUrl);
  }

  viewfinderObjectUrl = createViewfinderPreviewUrl(image);
  const url = viewfinderObjectUrl;

  const aspectRatio = layout.image.width / layout.image.height;

  if (frame) {
    frame.classList.add("exeye-lens__vf-frame--has-image");
    frame.style.aspectRatio = String(aspectRatio);
    frame.style.width = "100%";
    frame.style.maxWidth = "100%";
    frame.style.backgroundImage = `url("${url}")`;
  }

  if (img) {
    img.onload = () => {
      img.classList.add("exeye-lens__vf-image--visible");
      img.removeAttribute("hidden");
    };
    img.onerror = () => {
      console.warn("[ExEye] viewfinder <img> failed to load frame");
    };
    img.src = url;
    img.classList.add("exeye-lens__vf-image--visible");
    img.removeAttribute("hidden");
  }

  if (placeholder) {
    placeholder.hidden = true;
  }
}

export function revokeViewfinderMirror(): void {
  if (viewfinderObjectUrl) {
    URL.revokeObjectURL(viewfinderObjectUrl);
    viewfinderObjectUrl = undefined;
  }
}
