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
  ready: "READY",
  capturing: "CAPTURE",
  analysing: "ANALYSE",
  result: "VIEW",
  error: "ERROR",
};

export function formatG2Header(phase: DisplayPhase): string {
  return `ExEye · ${PHASE_LABEL[phase]}`;
}

export function formatG2Body(message: string, maxWidth = 48): string {
  return wrapText(message.trim(), maxWidth);
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
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (next.length <= maxWidth) {
      line = next;
    } else {
      if (line) {
        lines.push(line);
      }

      line = word.length > maxWidth ? word.slice(0, maxWidth) : word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.join("\n") || text;
}
