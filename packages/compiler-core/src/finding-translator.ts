/**
 * Finding Translator — maps raw Finding objects to human-readable UI strings.
 *
 * Pure, deterministic function. No side effects.
 * Keyed by ruleId + observed/expected fields.
 */
import type { Finding } from "@magistrat/shared-types";

export interface TranslatedFinding {
  /** Human-readable title, e.g. "Title font should be Arial, currently Calibri" */
  title: string;
  /** Short description with context */
  description: string;
  /** Label for the primary action button (null if no action available) */
  actionLabel: string | null;
  /** Risk badge label */
  riskLabel: "Auto-fix" | "Review required" | "Manual only";
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

const RISK_LABELS: Record<string, TranslatedFinding["riskLabel"]> = {
  safe: "Auto-fix",
  caution: "Review required",
  manual: "Manual only"
};

function riskLabel(finding: Finding): TranslatedFinding["riskLabel"] {
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
    API_LIMITATION: "Required data was unavailable in the current host runtime.",
    AMBIGUOUS_TEXT_RUNS: "Text content could not be reliably read.",
    AUTOFIT_PRESENT: "Autofit is enabled — font size checks are not safe to run.",
    VALIDATION_UNAVAILABLE: "Validation checks could not be performed."
  };

  return {
    title: "Not analyzed",
    description: reasonMessages[reason] ?? `Analysis was skipped: ${reason}.`,
    actionLabel: null,
    riskLabel: "Manual only"
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
