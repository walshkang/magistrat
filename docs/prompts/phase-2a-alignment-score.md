# Phase 2A: Alignment Score

## What you're building

An alignment score that shows users what percentage of their deck's analyzed objects have no style issues. It appears as a progress bar at the top of the sidebar, updates live after every scan, and motivates users to fix findings.

## Contract (locked)

### 1. `packages/compiler-core/src/alignment-score.ts` (new file)

```ts
import type { CoverageSnapshot, Finding } from "@magistrat/shared-types";

export interface AlignmentScore {
  /** 0–100, rounded integer */
  score: number;
  /** Objects that were analyzed (denominator) */
  analyzedObjects: number;
  /** Objects with zero actionable findings */
  passingObjects: number;
  /** analyzedObjects - passingObjects */
  failingObjects: number;
}

/**
 * Computes alignment score from findings and coverage.
 *
 * Formula: score = (analyzedObjects - failingObjects) / analyzedObjects * 100
 *
 * Rules:
 * - Only findings with coverage === "ANALYZED" count as actionable.
 *   NOT_ANALYZED findings (BP-COVERAGE-001) are excluded entirely.
 * - Per-object dedup: an object with 3 findings counts as 1 failing object.
 *   Object identity = slideId + objectId.
 * - If analyzedObjects === 0, score = 100 (nothing to fail).
 */
export function computeAlignmentScore(
  findings: Finding[],
  coverage: CoverageSnapshot
): AlignmentScore;
```

Export from `packages/compiler-core/src/public-api.ts`:
```ts
export { computeAlignmentScore } from "./alignment-score.js";
export type { AlignmentScore } from "./alignment-score.js";
```

### 2. Tests — `packages/compiler-core/src/alignment-score.test.ts`

Cover these cases:
- Zero findings → score 100
- All objects failing → score 0
- Mixed: e.g. 8 analyzed, 2 failing → score 75
- NOT_ANALYZED findings are excluded (don't inflate failingObjects)
- Multiple findings on same object count as 1 failing object
- Zero analyzed objects → score 100

### 3. Thread score through `AnalysisState`

In `apps/slides-addon/src/hooks/useAnalysis.ts`:

Add to `AnalysisState` interface:
```ts
import type { AlignmentScore } from "@magistrat/compiler-core";

export interface AnalysisState {
  // ... existing fields ...
  alignmentScore: AlignmentScore;
}
```

Compute it in `analyzeDeckSnapshot` after `runChecks`:
```ts
import { computeAlignmentScore } from "@magistrat/compiler-core";

// inside analyzeDeckSnapshot, after const checks = runChecks(...)
const alignmentScore = computeAlignmentScore(checks.findings, checks.coverage);
```

Add it to the returned `analysis` object. Also add a default in `hydrateAnalysisState` (stale state): `alignmentScore: { score: 0, analyzedObjects: 0, passingObjects: 0, failingObjects: 0 }`.

### 4. UI — `apps/slides-addon/src/components/AlignmentScoreBar.tsx` (new file)

A simple component that renders above the summary panel in App.tsx.

Props:
```ts
interface AlignmentScoreBarProps {
  score: AlignmentScore;
}
```

Markup:
```tsx
<div className="alignment-score">
  <div className="alignment-score__header">
    <span className="alignment-score__label">Alignment</span>
    <span className="alignment-score__value">{score.score}%</span>
  </div>
  <div className="alignment-score__bar">
    <div
      className={`alignment-score__fill alignment-score__fill--${tier}`}
      style={{ width: `${score.score}%` }}
    />
  </div>
  <p className="alignment-score__detail">
    {score.passingObjects} of {score.analyzedObjects} objects aligned
  </p>
</div>
```

Tier logic: `score >= 80 → "good"`, `score >= 50 → "fair"`, else `"poor"`.

### 5. CSS — append to `apps/slides-addon/src/styles.css`

```css
/* —— Alignment Score —— */
.alignment-score {
  padding: 12px;
  background: var(--surface-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}
.alignment-score__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}
.alignment-score__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.alignment-score__value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}
.alignment-score__bar {
  height: 6px;
  background: var(--surface-inset);
  border-radius: 3px;
  overflow: hidden;
}
.alignment-score__fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.alignment-score__fill--good { background: var(--status-pass); }
.alignment-score__fill--fair { background: var(--status-warn); }
.alignment-score__fill--poor { background: var(--status-error); }
.alignment-score__detail {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-tertiary);
}
```

### 6. Wire into App.tsx

Import `AlignmentScoreBar` and render it immediately after the `{analysisState ? (` block opens, before the `<section className="summary-panel">`:

```tsx
import { AlignmentScoreBar } from "./components/AlignmentScoreBar.js";

// inside the analysisState truthy branch, first child:
<AlignmentScoreBar score={analysisState.alignmentScore} />
```

### 7. Copy rename

In App.tsx, rename the apply button label:
- `"Apply fixes"` → `"Apply Recommended Fixes"`

Specifically this line:
```tsx
Apply fixes ({safePatchCount})
```
becomes:
```tsx
Apply Recommended Fixes ({safePatchCount})
```

## Files to create
- `packages/compiler-core/src/alignment-score.ts`
- `packages/compiler-core/src/alignment-score.test.ts`
- `apps/slides-addon/src/components/AlignmentScoreBar.tsx`

## Files to modify
- `packages/compiler-core/src/public-api.ts` — add export
- `apps/slides-addon/src/hooks/useAnalysis.ts` — add to AnalysisState, compute in analyzeDeckSnapshot, default in hydrateAnalysisState
- `apps/slides-addon/src/App.tsx` — import + render AlignmentScoreBar, rename button copy
- `apps/slides-addon/src/styles.css` — append alignment score CSS

## Done when
- `computeAlignmentScore` passes all test cases
- Score bar renders at top of findings view after a scan
- Green/yellow/red tiers work visually
- Button says "Apply Recommended Fixes"
- No regressions — existing tests still pass
