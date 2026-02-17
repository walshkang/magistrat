import type {
  CoverageSnapshot,
  DeckSnapshot,
  Evidence,
  Finding,
  NotAnalyzedReasonCode,
  PatchOp,
  RoleV1,
  RoleStyleTokens,
  StyleMap
} from "@magistrat/shared-types";
import { stableHash } from "./hash.js";

export interface RunChecksResult {
  findings: Finding[];
  coverage: CoverageSnapshot;
  suggestedPatches: PatchOp[];
}

export function runChecks(deck: DeckSnapshot, styleMap: StyleMap): RunChecksResult {
  const findings: Finding[] = [];
  const suggestedPatches: PatchOp[] = [];

  let analyzedObjects = 0;
  const totalObjects = deck.slides.reduce((acc, slide) => acc + slide.shapes.length, 0);
  const unhandledTypes = new Map<string, number>();

  for (const slide of deck.slides) {
    for (const shape of slide.shapes) {
      if (!shape.supportedForAnalysis) {
        unhandledTypes.set(shape.shapeType, (unhandledTypes.get(shape.shapeType) ?? 0) + 1);
        findings.push(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "UNSUPPORTED_OBJECT_TYPE",
            "Shape type is not supported by v1 checks."
          )
        );
        continue;
      }

      const role = shape.inferredRole ?? "UNKNOWN";
      const roleScore = shape.inferredRoleScore ?? 0;
      if (role === "UNKNOWN" || roleScore < 0.9) {
        findings.push(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "LOW_ROLE_CONFIDENCE",
            "Role confidence was below safe threshold."
          )
        );
        continue;
      }

      const expected = styleMap[role];
      if (!expected) {
        findings.push(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "MISSING_STYLEMAP_ROLE",
            `Style map did not contain role ${role}.`
          )
        );
        continue;
      }

      analyzedObjects += 1;
      const run = shape.textRuns[0];
      if (!run) {
        findings.push(
          createNotAnalyzedFinding(
            slide.slideId,
            shape.objectId,
            "AMBIGUOUS_TEXT_RUNS",
            "No readable text runs were available."
          )
        );
        continue;
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
        bulletHanging: shape.paragraphs[0]?.bulletHanging
      });

      findings.push(...mismatchFindings.findings);
      suggestedPatches.push(...mismatchFindings.patches);

      const textContent = shape.textRuns.map((textRun) => textRun.text).join(" ").toLowerCase();
      if (textContent.includes("click to add") || textContent.includes("lorem ipsum")) {
        const findingId = `finding-${stableHash([slide.slideId, shape.objectId, "placeholder"])}`;
        findings.push({
          id: findingId,
          ruleId: "BP-HYGIENE-004",
          source: "playbook",
          slideId: slide.slideId,
          objectId: shape.objectId,
          role,
          observed: { textContent },
          expected: { pattern: "no_placeholder_text" },
          evidence: [
            evidence("PLAYBOOK_EVIDENCE", "Placeholder text pattern matched."),
            evidence("HYGIENE_EVIDENCE", "Text contains placeholder token.")
          ],
          confidence: 0.99,
          risk: "manual",
          severity: "error",
          coverage: "ANALYZED"
        });
      }

      const isGhost =
        !shape.visible &&
        shape.geometry.width * shape.geometry.height > 200 &&
        shape.zIndex > 0 &&
        shape.textRuns.every((textRun) => textRun.fontAlpha === 0);

      if (isGhost) {
        const findingId = `finding-${stableHash([slide.slideId, shape.objectId, "ghost"])}`;
        const patchId = `patch-${stableHash([findingId, "delete_ghost"])}`;
        findings.push({
          id: findingId,
          ruleId: "BP-HYGIENE-001",
          source: "playbook",
          slideId: slide.slideId,
          objectId: shape.objectId,
          role,
          observed: { visible: shape.visible, zIndex: shape.zIndex },
          expected: { noGhostObjects: true },
          evidence: [
            evidence("PLAYBOOK_EVIDENCE", "Ghost object rule matched strict invisibility profile."),
            evidence("HYGIENE_EVIDENCE", "Invisible object overlaps active content plane.")
          ],
          confidence: 0.92,
          risk: "safe",
          severity: "warn",
          coverage: "ANALYZED",
          suggestedPatchId: patchId
        });

        suggestedPatches.push({
          id: patchId,
          op: "DELETE_GHOST_OBJECT",
          target: {
            slideId: slide.slideId,
            objectId: shape.objectId,
            preconditionHash: stableHash({ shape })
          },
          fields: { delete: true },
          risk: "safe"
        });
      }
    }
  }

  const coverage: CoverageSnapshot = {
    analyzedSlides: deck.slides.length,
    totalSlides: deck.slides.length,
    analyzedObjects,
    totalObjects,
    topUnhandledObjectTypes: [...unhandledTypes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type),
    continuityCoverage: deck.slides.length > 0 ? 1 : 0
  };

  return {
    findings,
    coverage,
    suggestedPatches
  };
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

  if (Math.abs(input.observed.fontSizePt - input.expected.fontSizePt) > 0.5) {
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
    input.role === "BULLET_L1" || input.role === "BULLET_L2" || input.expected.bulletIndent !== undefined;
  if (hasBulletExpectation) {
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
  }

  return {
    findings,
    patches
  };
}
