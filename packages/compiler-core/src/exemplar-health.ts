import type { SlideSnapshot } from "@magistrat/shared-types";

export interface ExemplarHealthScore {
  score: number;
  buckets: {
    roleSeparability: number;
    tokenStability: number;
    geometryCoherence: number;
    hygiene: number;
  };
  grade: "great" | "ok" | "risky" | "block";
  notes: string[];
}

export function scoreExemplarHealth(slide: SlideSnapshot): ExemplarHealthScore {
  const roleSeparability = scoreRoleSeparability(slide);
  const tokenStability = scoreTokenStability(slide);
  const geometryCoherence = scoreGeometryCoherence(slide);
  const hygiene = scoreHygiene(slide);

  const score = clampTotalScore(roleSeparability + tokenStability + geometryCoherence + hygiene);
  const grade = score >= 80 ? "great" : score >= 60 ? "ok" : score >= 40 ? "risky" : "block";

  const notes: string[] = [];
  if (tokenStability < 15) {
    notes.push("Mixed token stability detected. Normalization is recommended.");
  }
  if (hygiene < 15) {
    notes.push("Potential ghost/placeholder artifacts found.");
  }

  return {
    score,
    buckets: {
      roleSeparability,
      tokenStability,
      geometryCoherence,
      hygiene
    },
    grade,
    notes
  };
}

function scoreRoleSeparability(slide: SlideSnapshot): number {
  const topFonts = slide.shapes
    .map((shape) => shape.textRuns[0]?.fontSizePt ?? 0)
    .filter((size) => size > 0)
    .sort((a, b) => b - a);

  if (topFonts.length < 2) {
    return 10;
  }

  const largest = topFonts[0];
  const smallest = topFonts[topFonts.length - 1];
  if (largest === undefined || smallest === undefined) {
    return 10;
  }

  const span = largest - smallest;
  return clampBucketScore(Math.round(Math.min(25, span * 1.2)));
}

function scoreTokenStability(slide: SlideSnapshot): number {
  const tokenCounts = new Map<string, number>();
  let total = 0;

  for (const shape of slide.shapes) {
    for (const run of shape.textRuns) {
      const key = `${run.fontFamily}|${run.fontSizePt}|${run.bold}|${run.italic}|${run.fontColor}`;
      tokenCounts.set(key, (tokenCounts.get(key) ?? 0) + 1);
      total += 1;
    }
  }

  if (total === 0) {
    return 0;
  }

  const dominant = Math.max(...tokenCounts.values());
  const dominantRatio = dominant / total;
  return clampBucketScore(Math.round(dominantRatio * 25));
}

function scoreGeometryCoherence(slide: SlideSnapshot): number {
  const tops = slide.shapes.map((shape) => shape.geometry.top).sort((a, b) => a - b);
  if (tops.length < 2) {
    return 12;
  }

  const median = tops[Math.floor(tops.length / 2)];
  if (median === undefined) {
    return 12;
  }

  const deviations = tops.map((top) => Math.abs(top - median));
  const mad = deviations[Math.floor(deviations.length / 2)];
  if (mad === undefined) {
    return 12;
  }

  return clampBucketScore(Math.max(0, Math.round(25 - mad / 4)));
}

function scoreHygiene(slide: SlideSnapshot): number {
  let penalty = 0;
  for (const shape of slide.shapes) {
    const text = shape.textRuns.map((run) => run.text).join(" ").trim().toLowerCase();
    if (!shape.visible) {
      penalty += 5;
    }
    if (text.includes("click to add") || text.includes("lorem ipsum")) {
      penalty += 8;
    }
    const offSlide =
      shape.geometry.left + shape.geometry.width < 0 ||
      shape.geometry.top + shape.geometry.height < 0 ||
      shape.geometry.left > 1920 ||
      shape.geometry.top > 1080;

    if (offSlide) {
      penalty += 4;
    }
  }

  return clampBucketScore(Math.max(0, 25 - penalty));
}

function clampBucketScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 25) {
    return 25;
  }
  return value;
}

function clampTotalScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}
