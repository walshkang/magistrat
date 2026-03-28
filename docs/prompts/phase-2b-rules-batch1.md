# Phase 2B Batch 1: Four Straightforward Rules

These four rules need no IR extensions — all required data is already in the snapshot. Add each rule as a new function in `packages/compiler-core/src/checks.ts`, add translator entries in `finding-translator.ts`, and add tests.

---

## Rule 1: BP-TYPO-005 — Line Spacing Mismatch

**What:** Flag objects whose dominant paragraph `lineSpacing` differs from the exemplar's style map.

**Where to check:** Inside `evaluateTypographyAndStructure()`, after the bullet checks block.

**Logic:**
```ts
// Only check if style map has lineSpacing for this role
if (
  input.expected.lineSpacing !== undefined &&
  input.lineSpacing !== undefined &&
  Math.abs(input.lineSpacing - input.expected.lineSpacing) > 0.05
) {
  // Create finding + patch
}
```

**Changes needed:**

1. **`EvaluateInput` interface** — add `lineSpacing?: number | undefined` field.

2. **Call site in `runChecks`** — pass `lineSpacing: shape.paragraphs[0]?.lineSpacing` to `evaluateTypographyAndStructure`.

3. **Finding:**
   - `ruleId`: `"BP-TYPO-005"`
   - `source`: `"exemplar"`
   - `observed`: `{ lineSpacing: input.lineSpacing }`
   - `expected`: `{ lineSpacing: input.expected.lineSpacing }`
   - `evidence`: EXEMPLAR_EVIDENCE + TYPOGRAPHIC_EVIDENCE
   - `risk`: `"caution"` (line spacing changes can cause reflow)
   - `severity`: `"warn"`
   - `suggestedPatchId`: link to SET_LINE_SPACING patch

4. **Patch:**
   - `op`: `"SET_LINE_SPACING"` (already in PatchOpType)
   - `fields`: `{ lineSpacing: input.expected.lineSpacing }`
   - `risk`: `"caution"`
   - `validations`: `["no_reflow_material_change"]`

5. **Translator** (`finding-translator.ts`):
   ```ts
   "BP-TYPO-005": (f) => ({
     title: `${roleLabel(f.role)} line spacing should be ${num(f.expected.lineSpacing)}×, currently ${num(f.observed.lineSpacing)}×`,
     description: "Line spacing does not match the exemplar's style map for this role.",
     actionLabel: actionLabel(f),
     riskLabel: riskLabel(f)
   }),
   ```

---

## Rule 2: BP-COLOR-002 — Semi-Transparent Text

**What:** Flag text runs with `fontAlpha` between 0.01 and 0.95 (not fully opaque, not fully invisible). Semi-transparent text is usually accidental and causes readability issues.

**Where to check:** Inside `evaluateObjectHygiene()`, after the ghost object check.

**Logic:**
```ts
const dominantRun = shape.textRuns[0];
if (dominantRun && dominantRun.fontAlpha > 0.01 && dominantRun.fontAlpha < 0.95) {
  // Flag as semi-transparent
}
```

**Finding:**
- `ruleId`: `"BP-COLOR-002"`
- `source`: `"playbook"`
- `observed`: `{ fontAlpha: dominantRun.fontAlpha }`
- `expected`: `{ fontAlpha: 1.0 }`
- `evidence`: PLAYBOOK_EVIDENCE ("Playbook requires fully opaque text for readability.") + TYPOGRAPHIC_EVIDENCE ("Text alpha is between 1% and 95%, likely unintentional.")
- `risk`: `"manual"` (could be intentional watermark/decorative)
- `severity`: `"warn"`
- No suggested patch (manual review needed)

**Translator:**
```ts
"BP-COLOR-002": (f) => ({
  title: "Semi-transparent text detected",
  description: `Text opacity is ${Math.round((f.observed.fontAlpha as number) * 100)}%. Fully opaque (100%) is expected unless intentionally decorative.`,
  actionLabel: null,
  riskLabel: "Manual only"
}),
```

---

## Rule 3: BP-HYGIENE-002 — Off-Slide Objects

**What:** Flag objects whose geometry places them entirely or mostly outside the slide canvas. Off-slide objects are invisible in presentation mode and are usually leftover clutter.

**Where to check:** Inside `evaluateObjectHygiene()`.

**Logic:**
Slide canvas is assumed 720×405 points (standard 16:9). An object is "off-slide" if its bounding box has less than 10% area overlap with the canvas.

```ts
const canvas = { left: 0, top: 0, right: 720, bottom: 405 };
const obj = {
  left: shape.geometry.left,
  top: shape.geometry.top,
  right: shape.geometry.left + shape.geometry.width,
  bottom: shape.geometry.top + shape.geometry.height
};
const overlapLeft = Math.max(canvas.left, obj.left);
const overlapTop = Math.max(canvas.top, obj.top);
const overlapRight = Math.min(canvas.right, obj.right);
const overlapBottom = Math.min(canvas.bottom, obj.bottom);
const overlapArea = Math.max(0, overlapRight - overlapLeft) * Math.max(0, overlapBottom - overlapTop);
const objectArea = shape.geometry.width * shape.geometry.height;
const overlapRatio = objectArea > 0 ? overlapArea / objectArea : 1;

if (overlapRatio < 0.1) {
  // Flag as off-slide
}
```

**Finding:**
- `ruleId`: `"BP-HYGIENE-002"`
- `source`: `"playbook"`
- `observed`: `{ left: shape.geometry.left, top: shape.geometry.top, width: shape.geometry.width, height: shape.geometry.height, overlapRatio }`
- `expected`: `{ minOverlapRatio: 0.1 }`
- `evidence`: PLAYBOOK_EVIDENCE + GEOMETRIC_EVIDENCE ("Object bounding box is <10% within the slide canvas.")
- `risk`: `"manual"` (might be intentional bleed)
- `severity`: `"warn"`
- No suggested patch

**Translator:**
```ts
"BP-HYGIENE-002": (f) => ({
  title: "Object is off-slide",
  description: `This element is mostly outside the visible slide area (${Math.round((f.observed.overlapRatio as number) * 100)}% visible). It won't appear during presentation.`,
  actionLabel: null,
  riskLabel: "Manual only"
}),
```

---

## Rule 4: BP-BULLET-002 — Bullet Glyph Mismatch

**What:** Flag bullet items whose glyph character differs from the exemplar. E.g., the exemplar uses "•" but the slide uses "–" or "▸".

**Where to check:** Inside `evaluateTypographyAndStructure()`, within the existing bullet checks block (alongside BP-BULLET-001).

**Logic:**
```ts
// Add after the indent/hanging check, still inside `if (hasBulletExpectation && !input.skipBulletChecks)`
if (
  input.expected.bulletGlyph !== undefined &&
  input.bulletGlyph !== undefined &&
  input.expected.bulletGlyph !== input.bulletGlyph
) {
  // Create finding — no auto-patch (glyph setting is manual in Slides API)
}
```

**Changes needed:**

1. **`RoleStyleTokens`** in `packages/shared-types/src/state.ts` — add `bulletGlyph?: string | undefined`.

2. **`buildStyleMap`** — extract `bulletGlyph` from the exemplar slide's paragraphs for bullet roles, same as it does for `bulletIndent`/`bulletHanging`.

3. **`EvaluateInput` interface** — add `bulletGlyph?: string | undefined`.

4. **Call site in `runChecks`** — pass `bulletGlyph: shape.paragraphs[0]?.bulletGlyph`.

5. **Finding:**
   - `ruleId`: `"BP-BULLET-002"`
   - `source`: `"exemplar"`
   - `observed`: `{ bulletGlyph: input.bulletGlyph }`
   - `expected`: `{ bulletGlyph: input.expected.bulletGlyph }`
   - `evidence`: EXEMPLAR_EVIDENCE + STRUCTURAL_EVIDENCE
   - `risk`: `"manual"` (Slides API doesn't support glyph writes reliably)
   - `severity`: `"info"`

6. **Translator:**
   ```ts
   "BP-BULLET-002": (f) => ({
     title: `${roleLabel(f.role)} bullet glyph should be "${str(f.expected.bulletGlyph)}", currently "${str(f.observed.bulletGlyph)}"`,
     description: "Bullet character does not match the exemplar. Change manually in Google Slides.",
     actionLabel: null,
     riskLabel: "Manual only"
   }),
   ```

---

## Files to modify

- `packages/compiler-core/src/checks.ts` — add 4 rules (BP-TYPO-005, BP-COLOR-002, BP-HYGIENE-002, BP-BULLET-002)
- `packages/compiler-core/src/finding-translator.ts` — add 4 translator entries
- `packages/shared-types/src/state.ts` — add `bulletGlyph` to `RoleStyleTokens`
- `packages/compiler-core/src/style-map.ts` — extract `bulletGlyph` from exemplar

## Files to create

- `packages/compiler-core/tests/checks-batch1.test.ts` — tests for all 4 new rules

## Tests per rule

Each rule needs at minimum:
1. **Positive case** — condition triggers, finding is created
2. **Negative case** — condition does not trigger, no finding
3. **Edge case** — boundary values (e.g., alpha exactly 0.95, overlap exactly 0.1)

## Done when
- All 4 rules fire correctly in `runChecks`
- Translator returns human-readable strings for each
- Tests pass for all positive/negative/edge cases
- Existing tests still pass (no regressions)
- Total rule count: 12 (was 8 + continuity)
