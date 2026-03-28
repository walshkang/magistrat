# Phase 3: "Navigate" — Interactive Minimap + Per-Slide Filtering

## What you're building

A horizontal minimap strip showing all slides with per-slide compliance status. Clicking a slide filters the findings panel to just that slide. This makes Magistrat contextual — users focus on one slide at a time instead of scrolling a wall of findings.

---

## 1. Per-slide status utility

Create `apps/slides-addon/src/utils/slideStatus.ts`:

```ts
import type { Finding, DeckSnapshot } from "@magistrat/shared-types";

export type SlideStatus = "pass" | "warn" | "error" | "not-analyzed";

export interface SlideStatusEntry {
  slideId: string;
  slideIndex: number;
  title: string;
  status: SlideStatus;
  findingCount: number;
}

/**
 * Compute per-slide status from findings and deck.
 *
 * Rules:
 * - "error": slide has at least one finding with severity === "error"
 * - "warn": slide has at least one finding with severity === "warn" (and no errors)
 * - "not-analyzed": slide has ONLY NOT_ANALYZED findings (no actionable findings)
 * - "pass": slide has zero findings, or all findings are NOT_ANALYZED and at least
 *   one object was analyzed (i.e., the slide appears in the deck but not in findings)
 *
 * Slides with no findings at all are "pass".
 */
export function computeSlideStatuses(
  findings: Finding[],
  deck: DeckSnapshot
): SlideStatusEntry[];
```

Logic:
1. Group findings by slideId.
2. For each slide in deck (sorted by index):
   - Filter findings for this slide.
   - Separate into actionable (`coverage === "ANALYZED"`) and not-analyzed.
   - If any actionable finding has `severity === "error"` → status `"error"`.
   - Else if any actionable finding has `severity === "warn"` → status `"warn"`.
   - Else if only not-analyzed findings exist → status `"not-analyzed"`.
   - Else → status `"pass"`.
   - `findingCount` = number of actionable findings only.

---

## 2. Minimap component

Create `apps/slides-addon/src/components/Minimap.tsx`:

```tsx
import type { SlideStatusEntry } from "../utils/slideStatus.js";

interface MinimapProps {
  slides: SlideStatusEntry[];
  selectedSlideId: string | null;
  onSelectSlide: (slideId: string | null) => void;
}
```

**Markup:**
```tsx
<nav className="minimap" aria-label="Slide minimap">
  <div className="minimap__strip">
    {slides.map((slide) => (
      <button
        key={slide.slideId}
        type="button"
        className={`minimap__slide ${
          selectedSlideId === slide.slideId ? "minimap__slide--selected" : ""
        }`}
        onClick={() =>
          onSelectSlide(selectedSlideId === slide.slideId ? null : slide.slideId)
        }
        title={`${slide.title || `Slide ${slide.slideIndex}`} — ${slide.findingCount} findings`}
        aria-pressed={selectedSlideId === slide.slideId}
      >
        <span className="minimap__index">{slide.slideIndex}</span>
        <span className={`minimap__dot minimap__dot--${slide.status}`} aria-hidden />
      </button>
    ))}
  </div>
  {selectedSlideId !== null ? (
    <button
      type="button"
      className="minimap__clear btn-ghost btn-sm"
      onClick={() => onSelectSlide(null)}
    >
      Show all slides
    </button>
  ) : null}
</nav>
```

**Behavior:**
- Click a slide → sets it as selected (filters findings below). Click again → deselects (shows all).
- "Show all slides" link appears when filtering is active.
- The strip scrolls horizontally if there are many slides (overflow-x: auto).

---

## 3. Filter state in App.tsx

Add to App.tsx:
```tsx
const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
```

Compute slide statuses (memoized):
```tsx
import { computeSlideStatuses } from "./utils/slideStatus.js";
import { Minimap } from "./components/Minimap.js";

const slideStatuses = useMemo(() => {
  if (!analysisState || !deck) return [];
  return computeSlideStatuses(analysisState.findings, deck);
}, [analysisState, deck]);
```

Compute filtered findings:
```tsx
const filteredFindings = useMemo(() => {
  if (!analysisState) return [];
  if (!selectedSlideId) return analysisState.findings;
  return analysisState.findings.filter(f => f.slideId === selectedSlideId);
}, [analysisState, selectedSlideId]);
```

---

## 4. Render minimap + pass filtered findings

Place the Minimap after the Alignment Score bar and before the summary panel, inside the `{analysisState ? (` block:

```tsx
{analysisState ? (
  <>
    <AlignmentScoreBar score={analysisState.alignmentScore} />

    {slideStatuses.length > 0 ? (
      <Minimap
        slides={slideStatuses}
        selectedSlideId={selectedSlideId}
        onSelectSlide={setSelectedSlideId}
      />
    ) : null}

    <section className={`summary-panel ...`}>
      {/* ... existing summary panel ... */}
    </section>

    {/* ... linter stream section ... */}
```

**Update FindingsPanel usage** to pass filtered findings instead of all findings:

```tsx
<FindingsPanel
  findings={filteredFindings}
  deck={deck}
  onApplyFinding={(id) => void applyForFinding(id)}
/>
```

**Update the findings count displays** to reflect filtering. In the summary panel meta line:

```tsx
// When filtering, show filtered count / total count
const displayFindings = filteredFindings.filter(f => f.coverage === "ANALYZED");
const totalActionable = analysisState.findings.filter(f => f.coverage === "ANALYZED").length;

// In the summary panel:
<p className="summary-panel__meta">
  {selectedSlideId
    ? `${displayFindings.length} of ${totalActionable} findings (filtered)`
    : `${totalActionable} ${totalActionable === 1 ? "finding" : "findings"}`}
</p>
```

Also update the risk breakdown to use `filteredFindings`:
```tsx
const findingsRiskCounts = useMemo(() => {
  const source = selectedSlideId
    ? filteredFindings.filter(f => f.coverage === "ANALYZED")
    : (analysisState?.findings.filter(f => f.coverage === "ANALYZED") ?? []);
  let safe = 0, caution = 0, manual = 0;
  for (const f of source) {
    if (f.risk === "safe") safe++;
    else if (f.risk === "caution") caution++;
    else manual++;
  }
  return { safe, caution, manual };
}, [analysisState, filteredFindings, selectedSlideId]);
```

**"Apply Recommended Fixes" button** should still apply ALL safe patches (not just filtered), since partial apply would be confusing. Keep `applySafe()` as-is. But update the count to show the global count:
```tsx
Apply Recommended Fixes ({safePatchCount})
```
This stays unchanged — `safePatchCount` is already computed from `analysisState.safePatches`.

---

## 5. CSS

Append to `apps/slides-addon/src/styles.css`:

```css
/* —— Minimap —— */
.minimap {
  padding: 8px 12px;
  background: var(--surface-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}
.minimap__strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.minimap__slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px 6px;
  border: none;
  background: var(--surface-inset);
  border-radius: var(--radius-sm);
  cursor: pointer;
  min-width: 32px;
  transition: background 0.15s ease;
}
.minimap__slide:hover {
  background: var(--surface-card-hover);
}
.minimap__slide--selected {
  background: var(--surface-card);
  box-shadow: 0 0 0 2px var(--accent);
}
.minimap__index {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1;
}
.minimap__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.minimap__dot--pass {
  background: var(--status-pass);
}
.minimap__dot--warn {
  background: var(--status-warn);
}
.minimap__dot--error {
  background: var(--status-error);
}
.minimap__dot--not-analyzed {
  background: var(--status-muted);
}
.minimap__clear {
  display: block;
  margin-top: 6px;
  font-size: 11px;
}
```

---

## 6. Reset filter after scan

When `runCleanup` completes (re-scan), reset the slide filter so the user sees all findings:

In App.tsx, add after `setAnalysisState`:
```tsx
// Inside the useEffect or wherever analysisState is set after a scan:
setSelectedSlideId(null);
```

The cleanest way: in the `runCleanup` callback in `useAnalysis.ts`, the caller (App.tsx) can reset the filter. Since `runCleanup` is async and doesn't return the new analysis directly, reset the filter in the `useEffect` that watches `analysisState`:

```tsx
useEffect(() => {
  if (analysisState && !hasCollapsedExemplarAfterScanRef.current) {
    setExemplarExpanded(false);
    hasCollapsedExemplarAfterScanRef.current = true;
  }
  // Reset slide filter on new scan results
  setSelectedSlideId(null);
}, [analysisState]);
```

Actually, only reset on fresh scans (not stale hydration). Check `analysisState.stale`:
```tsx
useEffect(() => {
  if (analysisState && !analysisState.stale) {
    setSelectedSlideId(null);
  }
  if (analysisState && !hasCollapsedExemplarAfterScanRef.current) {
    setExemplarExpanded(false);
    hasCollapsedExemplarAfterScanRef.current = true;
  }
}, [analysisState]);
```

---

## Files to create
- `apps/slides-addon/src/utils/slideStatus.ts`
- `apps/slides-addon/src/components/Minimap.tsx`
- `apps/slides-addon/src/utils/slideStatus.test.ts` — tests for computeSlideStatuses

## Files to modify
- `apps/slides-addon/src/App.tsx` — filter state, minimap wiring, filtered findings
- `apps/slides-addon/src/styles.css` — minimap CSS

## Tests for slideStatus.ts
1. All slides pass (no findings) → all "pass"
2. Slide with error severity finding → "error"
3. Slide with warn only → "warn"
4. Slide with only NOT_ANALYZED findings → "not-analyzed"
5. Mixed: some slides pass, some warn, some error
6. Empty deck → empty array

## Done when
- Minimap strip renders after scan with colored dots per slide
- Clicking a slide filters findings panel to that slide only
- "Show all slides" link clears the filter
- Summary panel meta shows "X of Y findings (filtered)" when filtering
- Filter resets on re-scan
- Per-finding Apply still works within filtered view
- No regressions
