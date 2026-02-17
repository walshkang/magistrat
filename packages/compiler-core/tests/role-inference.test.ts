import { describe, expect, it } from "vitest";
import { inferRoles } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

describe("inferRoles", () => {
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
});
