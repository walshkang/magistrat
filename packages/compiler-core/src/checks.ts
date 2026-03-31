import type {
  CoverageSnapshot,
  DeckSnapshot,
  Evidence,
  Finding,
  GeometrySnapshot,
  NotAnalyzedReasonCode,
  PatchOp,
  RoleV1,
  RoleStyleTokens,
  StyleMap,
  ToleranceConfig
} from "@magistrat/shared-types";
import { defaultToleranceConfig, getFontSizeTolerance } from "@magistrat/shared-types";
import { runContinuityChecks } from "./continuity.js";
import { ROLE_CONFIDENCE_MIN } from "./constants.js";
import { stableHash } from "./hash.js";
import { computeIOU } from "./iou.js";

/** BP-HYGIENE-006 — draft bracket markers and TODO markers (case-insensitive). */
const DRAFT_TAG_PATTERN =
  /\[TBD\]|\[XX\]|\[DRAFT\]|\[INSERT[^\]]*\]|\[PLACEHOLDER[^\]]*\]|<PLACEHOLDER>|TODO:?/i;

function parseHexRgb(hex: string): [number, number, number] | null {
  const t = hex.trim();
  const m6 = /^#?([0-9a-f]{6})$/i.exec(t);
  if (m6?.[1]) {
    const n = parseInt(m6[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m3 = /^#?([0-9a-f]{3})$/i.exec(t);
  const s = m3?.[1];
  if (s && s.length === 3) {
    const r = parseInt(s.charAt(0) + s.charAt(0), 16) / 255;
    const g = parseInt(s.charAt(1) + s.charAt(1), 16) / 255;
    const b = parseInt(s.charAt(2) + s.charAt(2), 16) / 255;
    return [r, g, b];
  }
  return null;
}

function rgbToRelativeLuminance(rgb: [number, number, number]): number {
  const lin = [0, 1, 2].map((i) => {
    const c = rgb[i];
    if (c === undefined) {
      return 0;
    }
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const r0 = lin[0] ?? 0;
  const r1 = lin[1] ?? 0;
  const r2 = lin[2] ?? 0;
  return 0.2126 * r0 + 0.7152 * r1 + 0.0722 * r2;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface RunChecksResult {
  findings: Finding[];
  coverage: CoverageSnapshot;
  suggestedPatches: PatchOp[];
}

export function runChecks(deck: DeckSnapshot, styleMap: StyleMap, tolerance?: ToleranceConfig): RunChecksResult {
  const tol = tolerance ?? defaultToleranceConfig();
  const findings: Finding[] = [];
  const suggestedPatches: PatchOp[] = [];

  const analyzedObjects = new Set<string>();
  const analyzedSlides = new Set<string>();
  const notAnalyzedObjects = new Set<string>();
  const unhandledTypes = new Map<string, number>();

  const pushFinding = (finding: Finding): void => {
    findings.push(finding);
    if (finding.coverage === "NOT_ANALYZED" && finding.objectId) {
      notAnalyzedObjects.add(objectKey(finding.slideId, finding.objectId));
    }
  };

  const markAnalyzed = (slideId: string, objectId: string): void => {
    analyzedObjects.add(objectKey(slideId, objectId));
    analyzedSlides.add(slideId);
  };

  const dominantProofingLanguage = computeDominantProofingLanguage(deck);
  const exemplarSlideId = resolveExemplarSlideId(deck);

  for (const slide of deck.slides) {
    for (const shape of slide.shapes) {
      if (!shape.supportedForAnalysis) {
        unhandledTypes.set(shape.shapeType, (unhandledTypes.get(shape.shapeType) ?? 0) + 1);
        pushFinding(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "UNSUPPORTED_OBJECT_TYPE",
            "Shape type is not supported by v1 checks."
          )
        );
        continue;
      }

      markAnalyzed(slide.slideId, shape.objectId);

      for (const finding of evaluateObjectHygiene(
        slide.slideId,
        shape.objectId,
        shape,
        tol,
        slide.slideWidth,
        slide.slideHeight
      )) {
        pushFinding(finding);
      }

      for (const finding of evaluateMultiRunTypography(slide.slideId, shape.objectId, shape)) {
        pushFinding(finding);
      }

      for (const finding of evaluateProofingLanguage(
        slide.slideId,
        shape.objectId,
        shape,
        dominantProofingLanguage,
        suggestedPatches
      )) {
        pushFinding(finding);
      }

      if (!shape.inspectability.typography) {
        pushFinding(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "API_LIMITATION",
            "Typography tokens were unavailable in current host runtime."
          )
        );
        continue;
      }

      const role = shape.inferredRole ?? "UNKNOWN";
      const roleScore = shape.inferredRoleScore ?? 0;

      for (const finding of evaluateBreadcrumbLayoutFindings(slide, shape, styleMap, tol)) {
        pushFinding(finding);
      }

      if (role === "UNKNOWN" || roleScore < ROLE_CONFIDENCE_MIN.manual) {
        pushFinding(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "LOW_ROLE_CONFIDENCE",
            "Role confidence was below manual threshold for role-specific checks."
          )
        );
        continue;
      }

      const expected = styleMap[role];
      if (!expected) {
        pushFinding(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "MISSING_STYLEMAP_ROLE",
            `Style map did not contain role ${role}.`
          )
        );
        continue;
      }

      if (
        (role === "TITLE" || role === "FOOTER") &&
        roleScore >= 0.85 &&
        shape.inspectability.typography
      ) {
        for (const finding of evaluateTitleFooterLayoutFindings(slide, shape, role, styleMap, tol)) {
          pushFinding(finding);
        }
      }

      if (roleScore < ROLE_CONFIDENCE_MIN.safe) {
        pushFinding(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "LOW_ROLE_CONFIDENCE",
            "Role confidence was below safe/caution thresholds for style-map checks."
          )
        );
        continue;
      }

      const run = shape.textRuns[0];
      if (!run) {
        pushFinding(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "AMBIGUOUS_TEXT_RUNS",
            "No readable text runs were available."
          )
        );
        continue;
      }

      const bulletChecksBlocked =
        (role === "BULLET_L1" ||
          role === "BULLET_L2" ||
          expected.bulletIndent !== undefined ||
          expected.bulletHanging !== undefined ||
          expected.bulletGlyph !== undefined) &&
        !shape.inspectability.bullets;

      if (bulletChecksBlocked) {
        pushFinding(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "API_LIMITATION",
            "Bullet indentation metrics were unavailable in current host runtime."
          )
        );
      }

      const mismatchFindings = evaluateTypographyAndStructure({
        slideId: slide.slideId,
        objectId: shape.objectId,
        role,
        expected,
        observed: run,
        inferredRoleScore: roleScore,
        autofitEnabled: shape.autofitEnabled,
        bulletIndent: shape.paragraphs[0]?.bulletIndent,
        bulletHanging: shape.paragraphs[0]?.bulletHanging,
        bulletGlyph: shape.paragraphs[0]?.bulletGlyph,
        lineSpacing: shape.paragraphs[0]?.lineSpacing,
        fillColor: shape.fillColor,
        skipBulletChecks: bulletChecksBlocked,
        tolerance: tol
      });

      for (const finding of mismatchFindings.findings) {
        pushFinding(finding);
      }

      suggestedPatches.push(...mismatchFindings.patches);
    }

    for (const shape of slide.shapes) {
      if (!shape.supportedForAnalysis || !shape.inspectability.typography) {
        continue;
      }
      const r = shape.inferredRole ?? "UNKNOWN";
      const rs = shape.inferredRoleScore ?? 0;
      for (const finding of evaluateLayoutMicroSnapFindings(slide, shape, r, rs, tol, exemplarSlideId)) {
        pushFinding(finding);
      }
    }

    for (const finding of evaluateDuplicateOverlaps(slide, tol)) {
      pushFinding(finding);
    }
  }

  for (const finding of collectGroupSafetyFindings(deck, suggestedPatches)) {
    pushFinding(finding);
  }

  if (deck.masterLayoutMetadataAvailable !== true) {
    pushFinding(createMastersHygieneFinding(deck));
  }

  const continuityResult = runContinuityChecks(deck);
  for (const finding of continuityResult.findings) {
    pushFinding(finding);
  }

  const totalObjects = deck.slides.reduce((acc, slide) => acc + slide.shapes.length, 0);
  const coverage: CoverageSnapshot = {
    analyzedSlides: analyzedSlides.size,
    totalSlides: deck.slides.length,
    analyzedObjects: analyzedObjects.size,
    notAnalyzedObjects: notAnalyzedObjects.size,
    totalObjects,
    topUnhandledObjectTypes: [...unhandledTypes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type),
    continuityStatus: continuityResult.continuityStatus,
    continuityCoverage: continuityResult.continuityCoverage
  };

  return {
    findings,
    coverage,
    suggestedPatches
  };
}

function evaluateObjectHygiene(
  slideId: string,
  objectId: string,
  shape: DeckSnapshot["slides"][number]["shapes"][number],
  tol: ToleranceConfig,
  slideWidth: number,
  slideHeight: number
): Finding[] {
  const findings: Finding[] = [];
  const role = shape.inferredRole ?? "UNKNOWN";
  const roleScore = shape.inferredRoleScore ?? ROLE_CONFIDENCE_MIN.manual;

  const textContent = shape.textRuns.map((textRun) => textRun.text).join(" ").toLowerCase();
  if (textContent.includes("click to add") || textContent.includes("lorem ipsum")) {
    const findingId = `finding-${stableHash([slideId, objectId, "placeholder"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-HYGIENE-004",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: { textContent },
      expected: { pattern: "no_placeholder_text" },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Placeholder text pattern matched."),
        evidence("HYGIENE_EVIDENCE", "Text contains placeholder token.")
      ],
      confidence: roleScore,
      risk: "manual",
      severity: "error",
      coverage: "ANALYZED"
    });
  }

  const paragraphConcatForDraft = shape.paragraphs.map((p) => p.text).join("");
  const draftMatch = paragraphConcatForDraft.match(DRAFT_TAG_PATTERN);
  if (draftMatch) {
    const findingId = `finding-${stableHash([slideId, objectId, "bp_hygiene_006"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-HYGIENE-006",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: { matchedToken: draftMatch[0] },
      expected: { pattern: "no_draft_markers" },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Draft bracket pattern found in text content."),
        evidence(
          "HYGIENE_EVIDENCE",
          "Draft markers in a final presentation undermine credibility with executive audiences."
        )
      ],
      confidence: roleScore,
      risk: "manual",
      severity: "error",
      coverage: "ANALYZED"
    });
  }

  const isPotentialGhost =
    !shape.visible &&
    shape.geometry.width * shape.geometry.height > tol.ghostMinArea &&
    shape.zIndex > 0 &&
    shape.textRuns.every((textRun) => textRun.fontAlpha === 0);

  if (isPotentialGhost) {
    const findingId = `finding-${stableHash([slideId, objectId, "ghost_manual"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-HYGIENE-001",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: { visible: shape.visible, zIndex: shape.zIndex },
      expected: { noGhostObjects: true },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Potential ghost profile matched."),
        evidence(
          "HYGIENE_EVIDENCE",
          "Deletion remains manual until strict overlap and render-plane evidence is available."
        )
      ],
      confidence: roleScore,
      risk: "manual",
      severity: "warn",
      coverage: "ANALYZED"
    });
  }

  const dominantRun = shape.textRuns[0];
  if (
    dominantRun &&
    dominantRun.fontAlpha > tol.semiTransparentAlphaMin &&
    dominantRun.fontAlpha < tol.semiTransparentAlphaMax
  ) {
    const findingId = `finding-${stableHash([slideId, objectId, "semi_transparent_text"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-COLOR-002",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: { fontAlpha: dominantRun.fontAlpha },
      expected: { fontAlpha: 1.0 },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Playbook requires fully opaque text for readability."),
        evidence("TYPOGRAPHIC_EVIDENCE", "Text alpha is between 1% and 95%, likely unintentional.")
      ],
      confidence: roleScore,
      risk: "manual",
      severity: "warn",
      coverage: "ANALYZED"
    });
  }

  if (shape.fillColor) {
    const fillRgb = parseHexRgb(shape.fillColor);
    if (fillRgb) {
      const fillLum = rgbToRelativeLuminance(fillRgb);
      let worst: { ratio: number; fontColor: string; fontAlpha: number } | null = null;
      for (const run of shape.textRuns) {
        if (run.fontAlpha < 0.95) {
          continue;
        }
        const textRgb = parseHexRgb(run.fontColor);
        if (!textRgb) {
          continue;
        }
        const textLum = rgbToRelativeLuminance(textRgb);
        const ratio = contrastRatio(textLum, fillLum);
        if (ratio >= tol.wcagMinContrastRatio) {
          continue;
        }
        if (!worst || ratio < worst.ratio) {
          worst = { ratio, fontColor: run.fontColor, fontAlpha: run.fontAlpha };
        }
      }
      if (worst) {
        const findingId = `finding-${stableHash([slideId, objectId, "bp_wcag_001"])}`;
        findings.push({
          id: findingId,
          ruleId: "BP-WCAG-001",
          source: "playbook",
          slideId,
          objectId,
          role,
          observed: {
            contrastRatio: worst.ratio,
            textColor: worst.fontColor,
            fillColor: shape.fillColor,
            fontAlpha: worst.fontAlpha
          },
          expected: { minContrastRatio: tol.wcagMinContrastRatio },
          evidence: [
            evidence(
              "PLAYBOOK_EVIDENCE",
              "WCAG 1.4.3 requires minimum 4.5:1 contrast ratio for standard text."
            ),
            evidence(
              "COLOR_EVIDENCE",
              "Computed contrast ratio between text and shape fill is below threshold."
            )
          ],
          confidence: roleScore,
          risk: "manual",
          severity: "error",
          coverage: "ANALYZED"
        });
      }
    }
  }

  const canvas = { left: 0, top: 0, right: slideWidth, bottom: slideHeight };
  const geo = shape.geometry;
  const obj = {
    left: geo.left,
    top: geo.top,
    right: geo.left + geo.width,
    bottom: geo.top + geo.height
  };
  const overlapLeft = Math.max(canvas.left, obj.left);
  const overlapTop = Math.max(canvas.top, obj.top);
  const overlapRight = Math.min(canvas.right, obj.right);
  const overlapBottom = Math.min(canvas.bottom, obj.bottom);
  const overlapArea = Math.max(0, overlapRight - overlapLeft) * Math.max(0, overlapBottom - overlapTop);
  const objectArea = geo.width * geo.height;
  const overlapRatio = objectArea > 0 ? overlapArea / objectArea : 1;

  if (overlapRatio < tol.offSlideOverlapRatio) {
    const findingId = `finding-${stableHash([slideId, objectId, "off_slide"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-HYGIENE-002",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: {
        left: geo.left,
        top: geo.top,
        width: geo.width,
        height: geo.height,
        overlapRatio
      },
      expected: { minOverlapRatio: tol.offSlideOverlapRatio },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Slide canvas overlap policy."),
        evidence("GEOMETRIC_EVIDENCE", "Object bounding box is <10% within the slide canvas.")
      ],
      confidence: roleScore,
      risk: "manual",
      severity: "warn",
      coverage: "ANALYZED"
    });
  }

  return findings;
}

function createNotAnalyzedFinding(
  slideId: string,
  objectId: string,
  reason: NotAnalyzedReasonCode,
  message: string
): Finding {
  return {
    id: `finding-${stableHash([slideId, objectId, reason])}`,
    ruleId: "BP-COVERAGE-001",
    source: "playbook",
    slideId,
    objectId,
    observed: { state: "NOT_ANALYZED" },
    expected: { state: "ANALYZED" },
    evidence: [
      evidence("PLAYBOOK_EVIDENCE", "Coverage contract requires explicit NOT_ANALYZED state."),
      evidence("HYGIENE_EVIDENCE", message)
    ],
    confidence: 1,
    risk: "manual",
    severity: "info",
    coverage: "NOT_ANALYZED",
    notAnalyzedReason: reason
  };
}

function evidence(type: Evidence["type"], summary: string): Evidence {
  return { type, summary };
}

interface EvaluateInput {
  slideId: string;
  objectId: string;
  role: RoleV1;
  expected: RoleStyleTokens;
  observed: {
    fontFamily: string;
    fontColor: string;
    fontSizePt: number;
    bold: boolean;
    italic: boolean;
  };
  inferredRoleScore: number;
  autofitEnabled: boolean;
  bulletIndent?: number | undefined;
  bulletHanging?: number | undefined;
  bulletGlyph?: string | undefined;
  lineSpacing?: number | undefined;
  fillColor?: string | undefined;
  skipBulletChecks: boolean;
  tolerance: ToleranceConfig;
}

function evaluateTypographyAndStructure(input: EvaluateInput): {
  findings: Finding[];
  patches: PatchOp[];
} {
  const findings: Finding[] = [];
  const patches: PatchOp[] = [];

  const baseMeta = [input.slideId, input.objectId, input.role];

  if (input.observed.fontFamily !== input.expected.fontFamily) {
    const findingId = `finding-${stableHash([...baseMeta, "font_family"])}`;
    const patchId = `patch-${stableHash([findingId, "SET_FONT_FAMILY"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-TYPO-001",
      source: "exemplar",
      slideId: input.slideId,
      objectId: input.objectId,
      role: input.role,
      observed: { fontFamily: input.observed.fontFamily },
      expected: { fontFamily: input.expected.fontFamily },
      evidence: [
        evidence("EXEMPLAR_EVIDENCE", "Role style map defines expected font family."),
        evidence("TYPOGRAPHIC_EVIDENCE", "Dominant run family differs from style map.")
      ],
      confidence: input.inferredRoleScore,
      risk: "safe",
      severity: "error",
      coverage: "ANALYZED",
      suggestedPatchId: patchId
    });

    patches.push({
      id: patchId,
      op: "SET_FONT_FAMILY",
      target: {
        slideId: input.slideId,
        objectId: input.objectId,
        preconditionHash: stableHash(input.observed)
      },
      fields: { fontFamily: input.expected.fontFamily },
      risk: "safe"
    });
  }

  if (input.observed.fontColor !== input.expected.fontColor) {
    const findingId = `finding-${stableHash([...baseMeta, "font_color"])}`;
    const patchId = `patch-${stableHash([findingId, "SET_FONT_COLOR"])}`;

    findings.push({
      id: findingId,
      ruleId: "BP-COLOR-001",
      source: "exemplar",
      slideId: input.slideId,
      objectId: input.objectId,
      role: input.role,
      observed: { fontColor: input.observed.fontColor },
      expected: { fontColor: input.expected.fontColor },
      evidence: [
        evidence("EXEMPLAR_EVIDENCE", "Role style map defines expected font color."),
        evidence("TYPOGRAPHIC_EVIDENCE", "Dominant run color differs from style map.")
      ],
      confidence: input.inferredRoleScore,
      risk: "safe",
      severity: "warn",
      coverage: "ANALYZED",
      suggestedPatchId: patchId
    });

    patches.push({
      id: patchId,
      op: "SET_FONT_COLOR",
      target: {
        slideId: input.slideId,
        objectId: input.objectId,
        preconditionHash: stableHash(input.observed)
      },
      fields: { fontColor: input.expected.fontColor },
      risk: "safe"
    });
  }

  if (input.observed.bold !== input.expected.bold || input.observed.italic !== input.expected.italic) {
    const findingId = `finding-${stableHash([...baseMeta, "font_style"])}`;
    const patchId = `patch-${stableHash([findingId, "SET_FONT_STYLE"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-TYPO-002",
      source: "exemplar",
      slideId: input.slideId,
      objectId: input.objectId,
      role: input.role,
      observed: { bold: input.observed.bold, italic: input.observed.italic },
      expected: { bold: input.expected.bold, italic: input.expected.italic },
      evidence: [
        evidence("EXEMPLAR_EVIDENCE", "Role style map defines expected font style."),
        evidence("TYPOGRAPHIC_EVIDENCE", "Bold/italic tokens differ from role expectation.")
      ],
      confidence: input.inferredRoleScore,
      risk: "safe",
      severity: "warn",
      coverage: "ANALYZED",
      suggestedPatchId: patchId
    });

    patches.push({
      id: patchId,
      op: "SET_FONT_STYLE",
      target: {
        slideId: input.slideId,
        objectId: input.objectId,
        preconditionHash: stableHash(input.observed)
      },
      fields: { bold: input.expected.bold, italic: input.expected.italic },
      risk: "safe"
    });
  }

  const fontSizeTol = getFontSizeTolerance(input.tolerance, input.role);
  if (Math.abs(input.observed.fontSizePt - input.expected.fontSizePt) > fontSizeTol) {
    const findingId = `finding-${stableHash([...baseMeta, "font_size"])}`;
    const patchId = `patch-${stableHash([findingId, "SET_FONT_SIZE"])}`;

    if (input.autofitEnabled) {
      findings.push(
        createNotAnalyzedFinding(
          input.slideId,
          input.objectId,
          "AUTOFIT_PRESENT",
          "Autofit was enabled; font size checks were gated out."
        )
      );
    } else {
      findings.push({
        id: findingId,
        ruleId: "BP-TYPO-003",
        source: "exemplar",
        slideId: input.slideId,
        objectId: input.objectId,
        role: input.role,
        observed: { fontSizePt: input.observed.fontSizePt },
        expected: { fontSizePt: input.expected.fontSizePt },
        evidence: [
          evidence("EXEMPLAR_EVIDENCE", "Role style map defines expected font size."),
          evidence("TYPOGRAPHIC_EVIDENCE", "Dominant run size differs beyond role tolerance.")
        ],
        confidence: input.inferredRoleScore,
        risk: "caution",
        severity: "warn",
        coverage: "ANALYZED",
        suggestedPatchId: patchId
      });

      patches.push({
        id: patchId,
        op: "SET_FONT_SIZE",
        target: {
          slideId: input.slideId,
          objectId: input.objectId,
          preconditionHash: stableHash(input.observed)
        },
        fields: { fontSizePt: input.expected.fontSizePt },
        risk: "caution",
        validations: ["no_overflow_after_change"]
      });
    }
  }

  const hasBulletExpectation =
    input.role === "BULLET_L1" ||
    input.role === "BULLET_L2" ||
    input.expected.bulletIndent !== undefined ||
    input.expected.bulletHanging !== undefined ||
    input.expected.bulletGlyph !== undefined;
  if (hasBulletExpectation && !input.skipBulletChecks) {
    const expectedIndent = input.expected.bulletIndent;
    const expectedHanging = input.expected.bulletHanging;

    if (
      expectedIndent !== undefined &&
      expectedHanging !== undefined &&
      (expectedIndent !== input.bulletIndent || expectedHanging !== input.bulletHanging)
    ) {
      const findingId = `finding-${stableHash([...baseMeta, "bullet_indent"])}`;
      const patchId = `patch-${stableHash([findingId, "SET_BULLET_INDENT"])}`;

      findings.push({
        id: findingId,
        ruleId: "BP-BULLET-001",
        source: "exemplar",
        slideId: input.slideId,
        objectId: input.objectId,
        role: input.role,
        observed: {
          bulletIndent: input.bulletIndent,
          bulletHanging: input.bulletHanging
        },
        expected: {
          bulletIndent: expectedIndent,
          bulletHanging: expectedHanging
        },
        evidence: [
          evidence("EXEMPLAR_EVIDENCE", "Style map defines bullet indent and hanging."),
          evidence("STRUCTURAL_EVIDENCE", "Paragraph bullet indentation differs from expected tokens.")
        ],
        confidence: input.inferredRoleScore,
        risk: "safe",
        severity: "warn",
        coverage: "ANALYZED",
        suggestedPatchId: patchId
      });

      patches.push({
        id: patchId,
        op: "SET_BULLET_INDENT",
        target: {
          slideId: input.slideId,
          objectId: input.objectId,
          preconditionHash: stableHash({
            bulletIndent: input.bulletIndent,
            bulletHanging: input.bulletHanging
          })
        },
        fields: {
          bulletIndent: expectedIndent,
          bulletHanging: expectedHanging
        },
        risk: "safe"
      });
    }

    if (
      input.expected.bulletGlyph !== undefined &&
      input.bulletGlyph !== undefined &&
      input.expected.bulletGlyph !== input.bulletGlyph
    ) {
      const findingId = `finding-${stableHash([...baseMeta, "bullet_glyph"])}`;
      findings.push({
        id: findingId,
        ruleId: "BP-BULLET-002",
        source: "exemplar",
        slideId: input.slideId,
        objectId: input.objectId,
        role: input.role,
        observed: { bulletGlyph: input.bulletGlyph },
        expected: { bulletGlyph: input.expected.bulletGlyph },
        evidence: [
          evidence("EXEMPLAR_EVIDENCE", "Style map defines expected bullet glyph."),
          evidence("STRUCTURAL_EVIDENCE", "Bullet character differs from exemplar.")
        ],
        confidence: input.inferredRoleScore,
        risk: "manual",
        severity: "info",
        coverage: "ANALYZED"
      });
    }
  }

  const lineSpacingDiff =
    input.lineSpacing !== undefined && input.expected.lineSpacing !== undefined
      ? Math.abs(input.lineSpacing - input.expected.lineSpacing)
      : 0;
  if (
    input.expected.lineSpacing !== undefined &&
    input.lineSpacing !== undefined &&
    lineSpacingDiff > input.tolerance.lineSpacingAbs + 1e-9
  ) {
    const findingId = `finding-${stableHash([...baseMeta, "line_spacing"])}`;
    const patchId = `patch-${stableHash([findingId, "SET_LINE_SPACING"])}`;
    const typographyPreimage = { ...input.observed, lineSpacing: input.lineSpacing };

    findings.push({
      id: findingId,
      ruleId: "BP-TYPO-005",
      source: "exemplar",
      slideId: input.slideId,
      objectId: input.objectId,
      role: input.role,
      observed: { lineSpacing: input.lineSpacing },
      expected: { lineSpacing: input.expected.lineSpacing },
      evidence: [
        evidence("EXEMPLAR_EVIDENCE", "Role style map defines expected line spacing."),
        evidence("TYPOGRAPHIC_EVIDENCE", "Dominant paragraph line spacing differs from style map.")
      ],
      confidence: input.inferredRoleScore,
      risk: "caution",
      severity: "warn",
      coverage: "ANALYZED",
      suggestedPatchId: patchId
    });

    patches.push({
      id: patchId,
      op: "SET_LINE_SPACING",
      target: {
        slideId: input.slideId,
        objectId: input.objectId,
        preconditionHash: stableHash(typographyPreimage)
      },
      fields: { lineSpacing: input.expected.lineSpacing },
      risk: "caution",
      validations: ["no_reflow_material_change"]
    });
  }

  if (
    input.role === "CALLOUT" &&
    input.expected.fillColor !== undefined &&
    input.fillColor !== undefined &&
    input.fillColor !== input.expected.fillColor
  ) {
    const findingId = `finding-${stableHash([...baseMeta, "callout_fill"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-COLOR-003",
      source: "exemplar",
      slideId: input.slideId,
      objectId: input.objectId,
      role: input.role,
      observed: { fillColor: input.fillColor },
      expected: { fillColor: input.expected.fillColor },
      evidence: [
        evidence("EXEMPLAR_EVIDENCE", "Exemplar callout defines expected fill color."),
        evidence("TYPOGRAPHIC_EVIDENCE", "Callout background color differs from exemplar.")
      ],
      confidence: input.inferredRoleScore,
      risk: "manual",
      severity: "warn",
      coverage: "ANALYZED"
    });
  }

  return {
    findings,
    patches
  };
}

/**
 * Deck-wide mode of proofingLanguage on text runs (non-empty only).
 * Tie-break: highest count, then lexicographically greatest tag (deterministic).
 */
function computeDominantProofingLanguage(deck: DeckSnapshot): string | null {
  const counts = new Map<string, number>();
  for (const slide of deck.slides) {
    for (const shape of slide.shapes) {
      if (!shape.supportedForAnalysis) {
        continue;
      }
      for (const run of shape.textRuns) {
        const lang = run.proofingLanguage?.trim();
        if (lang) {
          counts.set(lang, (counts.get(lang) ?? 0) + 1);
        }
      }
    }
  }
  if (counts.size === 0) {
    return null;
  }
  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return b[0].localeCompare(a[0]);
  });
  return sorted[0]?.[0] ?? null;
}

function evaluateMultiRunTypography(
  slideId: string,
  objectId: string,
  shape: DeckSnapshot["slides"][number]["shapes"][number]
): Finding[] {
  if (shape.textRuns.length <= 1) {
    return [];
  }
  const families = new Set(shape.textRuns.map((r) => r.fontFamily));
  if (families.size <= 1) {
    return [];
  }
  const role = shape.inferredRole ?? "UNKNOWN";
  const roleScore = shape.inferredRoleScore ?? ROLE_CONFIDENCE_MIN.manual;
  const fontFamilies = [...families].sort((a, b) => a.localeCompare(b));
  const findingId = `finding-${stableHash([slideId, objectId, "mixed_font_families"])}`;
  return [
    {
      id: findingId,
      ruleId: "BP-TYPO-004",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: { fontFamilies },
      expected: { maxDistinctFamilies: 1 },
      evidence: [
        evidence(
          "PLAYBOOK_EVIDENCE",
          "Multiple font families in a single text box is typically unintentional."
        ),
        evidence(
          "TYPOGRAPHIC_EVIDENCE",
          `Found ${fontFamilies.length} distinct families: ${fontFamilies.join(", ")}`
        )
      ],
      confidence: roleScore,
      risk: "manual",
      severity: "warn",
      coverage: "ANALYZED"
    }
  ];
}

function evaluateProofingLanguage(
  slideId: string,
  objectId: string,
  shape: DeckSnapshot["slides"][number]["shapes"][number],
  dominantLanguage: string | null,
  suggestedPatches: PatchOp[]
): Finding[] {
  if (!dominantLanguage) {
    return [];
  }
  const run = shape.textRuns[0];
  if (!run?.proofingLanguage) {
    return [];
  }
  if (run.proofingLanguage === dominantLanguage) {
    return [];
  }
  const role = shape.inferredRole ?? "UNKNOWN";
  const roleScore = shape.inferredRoleScore ?? 1;
  const findingId = `finding-${stableHash([slideId, objectId, "proofing_lang"])}`;
  const patchId = `patch-${stableHash([findingId, "NORMALIZE_LANGUAGE_TAGS"])}`;

  suggestedPatches.push({
    id: patchId,
    op: "NORMALIZE_LANGUAGE_TAGS",
    target: {
      slideId,
      objectId,
      preconditionHash: stableHash({ proofingLanguage: run.proofingLanguage })
    },
    fields: { proofingLanguage: dominantLanguage },
    risk: "safe"
  });

  return [
    {
      id: findingId,
      ruleId: "BP-HYGIENE-005",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: { proofingLanguage: run.proofingLanguage },
      expected: { proofingLanguage: dominantLanguage },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Inconsistent proofing language causes spell-check issues."),
        evidence("HYGIENE_EVIDENCE", "Element language differs from deck-dominant language.")
      ],
      confidence: roleScore,
      risk: "safe",
      severity: "info",
      coverage: "ANALYZED",
      suggestedPatchId: patchId
    }
  ];
}

function normalizeShapeText(shape: DeckSnapshot["slides"][number]["shapes"][number]): string {
  const raw = shape.textRuns.map((r) => r.text).join(" ");
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Higher z-index is treated as the duplicate; tie-break: lexicographically greater objectId. */
function pickLikelyDuplicate(
  a: DeckSnapshot["slides"][number]["shapes"][number],
  b: DeckSnapshot["slides"][number]["shapes"][number]
): DeckSnapshot["slides"][number]["shapes"][number] {
  if (a.zIndex !== b.zIndex) {
    return a.zIndex > b.zIndex ? a : b;
  }
  return a.objectId > b.objectId ? a : b;
}

function evaluateDuplicateOverlaps(slide: DeckSnapshot["slides"][number], tol: ToleranceConfig): Finding[] {
  const findings: Finding[] = [];
  const shapes = slide.shapes.filter((s) => s.supportedForAnalysis);
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      if (a === undefined || b === undefined) {
        continue;
      }
      const iou = computeIOU(a.geometry, b.geometry);
      if (iou < tol.duplicateIouThreshold) {
        continue;
      }
      const textA = normalizeShapeText(a);
      const textB = normalizeShapeText(b);
      if (textA.length === 0 && textB.length === 0) {
        continue;
      }
      if (textA !== textB && !textA.includes(textB) && !textB.includes(textA)) {
        continue;
      }
      const duplicate = pickLikelyDuplicate(a, b);
      const original = duplicate.objectId === a.objectId ? b : a;
      const role = duplicate.inferredRole ?? "UNKNOWN";
      const roleScore = duplicate.inferredRoleScore ?? ROLE_CONFIDENCE_MIN.manual;
      const findingId = `finding-${stableHash([slide.slideId, duplicate.objectId, original.objectId, "dup_overlap"])}`;
      findings.push({
        id: findingId,
        ruleId: "BP-HYGIENE-003",
        source: "playbook",
        slideId: slide.slideId,
        objectId: duplicate.objectId,
        role,
        observed: {
          objectId: duplicate.objectId,
          iou,
          pairedObjectId: original.objectId
        },
        expected: { noDuplicateOverlaps: true },
        evidence: [
          evidence(
            "PLAYBOOK_EVIDENCE",
            "Overlapping objects with identical content suggest a copy-paste duplicate."
          ),
          evidence("GEOMETRIC_EVIDENCE", `IOU: ${iou.toFixed(2)}`)
        ],
        confidence: roleScore,
        risk: "manual",
        severity: "warn",
        coverage: "ANALYZED"
      });
    }
  }
  return findings;
}

function resolveExemplarSlideId(deck: DeckSnapshot): string {
  const sorted = [...deck.slides].sort((a, b) => a.index - b.index || a.slideId.localeCompare(b.slideId));
  return sorted[0]?.slideId ?? "";
}

const LAYOUT003_ROLES = new Set<RoleV1>([
  "TITLE",
  "SUBTITLE",
  "BODY",
  "BULLET_L1",
  "BULLET_L2",
  "FOOTER",
  "CALLOUT"
]);

function maxSnapDeltaToWholePoints(geometry: GeometrySnapshot): number {
  const vals = [geometry.left, geometry.top, geometry.width, geometry.height];
  let max = 0;
  for (const v of vals) {
    const d = Math.abs(v - Math.round(v));
    if (d > max) {
      max = d;
    }
  }
  return max;
}

function hasMicroFractions(geometry: GeometrySnapshot): boolean {
  return maxSnapDeltaToWholePoints(geometry) > 1e-6;
}

function evaluateTitleFooterLayoutFindings(
  slide: DeckSnapshot["slides"][number],
  shape: DeckSnapshot["slides"][number]["shapes"][number],
  role: RoleV1,
  styleMap: StyleMap,
  tol: ToleranceConfig
): Finding[] {
  const findings: Finding[] = [];
  const g = shape.geometry;
  const cx = g.left + g.width / 2;
  const cy = g.top + g.height / 2;
  const roleScore = shape.inferredRoleScore ?? 0;

  if (role === "TITLE") {
    const title = styleMap.TITLE;
    if (!title?.hasGeometryCluster || !title.geometryCentroid) {
      return findings;
    }
    const dist = Math.hypot(cx - title.geometryCentroid.x, cy - title.geometryCentroid.y);
    if (dist > tol.positionPt) {
      const findingId = `finding-${stableHash([slide.slideId, shape.objectId, "BP-LAYOUT-001"])}`;
      findings.push({
        id: findingId,
        ruleId: "BP-LAYOUT-001",
        source: "exemplar",
        slideId: slide.slideId,
        objectId: shape.objectId,
        role,
        observed: { boxCenter: { x: cx, y: cy }, distancePt: dist },
        expected: { geometryCentroid: title.geometryCentroid, tolerancePt: tol.positionPt },
        evidence: [
          evidence("EXEMPLAR_EVIDENCE", "Exemplar title band centroid from style map."),
          evidence("GEOMETRIC_EVIDENCE", "Title box center is outside the exemplar tolerance band.")
        ],
        confidence: roleScore,
        risk: "manual",
        severity: "info",
        coverage: "ANALYZED"
      });
    }
    return findings;
  }

  if (role === "FOOTER") {
    const footer = styleMap.FOOTER;
    if (!footer?.hasGeometryCluster || footer.footerTopMedian === undefined) {
      return findings;
    }
    const delta = Math.abs(g.top - footer.footerTopMedian);
    if (delta > tol.positionPt) {
      const findingId = `finding-${stableHash([slide.slideId, shape.objectId, "BP-LAYOUT-002"])}`;
      findings.push({
        id: findingId,
        ruleId: "BP-LAYOUT-002",
        source: "exemplar",
        slideId: slide.slideId,
        objectId: shape.objectId,
        role,
        observed: { top: g.top, deltaFromMedian: delta },
        expected: { footerTopMedian: footer.footerTopMedian, tolerancePt: tol.positionPt },
        evidence: [
          evidence("EXEMPLAR_EVIDENCE", "Exemplar footer top median from style map."),
          evidence("GEOMETRIC_EVIDENCE", "Footer top is outside the exemplar tolerance band.")
        ],
        confidence: roleScore,
        risk: "manual",
        severity: "info",
        coverage: "ANALYZED"
      });
    }
  }

  return findings;
}

function evaluateBreadcrumbLayoutFindings(
  slide: DeckSnapshot["slides"][number],
  shape: DeckSnapshot["slides"][number]["shapes"][number],
  styleMap: StyleMap,
  tol: ToleranceConfig
): Finding[] {
  const band = styleMap.breadcrumbBand;
  if (!band) {
    return [];
  }
  const role = shape.inferredRole ?? "UNKNOWN";
  if (role !== "UNKNOWN") {
    return [];
  }
  const g = shape.geometry;
  if (g.top >= 80 || g.left >= 250) {
    return [];
  }
  if (!shape.textRuns.some((run) => run.fontSizePt <= 13)) {
    return [];
  }
  const delta = Math.abs(g.left - band.left);
  if (delta <= tol.positionPt) {
    return [];
  }
  const roleScore = shape.inferredRoleScore ?? 0;
  const findingId = `finding-${stableHash([slide.slideId, shape.objectId, "BP-LAYOUT-004"])}`;
  return [
    {
      id: findingId,
      ruleId: "BP-LAYOUT-004",
      source: "exemplar",
      slideId: slide.slideId,
      objectId: shape.objectId,
      role: "UNKNOWN",
      observed: { left: g.left, deltaFromExemplarLeft: delta },
      expected: { breadcrumbBandLeft: band.left, tolerancePt: tol.positionPt },
      evidence: [
        evidence("EXEMPLAR_EVIDENCE", "Exemplar breadcrumb band left from style map."),
        evidence("GEOMETRIC_EVIDENCE", "Breadcrumb horizontal position differs from exemplar.")
      ],
      confidence: roleScore,
      risk: "manual",
      severity: "info",
      coverage: "ANALYZED"
    }
  ];
}

function evaluateLayoutMicroSnapFindings(
  slide: DeckSnapshot["slides"][number],
  shape: DeckSnapshot["slides"][number]["shapes"][number],
  role: RoleV1,
  roleScore: number,
  tol: ToleranceConfig,
  exemplarSlideId: string
): Finding[] {
  if (!LAYOUT003_ROLES.has(role) || roleScore < 0.8) {
    return [];
  }
  const g = shape.geometry;
  if (!hasMicroFractions(g)) {
    return [];
  }
  const snapDelta = maxSnapDeltaToWholePoints(g);

  if (slide.slideId !== exemplarSlideId) {
    return [
      createNotAnalyzedFinding(
        slide.slideId,
        shape.objectId,
        "EXPECTED_CONFIDENCE_LOW",
        "Micro-snap layout check runs on the exemplar slide only in v1."
      )
    ];
  }

  if (snapDelta <= tol.geometryMicroSnapDeltaPt) {
    const findingId = `finding-${stableHash([slide.slideId, shape.objectId, "BP-LAYOUT-003"])}`;
    return [
      {
        id: findingId,
        ruleId: "BP-LAYOUT-003",
        source: "playbook",
        slideId: slide.slideId,
        objectId: shape.objectId,
        role,
        observed: { geometry: g, snapDeltaToWholePoints: snapDelta },
        expected: { wholePointGeometry: true, maxSnapDeltaPt: tol.geometryMicroSnapDeltaPt },
        evidence: [
          evidence("PLAYBOOK_EVIDENCE", "Geometry uses fractional points; micro-snap is within tolerance."),
          evidence("GEOMETRIC_EVIDENCE", "Coordinates are sub-point; normalization would be a small nudge.")
        ],
        confidence: roleScore,
        risk: "manual",
        severity: "info",
        coverage: "ANALYZED"
      }
    ];
  }

  return [];
}

export function collectGroupSafetyFindings(deck: DeckSnapshot, patches: PatchOp[]): Finding[] {
  const findings: Finding[] = [];
  const byTarget = new Map<string, DeckSnapshot["slides"][number]["shapes"][number]>();
  for (const s of deck.slides) {
    for (const sh of s.shapes) {
      byTarget.set(`${s.slideId}:${sh.objectId}`, sh);
    }
  }
  const geomOps = new Set<PatchOp["op"]>(["MOVE_GEOMETRY", "RESIZE_GEOMETRY"]);
  const seen = new Set<string>();
  for (const patch of patches) {
    if (!geomOps.has(patch.op)) {
      continue;
    }
    const key = `${patch.target.slideId}:${patch.target.objectId}`;
    const shape = byTarget.get(key);
    if (!shape?.grouped) {
      continue;
    }
    const dedupe = `${key}:${patch.op}`;
    if (seen.has(dedupe)) {
      continue;
    }
    seen.add(dedupe);
    findings.push({
      id: `finding-${stableHash([key, "BP-SAFETY-001", patch.op])}`,
      ruleId: "BP-SAFETY-001",
      source: "playbook",
      slideId: patch.target.slideId,
      objectId: patch.target.objectId,
      role: shape.inferredRole ?? "UNKNOWN",
      observed: { grouped: true, patchOp: patch.op },
      expected: { neverBreakGroups: true },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Grouped objects must not receive implicit geometry patches in v1."),
        evidence("HYGIENE_EVIDENCE", "A geometry patch was suggested for a grouped shape.")
      ],
      confidence: shape.inferredRoleScore ?? ROLE_CONFIDENCE_MIN.manual,
      risk: "manual",
      severity: "info",
      coverage: "ANALYZED"
    });
  }
  return findings;
}

function createMastersHygieneFinding(deck: DeckSnapshot): Finding {
  const slideId = resolveExemplarSlideId(deck);
  return {
    id: `finding-${stableHash([deck.deckId, "BP-MASTERS-001"])}`,
    ruleId: "BP-MASTERS-001",
    source: "playbook",
    slideId,
    observed: { masterLayoutMetadataAvailable: deck.masterLayoutMetadataAvailable ?? false },
    expected: { masterLayoutKnown: true },
    evidence: [
      evidence("PLAYBOOK_EVIDENCE", "Masters/layout hygiene is report-only in v1."),
      evidence("HYGIENE_EVIDENCE", "No master or layout metadata was provided by the host.")
    ],
    confidence: 1,
    risk: "manual",
    severity: "info",
    coverage: "ANALYZED"
  };
}

function objectKey(slideId: string, objectId: string): string {
  return `${slideId}:${objectId}`;
}
