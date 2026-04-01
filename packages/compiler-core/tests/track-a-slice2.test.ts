import { describe, expect, it } from "vitest";
import { buildStyleMap, runChecks } from "../src/public-api.js";
import type { StyleMap } from "@magistrat/shared-types";
import { createDeck, createShape, createSlide, createTableShape } from "./fixtures.js";

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

describe("Track A Slice 2 — BP-TABLE-005", () => {
  it("emits error when a cell text run uses a different font than BODY", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    expect(styleMap.BODY?.fontFamily).toBe("Aptos");

    const table = createTableShape({
      objectId: "tbl-1",
      table: {
        rows: 2,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            text: "H",
            textRuns: [{ text: "H", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          },
          {
            rowIndex: 1,
            columnIndex: 0,
            text: "Bad",
            textRuns: [{ text: "Bad", fontFamily: "Calibri", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          }
        ]
      }
    });

    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-TABLE-005" && x.objectId === "tbl-1");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("error");
    expect(f?.source).toBe("exemplar");
    const patch = result.suggestedPatches.find((p) => p.id === f?.suggestedPatchId);
    expect(patch?.op).toBe("SET_TABLE_FONT");
    expect(patch?.fields).toEqual({ fontFamily: "Aptos" });
  });

  it("does not emit when all cell fonts match BODY", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({ objectId: "tbl-ok" });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-005")).toBe(false);
  });

  it("skips when BODY and BULLET_L1 are absent from style map", () => {
    const exemplar = bodyExemplarSlide();
    const table = createTableShape({
      objectId: "tbl",
      table: {
        rows: 1,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            text: "X",
            textRuns: [{ text: "X", fontFamily: "Calibri", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const emptyStyle: StyleMap = {};
    const result = runChecks(deck, emptyStyle);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-005")).toBe(false);
  });

  it("ignores whitespace-only text runs when checking fonts", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-ws",
      table: {
        rows: 1,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            text: "   ",
            textRuns: [{ text: "   ", fontFamily: "Calibri", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-005")).toBe(false);
  });
});

describe("Track A Slice 2 — BP-TABLE-001", () => {
  function exemplarTableHeader(fill: string | undefined) {
    const cell = (col: 0 | 1) => ({
      rowIndex: 0,
      columnIndex: col,
      text: col === 0 ? "A" : "B",
      textRuns: [
        {
          text: col === 0 ? "A" : "B",
          fontFamily: "Aptos",
          fontSizePt: 12,
          bold: true,
          italic: false,
          fontColor: "#FFFFFF",
          fontAlpha: 1
        }
      ],
      ...(fill !== undefined ? { fillColor: fill } : {})
    });
    return createTableShape({
      objectId: "ex-tbl",
      table: {
        rows: 1,
        columns: 2,
        cells: [cell(0), cell(1)]
      }
    });
  }

  it("emits when scanned table header fill differs from exemplar", () => {
    const exemplar = createSlide({
      slideId: "slide-ex",
      index: 1,
      shapes: [bodyExemplarSlide().shapes[0]!, exemplarTableHeader("#003366")]
    });
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const scanned = createTableShape({
      objectId: "scan-tbl",
      table: {
        rows: 1,
        columns: 2,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            fillColor: "#FF0000",
            text: "A",
            textRuns: [{ text: "A", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#FFFFFF", fontAlpha: 1 }]
          },
          {
            rowIndex: 0,
            columnIndex: 1,
            fillColor: "#FF0000",
            text: "B",
            textRuns: [{ text: "B", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#FFFFFF", fontAlpha: 1 }]
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [scanned] })]
    });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-TABLE-001" && x.objectId === "scan-tbl");
    expect(f).toBeDefined();
    expect(f?.observed).toMatchObject({ headerFillColor: "#FF0000" });
    expect(f?.expected).toMatchObject({ headerFillColor: "#003366" });
  });

  it("does not emit when header fills match", () => {
    const exemplar = createSlide({
      slideId: "slide-ex",
      index: 1,
      shapes: [bodyExemplarSlide().shapes[0]!, exemplarTableHeader("#003366")]
    });
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const scanned = createTableShape({
      objectId: "scan-tbl",
      table: {
        rows: 1,
        columns: 2,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            fillColor: "#003366",
            text: "A",
            textRuns: [{ text: "A", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#FFFFFF", fontAlpha: 1 }]
          },
          {
            rowIndex: 0,
            columnIndex: 1,
            fillColor: "#003366",
            text: "B",
            textRuns: [{ text: "B", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#FFFFFF", fontAlpha: 1 }]
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [scanned] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-001")).toBe(false);
  });

  it("does not emit when exemplar slide has no TABLE shape", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const scanned = exemplarTableHeader("#FF0000");
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [scanned] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-001")).toBe(false);
  });

  it("skips when exemplar header has no fill colors", () => {
    const exemplar = createSlide({
      slideId: "slide-ex",
      index: 1,
      shapes: [bodyExemplarSlide().shapes[0]!, exemplarTableHeader(undefined)]
    });
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const scanned = createTableShape({
      objectId: "scan-tbl",
      table: {
        rows: 1,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            fillColor: "#FF0000",
            text: "A",
            textRuns: [{ text: "A", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [scanned] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-001")).toBe(false);
  });
});

describe("Track A Slice 2 — BP-TABLE-004", () => {
  it("flags outlier alignment in a column with a clear plurality", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-align",
      table: {
        rows: 5,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            text: "H",
            textRuns: [{ text: "H", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "CENTER"
          },
          {
            rowIndex: 1,
            columnIndex: 0,
            text: "a",
            textRuns: [{ text: "a", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "LEFT"
          },
          {
            rowIndex: 2,
            columnIndex: 0,
            text: "b",
            textRuns: [{ text: "b", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "LEFT"
          },
          {
            rowIndex: 3,
            columnIndex: 0,
            text: "c",
            textRuns: [{ text: "c", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "LEFT"
          },
          {
            rowIndex: 4,
            columnIndex: 0,
            text: "d",
            textRuns: [{ text: "d", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "CENTER"
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const result = runChecks(deck, styleMap);
    const outliers = result.findings.filter((x) => x.ruleId === "BP-TABLE-004" && x.objectId === "tbl-align");
    expect(outliers.length).toBe(1);
    expect(outliers[0]?.observed).toMatchObject({ alignment: "CENTER", row: 4 });
    const patch = result.suggestedPatches.find((p) => p.id === outliers[0]?.suggestedPatchId);
    expect(patch?.op).toBe("APPLY_MAJORITY_ALIGNMENT");
  });

  it("does not emit when all data cells share the same alignment", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-same",
      table: {
        rows: 3,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            text: "H",
            textRuns: [{ text: "H", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "LEFT"
          },
          {
            rowIndex: 1,
            columnIndex: 0,
            text: "a",
            textRuns: [{ text: "a", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "RIGHT"
          },
          {
            rowIndex: 2,
            columnIndex: 0,
            text: "b",
            textRuns: [{ text: "b", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "RIGHT"
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-004")).toBe(false);
  });

  it("skips column with only one data cell", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-one",
      table: {
        rows: 2,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            text: "H",
            textRuns: [{ text: "H", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "LEFT"
          },
          {
            rowIndex: 1,
            columnIndex: 0,
            text: "a",
            textRuns: [{ text: "a", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
            textAlignment: "RIGHT"
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-004")).toBe(false);
  });

  it("skips when data cells have no horizontal alignment", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-noal",
      table: {
        rows: 3,
        columns: 1,
        cells: [
          {
            rowIndex: 0,
            columnIndex: 0,
            text: "H",
            textRuns: [{ text: "H", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          },
          {
            rowIndex: 1,
            columnIndex: 0,
            text: "a",
            textRuns: [{ text: "a", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          },
          {
            rowIndex: 2,
            columnIndex: 0,
            text: "b",
            textRuns: [{ text: "b", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }]
          }
        ]
      }
    });
    const deck = createDeck({
      slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })]
    });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-004")).toBe(false);
  });
});
