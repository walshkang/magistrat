import { describe, expect, it } from "vitest";
import { runChecks } from "../src/public-api.js";
import { runContinuityChecks } from "../src/continuity.js";
import { createDeck, createShape, createSlide } from "./fixtures.js";

describe("runContinuityChecks", () => {
  it("emits BP-CONT-001 when no slide title and no TITLE fallback are available", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "slide-no-title",
          title: "",
          shapes: [
            createShape({
              objectId: "body-shape",
              inferredRole: "BODY",
              inferredRoleScore: 0.75
            })
          ]
        })
      ]
    });

    const result = runContinuityChecks(deck);
    const finding = result.findings.find((candidate) => candidate.ruleId === "BP-CONT-001");

    expect(finding).toBeDefined();
    expect(finding?.slideId).toBe("slide-no-title");
    expect(finding?.observed).toMatchObject({
      effectiveTitle: "",
      titleSource: "none",
      titlelessMarkerSupported: false
    });
  });

  it("does not emit BP-CONT-001 when TITLE fallback text is available", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "slide-title-fallback",
          title: "",
          shapes: [
            createShape({
              objectId: "title-shape",
              inferredRole: "TITLE",
              inferredRoleScore: 0.95,
              geometry: { left: 20, top: 30, width: 800, height: 80, rotation: 0 },
              paragraphs: [{ level: 0, text: "Fallback Title" }],
              textRuns: [
                {
                  text: "Fallback Title",
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
        })
      ]
    });

    const result = runContinuityChecks(deck);
    const finding = result.findings.find((candidate) => candidate.ruleId === "BP-CONT-001");

    expect(finding).toBeUndefined();
  });

  it("emits one BP-CONT-002 finding with unmatched agenda items", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "slide-agenda",
          index: 1,
          title: "Agenda",
          shapes: [
            createShape({
              objectId: "agenda-items",
              zIndex: 2,
              paragraphs: [
                { level: 0, text: "1. Overview" },
                { level: 0, text: "2. Market" },
                { level: 0, text: "3. Plan" }
              ]
            })
          ]
        }),
        createSlide({ slideId: "slide-overview", index: 2, title: "Overview", shapes: [] }),
        createSlide({ slideId: "slide-plan", index: 3, title: "Plan", shapes: [] })
      ]
    });

    const result = runContinuityChecks(deck);
    const findings = result.findings.filter((candidate) => candidate.ruleId === "BP-CONT-002");
    const finding = findings[0];

    expect(findings).toHaveLength(1);
    expect(finding?.slideId).toBe("slide-agenda");
    expect(finding?.observed).toMatchObject({
      agendaPresent: true,
      agendaSlideId: "slide-agenda",
      unmatchedAgendaItems: ["2. Market"],
      unmatchedAgendaItemsNormalized: ["market"],
      matchedCount: 2,
      totalAgendaItems: 3
    });
  });

  it("does not emit BP-CONT-002 when all agenda items map to slide titles", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "slide-agenda",
          index: 1,
          title: "Agenda",
          shapes: [
            createShape({
              objectId: "agenda-items",
              paragraphs: [
                { level: 0, text: "Overview" },
                { level: 0, text: "Market" },
                { level: 0, text: "Plan" }
              ]
            })
          ]
        }),
        createSlide({ slideId: "slide-overview", index: 2, title: "Overview", shapes: [] }),
        createSlide({ slideId: "slide-market", index: 3, title: "Market", shapes: [] }),
        createSlide({ slideId: "slide-plan", index: 4, title: "Plan", shapes: [] })
      ]
    });

    const result = runContinuityChecks(deck);
    const finding = result.findings.find((candidate) => candidate.ruleId === "BP-CONT-002");

    expect(finding).toBeUndefined();
  });

  it("does not emit BP-CONT-002 when no agenda slide is present", () => {
    const deck = createDeck({
      slides: [
        createSlide({ slideId: "slide-1", index: 1, title: "Overview", shapes: [] }),
        createSlide({ slideId: "slide-2", index: 2, title: "Market", shapes: [] })
      ]
    });

    const result = runContinuityChecks(deck);
    const finding = result.findings.find((candidate) => candidate.ruleId === "BP-CONT-002");

    expect(finding).toBeUndefined();
  });

  it("produces deterministic finding IDs and ordering across repeated runs", () => {
    const deck = createDeck({
      slides: [
        createSlide({
          slideId: "slide-agenda",
          index: 1,
          title: "Agenda",
          shapes: [
            createShape({
              objectId: "agenda-items",
              paragraphs: [
                { level: 0, text: "1. Overview" },
                { level: 0, text: "2. Market" }
              ]
            })
          ]
        }),
        createSlide({ slideId: "slide-overview", index: 2, title: "Overview", shapes: [] }),
        createSlide({ slideId: "slide-empty-title", index: 3, title: "", shapes: [] })
      ]
    });

    const first = runContinuityChecks(deck);
    const second = runContinuityChecks(deck);

    expect(first.findings).toEqual(second.findings);
  });
});

describe("runChecks continuity coverage", () => {
  it("reports continuity as executed", () => {
    const deck = createDeck({
      slides: [createSlide({ slideId: "slide-1", title: "Overview", shapes: [] })]
    });

    const result = runChecks(deck, {});

    expect(result.coverage.continuityStatus).toBe("RAN");
    expect(result.coverage.continuityCoverage).toBe(1);
  });
});
