# Phase 2B Batch 2: Four Complex Rules

These rules require new algorithms or multi-run analysis. Implement after Batch 1 is verified.

---

## Rule 5: BP-TYPO-004 — Mixed Font Families (Multi-Run)

**What:** Flag objects where text runs use more than one font family. A shape with "Arial" and "Calibri" runs mixed together is almost always accidental (paste artifacts).

**Where to check:** New function `evaluateMultiRunTypography()` called from the main loop in `runChecks`, after `evaluateObjectHygiene` and before the single-run typography checks. This runs on ALL analyzed shapes with `textRuns.length > 1`.

**Logic:**
```ts
function evaluateMultiRunTypography(
  slideId: string,
  objectId: string,
  shape: ShapeSnapshot
): Finding[] {
  if (shape.textRuns.length <= 1) return [];

  const families = new Set(shape.textRuns.map(r => r.fontFamily));
  if (families.size <= 1) return [];

  // Flag: multiple font families in same shape
  return [/* finding */];
}
```

**Finding:**
- `ruleId`: `"BP-TYPO-004"`
- `source`: `"playbook"`
- `observed`: `{ fontFamilies: [...families] }`
- `expected`: `{ maxDistinctFamilies: 1 }`
- `evidence`: PLAYBOOK_EVIDENCE ("Multiple font families in a single text box is typically unintentional.") + TYPOGRAPHIC_EVIDENCE ("Found N distinct families: ...")
- `risk`: `"manual"` (unclear which family is correct)
- `severity`: `"warn"`
- No suggested patch (which family to keep is ambiguous)

**Translator:**
```ts
"BP-TYPO-004": (f) => {
  const families = (f.observed.fontFamilies as string[]) ?? [];
  return {
    title: "Mixed font families in one text box",
    description: `Found ${families.length} fonts: ${families.join(", ")}. This is usually a paste artifact.`,
    actionLabel: null,
    riskLabel: "Manual only"
  };
},
```

---

## Rule 6: BP-COLOR-003 — Callout Fill Palette

**What:** For shapes with role `CALLOUT`, check that the shape's fill color belongs to an approved palette derived from the exemplar. This prevents random background colors on callout boxes.

**Design note:** This is the first rule that checks shape-level properties beyond text runs. The IR doesn't currently carry `fillColor` on `ShapeSnapshot`.

**IR Extension needed:**
In `packages/shared-types/src/ir.ts`, add to `ShapeSnapshot`:
```ts
fillColor?: string | undefined;
fillAlpha?: number | undefined;
```

In `packages/google-adapter/src/providers/google-mappers.ts` (or equivalent), extract fill color from the Google Slides API shape properties and map to the IR.

**Palette construction:**
In `buildStyleMap`, when processing a CALLOUT role shape, also capture `fillColor` if present. Add to `RoleStyleTokens`:
```ts
fillColor?: string | undefined;
```

**Where to check:** Inside `evaluateTypographyAndStructure()`, gated on `role === "CALLOUT"` and both expected and observed fillColor being present.

**Logic:**
```ts
if (
  input.role === "CALLOUT" &&
  input.expected.fillColor !== undefined &&
  input.fillColor !== undefined &&
  input.fillColor !== input.expected.fillColor
) {
  // Flag: callout fill doesn't match exemplar
}
```

**Finding:**
- `ruleId`: `"BP-COLOR-003"`
- `source`: `"exemplar"`
- `observed`: `{ fillColor: input.fillColor }`
- `expected`: `{ fillColor: input.expected.fillColor }`
- `evidence`: EXEMPLAR_EVIDENCE + TYPOGRAPHIC_EVIDENCE ("Callout background color differs from exemplar.")
- `risk`: `"manual"` (fill changes can be visually disruptive)
- `severity`: `"warn"`
- No suggested patch in v1 (fill color write not yet in SAFE provider)

**Translator:**
```ts
"BP-COLOR-003": (f) => ({
  title: `Callout fill color should be ${str(f.expected.fillColor)}, currently ${str(f.observed.fillColor)}`,
  description: "Callout background color does not match the exemplar's palette.",
  actionLabel: null,
  riskLabel: "Manual only"
}),
```

---

## Rule 7: BP-HYGIENE-003 — Duplicate Overlapping Objects (IOU)

**What:** Flag pairs of objects on the same slide that overlap significantly (IOU > 0.8) and have similar text content. These are usually copy-paste duplicates stacked on top of each other.

**Where to check:** New function `evaluateDuplicateOverlaps()` called once per slide (not per shape) in `runChecks`, after the per-shape loop.

**IOU Algorithm:**
```ts
function computeIOU(a: GeometrySnapshot, b: GeometrySnapshot): number {
  const aRight = a.left + a.width;
  const aBottom = a.top + a.height;
  const bRight = b.left + b.width;
  const bBottom = b.top + b.height;

  const interLeft = Math.max(a.left, b.left);
  const interTop = Math.max(a.top, b.top);
  const interRight = Math.min(aRight, bRight);
  const interBottom = Math.min(aBottom, bBottom);

  const interArea = Math.max(0, interRight - interLeft) * Math.max(0, interBottom - interTop);
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  const unionArea = aArea + bArea - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}
```

**Text similarity:** Simple check — normalize both shapes' text content (lowercase, collapse whitespace) and compare. If identical or one is a substring of the other, AND IOU > 0.8, flag as duplicate.

**Logic (per slide):**
```ts
function evaluateDuplicateOverlaps(slide: SlideSnapshot): Finding[] {
  const findings: Finding[] = [];
  const shapes = slide.shapes.filter(s => s.supportedForAnalysis);

  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const iou = computeIOU(shapes[i].geometry, shapes[j].geometry);
      if (iou < 0.8) continue;

      const textA = normalizeText(shapes[i]);
      const textB = normalizeText(shapes[j]);
      if (textA.length === 0 && textB.length === 0) continue;
      if (textA !== textB && !textA.includes(textB) && !textB.includes(textA)) continue;

      // Flag the higher-z-index shape as the probable duplicate
      const duplicate = shapes[i].zIndex > shapes[j].zIndex ? shapes[i] : shapes[j];
      findings.push(/* ... */);
    }
  }
  return findings;
}
```

**Finding:**
- `ruleId`: `"BP-HYGIENE-003"`
- `source`: `"playbook"`
- `observed`: `{ objectId: duplicate.objectId, iou, pairedObjectId: original.objectId }`
- `expected`: `{ noDuplicateOverlaps: true }`
- `evidence`: PLAYBOOK_EVIDENCE ("Overlapping objects with identical content suggest a copy-paste duplicate.") + GEOMETRIC_EVIDENCE (`IOU: ${iou.toFixed(2)}`)
- `risk`: `"manual"` (user must confirm which to delete)
- `severity`: `"warn"`
- No suggested patch (deletion is destructive)

**Translator:**
```ts
"BP-HYGIENE-003": (f) => ({
  title: "Possible duplicate object",
  description: `This element overlaps another with identical content (${Math.round((f.observed.iou as number) * 100)}% overlap). One is likely a copy-paste duplicate.`,
  actionLabel: null,
  riskLabel: "Manual only"
}),
```

---

## Rule 8: BP-HYGIENE-005 — Proofing Language

**What:** Flag text runs where `proofingLanguage` is set to something unexpected (e.g., "zh-CN" when the deck is predominantly English). Mixed proofing languages cause spell-check to behave erratically.

**Where to check:** New function `evaluateProofingLanguage()` called per shape in `runChecks`.

**Logic:**
1. First pass: determine the deck's dominant proofing language by counting occurrences across all text runs.
2. Second pass: flag any shape whose dominant run has a different proofing language.

Since this is a deck-level analysis, compute the dominant language once before the per-shape loop in `runChecks`, then pass it to the per-shape check.

```ts
// Before the main loop in runChecks:
const dominantLanguage = computeDominantProofingLanguage(deck);

// Per shape:
function evaluateProofingLanguage(
  slideId: string,
  objectId: string,
  shape: ShapeSnapshot,
  dominantLanguage: string | null
): Finding[] {
  if (!dominantLanguage) return [];

  const run = shape.textRuns[0];
  if (!run?.proofingLanguage) return [];
  if (run.proofingLanguage === dominantLanguage) return [];

  // Flag: proofing language mismatch
  return [/* finding */];
}
```

**Finding:**
- `ruleId`: `"BP-HYGIENE-005"`
- `source`: `"playbook"`
- `observed`: `{ proofingLanguage: run.proofingLanguage }`
- `expected`: `{ proofingLanguage: dominantLanguage }`
- `evidence`: PLAYBOOK_EVIDENCE ("Inconsistent proofing language causes spell-check issues.") + HYGIENE_EVIDENCE ("Element language differs from deck-dominant language.")
- `risk`: `"safe"` (language tag changes are non-destructive)
- `severity`: `"info"`
- `suggestedPatchId`: link to NORMALIZE_LANGUAGE_TAGS patch

**Patch:**
- `op`: `"NORMALIZE_LANGUAGE_TAGS"` (already in PatchOpType)
- `fields`: `{ proofingLanguage: dominantLanguage }`
- `risk`: `"safe"`

**Translator:**
```ts
"BP-HYGIENE-005": (f) => ({
  title: `Proofing language is ${str(f.observed.proofingLanguage)}, deck uses ${str(f.expected.proofingLanguage)}`,
  description: "Mismatched proofing language causes incorrect spell-check behavior. Safe to normalize.",
  actionLabel: actionLabel(f),
  riskLabel: riskLabel(f)
}),
```

---

## IR Extensions Summary

Only one IR extension needed (for BP-COLOR-003):
- `ShapeSnapshot`: add `fillColor?: string`, `fillAlpha?: number`
- Google adapter mapper: extract fill from shape properties

## Style Map Extensions

- `RoleStyleTokens`: add `bulletGlyph?: string` (for Batch 1 BP-BULLET-002) and `fillColor?: string` (for BP-COLOR-003)
- `buildStyleMap`: extract `bulletGlyph` from exemplar paragraphs, `fillColor` from exemplar shapes with CALLOUT role

## Files to modify

- `packages/shared-types/src/ir.ts` — add `fillColor`, `fillAlpha` to ShapeSnapshot
- `packages/shared-types/src/state.ts` — add `fillColor` to RoleStyleTokens (bulletGlyph already handled in Batch 1)
- `packages/compiler-core/src/checks.ts` — add 4 rules + IOU utility + dominant language utility
- `packages/compiler-core/src/finding-translator.ts` — add 4 translator entries
- `packages/compiler-core/src/style-map.ts` — extract `fillColor` for CALLOUT role
- `packages/google-adapter/src/providers/google-mappers.ts` — map fill color from Slides API

## Files to create

- `packages/compiler-core/tests/checks-batch2.test.ts` — tests for all 4 new rules
- `packages/compiler-core/src/iou.ts` — IOU computation (export for reuse and testability)

## Tests per rule

Each rule needs:
1. **Positive case** — finding created
2. **Negative case** — no finding
3. **Edge case** — boundary (IOU exactly 0.8, alpha exactly 0.95, etc.)

BP-HYGIENE-003 (IOU) additionally needs:
- Same position but different text → no finding
- Same text but low overlap → no finding
- Multiple duplicates on one slide → one finding per pair

BP-HYGIENE-005 (proofing) additionally needs:
- Deck with all same language → no findings
- Deck with no proofing language data → no findings
- Shape matching dominant language → no finding

## Done when
- 8 new rules total (4 from Batch 1 + 4 from Batch 2) bringing total to 16
- All translator entries return human-readable output
- All tests pass, no regressions
- `compiler-core` coverage ≥ 85%
