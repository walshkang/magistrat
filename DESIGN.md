# Magistrat — Design System & UX Spec

This is the **single source of truth** for UI/UX decisions. A coding agent should be able to read this document and the component code, then make correct, consistent changes across the entire interface without further clarification.

Related docs (subordinate to this file for UI/UX decisions):
- `docs/UX_RULES.md` — surface model and UX guardrails
- `docs/VIBE_PLAYBOOK.md` — product voice and interaction principles
- `docs/BEST_PRACTICES_PLAYBOOK.md` — deterministic rules, evidence contracts, patch safety

---

## A. Product context

### Who is the user
A professional (consultant, executive, marketer) who:
- Spends significant time formatting slides and ensuring brand/style consistency across massive decks
- Is used to clean, professional tools (Google Workspace, Office 365)
- Does not want to debug raw layout properties — wants guided, rewarding fixes
- Needs this to work inside their existing workflow (Google Slides sidebar, Office task pane)

### Core user journey (the trust loop)
1. **Select exemplar** — choose a reference slide/deck that defines the "right" style
2. **Inspect health** — see how healthy the exemplar is (Exemplar Health score 0-100)
3. **Run checks** — deterministic analysis against the exemplar's Role Style Map
4. **Review findings** — each finding shows observed vs expected, evidence, confidence, risk
5. **Apply patches** — safe ops bulk-apply; caution ops require review; manual ops suggest-only
6. **Ratify** — confirm style status, monitor for drift after external edits

### The pain point we solve
Slide formatting is tedious, error-prone, and invisible until someone important notices. Teams spend hours ensuring font sizes, colors, bullet indents, and layout are consistent — and still miss things. Magistrat makes this deterministic: scan once, fix systematically, know exactly what's aligned and what's not.

### One deck, one exemplar
An analysis session binds one deck to one exemplar. The exemplar defines the Role Style Map (expected values for each text role). Users do not mix exemplars within a single analysis run.

---

## B. App shell & layout

### Host surfaces (v1)

Magistrat lives **inside** the host application as a sidebar or task pane — never as a standalone app.

| Surface | Host | Shell component | Status |
|---------|------|-----------------|--------|
| Google Slides sidebar | Google Slides | `apps/slides-addon/App.tsx` | **Primary** |
| Office task pane | PowerPoint | `apps/taskpane/` | **Parity track** (diagnostics only, apply policy-disabled) |

### Sidebar layout (Google primary)

```
┌─────────────────────────────┐
│  ◉ Magistrat      [⚙] [👤] │  ← Header: brand + settings + dev toggle
├─────────────────────────────┤
│  Exemplar: "Q4 Board Deck"  │  ← Exemplar selector
│  Health: ████████░░ 82/100  │  ← Exemplar Health score
├─────────────────────────────┤
│  Alignment: ███████░░░ 71%  │  ← Deck-level Alignment Score (Phase 2)
├─────────────────────────────┤
│  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ │  ← Interactive Minimap (Phase 3)
│  │✓│ │!│ │✓│ │✓│ │⚠│ │✓│  │    Each slide = status indicator
│  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ │    Click to filter findings
├─────────────────────────────┤
│  Findings (Slide 2)         │  ← Contextual findings list
│                             │
│  ⚠ Title font should be    │
│    24pt, currently 18pt     │
│    [Apply] [Ignore]         │
│                             │
│  ✓ Body font family matches │
│                             │
│  ⚠ Ghost object blocking   │
│    content on z-layer 3     │
│    [Delete] [Ignore]        │
│                             │
├─────────────────────────────┤
│  Coverage: 94% analyzed     │  ← Coverage meter
│  3 items NOT_ANALYZED       │    Always visible, never hidden
│  [View details]             │
├─────────────────────────────┤
│  Patch Log (4 applied)      │  ← Patch log with reconciliation
│  [View all] [Revert last]   │
└─────────────────────────────┘
```

### Layout zones

| Zone | Content | Always visible? |
|------|---------|----------------|
| **Header** | Brand, settings toggle, developer mode toggle | Yes |
| **Exemplar** | Selector, health score | Yes (when exemplar selected) |
| **Alignment Score** | Progress bar + percentage (Phase 2+) | Yes (Phase 2+) |
| **Minimap** | Slide thumbnails with status indicators (Phase 3+) | Yes (Phase 3+) |
| **Findings** | Grouped by slide, human-readable, with actions | Yes |
| **Coverage** | Analyzed vs NOT_ANALYZED counts | Yes |
| **Patch log** | Applied/reverted/drifted patch history | Collapsible |

### Developer mode

A toggle that reveals:
- Session diagnostics (host mode, document state schema)
- Raw finding IDs, rule IDs, object IDs
- Coverage meter breakdown by reason code
- Full patch log with precondition hashes and reconcile states
- Raw JSON state inspector

Default: **off**. Power users and developers toggle it on.

---

## C. Visual system

### Design principles

1. **Sidebar-first density** — the sidebar is narrow (~300-360px). Every pixel counts. Prefer `text-xs` / `text-sm`, tight vertical spacing.
2. **Professional, not playful** — think Linear or Figma's inspector panel. Calm, precise, no decorative elements.
3. **Semantic color only** — every color maps to a meaning (risk level, status, confidence). No decorative color.
4. **Status over decoration** — green = passing, amber = warning, red = error, gray = not analyzed. That's the palette.
5. **Calm motion** — subtle transitions only. Score animations should feel satisfying but not distracting. Respect `prefers-reduced-motion`.

### Status colors

| Meaning | Token | Use |
|---------|-------|-----|
| Passing / safe | `--status-pass` (green) | Aligned findings, safe patches, healthy exemplar |
| Warning / caution | `--status-warn` (amber) | Caution patches, moderate health, informational findings |
| Error / manual | `--status-error` (red) | Error-severity findings, manual-only patches, low health |
| Not analyzed | `--status-muted` (gray) | NOT_ANALYZED items, disabled states |
| Focus / active | `--status-focus` (blue) | Selected slide in minimap, active finding |

### Risk badges

| Risk | Badge | Meaning |
|------|-------|---------|
| `safe` | Green pill | Can be bulk-applied |
| `caution` | Amber pill | Requires explicit review |
| `manual` | Red outline pill | Suggest-only, no auto-apply |

### Confidence display

- Confidence shown as percentage or bar only in developer mode
- In normal mode: findings simply appear or show "Low confidence" muted label
- Findings below confidence gates emit NOT_ANALYZED — they don't appear as findings at all

### Typography in the sidebar

- Measured values rendered precisely: `12pt`, `#1A1A1A`, `4px` (monospace or code-style)
- Finding titles: plain English, actionable ("Title font should be 24pt, currently 18pt")
- No raw rule IDs in normal mode

---

## D. Interaction patterns

### Finding actions

Each finding can have:
- **Apply** — execute the suggested patch (safe/caution only)
- **Ignore** — exclude from Alignment Score, persist in document state (Phase 4)
- **Details** — expand to show evidence, confidence, raw IDs (or always in dev mode)

### Bulk actions

- **Apply Safe** — apply all `safe` risk patches that pass validation
- **Apply Recommended** (Phase 2 rename) — same action, friendlier copy
- Never auto-apply `caution` or `manual` in bulk

### Patch reconciliation

After any external edit (user undo, manual slide change):
- Reconcile all applied patches against current state
- Show reconcile status: `applied` | `reverted_externally` | `drifted` | `missing_target`
- Update Alignment Score accordingly
- Never show stale apply state

### The "Ignore" workflow (Phase 4)

1. User clicks Ignore on a finding
2. Finding moves to "Exceptions" section
3. Alignment Score recalculates excluding ignored items
4. Persisted in document state with author + timestamp + rationale
5. Can be un-ignored later

---

## E. Component inventory

### Core packages

| Package | Location | Purpose |
|---------|----------|---------|
| `shared-types` | `packages/shared-types/src/` | Locked cross-package contracts: IR types, findings, patches, roles, state |
| `compiler-core` | `packages/compiler-core/src/` | Deterministic analysis: role inference, style map, checks, patch planning, reconcile |
| `google-adapter` | `packages/google-adapter/` | Google Slides host abstraction with runtime modes (SIM, SHADOW, READONLY, SAFE) |
| `office-adapter` | `packages/office-adapter/` | Office host abstraction for parity validation |

### App shells

| Component | Location | Purpose |
|-----------|----------|---------|
| `slides-addon/App` | `apps/slides-addon/src/App.tsx` | Google Slides sidebar — primary v1 surface |
| `taskpane` | `apps/taskpane/` | PowerPoint task pane — parity track |

### Key compiler-core modules

| Module | Purpose |
|--------|---------|
| `role-inference.ts` | Deterministic text role classification (TITLE, BODY, etc.) |
| `style-map.ts` | Build Role Style Map from exemplar |
| `style-signature.ts` | Compute style signatures for comparison |
| `checks.ts` | Run playbook rules against deck IR |
| `patch-planner.ts` | Plan typed, reversible patches from findings |
| `reconcile.ts` | Reconcile patch log against current document state |
| `exemplar-health.ts` | Score exemplar quality (0-100) |
| `build-deck-ir.ts` | Build intermediate representation from host data |
| `continuity.ts` | Cross-slide reference integrity checks |

---

## F. UX roadmap phases

### Phase 1: Triage, Translate, Declutter (Foundation)
- Developer mode toggle to hide/show advanced panels
- Human-readable finding translations (rule IDs -> plain English)
- Group findings by slide (not flat deck-wide list)

### Phase 2: Professional Dashboard (Progress & Magic)
- Alignment Score progress bar (prominent, top of sidebar)
- Rename "Apply Safe" -> "Apply Recommended Fixes"
- Animated score recalculation as patches apply

### Phase 3: Interactive Minimap
- Slide thumbnail strip with per-slide status indicators
- Click-to-filter: selecting a slide shows only its findings
- Per-slide and per-finding targeted fix actions

### Phase 4: Boss Override (Edge Cases)
- Inline Ignore action on every finding
- Smart score adjustment excluding ignored items
- Persisted exceptions in document state
- Exceptions management view

---

## G. Guardrails

- No hidden automated mutations — every patch is logged and reversible
- No floating overlay sprawl — sidebar/task-pane-first workflow
- No high-risk geometry or master/layout mutations in v1
- No generative writing assistant surface in v1
- Any ghosting must be preview/select mediated, not persistent on-canvas overlays
- NOT_ANALYZED items are always visible, never hidden
- Patch log state must reconcile with host-native undo/redo reality
