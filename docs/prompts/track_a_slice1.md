# Cursor Prompt: Track A Slice 1 — IR Extensions (Alignment + Border)

> Paste this into Cursor Composer. Extends the IR, both adapters, the GAS bridge, the style map, and adds 2 new rules.

---

## Context

Magistrat's IR (`DeckSnapshot`) currently lacks paragraph alignment and shape border data. This slice adds those two fields end-to-end: GAS bridge → bridge types → Google mapper → IR → Office adapter → style map → exemplar inference → rules → tests.

**This is a vertical slice:** IR extension + adapter extraction + style map propagation + rule implementation, all in one pass. The rules prove the extension works.

---

## Part 1 — IR Extensions

### File: `packages/shared-types/src/ir.ts`

**ParagraphSnapshot** — add an optional `alignment` field:
```typescript
export interface ParagraphSnapshot {
  level: 0 | 1 | 2 | 3 | 4;
  bulletIndent?: number;
  bulletHanging?: number;
  bulletGlyph?: string;
  lineSpacing?: number;
  alignment?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";  // ← NEW
  text: string;
}
```

**ShapeSnapshot** — add optional `lineColor` and `lineWidth` fields:
```typescript
export interface ShapeSnapshot {
  // ... existing fields ...
  /** Shape border/outline color when present; hex #RRGGBB */
  lineColor?: string | undefined;
  /** Shape border/outline width in points; 0 or absent = no border */
  lineWidth?: number | undefined;
  // ... rest of existing fields ...
}
```

Place `lineColor` and `lineWidth` right after `fillAlpha`.

---

## Part 2 — GAS Bridge Extension

### File: `apps/slides-addon/gas/Code.gs`

#### 2a. Extract paragraph alignment

In `extractTextInfo()`, add alignment extraction for each paragraph:

```javascript
var paras = textRange.getParagraphs();
for (var j = 0; j < paras.length; j++) {
  var para = paras[j];
  var paraStyle = para.getRange().getParagraphStyle();

  // Alignment extraction — NEW
  var alignment = undefined;
  try {
    var rawAlignment = paraStyle.getParagraphAlignment();
    if (rawAlignment) {
      var alignStr = rawAlignment.toString();
      if (alignStr === 'START') alignment = 'LEFT';
      else if (alignStr === 'CENTER') alignment = 'CENTER';
      else if (alignStr === 'END') alignment = 'RIGHT';
      else if (alignStr === 'JUSTIFIED') alignment = 'JUSTIFIED';
    }
  } catch (e) {
    // Alignment not available — skip
  }

  paragraphs.push({
    level: paraStyle.getIndentStart() ? 1 : 0,
    lineSpacing: paraStyle.getLineSpacing(),
    alignment: alignment,  // ← NEW (undefined if not available)
    text: para.getRange().asString(),
  });
}
```

**Important:** Google Apps Script returns alignment as `SlidesApp.ParagraphAlignment` enum: `START`, `CENTER`, `END`, `JUSTIFIED`. Map `START` → `LEFT` and `END` → `RIGHT` for IR normalization.

#### 2b. Extract shape border/line

In `readPresentation()`, inside the `if (el.getPageElementType() === SlidesApp.PageElementType.SHAPE)` block, after the fill extraction, add border extraction:

```javascript
// Border/line extraction — NEW
try {
  var border = shape.getBorder();
  if (border) {
    var weight = border.getWeight();
    if (weight > 0) {
      element.lineWidth = weight;
      try {
        var lineFill = border.getLineFill();
        if (lineFill && lineFill.getSolidFill()) {
          element.lineColor = lineFill.getSolidFill().getColor().asRgbColor().asHexString();
        }
      } catch (e) {
        // Theme line color can't be converted — skip
      }
    }
  }
} catch (e) {
  // Border not available on this shape type — skip
}
```

---

## Part 3 — Bridge Types

### File: `packages/google-adapter/src/bridge-types.ts`

**GoogleBridgeParagraph** — add optional `alignment`:
```typescript
export interface GoogleBridgeParagraph {
  level: number;
  bulletIndent?: number;
  bulletHanging?: number;
  bulletGlyph?: string;
  lineSpacing?: number;
  alignment?: string;  // ← NEW: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED"
  text: string;
}
```

**GoogleBridgePageElement** — add optional `lineColor` and `lineWidth`:
```typescript
export interface GoogleBridgePageElement {
  // ... existing fields ...
  fillColor?: string;
  fillAlpha?: number;
  lineColor?: string;    // ← NEW
  lineWidth?: number;    // ← NEW
  // ... rest ...
}
```

---

## Part 4 — Google Mapper

### File: `packages/google-adapter/src/providers/google-mappers.ts`

In `mapPageElement()`:

**4a. Paragraph alignment** — in the `paragraphs.map()` callback, add alignment:
```typescript
paragraphs: paragraphs.map((paragraph) => ({
  level: normalizeLevel(paragraph.level),
  text: paragraph.text,
  ...(typeof paragraph.bulletIndent === "number" ? { bulletIndent: paragraph.bulletIndent } : {}),
  ...(typeof paragraph.bulletHanging === "number" ? { bulletHanging: paragraph.bulletHanging } : {}),
  ...(typeof paragraph.lineSpacing === "number" ? { lineSpacing: paragraph.lineSpacing } : {}),
  ...(typeof paragraph.bulletGlyph === "string" ? { bulletGlyph: paragraph.bulletGlyph } : {}),
  ...(normalizeAlignment(paragraph.alignment) ? { alignment: normalizeAlignment(paragraph.alignment) } : {})  // ← NEW
})),
```

Add a `normalizeAlignment` helper:
```typescript
function normalizeAlignment(raw: string | undefined): "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" | undefined {
  if (!raw) return undefined;
  const normalized = raw.toUpperCase();
  if (normalized === "LEFT" || normalized === "START") return "LEFT";
  if (normalized === "CENTER") return "CENTER";
  if (normalized === "RIGHT" || normalized === "END") return "RIGHT";
  if (normalized === "JUSTIFIED") return "JUSTIFIED";
  return undefined;
}
```

**4b. Line color/width** — in the returned shape object, add after `fillAlpha`:
```typescript
...(typeof element.lineColor === "string" ? { lineColor: normalizeColor(element.lineColor) } : {}),
...(typeof element.lineWidth === "number" && element.lineWidth > 0 ? { lineWidth: element.lineWidth } : {}),
```

---

## Part 5 — Office Adapter

### File: `packages/office-adapter/src/providers/office-readonly-provider.ts`

**5a. Paragraph alignment** — Office.js TextRange doesn't expose per-paragraph alignment in current API sets. For now, do NOT attempt to extract alignment in the Office adapter. The field will simply be absent (undefined) on Office-produced snapshots. This is acceptable — rules that depend on alignment should check for its presence.

**5b. Line color/width** — Office.js shapes expose `lineFormat` properties. In the `readDeckSnapshot` function:

In the shape load call (around line 153), add fill and line properties:
```typescript
entry.shape.load("id,name,type,visible,left,top,width,height,rotation,zOrderPosition,fill/foregroundColor,lineFormat/color,lineFormat/weight");
```

**BUT:** Office.js load syntax for nested properties can be fragile. If `fill/foregroundColor` or `lineFormat/color` throws at load time, catch and skip. Use a separate try-catch block:

In `mapShape()`, after computing the base shape, attempt to read line properties:

Add to the `ShapeLike` interface:
```typescript
interface ShapeLike {
  // ... existing ...
  fill?: { foregroundColor?: string | null } | null;
  lineFormat?: { color?: string | null; weight?: number | null } | null;
}
```

In the shape load, add fill and line to the load string. If Office.js doesn't support these properties (varies by API version), wrap in try/catch and degrade gracefully.

In `mapShape()`, add after geometry extraction:
```typescript
// Line color/width — if available from Office.js
const lineFormat = entry.shape.lineFormat;
const lineWeight = typeof lineFormat?.weight === "number" ? lineFormat.weight : 0;
const lineColorRaw = typeof lineFormat?.color === "string" ? lineFormat.color : undefined;
```

Then in the returned object, add after `fillAlpha` (or after `zIndex` if no fillAlpha):
```typescript
...(lineWeight > 0 && lineColorRaw ? { lineColor: normalizeColor(lineColorRaw), lineWidth: lineWeight } : {}),
```

**Also extract shape fill** (currently missing from Office adapter!):
```typescript
const shapeFill = entry.shape.fill;
const shapeFillColor = typeof shapeFill?.foregroundColor === "string" ? shapeFill.foregroundColor : undefined;
```
Add to returned object:
```typescript
...(shapeFillColor ? { fillColor: normalizeColor(shapeFillColor) } : {}),
```

**Important:** If any of the Office.js property loads fail (API version limitation), catch the error at the load level and skip those properties entirely. Don't let a missing `lineFormat` crash the entire snapshot read. Consider wrapping the extended load in a try/catch and falling back to the basic load string.

---

## Part 6 — Style Map Extension

### File: `packages/shared-types/src/state.ts`

Add `alignment` to `RoleStyleTokens`:
```typescript
export interface RoleStyleTokens {
  fontFamily: string;
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  fontColor: string;
  lineSpacing?: number | undefined;
  bulletIndent?: number | undefined;
  bulletHanging?: number | undefined;
  bulletGlyph?: string | undefined;
  fillColor?: string | undefined;
  alignment?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" | undefined;  // ← NEW
  // ... existing geometry fields ...
}
```

### File: `packages/compiler-core/src/style-map.ts`

In `buildStyleMap()`, when constructing `baseTokens`, add alignment from the dominant paragraph:
```typescript
const baseTokens: RoleStyleTokens = {
  fontFamily: dominant.fontFamily,
  fontSizePt: dominant.fontSizePt,
  bold: dominant.bold,
  italic: dominant.italic,
  fontColor: dominant.fontColor,
  lineSpacing: shape.paragraphs[0]?.lineSpacing,
  bulletIndent: shape.paragraphs[0]?.bulletIndent,
  bulletHanging: shape.paragraphs[0]?.bulletHanging,
  bulletGlyph: shape.paragraphs[0]?.bulletGlyph,
  alignment: selectDominantAlignment(shape.paragraphs),  // ← NEW
  ...(role === "CALLOUT" && shape.fillColor !== undefined ? { fillColor: shape.fillColor } : {})
};
```

Add a helper to pick the most common alignment:
```typescript
function selectDominantAlignment(
  paragraphs: Array<{ alignment?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" }>
): "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" | undefined {
  const counts = new Map<string, number>();
  for (const p of paragraphs) {
    if (p.alignment) {
      counts.set(p.alignment, (counts.get(p.alignment) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return undefined;
  let best: string | undefined;
  let bestCount = 0;
  for (const [alignment, count] of counts) {
    if (count > bestCount) {
      best = alignment;
      bestCount = count;
    }
  }
  return best as "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" | undefined;
}
```

In `normalizeTokens()`, pass through alignment (no normalization needed — it's an enum):
```typescript
function normalizeTokens(tokens: RoleStyleTokens): RoleStyleTokens {
  return {
    ...tokens,
    // ... existing normalization ...
    alignment: tokens.alignment,  // ← NEW (pass-through)
  };
}
```

---

## Part 7 — Exemplar Inference Extension

### File: `packages/compiler-core/src/infer-rules.ts`

If `inferCandidateRules` derives rules from the style map, ensure it handles the new `alignment` token. Check if `alignment` needs to generate a `BP-TYPO-012` candidate rule. If the inference engine uses a list of token keys to produce candidates, add `alignment` to that list. If it's a fixed mapping, add:
- `alignment` → candidate for `BP-TYPO-012`

---

## Part 8 — New Rules

### 8a. BP-TYPO-012 — Text Alignment Mismatch

**File:** `packages/compiler-core/src/checks.ts`
**Source:** `"exemplar"` | **Severity:** `"warn"` | **Risk:** `"safe"` | **Coverage:** `ANALYZED`

For each shape where `supportedForAnalysis === true` and `shape.inferredRole` matches a role in the style map AND `styleMap[role].alignment` is defined:

1. Get the dominant alignment of the shape's paragraphs (same `selectDominantAlignment` logic — factor it into a shared utility or import from style-map).
2. If the shape's dominant alignment differs from `styleMap[role].alignment`, emit a finding.

Skip shapes where:
- No paragraphs have an `alignment` value (Office adapter — data not available)
- The style map entry for that role has no `alignment` (exemplar didn't have alignment data)

Emit one finding per shape. `slideId` = the slide, `objectId` = the shape. Include `observed.alignment`, `expected.alignment`, and `observed.role` in the finding.

**Evidence:**
1. `EXEMPLAR_EVIDENCE` — "Text alignment differs from exemplar style for this role."
2. `TYPOGRAPHIC_EVIDENCE` — "Mismatched alignment creates visual dissonance — e.g., center-aligned body in a left-aligned deck."

**Auto-fix patch op:** `SET_TEXT_ALIGNMENT` — add this to the patch op union type in `packages/shared-types/src/patches.ts`. Fields: `{ alignment: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" }`. Risk: `"safe"`. Add to the safe-ops list in `packages/compiler-core/src/constants.ts`.

**Note:** Do NOT implement the actual patch application in either adapter yet (no write-side changes). Just emit the PatchOp suggestion — it will be a no-op at apply time until the adapters add write support. This matches the existing pattern for ops like SET_BULLET_INDENT in the Office adapter.

### 8b. BP-COLOR-004 — Shape Border Off Palette

**File:** `packages/compiler-core/src/checks.ts`
**Source:** `"playbook"` | **Severity:** `"warn"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

For each shape where `shape.lineColor` is defined and `shape.lineWidth > 0`:

1. Check if `shape.lineColor` appears in the exemplar's known color set. The "palette" for v1 = all unique `fontColor` values + all unique `fillColor` values across all roles in the style map. (This is the same approach used by BP-COLOR-003 — follow that rule's palette logic exactly.)
2. If the border color is NOT in the palette, emit a finding.

Skip shapes where `lineColor` is undefined or `lineWidth` is 0/undefined.

Emit one finding per shape. `slideId` = the slide, `objectId` = the shape. Include `observed.lineColor`, `observed.lineWidth`, and `expected.palette` (array of hex strings) in the finding.

**Evidence:**
1. `PLAYBOOK_EVIDENCE` — "Shape border color is not in the slide style palette."
2. `COLOR_EVIDENCE` — "Off-palette borders are a common oversight — authors fix fill colors but forget the 1pt default outline."

**ToleranceConfig:** No new fields needed (uses existing color matching logic).

---

## Part 9 — Tests

Create `packages/compiler-core/tests/track-a-slice1.test.ts`. Follow the patterns from `phase8b-rules.test.ts`.

### BP-TYPO-012 tests:
- **Happy path:** shape with LEFT alignment, exemplar expects CENTER → finding emitted with correct ruleId `BP-TYPO-012`, severity `warn`
- **Negative:** shape alignment matches exemplar → no finding
- **Edge: no alignment data** — paragraphs have no `alignment` field → no finding (graceful skip)
- **Edge: style map has no alignment** — exemplar role has no `alignment` token → no finding
- **Edge: mixed alignment in shape** — majority wins, compared against exemplar

### BP-COLOR-004 tests:
- **Happy path:** shape with `lineColor: "#FF0000"` and `lineWidth: 1`, palette = `["#112233", "#445566"]` → finding emitted
- **Negative:** `lineColor` is in the palette → no finding
- **Edge: no lineColor** — shape has no border → no finding
- **Edge: lineWidth is 0** — border present but zero-width → no finding

### Mapper tests (optional but recommended):
Add a test in `packages/google-adapter/tests/public-api.test.ts` that verifies the bridge → IR mapping for the new fields:
- Shape with `lineColor` and `lineWidth` in bridge data → mapped correctly to ShapeSnapshot
- Paragraph with `alignment: "LEFT"` in bridge data → mapped correctly to ParagraphSnapshot

To do this, extend `createBasePresentation()` to include the new fields and add assertions.

---

## Part 10 — PLAYBOOK_RULE_COUNT

BP-TYPO-012 is `source: "exemplar"` — does NOT count.
BP-COLOR-004 is `source: "playbook"` — counts as +1.

Update `PLAYBOOK_RULE_COUNT` in `packages/compiler-core/src/constants.ts`: **31 → 32**.

---

## Part 11 — RULE_CATALOG.md

Update `docs/RULE_CATALOG.md`:
- Change BP-TYPO-012 status from `proposed` → `active`
- Change BP-COLOR-004 status from `proposed` → `active`
- Add a new section in the Implementation Roadmap:

```markdown
### Track A Slice 1 — IR Extensions (2026-03-31)
Extended IR with `ParagraphSnapshot.alignment` and `ShapeSnapshot.lineColor/lineWidth`.
Both adapters updated. Unblocks:
- **BP-TYPO-012** — Text Alignment Mismatch
- **BP-COLOR-004** — Shape Border Off Palette
```

---

## Summary of files to modify

| File | Changes |
|---|---|
| `packages/shared-types/src/ir.ts` | Add `alignment` to ParagraphSnapshot, `lineColor`/`lineWidth` to ShapeSnapshot |
| `packages/shared-types/src/state.ts` | Add `alignment` to RoleStyleTokens |
| `packages/shared-types/src/patches.ts` | Add `SET_TEXT_ALIGNMENT` op |
| `packages/shared-types/src/findings.ts` | No new EvidenceTypes needed (EXEMPLAR, TYPOGRAPHIC, PLAYBOOK, COLOR all exist) |
| `apps/slides-addon/gas/Code.gs` | Extract alignment from ParagraphStyle, border from shape.getBorder() |
| `packages/google-adapter/src/bridge-types.ts` | Add `alignment` to GoogleBridgeParagraph, `lineColor`/`lineWidth` to GoogleBridgePageElement |
| `packages/google-adapter/src/providers/google-mappers.ts` | Map alignment + normalizeAlignment helper, map lineColor/lineWidth |
| `packages/office-adapter/src/providers/office-readonly-provider.ts` | Add lineFormat + fill load, map to IR. Alignment: skip (not available) |
| `packages/compiler-core/src/style-map.ts` | Extract dominant alignment into RoleStyleTokens |
| `packages/compiler-core/src/infer-rules.ts` | Handle alignment token in candidate rule inference (if applicable) |
| `packages/compiler-core/src/checks.ts` | BP-TYPO-012 + BP-COLOR-004 |
| `packages/compiler-core/src/constants.ts` | PLAYBOOK_RULE_COUNT 31 → 32, add SET_TEXT_ALIGNMENT to safe ops |
| `packages/google-adapter/tests/public-api.test.ts` | Extend bridge test fixtures with new fields |
| `packages/compiler-core/tests/track-a-slice1.test.ts` | New test file for both rules |
| `docs/RULE_CATALOG.md` | Status updates + roadmap section |
