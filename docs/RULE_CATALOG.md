# Magistrat Rule Catalog

> **Purpose:** Single source of truth for all compliance rules. Designed for human review AND agent consumption.
> Edit this file to propose new rules, modify existing ones, or flag removals. Use the status field to track lifecycle.
>
> **Re-import:** Any agent can read this file, diff it against `checks.ts` / `continuity.ts`, and generate implementation code for new/changed rules.

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
- **Notes:** Needs API investigation — confirm intrinsic image dimensions are readable from Slides API / OOXML. Auto-fix restores height based on current width to match original ratio. Threshold: abs(original ratio - rendered ratio) > 0.01.

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

### BP-TYPO-009 — Bullet Punctuation Consistency
- **Status:** proposed
- **Source:** continuity
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Scans terminal characters of level-0 bullet items within each text block and across the deck, flagging mixed punctuation (e.g., some ending with `.`, some bare)
- **Why it matters:** Mixed terminal punctuation is a glaring sign of copy-pasted content from multiple authors. Execs zero in on this kind of syntactic sloppiness.
- **Evidence:** TEXT_STRING_EVIDENCE, STRUCTURAL_EVIDENCE
- **Notes:** Majority-vote per text box first, then deck-wide. Ignore sub-bullets (level ≥ 1) — they legitimately follow different rules. Buildable now (no IR changes).

### BP-LAYOUT-007 — Left-Edge Misalignment ("Jitter" Check)
- **Status:** proposed
- **Source:** playbook
- **Severity:** warn
- **Risk:** caution
- **Auto-fix:** yes (SNAP_TO_X)
- **Type:** deterministic
- **What it checks:** Groups text boxes and shapes by approximate X-coordinate (within a 5pt cluster threshold); flags objects whose left edge deviates from the group mode by 1–5pt
- **Why it matters:** The human eye catches jitter instantly when scanning down a slide. A 2pt drift breaks the invisible grid that makes a deck look deliberate.
- **Evidence:** GEOMETRIC_EVIDENCE
- **Notes:** Auto-fix snaps outlier X to the mode of the cluster. Caution risk — snapping may be wrong if objects are intentionally offset (e.g., indented callouts). Buildable now (no IR changes).

### BP-TABLE-001 — Table Header Fill Color
- **Status:** proposed
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
- **Status:** proposed
- **Source:** exemplar
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Table border colors (per edge: top/bottom/left/right) differ from the exemplar's table border schema
- **Why it matters:** Border color discipline (black vs. white vs. transparent) defines the visual hierarchy of financial and data tables. Mixed borders signal template mixing.
- **Evidence:** EXEMPLAR_EVIDENCE, TABLE_EVIDENCE
- **Notes:** Requires DeckSnapshot extension to capture per-edge border color and style per cell. Both OOXML and Slides API expose border properties at the cell level.

---

### Tier 2 — Good to Have

### BP-TYPO-010 — Double Space Detection
- **Status:** proposed
- **Source:** playbook
- **Severity:** info
- **Risk:** safe
- **Auto-fix:** yes (REPLACE_DOUBLE_SPACE)
- **Type:** deterministic
- **What it checks:** Scans all text runs for two or more consecutive space characters
- **Why it matters:** Double spaces after periods are an outdated typist convention that breaks text alignment and justification on modern slides.
- **Evidence:** PLAYBOOK_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** Highly reliable regex. Auto-fix is universally safe. Buildable now (no IR changes).

### BP-CHART-001 — Chart Series Color Off-Palette
- **Status:** proposed
- **Source:** playbook
- **Severity:** error
- **Risk:** manual
- **Auto-fix:** no
- **Type:** deterministic
- **What it checks:** Fill colors of chart data series (bars, pie slices, lines) checked against the slide master or exemplar color palette
- **Why it matters:** Charts pasted from Excel carry Microsoft's default blue/orange/gray palette, destroying the F100 brand system on every data slide.
- **Evidence:** COLOR_EVIDENCE, CHART_EVIDENCE
- **Notes:** Blocked — requires DeckSnapshot extension to read chart series properties. OOXML (`<c:chart>`) and Slides API both expose series colors. Same IR extension needed as TABLE-001/002.

---

### Tier 3 — Nice to Have

### BP-CHART-002 — Missing Chart Axis Labels or Units
- **Status:** proposed
- **Source:** playbook
- **Severity:** warn
- **Risk:** manual
- **Auto-fix:** no
- **Type:** heuristic
- **What it checks:** Flags column/line/scatter charts that lack a Y-axis title, or whose data labels contain no recognizable unit token (`$`, `%`, `M`, `B`, `K`)
- **Why it matters:** "Naked numbers" violate Tufte's core principle. Board members will ask "Is this thousands or millions?" — every time.
- **Evidence:** CHART_EVIDENCE, TEXT_STRING_EVIDENCE
- **Notes:** Blocked — requires chart metadata extraction. False positives likely for index scores or ratios; manual review required.

---

### Seeds Not Yet Viable

> These were in the original interest list but lack a clear deterministic/heuristic path with current data model capabilities.

- **Slide count / density heuristics** — Too subjective. A 5-slide board update and a 60-slide strategy deck are both valid. No universal threshold works without deck-type context.

---

## Changelog

### 2026-03-31 — Phase 8A Implementation

**Implemented (5 rules, no IR changes required):**
- **BP-HYGIENE-006** — Draft Tag Remnants: regex scan across all paragraph text, case-insensitive. One finding per shape per match. `PLAYBOOK_RULE_COUNT` bumped to 26.
- **BP-WCAG-001** — Minimum Text Luminance Contrast: WCAG 2.1 luminance formula against solid `fillColor`. Skips semi-transparent runs and shapes with no fill. Configurable via `ToleranceConfig.wcagMinContrastRatio` (default 4.5). `COLOR_EVIDENCE` type added to findings.
- **BP-TYPO-008** — Capitalization Style Inconsistency: classifies each slide title as TITLE_CASE / UPPER_CASE / SENTENCE_CASE / MIXED, majority-votes the dominant style, flags outliers. Min 3 titles required for signal. Does not flag when dominant is MIXED. Known gap: proper nouns mid-sentence cause SENTENCE_CASE to classify as MIXED.
- **BP-CONT-004** — Page Number Gaps or Inconsistencies: scans `FOOTER`-role shapes for standalone integers, flags duplicates and non-sequential gaps. Unnumbered slides between numbered slides do not trigger false positives.
- **BP-CONT-005** — Date/Number Format Inconsistency: regex extraction of date (ISO, LONG_US, DMY_DASH_ALPHA, MDY/DMY_SLASH) and number (COMMA/DOT/NO_SEPARATOR) patterns. Majority-vote dominant, flags minority occurrences. Min 3 examples per category required. Ambiguous slash dates (e.g. 05/06/2024) are skipped.

**Tests:** `packages/compiler-core/tests/phase8a-rules.test.ts` — 15 tests, all passing.

**Blocked rules (require IR extension — deferred):** BP-TYPO-006 (text bounds), BP-TYPO-007 (rendered line breaks), BP-LAYOUT-005 (intrinsic image dimensions), BP-LAYOUT-006 (exemplar boundary scan), BP-HYGIENE-007 (config extension), BP-TABLE-001/002 (table cell model).

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
