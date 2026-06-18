import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";

import { EXEYE_CONFIG } from "../config";
import "../ui/browser.css";
import { bindPromptPanel, PROMPT_PANEL_HTML } from "../ui/promptPanel";
import { DisplayAdapter, DisplayControls } from "./DisplayAdapter";
import {
  formatG2Body,
  formatG2Header,
  normalizeDisplayUpdate,
  phaseStatusHint,
  type DisplayPhase,
  type DisplayUpdate,
} from "./displayUi";
import {
  computeViewfinderLayout,
  G2_LAYOUT,
  G2_VF_LABEL,
  renderG2LensMarkup,
  VF_FRAME_PAD,
  type ViewfinderLayout,
} from "./g2Layout";
import {
  revokeViewfinderMirror,
  updateLensMirror,
  updateViewfinderMirror,
} from "./lensMirror";
import { clampG2Text } from "../utils/markdown";
import {
  prepareG2ImageBytes,
  readImageDimensions,
} from "../utils/g2Image";

export const EXEYE_STARTUP_TEXT: DisplayUpdate = {
  phase: "ready",
  message: "Tap to analyse\nDouble-tap exit",
};

const STATUS_ID = 1;
const STATUS_NAME = "exeye-status";
const VF_LABEL_ID = 2;
const VF_LABEL_NAME = "exeye-vf-lbl";
const VF_FRAME_ID = 3;
const VF_FRAME_NAME = "exeye-vf-frame";
const VF_IMAGE_ID = 4;
const VF_IMAGE_NAME = "exeye-vf-img";

/** Placeholder 4:3 frame shown before the first capture. */
const PLACEHOLDER_VF_LAYOUT = computeViewfinderLayout(160, 120);

export class EvenG2DisplayAdapter implements DisplayAdapter {
  name = "even-g2";

  private bridge?: EvenAppBridge;
  private unsubscribe?: () => void;
  private handlers?: DisplayControls;
  private imageQueue: Promise<void> = Promise.resolve();
  private statusContent = "";

  constructor(private readonly phoneRoot?: HTMLElement) {}

  bindControls(handlers: DisplayControls): void {
    this.handlers = handlers;

    if (this.phoneRoot && handlers.prompt) {
      bindPromptPanel(this.phoneRoot, handlers.prompt);
    }
  }

  async init(): Promise<void> {
    this.bridge = await waitForEvenAppBridge();

    this.statusContent = clampG2Text(
      `${formatG2Header()}\n${formatG2Body(EXEYE_STARTUP_TEXT.message)}`
    );

    const page = buildPageContainers(this.statusContent, PLACEHOLDER_VF_LAYOUT);

    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 4,
        textObject: page.textObject,
        imageObject: page.imageObject,
      })
    );

    if (result !== 0) {
      throw new Error(
        `EvenHub createStartUpPageContainer failed with code ${result}`
      );
    }

    this.unsubscribe = this.bridge.onEvenHubEvent((event) => {
      void this.handleEvent(event);
    });

    if (this.phoneRoot) {
      this.renderPhoneShell();
      await this.showText(EXEYE_STARTUP_TEXT);
    }
  }

  async showText(input: string | DisplayUpdate): Promise<void> {
    const update = normalizeDisplayUpdate(input);
    this.statusContent = clampG2Text(
      `${formatG2Header()}\n${formatG2Body(update.message)}`
    );

    if (!this.bridge) {
      throw new Error("EvenHub bridge not initialised");
    }

    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: STATUS_ID,
        containerName: STATUS_NAME,
        contentOffset: 0,
        contentLength: this.statusContent.length,
        content: this.statusContent,
      })
    );

    this.updatePhoneMirror(update);
  }

  async showViewfinder(image: Blob): Promise<void> {
    let layout: ViewfinderLayout;

    try {
      const { width, height } = await readImageDimensions(image);
      layout = computeViewfinderLayout(width, height);
    } catch (error) {
      console.error("[ExEye] viewfinder layout failed", error);
      return;
    }

    if (this.phoneRoot) {
      updateViewfinderMirror(this.phoneRoot, image, layout);
    }

    if (!this.bridge) {
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = await prepareG2ImageBytes(
        image,
        layout.image.width,
        layout.image.height
      );
    } catch (error) {
      console.error("[ExEye] viewfinder image prepare failed", error);
      return;
    }

    const page = buildPageContainers(this.statusContent, layout);
    const rebuilt = await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 4,
        textObject: page.textObject,
        imageObject: page.imageObject,
      })
    );

    if (!rebuilt) {
      console.warn("[ExEye] G2 viewfinder page rebuild failed");
      return;
    }

    this.imageQueue = this.imageQueue.then(async () => {
      const result = await this.bridge!.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: VF_IMAGE_ID,
          containerName: VF_IMAGE_NAME,
          imageData: bytes,
        })
      );

      if (result !== ImageRawDataUpdateResult.success) {
        console.warn("[ExEye] G2 viewfinder upload failed:", result);
      }
    });

    await this.imageQueue;
  }

  async shutdown(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    revokeViewfinderMirror();

    if (this.bridge) {
      await this.bridge.shutDownPageContainer(0);
    }
  }

  private renderPhoneShell(): void {
    if (!this.phoneRoot) {
      return;
    }

    this.phoneRoot.innerHTML = `
      <div class="exeye-app">
        <header class="exeye-brand">
          <h1>ExEye</h1>
          <span class="exeye-badge">G2 connected</span>
        </header>

        <section class="exeye-g2-frame" aria-label="On-lens display">
          <div class="exeye-g2-label">On your glasses now</div>
          ${renderG2LensMarkup()}
        </section>

        ${PROMPT_PANEL_HTML}

        <div class="exeye-status-row">
          <span class="exeye-dot" id="exeye-dot"></span>
          <span id="exeye-status-label">Ready</span>
        </div>

        <p class="exeye-hint">
          Camera: <strong>${EXEYE_CONFIG.cameraMode}</strong>.
          Save your prompt above, then tap temple or ring to analyse. Double-tap to exit.
        </p>
      </div>
    `;
  }

  private updatePhoneMirror(update: DisplayUpdate): void {
    if (!this.phoneRoot) {
      return;
    }

    updateLensMirror(this.phoneRoot, update);

    const label = this.phoneRoot.querySelector("#exeye-status-label");
    const dot = this.phoneRoot.querySelector("#exeye-dot");

    if (label) {
      label.textContent = phoneStatusLabel(update.phase);
    }

    if (dot) {
      dot.className = "exeye-dot";
      if (update.phase === "capturing" || update.phase === "analysing") {
        dot.classList.add("exeye-dot--busy");
      } else if (update.phase === "error") {
        dot.classList.add("exeye-dot--error");
      }
    }
  }

  private async handleEvent(event: EvenHubEvent): Promise<void> {
    const eventType = normalizeEventType(getRawEventType(event));

    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      await this.handlers?.onExit?.();
      return;
    }

    if (
      eventType === OsEventTypeList.CLICK_EVENT ||
      eventType === undefined
    ) {
      this.handlers?.onAnalyse();
    }
  }
}

function buildPageContainers(
  statusContent: string,
  vfLayout: ViewfinderLayout
): {
  textObject: TextContainerProperty[];
  imageObject: ImageContainerProperty[];
} {
  const status = new TextContainerProperty({
    containerID: STATUS_ID,
    containerName: STATUS_NAME,
    content: statusContent,
    xPosition: G2_LAYOUT.status.x,
    yPosition: G2_LAYOUT.status.y,
    width: G2_LAYOUT.status.width,
    height: G2_LAYOUT.status.height,
    borderWidth: 0,
    isEventCapture: 1,
  });

  const vfLabel = new TextContainerProperty({
    containerID: VF_LABEL_ID,
    containerName: VF_LABEL_NAME,
    content: G2_VF_LABEL,
    xPosition: G2_LAYOUT.vfLabel.x,
    yPosition: G2_LAYOUT.vfLabel.y,
    width: G2_LAYOUT.vfLabel.width,
    height: G2_LAYOUT.vfLabel.height,
    borderWidth: 0,
    paddingLength: 0,
    isEventCapture: 0,
  });

  const vfFrame = new TextContainerProperty({
    containerID: VF_FRAME_ID,
    containerName: VF_FRAME_NAME,
    content: " ",
    xPosition: vfLayout.frame.x,
    yPosition: vfLayout.frame.y,
    width: vfLayout.frame.width,
    height: vfLayout.frame.height,
    borderWidth: 1,
    borderColor: 12,
    borderRadius: 2,
    paddingLength: VF_FRAME_PAD,
    isEventCapture: 0,
  });

  const vfImage = new ImageContainerProperty({
    containerID: VF_IMAGE_ID,
    containerName: VF_IMAGE_NAME,
    xPosition: vfLayout.image.x,
    yPosition: vfLayout.image.y,
    width: vfLayout.image.width,
    height: vfLayout.image.height,
  });

  return {
    textObject: [status, vfLabel, vfFrame],
    imageObject: [vfImage],
  };
}

function phoneStatusLabel(phase: DisplayPhase): string {
  return phaseStatusHint(phase);
}

function getRawEventType(event: EvenHubEvent): unknown {
  const e = event as Record<string, unknown>;
  const listEvt = e.listEvent as Record<string, unknown> | undefined;
  const textEvt = e.textEvent as Record<string, unknown> | undefined;
  const sysEvt = e.sysEvent as Record<string, unknown> | undefined;

  const fromTyped =
    listEvt?.eventType ??
    listEvt?.EventType ??
    textEvt?.eventType ??
    textEvt?.EventType;

  if (fromTyped !== undefined && fromTyped !== null) {
    return fromTyped;
  }

  if (sysEvt !== undefined && sysEvt !== null) {
    const fromSys = sysEvt.eventType ?? sysEvt.EventType;
    if (fromSys !== undefined && fromSys !== null) {
      return fromSys;
    }
    return OsEventTypeList.CLICK_EVENT;
  }

  return e.eventType ?? e.EventType;
}

function normalizeEventType(rawEventType: unknown): number | undefined {
  if (typeof rawEventType === "number") {
    if (rawEventType >= 0 && rawEventType <= 8) {
      return rawEventType;
    }
    return undefined;
  }

  if (typeof rawEventType === "string") {
    const value = rawEventType.toUpperCase();
    if (value.includes("DOUBLE")) {
      return OsEventTypeList.DOUBLE_CLICK_EVENT;
    }
    if (value.includes("CLICK")) {
      return OsEventTypeList.CLICK_EVENT;
    }
  }

  return undefined;
}
