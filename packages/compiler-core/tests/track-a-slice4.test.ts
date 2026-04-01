import { describe, expect, it } from "vitest";
import { buildStyleMap, runChecks } from "../src/public-api.js";
import { createChartShape, createDeck, createShape, createSlide } from "./fixtures.js";

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
            fontColor: "#003366",
            fontAlpha: 1
          }
        ],
        paragraphs: [{ level: 0, text: "Body" }],
        fillColor: "#FFFFFF"
      })
    ]
  });
}

describe("Track A Slice 4 — BP-CHART-001", () => {
  it("emits error when chart series colors are off-palette", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    // Palette should contain #003366 (fontColor) and #FFFFFF (fillColor)

    const chart = createChartShape({
      objectId: "chart-1",
      chart: {
        chartType: "BAR",
        series: [
          { index: 0, color: "#4285F4" }, // Google blue — not in palette
          { index: 1, color: "#EA4335" }, // Google red — not in palette
        ],
        axes: [{ position: "LEFT_AXIS", title: "Revenue" }],
        hasDataLabels: false,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-CHART-001" && x.objectId === "chart-1");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("error");
    expect(f?.risk).toBe("manual");
  });

  it("does not emit when all series colors are in palette", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-ok",
      chart: {
        chartType: "BAR",
        series: [
          { index: 0, color: "#003366" }, // in palette (fontColor)
          { index: 1, color: "#003366" }, // also in palette
        ],
        axes: [],
        hasDataLabels: false,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-CHART-001")).toBe(false);
  });

  it("skips when chart has no series", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-empty",
      chart: { chartType: "BAR", series: [], axes: [], hasDataLabels: false }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-CHART-001")).toBe(false);
  });

  it("skips series with no color (undefined)", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-nocolor",
      chart: {
        chartType: "BAR",
        series: [
          { index: 0 }, // no color
          { index: 1, color: "#003366" }, // in palette
        ],
        axes: [],
        hasDataLabels: false,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-CHART-001")).toBe(false);
  });

  it("skips when exemplar palette is empty", () => {
    const exemplar = bodyExemplarSlide();

    const chart = createChartShape({
      objectId: "chart-nop",
      chart: {
        chartType: "BAR",
        series: [{ index: 0, color: "#FF0000" }],
        axes: [],
        hasDataLabels: false,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    // Empty style map → empty palette
    const result = runChecks(deck, {});
    expect(result.findings.some((x) => x.ruleId === "BP-CHART-001")).toBe(false);
  });
});

describe("Track A Slice 4 — BP-CHART-002", () => {
  it("emits warn when chart has no Y-axis title and no data labels", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-naked",
      chart: {
        chartType: "BAR",
        series: [{ index: 0, color: "#003366" }],
        axes: [{ position: "BOTTOM_AXIS", title: "Quarter" }],
        hasDataLabels: false,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-CHART-002" && x.objectId === "chart-naked");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("warn");
    expect(f?.observed).toMatchObject({ issues: ["missing_y_axis_title", "no_data_labels"] });
  });

  it("does not emit when chart has Y-axis title", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-titled",
      chart: {
        chartType: "BAR",
        series: [{ index: 0, color: "#003366" }],
        axes: [
          { position: "BOTTOM_AXIS", title: "Quarter" },
          { position: "LEFT_AXIS", title: "Revenue ($M)" },
        ],
        hasDataLabels: false,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-CHART-002")).toBe(false);
  });

  it("does not emit for PIE charts (no axes)", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-pie",
      chart: {
        chartType: "PIE",
        series: [{ index: 0 }],
        axes: [],
        hasDataLabels: false,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-CHART-002")).toBe(false);
  });

  it("emits only missing_y_axis_title when chart has data labels but no Y-axis title", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-labels-no-title",
      chart: {
        chartType: "BAR",
        series: [{ index: 0 }],
        axes: [{ position: "BOTTOM_AXIS", title: "Quarter" }],
        hasDataLabels: true,
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-CHART-002");
    expect(f).toBeDefined();
    expect(f?.observed).toMatchObject({ issues: ["missing_y_axis_title"] });
    // Should NOT include "no_data_labels" since hasDataLabels is true
    expect((f?.observed as { issues: string[] }).issues).not.toContain("no_data_labels");
  });

  it("does not emit when chart has no chartType", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;

    const chart = createChartShape({
      objectId: "chart-notype",
      chart: {
        series: [],
        axes: [],
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [chart] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-CHART-002")).toBe(false);
  });
});
