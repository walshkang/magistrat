import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import type { DeckSnapshot } from "@magistrat/shared-types";
import { createDeck, createShape, createSlide } from "./fixtures.js";

const baseRun = {
  text: "Body copy",
  fontFamily: "Aptos",
  fontSizePt: 18,
  bold: false,
  italic: false,
  fontColor: "#112233",
  fontAlpha: 1
};

const titleRun = {
  text: "Title",
  fontFamily: "Aptos Display",
  fontSizePt: 30,
  bold: true,
  italic: false,
  fontColor: "#000000",
  fontAlpha: 1
};

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

function bodyLikeShape(
  objectId: string,
  opts: { alignment?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED"; text?: string }
): ReturnType<typeof createShape> {
  const text = opts.text ?? "Body copy";
  return createShape({
    objectId,
    /* top > 200 avoids SUBTITLE band (≤200) so role resolves to BODY */
    geometry: { left: 40, top: 210, width: 500, height: 120, rotation: 0 },
    textRuns: [{ ...baseRun, text }],
    paragraphs: [{ level: 0, text, ...(opts.alignment !== undefined ? { alignment: opts.alignment } : {}) }]
  });
}

function exemplarSlideWithBody(
  bodyId: string,
  bodyOpts: { alignment?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" }
) {
  return createSlide({
    slideId: "ex",
    shapes: [
      createShape({
        objectId: "ex-title",
        geometry: { left: 24, top: 40, width: 600, height: 80, rotation: 0 },
        textRuns: [titleRun],
        paragraphs: [{ level: 0, text: "Title" }]
      }),
      bodyLikeShape(bodyId, bodyOpts)
    ]
  });
}

describe("Track A Slice 1 — BP-TYPO-012 & BP-COLOR-004", () => {
  describe("BP-TYPO-012 — text alignment mismatch", () => {
    it("emits when dominant alignment differs from exemplar role tokens", () => {
      const exemplarSlide = exemplarSlideWithBody("ex-body", { alignment: "CENTER" });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [bodyLikeShape("scan-body", { alignment: "LEFT" })]
          })
        ]
      });
      const roleResult = inferRoles(deck);
      const scoredDeck = withRoleScores(roleResult.deck, {
        "ex-body": 0.95,
        "scan-body": 0.95
      });
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      expect(styleMap.BODY?.alignment).toBe("CENTER");

      const result = runChecks(scoredDeck, styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-TYPO-012" && x.objectId === "scan-body");
      expect(f).toBeDefined();
      expect(f?.severity).toBe("warn");
      expect(f?.source).toBe("exemplar");
      expect(f?.observed).toMatchObject({ alignment: "LEFT", role: "BODY" });
      expect(f?.expected).toEqual({ alignment: "CENTER" });
      const patch = result.suggestedPatches.find((p) => p.id === f?.suggestedPatchId);
      expect(patch?.op).toBe("SET_TEXT_ALIGNMENT");
      expect(patch?.fields).toEqual({ alignment: "CENTER" });
    });

    it("does not emit when alignment matches exemplar", () => {
      const exemplarSlide = exemplarSlideWithBody("ex-body", { alignment: "LEFT" });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [bodyLikeShape("scan-body", { alignment: "LEFT" })]
          })
        ]
      });
      const roleResult = inferRoles(deck);
      const scoredDeck = withRoleScores(roleResult.deck, {
        "ex-body": 0.95,
        "scan-body": 0.95
      });
      const result = runChecks(scoredDeck, buildStyleMap(exemplarSlide, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-TYPO-012")).toBe(false);
    });

    it("skips when paragraphs have no alignment data", () => {
      const exemplarSlide = exemplarSlideWithBody("ex-body", { alignment: "CENTER" });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [bodyLikeShape("scan-body", {})]
          })
        ]
      });
      const roleResult = inferRoles(deck);
      const scoredDeck = withRoleScores(roleResult.deck, {
        "ex-body": 0.95,
        "scan-body": 0.95
      });
      const result = runChecks(scoredDeck, buildStyleMap(exemplarSlide, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-TYPO-012")).toBe(false);
    });

    it("skips when style map role has no alignment token", () => {
      const exemplarSlide = exemplarSlideWithBody("ex-body", {});
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [bodyLikeShape("scan-body", { alignment: "RIGHT" })]
          })
        ]
      });
      const roleResult = inferRoles(deck);
      const scoredDeck = withRoleScores(roleResult.deck, {
        "ex-body": 0.95,
        "scan-body": 0.95
      });
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      expect(styleMap.BODY?.alignment).toBeUndefined();
      const result = runChecks(scoredDeck, styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-TYPO-012")).toBe(false);
    });

    it("uses majority alignment when paragraphs mix within one shape", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [
          createShape({
            objectId: "ex-title",
            geometry: { left: 24, top: 40, width: 600, height: 80, rotation: 0 },
            textRuns: [titleRun],
            paragraphs: [{ level: 0, text: "Title" }]
          }),
          createShape({
            objectId: "ex-body",
            geometry: { left: 40, top: 210, width: 500, height: 120, rotation: 0 },
            textRuns: [baseRun],
            paragraphs: [
              { level: 0, text: "A", alignment: "CENTER" },
              { level: 0, text: "B", alignment: "CENTER" }
            ]
          })
        ]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "scan-body",
                geometry: { left: 40, top: 210, width: 500, height: 120, rotation: 0 },
                textRuns: [baseRun],
                paragraphs: [
                  { level: 0, text: "X", alignment: "LEFT" },
                  { level: 0, text: "Y", alignment: "LEFT" },
                  { level: 0, text: "Z", alignment: "CENTER" }
                ]
              })
            ]
          })
        ]
      });
      const roleResult = inferRoles(deck);
      const scoredDeck = withRoleScores(roleResult.deck, {
        "ex-body": 0.95,
        "scan-body": 0.95
      });
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      expect(styleMap.BODY?.alignment).toBe("CENTER");

      const result = runChecks(scoredDeck, styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-TYPO-012" && x.objectId === "scan-body");
      expect(f).toBeDefined();
      expect(f?.observed).toMatchObject({ alignment: "LEFT" });
    });
  });

  describe("BP-COLOR-004 — shape border off palette", () => {
    it("emits when line color is not in exemplar font/fill palette", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [
          createShape({
            objectId: "ex-title",
            geometry: { left: 24, top: 40, width: 600, height: 80, rotation: 0 },
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
            ],
            paragraphs: [{ level: 0, text: "Title" }]
          })
        ]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "border-shape",
                lineColor: "#FF0000",
                lineWidth: 1,
                geometry: { left: 100, top: 200, width: 200, height: 80, rotation: 0 },
                textRuns: [baseRun],
                paragraphs: [{ level: 0, text: "Hi" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const styleMap = buildStyleMap(exemplarSlide, "original").styleMap;
      const result = runChecks(inferred.deck, styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-COLOR-004" && x.objectId === "border-shape");
      expect(f).toBeDefined();
      expect(f?.severity).toBe("warn");
      expect(f?.source).toBe("playbook");
      expect(f?.observed).toMatchObject({ lineColor: "#FF0000", lineWidth: 1 });
      expect(f?.expected).toEqual({ palette: ["#112233"] });
    });

    it("does not emit when line color is in the palette", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [
          createShape({
            objectId: "ex-title",
            geometry: { left: 24, top: 40, width: 600, height: 80, rotation: 0 },
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
            ],
            paragraphs: [{ level: 0, text: "Title" }]
          })
        ]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "border-ok",
                lineColor: "#112233",
                lineWidth: 1,
                geometry: { left: 100, top: 200, width: 200, height: 80, rotation: 0 },
                textRuns: [baseRun],
                paragraphs: [{ level: 0, text: "Hi" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(exemplarSlide, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-COLOR-004")).toBe(false);
    });

    it("skips when lineColor is absent", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [
          createShape({
            objectId: "ex-title",
            geometry: { left: 24, top: 40, width: 600, height: 80, rotation: 0 },
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
            ],
            paragraphs: [{ level: 0, text: "Title" }]
          })
        ]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "no-border",
                lineWidth: 1,
                geometry: { left: 100, top: 200, width: 200, height: 80, rotation: 0 },
                textRuns: [baseRun],
                paragraphs: [{ level: 0, text: "Hi" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(exemplarSlide, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-COLOR-004")).toBe(false);
    });

    it("skips when lineWidth is 0", () => {
      const exemplarSlide = createSlide({
        slideId: "ex",
        shapes: [
          createShape({
            objectId: "ex-title",
            geometry: { left: 24, top: 40, width: 600, height: 80, rotation: 0 },
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
            ],
            paragraphs: [{ level: 0, text: "Title" }]
          })
        ]
      });
      const deck = createDeck({
        slides: [
          exemplarSlide,
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "zero-w",
                lineColor: "#FF0000",
                lineWidth: 0,
                geometry: { left: 100, top: 200, width: 200, height: 80, rotation: 0 },
                textRuns: [baseRun],
                paragraphs: [{ level: 0, text: "Hi" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const result = runChecks(inferred.deck, buildStyleMap(exemplarSlide, "original").styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-COLOR-004")).toBe(false);
    });
  });
});
