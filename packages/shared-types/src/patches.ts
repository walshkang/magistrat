export const PATCH_OP_VALUES = [
  "SET_FONT_FAMILY",
  "SET_FONT_COLOR",
  "SET_FONT_STYLE",
  "SET_BULLET_INDENT",
  "DELETE_GHOST_OBJECT",
  "SET_FONT_SIZE",
  "SET_LINE_SPACING",
  "MOVE_GEOMETRY",
  "RESIZE_GEOMETRY",
  "DELETE_NON_GHOST_OBJECT",
  "DEDUPE_DELETE",
  "MASTER_LAYOUT_CHANGES",
  "BREAK_GROUP",
  "NORMALIZE_LANGUAGE_TAGS"
] as const;

export type PatchOpType = (typeof PATCH_OP_VALUES)[number];

export interface TargetFingerprint {
  slideId: string;
  objectId: string;
  preconditionHash: string;
}

export const RECONCILE_STATES = [
  "applied",
  "reverted_externally",
  "drifted",
  "missing_target"
] as const;

export type ReconcileState = (typeof RECONCILE_STATES)[number];

export interface PatchOp {
  id: string;
  op: PatchOpType;
  target: TargetFingerprint;
  fields: Record<string, unknown>;
  risk: "safe" | "caution" | "manual";
  validations?: Array<"no_overflow_after_change" | "no_reflow_material_change" | "target_precondition_matches">;
}

export interface PatchRecord {
  id: string;
  findingId: string;
  targetFingerprint: TargetFingerprint;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reconcileState: ReconcileState;
  appliedAtIso: string;
}
