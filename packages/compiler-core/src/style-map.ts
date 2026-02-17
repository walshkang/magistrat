import type { RoleStyleTokens, SlideSnapshot, StyleMap } from "@magistrat/shared-types";
import { inferRoles } from "./role-inference.js";

export interface BuildStyleMapResult {
  styleMap: StyleMap;
  normalizedTokens: number;
}

export function buildStyleMap(
  exemplarSlide: SlideSnapshot,
  mode: "original" | "normalized"
): BuildStyleMapResult {
  const inferred = inferRoles({
    deckId: "exemplar-only",
    generatedAtIso: new Date(0).toISOString(),
    slides: [exemplarSlide]
  });

  const styleMap: StyleMap = {};
  let normalizedTokens = 0;
  const inferredSlide = inferred.deck.slides[0];
  if (!inferredSlide) {
    return { styleMap, normalizedTokens };
  }

  for (const shape of inferredSlide.shapes) {
    const role = shape.inferredRole ?? "UNKNOWN";
    if (role === "UNKNOWN" || shape.textRuns.length === 0) {
      continue;
    }

    const dominant = selectDominantRun(shape.textRuns);
    if (!dominant) {
      continue;
    }

    const baseTokens: RoleStyleTokens = {
      fontFamily: dominant.fontFamily,
      fontSizePt: dominant.fontSizePt,
      bold: dominant.bold,
      italic: dominant.italic,
      fontColor: dominant.fontColor,
      lineSpacing: shape.paragraphs[0]?.lineSpacing,
      bulletIndent: shape.paragraphs[0]?.bulletIndent,
      bulletHanging: shape.paragraphs[0]?.bulletHanging
    };

    styleMap[role] = mode === "normalized" ? normalizeTokens(baseTokens) : baseTokens;
    if (mode === "normalized") {
      normalizedTokens += 1;
    }
  }

  return {
    styleMap,
    normalizedTokens
  };
}

function selectDominantRun(
  runs: Array<{ text: string; fontFamily: string; fontSizePt: number; bold: boolean; italic: boolean; fontColor: string }>
): { text: string; fontFamily: string; fontSizePt: number; bold: boolean; italic: boolean; fontColor: string } | undefined {
  if (runs.length === 0) {
    return undefined;
  }

  return [...runs].sort((a, b) => b.text.length - a.text.length)[0];
}

function normalizeTokens(tokens: RoleStyleTokens): RoleStyleTokens {
  return {
    ...tokens,
    fontFamily: tokens.fontFamily.trim(),
    fontSizePt: roundToHalf(tokens.fontSizePt),
    lineSpacing: tokens.lineSpacing !== undefined ? roundToQuarter(tokens.lineSpacing) : undefined,
    bulletIndent: tokens.bulletIndent !== undefined ? roundToHalf(tokens.bulletIndent) : undefined,
    bulletHanging: tokens.bulletHanging !== undefined ? roundToHalf(tokens.bulletHanging) : undefined
  };
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}
