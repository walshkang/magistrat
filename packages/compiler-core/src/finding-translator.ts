/**
 * Finding Translator — maps raw Finding objects to human-readable UI strings.
 *
 * Pure, deterministic function. No side effects.
 * Keyed by ruleId + observed/expected fields.
 */
import type { Finding } from "@magistrat/shared-types";

export type TranslatedFindingRiskLabel =
  | "Auto-fix"
  | "Review required"
  | "Manual only"
  | "Skipped"
  | "Needs review"
  | "Not covered";

export interface TranslatedFinding {
  /** Human-readable title, e.g. "Title font should be Arial, currently Calibri" */
  title: string;
  /** Short description with context */
  description: string;
  /** Label for the primary action button (null if no action available) */
  actionLabel: string | null;
  /** Risk badge label */
  riskLabel: TranslatedFindingRiskLabel;
}

export type NotAnalyzedBucket = "cant_inspect" | "cant_match" | "no_rule";

/** UI section labels for grouping NOT_ANALYZED findings (matches translateNotAnalyzed titles). */
export const NOT_ANALYZED_BUCKET_LABELS: Record<NotAnalyzedBucket, string> = {
  cant_inspect: "Can't inspect",
  cant_match: "Can't match to exemplar",
  no_rule: "No rule yet"
};

const CANT_MATCH_REASONS = new Set<string>([
  "LOW_ROLE_CONFIDENCE",
  "MISSING_STYLEMAP_ROLE",
  "EXPECTED_CONFIDENCE_LOW"
]);

/**
 * Maps NOT_ANALYZED reason codes to UX buckets. Unknown reasons fall under cant_inspect.
 */
export function notAnalyzedBucket(reason: string | undefined): NotAnalyzedBucket {
  const r = reason ?? "UNKNOWN";
  if (CANT_MATCH_REASONS.has(r)) {
    return "cant_match";
  }
  if (r === "VALIDATION_UNAVAILABLE") {
    return "no_rule";
  }
  return "cant_inspect";
}

/**
 * Translate a raw Finding into human-readable strings for the UI.
 * Falls back to a generic translation if the ruleId is unrecognized.
 */
export function translateFinding(finding: Finding): TranslatedFinding {
  if (finding.coverage === "NOT_ANALYZED") {
    return translateNotAnalyzed(finding);
  }

  const translator = RULE_TRANSLATORS[finding.ruleId];
  if (translator) {
    return translator(finding);
  }

  return fallbackTranslation(finding);
}

const RISK_LABELS: Record<string, "Auto-fix" | "Review required" | "Manual only"> = {
  safe: "Auto-fix",
  caution: "Review required",
  manual: "Manual only"
};

function riskLabel(finding: Finding): "Auto-fix" | "Review required" | "Manual only" {
  return RISK_LABELS[finding.risk] ?? "Manual only";
}

function actionLabel(finding: Finding): string | null {
  if (finding.risk === "safe") return "Apply fix";
  if (finding.risk === "caution") return "Review & apply";
  return null;
}

// -- Rule-specific translators --

type RuleTranslator = (finding: Finding) => TranslatedFinding;

const RULE_TRANSLATORS: Record<string, RuleTranslator> = {
  "BP-TYPO-001": (f) => ({
    title: `${roleLabel(f.role)} font should be ${str(f.expected.fontFamily)}, currently ${str(f.observed.fontFamily)}`,
    description: "Font family does not match the exemplar's style map for this role.",
    actionLabel: actionLabel(f),
    riskLabel: riskLabel(f)
  }),

  "BP-TYPO-002": (f) => {
    const obs = styleDesc(f.observed.bold as boolean, f.observed.italic as boolean);
    const exp = styleDesc(f.expected.bold as boolean, f.expected.italic as boolean);
    return {
      title: `${roleLabel(f.role)} should be ${exp}, currently ${obs}`,
      description: "Bold/italic style does not match the exemplar.",
      actionLabel: actionLabel(f),
      riskLabel: riskLabel(f)
    };
  },

  "BP-TYPO-003": (f) => ({
    title: `${roleLabel(f.role)} font size should be ${num(f.expected.fontSizePt)}pt, currently ${num(f.observed.fontSizePt)}pt`,
    description: "Font size is outside the acceptable tolerance for this role.",
    actionLabel: actionLabel(f),
    riskLabel: riskLabel(f)
  }),

  "BP-TYPO-005": (f) => ({
    title: `${roleLabel(f.role)} line spacing should be ${num(f.expected.lineSpacing)}×, currently ${num(f.observed.lineSpacing)}×`,
    description: "Line spacing does not match the exemplar's style map for this role.",
    actionLabel: actionLabel(f),
    riskLabel: riskLabel(f)
  }),

  "BP-TYPO-004": (f) => {
    const families = (f.observed.fontFamilies as string[]) ?? [];
    return {
      title: "Mixed font families in one text box",
      description: `Found ${families.length} fonts: ${families.join(", ")}. This is usually a paste artifact.`,
      actionLabel: null,
      riskLabel: "Manual only"
    };
  },

  "BP-COLOR-001": (f) => ({
    title: `${roleLabel(f.role)} color should be ${str(f.expected.fontColor)}, currently ${str(f.observed.fontColor)}`,
    description: "Font color does not match the exemplar's style map.",
    actionLabel: actionLabel(f),
    riskLabel: riskLabel(f)
  }),

  "BP-COLOR-002": (f) => ({
    title: "Semi-transparent text detected",
    description: `Text opacity is ${Math.round((f.observed.fontAlpha as number) * 100)}%. Fully opaque (100%) is expected unless intentionally decorative.`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-COLOR-003": (f) => ({
    title: `Callout fill color should be ${str(f.expected.fillColor)}, currently ${str(f.observed.fillColor)}`,
    description: "Callout background color does not match the exemplar's palette.",
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-TYPO-012": (f) => ({
    title: `${roleLabel(f.role)} alignment should be ${str(f.expected.alignment)}, currently ${str(f.observed.alignment)}`,
    description: "Paragraph alignment does not match the exemplar style map for this role.",
    actionLabel: actionLabel(f),
    riskLabel: riskLabel(f)
  }),

  "BP-COLOR-004": (f) => ({
    title: `Shape border ${str(f.observed.lineColor)} is not in the exemplar palette`,
    description: "Border/outline color should use colors from the exemplar typography and fill palette.",
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-BULLET-001": (f) => ({
    title: `${roleLabel(f.role)} bullet indent does not match exemplar`,
    description: `Expected indent ${num(f.expected.bulletIndent)}pt / hanging ${num(f.expected.bulletHanging)}pt, found ${num(f.observed.bulletIndent)}pt / ${num(f.observed.bulletHanging)}pt.`,
    actionLabel: actionLabel(f),
    riskLabel: riskLabel(f)
  }),

  "BP-BULLET-002": (f) => ({
    title: `${roleLabel(f.role)} bullet glyph should be "${str(f.expected.bulletGlyph)}", currently "${str(f.observed.bulletGlyph)}"`,
    description: "Bullet character does not match the exemplar. Change manually in Google Slides.",
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-HYGIENE-001": (_f) => ({
    title: "Invisible object blocking content",
    description: "A hidden shape with non-trivial area sits above visible content. Review and consider deleting.",
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-HYGIENE-002": (f) => ({
    title: "Object is off-slide",
    description: `This element is mostly outside the visible slide area (${Math.round((f.observed.overlapRatio as number) * 100)}% visible). It won't appear during presentation.`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-HYGIENE-004": (f) => ({
    title: "Placeholder text detected",
    description: `Found leftover placeholder text: "${truncate(str(f.observed.textContent), 60)}"`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-HYGIENE-003": (f) => ({
    title: "Possible duplicate object",
    description: `This element overlaps another with identical content (${Math.round((f.observed.iou as number) * 100)}% overlap). One is likely a copy-paste duplicate.`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-HYGIENE-005": (f) => ({
    title: `Proofing language is ${str(f.observed.proofingLanguage)}, deck uses ${str(f.expected.proofingLanguage)}`,
    description:
      "Mismatched proofing language causes incorrect spell-check behavior. Safe to normalize.",
    actionLabel: actionLabel(f),
    riskLabel: riskLabel(f)
  }),

  "BP-CONT-001": (_f) => ({
    title: "Slide has no title",
    description: "This slide has an empty title and is not marked as intentionally titleless.",
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-CONT-002": (_f) => ({
    title: "Agenda item has no matching slide",
    description: "An agenda entry does not map to any slide title in the deck.",
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-CONT-003": (f) => ({
    title: "Section header layout differs from the first section header",
    description: `This slide's role mix (${str(f.observed.sectionHeaderArchetype)}) does not match the expected archetype (${str(f.expected.sectionHeaderArchetype)}).`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-LAYOUT-001": (f) => ({
    title: `${roleLabel(f.role)} is outside the exemplar title band`,
    description: `Distance from the exemplar centroid is ${num(f.observed.distancePt)}pt (tolerance ${num(f.expected.tolerancePt)}pt).`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-LAYOUT-002": (f) => ({
    title: `${roleLabel(f.role)} is outside the exemplar footer band`,
    description: `Top is ${num(f.observed.top)}pt vs exemplar median ${num(f.expected.footerTopMedian)}pt (tolerance ${num(f.expected.tolerancePt)}pt).`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-LAYOUT-003": (f) => ({
    title: "Geometry uses fractional points (micro-snap within tolerance)",
    description: `Snap delta to whole points is ${num(f.observed.snapDeltaToWholePoints)}pt (max ${num(f.expected.maxSnapDeltaPt)}pt). Normalization is report-only in v1.`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-LAYOUT-004": (_f) => ({
    title: "Breadcrumb out of position",
    description: "This element appears to be a section breadcrumb but its horizontal position differs from the exemplar.",
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-SAFETY-001": (f) => ({
    title: "Grouped object and geometry patch",
    description: `A ${str(f.observed.patchOp)} patch would target a grouped shape. Apply geometry changes manually after ungrouping if appropriate.`,
    actionLabel: null,
    riskLabel: "Manual only"
  }),

  "BP-MASTERS-001": (_f) => ({
    title: "Master/layout metadata unavailable",
    description: "The host did not supply master or layout information; layout hygiene is report-only in v1.",
    actionLabel: null,
    riskLabel: "Manual only"
  })
};

function translateNotAnalyzed(finding: Finding): TranslatedFinding {
  const reason = finding.notAnalyzedReason ?? "UNKNOWN";
  const reasonMessages: Record<string, string> = {
    LOW_ROLE_CONFIDENCE: "Could not confidently determine this element's role.",
    MISSING_STYLEMAP_ROLE: "The exemplar does not define a style for this element's role.",
    EXPECTED_CONFIDENCE_LOW: "Expected values could not be determined with sufficient confidence.",
    UNSUPPORTED_OBJECT_TYPE: "This object type is not supported by current checks.",
    GROUPED_OBJECT_UNSAFE: "This object is inside a group and cannot be safely analyzed.",
    API_LIMITATION: "Formatting is inherited from the slide master or theme. Magistrat can't read these values via the Add-on API — a future update will resolve this using the Slides REST API.",
    AMBIGUOUS_TEXT_RUNS: "Text content could not be reliably read.",
    AUTOFIT_PRESENT: "Autofit is enabled — font size checks are not safe to run.",
    VALIDATION_UNAVAILABLE: "Validation checks could not be performed."
  };

  const bucket = notAnalyzedBucket(finding.notAnalyzedReason);
  const description =
    bucket === "no_rule"
      ? "Magistrat doesn't have a check for this pattern yet."
      : reasonMessages[reason] ?? `Analysis was skipped: ${reason}.`;

  if (bucket === "cant_match") {
    return {
      title: "Can't match to exemplar",
      description,
      actionLabel: null,
      riskLabel: "Needs review"
    };
  }

  if (bucket === "no_rule") {
    return {
      title: "No rule yet",
      description,
      actionLabel: null,
      riskLabel: "Not covered"
    };
  }

  return {
    title: "Can't inspect",
    description,
    actionLabel: null,
    riskLabel: "Skipped"
  };
}

function fallbackTranslation(finding: Finding): TranslatedFinding {
  return {
    title: `${finding.ruleId}: ${finding.severity} finding`,
    description: finding.evidence[0]?.summary ?? "No additional details available.",
    actionLabel: actionLabel(finding),
    riskLabel: riskLabel(finding)
  };
}

// -- Helpers --

function roleLabel(role: string | undefined): string {
  if (!role || role === "UNKNOWN") return "Element";
  const labels: Record<string, string> = {
    TITLE: "Title",
    SUBTITLE: "Subtitle",
    BODY: "Body text",
    BULLET_L1: "Bullet (L1)",
    BULLET_L2: "Bullet (L2)",
    FOOTER: "Footer",
    CALLOUT: "Callout"
  };
  return labels[role] ?? role;
}

function styleDesc(bold: boolean, italic: boolean): string {
  if (bold && italic) return "bold italic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "regular";
}

function str(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function num(value: unknown): string {
  return typeof value === "number" ? value.toFixed(1).replace(/\.0$/, "") : String(value ?? "?");
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "\u2026" : text;
}
