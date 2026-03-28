# Phase 2B-1/2B-2: Trust Loop Polish — Ratify UX + Change History

Two changes that complete the trust loop from the user's perspective.

---

## 2B-1: Ratify UX

### Problem
The "Ratify style" button is a `btn-ghost` buried at the bottom of the linter stream. Users don't notice it. Worse, ratifying with findings still present is confusing — a re-scan still shows the same findings, making ratify feel broken.

### Changes

**A. Gate ratify on 0 actionable findings.**

In `App.tsx`, compute whether ratify is available:
```tsx
const canRatify = Boolean(
  analysisState &&
  documentState &&
  analysisState.findings.filter(f => f.coverage === "ANALYZED").length === 0
);
```

Only `ANALYZED` findings block ratify. `NOT_ANALYZED` findings (coverage gaps) don't — they're informational.

**B. Move ratify out of the linter stream and into the summary panel.**

When `canRatify` is true AND the deck is not already ratified, show the ratify button prominently in the summary panel (the "All clear" state), replacing or sitting alongside "Scan deck":

```tsx
{/* Inside the summary-panel, in the all-clear branch (findings.length === 0) */}
<div className="summary-panel__actions">
  <button
    type="button"
    className="btn-secondary"
    onClick={() => void runCleanup()}
    disabled={!canRunScan}
  >
    Scan deck
  </button>
  {canRatify && !ratifyState ? (
    <button
      type="button"
      className="btn-primary ratify-btn"
      onClick={() => void ratify()}
    >
      Ratify style
    </button>
  ) : null}
</div>
```

When the deck IS already ratified, show a ratified badge instead:
```tsx
{ratifyState ? (
  <p className="ratify-stamp">
    Ratified {new Date(ratifyState.ratifiedAtIso).toLocaleDateString()}
  </p>
) : null}
```

**C. Remove the old ratify button** from the bottom of the linter stream (the `<div className="actions">` block containing "Ratify style").

**D. When findings > 0, show disabled ratify with tooltip** in the summary panel actions:
```tsx
{!canRatify && analysisState && analysisState.findings.filter(f => f.coverage === "ANALYZED").length > 0 ? (
  <button
    type="button"
    className="btn-secondary"
    disabled
    title="Fix or ignore all findings before ratifying"
  >
    Ratify style
  </button>
) : null}
```

**E. CSS for ratify button and stamp:**

Append to `apps/slides-addon/src/styles.css`:
```css
/* —— Ratify —— */
.ratify-btn {
  background: linear-gradient(135deg, var(--status-pass), #16a34a);
  border: none;
  color: #ffffff;
  font-weight: 600;
}
.ratify-btn:hover {
  background: linear-gradient(135deg, #16a34a, #15803d);
}
.ratify-stamp {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--status-pass);
  display: flex;
  align-items: center;
  gap: 4px;
}
.ratify-stamp::before {
  content: "✓";
  font-weight: 700;
}
```

### After ratify: re-scan behavior

No code change needed. The flow is now correct by design:
1. Scan → findings appear
2. Apply Recommended Fixes → findings reduce
3. Re-scan → 0 findings (if all fixed) → "All clear" state
4. Ratify button appears (green, prominent) → user clicks → stamp saved
5. Re-scan → still 0 findings → ratify stamp shown

If the deck changes later and findings reappear, the ratify stamp disappears (it's based on the style signature, which would no longer match). This is already handled by the existing signature check.

---

## 2B-2: Change History Panel

### Problem
The patch log in consumer mode is a one-liner ("6 patches applied · Reconcile"). Users can't see what Magistrat actually changed. They need an audit trail to stay in the loop.

### New component: `ChangeHistory.tsx`

Create `apps/slides-addon/src/components/ChangeHistory.tsx`.

This replaces the compact patch log in consumer mode (non-dev). The dev mode patch log stays as-is.

**Props:**
```tsx
import type { PatchRecord, DeckSnapshot, Finding } from "@magistrat/shared-types";

interface ChangeHistoryProps {
  patchLog: PatchRecord[];
  findings: Finding[];
  deck: DeckSnapshot | null;
  onReconcile: () => void;
  reconcileDisabled: boolean;
  reconcileTitle?: string;
}
```

**Rendering logic:**

Group patch records by `appliedAtIso` (reuse existing `groupPatchRecordsByAppliedAtIso`). For each group, show:

```
March 28, 2026 at 4:12 PM — 3 changes

  ✓ Fixed font family: Arial → Inter
    Slide 2 · Title

  ✓ Fixed font color: #333333 → #111827
    Slide 2 · Body text

  ⟳ Fixed font style: regular → bold (reverted externally)
    Slide 3 · Subtitle
```

**Translating patch records to human-readable lines:**

Create a helper function `translatePatchRecord` (can live in `ChangeHistory.tsx` or a shared utility):

```ts
function translatePatchRecord(record: PatchRecord): { label: string; detail: string } {
  const slideLabel = `Slide ${record.targetFingerprint.slideId}`;

  const OP_LABELS: Record<string, (r: PatchRecord) => string> = {
    SET_FONT_FAMILY: (r) => `Fixed font family: ${r.before.fontFamily} → ${r.after.fontFamily}`,
    SET_FONT_COLOR: (r) => `Fixed font color: ${r.before.fontColor} → ${r.after.fontColor}`,
    SET_FONT_STYLE: (r) => {
      const desc = (b: boolean | null, i: boolean | null) => {
        if (b && i) return "bold italic";
        if (b) return "bold";
        if (i) return "italic";
        return "regular";
      };
      return `Fixed font style: ${desc(r.before.bold, r.before.italic)} → ${desc(r.after.bold, r.after.italic)}`;
    },
    SET_FONT_SIZE: (r) => `Fixed font size: ${r.before.fontSizePt}pt → ${r.after.fontSizePt}pt`,
    SET_BULLET_INDENT: () => "Fixed bullet indentation",
    SET_LINE_SPACING: () => "Fixed line spacing",
    DELETE_GHOST_OBJECT: () => "Removed ghost object",
    NORMALIZE_LANGUAGE_TAGS: () => "Normalized proofing language",
  };

  // Look up the op from the finding's suggestedPatchId → patchOp mapping
  // Since PatchRecord doesn't store `op`, derive from before/after signature diffs:
  const label = inferChangeLabel(record);
  return { label, detail: slideLabel };
}
```

**Note on PatchRecord:** `PatchRecord` has `before` and `after` `ReconcileSignature` but does NOT have the `op` field. Infer the change type from which signature fields differ:
- `fontFamily` changed → "Fixed font family"
- `fontColor` changed → "Fixed font color"
- `bold` or `italic` changed → "Fixed font style"
- `fontSizePt` changed → "Fixed font size"
- `bulletIndent` or `bulletHanging` changed → "Fixed bullet indentation"
- Multiple fields changed → "Applied style fix" (generic)

**Reconcile state indicators:**
- `applied` → ✓ (green)
- `reverted_externally` → ⟳ (amber, append "reverted externally")
- `drifted` → ⚠ (amber, append "drifted")
- `missing_target` → ✕ (muted, append "target missing")

**Timestamp formatting:** Use `Intl.DateTimeFormat` for localized date/time. Group header shows date + time. If multiple groups on same day, show time only for subsequent groups.

**Collapsible:** Use a `<details>` element, open by default if ≤ 3 groups, collapsed if more.

**Reconcile button:** Keep the "Reconcile" ghost button at the bottom of the history, same as the compact view has today.

**Markup structure:**
```tsx
<section className="change-history">
  <h2 className="change-history__title">Change history</h2>
  {groups.map(group => (
    <div className="change-history__group" key={group.appliedAtIso}>
      <p className="change-history__date">
        {formatDate(group.appliedAtIso)} — {group.records.length} {group.records.length === 1 ? "change" : "changes"}
      </p>
      <ul className="change-history__list">
        {group.records.map(record => (
          <li className="change-history__item" key={record.id}>
            <span className={`change-history__icon change-history__icon--${record.reconcileState}`}>
              {stateIcon(record.reconcileState)}
            </span>
            <div>
              <p className="change-history__label">{translatePatchRecord(record).label}</p>
              <p className="change-history__detail">{translatePatchRecord(record).detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  ))}
  <button
    type="button"
    className="btn-ghost"
    onClick={onReconcile}
    disabled={reconcileDisabled}
    title={reconcileTitle}
  >
    Reconcile
  </button>
</section>
```

**CSS** — append to `styles.css`:
```css
/* —— Change History —— */
.change-history {
  padding: 12px;
  background: var(--surface-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}
.change-history__title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-primary);
}
.change-history__group {
  margin-bottom: 12px;
}
.change-history__group:last-of-type {
  margin-bottom: 8px;
}
.change-history__date {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin: 0 0 6px;
}
.change-history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.change-history__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.change-history__icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  border-radius: 50%;
}
.change-history__icon--applied {
  color: var(--status-pass);
}
.change-history__icon--reverted_externally {
  color: var(--status-warn);
}
.change-history__icon--drifted {
  color: var(--status-warn);
}
.change-history__icon--missing_target {
  color: var(--text-tertiary);
}
.change-history__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}
.change-history__detail {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}
```

### Wiring into App.tsx

Replace the consumer-mode compact patch log block:

**Before (remove this block when `!devMode`):**
```tsx
<div className="patch-log-compact">
  ...
</div>
```

**After:**
```tsx
import { ChangeHistory } from "./components/ChangeHistory.js";

{!devMode ? (
  <ChangeHistory
    patchLog={documentState?.patchLog ?? []}
    findings={analysisState?.findings ?? documentState?.findings ?? []}
    deck={deck}
    onReconcile={() => void reconcileNow()}
    reconcileDisabled={!documentState || !readDeckCapability.supported}
    reconcileTitle={!readDeckCapability.supported ? readDeckCapability.reason : undefined}
  />
) : (
  /* existing dev-mode patch log JSX stays unchanged */
)}
```

---

## Files to create
- `apps/slides-addon/src/components/ChangeHistory.tsx`

## Files to modify
- `apps/slides-addon/src/App.tsx` — ratify button move + gate, ChangeHistory wiring
- `apps/slides-addon/src/styles.css` — ratify + change history CSS

## Done when
- Ratify button is green/prominent in "All clear" state, disabled with tooltip when findings > 0
- Old ghost ratify button at bottom of linter stream is removed
- Ratify stamp ("✓ Ratified March 28, 2026") shows after ratifying
- Change history shows human-readable list of what was fixed, grouped by timestamp
- Reconcile state icons (✓, ⟳, ⚠, ✕) render correctly per patch status
- Dev mode patch log is unchanged
- No regressions
