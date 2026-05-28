import type { PromptControls } from "../display/DisplayAdapter";

export const PROMPT_PANEL_HTML = `
  <section class="exeye-prompt-panel" aria-label="Vision prompt">
    <label class="exeye-prompt-label" for="exeye-prompt">
      Custom prompt
    </label>
    <p class="exeye-prompt-hint">
      Set this on your phone before you tap the temple or ring to analyse.
    </p>
    <textarea
      id="exeye-prompt"
      class="exeye-prompt-input"
      rows="4"
      spellcheck="true"
    ></textarea>
    <button type="button" class="exeye-btn" id="exeye-prompt-apply">
      Save prompt
    </button>
    <p class="exeye-prompt-status" id="exeye-prompt-status" aria-live="polite"></p>
  </section>
`;

export function bindPromptPanel(
  root: ParentNode,
  controls: PromptControls
): void {
  const textarea = root.querySelector("#exeye-prompt");
  const applyBtn = root.querySelector("#exeye-prompt-apply");
  const status = root.querySelector("#exeye-prompt-status");

  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  textarea.value = controls.getPrompt();

  const apply = () => {
    controls.setPrompt(textarea.value);
    if (status) {
      status.textContent = "Prompt saved — tap temple/ring to analyse.";
    }
  };

  applyBtn?.addEventListener("click", apply);

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      apply();
    }
  });
}
