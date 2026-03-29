import type { RoleV1 } from "./roles.js";

/**
 * A single inferred rule candidate extracted from an exemplar scan.
 * Presented to the user for confirmation before becoming active.
 */
export interface CandidateRule {
  /** Stable ID derived from role + property. */
  id: string;
  /** The role this rule applies to. */
  role: RoleV1;
  /** Which property this rule checks. */
  property: CandidateRuleProperty;
  /** Human-readable summary, e.g. "Titles use Aptos Display 30pt bold" */
  label: string;
  /** The observed value from the exemplar. */
  observedValue: unknown;
  /** Whether the user has confirmed this rule (default: true for auto-detected). */
  enabled: boolean;
}

export type CandidateRuleProperty =
  | "fontFamily"
  | "fontSizePt"
  | "fontColor"
  | "bold"
  | "italic"
  | "lineSpacing"
  | "bulletIndent"
  | "bulletGlyph"
  | "fillColor"
  | "geometryBand";

/**
 * A confirmed set of rules derived from one or more exemplar slides.
 * Stored in document state and used by `runChecks` to evaluate findings.
 */
export interface RuleProfile {
  /** Unique profile ID. */
  id: string;
  /** Human-readable name (e.g. "Company X brand guidelines"). */
  name: string;
  /** When this profile was created or last modified. */
  updatedAtIso: string;
  /** The exemplar slide(s) this profile was derived from. */
  sourceSlideIds: string[];
  /** The confirmed rules. Only enabled rules are enforced during checks. */
  rules: CandidateRule[];
}

/**
 * Result of inferring candidate rules from an exemplar's style map.
 */
export interface InferCandidateRulesResult {
  candidates: CandidateRule[];
}
