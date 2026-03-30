import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import {
  createDeck,
  createShape,
  createSlide,
  makeBreadcrumbBandUnknownShape,
  makeTitleBandShape
} from "./fixtures.js";
import { defaultToleranceConfig } from "@magistrat/shared-types";

const titleRun = {
  text: "Title",
  fontFamily: "Aptos Display",
  fontSizePt: 30,
  bold: true,
  italic: false,
  fontColor: "#112233",
  fontAlpha: 1
};

describe("BP-LAYOUT-001 — title band", () => {
  it("emits when title center is outside exemplar centroid tolerance", () => {
    const exemplarTitle = createShape({
      objectId: "ex-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const exemplarSlide = createSlide({ slideId: "exemplar", index: 1, shapes: [exemplarTitle] });
    const scanTitle = createShape({
      objectId: "scan-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 50, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const deck = createDeck({
      slides: [exemplarSlide, createSlide({ slideId: "scan", index: 2, shapes: [scanTitle] })]
    });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const result = runChecks(inferred.deck, styleMap);
    const finding = result.findings.find((f) => f.ruleId === "BP-LAYOUT-001" && f.objectId === "scan-t");
    expect(finding).toBeDefined();
    expect(finding?.observed.distancePt).toBeGreaterThan(6);
  });

  it("does not emit when within default positionPt", () => {
    const exemplarTitle = createShape({
      objectId: "ex-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const exemplarSlide = createSlide({ slideId: "exemplar", index: 1, shapes: [exemplarTitle] });
    const scanTitle = createShape({
      objectId: "scan-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 22, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const deck = createDeck({
      slides: [exemplarSlide, createSlide({ slideId: "scan", index: 2, shapes: [scanTitle] })]
    });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const result = runChecks(inferred.deck, styleMap);
    expect(result.findings.some((f) => f.ruleId === "BP-LAYOUT-001")).toBe(false);
  });

  it("respects widened positionPt in ToleranceConfig", () => {
    const exemplarTitle = createShape({
      objectId: "ex-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const exemplarSlide = createSlide({ slideId: "exemplar", index: 1, shapes: [exemplarTitle] });
    const scanTitle = createShape({
      objectId: "scan-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 50, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const deck = createDeck({
      slides: [exemplarSlide, createSlide({ slideId: "scan", index: 2, shapes: [scanTitle] })]
    });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const tol = { ...defaultToleranceConfig(), positionPt: 40 };
    const result = runChecks(inferred.deck, styleMap, tol);
    expect(result.findings.some((f) => f.ruleId === "BP-LAYOUT-001")).toBe(false);
  });
});

describe("BP-LAYOUT-004 — breadcrumb band", () => {
  // Real deck breadcrumb shifted right by 40pt should trigger BP-LAYOUT-004
  it("UNKNOWN shape in top band with left position drifted from exemplar emits BP-LAYOUT-004", () => {
    const exemplarSlide = createSlide({
      slideId: "exemplar",
      index: 1,
      shapes: [makeBreadcrumbBandUnknownShape({ objectId: "ex-bc" })]
    });
    const scanSlide = createSlide({
      slideId: "scan",
      index: 2,
      shapes: [makeBreadcrumbBandUnknownShape({ objectId: "scan-bc", geometry: { left: 70, top: 24, width: 120, height: 18, rotation: 0 } })]
    });
    const deck = createDeck({ slides: [exemplarSlide, scanSlide] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    expect(styleMap.breadcrumbBand).toBeDefined();
    const result = runChecks(inferred.deck, styleMap);
    const finding = result.findings.find((f) => f.ruleId === "BP-LAYOUT-004" && f.objectId === "scan-bc");
    expect(finding).toBeDefined();
    expect(finding?.risk).toBe("manual");
    expect(finding?.severity).toBe("info");
  });

  // A title shape in the top band must NOT trigger BP-LAYOUT-004 (different role)
  it("TITLE shape in top band does NOT emit BP-LAYOUT-004", () => {
    const exemplarSlide = createSlide({
      slideId: "exemplar",
      index: 1,
      shapes: [
        makeBreadcrumbBandUnknownShape({ objectId: "ex-bc" }),
        makeTitleBandShape({ objectId: "ex-t" })
      ]
    });
    const scanSlide = createSlide({
      slideId: "scan",
      index: 2,
      shapes: [makeTitleBandShape({ objectId: "scan-t", geometry: { left: 100, top: 40, width: 640, height: 80, rotation: 0 } })]
    });
    const deck = createDeck({ slides: [exemplarSlide, scanSlide] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const result = runChecks(inferred.deck, styleMap);
    expect(result.findings.some((f) => f.ruleId === "BP-LAYOUT-004" && f.objectId === "scan-t")).toBe(false);
  });

  // UNKNOWN shape at top=120 (not in breadcrumb band) must NOT trigger BP-LAYOUT-004
  it("UNKNOWN shape below breadcrumb band does NOT emit BP-LAYOUT-004", () => {
    const exemplarSlide = createSlide({
      slideId: "exemplar",
      index: 1,
      shapes: [makeBreadcrumbBandUnknownShape({ objectId: "ex-bc" })]
    });
    const scanSlide = createSlide({
      slideId: "scan",
      index: 2,
      shapes: [
        makeBreadcrumbBandUnknownShape({
          objectId: "low-bc",
          geometry: { left: 30, top: 120, width: 120, height: 18, rotation: 0 }
        })
      ]
    });
    const deck = createDeck({ slides: [exemplarSlide, scanSlide] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const result = runChecks(inferred.deck, styleMap);
    expect(result.findings.some((f) => f.ruleId === "BP-LAYOUT-004" && f.objectId === "low-bc")).toBe(false);
  });
});

describe("BP-LAYOUT-002 — footer band", () => {
  it("emits when footer top differs from exemplar median beyond tolerance", () => {
    const footerRun = { ...titleRun, fontSizePt: 12, text: "Footer" };
    const exFooter = createShape({
      objectId: "ex-f",
      geometry: { left: 40, top: 470, width: 200, height: 24, rotation: 0 },
      textRuns: [footerRun],
      paragraphs: [{ level: 0, text: "Footer" }]
    });
    const exemplarSlide = createSlide({
      slideId: "exemplar",
      index: 1,
      shapes: [exFooter]
    });
    const scanFooter = createShape({
      objectId: "scan-f",
      geometry: { left: 40, top: 500, width: 200, height: 24, rotation: 0 },
      textRuns: [footerRun],
      paragraphs: [{ level: 0, text: "Footer" }]
    });
    const deck = createDeck({
      slides: [exemplarSlide, createSlide({ slideId: "scan", index: 2, shapes: [scanFooter] })]
    });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const result = runChecks(inferred.deck, styleMap);
    const finding = result.findings.find((f) => f.ruleId === "BP-LAYOUT-002" && f.objectId === "scan-f");
    expect(finding).toBeDefined();
  });
});

describe("BP-LAYOUT-003 — micro-snap (exemplar slide)", () => {
  it("emits info finding on exemplar when geometry is fractional within snap tolerance", () => {
    const titleShape = createShape({
      objectId: "ex-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 20.35, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const exemplarSlide = createSlide({ slideId: "exemplar", index: 1, shapes: [titleShape] });
    const deck = createDeck({ slides: [exemplarSlide] });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const result = runChecks(inferred.deck, styleMap);
    const finding = result.findings.find((f) => f.ruleId === "BP-LAYOUT-003" && f.objectId === "ex-t");
    expect(finding).toBeDefined();
    expect(finding?.coverage).toBe("ANALYZED");
  });

  it("NOT_ANALYZED on non-exemplar slide when geometry is fractional", () => {
    const titleShape = createShape({
      objectId: "s2-t",
      inferredRole: "TITLE",
      inferredRoleScore: 0.95,
      geometry: { left: 20.4, top: 30, width: 900, height: 80, rotation: 0 },
      textRuns: [titleRun],
      paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
    });
    const exemplarSlide = createSlide({
      slideId: "exemplar",
      index: 1,
      shapes: [
        createShape({
          objectId: "ex-t",
          inferredRole: "TITLE",
          inferredRoleScore: 0.95,
          geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
          textRuns: [titleRun],
          paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
        })
      ]
    });
    const deck = createDeck({
      slides: [exemplarSlide, createSlide({ slideId: "scan", index: 2, shapes: [titleShape] })]
    });
    const inferred = inferRoles(deck);
    const { styleMap } = buildStyleMap(exemplarSlide, "original");
    const result = runChecks(inferred.deck, styleMap);
    const na = result.findings.find(
      (f) => f.ruleId === "BP-COVERAGE-001" && f.objectId === "s2-t" && f.notAnalyzedReason === "EXPECTED_CONFIDENCE_LOW"
    );
    expect(na).toBeDefined();
  });
});

describe("BP-MASTERS-001", () => {
  it("emits when master layout metadata is not available", () => {
    const deck = createDeck({
      masterLayoutMetadataAvailable: false,
      slides: [createSlide({ slideId: "s1", shapes: [] })]
    });
    const result = runChecks(deck, {});
    expect(result.findings.some((f) => f.ruleId === "BP-MASTERS-001")).toBe(true);
  });

  it("does not emit when masterLayoutMetadataAvailable is true", () => {
    const deck = createDeck({
      masterLayoutMetadataAvailable: true,
      slides: [createSlide({ slideId: "s1", shapes: [] })]
    });
    const result = runChecks(deck, {});
    expect(result.findings.some((f) => f.ruleId === "BP-MASTERS-001")).toBe(false);
  });
});
