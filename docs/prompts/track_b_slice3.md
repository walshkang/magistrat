# Track B Slice 3 — Wire Master Planner to GAS Bridge + UI Button

## Context

Slices 1 and 2 are done:
- **Slice 1** added `readMasterLayouts()` and `applyMasterPatches(requests)` to GAS `Code.gs`. Bridge types added to `packages/google-adapter/src/bridge-types.ts` (`GoogleBridgeMasterLayouts`, `GoogleBridgeMasterPage`, `GoogleBridgeMasterPlaceholder`, `GoogleBridgeMasterPatchResult`). The `GoogleSlidesBridge` interface already has `readMasterLayouts?()` and `applyMasterPatches?(requests)`.
- **Slice 2** added `planMasterPatches(styleMap, masterLayouts)` in `packages/compiler-core/src/master-planner.ts`, exported from `packages/compiler-core/src/public-api.ts`. It takes a `StyleMap` and `MasterLayoutSnapshot` and returns `MasterPatchPlan { requests, matched, skipped }`.

Your job: wire these together through the google-adapter public API and add an "Apply to Master" button in the sidebar.

## Task 1 — Adapter public API wrappers

**File:** `packages/google-adapter/src/public-api.ts`

Add two new exported async functions following the exact same pattern as `readDeckSnapshot()` and `applyPatchOps()`:

```typescript
import type { GoogleBridgeMasterLayouts, GoogleBridgeMasterPatchResult } from "./bridge-types.js";

export async function readMasterLayouts(): Promise<GoogleBridgeMasterLayouts> {
  const bridge = getGoogleSlidesBridge();
  if (!bridge?.readMasterLayouts) {
    throw new Error("readMasterLayouts is not available on the current bridge");
  }
  return bridge.readMasterLayouts();
}

export async function applyMasterPatches(requests: unknown[]): Promise<GoogleBridgeMasterPatchResult> {
  const bridge = getGoogleSlidesBridge();
  if (!bridge?.applyMasterPatches) {
    throw new Error("applyMasterPatches is not available on the current bridge");
  }
  return bridge.applyMasterPatches(requests);
}
```

You'll need to import `getGoogleSlidesBridge` — it's already used internally by the provider factory. Check `provider-factory.ts` to see how it's imported.

Also export the bridge types from public-api:
```typescript
export type { GoogleBridgeMasterLayouts, GoogleBridgeMasterPatchResult } from "./bridge-types.js";
```

## Task 2 — useAnalysis: `applyToMaster` callback

**File:** `apps/slides-addon/src/hooks/useAnalysis.ts`

Add a new `applyToMaster` callback. Import what you need:

```typescript
import { planMasterPatches, type MasterLayoutSnapshot } from "@magistrat/compiler-core";
import { readMasterLayouts, applyMasterPatches } from "@magistrat/google-adapter";
```

Add this callback inside `useAnalysis`, after `loadProfileFromJson`:

```typescript
const applyToMaster = useCallback(async () => {
  if (!analysisState) {
    setMessage("Run a scan first to build the style map.");
    return;
  }

  try {
    setMessage("Reading master/layout structure...");
    const bridgeLayouts = await readMasterLayouts();

    // Bridge returns GoogleBridgeMasterLayouts which matches MasterLayoutSnapshot shape
    const masterLayouts: MasterLayoutSnapshot = bridgeLayouts;

    const plan = planMasterPatches(analysisState.styleMap, masterLayouts);

    if (plan.matched.length === 0) {
      setMessage(
        `No placeholders matched any StyleMap roles. ${plan.skipped.length} placeholder(s) skipped.`
      );
      return;
    }

    setMessage(`Applying style to ${plan.matched.length} placeholder(s)...`);
    await applyMasterPatches(plan.requests);

    const roles = [...new Set(plan.matched.map((m) => m.role))].join(", ");
    setMessage(
      `Master updated: ${plan.matched.length} placeholder(s) restyled (${roles}). ${plan.skipped.length} skipped.`
    );
  } catch (error: unknown) {
    setMessage(
      error instanceof Error ? error.message : "Failed to apply style to master."
    );
  }
}, [analysisState, setMessage]);
```

Add `applyToMaster` to the return object of `useAnalysis`.

## Task 3 — App.tsx: "Apply to Master" button

**File:** `apps/slides-addon/src/App.tsx`

Add `applyToMaster` to the destructured return from `useAnalysis`.

Add an "Apply to Master" button inside the `summary-panel__actions` div, after the "Ratify style" button block. Place it as the last action:

```tsx
{analysisState ? (
  <button
    type="button"
    className="btn-secondary"
    onClick={() => {
      if (window.confirm(
        "This will restyle your slide master placeholders to match the exemplar. " +
        "This change cannot be undone from the sidebar — use Google Slides version history to revert. Continue?"
      )) {
        void applyToMaster();
      }
    }}
  >
    Apply to Master
  </button>
) : null}
```

Key details:
- `window.confirm` dialog warns about irreversibility (per shaping doc risk #3)
- Button is `btn-secondary` — it's a power-user action, not the primary CTA
- Only shows when `analysisState` exists (post-scan)
- No capability gating needed beyond analysisState — if the bridge function isn't available, the adapter wrapper throws and the catch in `applyToMaster` displays the error message

## Task 4 — Taskpane parity (Office)

**File:** `apps/taskpane/src/App.tsx`

Do NOT add the "Apply to Master" button to the Office taskpane. The Office adapter doesn't support master manipulation. No changes needed — the button simply doesn't exist in the Office surface.

If the taskpane has its own `useAnalysis` hook, do NOT add `applyToMaster` there either. Office path should not reference `readMasterLayouts` or `applyMasterPatches`.

## Constraints

- Do NOT modify `packages/compiler-core/src/master-planner.ts` — it's done
- Do NOT modify `apps/slides-addon/gas/Code.gs` — it's done
- Do NOT modify `packages/google-adapter/src/bridge-types.ts` — it's done
- Do NOT add new types to `packages/shared-types` — no schema changes needed
- The `MasterLayoutSnapshot` type from compiler-core is structurally identical to `GoogleBridgeMasterLayouts` from bridge-types (both have `pages: [{ objectId, pageType, placeholders: [{ objectId, placeholderType }] }]`). A direct assignment works — no mapper function needed.

## Verify

```bash
npm run test -- --workspace @magistrat/compiler-core
npm run check
```

All existing tests must pass. No new tests required for this slice (it's pure wiring — the planner logic is already tested in `master-planner.test.ts`).
