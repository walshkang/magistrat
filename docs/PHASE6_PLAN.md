# Phase 6: "Complete" — Full Rules + Office Write

**Appetite:** 6 weeks
**Value:** Enterprise completeness — 24/24 rules, Office write mode, taskpane UI parity

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
