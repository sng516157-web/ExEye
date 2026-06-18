import { G2_MODE_PREFIX, G2_STATUS_WRAP_WIDTH } from "./g2Layout";
import { stripMarkdownFormatting } from "../utils/markdown";

export type DisplayPhase =
  | "ready"
  | "listening"
  | "capturing"
  | "analysing"
  | "result"
  | "error";

export interface DisplayUpdate {
  phase: DisplayPhase;
  /** Status text or AI response (shown below the prompt line). */
  message: string;
  /** User prompt — persists on lens until replaced by a new voice session. */
  prompt?: string;
}

export function normalizeDisplayUpdate(
  input: string | DisplayUpdate
): DisplayUpdate {
  if (typeof input === "string") {
    return { phase: "result", message: input };
  }

  return input;
}

const PHASE_LABEL: Record<DisplayPhase, string> = {
  ready: "Ready",
  listening: "Listening",
  capturing: "Capturing",
  analysing: "Analysing",
  result: "Result",
  error: "Error",
};

/** Dynamic mode line for G2 status column, e.g. "ExEye · Listening". */
export function formatG2Header(phase: DisplayPhase): string {
  return `${G2_MODE_PREFIX} ${PHASE_LABEL[phase]}`;
}

export function phaseStatusHint(phase: DisplayPhase): string {
  return PHASE_LABEL[phase];
}

export function formatG2Body(
  message: string,
  maxWidth = G2_STATUS_WRAP_WIDTH
): string {
  return wrapText(stripMarkdownFormatting(message.trim()), maxWidth);
}

/** Full status-column text for the G2 TextContainer. */
export function formatG2StatusContent(update: DisplayUpdate): string {
  const lines = [formatG2Header(update.phase)];
  const prompt = update.prompt?.trim();
  const message = formatG2Body(update.message);

  if (prompt) {
    lines.push(formatG2Body(prompt));
  }

  if (message && message !== lines[lines.length - 1]) {
    lines.push(message);
  }

  return lines.join("\n");
}

export function phaseFromLegacyMessage(message: string): DisplayPhase {
  const lower = message.toLowerCase();

  if (lower.includes("capturing")) {
    return "capturing";
  }

  if (lower.includes("analysing") || lower.includes("analyzing")) {
    return "analysing";
  }

  if (lower.startsWith("error") || lower.includes("unreachable")) {
    return "error";
  }

  if (message.includes("ExEye ready") || message.includes("Tap:")) {
    return "ready";
  }

  return "result";
}

function wrapText(text: string, maxWidth: number): string {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      if (word.length > maxWidth) {
        if (line) {
          lines.push(line);
          line = "";
        }

        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.slice(i, i + maxWidth));
        }
        continue;
      }

      const next = line ? `${line} ${word}` : word;

      if (next.length <= maxWidth) {
        line = next;
      } else {
        if (line) {
          lines.push(line);
        }
        line = word;
      }
    }

    if (line) {
      lines.push(line);
    }
  }

  return lines.join("\n") || text;
}
