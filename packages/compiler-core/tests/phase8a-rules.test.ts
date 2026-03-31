import { describe, expect, it } from "vitest";
import { buildStyleMap, inferRoles, runChecks } from "../src/public-api.js";
import { runContinuityChecks } from "../src/continuity.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";
import { defaultToleranceConfig } from "@magistrat/shared-types";

const exemplarTitleRun = {
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
        objectId: "exemplar-title",
        geometry: { left: 20, top: 30, width: 900, height: 80, rotation: 0 },
        textRuns: [exemplarTitleRun],
        paragraphs: [{ level: 0, text: "Title" }]
      })
    ]
  });
}

describe("Phase 8A rules", () => {
  describe("BP-HYGIENE-006 — draft tag remnants", () => {
    it("flags draft markers in paragraph text (case-insensitive)", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "draft-shape",
                inferredRole: "BODY",
                inferredRoleScore: 0.8,
                paragraphs: [{ level: 0, text: "Please fix [tbd] soon" }],
                textRuns: [
                  {
                    text: "Please fix [tbd] soon",
                    fontFamily: "Aptos",
                    fontSizePt: 14,
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
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const result = runChecks(inferred.deck, styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-HYGIENE-006" && x.objectId === "draft-shape");
      expect(f).toBeDefined();
      expect(f?.severity).toBe("error");
      expect((f?.observed as { matchedToken: string }).matchedToken.toLowerCase()).toContain("tbd");
    });

    it("does not flag compliant text", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "ok-shape",
                inferredRole: "BODY",
                inferredRoleScore: 0.8,
                paragraphs: [{ level: 0, text: "Final copy approved." }],
                textRuns: [
                  {
                    text: "Final copy approved.",
                    fontFamily: "Aptos",
                    fontSizePt: 14,
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
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const result = runChecks(inferred.deck, styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-HYGIENE-006")).toBe(false);
    });

    it("matches bracket insert variants", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "insert-shape",
                inferredRole: "BODY",
                inferredRoleScore: 0.8,
                paragraphs: [{ level: 0, text: "See [INSERT DATA HERE] for detail" }],
                textRuns: [
                  {
                    text: "See [INSERT DATA HERE] for detail",
                    fontFamily: "Aptos",
                    fontSizePt: 14,
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
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const result = runChecks(inferred.deck, styleMap);
      expect(
        result.findings.some((x) => x.ruleId === "BP-HYGIENE-006" && x.objectId === "insert-shape")
      ).toBe(true);
    });
  });

  describe("BP-WCAG-001 — contrast vs solid fill", () => {
    it("flags low contrast for opaque text on solid fill", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "low-contrast",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                fillColor: "#F3F4F6",
                paragraphs: [{ level: 0, text: "Body" }],
                textRuns: [
                  {
                    text: "Body",
                    fontFamily: "Aptos",
                    fontSizePt: 14,
                    bold: false,
                    italic: false,
                    fontColor: "#E5E7EB",
                    fontAlpha: 1
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const result = runChecks(inferred.deck, styleMap);
      const f = result.findings.find((x) => x.ruleId === "BP-WCAG-001" && x.objectId === "low-contrast");
      expect(f).toBeDefined();
      expect(f?.severity).toBe("error");
      expect(f?.evidence.some((e) => e.type === "COLOR_EVIDENCE")).toBe(true);
    });

    it("skips shapes without fillColor", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "no-fill",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                paragraphs: [{ level: 0, text: "Body" }],
                textRuns: [
                  {
                    text: "Body",
                    fontFamily: "Aptos",
                    fontSizePt: 14,
                    bold: false,
                    italic: false,
                    fontColor: "#E5E7EB",
                    fontAlpha: 1
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const result = runChecks(inferred.deck, styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-WCAG-001" && x.objectId === "no-fill")).toBe(false);
    });

    it("skips semi-transparent text runs (fontAlpha < 0.95)", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "fade-text",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                fillColor: "#F3F4F6",
                paragraphs: [{ level: 0, text: "Body" }],
                textRuns: [
                  {
                    text: "Body",
                    fontFamily: "Aptos",
                    fontSizePt: 14,
                    bold: false,
                    italic: false,
                    fontColor: "#111111",
                    fontAlpha: 0.5
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const result = runChecks(inferred.deck, styleMap);
      expect(result.findings.some((x) => x.ruleId === "BP-WCAG-001" && x.objectId === "fade-text")).toBe(
        false
      );
    });

    it("respects wcagMinContrastRatio tolerance", () => {
      const deck = createDeck({
        slides: [
          makeExemplarSlide(),
          createSlide({
            slideId: "scan",
            index: 2,
            shapes: [
              createShape({
                objectId: "tol-shape",
                inferredRole: "BODY",
                inferredRoleScore: 0.85,
                fillColor: "#F3F4F6",
                paragraphs: [{ level: 0, text: "Body" }],
                textRuns: [
                  {
                    text: "Body",
                    fontFamily: "Aptos",
                    fontSizePt: 14,
                    bold: false,
                    italic: false,
                    fontColor: "#E5E7EB",
                    fontAlpha: 1
                  }
                ]
              })
            ]
          })
        ]
      });
      const inferred = inferRoles(deck);
      const { styleMap } = buildStyleMap(makeExemplarSlide(), "original");
      const tol = { ...defaultToleranceConfig(), wcagMinContrastRatio: 1.0 };
      const result = runChecks(inferred.deck, styleMap, tol);
      expect(result.findings.some((x) => x.ruleId === "BP-WCAG-001" && x.objectId === "tol-shape")).toBe(
        false
      );
    });
  });

  describe("BP-TYPO-008 — title capitalization consistency", () => {
    const titleRun = (text: string) => ({
      text,
      fontFamily: "Aptos Display",
      fontSizePt: 30,
      bold: true,
      italic: false,
      fontColor: "#112233",
      fontAlpha: 1
    });

    it("flags slides whose title style differs from dominant", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            index: 1,
            shapes: [
              createShape({
                objectId: "t1",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                textRuns: [titleRun("First Title Here")],
                paragraphs: [{ level: 0, text: "First Title Here" }]
              })
            ]
          }),
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "t2",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                textRuns: [titleRun("Second Title Here")],
                paragraphs: [{ level: 0, text: "Second Title Here" }]
              })
            ]
          }),
          createSlide({
            slideId: "s3",
            index: 3,
            shapes: [
              createShape({
                objectId: "t3",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                textRuns: [titleRun("ALL CAPS TITLE")],
                paragraphs: [{ level: 0, text: "ALL CAPS TITLE" }]
              })
            ]
          })
        ]
      });
      const result = runContinuityChecks(deck);
      const f = result.findings.find((x) => x.ruleId === "BP-TYPO-008" && x.slideId === "s3");
      expect(f).toBeDefined();
      expect(f?.severity).toBe("info");
      expect((f?.expected as { dominantStyle: string }).dominantStyle).toBe("TITLE_CASE");
    });

    it("emits no finding when fewer than three titled slides", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            index: 1,
            shapes: [
              createShape({
                objectId: "t1",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                textRuns: [titleRun("Title One")],
                paragraphs: [{ level: 0, text: "Title One" }]
              })
            ]
          }),
          createSlide({
            slideId: "s2",
            index: 2,
            shapes: [
              createShape({
                objectId: "t2",
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                textRuns: [titleRun("ALL CAPS")],
                paragraphs: [{ level: 0, text: "ALL CAPS" }]
              })
            ]
          })
        ]
      });
      const result = runContinuityChecks(deck);
      expect(result.findings.some((x) => x.ruleId === "BP-TYPO-008")).toBe(false);
    });

    it("does not flag when dominant style is MIXED", () => {
      const deck = createDeck({
        slides: [1, 2, 3].map((n) =>
          createSlide({
            slideId: `s${n}`,
            index: n,
            shapes: [
              createShape({
                objectId: `t${n}`,
                inferredRole: "TITLE",
                inferredRoleScore: 0.95,
                geometry: { left: 20, top: 30, width: 400, height: 60, rotation: 0 },
                textRuns: [titleRun(`MiXeD ${n}`)],
                paragraphs: [{ level: 0, text: `MiXeD ${n}` }]
              })
            ]
          })
        )
      });
      const result = runContinuityChecks(deck);
      expect(result.findings.some((x) => x.ruleId === "BP-TYPO-008")).toBe(false);
    });
  });

  describe("BP-CONT-004 — page numbers", () => {
    it("flags duplicate page numbers", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "a",
            index: 1,
            shapes: [
              createShape({
                objectId: "f1",
                inferredRole: "FOOTER",
                inferredRoleScore: 0.9,
                paragraphs: [{ level: 0, text: "5" }],
                textRuns: [{ text: "5", fontFamily: "Aptos", fontSizePt: 10, bold: false, italic: false, fontColor: "#000", fontAlpha: 1 }]
              })
            ]
          }),
          createSlide({
            slideId: "b",
            index: 2,
            shapes: [
              createShape({
                objectId: "f2",
                inferredRole: "FOOTER",
                inferredRoleScore: 0.9,
                paragraphs: [{ level: 0, text: "5" }],
                textRuns: [{ text: "5", fontFamily: "Aptos", fontSizePt: 10, bold: false, italic: false, fontColor: "#000", fontAlpha: 1 }]
              })
            ]
          })
        ]
      });
      const result = runContinuityChecks(deck);
      expect(result.findings.some((x) => x.ruleId === "BP-CONT-004" && x.slideId === "b")).toBe(true);
    });

    it("does not false-positive when unnumbered slides sit between numbered slides", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "n1",
            index: 1,
            shapes: [
              createShape({
                objectId: "f1",
                inferredRole: "FOOTER",
                paragraphs: [{ level: 0, text: "1" }],
                textRuns: [{ text: "1", fontFamily: "Aptos", fontSizePt: 10, bold: false, italic: false, fontColor: "#000", fontAlpha: 1 }]
              })
            ]
          }),
          createSlide({ slideId: "div", index: 2, shapes: [] }),
          createSlide({
            slideId: "n3",
            index: 3,
            shapes: [
              createShape({
                objectId: "f3",
                inferredRole: "FOOTER",
                paragraphs: [{ level: 0, text: "3" }],
                textRuns: [{ text: "3", fontFamily: "Aptos", fontSizePt: 10, bold: false, italic: false, fontColor: "#000", fontAlpha: 1 }]
              })
            ]
          })
        ]
      });
      const result = runContinuityChecks(deck);
      expect(result.findings.filter((x) => x.ruleId === "BP-CONT-004")).toHaveLength(0);
    });
  });

  describe("BP-CONT-005 — date/number formats", () => {
    it("does not run when fewer than three examples in a category", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            shapes: [
              createShape({
                objectId: "x",
                paragraphs: [
                  { level: 0, text: "2024-01-01" },
                  { level: 0, text: "2024-02-01" }
                ],
                textRuns: []
              })
            ]
          })
        ]
      });
      const result = runContinuityChecks(deck);
      expect(result.findings.filter((x) => x.ruleId === "BP-CONT-005")).toHaveLength(0);
    });

    it("flags minority date formats vs dominant ISO", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            shapes: [
              createShape({
                objectId: "a",
                paragraphs: [
                  { level: 0, text: "2024-01-01 and 2024-02-01 and 2024-03-01" },
                  { level: 0, text: "March 15, 2024" }
                ],
                textRuns: []
              })
            ]
          })
        ]
      });
      const result = runContinuityChecks(deck);
      const f = result.findings.find((x) => x.ruleId === "BP-CONT-005" && (x.observed as { category?: string }).category === "date");
      expect(f).toBeDefined();
      expect((f?.observed as { format: string }).format).toBe("LONG_US");
    });

    it("does not false-positive plain large integers when NO_SEPARATOR is dominant", () => {
      const deck = createDeck({
        slides: [
          createSlide({
            slideId: "s1",
            shapes: [
              createShape({
                objectId: "n",
                paragraphs: [
                  { level: 0, text: "Revenue hit 1000 2000 3000 targets" },
                  { level: 0, text: "One outlier 1,000 for test" }
                ],
                textRuns: []
              })
            ]
          })
        ]
      });
      const result = runContinuityChecks(deck);
      const minority = result.findings.filter(
        (x) => x.ruleId === "BP-CONT-005" && (x.observed as { format: string }).format === "COMMA_SEPARATOR"
      );
      expect(minority.length).toBe(1);
    });
  });
});
