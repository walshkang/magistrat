import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import { runContinuityChecks } from "../src/continuity.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";
import { defaultToleranceConfig } from "@magistrat/shared-types";

const bodyRun = {
  text: "Body",
  fontFamily: "Aptos",
  fontSizePt: 14,
  bold: false,
  italic: false,
  fontColor: "#000000",
  fontAlpha: 1
};

const titleRun = {
  text: "Title",
  fontFamily: "Aptos Display",
  fontSizePt: 30,
  bold: true,
  italic: false,
  fontColor: "#112233",
  fontAlpha: 1
};

function makeExemplarSlide() {
  return createSlide({
    slideId: "exemplar",
    shapes: [
      createShape({
        objectId: "ex-title",
        inferredRole: "TITLE",
        inferredRoleScore: 0.95,
        geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
        textRuns: [titleRun],
        paragraphs: [{ level: 0, text: "Title" }]
      })
    ]
  });
}

describe("Phase 8B rules", () => {
  describe("BP-TYPO-009 — bullet punctuation consistency", () => {
    it("flags mixed PERIOD and NONE within a text box", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            shapes: [
              createShape({
                objectId: "bullets",
                inferredRole: "BULLET_L1",
                inferredRoleScore: 0.9,
                paragraphs: [
                  { level: 0, text: "First item." },
                  { level: 0, text: "Second item" }
                ],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const f = runContinuityChecks(deck).findings.find((x) => x.ruleId === "BP-TYPO-009" && x.objectId === "bullets");
      expect(f).toBeDefined();
      expect(f?.severity).toBe("warn");
      expect((f?.observed as { scope?: string }).scope).toBe("text_box");
    });

    it("does not flag when all level-0 bullets share the same terminal style", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            shapes: [
              createShape({
                objectId: "ok",
                paragraphs: [
                  { level: 0, text: "One." },
                  { level: 0, text: "Two." }
                ],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      expect(runContinuityChecks(deck).findings.some((x) => x.ruleId === "BP-TYPO-009")).toBe(false);
    });

    it("does not run for a single level-0 bullet", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            shapes: [
              createShape({
                objectId: "one",
                paragraphs: [{ level: 0, text: "Only one." }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      expect(runContinuityChecks(deck).findings.some((x) => x.ruleId === "BP-TYPO-009")).toBe(false);
    });

    it("does not run when only sub-bullets (level ≥ 1) have text", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            shapes: [
              createShape({
                objectId: "sub",
                paragraphs: [
                  { level: 1, text: "Sub one." },
                  { level: 1, text: "Sub two" }
                ],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      expect(runContinuityChecks(deck).findings.some((x) => x.ruleId === "BP-TYPO-009")).toBe(false);
    });

    it("does not emit deck-wide finding when fewer than three classifiable boxes", () => {
      const mkBox = (id: string, a: string, b: string) =>
        createShape({
          objectId: id,
          paragraphs: [
            { level: 0, text: a },
            { level: 0, text: b }
          ],
          textRuns: [bodyRun]
        });
      const deck = createDeck({
        slides: [
          createSlide({ slideId: "a", shapes: [mkBox("b1", "X.", "Y.")] }),
          createSlide({ slideId: "b", shapes: [mkBox("b2", "Z.", "W.")] })
        ]
      });
      const fs = runContinuityChecks(deck).findings.filter((x) => x.ruleId === "BP-TYPO-009");
      expect(fs.some((x) => (x.observed as { scope?: string }).scope === "deck")).toBe(false);
    });

    it("emits deck-wide finding when deck majority opposes a box dominant style", () => {
      const periodBox = (id: string) =>
        createShape({
          objectId: id,
          paragraphs: [
            { level: 0, text: "A." },
            { level: 0, text: "B." }
          ],
          textRuns: [bodyRun]
        });
      const noneBox = (id: string) =>
        createShape({
          objectId: id,
          paragraphs: [
            { level: 0, text: "Alpha" },
            { level: 0, text: "Beta" }
          ],
          textRuns: [bodyRun]
        });
      const deck = createDeck({
        slides: [
          createSlide({ slideId: "p1", shapes: [periodBox("p1")] }),
          createSlide({ slideId: "p2", shapes: [periodBox("p2")] }),
          createSlide({ slideId: "p3", shapes: [periodBox("p3")] }),
          createSlide({ slideId: "n1", shapes: [noneBox("n1")] })
        ]
      });
      const fs = runContinuityChecks(deck).findings.filter(
        (x) => x.ruleId === "BP-TYPO-009" && x.objectId === "n1"
      );
      expect(fs.some((x) => (x.observed as { scope?: string }).scope === "deck")).toBe(true);
    });
  });

  describe("BP-TYPO-010 — double spaces", () => {
    it("flags double spaces in trimmed text", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "ds",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                paragraphs: [{ level: 0, text: "Hello  world" }],
                textRuns: [{ ...bodyRun, text: "Hello  world" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const f = runChecks(inferred.deck, styleMap).findings.find(
        (x) => x.ruleId === "BP-TYPO-010" && x.objectId === "ds"
      );
      expect(f).toBeDefined();
      expect(f?.severity).toBe("info");
    });

    it("does not flag single spaces", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "ok",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                paragraphs: [{ level: 0, text: "Hello world" }],
                textRuns: [{ ...bodyRun, text: "Hello world" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-TYPO-010")
      ).toBe(false);
    });

    it("does not flag leading double space only (trimmed away)", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "lead",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                paragraphs: [{ level: 0, text: "  hi" }],
                textRuns: [{ ...bodyRun, text: "  hi" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-TYPO-010")
      ).toBe(false);
    });
  });

  describe("BP-TYPO-011 — title terminal period", () => {
    it("flags TITLE ending with a period", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "bad-title",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                paragraphs: [{ level: 0, text: "Bad title." }],
                textRuns: [{ ...titleRun, text: "Bad title." }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const f = runChecks(inferred.deck, styleMap).findings.find(
        (x) => x.ruleId === "BP-TYPO-011" && x.objectId === "bad-title"
      );
      expect(f).toBeDefined();
      expect(f?.severity).toBe("warn");
    });

    it("does not flag title ending with ?", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "q",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                paragraphs: [{ level: 0, text: "Why?" }],
                textRuns: [{ ...titleRun, text: "Why?" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-TYPO-011")
      ).toBe(false);
    });

    it("does not flag title ending with !", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "e",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                paragraphs: [{ level: 0, text: "Go!" }],
                textRuns: [{ ...titleRun, text: "Go!" }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-TYPO-011")
      ).toBe(false);
    });

    it("flags ellipsis ending with .", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "ell",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                paragraphs: [{ level: 0, text: "Wait..." }],
                textRuns: [{ ...titleRun, text: "Wait..." }]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some(
          (x) => x.ruleId === "BP-TYPO-011" && x.objectId === "ell"
        )
      ).toBe(true);
    });
  });

  describe("BP-LAYOUT-007 — left-edge jitter", () => {
    it("flags shape near mode but not exactly at mode", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            slideWidth: 720,
            slideHeight: 405,
            shapes: [
              createShape({
                objectId: "a",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                geometry: { left: 40, top: 100, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "A" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "b",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                geometry: { left: 40, top: 160, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "B" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "jitter",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                geometry: { left: 43, top: 220, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "C" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const f = runChecks(inferred.deck, styleMap).findings.find(
        (x) => x.ruleId === "BP-LAYOUT-007" && x.objectId === "jitter"
      );
      expect(f).toBeDefined();
    });

    it("does not flag intentional offset beyond threshold", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "a",
                geometry: { left: 40, top: 100, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "A" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "b",
                geometry: { left: 40, top: 160, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "B" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "far",
                geometry: { left: 120, top: 220, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "C" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some(
          (x) => x.ruleId === "BP-LAYOUT-007" && x.objectId === "far"
        )
      ).toBe(false);
    });

    it("excludes full-bleed image from clustering", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            slideWidth: 720,
            slideHeight: 405,
            shapes: [
              createShape({
                objectId: "bleed",
                shapeType: "IMAGE",
                geometry: { left: 0, top: 0, width: 700, height: 400, rotation: 0 },
                paragraphs: [],
                textRuns: []
              }),
              createShape({
                objectId: "t1",
                geometry: { left: 40, top: 100, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "A" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "t2",
                geometry: { left: 40, top: 160, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "B" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-007")
      ).toBe(false);
    });
  });

  describe("BP-LAYOUT-008 — horizontal distribution", () => {
    it("flags uneven gaps in a three-shape row", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "c1",
                geometry: { left: 40, top: 200, width: 100, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "1" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "c2",
                geometry: { left: 160, top: 205, width: 100, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "2" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "c3",
                geometry: { left: 300, top: 202, width: 100, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "3" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const fs = runChecks(inferred.deck, styleMap).findings.filter((x) => x.ruleId === "BP-LAYOUT-008");
      expect(fs.length).toBeGreaterThan(0);
    });

    it("does not run for only two shapes in a Y-band", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "a",
                geometry: { left: 40, top: 200, width: 100, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "1" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "b",
                geometry: { left: 200, top: 200, width: 100, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "2" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-008")
      ).toBe(false);
    });

    it("does not group shapes with very different heights", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "a",
                geometry: { left: 40, top: 200, width: 100, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "1" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "b",
                geometry: { left: 160, top: 200, width: 100, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "2" }],
                textRuns: [bodyRun]
              }),
              createShape({
                objectId: "c",
                geometry: { left: 280, top: 200, width: 100, height: 100, rotation: 0 },
                paragraphs: [{ level: 0, text: "3" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-008")
      ).toBe(false);
    });
  });

  describe("BP-LAYOUT-009 — slide text density", () => {
    it("flags very dense text coverage", () => {
      const tol = { ...defaultToleranceConfig(), textDensityMaxRatio: 0.05 };
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "dense",
            index: 2,
            slideWidth: 720,
            slideHeight: 540,
            shapes: [
              createShape({
                objectId: "big",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                geometry: { left: 40, top: 100, width: 600, height: 400, rotation: 0 },
                paragraphs: [{ level: 0, text: "Lots of text" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const f = runChecks(inferred.deck, styleMap, tol).findings.find((x) => x.ruleId === "BP-LAYOUT-009");
      expect(f).toBeDefined();
      expect(f?.objectId).toBeUndefined();
      expect(f?.severity).toBe("info");
    });

    it("does not flag slide with only images", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "img",
            index: 2,
            slideWidth: 720,
            slideHeight: 540,
            shapes: [
              createShape({
                objectId: "pic",
                shapeType: "IMAGE",
                geometry: { left: 0, top: 0, width: 400, height: 300, rotation: 0 },
                paragraphs: [],
                textRuns: []
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-009")
      ).toBe(false);
    });

    it("does not flag slide with one small text box under default threshold", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "sparse",
            index: 2,
            slideWidth: 720,
            slideHeight: 540,
            shapes: [
              createShape({
                objectId: "small",
                geometry: { left: 40, top: 100, width: 200, height: 40, rotation: 0 },
                paragraphs: [{ level: 0, text: "Hi" }],
                textRuns: [bodyRun]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      expect(
        runChecks(inferred.deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-009")
      ).toBe(false);
    });
  });
});
