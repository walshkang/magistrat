import type {
  CoverageSnapshot,
  DeckSnapshot,
  Evidence,
  Finding,
  GeometrySnapshot,
  NotAnalyzedReasonCode,
  ParagraphAlignment,
  PatchOp,
  RoleV1,
  RoleStyleTokens,
  StyleMap,
  TableCellSnapshot,
  ToleranceConfig,
  VerticalAlignment
} from "@magistrat/shared-types";
import { defaultToleranceConfig, getFontSizeTolerance, ROLE_V1_VALUES } from "@magistrat/shared-types";
import { runContinuityChecks } from "./continuity.js";
import { ROLE_CONFIDENCE_MIN } from "./constants.js";
import { stableHash } from "./hash.js";
import { selectDominantAlignment } from "./style-map.js";
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

/** Normalize hex for palette membership (same contract as adapter mappers). */
function normalizeColorHex(raw: string): string {
  const color = raw.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color.replace("#", "").toUpperCase()}`;
  }
  return color;
}

/** Unique font + fill colors from the exemplar style map (BP-COLOR-004 palette). */
function buildExemplarColorPalette(styleMap: StyleMap): Set<string> {
  const palette = new Set<string>();
  for (const role of ROLE_V1_VALUES) {
    if (role === "UNKNOWN") {
      continue;
    }
    const t = styleMap[role];
    if (!t) {
      continue;
    }
    if (typeof t.fontColor === "string" && t.fontColor.length > 0) {
      palette.add(normalizeColorHex(t.fontColor));
    }
    if (typeof t.fillColor === "string" && t.fillColor.length > 0) {
      palette.add(normalizeColorHex(t.fillColor));
    }
  }
  return palette;
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
        dominantAlignment: selectDominantAlignment(shape.paragraphs),
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

    for (const finding of evaluatePerSlideLayoutFindings(slide, tol)) {
      pushFinding(finding);
    }

    for (const shape of slide.shapes) {
      if (shape.shapeType !== "TABLE" || !shape.table) {
        continue;
      }
      const tableResult = evaluateTableFindings(slide.slideId, shape, styleMap, deck, exemplarSlideId);
      for (const finding of tableResult.findings) {
        pushFinding(finding);
      }
      suggestedPatches.push(...tableResult.patches);
    }

    for (const shape of slide.shapes) {
      if (shape.shapeType !== "IMAGE" || !shape.imageMetadata) {
        continue;
      }
      const imageResult = evaluateImageAspectRatioFindings(slide.slideId, shape);
      for (const finding of imageResult.findings) {
        pushFinding(finding);
      }
      suggestedPatches.push(...imageResult.patches);
    }
  }

  const exemplarPalette = buildExemplarColorPalette(styleMap);
  if (exemplarPalette.size > 0) {
    for (const slide of deck.slides) {
      for (const shape of slide.shapes) {
        const lw = shape.lineWidth;
        const lc = shape.lineColor;
        if (typeof lc !== "string" || typeof lw !== "number" || lw <= 0) {
          continue;
        }
        const normalizedLine = normalizeColorHex(lc);
        if (exemplarPalette.has(normalizedLine)) {
          continue;
        }
        const roleScore = shape.inferredRoleScore ?? ROLE_CONFIDENCE_MIN.manual;
        const findingId = `finding-${stableHash([slide.slideId, shape.objectId, "BP-COLOR-004"])}`;
        findings.push({
          id: findingId,
          ruleId: "BP-COLOR-004",
          source: "playbook",
          slideId: slide.slideId,
          objectId: shape.objectId,
          role: shape.inferredRole ?? "UNKNOWN",
          observed: { lineColor: normalizedLine, lineWidth: lw },
          expected: { palette: [...exemplarPalette].sort((a, b) => a.localeCompare(b)) },
          evidence: [
            evidence("PLAYBOOK_EVIDENCE", "Shape border color is not in the slide style palette."),
            evidence(
              "COLOR_EVIDENCE",
              "Off-palette borders are a common oversight — authors fix fill colors but forget the 1pt default outline."
            )
          ],
          confidence: roleScore,
          risk: "manual",
          severity: "warn",
          coverage: "ANALYZED"
        });
      }
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

const DOUBLE_SPACE_RE = / {2,}/;

function findFirstDoubleSpaceExcerpt(
  shape: DeckSnapshot["slides"][number]["shapes"][number]
): string | null {
  for (const run of shape.textRuns) {
    const t = run.text.trim();
    const m = DOUBLE_SPACE_RE.exec(t);
    if (m) {
      const idx = m.index ?? 0;
      const half = 20;
      const start = Math.max(0, idx - half);
      const end = Math.min(t.length, idx + m[0].length + half);
      let excerpt = t.slice(start, end);
      if (excerpt.length > 40) {
        excerpt = excerpt.slice(0, 40);
      }
      return excerpt;
    }
  }
  return null;
}

function widthHeightSimilar(
  a: GeometrySnapshot,
  b: GeometrySnapshot,
  ratioMin = 0.8
): boolean {
  if (a.width <= 0 || b.width <= 0 || a.height <= 0 || b.height <= 0) {
    return false;
  }
  const wr = a.width < b.width ? a.width / b.width : b.width / a.width;
  const hr = a.height < b.height ? a.height / b.height : b.height / a.height;
  return wr >= ratioMin && hr >= ratioMin;
}

function evaluatePerSlideLayoutFindings(
  slide: DeckSnapshot["slides"][number],
  tol: ToleranceConfig
): Finding[] {
  const findings: Finding[] = [];
  const slideW = slide.slideWidth > 0 ? slide.slideWidth : 720;
  const slideH = slide.slideHeight > 0 ? slide.slideHeight : 540;

  const layoutCandidates = slide.shapes.filter((s) => {
    if (!s.supportedForAnalysis) {
      return false;
    }
    const g = s.geometry;
    const fullBleed = g.width > 0.8 * slideW && g.height > 0.8 * slideH;
    return !fullBleed;
  });

  if (layoutCandidates.length >= 2) {
    const n = layoutCandidates.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const rank = new Array(n).fill(0);
    const find = (i: number): number => {
      if (parent[i] !== i) {
        parent[i] = find(parent[i]!);
      }
      return parent[i]!;
    };
    const union = (a: number, b: number): void => {
      let ra = find(a);
      let rb = find(b);
      if (ra === rb) {
        return;
      }
      if (rank[ra]! < rank[rb]!) {
        [ra, rb] = [rb, ra];
      }
      parent[rb!] = ra!;
      if (rank[ra] === rank[rb]) {
        rank[ra] += 1;
      }
    };
    const thr = tol.alignmentJitterThreshold;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const li = layoutCandidates[i]!.geometry.left;
        const lj = layoutCandidates[j]!.geometry.left;
        if (Math.abs(li - lj) <= thr) {
          union(i, j);
        }
      }
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      const list = groups.get(r) ?? [];
      list.push(i);
      groups.set(r, list);
    }
    let bestIdxs: number[] | null = null;
    let bestSize = -1;
    let bestMinLeft = Infinity;
    for (const idxs of groups.values()) {
      const minL = Math.min(...idxs.map((i) => layoutCandidates[i]!.geometry.left));
      if (
        idxs.length > bestSize ||
        (idxs.length === bestSize && minL < bestMinLeft)
      ) {
        bestSize = idxs.length;
        bestMinLeft = minL;
        bestIdxs = idxs;
      }
    }
    if (bestIdxs && bestIdxs.length > 0) {
      let sum = 0;
      for (const i of bestIdxs) {
        sum += layoutCandidates[i]!.geometry.left;
      }
      const modeX = sum / bestIdxs.length;
      for (const sh of layoutCandidates) {
        const x = sh.geometry.left;
        const drift = x - modeX;
        const absD = Math.abs(drift);
        if (absD > 1e-6 && absD <= thr) {
          const roleScore = sh.inferredRoleScore ?? ROLE_CONFIDENCE_MIN.manual;
          const findingId = `finding-${stableHash([slide.slideId, sh.objectId, "BP-LAYOUT-007"])}`;
          findings.push({
            id: findingId,
            ruleId: "BP-LAYOUT-007",
            source: "playbook",
            slideId: slide.slideId,
            objectId: sh.objectId,
            role: sh.inferredRole ?? "UNKNOWN",
            observed: { x, drift, modeX },
            expected: { modeX },
            evidence: [
              evidence(
                "PLAYBOOK_EVIDENCE",
                "Left edge deviates from the dominant alignment grid by a small amount."
              ),
              evidence(
                "GEOMETRIC_EVIDENCE",
                "Sub-5pt jitter breaks the invisible grid — the human eye catches it during presentation."
              )
            ],
            confidence: roleScore,
            risk: "caution",
            severity: "warn",
            coverage: "ANALYZED"
          });
        }
      }
    }
  }

  const distShapes = slide.shapes.filter((s) => s.supportedForAnalysis);
  const yBand = tol.distributionYBandThreshold;
  const m = distShapes.length;
  if (m >= 3) {
    const parent2 = Array.from({ length: m }, (_, i) => i);
    const rank2 = new Array(m).fill(0);
    const find2 = (i: number): number => {
      if (parent2[i] !== i) {
        parent2[i] = find2(parent2[i]!);
      }
      return parent2[i]!;
    };
    const union2 = (a: number, b: number): void => {
      let ra = find2(a);
      let rb = find2(b);
      if (ra === rb) {
        return;
      }
      if (rank2[ra]! < rank2[rb]!) {
        [ra, rb] = [rb, ra];
      }
      parent2[rb!] = ra!;
      if (rank2[ra] === rank2[rb]) {
        rank2[ra] += 1;
      }
    };
    for (let i = 0; i < m; i++) {
      for (let j = i + 1; j < m; j++) {
        const ai = distShapes[i]!;
        const aj = distShapes[j]!;
        if (Math.abs(ai.geometry.top - aj.geometry.top) > yBand) {
          continue;
        }
        if (!widthHeightSimilar(ai.geometry, aj.geometry)) {
          continue;
        }
        union2(i, j);
      }
    }
    const groups2 = new Map<number, number[]>();
    for (let i = 0; i < m; i++) {
      const r = find2(i);
      const list = groups2.get(r) ?? [];
      list.push(i);
      groups2.set(r, list);
    }
    const gapTol = tol.distributionGapTolerance;
    const emitted008 = new Set<string>();
    for (const idxs of groups2.values()) {
      if (idxs.length < 3) {
        continue;
      }
      const sorted = [...idxs].sort((a, b) => {
        const la = distShapes[a]!.geometry.left;
        const lb = distShapes[b]!.geometry.left;
        if (la !== lb) {
          return la - lb;
        }
        return distShapes[a]!.objectId.localeCompare(distShapes[b]!.objectId);
      });
      const shapesRow = sorted.map((i) => distShapes[i]!);
      const gaps: number[] = [];
      for (let k = 0; k < shapesRow.length - 1; k++) {
        const a = shapesRow[k]!;
        const b = shapesRow[k + 1]!;
        gaps.push(b.geometry.left - (a.geometry.left + a.geometry.width));
      }
      const meanGap = gaps.reduce((acc, g) => acc + g, 0) / gaps.length;
      for (let k = 0; k < gaps.length; k++) {
        const g = gaps[k]!;
        if (Math.abs(g - meanGap) <= gapTol) {
          continue;
        }
        for (const sh of [shapesRow[k]!, shapesRow[k + 1]!]) {
          if (emitted008.has(sh.objectId)) {
            continue;
          }
          emitted008.add(sh.objectId);
          const roleScore = sh.inferredRoleScore ?? ROLE_CONFIDENCE_MIN.manual;
          const findingId = `finding-${stableHash([slide.slideId, sh.objectId, "BP-LAYOUT-008"])}`;
          findings.push({
            id: findingId,
            ruleId: "BP-LAYOUT-008",
            source: "playbook",
            slideId: slide.slideId,
            objectId: sh.objectId,
            role: sh.inferredRole ?? "UNKNOWN",
            observed: { gap: g, groupSize: shapesRow.length },
            expected: { meanGap },
            evidence: [
              evidence("GEOMETRIC_EVIDENCE", "Horizontal gap to adjacent shape in column group is unequal."),
              evidence(
                "PLAYBOOK_EVIDENCE",
                "Unequal column spacing in a multi-column layout breaks the grid and looks rushed."
              )
            ],
            confidence: roleScore,
            risk: "caution",
            severity: "warn",
            coverage: "ANALYZED"
          });
        }
      }
    }
  }

  const margin = tol.textDensityMarginPt;
  const innerW = Math.max(0, slideW - 2 * margin);
  const innerH = Math.max(0, slideH - 2 * margin);
  const safeArea = innerW * innerH;
  if (safeArea > 1e-6) {
    let totalTextArea = 0;
    for (const s of slide.shapes) {
      if (!s.supportedForAnalysis) {
        continue;
      }
      if (s.shapeType === "IMAGE" || s.shapeType === "CHART") {
        continue;
      }
      const hasText = s.paragraphs.some((p) => p.text.trim().length > 0);
      if (!hasText) {
        continue;
      }
      totalTextArea += s.geometry.width * s.geometry.height;
    }
    const densityRatio = totalTextArea / safeArea;
    if (densityRatio > tol.textDensityMaxRatio) {
      const findingId = `finding-${stableHash([slide.slideId, "BP-LAYOUT-009"])}`;
      findings.push({
        id: findingId,
        ruleId: "BP-LAYOUT-009",
        source: "playbook",
        slideId: slide.slideId,
        observed: {
          densityRatio: Math.round(densityRatio * 100) / 100,
          totalTextAreaPt2: totalTextArea
        },
        expected: { maxDensityRatio: tol.textDensityMaxRatio },
        evidence: [
          evidence("PLAYBOOK_EVIDENCE", "Text area exceeds density threshold for this slide."),
          evidence(
            "GEOMETRIC_EVIDENCE",
            "Wall-of-text slides violate cognitive load principles — consider splitting or reducing content."
          )
        ],
        confidence: 1,
        risk: "manual",
        severity: "info",
        coverage: "ANALYZED"
      });
    }
  }

  return findings;
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

  const doubleSpaceExcerpt = findFirstDoubleSpaceExcerpt(shape);
  if (doubleSpaceExcerpt) {
    const findingId = `finding-${stableHash([slideId, objectId, "BP-TYPO-010"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-TYPO-010",
      source: "playbook",
      slideId,
      objectId,
      role,
      observed: { excerpt: doubleSpaceExcerpt },
      expected: { pattern: "no_double_spaces" },
      evidence: [
        evidence("PLAYBOOK_EVIDENCE", "Double or multiple consecutive spaces found in text."),
        evidence(
          "TEXT_STRING_EVIDENCE",
          "Double spaces break text justification and alignment; an outdated typist convention."
        )
      ],
      confidence: roleScore,
      risk: "safe",
      severity: "info",
      coverage: "ANALYZED"
    });
  }

  if (role === "TITLE") {
    const titleConcat = shape.paragraphs.map((p) => p.text).join(" ").trim();
    if (titleConcat.length > 0) {
      const endsExc = titleConcat.endsWith("?") || titleConcat.endsWith("!");
      if (!endsExc && titleConcat.endsWith(".")) {
        const findingId = `finding-${stableHash([slideId, objectId, "BP-TYPO-011"])}`;
        const observedTitle = titleConcat.length > 120 ? titleConcat.slice(0, 120) : titleConcat;
        findings.push({
          id: findingId,
          ruleId: "BP-TYPO-011",
          source: "playbook",
          slideId,
          objectId,
          role,
          observed: { titleText: observedTitle },
          expected: { terminalPunctuation: "none_or_question_or_exclamation" },
          evidence: [
            evidence("PLAYBOOK_EVIDENCE", "Action title ends with a terminal period."),
            evidence(
              "TEXT_STRING_EVIDENCE",
              "Standard consulting style: action titles don't end with periods — common copy-paste error from Word docs."
            )
          ],
          confidence: roleScore,
          risk: "safe",
          severity: "warn",
          coverage: "ANALYZED"
        });
      }
    }
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

function dominantFillColorForCells(cells: Array<{ fillColor?: string }>): string | undefined {
  const counts = new Map<string, number>();
  for (const c of cells) {
    if (typeof c.fillColor === "string" && c.fillColor.length > 0) {
      const n = normalizeColorHex(c.fillColor);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
  if (counts.size === 0) {
    return undefined;
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = color;
    }
  }
  return best;
}

function pluralityParagraphAlignment(values: ParagraphAlignment[]): ParagraphAlignment | undefined {
  if (values.length < 2) {
    return undefined;
  }
  const counts = new Map<ParagraphAlignment, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: ParagraphAlignment | undefined;
  let bestCount = 0;
  for (const [a, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      best = a;
    }
  }
  const winners = [...counts.entries()].filter(([, c]) => c === bestCount);
  if (winners.length !== 1 || best === undefined) {
    return undefined;
  }
  return best;
}

function evaluateImageAspectRatioFindings(
  slideId: string,
  shape: DeckSnapshot["slides"][number]["shapes"][number]
): { findings: Finding[]; patches: PatchOp[] } {
  const findings: Finding[] = [];
  const patches: PatchOp[] = [];
  if (shape.shapeType !== "IMAGE" || !shape.imageMetadata) {
    return { findings, patches };
  }

  const intrinsic = shape.imageMetadata;
  const rendered = shape.geometry;

  if (
    intrinsic.intrinsicWidth <= 0 ||
    intrinsic.intrinsicHeight <= 0 ||
    rendered.width <= 0 ||
    rendered.height <= 0
  ) {
    return { findings, patches };
  }

  const intrinsicRatio = intrinsic.intrinsicWidth / intrinsic.intrinsicHeight;
  const renderedRatio = rendered.width / rendered.height;
  const DISTORTION_THRESHOLD = 0.01;

  if (Math.abs(intrinsicRatio - renderedRatio) <= DISTORTION_THRESHOLD) {
    return { findings, patches };
  }

  const correctedHeight = rendered.width / intrinsicRatio;
  const findingId = `finding-${stableHash([slideId, shape.objectId, "BP-LAYOUT-005"])}`;
  const patchId = `patch-${stableHash([findingId, "RESTORE_ASPECT_RATIO"])}`;

  findings.push({
    id: findingId,
    ruleId: "BP-LAYOUT-005",
    source: "playbook",
    slideId,
    objectId: shape.objectId,
    observed: {
      renderedWidth: rendered.width,
      renderedHeight: rendered.height,
      renderedRatio: Math.round(renderedRatio * 1000) / 1000,
      intrinsicRatio: Math.round(intrinsicRatio * 1000) / 1000
    },
    expected: {
      aspectRatio: Math.round(intrinsicRatio * 1000) / 1000
    },
    evidence: [
      evidence(
        "GEOMETRIC_EVIDENCE",
        `Rendered aspect ratio ${renderedRatio.toFixed(3)} differs from intrinsic ${intrinsicRatio.toFixed(3)}`
      ),
      evidence(
        "MEDIA_METADATA",
        `Original image ~${Math.round(intrinsic.intrinsicWidth / 0.75)}×${Math.round(intrinsic.intrinsicHeight / 0.75)}px (96 DPI assumption)`
      )
    ],
    confidence: 1,
    risk: "safe",
    severity: "error",
    coverage: "ANALYZED",
    suggestedPatchId: patchId
  });

  patches.push({
    id: patchId,
    op: "RESTORE_ASPECT_RATIO",
    target: {
      slideId,
      objectId: shape.objectId,
      preconditionHash: stableHash(shape.geometry)
    },
    fields: { height: correctedHeight },
    risk: "safe"
  });

  return { findings, patches };
}

function evaluateTableFindings(
  slideId: string,
  shape: DeckSnapshot["slides"][number]["shapes"][number],
  styleMap: StyleMap,
  deck: DeckSnapshot,
  exemplarSlideId: string
): { findings: Finding[]; patches: PatchOp[] } {
  const findings: Finding[] = [];
  const patches: PatchOp[] = [];
  if (shape.shapeType !== "TABLE" || !shape.table) {
    return { findings, patches };
  }

  const table = shape.table;

  const expectedFont = styleMap.BODY?.fontFamily ?? styleMap.BULLET_L1?.fontFamily;
  if (expectedFont) {
    const offendingCells: Array<{ row: number; col: number; fontFamily: string }> = [];
    for (const cell of table.cells) {
      for (const run of cell.textRuns) {
        if (run.text.trim().length === 0) {
          continue;
        }
        if (run.fontFamily.toLowerCase() !== expectedFont.toLowerCase()) {
          offendingCells.push({ row: cell.rowIndex, col: cell.columnIndex, fontFamily: run.fontFamily });
          break;
        }
      }
    }
    if (offendingCells.length > 0) {
      const findingId = `finding-${stableHash([slideId, shape.objectId, "BP-TABLE-005"])}`;
      const patchId = `patch-${stableHash([findingId, "SET_TABLE_FONT"])}`;
      findings.push({
        id: findingId,
        ruleId: "BP-TABLE-005",
        source: "exemplar",
        slideId,
        objectId: shape.objectId,
        observed: { cells: offendingCells },
        expected: { fontFamily: expectedFont },
        evidence: [
          evidence("TABLE_EVIDENCE", "Table cell text run font differs from body style map."),
          evidence("TYPOGRAPHIC_EVIDENCE", "Off-brand fonts often enter via pasted tables.")
        ],
        confidence: 1,
        risk: "safe",
        severity: "error",
        coverage: "ANALYZED",
        suggestedPatchId: patchId
      });
      patches.push({
        id: patchId,
        op: "SET_TABLE_FONT",
        target: {
          slideId,
          objectId: shape.objectId,
          preconditionHash: stableHash(table)
        },
        fields: { fontFamily: expectedFont },
        risk: "safe"
      });
    }
  }

  if (slideId !== exemplarSlideId) {
    const exemplarSlide = deck.slides.find((s) => s.slideId === exemplarSlideId);
    const exemplarTableShape = exemplarSlide?.shapes.find((s) => s.shapeType === "TABLE" && s.table);
    if (exemplarTableShape?.table) {
      const headerCells = exemplarTableShape.table.cells.filter((c) => c.rowIndex === 0);
      const exemplarHeaderFill = dominantFillColorForCells(headerCells);
      if (exemplarHeaderFill) {
        const scannedHeaderCells = table.cells.filter((c) => c.rowIndex === 0);
        const scannedHeaderFill = dominantFillColorForCells(scannedHeaderCells);
        if (scannedHeaderFill !== undefined && scannedHeaderFill !== exemplarHeaderFill) {
          findings.push({
            id: `finding-${stableHash([slideId, shape.objectId, "BP-TABLE-001"])}`,
            ruleId: "BP-TABLE-001",
            source: "exemplar",
            slideId,
            objectId: shape.objectId,
            observed: { headerFillColor: scannedHeaderFill },
            expected: { headerFillColor: exemplarHeaderFill },
            evidence: [
              evidence("EXEMPLAR_EVIDENCE", "Exemplar table header fill differs from scanned table."),
              evidence("TABLE_EVIDENCE", "Header row fill color mismatch.")
            ],
            confidence: 1,
            risk: "manual",
            severity: "error",
            coverage: "ANALYZED"
          });
        }
      }
    }
  }

  const byColumn = new Map<number, typeof table.cells>();
  for (const cell of table.cells) {
    if (cell.rowIndex === 0) {
      continue;
    }
    const arr = byColumn.get(cell.columnIndex) ?? [];
    arr.push(cell);
    byColumn.set(cell.columnIndex, arr);
  }
  for (const [colIndex, cells] of byColumn) {
    if (cells.length < 2) {
      continue;
    }
    const withAlign = cells.filter((c): c is typeof c & { textAlignment: ParagraphAlignment } => c.textAlignment !== undefined);
    if (withAlign.length < 2) {
      continue;
    }
    const majorityAlignment = pluralityParagraphAlignment(withAlign.map((c) => c.textAlignment));
    if (!majorityAlignment) {
      continue;
    }
    for (const cell of cells) {
      if (cell.textAlignment === undefined) {
        continue;
      }
      if (cell.textAlignment !== majorityAlignment) {
        const findingId = `finding-${stableHash([slideId, shape.objectId, "BP-TABLE-004", colIndex, cell.rowIndex])}`;
        const patchId = `patch-${stableHash([findingId, "APPLY_MAJORITY_ALIGNMENT"])}`;
        findings.push({
          id: findingId,
          ruleId: "BP-TABLE-004",
          source: "playbook",
          slideId,
          objectId: shape.objectId,
          observed: { alignment: cell.textAlignment, row: cell.rowIndex, col: cell.columnIndex },
          expected: { alignment: majorityAlignment, column: colIndex },
          evidence: [
            evidence("TABLE_EVIDENCE", "Intra-column alignment differs from column plurality."),
            evidence("TYPOGRAPHIC_EVIDENCE", "Mixed alignment in table body column.")
          ],
          confidence: 1,
          risk: "safe",
          severity: "warn",
          coverage: "ANALYZED",
          suggestedPatchId: patchId
        });
        patches.push({
          id: patchId,
          op: "APPLY_MAJORITY_ALIGNMENT",
          target: {
            slideId,
            objectId: shape.objectId,
            preconditionHash: stableHash({ col: colIndex, row: cell.rowIndex })
          },
          fields: { alignment: majorityAlignment, columnIndex: colIndex },
          risk: "safe"
        });
      }
    }
  }

  // BP-TABLE-002 — Table Border Color Consistency (exemplar)
  if (slideId !== exemplarSlideId) {
    const exemplarSlide = deck.slides.find((s) => s.slideId === exemplarSlideId);
    const exemplarTableShape = exemplarSlide?.shapes.find((s) => s.shapeType === "TABLE" && s.table);
    if (exemplarTableShape?.table) {
      const exemplarBorderSchema = extractBorderSchema(exemplarTableShape.table.cells);
      if (exemplarBorderSchema) {
        const scannedBorderSchema = extractBorderSchema(table.cells);
        if (scannedBorderSchema) {
          const mismatches = compareBorderSchemas(exemplarBorderSchema, scannedBorderSchema);
          if (mismatches.length > 0) {
            findings.push({
              id: `finding-${stableHash([slideId, shape.objectId, "BP-TABLE-002"])}`,
              ruleId: "BP-TABLE-002",
              source: "exemplar",
              slideId,
              objectId: shape.objectId,
              observed: { mismatches },
              expected: { borderSchema: exemplarBorderSchema },
              evidence: [
                evidence("EXEMPLAR_EVIDENCE", "Table border colors differ from exemplar table."),
                evidence("TABLE_EVIDENCE", "Mixed border colors signal template mixing.")
              ],
              confidence: 1,
              risk: "manual",
              severity: "warn",
              coverage: "ANALYZED"
            });
          }
        }
      }
    }
  }

  // BP-TABLE-007 — Vertical Alignment Inconsistency (playbook, per-row)
  const byRow = new Map<number, TableCellSnapshot[]>();
  for (const cell of table.cells) {
    const arr = byRow.get(cell.rowIndex) ?? [];
    arr.push(cell);
    byRow.set(cell.rowIndex, arr);
  }
  for (const [rowIndex, rowCells] of byRow) {
    const withVAlign = rowCells.filter((c): c is TableCellSnapshot & { verticalAlignment: VerticalAlignment } =>
      c.verticalAlignment !== undefined
    );
    if (withVAlign.length < 2) continue;
    const majorityVAlign = pluralityVerticalAlignment(withVAlign.map((c) => c.verticalAlignment));
    if (!majorityVAlign) continue;
    for (const cell of withVAlign) {
      if (cell.verticalAlignment !== majorityVAlign) {
        const findingId = `finding-${stableHash([slideId, shape.objectId, "BP-TABLE-007", rowIndex, cell.columnIndex])}`;
        const patchId = `patch-${stableHash([findingId, "APPLY_MAJORITY_VERTICAL_ALIGN"])}`;
        findings.push({
          id: findingId,
          ruleId: "BP-TABLE-007",
          source: "playbook",
          slideId,
          objectId: shape.objectId,
          observed: { verticalAlignment: cell.verticalAlignment, row: rowIndex, col: cell.columnIndex },
          expected: { verticalAlignment: majorityVAlign, row: rowIndex },
          evidence: [
            evidence("TABLE_EVIDENCE", "Vertical alignment differs from row majority."),
            evidence("TYPOGRAPHIC_EVIDENCE", "Mixed vertical alignment creates jagged row appearance.")
          ],
          confidence: 1,
          risk: "safe",
          severity: "warn",
          coverage: "ANALYZED",
          suggestedPatchId: patchId
        });
        patches.push({
          id: patchId,
          op: "APPLY_MAJORITY_VERTICAL_ALIGN",
          target: {
            slideId,
            objectId: shape.objectId,
            preconditionHash: stableHash({ row: rowIndex, col: cell.columnIndex })
          },
          fields: { verticalAlignment: majorityVAlign, rowIndex },
          risk: "safe"
        });
      }
    }
  }

  // BP-TABLE-006 — Empty Cell Without Explicit Notation (playbook)
  // Only flag if table has at least some data (not a purely structural/spacer table)
  const nonEmptyCellCount = table.cells.filter((c) => c.text.trim().length > 0).length;
  if (nonEmptyCellCount >= 2) {
    const emptyCells: Array<{ row: number; col: number }> = [];
    for (const cell of table.cells) {
      // Skip header row — blank headers are often intentional
      if (cell.rowIndex === 0) continue;
      if (cell.text.trim().length === 0) {
        emptyCells.push({ row: cell.rowIndex, col: cell.columnIndex });
      }
    }
    if (emptyCells.length > 0) {
      findings.push({
        id: `finding-${stableHash([slideId, shape.objectId, "BP-TABLE-006"])}`,
        ruleId: "BP-TABLE-006",
        source: "playbook",
        slideId,
        objectId: shape.objectId,
        observed: { emptyCells },
        expected: { notation: "Use —, 0, NA, or N/A for blank data cells" },
        evidence: [
          evidence("TABLE_EVIDENCE", "Blank data cells found in table."),
          evidence("TEXT_STRING_EVIDENCE", "Empty cells are ambiguous — zero, missing, or not applicable?")
        ],
        confidence: 0.7,
        risk: "manual",
        severity: "info",
        coverage: "ANALYZED"
      });
    }
  }

  // BP-TABLE-009 — Over-Bolding in Data Rows (playbook)
  // Flag data rows (non-header, non-total) where >50% of text chars are bold
  for (const [rowIndex, rowCells] of byRow) {
    if (rowIndex === 0) continue; // skip header
    // Heuristic: skip likely total/summary row (last row with sum/total keyword)
    const isLastRow = rowIndex === table.rows - 1;
    const hasTotal = isLastRow && rowCells.some((c) =>
      /\b(total|sum|subtotal|grand)\b/i.test(c.text)
    );
    if (hasTotal) continue;

    let boldChars = 0;
    let totalChars = 0;
    for (const cell of rowCells) {
      for (const run of cell.textRuns) {
        const len = run.text.trim().length;
        if (len === 0) continue;
        totalChars += len;
        if (run.bold) boldChars += len;
      }
    }
    if (totalChars >= 4 && boldChars / totalChars > 0.5) {
      findings.push({
        id: `finding-${stableHash([slideId, shape.objectId, "BP-TABLE-009", rowIndex])}`,
        ruleId: "BP-TABLE-009",
        source: "playbook",
        slideId,
        objectId: shape.objectId,
        observed: { row: rowIndex, boldRatio: Math.round((boldChars / totalChars) * 100) },
        expected: { maxBoldRatio: 50 },
        evidence: [
          evidence("TABLE_EVIDENCE", "Data row is over 50% bold."),
          evidence("TYPOGRAPHIC_EVIDENCE", "Over-bolding destroys visual hierarchy — when everything is bold, nothing is bold.")
        ],
        confidence: 0.8,
        risk: "manual",
        severity: "info",
        coverage: "ANALYZED"
      });
    }
  }

  return { findings, patches };
}

// Extracts dominant border color per edge position across all cells
function extractBorderSchema(cells: TableCellSnapshot[]): Record<string, string> | undefined {
  const edgeCounts = {
    top: new Map<string, number>(),
    bottom: new Map<string, number>(),
    left: new Map<string, number>(),
    right: new Map<string, number>()
  } as const;
  let hasAny = false;
  for (const cell of cells) {
    if (!cell.borders) continue;
    for (const edge of ["top", "bottom", "left", "right"] as const) {
      const b = cell.borders[edge];
      if (b?.color) {
        const n = normalizeColorHex(b.color);
        const bucket = edgeCounts[edge];
        bucket.set(n, (bucket.get(n) ?? 0) + 1);
        hasAny = true;
      }
    }
  }
  if (!hasAny) return undefined;
  const schema: Record<string, string> = {};
  for (const edge of ["top", "bottom", "left", "right"] as const) {
    const counts = edgeCounts[edge];
    if (!counts) {
      continue;
    }
    let best: string | undefined;
    let bestCount = 0;
    for (const [color, count] of counts) {
      if (count > bestCount) { bestCount = count; best = color; }
    }
    if (best) schema[edge] = best;
  }
  return Object.keys(schema).length > 0 ? schema : undefined;
}

function compareBorderSchemas(
  exemplar: Record<string, string>,
  scanned: Record<string, string>
): Array<{ edge: string; expected: string; actual: string }> {
  const mismatches: Array<{ edge: string; expected: string; actual: string }> = [];
  for (const edge of ["top", "bottom", "left", "right"]) {
    if (exemplar[edge] && scanned[edge] && exemplar[edge] !== scanned[edge]) {
      mismatches.push({ edge, expected: exemplar[edge], actual: scanned[edge] });
    }
  }
  return mismatches;
}

function pluralityVerticalAlignment(values: VerticalAlignment[]): VerticalAlignment | undefined {
  if (values.length < 2) return undefined;
  const counts = new Map<VerticalAlignment, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: VerticalAlignment | undefined;
  let bestCount = 0;
  for (const [a, c] of counts) {
    if (c > bestCount) { bestCount = c; best = a; }
  }
  const winners = [...counts.entries()].filter(([, c]) => c === bestCount);
  if (winners.length !== 1 || best === undefined) return undefined;
  return best;
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
  dominantAlignment?: ParagraphAlignment | undefined;
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

  if (
    input.expected.alignment !== undefined &&
    input.dominantAlignment !== undefined &&
    input.dominantAlignment !== input.expected.alignment
  ) {
    const findingId = `finding-${stableHash([...baseMeta, "BP-TYPO-012"])}`;
    const patchId = `patch-${stableHash([findingId, "SET_TEXT_ALIGNMENT"])}`;
    findings.push({
      id: findingId,
      ruleId: "BP-TYPO-012",
      source: "exemplar",
      slideId: input.slideId,
      objectId: input.objectId,
      role: input.role,
      observed: { alignment: input.dominantAlignment, role: input.role },
      expected: { alignment: input.expected.alignment },
      evidence: [
        evidence("EXEMPLAR_EVIDENCE", "Text alignment differs from exemplar style for this role."),
        evidence(
          "TYPOGRAPHIC_EVIDENCE",
          "Mismatched alignment creates visual dissonance — e.g., center-aligned body in a left-aligned deck."
        )
      ],
      confidence: input.inferredRoleScore,
      risk: "safe",
      severity: "warn",
      coverage: "ANALYZED",
      suggestedPatchId: patchId
    });

    patches.push({
      id: patchId,
      op: "SET_TEXT_ALIGNMENT",
      target: {
        slideId: input.slideId,
        objectId: input.objectId,
        preconditionHash: stableHash({ alignment: input.dominantAlignment })
      },
      fields: { alignment: input.expected.alignment },
      risk: "safe"
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
