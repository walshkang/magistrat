import type { RoleV1 } from "./roles.js";

/**
 * Per-role font-size tolerance in points.
 * Roles not listed fall back to `_default`.
 */
export type FontSizeToleranceMap = Partial<Record<RoleV1, number>> & { _default: number };

/**
 * Configurable thresholds used by `runChecks`.
 * All values have sensible defaults via `defaultToleranceConfig()`.
 */
export interface ToleranceConfig {
  /** Per-role font-size tolerance (pt). Default 0.5 for all roles. */
  fontSizePt: FontSizeToleranceMap;

  /** Line-spacing absolute tolerance. Default 0.05. */
  lineSpacingAbs: number;

  /** Minimum area (pt²) for ghost-object detection. Default 200. */
  ghostMinArea: number;

  /** Off-slide overlap ratio below which a finding is emitted. Default 0.1. */
  offSlideOverlapRatio: number;

  /** IOU threshold above which two overlapping boxes are flagged as duplicates. Default 0.8. */
  duplicateIouThreshold: number;

  /** Semi-transparent text: lower alpha bound (below = invisible, skip). Default 0.01. */
  semiTransparentAlphaMin: number;

  /** Semi-transparent text: upper alpha bound (above = opaque, skip). Default 0.95. */
  semiTransparentAlphaMax: number;

  /** Slide canvas dimensions in points (for off-slide detection). */
  canvas: { width: number; height: number };

  /** Title/footer band tolerance vs exemplar geometry (pt). Default 6. */
  positionPt: number;

  /** Micro-snap delta threshold for BP-LAYOUT-003 (pt). Default 0.5. */
  geometryMicroSnapDeltaPt: number;

  /** WCAG 1.4.3 minimum contrast ratio for opaque text vs solid fill (BP-WCAG-001). Default 4.5. */
  wcagMinContrastRatio: number;
}

/** Returns the default tolerance config matching current hardcoded values. */
export function defaultToleranceConfig(): ToleranceConfig {
  return {
    fontSizePt: {
      _default: 0.5,
    },
    lineSpacingAbs: 0.05,
    ghostMinArea: 200,
    offSlideOverlapRatio: 0.1,
    duplicateIouThreshold: 0.8,
    semiTransparentAlphaMin: 0.01,
    semiTransparentAlphaMax: 0.95,
    canvas: { width: 720, height: 405 },
    positionPt: 6,
    geometryMicroSnapDeltaPt: 0.5,
    wcagMinContrastRatio: 4.5
  };
}

/** Resolve font-size tolerance for a given role. */
export function getFontSizeTolerance(config: ToleranceConfig, role: RoleV1): number {
  return config.fontSizePt[role] ?? config.fontSizePt._default;
}
