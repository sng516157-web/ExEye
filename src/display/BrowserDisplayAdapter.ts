import "../ui/browser.css";

import { bindPromptPanel, PROMPT_PANEL_HTML } from "../ui/promptPanel";
import { DisplayAdapter, DisplayControls } from "./DisplayAdapter";
import {
  normalizeDisplayUpdate,
  phaseStatusHint,
  type DisplayPhase,
  type DisplayUpdate,
} from "./displayUi";
import { computeViewfinderLayout, renderG2LensMarkup } from "./g2Layout";
import {
  revokeViewfinderMirror,
  updateLensMirror,
  updateViewfinderMirror,
} from "./lensMirror";
import { readImageDimensions } from "../utils/g2Image";

export class BrowserDisplayAdapter implements DisplayAdapter {
  name = "browser";

  constructor(private readonly root: HTMLElement) {}

  async init(): Promise<void> {
    this.root.innerHTML = `
      <div class="exeye-app">
        <header class="exeye-brand">
          <h1>ExEye</h1>
          <span class="exeye-badge exeye-badge--browser">Browser</span>
        </header>

        <section class="exeye-g2-frame" aria-label="G2 display preview">
          <div class="exeye-g2-label">G2 lens preview</div>
          ${renderG2LensMarkup()}
        </section>

        ${PROMPT_PANEL_HTML}

        <div class="exeye-status-row">
          <span class="exeye-dot" id="exeye-dot"></span>
          <span id="exeye-status-label">Ready</span>
        </div>

        <div class="exeye-actions">
          <button type="button" class="exeye-btn exeye-btn--primary" id="exeye-analyse">
            Analyse scene
          </button>
          <button type="button" class="exeye-btn" id="exeye-toggle-periodic" aria-pressed="false">
            Periodic scan
          </button>
        </div>

        <p class="exeye-hint">
          Mirrors what you would see on the glasses. On real G2 hardware, use tap to analyse and double-tap to exit.
        </p>
      </div>
    `;
  }

  async showText(input: string | DisplayUpdate): Promise<void> {
    const update = normalizeDisplayUpdate(input);

    updateLensMirror(this.root, update);

    const label = document.getElementById("exeye-status-label");
    const dot = document.getElementById("exeye-dot");

    if (label) {
      label.textContent = statusLabel(update.phase);
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

  async showViewfinder(image: Blob): Promise<void> {
    const { width, height } = await readImageDimensions(image);
    const layout = computeViewfinderLayout(width, height);
    updateViewfinderMirror(this.root, image, layout);
  }

  bindControls(handlers: DisplayControls): void {
    const analyseBtn = document.getElementById("exeye-analyse");
    const periodicBtn = document.getElementById("exeye-toggle-periodic");

    analyseBtn?.addEventListener("click", () => handlers.onAnalyse());

    periodicBtn?.addEventListener("click", () => {
      const pressed = periodicBtn.getAttribute("aria-pressed") === "true";
      periodicBtn.setAttribute("aria-pressed", pressed ? "false" : "true");
      handlers.onTogglePeriodic?.();
    });

    if (handlers.prompt) {
      bindPromptPanel(this.root, handlers.prompt);
    }
  }

  async shutdown(): Promise<void> {
    revokeViewfinderMirror();
  }
}

function statusLabel(phase: DisplayPhase): string {
  return phaseStatusHint(phase);
}
