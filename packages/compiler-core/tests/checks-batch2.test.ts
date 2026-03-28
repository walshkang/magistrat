import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import { computeIOU } from "../src/iou.js";
import type { DeckSnapshot } from "@magistrat/shared-types";
import { createDeck, createShape, createSlide } from "./fixtures.js";

const baseRun = {
  text: "Hello",
  fontFamily: "Aptos",
  fontSizePt: 18,
  bold: false,
  italic: false,
  fontColor: "#112233",
  fontAlpha: 1
};

/** After inferRoles, raise scores so style-map checks (safe threshold) run. */
function withRoleScores(deck: DeckSnapshot, scores: Record<string, number>): DeckSnapshot {
  return {
    ...deck,
    slides: deck.slides.map((slide) => ({
      ...slide,
      shapes: slide.shapes.map((shape) => ({
        ...shape,
        inferredRoleScore: scores[shape.objectId] ?? shape.inferredRoleScore
      }))
    }))
  };
}

describe("Phase 2B batch 2 rules", () => {
  describe("computeIOU", () => {
    it("returns 1 for identical boxes", () => {
      const g = { left: 10, top: 10, width: 100, height: 50, rotation: 0 };
      expect(computeIOU(g, g)).toBe(1);
    });

    it("returns 0.8 for two equal squares with offset 10/9", () => {
      const a = { left: 0, top: 0, width: 10, height: 10, rotation: 0 };
      const b = { left: 10 / 9, top: 0, width: 10, height: 10, rotation: 0 };
      expect(computeIOU(a, b)).toBeCloseTo(0.8, 10);
    });
  });

  describe("BP-TYPO-004 — mixed font families", () => {
    it("emits when two runs use different families", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "mix",
                textRuns: [
                  { ...baseRun, text: "A", fontFamily: "Arial" },
                  { ...baseRun, text: "B", fontFamily: "Calibri" }
                ],
                paragraphs: [{ level: 0, text: "A" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(inferred.deck.slides[0]!, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-TYPO-004");
      expect(f).toBeDefined();
      expect(f?.observed).toEqual({ fontFamilies: ["Arial", "Calibri"] });
    });

    it("does not emit for a single run", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [createShape({ objectId: "one", textRuns: [{ ...baseRun, text: "Only" }] })]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-TYPO-004")).toBe(false);
    });

    it("does not emit when multiple runs share one family", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "same",
                textRuns: [
                  { ...baseRun, text: "A", fontFamily: "Arial" },
                  { ...baseRun, text: "B", fontFamily: "Arial" }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-TYPO-004")).toBe(false);
    });
  });

  describe("BP-COLOR-003 — callout fill vs exemplar", () => {
    function calloutShape(objectId: string, fillColor: string): ReturnType<typeof createShape> {
      return createShape({
        objectId,
        fillColor,
        geometry: { left: 40, top: 200, width: 400, height: 80, rotation: 0 },
        textRuns: [
          {
            text: "Short note!",
            fontFamily: "Aptos",
            fontSizePt: 18,
            bold: true,
            italic: false,
            fontColor: "#112233",
            fontAlpha: 1
          }
        ],
        paragraphs: [{ level: 0, text: "Short note!" }]
      });
    }

    it("emits when callout fill differs from exemplar", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [calloutShape("ex-call", "#FFEEDD")]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [calloutShape("scan-call", "#AABBCC")]
          })
        ]
      });
      let inferred = inferRoles(deck);
      inferred = {
        ...inferred,
        deck: withRoleScores(inferred.deck, { "ex-call": 0.95, "scan-call": 0.95 })
      };
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-COLOR-003" && x.objectId === "scan-call");
      expect(f).toBeDefined();
      expect(f?.observed).toEqual({ fillColor: "#AABBCC" });
      expect(f?.expected).toEqual({ fillColor: "#FFEEDD" });
    });

    it("does not emit when fills match", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [calloutShape("ex-call", "#FFEEDD")]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [calloutShape("scan-call", "#FFEEDD")]
          })
        ]
      });
      let inferred = inferRoles(deck);
      inferred = {
        ...inferred,
        deck: withRoleScores(inferred.deck, { "ex-call": 0.95, "scan-call": 0.95 })
      };
      const result = runChecks(inferred.deck, buildStyleMap(exemplarSlide, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-COLOR-003")).toBe(false);
    });

    it("does not emit when exemplar has no callout fill in style map", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [
          createShape({
            objectId: "title-only",
            geometry: { left: 24, top: 40, width: 600, height: 80, rotation: 0 },
            textRuns: [
              {
                text: "Deck title",
                fontFamily: "Aptos Display",
                fontSizePt: 28,
                bold: true,
                italic: false,
                fontColor: "#000000",
                fontAlpha: 1
              }
            ],
            paragraphs: [{ level: 0, text: "Deck title" }]
          })
        ]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            shapes: [calloutShape("scan-call", "#AABBCC")]
          })
        ]
      });
      let inferred = inferRoles(deck);
      inferred = { ...inferred, deck: withRoleScores(inferred.deck, { "scan-call": 0.95 }) };
      const result = runChecks(inferred.deck, buildStyleMap(exemplarSlide, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-COLOR-003")).toBe(false);
    });
  });

  describe("BP-HYGIENE-003 — duplicate overlapping objects", () => {
    const geo = { left: 100, top: 100, width: 200, height: 60, rotation: 0 };

    it("flags high-IOU shapes with identical normalized text", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "lower",
                zIndex: 1,
                geometry: geo,
                textRuns: [{ ...baseRun, text: "Same text" }]
              }),
              createShape({
                objectId: "higher",
                zIndex: 2,
                geometry: geo,
                textRuns: [{ ...baseRun, text: "Same text" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-HYGIENE-003");
      expect(f?.objectId).toBe("higher");
      expect(f?.observed).toMatchObject({
        objectId: "higher",
        pairedObjectId: "lower",
        iou: 1
      });
    });

    it("does not flag when text differs and neither is substring", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "a",
                geometry: geo,
                textRuns: [{ ...baseRun, text: "Alpha content" }]
              }),
              createShape({
                objectId: "b",
                zIndex: 2,
                geometry: geo,
                textRuns: [{ ...baseRun, text: "Beta content" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-HYGIENE-003")).toBe(false);
    });

    it("does not flag when IOU is below 0.8", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "a",
                geometry: { left: 0, top: 0, width: 100, height: 100, rotation: 0 },
                textRuns: [{ ...baseRun, text: "Same" }]
              }),
              createShape({
                objectId: "b",
                zIndex: 2,
                geometry: { left: 99, top: 0, width: 100, height: 100, rotation: 0 },
                textRuns: [{ ...baseRun, text: "Same" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-HYGIENE-003")).toBe(false);
    });

    it("emits one finding per overlapping duplicate pair", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "a",
                zIndex: 1,
                geometry: geo,
                textRuns: [{ ...baseRun, text: "Dup" }]
              }),
              createShape({
                objectId: "b",
                zIndex: 2,
                geometry: geo,
                textRuns: [{ ...baseRun, text: "Dup" }]
              }),
              createShape({
                objectId: "c",
                zIndex: 3,
                geometry: geo,
                textRuns: [{ ...baseRun, text: "Dup" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      const dups = result.findings.filter((x) => x.ruleId === "BP-HYGIENE-003");
      expect(dups).toHaveLength(3);
    });
  });

  describe("BP-HYGIENE-005 — proofing language", () => {
    const runEn = { ...baseRun, proofingLanguage: "en" as const };
    const runZh = { ...baseRun, proofingLanguage: "zh-CN" as const };

    it("emits finding and NORMALIZE_LANGUAGE_TAGS patch when run differs from dominant", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({
                objectId: "s1",
                textRuns: [{ ...runEn, text: "One" }]
              }),
              createShape({
                objectId: "s2",
                textRuns: [{ ...runEn, text: "Two" }]
              }),
              createShape({
                objectId: "s3",
                textRuns: [{ ...runZh, text: "Three" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-HYGIENE-005");
      expect(f?.objectId).toBe("s3");
      expect(f?.observed).toEqual({ proofingLanguage: "zh-CN" });
      expect(f?.expected).toEqual({ proofingLanguage: "en" });
      const patch = result.suggestedPatches.find((p) => p.op === "NORMALIZE_LANGUAGE_TAGS");
      expect(patch?.fields).toEqual({ proofingLanguage: "en" });
    });

    it("does not emit when deck is uniform", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [
              createShape({ objectId: "a", textRuns: [{ ...runEn, text: "A" }] }),
              createShape({ objectId: "b", textRuns: [{ ...runEn, text: "B" }] })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-HYGIENE-005")).toBe(false);
    });

    it("does not emit when no proofing language data exists", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            shapes: [createShape({ objectId: "a", textRuns: [{ ...baseRun, text: "Hi" }] })]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(inferred.deck.slides[0]!, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-HYGIENE-005")).toBe(false);
    });

  });
});
