import { DEFAULT_VISION_PROMPT } from "../config";

const DEFAULT_VISUAL_MARKERS = [
  "navigation-relevant visual",
  "visual information",
] as const;

const VISUAL_PATTERNS: RegExp[] = [
  /\bwhat (?:do you |can you )?see\b/,
  /\bwhat(?:'s| is) (?:in front|ahead|around|there|this|that)\b/,
  /\b(?:see|look(?:ing)?|view(?:ing)?|watch(?:ing)?)\b/,
  /\b(?:describe|identify|recogni[sz]e|detect|spot)\b/,
  /\b(?:scene|surroundings?|environment|room|path ahead)\b/,
  /\b(?:in front of me|ahead of me|around me)\b/,
  /\bread (?:the |this )?(?:sign|label|text|screen|menu|writing)\b/,
  /\b(?:obstacle|hazard|doorway|door|stairs|step|curb|crosswalk|traffic|sign|exit)\b/,
  /\bnavigat\w*\b/,
  /\b(?:camera|capture|frame|photo|picture|image)\b/,
  /\bhow many\b/,
  /\bwhat color\b/,
  /\bwhere (?:is|are) (?:the |a |an )?\w+/,
  /\bis there (?:a |an )?\w+/,
  /\bcan i (?:walk|go|proceed|cross)\b/,
  /\bsafe to (?:cross|walk|go)\b/,
  /\btell me what you see\b/,
  /\bwhat(?:'s| is) blocking\b/,
  /\banything (?:in the way|ahead)\b/,
];

const NON_VISUAL_PATTERNS: RegExp[] = [
  /\b(?:weather|forecast|temperature)\b/,
  /\b(?:joke|poem|story|trivia|riddle)\b/,
  /\b(?:remind|timer|alarm|calendar|schedule)\b/,
  /\b(?:calculate|math|arithmetic)\b/,
  /\b\d+\s*[\+\-\*\/]\s*\d+\b/,
  /\bwhat(?:'s| is) the (?:time|date)\b/,
  /\bwhat time\b/,
  /\bwho (?:is|was|are|were)\b(?!\s+(?:in|on)\s+(?:this|the)\s+(?:image|photo|picture|screen))/,
  /\bdefine\b/,
  /\bmeaning of\b/,
  /\btranslate\b(?!\s+(?:the |this )?(?:sign|text|label|writing|screen))/,
  /\bhow do i (?:say|spell)\b/,
  /\bnews\b/,
  /\bstock price\b/,
];

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesDefaultVisualPrompt(prompt: string): boolean {
  const normalized = normalizePrompt(prompt);
  const defaultNormalized = normalizePrompt(DEFAULT_VISION_PROMPT);

  if (normalized === defaultNormalized) {
    return true;
  }

  return DEFAULT_VISUAL_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * True when the prompt asks for scene/image understanding (camera + vision API).
 */
export function promptNeedsVision(prompt: string): boolean {
  const text = normalizePrompt(prompt);

  if (!text) {
    return false;
  }

  if (matchesDefaultVisualPrompt(text)) {
    return true;
  }

  if (VISUAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (NON_VISUAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return false;
  }

  return false;
}
