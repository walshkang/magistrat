import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, planPatches, runChecks } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

describe("patch safety planning", () => {
  it("separates safe and caution patch plans by allowlist", () => {
    const exemplar = createSlide({
      slideId: "exemplar",
      shapes: [
        createShape({
          objectId: "base",
          geometry: { left: 20, top: 40, width: 900, height: 80, rotation: 0 },
          textRuns: [
            {
              text: "Quarterly Review",
              fontFamily: "Aptos Display",
              fontSizePt: 30,
              bold: true,
              italic: false,
              fontColor: "#112233",
              fontAlpha: 1
            }
          ]
        })
      ]
    });

    const deck = createDeck({
      slides: [
        exemplar,
        createSlide({
          slideId: "target",
          index: 2,
          shapes: [
            createShape({
              objectId: "target-title",
              geometry: { left: 20, top: 40, width: 900, height: 80, rotation: 0 },
              textRuns: [
                {
                  text: "Quarterly Review",
                  fontFamily: "Calibri",
                  fontSizePt: 22,
                  bold: false,
                  italic: false,
                  fontColor: "#000000",
                  fontAlpha: 1
                }
              ]
            })
          ]
        })
      ]
    });

    const inferred = inferRoles(deck);
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const checks = runChecks(inferred.deck, styleMap);
    const plan = planPatches(checks.findings, checks.suggestedPatches);

    expect(plan.safe.some((patch) => patch.op === "SET_FONT_FAMILY")).toBe(true);
    expect(plan.safe.some((patch) => patch.op === "SET_FONT_COLOR")).toBe(true);
    expect(plan.caution.some((patch) => patch.op === "SET_FONT_SIZE")).toBe(true);
    expect(plan.manual).toEqual([]);
  });
});
