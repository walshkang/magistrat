import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

describe("runChecks phased execution", () => {
  it("runs object-global hygiene checks even when role confidence gates style checks", () => {
    const exemplar = createSlide({
      slideId: "exemplar",
      shapes: [
        createShape({
          objectId: "exemplar-title",
          geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
          textRuns: [
            {
              text: "Title",
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

    const lowConfidenceBody = createShape({
      objectId: "body-low-confidence",
      geometry: { left: 40, top: 260, width: 900, height: 200, rotation: 0 },
      textRuns: [
        {
          text: "Lorem ipsum",
          fontFamily: "Calibri",
          fontSizePt: 14,
          bold: false,
          italic: false,
          fontColor: "#000000",
          fontAlpha: 1
        }
      ],
      paragraphs: [{ level: 0, text: "Lorem ipsum" }]
    });

    const deck = createDeck({
      slides: [
        exemplar,
        createSlide({
          slideId: "scan",
          index: 2,
          shapes: [lowConfidenceBody]
        })
      ]
    });

    const inferred = inferRoles(deck);
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const result = runChecks(inferred.deck, styleMap);

    const hygiene = result.findings.find(
      (finding) => finding.objectId === "body-low-confidence" && finding.ruleId === "BP-HYGIENE-004"
    );
    const gated = result.findings.find(
      (finding) => finding.objectId === "body-low-confidence" && finding.coverage === "NOT_ANALYZED"
    );

    expect(hygiene).toBeDefined();
    expect(hygiene?.coverage).toBe("ANALYZED");
    expect(gated).toBeDefined();
    expect(result.coverage.analyzedObjects).toBe(2);
  });
});
