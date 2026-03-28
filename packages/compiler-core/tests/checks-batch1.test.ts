import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

const titleRun = {
  text: "Title",
  fontFamily: "Aptos Display",
  fontSizePt: 30,
  bold: true,
  italic: false,
  fontColor: "#112233",
  fontAlpha: 1
};

function titleShape(
  objectId: string,
  lineSpacing: number,
  overrides: Parameters<typeof createShape>[0] = {}
): ReturnType<typeof createShape> {
  return createShape({
    objectId,
    geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
    textRuns: [titleRun],
    paragraphs: [
      {
        level: 0,
        lineSpacing,
        text: "Title"
      }
    ],
    ...overrides
  });
}

describe("Phase 2B batch 1 rules", () => {
  describe("BP-TYPO-005 — line spacing vs exemplar", () => {
    it("emits finding and SET_LINE_SPACING patch when spacing differs beyond tolerance", () => {
      const exemplarSlide = createSlide({
        slideId: "exemplar",
        shapes: [titleShape("ex-title", 1.2)]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [titleShape("scan-title", 1.4)]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);

      const finding = result.findings.find((f) => f.ruleId === "BP-TYPO-005" && f.objectId === "scan-title");
      expect(finding).toBeDefined();
      expect(finding?.observed).toEqual({ lineSpacing: 1.4 });
      expect(finding?.expected).toEqual({ lineSpacing: 1.2 });

      const patch = result.suggestedPatches.find((p) => p.op === "SET_LINE_SPACING");
      expect(patch).toBeDefined();
      expect(patch?.fields).toEqual({ lineSpacing: 1.2 });
      expect(patch?.validations).toEqual(["no_reflow_material_change"]);
    });

    it("does not emit when line spacing matches", () => {
      const exemplarSlide = createSlide({
        slideId: "exemplar",
        shapes: [titleShape("ex-title", 1.2)]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [titleShape("scan-title", 1.2)]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);

      expect(result.findings.some((f) => f.ruleId === "BP-TYPO-005")).toBe(false);
      expect(result.suggestedPatches.some((p) => p.op === "SET_LINE_SPACING")).toBe(false);
    });

    it("does not emit when absolute difference is exactly 0.05", () => {
      const exemplarSlide = createSlide({
        slideId: "exemplar",
        shapes: [titleShape("ex-title", 1.0)]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [titleShape("scan-title", 1.05)]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);

      expect(result.findings.some((f) => f.ruleId === "BP-TYPO-005")).toBe(false);
    });
  });

  describe("BP-COLOR-002 — semi-transparent text", () => {
    it("flags alpha strictly between 0.01 and 0.95", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "semi",
                textRuns: [
                  {
                    text: "Faded",
                    fontFamily: "Aptos",
                    fontSizePt: 18,
                    bold: false,
                    italic: false,
                    fontColor: "#000000",
                    fontAlpha: 0.5
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, {});

      const finding = result.findings.find((f) => f.ruleId === "BP-COLOR-002" && f.objectId === "semi");
      expect(finding).toBeDefined();
      expect(finding?.observed).toEqual({ fontAlpha: 0.5 });
    });

    it("does not flag fully opaque text", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "opaque",
                textRuns: [
                  {
                    text: "Solid",
                    fontFamily: "Aptos",
                    fontSizePt: 18,
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
      const result = runChecks(inferred.deck, {});

      expect(result.findings.some((f) => f.ruleId === "BP-COLOR-002" && f.objectId === "opaque")).toBe(false);
    });

    it("does not flag alpha at 0.01 or 0.95 (exclusive bounds)", () => {
      for (const alpha of [0.01, 0.95]) {
        const deck = createDeck({
          slides: [
            createSlide({
              shapes: [
                createShape({
                  objectId: `edge-${alpha}`,
                  textRuns: [
                    {
                      text: "Edge",
                      fontFamily: "Aptos",
                      fontSizePt: 18,
                      bold: false,
                      italic: false,
                      fontColor: "#000000",
                      fontAlpha: alpha
                    }
                  ]
                })
              ]
            })
          ]
        });
        const inferred = inferRoles(deck);
        const result = runChecks(inferred.deck, {});

        expect(result.findings.some((f) => f.ruleId === "BP-COLOR-002" && f.objectId === `edge-${alpha}`)).toBe(
          false
        );
      }
    });
  });

  describe("BP-HYGIENE-002 — off-slide objects", () => {
    it("flags when less than 10% of the object overlaps the slide canvas", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "off",
                geometry: { left: -1000, top: 0, width: 400, height: 400, rotation: 0 }
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, {});

      const finding = result.findings.find((f) => f.ruleId === "BP-HYGIENE-002" && f.objectId === "off");
      expect(finding).toBeDefined();
      expect((finding?.observed as { overlapRatio: number }).overlapRatio).toBe(0);
    });

    it("does not flag when the object is fully on the slide", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "on",
                geometry: { left: 40, top: 140, width: 500, height: 60, rotation: 0 }
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, {});

      expect(result.findings.some((f) => f.ruleId === "BP-HYGIENE-002" && f.objectId === "on")).toBe(false);
    });

    it("does not flag when overlap ratio is exactly 0.1", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "boundary",
                geometry: { left: -90, top: 0, width: 100, height: 100, rotation: 0 }
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, {});

      expect(result.findings.some((f) => f.ruleId === "BP-HYGIENE-002" && f.objectId === "boundary")).toBe(false);
    });

    it("flags when overlap ratio is just below 0.1", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "below",
                geometry: { left: -91, top: 0, width: 100, height: 100, rotation: 0 }
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, {});

      const finding = result.findings.find((f) => f.ruleId === "BP-HYGIENE-002" && f.objectId === "below");
      expect(finding).toBeDefined();
      expect((finding?.observed as { overlapRatio: number }).overlapRatio).toBeCloseTo(0.09, 5);
    });
  });

  describe("BP-BULLET-002 — bullet glyph mismatch", () => {
    const bulletRun = {
      text: "Bullet line",
      fontFamily: "Aptos",
      fontSizePt: 16,
      bold: false,
      italic: false,
      fontColor: "#111111",
      fontAlpha: 1
    };

    it("emits when exemplar and scan glyphs differ", () => {
      const exemplarSlide = createSlide({
        slideId: "exemplar",
        shapes: [
          createShape({
            objectId: "ex-b",
            geometry: { left: 40, top: 200, width: 800, height: 100, rotation: 0 },
            textRuns: [bulletRun],
            paragraphs: [
              {
                level: 1,
                bulletIndent: 18,
                bulletHanging: 9,
                bulletGlyph: "\u2022",
                text: "Bullet line"
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
                objectId: "scan-b",
                geometry: { left: 40, top: 200, width: 800, height: 100, rotation: 0 },
                textRuns: [bulletRun],
                paragraphs: [
                  {
                    level: 1,
                    bulletIndent: 18,
                    bulletHanging: 9,
                    bulletGlyph: "\u2013",
                    text: "Bullet line"
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);

      const finding = result.findings.find((f) => f.ruleId === "BP-BULLET-002" && f.objectId === "scan-b");
      expect(finding).toBeDefined();
    });

    it("does not emit when glyphs match", () => {
      const exemplarSlide = createSlide({
        slideId: "exemplar",
        shapes: [
          createShape({
            objectId: "ex-b",
            geometry: { left: 40, top: 200, width: 800, height: 100, rotation: 0 },
            textRuns: [bulletRun],
            paragraphs: [
              {
                level: 1,
                bulletIndent: 18,
                bulletHanging: 9,
                bulletGlyph: "\u2022",
                text: "Bullet line"
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
                objectId: "scan-b",
                geometry: { left: 40, top: 200, width: 800, height: 100, rotation: 0 },
                textRuns: [bulletRun],
                paragraphs: [
                  {
                    level: 1,
                    bulletIndent: 18,
                    bulletHanging: 9,
                    bulletGlyph: "\u2022",
                    text: "Bullet line"
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);

      expect(result.findings.some((f) => f.ruleId === "BP-BULLET-002")).toBe(false);
    });

    it("does not emit when exemplar or scan lacks bulletGlyph", () => {
      const exemplarSlide = createSlide({
        slideId: "exemplar",
        shapes: [
          createShape({
            objectId: "ex-b",
            geometry: { left: 40, top: 200, width: 800, height: 100, rotation: 0 },
            textRuns: [bulletRun],
            paragraphs: [
              {
                level: 1,
                bulletIndent: 18,
                bulletHanging: 9,
                bulletGlyph: "\u2022",
                text: "Bullet line"
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
                objectId: "scan-b",
                geometry: { left: 40, top: 200, width: 800, height: 100, rotation: 0 },
                textRuns: [bulletRun],
                paragraphs: [
                  {
                    level: 1,
                    bulletIndent: 18,
                    bulletHanging: 9,
                    text: "Bullet line"
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);

      expect(result.findings.some((f) => f.ruleId === "BP-BULLET-002")).toBe(false);
    });
  });
});
