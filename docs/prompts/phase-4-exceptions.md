# Phase 4: "Exceptions" — Ignore Workflow + Score Adjustment

## What you're building

A "boss override" for intentional deviations. Users can ignore findings they don't want to fix — ignored findings stop penalizing the alignment score and stop blocking ratify. An exceptions panel lets users review and un-ignore.

---

## 1. Schema extension

In `packages/shared-types/src/state.ts`, add:

```ts
export interface IgnoredFinding {
  /** The finding.id (stable hash — survives re-scans) */
  findingId: string;
  /** When the user ignored it */
  ignoredAtIso: string;
  /** Optional user-provided rationale */
  note?: string;
}
```

Add to `DocumentStateV1`:
```ts
export interface DocumentStateV1 {
  // ... existing fields ...
  ignoredFindings: IgnoredFinding[];
}
```

**Migration:** Existing documents won't have `ignoredFindings`. In `loadDocumentState` (google-adapter), default to `[]` if missing:
```ts
ignoredFindings: parsed.ignoredFindings ?? []
```

---

## 2. Score adjustment

In `packages/compiler-core/src/alignment-score.ts`, update `computeAlignmentScore` to accept ignored finding IDs:

```ts
export function computeAlignmentScore(
  findings: Finding[],
  coverage: CoverageSnapshot,
  ignoredFindingIds?: ReadonlySet<string>
): AlignmentScore {
```

In the failing-objects loop, skip ignored findings:
```ts
for (const f of findings) {
  if (f.coverage !== "ANALYZED" || f.objectId === undefined) continue;
  if (ignoredFindingIds?.has(f.id)) continue;  // NEW: skip ignored
  failingKeys.add(objectKey(f.slideId, f.objectId));
}
```

**Update tests** in `alignment-score.test.ts`:
- Add test: findings with ignored IDs are excluded from failing count
- Add test: ignoring all findings on an object makes it pass

---

## 3. Thread ignored set through the UI

In `apps/slides-addon/src/App.tsx`:

Compute the ignored set (memoized):
```tsx
const ignoredFindingIds = useMemo(
  () => new Set((documentState?.ignoredFindings ?? []).map(ig => ig.findingId)),
  [documentState?.ignoredFindings]
);
```

**Update `AnalysisState`** in `useAnalysis.ts` — no change needed. The alignment score is recomputed in App.tsx or wherever it's consumed. Actually, it's computed inside `analyzeDeckSnapshot`. We need to thread `ignoredFindingIds` through.

**Better approach:** Compute alignment score in App.tsx (where we have both `analysisState` and `documentState`), not in the hook. This avoids threading ignored state into the analysis pipeline.

Add to App.tsx:
```tsx
import { computeAlignmentScore } from "@magistrat/compiler-core";

const adjustedAlignmentScore = useMemo(() => {
  if (!analysisState) return null;
  return computeAlignmentScore(
    analysisState.findings,
    analysisState.coverage,
    ignoredFindingIds
  );
}, [analysisState, ignoredFindingIds]);
```

Pass `adjustedAlignmentScore` to `AlignmentScoreBar` instead of `analysisState.alignmentScore`.

**Update canRatify** to exclude ignored findings:
```tsx
const canRatify = Boolean(
  analysisState &&
  documentState &&
  analysisState.findings.filter(
    f => f.coverage === "ANALYZED" && !ignoredFindingIds.has(f.id)
  ).length === 0
);
```

---

## 4. Ignore action on FindingCard

Add an `onIgnore` callback to `FindingCardProps`:

```tsx
export interface FindingCardProps {
  finding: Finding;
  onApply?: () => void;
  onIgnore?: () => void;
  isIgnored?: boolean;
}
```

In the FindingCard render, add an ignore button for non-ignored actionable findings, and an "ignored" badge for ignored ones:

```tsx
{/* After the apply button */}
{!isIgnored && onIgnore && finding.coverage === "ANALYZED" ? (
  <button type="button" className="btn-ghost btn-sm" onClick={onIgnore}>
    Ignore
  </button>
) : null}

{isIgnored ? (
  <span className="finding-card__ignored-badge">Ignored</span>
) : null}
```

**Wire in App.tsx / FindingsPanel:**

Add `ignoreFinding` callback in App.tsx:
```tsx
const ignoreFinding = useCallback((findingId: string) => {
  if (!documentState) return;

  const already = documentState.ignoredFindings.some(ig => ig.findingId === findingId);
  if (already) return;

  const nextState: DocumentStateV1 = {
    ...documentState,
    ignoredFindings: [
      ...documentState.ignoredFindings,
      { findingId, ignoredAtIso: new Date().toISOString() }
    ],
    lastUpdatedIso: new Date().toISOString()
  };

  saveDocumentState(nextState);
  setDocumentState(nextState);
}, [documentState, setDocumentState]);
```

Import `saveDocumentState` from `@magistrat/google-adapter` at the top of App.tsx.

Pass to FindingsPanel:
```tsx
<FindingsPanel
  findings={filteredFindings}
  deck={deck}
  onApplyFinding={(id) => void applyForFinding(id)}
  onIgnoreFinding={ignoreFinding}
  ignoredFindingIds={ignoredFindingIds}
/>
```

**Update FindingsPanel** to accept and pass through:
```tsx
export interface FindingsPanelProps {
  findings: Finding[];
  deck: DeckSnapshot | null;
  onApplyFinding?: (findingId: string) => void;
  onIgnoreFinding?: (findingId: string) => void;
  ignoredFindingIds?: ReadonlySet<string>;
}
```

Thread to FindingCard:
```tsx
<FindingCard
  key={finding.id}
  finding={finding}
  isIgnored={ignoredFindingIds?.has(finding.id)}
  {...(onApplyFinding ? { onApply: () => onApplyFinding(finding.id) } : {})}
  {...(onIgnoreFinding ? { onIgnore: () => onIgnoreFinding(finding.id) } : {})}
/>
```

---

## 5. Visual treatment for ignored findings

Ignored findings should be visually muted but still visible in the findings list (so users remember they're there).

CSS for ignored state:
```css
/* —— Ignored Finding —— */
.finding-card--ignored {
  opacity: 0.5;
}
.finding-card__ignored-badge {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-tertiary);
  padding: 1px 6px;
  background: var(--surface-inset);
  border-radius: 4px;
}
```

In FindingCard, add the ignored modifier class:
```tsx
const ignoredClass = isIgnored ? " finding-card--ignored" : "";
// ...
<article className={`finding-card ${modifier}${ignoredClass}`}>
```

---

## 6. Exceptions panel

Create `apps/slides-addon/src/components/ExceptionsPanel.tsx`:

```tsx
interface ExceptionsPanelProps {
  ignoredFindings: IgnoredFinding[];
  findings: Finding[];
  onUnignore: (findingId: string) => void;
}
```

Shows the list of ignored findings with un-ignore action. Only render when there are ignored findings.

**Markup:**
```tsx
<section className="exceptions-panel">
  <h2 className="exceptions-panel__title">
    Ignored findings ({activeIgnored.length})
  </h2>
  <p className="exceptions-panel__subtitle">
    These findings don't affect your alignment score.
  </p>
  <ul className="exceptions-panel__list">
    {activeIgnored.map(ig => {
      const finding = findings.find(f => f.id === ig.findingId);
      const translated = finding ? translateFinding(finding) : null;
      return (
        <li key={ig.findingId} className="exceptions-panel__item">
          <div>
            <p className="exceptions-panel__label">
              {translated?.title ?? `Finding ${ig.findingId}`}
            </p>
            <p className="exceptions-panel__meta">
              Ignored {new Date(ig.ignoredAtIso).toLocaleDateString()}
              {ig.note ? ` — ${ig.note}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => onUnignore(ig.findingId)}
          >
            Restore
          </button>
        </li>
      );
    })}
  </ul>
  {staleIgnored.length > 0 ? (
    <p className="exceptions-panel__stale muted">
      {staleIgnored.length} previously ignored {staleIgnored.length === 1 ? "finding" : "findings"} no longer detected.
    </p>
  ) : null}
</section>
```

**Active vs stale:** An ignored finding is "active" if its findingId still appears in the current findings list. "Stale" means the finding no longer exists (object was fixed or deleted). Show stale count but don't list them.

**Un-ignore callback** in App.tsx:
```tsx
const unignoreFinding = useCallback((findingId: string) => {
  if (!documentState) return;

  const nextState: DocumentStateV1 = {
    ...documentState,
    ignoredFindings: documentState.ignoredFindings.filter(ig => ig.findingId !== findingId),
    lastUpdatedIso: new Date().toISOString()
  };

  saveDocumentState(nextState);
  setDocumentState(nextState);
}, [documentState, setDocumentState]);
```

**Render in App.tsx** — after the findings section, before the change history:
```tsx
{(documentState?.ignoredFindings.length ?? 0) > 0 ? (
  <ExceptionsPanel
    ignoredFindings={documentState!.ignoredFindings}
    findings={analysisState?.findings ?? documentState?.findings ?? []}
    onUnignore={unignoreFinding}
  />
) : null}
```

**CSS:**
```css
/* —— Exceptions Panel —— */
.exceptions-panel {
  padding: 12px;
  background: var(--surface-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}
.exceptions-panel__title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 2px;
  color: var(--text-primary);
}
.exceptions-panel__subtitle {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0 0 10px;
}
.exceptions-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exceptions-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.exceptions-panel__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}
.exceptions-panel__meta {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}
.exceptions-panel__stale {
  margin: 10px 0 0;
  font-size: 11px;
}
```

---

## Files to create
- `apps/slides-addon/src/components/ExceptionsPanel.tsx`

## Files to modify
- `packages/shared-types/src/state.ts` — add `IgnoredFinding`, add to `DocumentStateV1`
- `packages/compiler-core/src/alignment-score.ts` — accept `ignoredFindingIds` param
- `packages/compiler-core/tests/alignment-score.test.ts` — add ignored tests
- `apps/slides-addon/src/App.tsx` — ignore/unignore callbacks, adjusted score, canRatify update, ExceptionsPanel wiring
- `apps/slides-addon/src/components/FindingsPanel.tsx` — pass through ignore props
- `apps/slides-addon/src/components/FindingCard.tsx` — ignore button + ignored badge
- `apps/slides-addon/src/styles.css` — ignored finding + exceptions panel CSS
- `packages/google-adapter/src/document-state.ts` — default `ignoredFindings: []` on load

## Done when
- Clicking "Ignore" on a FindingCard persists it and visually mutes the card
- Alignment score excludes ignored findings
- Ratify is available when all non-ignored findings are resolved
- Exceptions panel shows ignored findings with "Restore" (un-ignore)
- Stale ignored findings (fixed objects) noted but not listed
- Ignore persists across page reloads (document state)
- No regressions
