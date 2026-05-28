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
          <div class="exeye-g2-screen" id="exeye-screen" data-phase="ready">
            <div class="exeye-g2-hdr" id="exeye-g2-hdr">ExEye · READY</div>
            <div class="exeye-g2-body" id="exeye-g2-body">Starting…</div>
          </div>
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
    const { phase, message } = normalizeDisplayUpdate(input);

    const screen = document.getElementById("exeye-screen");
    const hdr = document.getElementById("exeye-g2-hdr");
    const body = document.getElementById("exeye-g2-body");
    const label = document.getElementById("exeye-status-label");
    const dot = document.getElementById("exeye-dot");

    if (screen) {
      screen.setAttribute("data-phase", phase);
    }

    if (hdr) {
      hdr.textContent = formatG2Header(phase);
    }

    if (body) {
      body.textContent = formatG2Body(message);
    }

    if (label) {
      label.textContent = statusLabel(phase);
    }

    if (dot) {
      dot.className = "exeye-dot";
      if (phase === "capturing" || phase === "analysing") {
        dot.classList.add("exeye-dot--busy");
      } else if (phase === "error") {
        dot.classList.add("exeye-dot--error");
      }
    }
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
}

function statusLabel(phase: DisplayPhase): string {
  switch (phase) {
    case "capturing":
      return "Capturing frame…";
    case "analysing":
      return "Analysing scene…";
    case "error":
      return "Error";
    case "result":
      return "Scene summary";
    case "ready":
    default:
      return "Ready — tap or press Analyse";
  }
}
