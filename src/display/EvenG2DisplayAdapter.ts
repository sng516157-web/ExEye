import {
  CreateStartUpPageContainer,
  OsEventTypeList,
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
  type DisplayPhase,
  type DisplayUpdate,
} from "./displayUi";

export const EXEYE_STARTUP_TEXT: DisplayUpdate = {
  phase: "ready",
  message: "Set prompt on phone\nTap to analyse\nDouble-tap exit",
};

const HDR_ID = 1;
const HDR_NAME = "exeye-hdr";
const BODY_ID = 2;
const BODY_NAME = "exeye-body";

export class EvenG2DisplayAdapter implements DisplayAdapter {
  name = "even-g2";

  private bridge?: EvenAppBridge;
  private unsubscribe?: () => void;
  private handlers?: DisplayControls;

  constructor(private readonly phoneRoot?: HTMLElement) {}

  bindControls(handlers: DisplayControls): void {
    this.handlers = handlers;

    if (this.phoneRoot && handlers.prompt) {
      bindPromptPanel(this.phoneRoot, handlers.prompt);
    }
  }

  async init(): Promise<void> {
    this.bridge = await waitForEvenAppBridge();

    const header = new TextContainerProperty({
      containerID: HDR_ID,
      containerName: HDR_NAME,
      content: formatG2Header("ready"),
      xPosition: 8,
      yPosition: 4,
      width: 560,
      height: 32,
      borderWidth: 0,
      isEventCapture: 0,
    });

    const body = new TextContainerProperty({
      containerID: BODY_ID,
      containerName: BODY_NAME,
      content: formatG2Body(EXEYE_STARTUP_TEXT.message),
      xPosition: 8,
      yPosition: 40,
      width: 560,
      height: 244,
      borderWidth: 0,
      isEventCapture: 1,
    });

    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [header, body],
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

    if (!this.bridge) {
      throw new Error("EvenHub bridge not initialised");
    }

    await Promise.all([
      this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: HDR_ID,
          containerName: HDR_NAME,
          contentOffset: 0,
          contentLength: 64,
          content: formatG2Header(update.phase),
        })
      ),
      this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: BODY_ID,
          containerName: BODY_NAME,
          contentOffset: 0,
          contentLength: 2000,
          content: formatG2Body(update.message),
        })
      ),
    ]);

    this.updatePhoneMirror(update);
  }

  async shutdown(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = undefined;

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
          <div class="exeye-g2-screen" id="exeye-screen" data-phase="ready">
            <div class="exeye-g2-hdr" id="exeye-g2-hdr">ExEye · READY</div>
            <div class="exeye-g2-body" id="exeye-g2-body"></div>
          </div>
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

    const screen = this.phoneRoot.querySelector("#exeye-screen");
    const hdr = this.phoneRoot.querySelector("#exeye-g2-hdr");
    const body = this.phoneRoot.querySelector("#exeye-g2-body");
    const label = this.phoneRoot.querySelector("#exeye-status-label");
    const dot = this.phoneRoot.querySelector("#exeye-dot");

    screen?.setAttribute("data-phase", update.phase);

    if (hdr) {
      hdr.textContent = formatG2Header(update.phase);
    }

    if (body) {
      body.textContent = formatG2Body(update.message);
    }

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

function phoneStatusLabel(phase: DisplayPhase): string {
  switch (phase) {
    case "capturing":
      return "Capturing…";
    case "analysing":
      return "Analysing…";
    case "error":
      return "Error";
    case "result":
      return "Latest view";
    default:
      return "Ready";
  }
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
