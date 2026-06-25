import type { PromptControls } from "../display/DisplayAdapter";

export const PROMPT_PANEL_HTML = `
  <section class="exeye-prompt-panel" aria-label="Vision prompt">
    <label class="exeye-prompt-label" for="exeye-prompt">
      Custom prompt
    </label>
    <p class="exeye-prompt-hint">
      Camera runs only for visual questions; other prompts go to AI without the camera.
    </p>
    <textarea
      id="exeye-prompt"
      class="exeye-prompt-input"
      rows="4"
      spellcheck="true"
    ></textarea>
    <div class="exeye-prompt-actions">
      <button type="button" class="exeye-btn" id="exeye-prompt-apply">
        Save prompt
      </button>
      <button
        type="button"
        class="exeye-btn exeye-btn--voice"
        id="exeye-prompt-voice"
        aria-pressed="false"
      >
        Speak prompt
      </button>
    </div>
    <p class="exeye-prompt-status" id="exeye-prompt-status" aria-live="polite"></p>
  </section>
`;

export function bindPromptPanel(
  root: ParentNode,
  controls: PromptControls
): void {
  const textarea = root.querySelector("#exeye-prompt");
  const applyBtn = root.querySelector("#exeye-prompt-apply");
  const voiceBtn = root.querySelector("#exeye-prompt-voice");
  const status = root.querySelector("#exeye-prompt-status");

  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  textarea.value = controls.getPrompt();

  const apply = () => {
    controls.setPrompt(textarea.value);
    if (status) {
      status.textContent = "Prompt saved — tap Analyse or speak via temple/ring.";
    }
  };

  const setVoiceUi = (listening: boolean) => {
    if (!(voiceBtn instanceof HTMLButtonElement)) {
      return;
    }

    voiceBtn.disabled = listening;
    voiceBtn.setAttribute("aria-pressed", listening ? "true" : "false");
    voiceBtn.textContent = listening ? "Listening…" : "Speak prompt";

    if (status) {
      status.textContent = listening
        ? "Speak now — your words appear on the glasses."
        : "";
    }
  };

  applyBtn?.addEventListener("click", apply);

  voiceBtn?.addEventListener("click", () => {
    if (controls.isVoiceListening?.()) {
      return;
    }

    controls.startVoicePrompt?.();
    setVoiceUi(true);

    const poll = window.setInterval(() => {
      if (!controls.isVoiceListening?.()) {
        window.clearInterval(poll);
        setVoiceUi(false);
        textarea.value = controls.getPrompt();
      }
    }, 200);
  });

  if (!controls.startVoicePrompt) {
    voiceBtn?.setAttribute("hidden", "");
  }

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      apply();
    }
  });
}
