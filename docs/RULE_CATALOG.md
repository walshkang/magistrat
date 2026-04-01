# Magistrat Rule Catalog

> **Purpose:** Single source of truth for all compliance rules. Designed for human review AND agent consumption.
> Edit this file to propose new rules, modify existing ones, or flag removals. Use the status field to track lifecycle.
>
> **Re-import:** Any agent can read this file, diff it against `checks.ts` / `continuity.ts`, and generate implementation code for new/changed rules.

---

## Implementation Roadmap

### Phase 8B — Implemented (2026-03-31)
Shipped in `checks.ts` / `continuity.ts` with tests in `phase8b-rules.test.ts`:
- **BP-TYPO-009** — Bullet Punctuation Consistency
- **BP-TYPO-010** — Double Space Detection
- **BP-TYPO-011** — Title Terminal Punctuation
- **BP-LAYOUT-007** — Left-Edge Misalignment ("Jitter" Check)
- **BP-LAYOUT-008** — Horizontal Distribution Consistency
- **BP-LAYOUT-009** — Slide Text Density

### Track A Slice 1 — IR Extensions (2026-03-31)
Extended IR with `ParagraphSnapshot.alignment` and `ShapeSnapshot.lineColor` / `lineWidth`. Google GAS bridge, `google-adapter` mapper, and `office-adapter` read path updated; `RoleStyleTokens` includes dominant `alignment`. Tests: `packages/compiler-core/tests/track-a-slice1.test.ts`, mapper coverage in `packages/google-adapter/tests/public-api.test.ts`. Unblocks:
- **BP-TYPO-012** — Text Alignment Mismatch
- **BP-COLOR-004** — Shape Border Off Palette

### Track A Slice 2 — Table Cell Model IR (2026-04-01)
Extended IR with `TableSnapshot` and `TableCellSnapshot` on `ShapeSnapshot.table`. GAS bridge extracts table cell fill, borders, text, alignment; Office adapter performs best-effort table read (`text` + margins; `textRuns` deferred). Tests: `packages/compiler-core/tests/track-a-slice2.test.ts`, table mapping in `packages/google-adapter/tests/public-api.test.ts`. Unblocks:
- **BP-TABLE-001** — Table Header Fill Color
- **BP-TABLE-004** — Intra-Column Alignment Consistency
- **BP-TABLE-005** — Trapped External Fonts

### Table Rules Batch 2 (2026-04-01)
Four additional table rules using the Slice 2 IR. Tests: `packages/compiler-core/tests/table-rules-batch2.test.ts`.
- **BP-TABLE-002** — Table Border Color Consistency
- **BP-TABLE-007** — Vertical Alignment Inconsistency
- **BP-TABLE-006** — Empty Cell Without Explicit Notation
- **BP-TABLE-009** — Over-Bolding in Data Rows

### Track A Slice 4 — Chart Series IR (2026-04-01)
Extended IR with `ChartSnapshot` on `ShapeSnapshot.chart`.
GAS bridge uses Advanced Sheets Service to read chart spec (series colors, axis titles, data label presence).
Office adapter: chart data not available via Office.js (graceful skip).
Requires `Sheets` Advanced Service enabled in `appsscript.json`.
Unblocks:
- **BP-CHART-001** — Chart Series Color Off-Palette
- **BP-CHART-002** — Missing Chart Axis Labels or Units

### Track A — Read API Extensions (unblocks blocked rules)
Extend the existing Google and Office adapters to pull more fields from their respective APIs. No new permissions required — all data is already exposed. This is the right next step before Phase 7D.

| IR gap | Affects |
|---|---|
| `ParagraphSnapshot.alignment` | BP-TYPO-012 (implemented Slice 1) |
| `ShapeSnapshot.lineColor + lineWidth` | BP-COLOR-004 (implemented Slice 1) |
| Image intrinsic dimensions | BP-LAYOUT-005 |
| Table cell model (fill, borders, margins, font, alignment, vertical align) | BP-TABLE-001 through BP-TABLE-009 |
| Chart series colors + axis metadata | BP-CHART-001, BP-CHART-002 |

### Track B — Write API (Phase 7D, slide master generation)
Generate a Google Slides master/layout from the exemplar style map. Requires Slides API write scope — currently the sidebar is read-only. Office parity for master generation is a separate design problem (PowerPoint XML master manipulation differs significantly from Slides API). Deferred until Track A is complete and master generation scope is properly shaped.

---

## Schema

Each rule follows this structure:

```
### BP-{CATEGORY}-{NNN} — {Short Name}
- **Status:** active | proposed | deprecated
- **Source:** exemplar | playbook | continuity
- **Severity:** error | warn | info
- **Risk:** safe | caution | manual
- **Auto-fix:** yes | no
- **What it checks:** {one-line description}
- **Why it matters:** {executive deck context}
- **Evidence:** {evidence types}
- **Notes:** {optional — edge cases, tolerances, known gaps}
```

---

## Typography

### BP-TYPO-001 — Font Family Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** error
- **Risk:** safe
- **Auto-fix:** yes (SET_FONT_FAMILY)
- **What it checks:** Font family differs from the exemplar style map for that role
- **Why it matters:** Mixed fonts signal sloppy copy-paste and break brand consistency. Exec audiences notice immediately.
- **Evidence:** EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE

### BP-TYPO-002 — Font Style Mismatch (Bold/Italic)
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** yes (SET_FONT_STYLE)
- **What it checks:** Bold or italic properties differ from the role expectation
- **Why it matters:** Inconsistent weight/style within a role (e.g., some body bold, some not) creates visual noise.
- **Evidence:** EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE

### BP-TYPO-003 — Font Size Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** caution
- **Auto-fix:** yes (SET_FONT_SIZE)
- **What it checks:** Font size deviates beyond the role's tolerance threshold
- **Why it matters:** Size hierarchy is the primary visual signal for information architecture. A 2pt drift in body text compounds across slides.
- **Evidence:** EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE
- **Notes:** Uses per-role tolerance from ToleranceConfig. Caution risk because auto-resize can break text fitting.

### BP-TYPO-004 — Multiple Font Families in Single Text Box
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** More than one font family present in the same text element
- **Why it matters:** Usually indicates copy-paste from another source. A single text box should use one font.
- **Evidence:** PLAYBOOK_EVIDENCE, TYPOGRAPHIC_EVIDENCE

### BP-TYPO-005 — Line Spacing and Paragraph Spacing Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** caution
- **Auto-fix:** yes (SET_LINE_SPACING)
- **What it checks:** Line spacing, space before paragraph, or space after paragraph differs from the exemplar style map
- **Why it matters:** Inconsistent line spacing makes slides feel unbalanced and can cause text overflow. Authors often adjust space before/after paragraph instead of line spacing, producing the same visual problem through a different property.
- **Evidence:** EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE

### BP-TYPO-006 — Text Container Overflow
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Detects when internal text bounding box exceeds the outer shape container (text spills outside its box)
- **Why it matters:** Overflow text obscures charts, violates margins, and signals the author didn't QA the slide. Common when content is pasted between differently sized templates.
- **Evidence:** GEOMETRIC_EVIDENCE, TEXT_BOUNDS_EVIDENCE
- **Notes:** Auto-fix disabled — shrinking font breaks typographic consistency, expanding shape may push it off-slide. Needs data model verification that text bounds are available.

### BP-TYPO-007 — Paragraph Orphan, Widow, and Hanging Line Detection
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Flags final line of a text block that contains fewer than 8 characters or a single word (orphans, widows, and hanging lines)
- **Why it matters:** Orphan and hanging lines waste vertical space, disrupt reading rhythm, and force unnecessarily small fonts to compensate.
- **Evidence:** TEXT_STRING_EVIDENCE, TYPOGRAPHIC_EVIDENCE
- **Notes:** Requires text line-break data (not just paragraph breaks). Auto-fix disabled — resolving orphans requires rewriting copy or adjusting shape padding.

### BP-TYPO-008 — Capitalization Style Inconsistency
- **Status:** active
- **Source:** continuity
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Detects mixed capitalization conventions within the same role across slides (e.g., some titles in Title Case, others in sentence case)
- **Why it matters:** Inconsistent capitalization across slide titles or section headers signals a Frankenstein deck assembled from multiple authors/sources.
- **Evidence:** TEXT_STRING_EVIDENCE, REFERENTIAL_EVIDENCE
- **Notes:** Heuristic — classifies each title as Title Case, UPPER CASE, or sentence case, then flags if the dominant style isn't used consistently. Proper nouns and acronyms may cause false positives; needs a short exclusion list.

### BP-TYPO-009 — Bullet Punctuation Consistency
- **Status:** active
- **Source:** continuity
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Classifies terminal punctuation on level-0 bullets (`paragraph.level === 0`); per text box flags minority when PERIOD and NONE mix; deck-wide flags boxes whose dominant style opposes the deck when ≥60% of classifiable boxes (≥3) share one style
- **Why it matters:** Mixed terminal punctuation signals copy-pasted content from multiple authors.
- **Evidence:** STRUCTURAL_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** Ignores sub-bullets (level ≥ 1). Skips boxes with fewer than two level-0 bullets with non-empty text.

### BP-TYPO-010 — Double Space Detection
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** safe
- **Auto-fix:** no
- **What it checks:** Two or more consecutive spaces in trimmed text runs (`/ {2,}/`)
- **Why it matters:** Double spaces break justification and alignment; legacy typist habit from fixed-width typesetting.
- **Evidence:** PLAYBOOK_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** One finding per shape. Leading/trailing runs of spaces are trimmed before scan.

### BP-TYPO-011 — Title Terminal Punctuation
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** no
- **What it checks:** TITLE-role shape whose paragraph text (space-joined, trimmed) ends with `.`; skips `?` and `!`
- **Why it matters:** Action titles in consulting style avoid terminal periods; common paste artifact from Word.
- **Evidence:** PLAYBOOK_EVIDENCE, TEXT_STRING_EVIDENCE

---

## Color

### BP-COLOR-001 — Font Color Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** yes (SET_FONT_COLOR)
- **What it checks:** Text color differs from the role expectation in the style map
- **Why it matters:** Off-brand colors are one of the most common compliance failures. Even small hex drift is visible.
- **Evidence:** EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE

### BP-COLOR-003 — Shape Fill Off Palette
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Any shape fill color is not present in the slide master color palette
- **Why it matters:** Off-palette fills break the visual system. Applies to all shapes — callout boxes, backgrounds, icons, etc.
- **Evidence:** PLAYBOOK_EVIDENCE, COLOR_EVIDENCE
- **Notes:** Manual review required — some off-palette colors are intentional (e.g., a bright red for urgency callouts). User should confirm or suppress per instance.

---

## Bullet & Structure

### BP-BULLET-001 — Bullet Indent/Hanging Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** yes (SET_BULLET_INDENT)
- **What it checks:** Paragraph bullet indentation differs from the exemplar tokens
- **Why it matters:** Inconsistent indentation is the #1 tell that a deck was assembled from multiple sources.
- **Evidence:** EXEMPLAR_EVIDENCE, STRUCTURAL_EVIDENCE

### BP-BULLET-002 — Bullet Glyph Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Bullet character (dash, circle, arrow, etc.) differs from exemplar
- **Why it matters:** Glyph consistency reinforces brand. Mixed glyphs feel ad-hoc.
- **Evidence:** EXEMPLAR_EVIDENCE, STRUCTURAL_EVIDENCE

---

## Hygiene

### BP-HYGIENE-001 — Ghost Objects
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Invisible objects with zero-alpha text remaining on slide
- **Why it matters:** Ghost objects leak confidential content, inflate file size, and can appear when printed or exported to PDF.
- **Evidence:** PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE

### BP-HYGIENE-002 — Object Off Slide
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Object bounding box is less than 10% within the slide canvas
- **Why it matters:** Off-slide objects are invisible in present mode but leak in edit mode and PDF exports.
- **Evidence:** PLAYBOOK_EVIDENCE, GEOMETRIC_EVIDENCE

### BP-HYGIENE-003 — Duplicate Overlapping Objects
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Overlapping objects with identical or near-identical text content
- **Why it matters:** Copy-paste artifacts. Can cause text to render bolder/blurry due to stacking.
- **Evidence:** PLAYBOOK_EVIDENCE, GEOMETRIC_EVIDENCE

### BP-HYGIENE-004 — Placeholder Text
- **Status:** active
- **Source:** playbook
- **Severity:** error
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Text contains "click to add" or "lorem ipsum" patterns
- **Why it matters:** Placeholder text in a live deck is an instant credibility killer with exec audiences.
- **Evidence:** PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE

### BP-HYGIENE-006 — Draft Tag Remnants
- **Status:** active
- **Source:** playbook
- **Severity:** error
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Scans all text for common draft markers: `[TBD]`, `[xx]`, `[DRAFT]`, `[Insert]`, `<placeholder>`, `TODO`
- **Why it matters:** Draft brackets in a final exec presentation are an instant credibility killer — signals the deck wasn't finished or reviewed.
- **Evidence:** PLAYBOOK_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** Strict regex match. Auto-fix disabled — the system can't generate the missing content.

### BP-HYGIENE-007 — Confidentiality Label Missing on Some Slides
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** If a confidentiality or classification label ("Confidential", "Internal Use Only", "Privileged", etc.) is detected on any slide, flags slides where it is absent
- **Why it matters:** F100 legal/compliance teams require classification on every external-facing document. Missing labels can block distribution or create liability.
- **Evidence:** PLAYBOOK_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** Self-referencing — rule only activates if at least one slide already has a label. No false positives on decks that don't use classification labels at all. False negatives possible if label is embedded in an image.

---

## Layout & Geometry

### BP-LAYOUT-001 — Title Position Band Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Title box center is outside the exemplar's tolerance band
- **Why it matters:** Title position anchors the slide grid. Drift here cascades to perceived misalignment of everything below.
- **Evidence:** EXEMPLAR_EVIDENCE, GEOMETRIC_EVIDENCE

### BP-LAYOUT-002 — Footer Position Band Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Footer top edge is outside the exemplar's tolerance band
- **Why it matters:** Footer drift is highly visible in page-sorter view and breaks the "rail" that anchors the slide.
- **Evidence:** EXEMPLAR_EVIDENCE, GEOMETRIC_EVIDENCE

### BP-LAYOUT-003 — Geometry Micro-Snap
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Coordinates use fractional points that could be normalized
- **Why it matters:** Fractional coords accumulate from copy-paste between decks with different grid settings.
- **Evidence:** PLAYBOOK_EVIDENCE, GEOMETRIC_EVIDENCE

### BP-LAYOUT-004 — Breadcrumb Position Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Breadcrumb horizontal position differs from exemplar
- **Why it matters:** Breadcrumbs/progress bars need pixel-level consistency across slides to avoid visual jitter during presentations.
- **Evidence:** EXEMPLAR_EVIDENCE, GEOMETRIC_EVIDENCE

### BP-LAYOUT-005 — Aspect Ratio Distortion
- **Status:** active
- **Source:** playbook
- **Severity:** error
- **Risk:** safe
- **Auto-fix:** yes
- **Type:** deterministic
- **What it checks:** Compares intrinsic image aspect ratio against rendered shape dimensions on the slide
- **Why it matters:** Stretched logos, headshots, or product shots signal low rigor and damage brand credibility. Exec audiences catch this instantly.
- **Evidence:** GEOMETRIC_EVIDENCE, MEDIA_METADATA
- **Notes:** Intrinsic dimensions come from image binary headers (GAS `getBlob()` / Office `getBase64Image()`), stored on IR as `ShapeSnapshot.imageMetadata`. Auto-fix restores height based on current width to match original ratio. Threshold: abs(original ratio - rendered ratio) > 0.01.

### BP-LAYOUT-006 — Slide Margin Perimeter Breach
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** caution
- **Auto-fix:** yes
- **Type:** deterministic
- **What it checks:** Ensures all text boxes, charts, and tables fall within the margin band established by the exemplar's outermost content positions
- **Why it matters:** Content near edges gets cropped on projectors and printers. Negative space is essential for cognitive focus per Duarte/Reynolds principles.
- **Evidence:** EXEMPLAR_EVIDENCE, GEOMETRIC_EVIDENCE
- **Notes:** Margin threshold derived from exemplar boundary scan — not a hardcoded value. Full-bleed images (dimensions matching slide) are excluded.

### BP-LAYOUT-007 — Left-Edge Misalignment ("Jitter" Check)
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** caution
- **Auto-fix:** no
- **What it checks:** Per slide, clusters shape `geometry.left` (excluding full-bleed: width and height both >80% of slide); uses largest cluster (tie: leftmost); flags shapes where \(0 < |x - modeX| \leq\) `alignmentJitterThreshold` (default 5pt)
- **Why it matters:** Sub-point jitter breaks the invisible alignment grid.
- **Evidence:** PLAYBOOK_EVIDENCE, GEOMETRIC_EVIDENCE

### BP-LAYOUT-008 — Horizontal Distribution Consistency
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** caution
- **Auto-fix:** no
- **What it checks:** Union-finds shapes in the same Y-band (`distributionYBandThreshold`, default 20pt) with width/height within 20%; for groups of 3+ sorted by `x`, flags shapes adjacent to gaps that deviate from mean gap by more than `distributionGapTolerance` (default 4pt)
- **Why it matters:** Uneven column spacing in multi-column layouts looks rushed.
- **Evidence:** GEOMETRIC_EVIDENCE, PLAYBOOK_EVIDENCE

### BP-LAYOUT-009 — Slide Text Density
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Sums bounding-box area of text-bearing shapes (non-empty paragraphs); excludes `IMAGE` and `CHART` shape types. Compares to safe-zone area \((slideW - 2m)(slideH - 2m)\) with `textDensityMarginPt` (default 36pt); flags when ratio exceeds `textDensityMaxRatio` (default 0.6)
- **Why it matters:** Wall-of-text slides violate cognitive-load limits.
- **Evidence:** PLAYBOOK_EVIDENCE, GEOMETRIC_EVIDENCE
- **Notes:** Slide-level finding (no `objectId`). Canvas defaults 720×540pt if dimensions missing.

---

## Continuity (Cross-Slide)

### BP-CONT-001 — Missing Slide Title
- **Status:** active
- **Source:** continuity
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Slide has no resolvable title text
- **Why it matters:** Untitled slides break accessibility, PDF bookmarks, and make deck navigation harder.
- **Evidence:** REFERENTIAL_EVIDENCE

### BP-CONT-002 — Agenda Mismatch
- **Status:** active
- **Source:** continuity
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** One or more agenda items have no fuzzy/substring match against slide titles or breadcrumb text in the deck
- **Why it matters:** Agenda/TOC that doesn't match actual slides is a trust-breaker in any exec presentation.
- **Evidence:** REFERENTIAL_EVIDENCE
- **Notes:** Uses fuzzy/substring matching — not exact string match. Breadcrumb text is used as a secondary reference signal when present, as it often carries the canonical section title. Avoids false positives when slide titles are abbreviated or reformatted versions of agenda items.

### BP-CONT-003 — Section Header Archetype Inconsistency
- **Status:** active
- **Source:** continuity
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Section header slide's role mix differs from the first section header
- **Why it matters:** Section dividers should be visually identical — inconsistency signals a Frankenstein deck.
- **Evidence:** REFERENTIAL_EVIDENCE

### BP-CONT-004 — Page Number Gaps or Inconsistencies
- **Status:** active
- **Source:** continuity
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Scans footer/page-number placeholders across slides for missing numbers, duplicates, or non-sequential jumps
- **Why it matters:** Execs flip to "page 12" by number in printed decks. Gaps or duplicates break navigation and signal sloppy assembly from multiple sources.
- **Evidence:** REFERENTIAL_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** Must handle intentional gaps (e.g., unnumbered section dividers). Consider allowing a "skip list" of slide archetypes.

### BP-CONT-005 — Date/Number Format Inconsistency
- **Status:** active
- **Source:** continuity
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Scans text for date patterns (MM/DD/YYYY vs DD-Mon-YYYY vs YYYY-MM-DD etc.) and number formats (1,000 vs 1.000 vs 1000) and flags when multiple conventions appear in the same deck
- **Why it matters:** Mixed date/number formats signal multi-author assembly and erode precision credibility with F100 audiences who scrutinize financial data.
- **Evidence:** TEXT_STRING_EVIDENCE, REFERENTIAL_EVIDENCE
- **Notes:** Heuristic — regex-based date/number pattern extraction, then majority-vote consistency check. High false-positive risk with slide content that legitimately references multiple locales; may need a per-deck locale config.

---

## Safety & Meta

### BP-SAFETY-001 — Grouped Object Geometry Patch Risk
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Grouped objects receiving implicit geometry patches (move/resize) that could break internal layout
- **Why it matters:** Patching grouped objects can scatter child elements. Flagged for human review.
- **Evidence:** PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE

### BP-COVERAGE-001 — Analysis Coverage
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Object could not be analyzed — surfaces the specific reason and location (slide number, object identifier) for every skipped object
- **Why it matters:** Transparency and auditability — users need to know exactly what the tool can't see, where, and why. Functions as a proper audit trail, not just a warning count.
- **Evidence:** PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE
- **Notes:** Reason subcategories: "unsupported object type", "low confidence role assignment", "API/data limitation". Each finding includes slide number and object identifier.

### BP-MASTERS-001 — Master Layout Metadata Availability
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **What it checks:** Master or layout metadata unavailable (report-only in v1)
- **Why it matters:** Without master metadata, the tool can't distinguish inherited styles from overrides.
- **Evidence:** PLAYBOOK_EVIDENCE, HYGIENE_EVIDENCE

---

## Accessibility

### BP-WCAG-001 — Minimum Text Luminance Contrast
- **Status:** active
- **Source:** playbook
- **Severity:** error
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Calculates relative luminance contrast ratio between text color and underlying solid shape/background color
- **Why it matters:** WCAG 1.4.3 requires 4.5:1 minimum contrast for standard text. Low contrast = unreadable on projectors and for visually impaired stakeholders.
- **Evidence:** COLOR_EVIDENCE, GEOMETRIC_EVIDENCE
- **Notes:** Only evaluates text over solid fills. Gradient/image backgrounds skipped to avoid false positives.

---

## Proposed Rules

> Add new rule proposals below. Set **Status: proposed** and fill in as much as you can.
> An agent or human will review, discuss, and promote to active when ready for implementation.

### Tier 1 — High Signal

### BP-TABLE-001 — Table Header Fill Color
- **Status:** active
- **Source:** exemplar
- **Severity:** error
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Header row background fill color differs from the exemplar's table header style
- **Why it matters:** Header row color is a primary brand signal in financial and strategy tables. Off-color headers signal a copy-paste from another template.
- **Evidence:** EXEMPLAR_EVIDENCE, TABLE_EVIDENCE
- **Notes:** Requires DeckSnapshot extension to capture table cell fill properties. Both OOXML (`<a:tcPr>`) and Slides API (`tableCellProperties`) expose this data.

### BP-TABLE-002 — Table Border Color Consistency
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Table border colors (per edge: top/bottom/left/right) differ from the exemplar's table border schema
- **Why it matters:** Border color discipline (black vs. white vs. transparent) defines the visual hierarchy of financial and data tables. Mixed borders signal template mixing.
- **Evidence:** EXEMPLAR_EVIDENCE, TABLE_EVIDENCE
- **Notes:** Requires table cell model IR extension (Track A).

### BP-TABLE-003 — Table Cell Margin / Padding Mismatch
- **Status:** proposed
- **Source:** exemplar
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** yes (SET_CELL_MARGINS)
- **Type:** deterministic
- **What it checks:** Internal cell margins (top/bottom/left/right padding) compared against the exemplar table style
- **Why it matters:** Pasted tables drop cell margins to 0pt, causing text to slam into border lines. Destroys readability.
- **Evidence:** TABLE_EVIDENCE, GEOMETRIC_EVIDENCE
- **Notes:** APIs expose cell margins natively. Auto-fix is universally safe. Requires table cell model IR extension (Track A).

### BP-TABLE-004 — Intra-Column Alignment Consistency
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** yes (APPLY_MAJORITY_ALIGNMENT)
- **Type:** heuristic
- **What it checks:** Within each column, flags data cells whose horizontal alignment (left/center/right) deviates from the column's majority alignment
- **Why it matters:** A pasted row with center-aligned numbers in a right-aligned column is a glaring error. Smarter than forcing all numbers right — respects the column's own convention.
- **Evidence:** TABLE_EVIDENCE, TYPOGRAPHIC_EVIDENCE
- **Notes:** Excludes header row (legitimately different alignment). Requires table cell model IR extension (Track A).

### BP-TABLE-005 — Trapped External Fonts
- **Status:** active
- **Source:** exemplar
- **Severity:** error
- **Risk:** safe
- **Auto-fix:** yes (SET_TABLE_FONT)
- **Type:** deterministic
- **What it checks:** All table cell font families checked against the exemplar's approved table/body font
- **Why it matters:** Tables pasted from Excel (Keep Source Formatting) always bring Calibri or Aptos, instantly breaking corporate brand typography.
- **Evidence:** TABLE_EVIDENCE, TYPOGRAPHIC_EVIDENCE
- **Notes:** Highly reliable with API access. Auto-fix bulk-updates all table text nodes. Requires table cell model IR extension (Track A).

### BP-TABLE-006 — Empty Cell Without Explicit Notation
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Identifies completely blank cells within a table that otherwise contains data
- **Why it matters:** In F100 finance decks, a blank cell is an audit risk — does it mean zero, missing data, or not applicable? Consulting standard: always use `—`, `0`, `NA`, or `N/A`.
- **Evidence:** TABLE_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** Heuristic — structural spacer columns and intentionally blank header cells may be false positives. Requires table cell model IR extension (Track A).

### BP-TABLE-007 — Vertical Alignment Inconsistency
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** yes (APPLY_MAJORITY_VERTICAL_ALIGN)
- **Type:** heuristic
- **What it checks:** Within each row, flags cells whose vertical alignment (top/middle/bottom) deviates from the row's majority
- **Why it matters:** Mixed vertical alignment in a row looks jagged and unstructured, especially when adjacent cells have different text heights.
- **Evidence:** TABLE_EVIDENCE, TYPOGRAPHIC_EVIDENCE
- **Notes:** Evaluated per-row (header rows are often bottom-aligned while data rows are top-aligned). Requires table cell model IR extension (Track A).

---

### Tier 2 — Good to Have

### BP-TYPO-012 — Text Alignment Mismatch
- **Status:** active
- **Source:** exemplar
- **Severity:** warn
- **Risk:** safe
- **Auto-fix:** yes (SET_TEXT_ALIGNMENT)
- **Type:** deterministic
- **What it checks:** Compares paragraph alignment (left/center/right/justified) against the exemplar for that role
- **Why it matters:** A center-aligned body text box in a left-aligned deck creates immediate visual dissonance.
- **Evidence:** EXEMPLAR_EVIDENCE, TYPOGRAPHIC_EVIDENCE
- **Notes:** Dominant alignment per shape (majority of paragraphs); skips when host omits alignment (e.g. Office read path) or style map has no alignment token. Apply for `SET_TEXT_ALIGNMENT` not implemented in host adapters yet (suggestion-only).

### BP-CHART-001 — Chart Series Color Off-Palette
- **Status:** active
- **Source:** playbook
- **Severity:** error
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Fill colors of chart data series (bars, pie slices, lines) checked against the exemplar color palette (unique fontColor + fillColor values from style map)
- **Why it matters:** Charts pasted from Excel carry Microsoft's default blue/orange/gray palette, destroying the F100 brand system on every data slide.
- **Evidence:** CHART_EVIDENCE
- **Notes:** Skips series with no color defined. Skips when exemplar palette is empty. GAS reads series colors via Sheets Advanced Service (SheetsChart → spreadsheetId + chartId → Sheets.Spreadsheets.get → chartSpec).

### BP-COLOR-004 — Shape Border Off Palette
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Shape line/border color checked against the exemplar style palette (unique `fontColor` and `fillColor` values from the style map); only when `lineWidth` > 0 and `lineColor` is present
- **Why it matters:** Authors fix fill colors but forget the 1pt border — leaving a default Microsoft blue outline on a branded corporate shape.
- **Evidence:** PLAYBOOK_EVIDENCE, COLOR_EVIDENCE
- **Notes:** Skips when the palette is empty. Companion to BP-COLOR-003.

---

### Tier 3 — Nice to Have

### BP-TABLE-008 — Zebra Striping Disruption
- **Status:** proposed
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Detects alternating row fill color patterns, then flags adjacent rows sharing the same fill (pattern broken)
- **Why it matters:** Inserting or deleting a row in a statically colored table breaks the zebra stripe, creating a thick block of one color.
- **Evidence:** TABLE_EVIDENCE, COLOR_EVIDENCE
- **Notes:** Engine must first recognize the repeating 1:1 pattern before flagging disruption. Auto-fix deferred — requires knowing which color is base vs. stripe. Requires table cell model IR extension (Track A).

### BP-TABLE-009 — Over-Bolding in Data Rows
- **Status:** active
- **Source:** playbook
- **Severity:** info
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Flags data rows (non-header, non-total) where more than 50% of text is bold
- **Why it matters:** When everything is bold, nothing is bold. Overuse of bold in table data rows destroys visual hierarchy.
- **Evidence:** TABLE_EVIDENCE, TYPOGRAPHIC_EVIDENCE
- **Notes:** Requires distinguishing header/total rows from data rows (heuristic: first row = header, last row with sum/total keyword = total). Requires table cell model IR extension (Track A).

### BP-CHART-002 — Missing Chart Axis Labels or Units
- **Status:** active
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Flags BAR/LINE/SCATTER/AREA/COMBO charts missing a Y-axis title (LEFT_AXIS or RIGHT_AXIS with non-empty title). Also flags absence of data labels as a secondary issue.
- **Why it matters:** "Naked numbers" violate Tufte's core principle. Board members will ask "Is this thousands or millions?" — every time.
- **Evidence:** CHART_EVIDENCE
- **Notes:** Skips PIE/DOUGHNUT charts (no axes). Skips shapes with no chartType. Issues array in observed contains "missing_y_axis_title" and/or "no_data_labels".

---

### Seeds Not Yet Viable

> These were in the original interest list but lack a clear deterministic/heuristic path with current data model capabilities.

- **Slide count / density heuristics** — Too subjective. A 5-slide board update and a 60-slide strategy deck are both valid. No universal threshold works without deck-type context.

---

## Changelog

### 2026-03-31 — Phase 8B Implementation

**Implemented (6 rules, no IR changes required):**
- **BP-TYPO-009** — Bullet Punctuation Consistency (`continuity.ts`): per-box PERIOD/NONE mix; deck-wide when ≥3 classifiable boxes and ≥60% deck majority. `TEXT_STRING_EVIDENCE` added to `EVIDENCE_TYPES`.
- **BP-TYPO-010** — Double Space Detection: trimmed text runs, `/ {2,}/`, one finding per shape.
- **BP-TYPO-011** — Title Terminal Punctuation: TITLE role, paragraph text joined; `?`/`!` exempt.
- **BP-LAYOUT-007** — Left-edge jitter: cluster by `alignmentJitterThreshold` (default 5pt), exclude full-bleed shapes.
- **BP-LAYOUT-008** — Horizontal distribution: Y-band + 20% size similarity, gap mean vs `distributionGapTolerance` (default 4pt).
- **BP-LAYOUT-009** — Slide text density: safe-zone margins via `textDensityMarginPt` / `textDensityMaxRatio`. Tolerance fields in `ToleranceConfig`.

**Tests:** `packages/compiler-core/tests/phase8b-rules.test.ts`

**`PLAYBOOK_RULE_COUNT`:** 26 → 31 (+5 playbook-sourced; TYPO-009 is continuity-only).

### 2026-03-31 — Track A Slice 1 (IR alignment + border)

**Implemented:**
- **BP-TYPO-012** — Text alignment vs exemplar (`checks.ts`); patch op `SET_TEXT_ALIGNMENT` in `shared-types` / compiler safe ops (host apply deferred).
- **BP-COLOR-004** — Border color vs exemplar font/fill palette (`checks.ts`).

**IR / adapters:** `ir.ts`, GAS `Code.gs`, `google-adapter` bridge + mapper, `office-adapter` optional `fill` / `lineFormat` load, `style-map.ts`, `infer-rules.ts` (`alignment` candidate).

**Tests:** `track-a-slice1.test.ts`; `google-adapter` public API mapper test.

**`PLAYBOOK_RULE_COUNT`:** 31 → 32 (+1 playbook-sourced; TYPO-012 is exemplar-only).

### 2026-04-01 — Track A Slice 2 (table cell IR)

**Implemented:**
- **BP-TABLE-001** — Table header fill vs exemplar (`checks.ts`).
- **BP-TABLE-004** — Intra-column horizontal alignment plurality vs outliers (`checks.ts`); patch op `APPLY_MAJORITY_ALIGNMENT`.
- **BP-TABLE-005** — Table cell font vs body style map (`checks.ts`); patch op `SET_TABLE_FONT`.
- **`TABLE_EVIDENCE`** in `shared-types`; `ShapeSnapshot.table` with `TableSnapshot` / `TableCellSnapshot`.

**IR / adapters:** `ir.ts`, GAS `Code.gs` table branch, `google-adapter` bridge + mapper, `office-adapter` table read.

**Tests:** `track-a-slice2.test.ts`; Google adapter TABLE mapping test.

**`PLAYBOOK_RULE_COUNT`:** 32 → 33 (+1 playbook-sourced; BP-TABLE-001 and BP-TABLE-005 are exemplar-sourced).

### 2026-04-01 — Track A Slice 3 — Image Intrinsic Dimensions

Extended IR with `ImageMetadata` on `ShapeSnapshot.imageMetadata`.
GAS bridge extracts dimensions from image binary headers (PNG/JPEG/GIF).
Office adapter: best-effort via `getBase64Image()` and header parsing.

**Unblocks:**

- **BP-LAYOUT-005** — Aspect Ratio Distortion
- **Evidence:** `MEDIA_METADATA` in `shared-types` / patch op `RESTORE_ASPECT_RATIO` (safe; host apply deferred).

**Tests:** `track-a-slice3.test.ts`; Google adapter IMAGE mapping test.

**`PLAYBOOK_RULE_COUNT`:** 33 → 34 (+1 playbook-sourced; BP-LAYOUT-005).

### 2026-04-01 — Track A Slice 4 — Chart Series & Axis Metadata

Extended IR with `ChartSnapshot` (`ChartSeriesSnapshot`, `ChartAxisSnapshot`) on `ShapeSnapshot.chart`.
GAS bridge extracts chart data via Sheets Advanced Service: `SheetsChart.getSpreadsheetId()` + `.getChartId()` → `Sheets.Spreadsheets.get` → `chartSpec.basicChart`. Handles PIE charts separately (no series colors available). Requires `sheets` Advanced Service enabled in `appsscript.json`.

**Unblocks:**

- **BP-CHART-001** — Chart Series Color Off-Palette (error): series colors checked against exemplar palette.
- **BP-CHART-002** — Missing Chart Axis Labels (warn): flags BAR/LINE/SCATTER/AREA/COMBO charts missing Y-axis title or data labels. Skips PIE/DOUGHNUT.
- **Evidence:** `CHART_EVIDENCE` in `shared-types`.

**IR / adapters:** `ir.ts` (ChartSnapshot types), GAS `Code.gs` SHEETS_CHART branch, `google-adapter` bridge + mapper, `appsscript.json` Sheets service. Office adapter: no chart extraction (Office.js API doesn't expose chart series data).

**Tests:** `track-a-slice4.test.ts` (10 tests); fixture helper `createChartShape()`.

**`PLAYBOOK_RULE_COUNT`:** 34 → 39 (+5 playbook-sourced: BP-TABLE-002, BP-TABLE-006, BP-TABLE-007, BP-TABLE-009, BP-CHART-001).

---

### 2026-03-31 — Phase 8A Implementation

**Implemented (5 rules, no IR changes required):**
- **BP-HYGIENE-006** — Draft Tag Remnants: regex scan across all paragraph text, case-insensitive. One finding per shape per match. `PLAYBOOK_RULE_COUNT` bumped to 26.
- **BP-WCAG-001** — Minimum Text Luminance Contrast: WCAG 2.1 luminance formula against solid `fillColor`. Skips semi-transparent runs and shapes with no fill. Configurable via `ToleranceConfig.wcagMinContrastRatio` (default 4.5). `COLOR_EVIDENCE` type added to findings.
- **BP-TYPO-008** — Capitalization Style Inconsistency: classifies each slide title as TITLE_CASE / UPPER_CASE / SENTENCE_CASE / MIXED, majority-votes the dominant style, flags outliers. Min 3 titles required for signal. Does not flag when dominant is MIXED. Known gap: proper nouns mid-sentence cause SENTENCE_CASE to classify as MIXED.
- **BP-CONT-004** — Page Number Gaps or Inconsistencies: scans `FOOTER`-role shapes for standalone integers, flags duplicates and non-sequential gaps. Unnumbered slides between numbered slides do not trigger false positives.
- **BP-CONT-005** — Date/Number Format Inconsistency: regex extraction of date (ISO, LONG_US, DMY_DASH_ALPHA, MDY/DMY_SLASH) and number (COMMA/DOT/NO_SEPARATOR) patterns. Majority-vote dominant, flags minority occurrences. Min 3 examples per category required. Ambiguous slash dates (e.g. 05/06/2024) are skipped.

**Tests:** `packages/compiler-core/tests/phase8a-rules.test.ts` — 15 tests, all passing.

**Blocked rules (require IR extension — deferred):** BP-TYPO-006 (text bounds), BP-TYPO-007 (rendered line breaks), BP-LAYOUT-006 (exemplar boundary scan), BP-HYGIENE-007 (config extension), BP-TABLE-002 (table border schema vs exemplar).

---

### 2026-03-31 — Rule Calibration Session

**Modified rules:**
- **BP-TYPO-005** — Expanded scope to include space before/after paragraph in addition to line spacing. Renamed to "Line Spacing and Paragraph Spacing Mismatch." Real-world authors often adjust paragraph spacing instead of line spacing, producing the same visual problem.
- **BP-COLOR-003** — Rethought check entirely: now flags any shape fill color not present in the slide master palette, rather than comparing against exemplar. Broadened from callout boxes to all shapes. Source changed from `exemplar` to `playbook`.
- **BP-CONT-002** — Loosened matching from exact string to fuzzy/substring. Added breadcrumbs as secondary reference signal when present.
- **BP-COVERAGE-001** — Upgraded from generic warning count to full audit trail: surfaces reason subcategory + slide number + object identifier for every skipped object.
- **BP-TYPO-007** — Renamed to "Paragraph Orphan, Widow, and Hanging Line Detection" to better reflect all cases covered.
- **BP-LAYOUT-006** — Source changed from `playbook` to `exemplar`. Margin threshold now derived from exemplar boundary scan rather than hardcoded 0.5" default.

**Promoted from proposed to active:**
- BP-LAYOUT-005 — Aspect Ratio Distortion (Tier 1)
- BP-HYGIENE-006 — Draft Tag Remnants (Tier 1)
- BP-WCAG-001 — Minimum Text Luminance Contrast (Tier 1, moved to new Accessibility section)
- BP-CONT-004 — Page Number Gaps or Inconsistencies (Tier 1)
- BP-HYGIENE-007 — Confidentiality Label Missing on Some Slides (Tier 1, logic changed to self-referencing: only activates if at least one slide already has a label)
- BP-TYPO-006 — Text Container Overflow (Tier 2)
- BP-TYPO-008 — Capitalization Style Inconsistency (Tier 2)
- BP-CONT-005 — Date/Number Format Inconsistency (Tier 2)

**Cut rules:**
- **BP-COLOR-002** — Semi-Transparent Text: semi-transparent text is intentional design; fully transparent text is already covered by BP-HYGIENE-001.
- **BP-HYGIENE-005** — Inconsistent Proofing Language: too technical/invisible to end users to be useful signal.
- **BP-TABLE-001 (original)** — Financial Number Right-Alignment: too many legitimate exceptions (centered numbers are valid in many table styles).
- **BP-WCAG-002** — Linear Reading Order Compliance: z-order assumption breaks too easily with real deck construction patterns (custom subtitle boxes, intentional stacking).

**New proposed rules:**
- BP-TABLE-001 — Table Header Fill Color (exemplar-driven, requires DeckSnapshot table cell property extension)
- BP-TABLE-002 — Table Border Color Consistency (exemplar-driven, requires DeckSnapshot table cell property extension)

**Removed from Seeds Not Yet Viable:**
- Chart/table formatting standards — now viable via exemplar approach once DeckSnapshot is extended. Promoted to proposed rules BP-TABLE-001 and BP-TABLE-002.
