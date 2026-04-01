import { describe, expect, it } from "vitest";
import type { TextRunSnapshot } from "@magistrat/shared-types";
import { buildStyleMap, runChecks } from "../src/public-api.js";
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

const run = (text: string, overrides?: Partial<TextRunSnapshot>) => ({
  text,
  fontFamily: "Aptos",
  fontSizePt: 12,
  bold: false,
  italic: false,
  fontColor: "#000000",
  fontAlpha: 1,
  ...overrides
});

describe("BP-TABLE-002 — Table Border Color Consistency", () => {
  function exemplarWithBorders(borderColor: string) {
    return createTableShape({
      objectId: "ex-tbl",
      table: {
        rows: 2, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "A", textRuns: [run("A")], borders: { top: { color: borderColor, width: 1 }, bottom: { color: borderColor, width: 1 } } },
          { rowIndex: 0, columnIndex: 1, text: "B", textRuns: [run("B")], borders: { top: { color: borderColor, width: 1 }, bottom: { color: borderColor, width: 1 } } },
          { rowIndex: 1, columnIndex: 0, text: "1", textRuns: [run("1")], borders: { top: { color: borderColor, width: 1 }, bottom: { color: borderColor, width: 1 } } },
          { rowIndex: 1, columnIndex: 1, text: "2", textRuns: [run("2")], borders: { top: { color: borderColor, width: 1 }, bottom: { color: borderColor, width: 1 } } },
        ]
      }
    });
  }

  it("emits when scanned table border colors differ from exemplar", () => {
    const exTable = exemplarWithBorders("#000000");
    const exemplar = createSlide({ slideId: "slide-ex", index: 1, shapes: [bodyExemplarSlide().shapes[0]!, exTable] });
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const scanned = createTableShape({
      objectId: "scan-tbl",
      table: {
        rows: 1, columns: 1,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "X", textRuns: [run("X")], borders: { top: { color: "#FF0000", width: 1 }, bottom: { color: "#FF0000", width: 1 } } }
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [scanned] })] });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-TABLE-002");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("warn");
  });

  it("does not emit when border colors match exemplar", () => {
    const exTable = exemplarWithBorders("#000000");
    const exemplar = createSlide({ slideId: "slide-ex", index: 1, shapes: [bodyExemplarSlide().shapes[0]!, exTable] });
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const scanned = createTableShape({
      objectId: "scan-tbl",
      table: {
        rows: 1, columns: 1,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "X", textRuns: [run("X")], borders: { top: { color: "#000000", width: 1 }, bottom: { color: "#000000", width: 1 } } }
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [scanned] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-002")).toBe(false);
  });

  it("skips when no exemplar table has borders", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const scanned = createTableShape({
      objectId: "scan-tbl",
      table: {
        rows: 1, columns: 1,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "X", textRuns: [run("X")], borders: { top: { color: "#FF0000", width: 1 } } }
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [scanned] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-002")).toBe(false);
  });
});

describe("BP-TABLE-007 — Vertical Alignment Inconsistency", () => {
  it("flags outlier vertical alignment in a row", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-va",
      table: {
        rows: 2, columns: 3,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "H1", textRuns: [run("H1")], verticalAlignment: "TOP" as const },
          { rowIndex: 0, columnIndex: 1, text: "H2", textRuns: [run("H2")], verticalAlignment: "TOP" as const },
          { rowIndex: 0, columnIndex: 2, text: "H3", textRuns: [run("H3")], verticalAlignment: "TOP" as const },
          { rowIndex: 1, columnIndex: 0, text: "a", textRuns: [run("a")], verticalAlignment: "MIDDLE" as const },
          { rowIndex: 1, columnIndex: 1, text: "b", textRuns: [run("b")], verticalAlignment: "MIDDLE" as const },
          { rowIndex: 1, columnIndex: 2, text: "c", textRuns: [run("c")], verticalAlignment: "TOP" as const },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    const f = result.findings.filter((x) => x.ruleId === "BP-TABLE-007");
    expect(f.length).toBe(1);
    expect(f[0]?.observed).toMatchObject({ verticalAlignment: "TOP", row: 1, col: 2 });
    const patch = result.suggestedPatches.find((p) => p.id === f[0]?.suggestedPatchId);
    expect(patch?.op).toBe("APPLY_MAJORITY_VERTICAL_ALIGN");
  });

  it("does not emit when all cells in row have same vertical alignment", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-va-ok",
      table: {
        rows: 2, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "H1", textRuns: [run("H1")], verticalAlignment: "TOP" as const },
          { rowIndex: 0, columnIndex: 1, text: "H2", textRuns: [run("H2")], verticalAlignment: "TOP" as const },
          { rowIndex: 1, columnIndex: 0, text: "a", textRuns: [run("a")], verticalAlignment: "MIDDLE" as const },
          { rowIndex: 1, columnIndex: 1, text: "b", textRuns: [run("b")], verticalAlignment: "MIDDLE" as const },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-007")).toBe(false);
  });

  it("skips row with only one cell that has vertical alignment", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-va-1",
      table: {
        rows: 1, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "A", textRuns: [run("A")], verticalAlignment: "TOP" as const },
          { rowIndex: 0, columnIndex: 1, text: "B", textRuns: [run("B")] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-007")).toBe(false);
  });
});

describe("BP-TABLE-006 — Empty Cell Without Explicit Notation", () => {
  it("flags blank data cells in a table with content", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-empty",
      table: {
        rows: 3, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "Name", textRuns: [run("Name")] },
          { rowIndex: 0, columnIndex: 1, text: "Value", textRuns: [run("Value")] },
          { rowIndex: 1, columnIndex: 0, text: "Alpha", textRuns: [run("Alpha")] },
          { rowIndex: 1, columnIndex: 1, text: "100", textRuns: [run("100")] },
          { rowIndex: 2, columnIndex: 0, text: "Beta", textRuns: [run("Beta")] },
          { rowIndex: 2, columnIndex: 1, text: "", textRuns: [] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    const f = result.findings.find((x) => x.ruleId === "BP-TABLE-006");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("info");
    expect(f?.observed).toMatchObject({ emptyCells: [{ row: 2, col: 1 }] });
  });

  it("does not flag blank header cells", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-empty-hdr",
      table: {
        rows: 2, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "", textRuns: [] },
          { rowIndex: 0, columnIndex: 1, text: "Value", textRuns: [run("Value")] },
          { rowIndex: 1, columnIndex: 0, text: "Alpha", textRuns: [run("Alpha")] },
          { rowIndex: 1, columnIndex: 1, text: "100", textRuns: [run("100")] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-006")).toBe(false);
  });

  it("does not emit when all data cells have content", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-full",
      table: {
        rows: 2, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "A", textRuns: [run("A")] },
          { rowIndex: 0, columnIndex: 1, text: "B", textRuns: [run("B")] },
          { rowIndex: 1, columnIndex: 0, text: "1", textRuns: [run("1")] },
          { rowIndex: 1, columnIndex: 1, text: "2", textRuns: [run("2")] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-006")).toBe(false);
  });
});

describe("BP-TABLE-009 — Over-Bolding in Data Rows", () => {
  it("flags data row where >50% of text is bold", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-bold",
      table: {
        rows: 3, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "H1", textRuns: [run("H1", { bold: true })] },
          { rowIndex: 0, columnIndex: 1, text: "H2", textRuns: [run("H2", { bold: true })] },
          { rowIndex: 1, columnIndex: 0, text: "Normal", textRuns: [run("Normal")] },
          { rowIndex: 1, columnIndex: 1, text: "Data", textRuns: [run("Data")] },
          { rowIndex: 2, columnIndex: 0, text: "All Bold Here", textRuns: [run("All Bold Here", { bold: true })] },
          { rowIndex: 2, columnIndex: 1, text: "Bold Too", textRuns: [run("Bold Too", { bold: true })] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    const f = result.findings.filter((x) => x.ruleId === "BP-TABLE-009");
    expect(f.length).toBe(1);
    expect(f[0]?.observed).toMatchObject({ row: 2 });
    expect(f[0]?.severity).toBe("info");
  });

  it("does not flag header row even if all bold", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-hdr-bold",
      table: {
        rows: 2, columns: 1,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "Header Bold", textRuns: [run("Header Bold", { bold: true })] },
          { rowIndex: 1, columnIndex: 0, text: "Normal", textRuns: [run("Normal")] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-009")).toBe(false);
  });

  it("does not flag total/summary row even if all bold", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-total",
      table: {
        rows: 3, columns: 1,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "Item", textRuns: [run("Item", { bold: true })] },
          { rowIndex: 1, columnIndex: 0, text: "Widget", textRuns: [run("Widget")] },
          { rowIndex: 2, columnIndex: 0, text: "Total", textRuns: [run("Total", { bold: true })] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-009")).toBe(false);
  });

  it("does not flag when bold ratio is under 50%", () => {
    const exemplar = bodyExemplarSlide();
    const styleMap = buildStyleMap(exemplar, "original").styleMap;
    const table = createTableShape({
      objectId: "tbl-partial",
      table: {
        rows: 2, columns: 2,
        cells: [
          { rowIndex: 0, columnIndex: 0, text: "H", textRuns: [run("H")] },
          { rowIndex: 0, columnIndex: 1, text: "H", textRuns: [run("H")] },
          { rowIndex: 1, columnIndex: 0, text: "Bold", textRuns: [run("Bold", { bold: true })] },
          { rowIndex: 1, columnIndex: 1, text: "Not bold at all here", textRuns: [run("Not bold at all here")] },
        ]
      }
    });
    const deck = createDeck({ slides: [exemplar, createSlide({ slideId: "s2", index: 2, shapes: [table] })] });
    const result = runChecks(deck, styleMap);
    expect(result.findings.some((x) => x.ruleId === "BP-TABLE-009")).toBe(false);
  });
});
