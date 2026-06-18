/** G2 TextContainer upgrade content limit (Even Hub SDK). */
export const G2_MAX_TEXT_CHARS = 2000;

export const VISION_PROMPT_REQUIREMENTS =
  "Requirements: No bolds and italics, concise response";

export function augmentVisionPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  if (!trimmed) {
    return VISION_PROMPT_REQUIREMENTS;
  }
  if (trimmed.includes(VISION_PROMPT_REQUIREMENTS)) {
    return trimmed;
  }
  return `${trimmed}\n\n${VISION_PROMPT_REQUIREMENTS}`;
}

/** Remove markdown markers so lens text stays plain. */
export function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

export function clampG2Text(text: string, maxChars = G2_MAX_TEXT_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }

  return text.slice(0, maxChars);
}
