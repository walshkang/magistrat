# Phase 6: "Complete" — Full Rules + Office Write

**Appetite:** 6 weeks
**Value:** Enterprise completeness — 24/24 rules, Office write mode, taskpane UI parity

## Pre-slice: "Not Analyzed" UX Clarity (quick win, do first)

The current "Not analyzed" findings lump together three different situations:
1. **Can't inspect** — object type unsupported, grouped, autofit, API limitation
2. **Can't match** — low role confidence, missing style map entry, ambiguous text
3. **No rule yet** — we simply don't have a check for this pattern

Users see a wall of "Not analyzed" and think the tool is broken, not that it's honestly scoping. Fix:
- Split NOT_ANALYZED translator messages into these three buckets
- Add a brief "what Magistrat checks" summary to the empty/all-clear state
- Consider collapsing NOT_ANALYZED items by default (show count, expand on click)

## Slices

### 6A: Tolerance Config (1 week)
- `ToleranceConfig` type in `shared-types/src/tolerance.ts`
- Per-role thresholds from `docs/BEST_PRACTICES_PLAYBOOK.md` (fontSizePt, positionPt, geometryMicroSnapDeltaPt)
- Thread through `runChecks()` replacing all hardcoded values in `checks.ts`
- Default config factory matching current playbook values
- **Done when:** All thresholds sourced from config, existing tests still pass, new tests cover per-role overrides

### 6B: Layout Rules — 3 new rules (2 weeks, depends on 6A)
- **BP-LAYOUT-001** — Title geometry detection (position band vs exemplar)
- **BP-LAYOUT-002** — Footer geometry detection
- **BP-LAYOUT-003** — Micro-snap geometry normalization (exemplar-only, 0.5pt tolerance)
- IR extension: add `slideWidth`, `slideHeight` to `SlideSnapshot`
- Geometry band clustering utility (median/centroid per role across exemplar)
- Finding translator entries for all 3
- **Done when:** Layout findings emitted for mispositioned objects, translator entries, tests covering band detection + tolerance

### 6C: Remaining Rules — 4 new rules (1 week, parallel with 6B)
- **BP-CONT-003** — Section header archetype consistency
- **BP-SAFETY-001** — Never break groups (report-only, no patch)
- **BP-MASTERS-001** — Masters/layout hygiene (report-only)
- Finding translator entries for all 3
- Note: BP-COVERAGE-001 already exists in checks.ts
- **Done when:** 24/24 rules (counting BP-COVERAGE-001), translator entries, tests

### 6D: Office SAFE Write (1.5 weeks)
- New `OfficeSafeProvider` in `office-adapter/src/providers/`
- Office.js `context.sync` batching for apply
- Revision guard (shape signature before/after)
- Policy unlock: `livePatchApply` flag enabled for SAFE mode
- **Done when:** `applyPatchOps` works through Office.js, safe ops only, revision guard tested

### 6E: Taskpane UI Parity (1.5 weeks, depends on 6D)
- Port from slides-addon: FindingsPanel, FindingCard, SlideGroup, AlignmentScoreBar, Minimap, ExceptionsPanel, ChangeHistory, ErrorBoundary, DevModeToggle
- Wire to office-adapter instead of google-adapter
- Shared styles (copy or extract to shared package)
- **Done when:** Taskpane matches sidebar feature set, wired to office-adapter, `npm run check` passes

## Suggested Order

```
Week 1:     6A (Tolerance Config)
Week 2-3:   6B (Layout Rules) || 6C (Remaining Rules)
Week 4-5:   6D (Office SAFE Write)
Week 5-6:   6E (Taskpane UI Parity)
```

## Stats Target
- 24/24 rules implemented
- compiler-core coverage >= 90%
- Office SAFE functional
- Taskpane matches sidebar

---

## Post-v1 Roadmap: Customizable Rulesets + Exemplar Inference

These are post-Phase 6 features surfaced during real-doc testing (2026-03-28).

### Phase 7A: Exemplar-Driven Rule Inference
**Problem:** Users scan a deck and get findings, but Magistrat's rules are fixed. Real decks have house styles that don't map 1:1 to the playbook — breadcrumb positioning, logo placement, custom bullet styles.

**Approach:**
1. After scanning an exemplar slide, Magistrat infers "candidate best practices" from what it observes (font patterns, position bands, spacing, color palette)
2. Present these as a checklist: "We detected these patterns in your exemplar — which should be enforced?"
3. User confirms/adjusts, creating a custom `RuleProfile` stored in document state
4. Subsequent scans check against the profile, not just the hardcoded playbook

**Value:** Magistrat adapts to each team's style guide instead of imposing one.

### Phase 7B: Custom Rule Editor
**Problem:** Power users want to add rules the exemplar can't express (e.g., "logo must be in bottom-right quadrant", "no text smaller than 10pt anywhere").

**Approach:**
- Simple constraint builder UI: pick a property (font size, position, color) + operator (equals, within range, matches palette) + value
- Stored as `CustomRule[]` in document state alongside `RuleProfile`
- Evaluated in `runChecks` alongside built-in rules

### Phase 7C: Rule Profiles as Templates
- Export/import `RuleProfile` as JSON
- Share across presentations ("Company X compliance profile")
- Eventually: team-level profiles stored externally

### Phase 7D: Slide Master / Layout Generation
**Problem:** Magistrat detects drift after the fact. Slide masters prevent drift at the source — but creating them is tedious manual work. Most teams have an exemplar deck but no formal master.

**Approach:**
1. Scan exemplar slide → extract full style map + position bands per role
2. Generate a slide master/layout with typed placeholders that bake in the exemplar's formatting:
   - Title placeholder at exact position/size with correct font/size/color
   - Body/bullet placeholders with correct indent levels, spacing, glyph
   - Footer/logo zones at correct positions
   - Color palette from exemplar fills and text colors
3. **Google Slides:** Use Slides API (not Apps Script) to create/update master via batch requests
4. **PowerPoint:** Generate a .pptx slide layout via Open XML SDK or python-pptx
5. User applies the generated master to their deck → new slides auto-conform

**Value:** Shifts from "detect and fix" to "prevent." Magistrat becomes the bridge between "we have an exemplar deck" and "we have an enforced brand template." Findings drop dramatically because the master does the enforcement.

**Dependency:** Needs the style map + position band extraction from Phase 6A/6B. The generation step is new infrastructure but the analysis is already there.

**Risk:** Slides API (not Apps Script SlidesApp) is needed for master manipulation — requires OAuth scope escalation and possibly a backend. PowerPoint is more tractable via file generation.

### Phase 7E: LLM-Assisted Deck Cleanup (Claude Skill / Generic LLM Instruction)
**Problem:** Users often have content in markdown, docs, or LLM output that needs to land in a slide deck. The content is right but the formatting is wrong — pasted text doesn't match the exemplar style, bullets are flat, titles are unstyled. Manually reformatting is the exact tedium Magistrat exists to kill.

**Approach:**
1. **Claude Code skill / system prompt** that understands the Magistrat style map format and can translate markdown → structured slide content with correct role assignments
2. **Input:** Markdown (or raw LLM output) + Magistrat style map JSON (extracted from exemplar scan)
3. **Output:** Slide-ready content with role annotations (title, subtitle, body, bullet_l1/l2, footer, callout) and the correct style tokens applied — either as:
   - Slides API batch request JSON (for direct injection)
   - Formatted paste instructions (for manual apply)
   - PatchOps that Magistrat can apply via the existing SAFE pipeline
4. **Generic LLM instruction variant:** A portable system prompt (not Claude-specific) that any LLM can use to produce Magistrat-compatible output given a style map

**Value:** Closes the "content creation → formatting" gap. Instead of: write content → paste into slides → run Magistrat → fix findings, it becomes: write content → LLM formats it per style map → paste into slides → Magistrat confirms zero findings.

**Dependency:** Needs the style map export from Phase 6A and the role vocabulary from shared-types. The skill itself is orthogonal to the sidebar — it's a standalone tool that produces input for Magistrat's pipeline.
