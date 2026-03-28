import type { CoverageSnapshot, Finding } from "@magistrat/shared-types";

export interface AlignmentScore {
  /** 0–100, rounded integer */
  score: number;
  /** Objects that were analyzed (denominator) */
  analyzedObjects: number;
  /** Objects with zero actionable findings */
  passingObjects: number;
  /** analyzedObjects - passingObjects */
  failingObjects: number;
}

function objectKey(slideId: string, objectId: string): string {
  return `${slideId}:${objectId}`;
}

/**
 * Computes alignment score from findings and coverage.
 *
 * Formula: score = passingObjects / analyzedObjects * 100, where passingObjects =
 * analyzedObjects minus unique analyzed objects that have at least one ANALYZED finding.
 *
 * Rules:
 * - Only findings with coverage === "ANALYZED" count toward failing objects.
 *   NOT_ANALYZED findings are excluded entirely.
 * - Per-object dedup: multiple findings on the same object count as one failing object.
 *   Object identity = slideId + objectId (objectId required; see below).
 * - If analyzedObjects === 0, score = 100 (nothing to fail).
 *
 * Slide-scoped ANALYZED findings without objectId (e.g. some continuity rules) do not
 * affect this score, so the denominator stays consistent with coverage.analyzedObjects
 * (supported shapes only). A future contract could fold those in explicitly.
 */
export function computeAlignmentScore(
  findings: Finding[],
  coverage: CoverageSnapshot,
  ignoredFindingIds?: ReadonlySet<string>
): AlignmentScore {
  const analyzedObjects = coverage.analyzedObjects;

  if (analyzedObjects === 0) {
    return {
      score: 100,
      analyzedObjects: 0,
      passingObjects: 0,
      failingObjects: 0
    };
  }

  const failingKeys = new Set<string>();
  for (const f of findings) {
    if (f.coverage !== "ANALYZED" || f.objectId === undefined) {
      continue;
    }
    if (ignoredFindingIds?.has(f.id)) {
      continue;
    }
    failingKeys.add(objectKey(f.slideId, f.objectId));
  }

  const failingObjects = failingKeys.size;
  const passingObjects = Math.max(0, analyzedObjects - failingObjects);
  const score = Math.round((passingObjects / analyzedObjects) * 100);

  return {
    score,
    analyzedObjects,
    passingObjects,
    failingObjects
  };
}
