import { G2_STATUS_HEADER, G2_STATUS_WRAP_WIDTH } from "./g2Layout";
import { stripMarkdownFormatting } from "../utils/markdown";

export type DisplayPhase =
  | "ready"
  | "capturing"
  | "analysing"
  | "result"
  | "error";

export interface DisplayUpdate {
  phase: DisplayPhase;
  message: string;
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
  capturing: "Capturing…",
  analysing: "Analysing…",
  result: "Latest view",
  error: "Error",
};

export function formatG2Header(_phase?: DisplayPhase): string {
  return G2_STATUS_HEADER;
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
