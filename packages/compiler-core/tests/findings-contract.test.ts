import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

describe("runChecks findings contract", () => {
  it("emits required finding fields and explicit NOT_ANALYZED", () => {
    const exemplarSlide = createSlide({
      slideId: "exemplar",
      shapes: [
        createShape({
          objectId: "title",
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

    const deck = createDeck({
      slides: [
        exemplarSlide,
        createSlide({
          slideId: "scan",
          index: 2,
          shapes: [
            createShape({
              objectId: "title-drift",
              geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
              textRuns: [
                {
                  text: "Title",
                  fontFamily: "Calibri",
                  fontSizePt: 24,
                  bold: false,
                  italic: false,
                  fontColor: "#000000",
                  fontAlpha: 1
                }
              ]
            }),
            createShape({
              objectId: "unsupported",
              shapeType: "SMART_ART",
              supportedForAnalysis: false
            })
          ]
        })
      ]
    });

    const inferred = inferRoles(deck);
    const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
    const result = runChecks(inferred.deck, styleMap);

    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.id.length).toBeGreaterThan(0);
      expect(finding.ruleId.length).toBeGreaterThan(0);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(Number.isFinite(finding.confidence)).toBe(true);
      expect(["safe", "caution", "manual"]).toContain(finding.risk);
      expect(["info", "warn", "error"]).toContain(finding.severity);
      expect(["ANALYZED", "NOT_ANALYZED"]).toContain(finding.coverage);
    }

    const notAnalyzed = result.findings.find((finding) => finding.coverage === "NOT_ANALYZED");
    expect(notAnalyzed).toBeDefined();
    expect(notAnalyzed?.notAnalyzedReason).toBeDefined();
  });
});
