import { describe, expect, it } from "vitest";
import { inferRoles } from "../src/public-api.js";
import { createDeck, createShape, createSlide, makeFooterBandShape, makeOverflowBodyShape, makeSubtitleBandShape } from "./fixtures.js";

describe("inferRoles", () => {
  // Same deck snapshot should infer identical roles on repeat runs
  it("is deterministic for the same deck", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          shapes: [
            createShape({
              objectId: "title",
              geometry: { left: 20, top: 40, width: 800, height: 80, rotation: 0 },
              textRuns: [
                {
                  text: "Quarterly Review",
                  fontFamily: "Aptos Display",
                  fontSizePt: 32,
                  bold: true,
                  italic: false,
                  fontColor: "#112233",
                  fontAlpha: 1
                }
              ]
            }),
            createShape({
              objectId: "body",
              geometry: { left: 40, top: 260, width: 900, height: 240, rotation: 0 },
              textRuns: [
                {
                  text: "Body paragraph",
                  fontFamily: "Aptos",
                  fontSizePt: 14,
                  bold: false,
                  italic: false,
                  fontColor: "#111111",
                  fontAlpha: 1
                }
              ],
              paragraphs: [
                {
                  level: 0,
                  text: "Body paragraph"
                }
              ]
            })
          ]
        })
      ]
    });

    const first = inferRoles(deck);
    const second = inferRoles(deck);
    const inferredTitleRole = first.deck.slides[0]?.shapes[0]?.inferredRole;

    expect(first).toEqual(second);
    expect(inferredTitleRole).toBe("TITLE");
  });

  // Charts and other unsupported host objects are explicitly not analyzed
  it("emits not analyzed for unsupported objects", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          shapes: [
            createShape({
              objectId: "chart-1",
              shapeType: "CHART",
              supportedForAnalysis: false
            })
          ]
        })
      ]
    });

    const result = inferRoles(deck);
    expect(result.notAnalyzed).toHaveLength(1);
    expect(result.notAnalyzed[0]?.reason).toBe("UNSUPPORTED_OBJECT_TYPE");
  });

  // Overflow body text pushed to bottom of slide must not be misclassified as FOOTER
  it("shape at top=360 with 18pt font does NOT score FOOTER", () => {
    const deck = createDeck({
      slides: [createSlide({ shapes: [makeOverflowBodyShape()] })]
    });
    const result = inferRoles(deck);
    const shape = result.deck.slides[0]?.shapes[0];
    expect(shape?.inferredRole).not.toBe("FOOTER");
  });

  // Shape at top=390 with 10pt font scores FOOTER under loosened threshold
  it("shape at top=390 with 10pt font scores FOOTER", () => {
    const deck = createDeck({
      slides: [createSlide({ shapes: [makeFooterBandShape()] })]
    });
    const result = inferRoles(deck);
    const shape = result.deck.slides[0]?.shapes[0];
    expect(shape?.inferredRole).toBe("FOOTER");
  });

  // Subtitle at top=185 is now within loosened threshold
  it("shape at top=185 with 18pt font scores SUBTITLE", () => {
    const deck = createDeck({
      slides: [createSlide({ shapes: [makeSubtitleBandShape()] })]
    });
    const result = inferRoles(deck);
    const shape = result.deck.slides[0]?.shapes[0];
    expect(shape?.inferredRole).toBe("SUBTITLE");
  });

  // Bold 18pt title at the top band (compact template) — must score TITLE, not UNKNOWN
  it("bold 18pt shape at top=80 scores TITLE", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          shapes: [
            createShape({
              objectId: "compact-title",
              geometry: { left: 24, top: 80, width: 640, height: 50, rotation: 0 },
              textRuns: [
                {
                  text: "Section Overview",
                  fontFamily: "Aptos Display",
                  fontSizePt: 18,
                  bold: true,
                  italic: true,
                  fontColor: "#112233",
                  fontAlpha: 1
                }
              ],
              paragraphs: [{ level: 0, text: "Section Overview" }]
            })
          ]
        })
      ]
    });
    const result = inferRoles(deck);
    const shape = result.deck.slides[0]?.shapes[0];
    expect(shape?.inferredRole).toBe("TITLE");
  });

  // 10pt body text (dense corporate slide) — must score BODY, not UNKNOWN
  it("10pt level-0 shape scores BODY", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          shapes: [
            createShape({
              objectId: "dense-body",
              geometry: { left: 60, top: 240, width: 500, height: 80, rotation: 0 },
              textRuns: [
                {
                  text: "Detailed analysis of the quarterly figures",
                  fontFamily: "Calibri",
                  fontSizePt: 10,
                  bold: false,
                  italic: false,
                  fontColor: "#333333",
                  fontAlpha: 1
                }
              ],
              paragraphs: [{ level: 0, text: "Detailed analysis of the quarterly figures" }]
            })
          ]
        })
      ]
    });
    const result = inferRoles(deck);
    const shape = result.deck.slides[0]?.shapes[0];
    expect(shape?.inferredRole).toBe("BODY");
  });
});
