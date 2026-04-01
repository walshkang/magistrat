import type { PatchOpType } from "@magistrat/shared-types";

export const SAFE_PATCH_OPS: ReadonlySet<PatchOpType> = new Set([
  "SET_FONT_FAMILY",
  "SET_FONT_COLOR",
  "SET_FONT_STYLE",
  "SET_BULLET_INDENT",
  "DELETE_GHOST_OBJECT",
  "NORMALIZE_LANGUAGE_TAGS",
  "SET_TEXT_ALIGNMENT"
]);

export const CAUTION_PATCH_OPS: ReadonlySet<PatchOpType> = new Set([
  "SET_FONT_SIZE",
  "SET_LINE_SPACING"
]);

export const MANUAL_PATCH_OPS: ReadonlySet<PatchOpType> = new Set([
  "MOVE_GEOMETRY",
  "RESIZE_GEOMETRY",
  "DELETE_NON_GHOST_OBJECT",
  "DEDUPE_DELETE",
  "MASTER_LAYOUT_CHANGES",
  "BREAK_GROUP"
]);

export const ROLE_CONFIDENCE_MIN = {
  safe: 0.9,
  caution: 0.9,
  manual: 0.7
} as const;

/**
 * Distinct playbook rule IDs evaluated by runChecks + continuity in v1 (excludes BP-COVERAGE-001).
 * Bump when adding BP-* rules.
 */
export const PLAYBOOK_RULE_COUNT = 32;
