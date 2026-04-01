# Cursor Prompt: Phase 8B — New Rules (No IR Changes Required)

> Paste this into Cursor Composer. All 6 rules are implementable against the existing data model.

---

## Context

You're implementing 6 new compliance rules for Magistrat, a deterministic slide compliance checker for Google Slides / PowerPoint.

**Key files:**
- `packages/compiler-core/src/checks.ts` — per-object rules (playbook/exemplar)
- `packages/compiler-core/src/continuity.ts` — cross-slide rules
- `packages/shared-types/src/ir.ts` — `DeckSnapshot`, `SlideSnapshot`, `ShapeSnapshot`, `ParagraphSnapshot`, `TextRunSnapshot`
- `packages/shared-types/src/findings.ts` — `Finding`, `Evidence`, `EvidenceType`, `Severity`, `Risk`
- `packages/shared-types/src/tolerance.ts` — `ToleranceConfig`, `defaultToleranceConfig()`
- `packages/compiler-core/tests/phase8a-rules.test.ts` — most recent test patterns to follow
- `packages/compiler-core/tests/continuity.test.ts` — continuity test patterns
- `packages/compiler-core/tests/layout-rules.test.ts` — layout test patterns

**Patterns to follow exactly:**
- Finding IDs: `` `finding-${stableHash([slideId, objectId, "rule_key"])}` ``
- Evidence: always 2 items — one for WHY the rule exists, one for WHAT was observed
- Every finding needs: `id`, `ruleId`, `source`, `slideId`, `observed`, `expected`, `evidence`, `confidence`, `risk`, `severity`, `coverage: "ANALYZED"`
- New `EvidenceType` values need to be added to the `EVIDENCE_TYPES` const array in `findings.ts`
- New `ToleranceConfig` fields go in the interface AND `defaultToleranceConfig()`
- Tests live alongside existing tests in `packages/compiler-core/tests/`

---

## Rules to Implement

### 1. BP-TYPO-009 — Bullet Punctuation Consistency
**File:** `continuity.ts` (add as a new check in `runContinuityChecks`)
**Source:** `"continuity"` | **Severity:** `"warn"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

Scan terminal characters of **level-0 bullet items** (paragraphs with `bulletLevel === 0` or `nestingLevel === 0`) within each text block, across all slides. Ignore sub-bullets (level ≥ 1 — they legitimately follow different rules). Ignore shapes with fewer than 2 bullet items (no meaningful signal).

Classify each bullet's terminal character:
- `"PERIOD"` — ends with `.`
- `"NONE"` — ends with a word character (no punctuation)
- `"OTHER"` — ends with `:`, `;`, `!`, `?`, etc.

**Per text box, majority-vote:** if a text box has a mix of `PERIOD` and `NONE`, flag the minority items within that box. If all items share the same terminal style, no finding for that box.

**Deck-wide, majority-vote:** if the majority terminal style across all boxes is clearly `PERIOD` or `NONE`, flag any box whose dominant style is the opposite. Threshold: deck majority must be ≥ 60% of classifiable boxes.

Emit one finding per non-conforming text box. `slideId` = the slide where the box lives. `objectId` = the shape. Include `observed.terminalStyle`, `expected.dominantStyle`, and `observed.sampleText` (first offending bullet text, max 80 chars) in the finding.

**Evidence:**
1. `STRUCTURAL_EVIDENCE` — "Bullet terminal punctuation differs from the dominant convention in this text block."
2. `TEXT_STRING_EVIDENCE` — "Mixed terminal punctuation signals copy-paste from multiple authors."

---

### 2. BP-TYPO-010 — Double Space Detection
**File:** `checks.ts` (add to the per-shape check block, near BP-HYGIENE-004 and BP-HYGIENE-006)
**Source:** `"playbook"` | **Severity:** `"info"` | **Risk:** `"safe"` | **Coverage:** `ANALYZED`

Scan each `TextRunSnapshot.text` for two or more consecutive space characters (regex: `/ {2,}/`). If any match is found, emit one finding per shape (not per occurrence). Include the first matched excerpt (up to 40 chars of context around the double space) in `observed`.

**Evidence:**
1. `PLAYBOOK_EVIDENCE` — "Double or multiple consecutive spaces found in text."
2. `TEXT_STRING_EVIDENCE` — "Double spaces break text justification and alignment; an outdated typist convention."

**ToleranceConfig:** No new fields needed.

---

### 3. BP-TYPO-011 — Title Terminal Punctuation
**File:** `checks.ts` (add to the per-shape check block, after BP-HYGIENE-006)
**Source:** `"playbook"` | **Severity:** `"warn"` | **Risk:** `"safe"` | **Coverage:** `ANALYZED`

For shapes where `shape.inferredRole === "TITLE"`: concatenate all paragraph text, trim whitespace. If the result ends with a period (`.`), emit a finding. **Skip** if the result ends with `?` or `!` (these are acceptable exceptions).

`slideId` = the slide, `objectId` = the shape. Include the full title text (max 120 chars) in `observed`.

**Evidence:**
1. `PLAYBOOK_EVIDENCE` — "Action title ends with a terminal period."
2. `TEXT_STRING_EVIDENCE` — "Standard consulting style: action titles don't end with periods — common copy-paste error from Word docs."

**ToleranceConfig:** No new fields needed.

---

### 4. BP-LAYOUT-007 — Left-Edge Misalignment ("Jitter" Check)
**File:** `checks.ts` (add to the per-shape check block, after geometry checks)
**Source:** `"playbook"` | **Severity:** `"warn"` | **Risk:** `"caution"` | **Coverage:** `ANALYZED`

**This is a per-slide check, not per-shape.** It must run once per slide, not once per shape. Consider adding a `runPerSlideChecks(slide, tol)` helper in checks.ts, or group these into continuity — whichever fits the existing pattern better.

For each slide:
1. Collect all text box and shape left edges (`shape.x`) — skip full-bleed images (shapes whose width/height approximate the slide canvas size, i.e., width > 80% of slide width).
2. Cluster left-edge values using a threshold of `tol.alignmentJitterThreshold` (default: `5` pt). Two values are in the same cluster if they differ by ≤ threshold.
3. Find the **mode cluster** (the cluster with the most members, or the leftmost among ties).
4. Flag any shape whose left edge is within 1–`tol.alignmentJitterThreshold` pt of the mode but not exactly at the mode — i.e., "close but not snapped." Shapes more than `tol.alignmentJitterThreshold` pt away are **intentionally offset** and should NOT be flagged.

Emit one finding per jittering shape. `slideId` = the slide, `objectId` = the shape. Include `observed.x`, `expected.modeX`, and `observed.drift` (= `observed.x - expected.modeX`) in the finding.

**Evidence:**
1. `PLAYBOOK_EVIDENCE` — "Left edge deviates from the dominant alignment grid by a small amount."
2. `GEOMETRIC_EVIDENCE` — "Sub-5pt jitter breaks the invisible grid — the human eye catches it during presentation."

**New ToleranceConfig:** Add `alignmentJitterThreshold: number` (default: `5`).

---

### 5. BP-LAYOUT-008 — Horizontal Distribution Consistency
**File:** `checks.ts` (add after BP-LAYOUT-007, same per-slide grouping)
**Source:** `"playbook"` | **Severity:** `"warn"` | **Risk:** `"caution"` | **Coverage:** `ANALYZED`

For each slide:
1. Find groups of 3+ shapes that share the same **Y-band** (top edges within `tol.distributionYBandThreshold` pt of each other, default: `20` pt) AND have similar dimensions (width within 20% of each other, height within 20%).
2. For each qualifying group, sort shapes by their `x` coordinate. Compute the gaps between adjacent shapes: `gap[i] = shapes[i+1].x - (shapes[i].x + shapes[i].width)`.
3. Compute the mean gap. If any gap deviates from the mean by more than `tol.distributionGapTolerance` pt (default: `4` pt), flag those shapes.

Emit one finding per non-uniform shape in the group. `slideId` = the slide, `objectId` = the outlier shape. Include `observed.gap`, `expected.meanGap`, and `observed.groupSize` in the finding.

**Evidence:**
1. `GEOMETRIC_EVIDENCE` — "Horizontal gap to adjacent shape in column group is unequal."
2. `PLAYBOOK_EVIDENCE` — "Unequal column spacing in a multi-column layout breaks the grid and looks rushed."

**New ToleranceConfig:** Add `distributionYBandThreshold: number` (default: `20`) and `distributionGapTolerance: number` (default: `4`).

---

### 6. BP-LAYOUT-009 — Slide Text Density
**File:** `checks.ts` (add after BP-LAYOUT-008, same per-slide grouping)
**Source:** `"playbook"` | **Severity:** `"info"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

For each slide:
1. Sum the bounding-box area (`shape.width * shape.height`) of all shapes that have text content (at least one `ParagraphSnapshot` with non-empty text). Exclude image shapes and chart shapes (shapes with no paragraphs or with `inferredRole === "IMAGE"`).
2. Compute the **safe-zone area**: use the slide canvas dimensions from `deck.slideWidth` and `deck.slideHeight` (if available) or fall back to standard 10in × 7.5in in points (720pt × 540pt). Subtract a margin band: `safeArea = (slideWidth - 2 * margin) * (slideHeight - 2 * margin)` where `margin = tol.textDensityMarginPt` (default: `36` pt, i.e., 0.5in).
3. Compute `densityRatio = totalTextArea / safeArea`. If `densityRatio > tol.textDensityMaxRatio` (default: `0.60`), emit one finding for the slide.

Emit one finding per over-dense slide. `slideId` = the slide, no `objectId`. Include `observed.densityRatio` (rounded to 2 decimal places), `expected.maxDensityRatio`, and `observed.totalTextAreaPt2` in the finding.

**Evidence:**
1. `PLAYBOOK_EVIDENCE` — "Text area exceeds density threshold for this slide."
2. `GEOMETRIC_EVIDENCE` — "Wall-of-text slides violate cognitive load principles — consider splitting or reducing content."

**New ToleranceConfig:** Add `textDensityMaxRatio: number` (default: `0.60`) and `textDensityMarginPt: number` (default: `36`).

---

## Tests Required

Create a new `packages/compiler-core/tests/phase8b-rules.test.ts`. For each rule:
- **Happy path:** violation detected, correct `ruleId` and `severity`
- **Negative path:** compliant content produces no finding
- **Edge cases:**
  - TYPO-009: single-bullet text boxes → no finding; sub-bullets only → no finding; fewer than 3 classifiable boxes deck-wide → no deck-wide finding
  - TYPO-010: single space only → no finding; leading/trailing space → no finding
  - TYPO-011: title ending with `?` → no finding; title ending with `!` → no finding; title ending with `...` (ellipsis) → no finding (doesn't end with `.` after trim... actually this DOES end with `.` — flag it). Note: `...` ends with `.` so it IS flagged; only `?` and `!` are explicit exceptions.
  - LAYOUT-007: shape more than threshold away from mode → not flagged (intentional offset); exactly at mode → not flagged; full-bleed image → excluded
  - LAYOUT-008: only 2 shapes in a Y-band → no finding (need ≥ 3); shapes with different heights → not grouped
  - LAYOUT-009: slide with only images/charts → no finding; slide with 1 small text box → no finding

---

## PLAYBOOK_RULE_COUNT

After implementing, update `PLAYBOOK_RULE_COUNT` in `packages/compiler-core/src/constants.ts`. Current value is `26`. New playbook-sourced rules in this batch: TYPO-010, TYPO-011, LAYOUT-007, LAYOUT-008, LAYOUT-009 = **+5**. TYPO-009 is continuity-sourced — it does NOT count toward PLAYBOOK_RULE_COUNT.

New value: **31**.

Also update `docs/RULE_CATALOG.md` — change Status from `proposed` → `active` for all 6 rules.
