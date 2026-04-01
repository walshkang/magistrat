# Cursor Prompt: Track A Slice 2 — Table Cell Model IR Extension

> Paste this into Cursor Composer. Extends the IR with a table cell model, updates both adapters and the GAS bridge, and adds 3 starter table rules.

---

## Context

Magistrat's IR (`DeckSnapshot`) currently has no table cell model. TABLE shapes exist in `slide.shapes[]` with `shapeType: "TABLE"` but carry no cell-level data. This slice adds a `TableSnapshot` + `TableCellSnapshot` model end-to-end: GAS bridge → bridge types → Google mapper → IR → Office adapter → rules → tests.

**Pattern to follow:** Track A Slice 1 (`docs/prompts/track_a_slice1.md`) added `ParagraphSnapshot.alignment` and `ShapeSnapshot.lineColor/lineWidth`. Follow the same vertical-slice approach.

**Design decision:** Table data lives on `ShapeSnapshot.table?: TableSnapshot` (not a separate top-level type). Tables are already shapes — this keeps the existing per-shape loop working and avoids structural changes to `SlideSnapshot` or `DeckSnapshot`.

---

## Part 1 — IR Extensions

### File: `packages/shared-types/src/ir.ts`

Add these new types:

```typescript
export type ParagraphAlignment = "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";  // already exists — reuse

export type VerticalAlignment = "TOP" | "MIDDLE" | "BOTTOM";

export interface CellBorders {
  top?: { color?: string; width?: number };
  bottom?: { color?: string; width?: number };
  left?: { color?: string; width?: number };
  right?: { color?: string; width?: number };
}

export interface CellMargins {
  top?: number;   // points
  bottom?: number;
  left?: number;
  right?: number;
}

export interface TableCellSnapshot {
  rowIndex: number;
  columnIndex: number;
  /** Cell background fill color, hex #RRGGBB */
  fillColor?: string;
  borders?: CellBorders;
  margins?: CellMargins;
  /** Horizontal text alignment within the cell */
  textAlignment?: ParagraphAlignment;
  /** Vertical alignment of content within the cell */
  verticalAlignment?: VerticalAlignment;
  /** All text runs within this cell */
  textRuns: TextRunSnapshot[];
  /** Raw concatenated text content */
  text: string;
}

export interface TableSnapshot {
  rows: number;
  columns: number;
  cells: TableCellSnapshot[];
}
```

Add to `ShapeSnapshot`:
```typescript
export interface ShapeSnapshot {
  // ... existing fields ...
  /** Table cell data when shapeType === "TABLE" */
  table?: TableSnapshot | undefined;
}
```

Export `VerticalAlignment`, `CellBorders`, `CellMargins`, `TableCellSnapshot`, and `TableSnapshot` from the module.

**Why a flat `cells` array:** Simpler to iterate for rules that scan all cells. Row/column indices on each cell make positional queries easy. Mirrors how both Google Slides API and OOXML represent table data.

---

## Part 2 — Evidence Type + Patch Ops

### File: `packages/shared-types/src/findings.ts`

Add `"TABLE_EVIDENCE"` to the `EVIDENCE_TYPES` array (after `"TEXT_STRING_EVIDENCE"`).

### File: `packages/shared-types/src/patches.ts`

Add to `PATCH_OP_VALUES`:
```typescript
"SET_TABLE_FONT",
"APPLY_MAJORITY_ALIGNMENT"
```

### File: `packages/compiler-core/src/constants.ts`

Add `"SET_TABLE_FONT"` and `"APPLY_MAJORITY_ALIGNMENT"` to `SAFE_PATCH_OPS`.

Update `PLAYBOOK_RULE_COUNT`: **32 → 33** (BP-TABLE-004 is `source: "playbook"`, counts +1; the other two are `source: "exemplar"`, don't count).

---

## Part 3 — GAS Bridge Extension

### File: `apps/slides-addon/gas/Code.gs`

In `readPresentation()`, tables are page elements with type `SlidesApp.PageElementType.TABLE`. Currently they may be skipped or captured as empty shapes. Add a new block to read table cell data:

```javascript
if (el.getPageElementType() === SlidesApp.PageElementType.TABLE) {
  var table = el.asTable();
  var numRows = table.getNumRows();
  var numCols = table.getNumColumns();
  element.elementType = 'TABLE';
  element.table = {
    rows: numRows,
    columns: numCols,
    cells: []
  };

  for (var r = 0; r < numRows; r++) {
    for (var c = 0; c < numCols; c++) {
      var cell = table.getCell(r, c);
      var cellData = {
        rowIndex: r,
        columnIndex: c,
        text: '',
        textRuns: []
      };

      // Cell fill
      try {
        var cellFill = cell.getFill();
        if (cellFill && cellFill.getSolidFill()) {
          cellData.fillColor = cellFill.getSolidFill().getColor().asRgbColor().asHexString();
        }
      } catch (e) { /* theme fill — skip */ }

      // Cell text + alignment
      try {
        var cellText = cell.getText();
        if (cellText) {
          cellData.text = cellText.asString();
          var cellInfo = extractTextInfo(cellText);
          cellData.textRuns = cellInfo.runs;
          // Grab alignment from first paragraph
          if (cellInfo.paragraphs && cellInfo.paragraphs.length > 0
              && cellInfo.paragraphs[0].alignment) {
            cellData.textAlignment = cellInfo.paragraphs[0].alignment;
          }
        }
      } catch (e) { /* no text */ }

      // Vertical alignment
      try {
        var vAlign = cell.getContentAlignment();
        if (vAlign) {
          var vStr = vAlign.toString();
          if (vStr === 'TOP') cellData.verticalAlignment = 'TOP';
          else if (vStr === 'MIDDLE') cellData.verticalAlignment = 'MIDDLE';
          else if (vStr === 'BOTTOM') cellData.verticalAlignment = 'BOTTOM';
        }
      } catch (e) { /* not available */ }

      // Cell borders (4 edges)
      var edges = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
      var edgeKeys = ['top', 'bottom', 'left', 'right'];
      var borders = {};
      for (var ei = 0; ei < edges.length; ei++) {
        try {
          var border = cell.getBorder(SlidesApp.BorderPosition[edges[ei]]);
          if (border) {
            var bw = border.getWeight();
            var bData = { width: bw };
            try {
              var bFill = border.getLineFill();
              if (bFill && bFill.getSolidFill()) {
                bData.color = bFill.getSolidFill().getColor().asRgbColor().asHexString();
              }
            } catch (e2) { /* theme border color */ }
            borders[edgeKeys[ei]] = bData;
          }
        } catch (e) { /* border not available */ }
      }
      if (Object.keys(borders).length > 0) {
        cellData.borders = borders;
      }

      // Cell margins — NOT available in GAS API (only REST API). Skip.

      element.table.cells.push(cellData);
    }
  }
}
```

**Key GAS API facts:**
- `Table.getCell(row, col)` returns `TableCell`
- `TableCell.getFill()` → `Fill` → `.getSolidFill()` → `.getColor().asRgbColor().asHexString()`
- `TableCell.getContentAlignment()` returns `ContentAlignment` enum (`TOP`, `MIDDLE`, `BOTTOM`)
- `TableCell.getBorder(SlidesApp.BorderPosition.TOP)` returns `Border` → `.getWeight()` and `.getLineFill()`
- Cell margins/padding are NOT exposed in GAS API — only in the REST API
- `extractTextInfo()` already exists in Code.gs — reuse it for cell text runs

---

## Part 4 — Bridge Types

### File: `packages/google-adapter/src/bridge-types.ts`

Add new interfaces:

```typescript
export interface GoogleBridgeCellBorder {
  color?: string;
  width?: number;
}

export interface GoogleBridgeTableCell {
  rowIndex: number;
  columnIndex: number;
  fillColor?: string;
  borders?: {
    top?: GoogleBridgeCellBorder;
    bottom?: GoogleBridgeCellBorder;
    left?: GoogleBridgeCellBorder;
    right?: GoogleBridgeCellBorder;
  };
  textAlignment?: string;
  verticalAlignment?: string;
  textRuns?: GoogleBridgeTextRun[];
  text?: string;
}

export interface GoogleBridgeTable {
  rows: number;
  columns: number;
  cells: GoogleBridgeTableCell[];
}
```

Add to `GoogleBridgePageElement`:
```typescript
table?: GoogleBridgeTable;
```

---

## Part 5 — Google Mapper

### File: `packages/google-adapter/src/providers/google-mappers.ts`

Import the new IR types (`TableSnapshot`, `TableCellSnapshot`, `VerticalAlignment`, `CellBorders`).

Add helper functions:

```typescript
function mapTable(bridge: GoogleBridgeTable): TableSnapshot {
  return {
    rows: bridge.rows,
    columns: bridge.columns,
    cells: bridge.cells.map(mapTableCell)
  };
}

function mapTableCell(cell: GoogleBridgeTableCell): TableCellSnapshot {
  return {
    rowIndex: cell.rowIndex,
    columnIndex: cell.columnIndex,
    ...(cell.fillColor ? { fillColor: normalizeColor(cell.fillColor) } : {}),
    ...(cell.borders ? { borders: mapCellBorders(cell.borders) } : {}),
    ...(normalizeAlignment(cell.textAlignment) ? { textAlignment: normalizeAlignment(cell.textAlignment)! } : {}),
    ...(normalizeVerticalAlignment(cell.verticalAlignment) ? { verticalAlignment: normalizeVerticalAlignment(cell.verticalAlignment) } : {}),
    textRuns: (cell.textRuns ?? []).map(run => ({
      text: run.text,
      fontFamily: run.fontFamily ?? "",
      fontSizePt: run.fontSizePt ?? 0,
      bold: run.bold ?? false,
      italic: run.italic ?? false,
      fontColor: normalizeColor(run.fontColor ?? "#000000"),
      fontAlpha: run.fontAlpha ?? 1
    })),
    text: cell.text ?? ""
  };
}

function normalizeVerticalAlignment(raw: string | undefined): VerticalAlignment | undefined {
  if (!raw) return undefined;
  const n = raw.toUpperCase();
  if (n === "TOP") return "TOP";
  if (n === "MIDDLE") return "MIDDLE";
  if (n === "BOTTOM") return "BOTTOM";
  return undefined;
}

function mapCellBorders(borders: GoogleBridgeTableCell["borders"]): CellBorders {
  const result: CellBorders = {};
  for (const edge of ["top", "bottom", "left", "right"] as const) {
    const b = borders?.[edge];
    if (b) {
      result[edge] = {
        ...(b.color ? { color: normalizeColor(b.color) } : {}),
        ...(typeof b.width === "number" ? { width: b.width } : {})
      };
    }
  }
  return result;
}
```

In the returned object of `mapPageElement`, add:
```typescript
...(element.table ? { table: mapTable(element.table) } : {}),
```

`normalizeAlignment` already exists from Slice 1 — reuse it for cell `textAlignment`.

`supportedForAnalysis` stays as `shapeType === "TEXT"` — table rules check `shapeType === "TABLE"` directly, they don't use the standard typography pipeline.

---

## Part 6 — Office Adapter

### File: `packages/office-adapter/src/providers/office-readonly-provider.ts`

Office.js exposes table data via `shape.table` (PowerPoint.Table). The API varies by Office version — wrap everything in try/catch.

In the shape processing loop, for TABLE shapes:

```typescript
if (normalizeShapeType(entry.shape.type) === "TABLE") {
  try {
    const tableProp = (entry.shape as any).table;
    if (tableProp) {
      tableProp.load("rowCount,columnCount");
      await context.sync();

      const tableData: TableCellSnapshot[] = [];
      for (let r = 0; r < tableProp.rowCount; r++) {
        for (let c = 0; c < tableProp.columnCount; c++) {
          try {
            const cell = tableProp.getCell(r, c);
            cell.load("body/text,fill/foregroundColor,verticalAlignment,paddingTop,paddingBottom,paddingLeft,paddingRight");
            await context.sync();

            const cellSnap: TableCellSnapshot = {
              rowIndex: r,
              columnIndex: c,
              text: cell.body?.text ?? "",
              textRuns: []  // Office.js cell text runs require deeper body traversal — skip for v1
            };

            // Fill color
            try {
              if (cell.fill?.foregroundColor) {
                cellSnap.fillColor = normalizeColor(cell.fill.foregroundColor);
              }
            } catch { /* not available */ }

            // Vertical alignment
            try {
              const va = cell.verticalAlignment;
              if (va === "Top") cellSnap.verticalAlignment = "TOP";
              else if (va === "Middle") cellSnap.verticalAlignment = "MIDDLE";
              else if (va === "Bottom") cellSnap.verticalAlignment = "BOTTOM";
            } catch { /* not available */ }

            // Cell margins (available in Office.js unlike GAS)
            try {
              const margins: CellMargins = {};
              if (typeof cell.paddingTop === "number") margins.top = cell.paddingTop;
              if (typeof cell.paddingBottom === "number") margins.bottom = cell.paddingBottom;
              if (typeof cell.paddingLeft === "number") margins.left = cell.paddingLeft;
              if (typeof cell.paddingRight === "number") margins.right = cell.paddingRight;
              if (Object.keys(margins).length > 0) cellSnap.margins = margins;
            } catch { /* not available */ }

            tableData.push(cellSnap);
          } catch { /* cell read failed — skip */ }
        }
      }

      shape.table = {
        rows: tableProp.rowCount,
        columns: tableProp.columnCount,
        cells: tableData
      };
    }
  } catch {
    // Table API unavailable in this Office version — shape.table stays undefined
  }
}
```

**Important trade-offs:**
- Cell text runs (`textRuns`) require deep body/paragraph/run traversal in Office.js. For v1, populate `text` only and leave `textRuns` as `[]`. This means BP-TABLE-005 (font check) won't work on Office-sourced snapshots until a future slice adds run extraction. This is acceptable.
- Cell borders in Office.js require `cell.borderTop/Bottom/Left/Right` which may not be available in all API versions. Skip borders for v1.
- Cell margins ARE available via `paddingTop/Bottom/Left/Right` — populate when available.

---

## Part 7 — Style Map

**No changes needed.** The style map operates on role-assigned TEXT shapes. TABLE shapes don't participate in role inference or style map construction.

The 3 starter rules access the style map read-only:
- BP-TABLE-005 reads `styleMap.BODY?.fontFamily` to get the expected font
- BP-TABLE-001 finds exemplar tables directly on the exemplar slide
- BP-TABLE-004 is a pure playbook rule (no exemplar comparison)

---

## Part 8 — Starter Rules (3 Rules)

### File: `packages/compiler-core/src/checks.ts`

Add a new function `evaluateTableFindings()` and call it from the main `runChecks()` loop. Place the call after the existing per-shape checks, still inside the per-slide loop:

```typescript
// After the existing shape loop, for each slide:
for (const shape of slide.shapes) {
  if (shape.shapeType !== "TABLE" || !shape.table) continue;
  for (const finding of evaluateTableFindings(slide.slideId, shape, styleMap, deck)) {
    pushFinding(finding);
  }
}
```

### 8a. BP-TABLE-005 — Trapped External Fonts

**Source:** `"exemplar"` | **Severity:** `"error"` | **Risk:** `"safe"`

This is the highest-value table rule. Every Excel paste brings Calibri/Aptos into a branded deck.

```
For each TABLE shape with populated table.cells:
  expectedFont = styleMap.BODY?.fontFamily ?? styleMap.BULLET_L1?.fontFamily
  If no expectedFont → skip

  offendingCells = []
  For each cell in table.cells:
    For each textRun where textRun.text.trim().length > 0:
      If textRun.fontFamily.toLowerCase() !== expectedFont.toLowerCase():
        Add { row: cell.rowIndex, col: cell.columnIndex, fontFamily: textRun.fontFamily } to offendingCells
        Break (one flag per cell is enough)

  If offendingCells.length > 0:
    Emit ONE finding per TABLE shape (not per cell — prevents finding explosion on large tables)
    ruleId: "BP-TABLE-005"
    severity: "error"
    source: "exemplar"
    risk: "safe"
    observed: { cells: offendingCells }
    expected: { fontFamily: expectedFont }
    evidence: [TABLE_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
    suggestedFix: { op: "SET_TABLE_FONT", fontFamily: expectedFont }
```

### 8b. BP-TABLE-001 — Table Header Fill Color

**Source:** `"exemplar"` | **Severity:** `"error"` | **Risk:** `"manual"`

```
Find the exemplar table:
  exemplarSlideId = resolveExemplarSlideId(deck)  // already exists
  exemplarSlide = deck.slides.find(s => s.slideId === exemplarSlideId)
  exemplarTable = first shape on exemplarSlide where shapeType === "TABLE" && table != null
  If no exemplar table → skip all BP-TABLE-001 checks

  Get exemplar header fill:
    headerCells = exemplarTable.table.cells.filter(c => c.rowIndex === 0)
    exemplarHeaderFill = dominant fillColor among headerCells (most common, ignoring undefined)
    If no exemplarHeaderFill → skip

For each non-exemplar TABLE shape with table data:
  scannedHeaderCells = table.cells.filter(c => c.rowIndex === 0)
  scannedHeaderFill = dominant fillColor among scannedHeaderCells
  If scannedHeaderFill !== exemplarHeaderFill:
    Emit finding
    ruleId: "BP-TABLE-001"
    severity: "error"
    source: "exemplar"
    risk: "manual"
    observed: { headerFillColor: scannedHeaderFill }
    expected: { headerFillColor: exemplarHeaderFill }
    evidence: [EXEMPLAR_EVIDENCE, TABLE_EVIDENCE]
    No auto-fix (risk: manual)
```

### 8c. BP-TABLE-004 — Intra-Column Alignment Consistency

**Source:** `"playbook"` | **Severity:** `"warn"` | **Risk:** `"safe"`

```
For each TABLE shape with table data:
  Group cells by columnIndex, EXCLUDING row 0 (header row)
  For each column with >= 2 data cells:
    Count textAlignment values, find majority
    For each cell where textAlignment != majority AND textAlignment is defined:
      Emit finding
      ruleId: "BP-TABLE-004"
      severity: "warn"
      source: "playbook"
      risk: "safe"
      observed: { alignment: cell.textAlignment, row: cell.rowIndex, col: cell.columnIndex }
      expected: { alignment: majorityAlignment, column: cell.columnIndex }
      evidence: [TABLE_EVIDENCE, TYPOGRAPHIC_EVIDENCE]
      suggestedFix: { op: "APPLY_MAJORITY_ALIGNMENT", alignment: majorityAlignment }
```

---

## Part 9 — Tests

### New file: `packages/compiler-core/tests/track-a-slice2.test.ts`

Follow the patterns from `track-a-slice1.test.ts`. Import `runChecks`, `buildStyleMap`, `inferRoles` from `../src/public-api.js`. Import fixtures from `./fixtures.js`.

### Fixture helper — add to `packages/compiler-core/tests/fixtures.ts`:

```typescript
export function createTableShape(overrides: Partial<ShapeSnapshot> = {}): ShapeSnapshot {
  return createShape({
    shapeType: "TABLE",
    supportedForAnalysis: false,
    table: {
      rows: 2,
      columns: 2,
      cells: [
        { rowIndex: 0, columnIndex: 0, fillColor: "#003366", text: "Header 1",
          textRuns: [{ text: "Header 1", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#FFFFFF", fontAlpha: 1 }],
          textAlignment: "LEFT" },
        { rowIndex: 0, columnIndex: 1, fillColor: "#003366", text: "Header 2",
          textRuns: [{ text: "Header 2", fontFamily: "Aptos", fontSizePt: 12, bold: true, italic: false, fontColor: "#FFFFFF", fontAlpha: 1 }],
          textAlignment: "LEFT" },
        { rowIndex: 1, columnIndex: 0, text: "Data 1",
          textRuns: [{ text: "Data 1", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
          textAlignment: "LEFT" },
        { rowIndex: 1, columnIndex: 1, text: "Data 2",
          textRuns: [{ text: "Data 2", fontFamily: "Aptos", fontSizePt: 12, bold: false, italic: false, fontColor: "#000000", fontAlpha: 1 }],
          textAlignment: "RIGHT" },
      ]
    },
    ...overrides
  });
}
```

### Test cases:

**BP-TABLE-005 (Trapped External Fonts):**
1. **Happy path:** table cells have `fontFamily: "Calibri"`, styleMap BODY font is `"Aptos"` → finding with ruleId `BP-TABLE-005`, severity `error`
2. **Negative:** all cell fonts match BODY font → no finding
3. **Edge:** no BODY or BULLET_L1 in style map → no finding (graceful skip)
4. **Edge:** cell text runs with empty/whitespace-only text → skipped

**BP-TABLE-001 (Header Fill Color):**
1. **Happy path:** exemplar table header fill `#003366`, scanned table header fill `#FF0000` → finding
2. **Negative:** header fills match → no finding
3. **Edge:** no TABLE shape on exemplar slide → no finding for any table
4. **Edge:** header cells have no fillColor → skip

**BP-TABLE-004 (Intra-Column Alignment):**
1. **Happy path:** column has 3 LEFT + 1 CENTER → finding for the CENTER outlier
2. **Negative:** all cells same alignment → no finding
3. **Edge:** only 1 data cell in column → skip (need >= 2)
4. **Edge:** cells have no textAlignment → skip

### Google adapter test — add to `packages/google-adapter/tests/public-api.test.ts`:

Verify that a bridge presentation with a TABLE element maps correctly:
- `elementType: "TABLE"` with `table: { rows, columns, cells }` in bridge data
- Assert resulting ShapeSnapshot has `shapeType: "TABLE"`, `table.cells` with normalized colors

---

## Part 10 — RULE_CATALOG.md

### File: `docs/RULE_CATALOG.md`

Update statuses:
- BP-TABLE-001: `proposed` → `active`
- BP-TABLE-004: `proposed` → `active`
- BP-TABLE-005: `proposed` → `active`

Add to Implementation Roadmap section (after Track A Slice 1):

```markdown
### Track A Slice 2 — Table Cell Model IR (2026-04-01)
Extended IR with `TableSnapshot` and `TableCellSnapshot` on `ShapeSnapshot.table`.
GAS bridge extracts table cell fill, borders, text, alignment. Office adapter: best-effort table read.
Unblocks:
- **BP-TABLE-001** — Table Header Fill Color
- **BP-TABLE-004** — Intra-Column Alignment Consistency
- **BP-TABLE-005** — Trapped External Fonts
```

---

## Summary of files to modify

| File | Changes |
|---|---|
| `packages/shared-types/src/ir.ts` | Add `VerticalAlignment`, `CellBorders`, `CellMargins`, `TableCellSnapshot`, `TableSnapshot`; add `table?` to `ShapeSnapshot` |
| `packages/shared-types/src/findings.ts` | Add `"TABLE_EVIDENCE"` to evidence types |
| `packages/shared-types/src/patches.ts` | Add `"SET_TABLE_FONT"`, `"APPLY_MAJORITY_ALIGNMENT"` |
| `apps/slides-addon/gas/Code.gs` | TABLE element reading: cell fill, text, borders, alignment |
| `packages/google-adapter/src/bridge-types.ts` | Add `GoogleBridgeTableCell`, `GoogleBridgeCellBorder`, `GoogleBridgeTable`; add `table?` to element |
| `packages/google-adapter/src/providers/google-mappers.ts` | Add `mapTable`, `mapTableCell`, `normalizeVerticalAlignment`, `mapCellBorders` |
| `packages/office-adapter/src/providers/office-readonly-provider.ts` | Best-effort table read via `shape.table` API, try/catch everywhere |
| `packages/compiler-core/src/constants.ts` | Add patch ops to `SAFE_PATCH_OPS`; bump `PLAYBOOK_RULE_COUNT` 32 → 33 |
| `packages/compiler-core/src/checks.ts` | New `evaluateTableFindings()` with BP-TABLE-001, -004, -005 |
| `packages/compiler-core/tests/fixtures.ts` | Add `createTableShape()` helper |
| `packages/compiler-core/tests/track-a-slice2.test.ts` | New test file: 12+ test cases |
| `packages/google-adapter/tests/public-api.test.ts` | Table bridge-to-IR mapping test |
| `docs/RULE_CATALOG.md` | Promote 3 rules, add roadmap entry |

## Validation

After implementation, run:
```bash
npx vitest run
```

All existing tests must still pass. New tests in `track-a-slice2.test.ts` should add 12+ passing cases. Total test count should go from 269 → ~281+.
