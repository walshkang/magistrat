import type { NotAnalyzedReasonCode, RoleV1 } from "./roles.js";

export const EVIDENCE_TYPES = [
  "EXEMPLAR_EVIDENCE",
  "PLAYBOOK_EVIDENCE",
  "TYPOGRAPHIC_EVIDENCE",
  "STRUCTURAL_EVIDENCE",
  "GEOMETRIC_EVIDENCE",
  "HYGIENE_EVIDENCE",
  "REFERENTIAL_EVIDENCE"
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const FINDING_SOURCES = ["exemplar", "playbook", "continuity"] as const;
export type FindingSource = (typeof FINDING_SOURCES)[number];

export const SEVERITY_VALUES = ["info", "warn", "error"] as const;
export type Severity = (typeof SEVERITY_VALUES)[number];

export const RISK_VALUES = ["safe", "caution", "manual"] as const;
export type Risk = (typeof RISK_VALUES)[number];

export const COVERAGE_STATES = ["ANALYZED", "NOT_ANALYZED"] as const;
export type CoverageState = (typeof COVERAGE_STATES)[number];

export interface Evidence {
  type: EvidenceType;
  summary: string;
  detail?: Record<string, string | number | boolean | null>;
}

export interface Finding {
  id: string;
  ruleId: string;
  source: FindingSource;
  slideId: string;
  objectId?: string;
  role?: RoleV1;
  observed: Record<string, unknown>;
  expected: Record<string, unknown>;
  evidence: Evidence[];
  confidence: number;
  risk: Risk;
  severity: Severity;
  coverage: CoverageState;
  notAnalyzedReason?: NotAnalyzedReasonCode;
  suggestedPatchId?: string;
}

export type FindingAction =
  | { type: "APPLY"; findingId: string }
  | { type: "DISMISS"; findingId: string; note?: string }
  | { type: "IGNORE_RULE_ONCE"; findingId: string }
  | { type: "SUPPRESS_RULE"; ruleId: string; scope: "deck" | "slide" | "object"; rationale: string }
  | { type: "JUMP_TO_OBJECT"; slideId: string; objectId: string };
