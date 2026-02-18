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

  it("emits API_LIMITATION and skips typography checks when typography inspectability is false", () => {
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

    const scanTitle = createShape({
      objectId: "title-api-gated",
      geometry: { left: 20, top: 35, width: 900, height: 80, rotation: 0 },
      textRuns: [
        {
          text: "Lorem ipsum",
          fontFamily: "",
          fontSizePt: 0,
          bold: false,
          italic: false,
          fontColor: "#000000",
          fontAlpha: 1
        }
      ],
      inspectability: {
        typography: false,
        bullets: false
      }
    });

    const deck = createDeck({
      slides: [
        exemplar,
        createSlide({
          slideId: "scan",
          index: 2,
          shapes: [scanTitle]
        })
      ]
    });

    const inferred = inferRoles(deck);
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const result = runChecks(inferred.deck, styleMap);

    const hygiene = result.findings.find(
      (finding) => finding.objectId === "title-api-gated" && finding.ruleId === "BP-HYGIENE-004"
    );
    const apiLimited = result.findings.find(
      (finding) =>
        finding.objectId === "title-api-gated" &&
        finding.coverage === "NOT_ANALYZED" &&
        finding.notAnalyzedReason === "API_LIMITATION"
    );
    const typographyFinding = result.findings.find(
      (finding) => finding.objectId === "title-api-gated" && finding.ruleId === "BP-TYPO-001"
    );

    expect(hygiene).toBeDefined();
    expect(apiLimited).toBeDefined();
    expect(typographyFinding).toBeUndefined();
  });

  it("emits API_LIMITATION for bullet checks while still running typography checks", () => {
    const exemplar = createSlide({
      slideId: "exemplar",
      shapes: [
        createShape({
          objectId: "exemplar-bullet",
          textRuns: [
            {
              text: "Bullet line",
              fontFamily: "Aptos",
              fontSizePt: 16,
              bold: false,
              italic: false,
              fontColor: "#111111",
              fontAlpha: 1
            }
          ],
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
    });

    const scanBullet = createShape({
      objectId: "bullet-api-gated",
      textRuns: [
        {
          text: "Bullet line",
          fontFamily: "Calibri",
          fontSizePt: 16,
          bold: false,
          italic: false,
          fontColor: "#111111",
          fontAlpha: 1
        }
      ],
      paragraphs: [
        {
          level: 1,
          bulletIndent: 28,
          bulletHanging: 4,
          text: "Bullet line"
        }
      ],
      inspectability: {
        typography: true,
        bullets: false
      }
    });

    const deck = createDeck({
      slides: [
        exemplar,
        createSlide({
          slideId: "scan",
          index: 2,
          shapes: [scanBullet]
        })
      ]
    });

    const inferred = inferRoles(deck);
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const result = runChecks(inferred.deck, styleMap);

    const apiLimited = result.findings.find(
      (finding) =>
        finding.objectId === "bullet-api-gated" &&
        finding.coverage === "NOT_ANALYZED" &&
        finding.notAnalyzedReason === "API_LIMITATION"
    );
    const bulletFinding = result.findings.find(
      (finding) => finding.objectId === "bullet-api-gated" && finding.ruleId === "BP-BULLET-001"
    );
    const typographyFinding = result.findings.find(
      (finding) => finding.objectId === "bullet-api-gated" && finding.ruleId === "BP-TYPO-001"
    );

    expect(apiLimited).toBeDefined();
    expect(bulletFinding).toBeUndefined();
    expect(typographyFinding).toBeDefined();
  });
});
