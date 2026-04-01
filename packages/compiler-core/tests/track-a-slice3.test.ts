import { describe, expect, it } from "vitest";
import { buildStyleMap, runChecks } from "../src/public-api.js";
import { createDeck, createImageShape, createShape, createSlide } from "./fixtures.js";

function bodyExemplarSlide() {
  return createSlide({
    slideId: "slide-ex",
    index: 1,
    shapes: [
      createShape({
        objectId: "body-ref",
        geometry: { left: 40, top: 210, width: 500, height: 120, rotation: 0 },
        textRuns: [
          {
            text: "Body",
            fontFamily: "Aptos",
            fontSizePt: 18,
            bold: false,
            italic: false,
            fontColor: "#000000",
            fontAlpha: 1
          }
        ],
        paragraphs: [{ level: 0, text: "Body" }]
      })
    ]
  });
}

describe("Track A Slice 3 — BP-LAYOUT-005", () => {
  it("emits error when rendered aspect ratio differs from intrinsic", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const img = createImageShape({
      objectId: "img-1",
      geometry: { left: 100, top: 100, width: 300, height: 300, rotation: 0 },
      imageMetadata: { intrinsicWidth: 400, intrinsicHeight: 300 }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [img] })]
    });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-LAYOUT-005" && x.objectId === "img-1");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("error");
    expect(f?.source).toBe("playbook");
    expect(f?.risk).toBe("safe");
    const patch = result.suggestedPatches.find((p) => p.id === f?.suggestedPatchId);
    expect(patch?.op).toBe("RESTORE_ASPECT_RATIO");
    expect(patch?.fields?.height).toBeCloseTo(225, 5);
  });

  it("does not emit when intrinsic and rendered ratios match (4:3)", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const img = createImageShape({
      objectId: "img-ok",
      geometry: { left: 0, top: 0, width: 300, height: 225, rotation: 0 },
      imageMetadata: { intrinsicWidth: 400, intrinsicHeight: 300 }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [img] })]
    });
    expect(runChecks(deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-005")).toBe(false);
  });

  it("does not emit when ratio diff is within threshold (0.007)", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const renderedHeight = 300 / 1.3378;
    const img = createImageShape({
      objectId: "img-near",
      geometry: { left: 0, top: 0, width: 300, height: renderedHeight, rotation: 0 },
      imageMetadata: { intrinsicWidth: 400, intrinsicHeight: 300 }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [img] })]
    });
    expect(runChecks(deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-005")).toBe(false);
  });

  it("emits when ratio diff is just over threshold", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const img = createImageShape({
      objectId: "img-over",
      geometry: { left: 0, top: 0, width: 300, height: 223, rotation: 0 },
      imageMetadata: { intrinsicWidth: 400, intrinsicHeight: 300 }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [img] })]
    });
    const f = runChecks(deck, styleMap).findings.find((x) => x.ruleId === "BP-LAYOUT-005" && x.objectId === "img-over");
    expect(f).toBeDefined();
  });

  it("does not emit when imageMetadata is absent", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const img = createShape({
      shapeType: "IMAGE",
      supportedForAnalysis: false,
      textRuns: [],
      paragraphs: [],
      inspectability: { typography: false, bullets: false },
      geometry: { left: 0, top: 0, width: 300, height: 300, rotation: 0 }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [img] })]
    });
    expect(runChecks(deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-005")).toBe(false);
  });

  it("does not emit when intrinsic width is zero", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const img = createImageShape({
      objectId: "img-zero",
      imageMetadata: { intrinsicWidth: 0, intrinsicHeight: 300 }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [img] })]
    });
    expect(runChecks(deck, styleMap).findings.some((x) => x.ruleId === "BP-LAYOUT-005")).toBe(false);
  });

  it("suggested patch height equals renderedWidth / intrinsicRatio", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const renderedWidth = 300;
    const intrinsicW = 400;
    const intrinsicH = 300;
    const intrinsicRatio = intrinsicW / intrinsicH;
    const img = createImageShape({
      objectId: "img-fix",
      geometry: { left: 0, top: 0, width: renderedWidth, height: 400, rotation: 0 },
      imageMetadata: { intrinsicWidth: intrinsicW, intrinsicHeight: intrinsicH }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [img] })]
    });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-LAYOUT-005" && x.objectId === "img-fix");
    const patch = result.suggestedPatches.find((p) => p.id === f?.suggestedPatchId);
    expect(patch?.fields?.height).toBeCloseTo(renderedWidth / intrinsicRatio, 8);
  });
});
