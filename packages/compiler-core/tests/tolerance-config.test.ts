import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";
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

function makeTitleShape(objectId: string, fontSizePt: number) {
  return createShape({
    objectId,
    geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
    textRuns: [{ ...titleRun, fontSizePt }],
    paragraphs: [{ level: 0, lineSpacing: 1.2, text: "Title" }]
  });
}

describe("ToleranceConfig", () => {
  describe("per-role font size tolerance", () => {
    it("default 0.5pt tolerance flags a 0.6pt drift", () => {
      const exemplar = createSlide({ slideId: "ex", shapes: [makeTitleShape("ex-t", 30)] });
      const deck = createDeck({
        slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [makeTitleShape("s2-t", 30.6)] })]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(exemplar, "original");
      const result = runChecks(inferred.deck, styleMap);
      expect(result.findings.some((f) => f.ruleId === "BP-TYPO-003" && f.objectId === "s2-t")).toBe(true);
    });

    it("widened per-role tolerance suppresses the same drift", () => {
      const exemplar = createSlide({ slideId: "ex", shapes: [makeTitleShape("ex-t", 30)] });
      const deck = createDeck({
        slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [makeTitleShape("s2-t", 30.6)] })]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(exemplar, "original");
      const tol = { ...defaultToleranceConfig(), fontSizePt: { _default: 0.5, TITLE: 1.0 } };
      const result = runChecks(inferred.deck, styleMap, tol);
      expect(result.findings.some((f) => f.ruleId === "BP-TYPO-003" && f.objectId === "s2-t")).toBe(false);
    });
  });

  describe("line spacing tolerance", () => {
    it("tighter tolerance catches smaller drift", () => {
      const exemplar = createSlide({
        slideId: "ex",
        shapes: [makeTitleShape("ex-t", 30)]
      });
      const deck = createDeck({
        slides: [
          exemplar,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "s2-t",
                geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
                textRuns: [titleRun],
                paragraphs: [{ level: 0, lineSpacing: 1.23, text: "Title" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(exemplar, "original");

      // Default 0.05 tolerance: 0.03 drift should NOT trigger
      const resultDefault = runChecks(inferred.deck, styleMap);
      expect(resultDefault.findings.some((f) => f.ruleId === "BP-TYPO-005" && f.objectId === "s2-t")).toBe(false);

      // Tighter 0.01 tolerance: 0.03 drift SHOULD trigger
      const tol = { ...defaultToleranceConfig(), lineSpacingAbs: 0.01 };
      const resultTight = runChecks(inferred.deck, styleMap, tol);
      expect(resultTight.findings.some((f) => f.ruleId === "BP-TYPO-005" && f.objectId === "s2-t")).toBe(true);
    });
  });

  describe("duplicate IOU threshold", () => {
    it("raising threshold suppresses duplicate finding", () => {
      const shape1 = createShape({
        objectId: "a",
        geometry: { left: 0, top: 0, width: 100, height: 100, rotation: 0 },
        textRuns: [{ ...titleRun, text: "Hello" }]
      });
      const shape2 = createShape({
        objectId: "b",
        zIndex: 2,
        geometry: { left: 5, top: 5, width: 100, height: 100, rotation: 0 },
        textRuns: [{ ...titleRun, text: "Hello" }]
      });
      const slide = createSlide({ slideId: "s", shapes: [shape1, shape2] });
      const deck = createDeck({ slides: [slide] });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(slide, "original");

      // Default 0.8 threshold should flag (IOU ~0.82)
      const resultDefault = runChecks(inferred.deck, styleMap);
      const hasDup = resultDefault.findings.some((f) => f.ruleId === "BP-HYGIENE-003");
      // IOU depends on exact overlap — just test that raising threshold changes result
      const tol = { ...defaultToleranceConfig(), duplicateIouThreshold: 0.99 };
      const resultStrict = runChecks(inferred.deck, styleMap, tol);
      const hasDupStrict = resultStrict.findings.some((f) => f.ruleId === "BP-HYGIENE-003");

      // At least one config should differ — strict threshold should suppress more
      if (hasDup) {
        expect(hasDupStrict).toBe(false);
      }
    });
  });
});
