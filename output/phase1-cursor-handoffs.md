# Phase 1 Cursor Handoff Blocks

Read `AGENTS.md`, `DESIGN.md`, `CONTEXT.md` before starting any slice.

---

## Handoff 1: DevMode Context + Toggle
**From:** Deep (Claude Code)
**To:** Bounded (Cursor Composer)
**Context:** Phase 1 "Translate" — adding developer mode toggle that hides raw diagnostics from default view.
**Task:** Create a React context for developer mode and a toggle component.

### Files to create:
1. `apps/slides-addon/src/context/DevModeContext.tsx`
   ```tsx
   import { createContext, useContext, useState, type ReactNode } from "react";

   interface DevModeContextValue {
     devMode: boolean;
     toggleDevMode: () => void;
   }

   const DevModeContext = createContext<DevModeContextValue>({
     devMode: false,
     toggleDevMode: () => {}
   });

   export function DevModeProvider({ children }: { children: ReactNode }) {
     const [devMode, setDevMode] = useState(false);
     return (
       <DevModeContext.Provider value={{ devMode, toggleDevMode: () => setDevMode((v) => !v) }}>
         {children}
       </DevModeContext.Provider>
     );
   }

   export function useDevMode(): DevModeContextValue {
     return useContext(DevModeContext);
   }
   ```

2. `apps/slides-addon/src/components/DevModeToggle.tsx` — small toggle button in the header. Label: "Dev" when off, "Dev ✓" when on. Use `useDevMode()` hook.

### What to hide when devMode is OFF:
- Session diagnostics panel (Runtime mode, Host, Platform, Bridge available, etc.)
- Coverage meter breakdown (analyzed objects, unhandled types, continuity details)
- Raw patch log details (finding IDs, patch IDs, precondition hashes)
- Rule IDs on findings (show translated title instead)

### What stays visible always:
- Exemplar setup
- Findings list (with translated titles from `translateFinding`)
- "Apply safe" / "Run clean up" buttons
- Summary counts (findings count, scan coverage %)
- Message footer

**Constraints:**
- Do not modify `packages/` — this is UI-only
- Follow DESIGN.md Section B layout zones
**Verify:** `npm run test --workspace @magistrat/slides-addon`

---

## Handoff 2: Design Tokens CSS
**From:** Deep (Claude Code)
**To:** Bounded (Cursor Composer)
**Context:** Establishing the semantic color system from DESIGN.md Section C.
**Task:** Create CSS custom properties and utility classes.

### File to create:
`apps/slides-addon/src/styles/tokens.css`

```css
:root {
  /* Status colors — DESIGN.md Section C */
  --status-pass: #22c55e;      /* green-500 */
  --status-warn: #f59e0b;      /* amber-500 */
  --status-error: #ef4444;     /* red-500 */
  --status-muted: #94a3b8;     /* slate-400 */
  --status-focus: #3b82f6;     /* blue-500 */

  /* Surface */
  --surface-primary: #ffffff;
  --surface-secondary: #f8fafc;  /* slate-50 */
  --border-default: #e2e8f0;     /* slate-200 */

  /* Text */
  --text-primary: #0f172a;     /* slate-900 */
  --text-secondary: #64748b;   /* slate-500 */
  --text-muted: #94a3b8;       /* slate-400 */
}

/* Risk badge pills — DESIGN.md Section C */
.risk-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}
.risk-badge--safe {
  background: color-mix(in srgb, var(--status-pass) 15%, transparent);
  color: #15803d; /* green-700 */
}
.risk-badge--caution {
  background: color-mix(in srgb, var(--status-warn) 15%, transparent);
  color: #b45309; /* amber-700 */
}
.risk-badge--manual {
  background: transparent;
  border: 1px solid var(--status-error);
  color: #dc2626; /* red-600 */
}

/* Reconcile state badges */
.reconcile-badge {
  display: inline-flex;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.reconcile-applied { background: color-mix(in srgb, var(--status-pass) 15%, transparent); color: #15803d; }
.reconcile-reverted_externally { background: color-mix(in srgb, var(--status-warn) 15%, transparent); color: #b45309; }
.reconcile-drifted { background: color-mix(in srgb, var(--status-error) 15%, transparent); color: #dc2626; }
.reconcile-missing_target { background: color-mix(in srgb, var(--status-muted) 15%, transparent); color: #475569; }
```

Import this in `apps/slides-addon/src/styles.css` (the existing styles file).

**Constraints:** No changes outside `apps/slides-addon/src/styles/`
**Verify:** Visual inspection in sidebar.

---

## Handoff 3: Component Extraction — FindingsPanel + FindingCard
**From:** Deep (Claude Code)
**To:** Bounded (Cursor Composer)
**Context:** The current App.tsx renders findings as a raw `<ul>` with rule IDs (lines 598-620). Replace with translated, grouped components.
**Task:** Extract findings rendering into components that use `translateFinding`.

### Files to create:

1. `apps/slides-addon/src/components/FindingCard.tsx`
   - Props: `{ finding: Finding; onApply?: () => void }`
   - Import `translateFinding` from `@magistrat/compiler-core`
   - Render: translated title, description (expandable), risk badge pill, Apply button (if actionLabel !== null)
   - In devMode: also show `finding.ruleId`, `finding.objectId`, `finding.confidence`
   - Use tokens CSS classes for risk badges

2. `apps/slides-addon/src/components/SlideGroup.tsx`
   - Props: `{ slideId: string; slideIndex: number; findings: Finding[]; onApplyFinding?: (findingId: string) => void }`
   - Collapsible group with slide label as header
   - Count badge showing number of findings
   - Renders FindingCard for each finding

3. `apps/slides-addon/src/components/FindingsPanel.tsx`
   - Props: `{ findings: Finding[]; deck: DeckSnapshot | null; onApplyFinding?: (findingId: string) => void }`
   - Groups findings by `slideId`
   - Renders SlideGroup for each slide (ordered by slide index)
   - NOT_ANALYZED findings grouped separately at the bottom (only in devMode)

### Pattern to follow:
- Look at existing App.tsx lines 598-620 for current rendering
- `translateFinding` is already exported from `@magistrat/compiler-core` (see `public-api.ts`)
- Finding type from `@magistrat/shared-types`

**Contract:** `packages/compiler-core/src/finding-translator.ts` — do not modify
**Verify:** `npm run test --workspace @magistrat/slides-addon` + visual inspection

---

## Handoff 4: Hook Extraction — useAnalysis + usePatchLog
**From:** Deep (Claude Code)
**To:** Bounded (Cursor Composer)
**Context:** App.tsx has ~450 lines of callback logic mixed with rendering. Extract into hooks.
**Task:** Move analysis/apply/reconcile logic into dedicated hooks.

### Files to create:

1. `apps/slides-addon/src/hooks/useAnalysis.ts`
   Extract from App.tsx:
   - `AnalysisState` interface (lines 38-47)
   - `analyzeDeckSnapshot` function (lines 729-761)
   - `hydrateAnalysisState` function (lines 763-778)
   - `runCleanup` callback (lines 133-170)
   - `applySafe` callback (lines 172-259)
   - State: `deck`, `analysisState`, `selectedExemplarSlideId`, `exemplarMode`
   - Return: `{ deck, analysisState, selectedExemplarSlideId, setSelectedExemplarSlideId, exemplarMode, setExemplarMode, runCleanup, applySafe, message }`

2. `apps/slides-addon/src/hooks/usePatchLog.ts`
   Extract from App.tsx:
   - `reconcileNow` callback (lines 261-294)
   - `restoreBefore` callback (lines 296-424)
   - `ratify` callback (lines 426-456)
   - Patch log memo computations (lines 68-69)
   - Return: `{ patchLogGroups, patchStateCounts, lastReconciledIso, reconcileNow, restoreBefore, ratify }`

### Key constraint:
Both hooks need access to `documentState` and `setDocumentState`. Pass these as parameters or lift state. The simplest approach: both hooks receive `{ documentState, setDocumentState }` as params alongside the adapter capabilities.

**Pattern:** Current App.tsx lines 54-456 contain all the logic. The goal is App.tsx becomes ~150-200 lines of component composition.
**Contract:** All adapter imports (`@magistrat/google-adapter`) and type imports (`@magistrat/shared-types`) stay the same.
**Verify:** `npm run test --workspace @magistrat/slides-addon` — existing patchLog tests must still pass. Full trust loop must still work (scan → apply → reconcile → restore → ratify).

---

## Execution Order

1. **Handoff 2** (tokens CSS) — no dependencies, do first
2. **Handoff 1** (DevMode context) — no dependencies, can parallel with 2
3. **Handoff 4** (hook extraction) — must come before component wiring
4. **Handoff 3** (FindingsPanel/FindingCard) — depends on hooks + tokens + DevMode

After all 4: wire everything together in App.tsx. App.tsx should:
- Wrap in `<DevModeProvider>`
- Call `useAnalysis()` and `usePatchLog()`
- Render: Header → Exemplar Setup → FindingsPanel → PatchLog (conditionally based on devMode)
- Keep Session Diagnostics and Coverage Meter behind `devMode` check

**Final verify:** `npm run check && npm run test`
