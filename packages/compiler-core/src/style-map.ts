import type { ParagraphAlignment, RoleStyleTokens, SlideSnapshot, StyleMap } from "@magistrat/shared-types";
import { inferRoles } from "./role-inference.js";

export interface BuildStyleMapResult {
  styleMap: StyleMap;
  normalizedTokens: number;
}

export function buildStyleMap(
  exemplarSlide: SlideSnapshot,
  mode: "original" | "token_normalized"
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
      bulletHanging: shape.paragraphs[0]?.bulletHanging,
      bulletGlyph: shape.paragraphs[0]?.bulletGlyph,
      alignment: selectDominantAlignment(shape.paragraphs),
      ...(role === "CALLOUT" && shape.fillColor !== undefined ? { fillColor: shape.fillColor } : {})
    };

    styleMap[role] = mode === "token_normalized" ? normalizeTokens(baseTokens) : baseTokens;
    if (mode === "token_normalized") {
      normalizedTokens += 1;
    }
  }

  augmentLayoutBands(styleMap, inferredSlide);

  return {
    styleMap,
    normalizedTokens
  };
}

function augmentLayoutBands(styleMap: StyleMap, inferredSlide: SlideSnapshot): void {
  const titleShapes = inferredSlide.shapes.filter(
    (shape) =>
      shape.inferredRole === "TITLE" &&
      shape.textRuns.length > 0 &&
      shape.geometry.width * shape.geometry.height > 0
  );
  const footerShapes = inferredSlide.shapes.filter(
    (shape) =>
      shape.inferredRole === "FOOTER" &&
      shape.textRuns.length > 0 &&
      shape.geometry.width * shape.geometry.height > 0
  );

  const titleEntry = styleMap.TITLE;
  if (titleEntry && titleShapes.length > 0) {
    let sumX = 0;
    let sumY = 0;
    for (const shape of titleShapes) {
      const g = shape.geometry;
      sumX += g.left + g.width / 2;
      sumY += g.top + g.height / 2;
    }
    titleEntry.geometryCentroid = {
      x: sumX / titleShapes.length,
      y: sumY / titleShapes.length
    };
    titleEntry.hasGeometryCluster = true;
  } else if (titleEntry) {
    titleEntry.hasGeometryCluster = false;
  }

  const footerEntry = styleMap.FOOTER;
  if (footerEntry && footerShapes.length > 0) {
    const tops = [...footerShapes.map((s) => s.geometry.top)].sort((a, b) => a - b);
    const mid = Math.floor(tops.length / 2);
    footerEntry.footerTopMedian =
      tops.length % 2 === 1 ? tops[mid]! : (tops[mid - 1]! + tops[mid]!) / 2;
    footerEntry.hasGeometryCluster = true;
  } else if (footerEntry) {
    footerEntry.hasGeometryCluster = false;
  }

  const breadcrumbCandidates = inferredSlide.shapes.filter((shape) => {
    if (shape.inferredRole !== "UNKNOWN" || shape.textRuns.length === 0) {
      return false;
    }
    const g = shape.geometry;
    if (g.width * g.height <= 0) {
      return false;
    }
    if (g.top >= 60 || g.left >= 200) {
      return false;
    }
    return shape.textRuns.some((run) => run.fontSizePt <= 13);
  });

  if (breadcrumbCandidates.length > 0) {
    const lefts = [...breadcrumbCandidates.map((s) => s.geometry.left)].sort((a, b) => a - b);
    const tops = [...breadcrumbCandidates.map((s) => s.geometry.top)].sort((a, b) => a - b);
    const midL = Math.floor(lefts.length / 2);
    const midT = Math.floor(tops.length / 2);
    const medianLeft =
      lefts.length % 2 === 1 ? lefts[midL]! : (lefts[midL - 1]! + lefts[midL]!) / 2;
    const medianTop =
      tops.length % 2 === 1 ? tops[midT]! : (tops[midT - 1]! + tops[midT]!) / 2;
    styleMap.breadcrumbBand = { left: medianLeft, top: medianTop };
  }
}

/** Majority paragraph alignment; deterministic tie-break by lexicographic order. */
export function selectDominantAlignment(
  paragraphs: Array<{ alignment?: ParagraphAlignment | undefined }>
): ParagraphAlignment | undefined {
  const counts = new Map<string, number>();
  for (const p of paragraphs) {
    if (p.alignment) {
      counts.set(p.alignment, (counts.get(p.alignment) ?? 0) + 1);
    }
  }
  if (counts.size === 0) {
    return undefined;
  }
  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });
  return sorted[0]![0] as ParagraphAlignment;
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
    bulletHanging: tokens.bulletHanging !== undefined ? roundToHalf(tokens.bulletHanging) : undefined,
    bulletGlyph: tokens.bulletGlyph !== undefined ? tokens.bulletGlyph.trim() : undefined,
    fillColor: tokens.fillColor !== undefined ? tokens.fillColor.trim() : undefined,
    alignment: tokens.alignment
  };
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}
