# Track B — Slide Master Generation (Shaping Doc)

## Problem

Magistrat detects style violations but can't prevent them. Users scan, fix, re-scan. The highest-leverage intervention is to **set the master/layout so new slides are born correct** — then the compliance check becomes a safety net, not the primary workflow.

The exemplar StyleMap already contains everything needed: per-role typography, colors, geometry centroids, bullet config. Track B turns that StyleMap into a host-native master/layout.

## Key Constraint: Google Slides API Limitations

The Slides API (`Presentations.batchUpdate`) does **not** support:
- Creating new slide masters from scratch
- Deleting existing masters
- Adding new placeholder types to an existing layout

It **does** support:
- Reading all masters and layouts (`presentations.get` with `fields: masters,layouts`)
- Modifying existing placeholder text styles (`updateTextStyle` on a page element)
- Modifying page element geometry (`updatePageElementTransform`)
- Modifying shape fill (`updateShapeProperties`)
- Setting page background color (`updatePageProperties`)

This means Track B cannot "generate a master" in the traditional sense. The viable approach is: **restyle the existing master's placeholders to match the exemplar StyleMap.**

## Shaped Solution: "Apply StyleMap to Master"

### User Flow

1. User scans deck, selects exemplar, reviews findings
2. User clicks **"Apply to Master"** (new button in sidebar, gated behind `styleMap` presence)
3. Magistrat reads the presentation's master/layout structure via Slides Advanced Service
4. Matches master placeholders to StyleMap roles:
   - `TITLE` placeholder → `styleMap.TITLE` tokens
   - `BODY`/`SUBTITLE` placeholder → `styleMap.BODY` / `styleMap.SUBTITLE` tokens
   - Footer placeholders → `styleMap.FOOTER` tokens
5. Generates a `batchUpdate` request that patches typography (font, size, bold, italic, color) and geometry (position, size) on each matched placeholder
6. Reports results: "Updated 4 placeholders on 2 layouts"

### What Gets Applied

Per matched placeholder:

| StyleMap Token | Slides API Operation |
|---|---|
| `fontFamily` | `updateTextStyle` → `fontFamily` |
| `fontSizePt` | `updateTextStyle` → `fontSize.magnitude` (unit: PT) |
| `bold` / `italic` | `updateTextStyle` → `bold` / `italic` |
| `fontColor` | `updateTextStyle` → `foregroundColor.opaqueColor.rgbColor` |
| `fillColor` (CALLOUT) | `updateShapeProperties` → `shapeBackgroundFill.solidFill` |
| `geometryCentroid` | `updatePageElementTransform` (translate to match exemplar position) |
| `lineSpacing` | `updateParagraphStyle` → `lineSpacing` |
| `bulletGlyph` | `createParagraphBullets` + `updateTextStyle` on bullet |

### What Does NOT Get Applied (v1)

- New placeholder creation (API doesn't support it)
- Master background images or gradients (too subjective)
- Chart/table default styling (no API path)
- Theme color palette registration (Slides API doesn't expose theme color editing)

## Placeholder-to-Role Matching

Google Slides placeholders have a `type` property. The mapping:

| Placeholder Type | StyleMap Role |
|---|---|
| `TITLE`, `CENTERED_TITLE` | `TITLE` |
| `SUBTITLE` | `SUBTITLE` |
| `BODY`, `OBJECT` | `BODY` |
| `SLIDE_NUMBER`, `FOOTER`, `DATE_HEADER` | `FOOTER` |

Unmatched placeholders (e.g., `DIAGRAM`, `CLIP_ART`) are skipped — no silent changes.

## Technical Slices

### Slice 1 — Read master/layout structure (Deep tier)

**Goal:** New GAS bridge function `readMasterLayouts()` that returns the master/layout structure.

**Files:**
- `apps/slides-addon/gas/appsscript.json` — add Slides Advanced Service (`slides` v1)
- `apps/slides-addon/gas/Code.gs` — new `readMasterLayouts()` function:
  ```
  Slides.Presentations.get(presentationId, { fields: 'masters,layouts' })
  ```
  Returns: `{ masters: [{ objectId, pageElements: [{ objectId, placeholder: { type }, transform, textStyle }] }], layouts: [...] }`
- `packages/google-adapter/src/bridge-types.ts` — bridge types for master/layout structure
- `packages/google-adapter/src/providers/google-mappers.ts` — mapper (optional, may just pass through)

**Verify:** Can read master/layout data from a real presentation. Log shape.

**Non-goals:** No write operations. No UI changes. No Office path.

---

### Slice 2 — Patch planner: StyleMap to batchUpdate (Deep tier)

**Goal:** Pure function `planMasterPatches(styleMap, masterLayouts)` that returns a Slides API `batchUpdate` request body.

**Files:**
- `packages/compiler-core/src/master-planner.ts` (new) — takes StyleMap + master/layout structure, returns `{ requests: Request[] }` for Slides API batchUpdate
  - Match placeholder types to roles
  - Generate `updateTextStyle` requests per matched placeholder
  - Generate `updateShapeProperties` for fill
  - Generate `updatePageElementTransform` for geometry (only when exemplar has `geometryCentroid`)
  - Skip unmatched placeholders, log them as "skipped"
- `packages/compiler-core/src/public-api.ts` — export `planMasterPatches`
- `packages/compiler-core/tests/master-planner.test.ts` — unit tests with fixture master/layout data

**Contract:**
```typescript
interface MasterPatchPlan {
  requests: SlidesApiRequest[];  // Raw Slides API batchUpdate requests
  matched: { role: RoleV1; placeholderObjectId: string; layoutObjectId: string }[];
  skipped: { placeholderType: string; reason: string }[];
}

function planMasterPatches(
  styleMap: StyleMap,
  masterLayouts: MasterLayoutSnapshot
): MasterPatchPlan;
```

**Verify:** Unit tests cover TITLE/BODY/FOOTER matching, unmatched placeholders, empty styleMap.

**Non-goals:** No GAS execution. No UI. This is a pure data transform.

---

### Slice 3 — GAS execution + UI (Bounded tier, after Slice 1+2 are done)

**Goal:** Wire the planner to the GAS bridge and add the sidebar button.

**Files:**
- `apps/slides-addon/gas/Code.gs` — new `applyMasterPatches(requests)` function:
  ```
  Slides.Presentations.batchUpdate({ requests: requests }, presentationId)
  ```
- `apps/slides-addon/src/App.tsx` — "Apply to Master" button (gated behind styleMap, shows after scan)
- `apps/slides-addon/src/hooks/useAnalysis.ts` — new `applyToMaster()` action that:
  1. Calls `readMasterLayouts()` via bridge
  2. Runs `planMasterPatches(styleMap, layouts)` client-side
  3. Calls `applyMasterPatches(plan.requests)` via bridge
  4. Shows result toast: matched count, skipped count

**Verify:** End-to-end on a real Google Slides deck with a title and body placeholder.

**Non-goals:** No Office parity (PowerPoint master XML is a completely different problem). No undo support for master changes (Slides API batchUpdate is not undo-able from the sidebar). UI should warn user that this is irreversible in v1.

---

### Slice 4 (optional) — Office parity stub

**Goal:** Stub the Office adapter path so the UI doesn't show a dead button.

**Files:**
- `apps/taskpane/src/App.tsx` — hide "Apply to Master" button (capability gated)
- `packages/office-adapter` — stub `readMasterLayouts()` returning empty + `applyMasterPatches()` as no-op

**Notes:** PowerPoint master manipulation requires direct XML editing via Office.js `CustomXmlParts` or the Open XML SDK. This is a significant separate design problem — out of scope for Track B v1.

## Risks

1. **OAuth scope escalation**: Slides Advanced Service requires `https://www.googleapis.com/auth/presentations` which is already implicitly granted by `SlidesApp`. But adding the Advanced Service explicitly may trigger a re-authorization prompt for existing users.

2. **Master/layout variations**: Real-world presentations have wildly varying master structures. Some have 1 layout, some have 20. The matching heuristic must be conservative — only touch placeholders with high-confidence role matches.

3. **Irreversibility**: `Presentations.batchUpdate` changes to masters can't be undone from the sidebar. Users must manually revert or use Google Slides version history. The UI must warn clearly.

4. **Performance**: `Presentations.get` with `masters,layouts` fields can be slow for large presentations. Should be called once and cached for the session.

## Appetite

This is a **medium bet** — 3-4 working sessions if sliced correctly. Slice 1+2 are independent of each other and can run in parallel. Slice 3 depends on both. Slice 4 is optional polish.

## Open Questions

1. Should "Apply to Master" modify ALL layouts or only the "active" layout (the one the current slide uses)? Conservative default: only layouts that contain at least one placeholder matching a StyleMap role.

2. Should we show a preview of what will change before applying? This adds UI complexity but reduces the irreversibility risk. Could be a v2 enhancement.

3. Should this feature require its own capability flag (`applyMasterPatches: true`) separate from `applyPatchOps`? Probably yes — different risk profile.
