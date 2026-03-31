# Cursor Prompt: Phase 8A — New Rules (No IR Changes Required)

> Paste this into Cursor Composer. All 5 rules are implementable against the existing data model.

---

## Context

You're implementing 5 new compliance rules for Magistrat, a deterministic slide compliance checker for Google Slides / PowerPoint.

**Key files:**
- `packages/compiler-core/src/checks.ts` — per-object rules (playbook/exemplar)
- `packages/compiler-core/src/continuity.ts` — cross-slide rules
- `packages/shared-types/src/ir.ts` — `DeckSnapshot`, `SlideSnapshot`, `ShapeSnapshot`, `ParagraphSnapshot`, `TextRunSnapshot`
- `packages/shared-types/src/findings.ts` — `Finding`, `Evidence`, `EvidenceType`, `Severity`, `Risk`
- `packages/shared-types/src/tolerance.ts` — `ToleranceConfig`, `defaultToleranceConfig()`
- `packages/compiler-core/tests/continuity.test.ts` — example continuity test patterns
- `packages/compiler-core/tests/check-phases.test.ts` — example per-object test patterns

**Patterns to follow exactly:**
- Finding IDs: `` `finding-${stableHash([slideId, objectId, "rule_key"])}` ``
- Evidence: always 2 items — one for WHY the rule exists, one for WHAT was observed
- Every finding needs: `id`, `ruleId`, `source`, `slideId`, `observed`, `expected`, `evidence`, `confidence`, `risk`, `severity`, `coverage: "ANALYZED"`
- New `EvidenceType` values need to be added to the `EVIDENCE_TYPES` const array in `findings.ts`
- New `ToleranceConfig` fields go in the interface AND `defaultToleranceConfig()`
- Tests live alongside existing tests in `packages/compiler-core/tests/`

---

## Rules to Implement

### 1. BP-HYGIENE-006 — Draft Tag Remnants
**File:** `checks.ts` (add to the per-shape hygiene check block, near BP-HYGIENE-004)
**Source:** `"playbook"` | **Severity:** `"error"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

Scan all `shape.paragraphs[].text` concatenated for these patterns (case-insensitive regex):
```
\[TBD\]|\[XX\]|\[DRAFT\]|\[INSERT[^\]]*\]|\[PLACEHOLDER[^\]]*\]|<PLACEHOLDER>|TODO:?
```
If any match is found, emit one finding per shape (not per match). Include the matched token in `observed`.

**Evidence:**
1. `PLAYBOOK_EVIDENCE` — "Draft bracket pattern found in text content."
2. `HYGIENE_EVIDENCE` — "Draft markers in a final presentation undermine credibility with executive audiences."

**ToleranceConfig:** No new fields needed.

---

### 2. BP-WCAG-001 — Minimum Text Luminance Contrast
**File:** `checks.ts` (add to the per-shape check block, after color checks)
**Source:** `"playbook"` | **Severity:** `"error"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

Only run when `shape.fillColor` is present (solid fill). Skip shapes with no fill or image backgrounds.

For each `TextRunSnapshot` where `fontAlpha >= 0.95` (opaque text):
1. Parse `textRun.fontColor` (hex string, e.g. `"#1F2937"`) → RGB → relative luminance
2. Parse `shape.fillColor` (same format) → relative luminance
3. Compute contrast ratio: `(lighter + 0.05) / (darker + 0.05)`
4. If contrast ratio < `tol.wcagMinContrastRatio` (default: `4.5`), emit a finding

Relative luminance formula (per WCAG 2.1):
- For each channel c in [R, G, B] normalized 0–1:
  - if c <= 0.04045: `c / 12.92`
  - else: `((c + 0.055) / 1.055) ^ 2.4`
- L = 0.2126 * R + 0.7152 * G + 0.0722 * B

Emit one finding per shape (use the worst-case run's contrast ratio in `observed`). Include both hex values and computed ratio.

**Evidence:**
1. `PLAYBOOK_EVIDENCE` — "WCAG 1.4.3 requires minimum 4.5:1 contrast ratio for standard text."
2. `COLOR_EVIDENCE` — "Computed contrast ratio between text and shape fill is below threshold."

**New EvidenceType:** Add `"COLOR_EVIDENCE"` to `EVIDENCE_TYPES` in `findings.ts`.

**ToleranceConfig:** Add `wcagMinContrastRatio: number` (default: `4.5`).

---

### 3. BP-TYPO-008 — Capitalization Style Inconsistency
**File:** `continuity.ts` (add as a new check in `runContinuityChecks`)
**Source:** `"continuity"` | **Severity:** `"info"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

Classify the Title placeholder text of each slide (where `shape.inferredRole === "TITLE"` and text length > 0) into one of three capitalization styles:
- `"TITLE_CASE"` — every word ≥ 4 chars starts with uppercase (allow exceptions: "and", "or", "of", "in", "the", "a", "an", "for", "to", "but", "nor")
- `"UPPER_CASE"` — all alphabetic characters are uppercase
- `"SENTENCE_CASE"` — first word capitalized, rest lowercase (or proper nouns)
- `"MIXED"` — doesn't fit the above

Compute the dominant style across all classified titles. Flag any title whose style differs from the dominant.

Emit one finding per non-conforming slide. `slideId` = the non-conforming slide, no `objectId`. Include `observed.style`, `expected.dominantStyle`, and `observed.titleText` in the finding.

Skip slides with no title text. Don't flag if fewer than 3 titles were classifiable (not enough signal).

**Evidence:**
1. `REFERENTIAL_EVIDENCE` — "Capitalization style differs from the dominant convention in this deck."
2. `TYPOGRAPHIC_EVIDENCE` — "Inconsistent title capitalization signals a multi-author Frankenstein deck."

---

### 4. BP-CONT-004 — Page Number Gaps or Inconsistencies
**File:** `continuity.ts` (add as a new check in `runContinuityChecks`)
**Source:** `"continuity"` | **Severity:** `"warn"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

For each slide, look for a shape with `inferredRole === "FOOTER"` or `inferredRole === "PAGE_NUMBER"` (or if neither exists, scan all shapes for a text run that is a standalone integer). Extract any integer found in the text.

Build a sequence of `{ slideIndex, pageNumber }` pairs (skip slides with no number found — these may be intentional unnumbered dividers).

Flag when:
- The same number appears more than once (duplicate)
- The sequence has a gap > 1 between consecutive numbered slides (e.g., jumps from 3 to 5 with no unnumbered slides in between) — use judgment: if there are intervening unnumbered slides, allow the gap

Emit one finding per problem. `slideId` = the slide where the issue first manifests. Include `observed.pageNumber`, `observed.slideIndex`, and `expected.expectedSequence` or `expected.conflict` in the finding.

**Evidence:**
1. `REFERENTIAL_EVIDENCE` — "Page number sequence gap or duplicate detected."
2. `HYGIENE_EVIDENCE` — "Executives navigate printed decks by page number — gaps and duplicates break navigation."

---

### 5. BP-CONT-005 — Date/Number Format Inconsistency
**File:** `continuity.ts` (add as a new check in `runContinuityChecks`)
**Source:** `"continuity"` | **Severity:** `"warn"` | **Risk:** `"manual"` | **Coverage:** `ANALYZED`

Scan all paragraph text across all slides. Extract:

**Date patterns** (regex match, capture format type):
- `MM/DD/YYYY` or `M/D/YYYY` → `"MDY_SLASH"`
- `DD/MM/YYYY` → ambiguous, skip
- `DD-Mon-YYYY` (e.g. `15-Mar-2024`) → `"DMY_DASH_ALPHA"`
- `Month DD, YYYY` (e.g. `March 15, 2024`) → `"LONG_US"`
- `YYYY-MM-DD` → `"ISO"`

**Number formats** (only flag when number > 999 to avoid false positives):
- `1,000` style → `"COMMA_SEPARATOR"`
- `1.000` style (European) → `"DOT_SEPARATOR"`
- `1000` (no separator) → `"NO_SEPARATOR"`

For each category (dates, numbers), if more than one format variant is found across the deck, emit one finding per minority-format occurrence. Use majority-vote: the most common format is the expected one, all others are flagged.

Minimum threshold: only run if at least 3 examples of a category are found (otherwise not enough signal).

`slideId` = slide where the minority format was found. `objectId` = shape where it was found. Include `observed.format`, `observed.value`, `expected.dominantFormat` in the finding.

**Evidence:**
1. `REFERENTIAL_EVIDENCE` — "Date/number format differs from the dominant convention in this deck."
2. `HYGIENE_EVIDENCE` — "Mixed formats signal multi-author assembly and erode precision credibility."

---

## Tests Required

For each rule, add tests in an appropriate file (create a new `phase8a-rules.test.ts` if cleaner):
- Happy path: violation detected, correct ruleId and severity
- Negative path: compliant content produces no finding
- Edge cases per rule:
  - HYGIENE-006: case-insensitive match, partial word inside bracket
  - WCAG-001: skip shapes with no fillColor, skip semi-transparent text
  - TYPO-008: fewer than 3 titles → no finding; mixed case titles → MIXED, not flagged if dominant is also MIXED
  - CONT-004: unnumbered section dividers between numbered slides → no false positive
  - CONT-005: fewer than 3 examples → no finding; large numbers without separator → no false positive if NO_SEPARATOR is dominant

## PLAYBOOK_RULE_COUNT

After implementing, update `PLAYBOOK_RULE_COUNT` (grep for it) — it should increase by the number of new playbook-sourced rules added.
