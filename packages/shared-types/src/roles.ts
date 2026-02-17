export const ROLE_V1_VALUES = [
  "TITLE",
  "SUBTITLE",
  "BODY",
  "BULLET_L1",
  "BULLET_L2",
  "FOOTER",
  "CALLOUT",
  "UNKNOWN"
] as const;

export type RoleV1 = (typeof ROLE_V1_VALUES)[number];

export interface RoleConfidence {
  role: RoleV1;
  score: number;
}

export const NOT_ANALYZED_REASON_CODES = [
  "LOW_ROLE_CONFIDENCE",
  "MISSING_STYLEMAP_ROLE",
  "EXPECTED_CONFIDENCE_LOW",
  "UNSUPPORTED_OBJECT_TYPE",
  "GROUPED_OBJECT_UNSAFE",
  "API_LIMITATION",
  "AMBIGUOUS_TEXT_RUNS",
  "AUTOFIT_PRESENT",
  "VALIDATION_UNAVAILABLE"
] as const;

export type NotAnalyzedReasonCode = (typeof NOT_ANALYZED_REASON_CODES)[number];
