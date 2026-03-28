# Phase 1.5: "Trust Surface" — Visual Polish Handoff

**Read first:** `AGENTS.md`, `DESIGN.md` (Section C: Visual system), `docs/VIBE_PLAYBOOK.md`

**Tier:** Bounded (Cursor Composer)
**Appetite:** 3-4 days
**Goal:** Make the sidebar look like Grammarly for slides — a consultant opens it and immediately trusts it. No new features, no contract changes, pure visual/interaction polish.

**Reference products to match the feel of:** Grammarly (sidebar suggestions), Linear (clean density), Figma's Design panel (inspector-grade precision).

---

## The Problem

Current UI is functional but reads as "developer prototype":
- Warm parchment background (`radial-gradient` with beige/tan) feels crafty, not professional
- Panels are uniformly styled — no visual hierarchy between primary actions and secondary info
- Buttons all look the same regardless of importance
- No loading/empty/success states that feel intentional
- Typography is decent but spacing is loose for a sidebar (Google Slides sidebars are ~300px wide)
- The "Style HUD" panel has the same visual weight as "Patch log"
- Finding cards work but don't guide the eye to what matters

---

## Slice 1: Color System Reset

**File:** `apps/slides-addon/src/styles.css` + `apps/slides-addon/src/styles/tokens.css`

Replace the warm parchment palette with a clean, professional surface:

```css
/* tokens.css — replace existing :root */
:root {
  /* Surfaces — clean white/gray, not warm parchment */
  --surface-app: #f7f8fa;         /* very light gray app background */
  --surface-card: #ffffff;         /* white cards */
  --surface-card-hover: #fafbfc;
  --surface-inset: #f1f3f5;       /* recessed areas, empty states */
  --border-subtle: #e5e7eb;       /* gray-200 */
  --border-default: #d1d5db;      /* gray-300 */

  /* Text — neutral, not warm */
  --text-primary: #111827;        /* gray-900 */
  --text-secondary: #4b5563;      /* gray-600 */
  --text-tertiary: #9ca3af;       /* gray-400 */

  /* Brand accent — keep the teal, it's good */
  --accent: #0d9488;              /* teal-600 — slightly warmer than current blue */
  --accent-hover: #0f766e;        /* teal-700 */
  --accent-subtle: #ccfbf1;       /* teal-100 — for accent backgrounds */
  --accent-text: #115e59;         /* teal-800 — text on accent-subtle bg */

  /* Status colors — keep from current tokens.css */
  --status-pass: #22c55e;
  --status-warn: #f59e0b;
  --status-error: #ef4444;
  --status-muted: #9ca3af;
  --status-focus: #3b82f6;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

Update `styles.css`:
```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
  background: var(--surface-app);
  color: var(--text-primary);
  font-size: 13px;   /* sidebar-density base */
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
```

Remove the `radial-gradient`, `backdrop-filter: blur`, and warm `rgba(255, 252, 245, *)` values. Cards should be flat white with subtle borders, not frosted glass.

---

## Slice 2: Header Redesign

**File:** `apps/slides-addon/src/App.tsx` (header section, lines 76-82) + CSS

Current header is `<h1>Magistrat</h1>` + subtitle + Dev toggle. Replace with a compact, branded bar:

```
┌─────────────────────────────────┐
│ ◉ Magistrat              [Dev] │  ← Single row, 32-36px tall
└─────────────────────────────────┘
```

- Brand mark: small colored dot (teal `var(--accent)`) + "Magistrat" in 14px semibold
- Remove subtitle ("Trust-first Google Slides compiler workflow") — it's not user-facing copy
- Dev toggle stays right-aligned but smaller (just a 20px icon-button or subtle text toggle)
- Bottom border: `1px solid var(--border-subtle)`, no card styling on the header itself
- `position: sticky; top: 0; z-index: 10;` so it stays visible when scrolling

CSS:
```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.header-brand::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}
```

---

## Slice 3: Summary Bar (proto Alignment Score)

**File:** New section in `App.tsx` replacing the current "Style HUD" panel

Before Phase 2's formula-based Alignment Score, give users an at-a-glance summary that communicates status. This replaces the "Style HUD" `<div class="grid">` block.

```
┌─────────────────────────────────┐
│  ██████████░░░░  12 findings    │  ← Colored bar + count
│  3 auto-fixable · 2 need review │  ← Breakdown in secondary text
│                                 │
│  [Scan deck]  [Apply fixes (3)] │  ← Primary actions
└─────────────────────────────────┘
```

Implementation:
- A horizontal bar colored by worst severity: green if 0 findings, amber if warnings, red if errors
- Bar width = proportion of objects passing (simple: `analyzedObjects - findingsCount` / `analyzedObjects`)
- Below: one-line summary "X auto-fixable · Y need review · Z manual"
- Two buttons side by side: "Scan deck" (secondary style) and "Apply fixes (N)" (primary accent)
- When no scan has been run yet: show empty state "Scan your deck to check alignment" with single "Scan deck" button
- After apply with 0 findings remaining: green bar, "All clear" message, confetti-free

CSS for the bar:
```css
.summary-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--surface-inset);
  overflow: hidden;
  margin-bottom: 8px;
}

.summary-bar__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease, background-color 0.3s ease;
}

.summary-bar__fill--pass { background: var(--status-pass); }
.summary-bar__fill--warn { background: var(--status-warn); }
.summary-bar__fill--error { background: var(--status-error); }
```

---

## Slice 4: Finding Card Polish

**File:** `apps/slides-addon/src/components/FindingCard.tsx` + CSS

Current cards are functional but every finding looks the same visually. Add severity-driven left border + tighter spacing:

```
┌ ▎ Title font should be Arial, currently Calibri     [Auto-fix] │
│ ▎ Font family does not match the exemplar.                      │
│ ▎                                           [Apply fix]         │
└─────────────────────────────────────────────────────────────────┘
```

Changes:
- Add a 3px left border colored by severity (`error` = red, `warn` = amber, `info` = gray)
- Remove the `<details>` expand pattern for description — just show title + description always (it's only 1-2 lines). The expand was adding a click to see basic info.
- Risk badge pill stays top-right
- Action button: smaller, right-aligned, teal accent for safe ("Apply fix"), outlined for caution ("Review & apply")
- For NOT_ANALYZED findings: muted card (gray left border, lighter text, no action button)
- Tighten padding to 8px horizontal, 6px vertical

CSS additions:
```css
.finding-card {
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--status-muted);  /* default */
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  background: var(--surface-card);
  font-size: 12.5px;
  box-shadow: var(--shadow-sm);
}

.finding-card--error { border-left-color: var(--status-error); }
.finding-card--warn  { border-left-color: var(--status-warn); }
.finding-card--info  { border-left-color: var(--status-muted); }
.finding-card--not-analyzed {
  border-left-color: var(--border-default);
  opacity: 0.7;
}
```

In `FindingCard.tsx`: add `className` based on `finding.severity`:
```tsx
const severityClass = finding.coverage === "NOT_ANALYZED"
  ? "finding-card--not-analyzed"
  : `finding-card--${finding.severity}`;
```

Remove the `<details>/<summary>` wrapper — just render title + description inline.

---

## Slice 5: Exemplar Setup Collapse

**File:** `App.tsx` (Exemplar setup section, lines 147-183) + CSS

The exemplar selection panel takes too much space for something used once per session. Make it collapsible and compact:

- Default: collapsed after first scan (show "Exemplar: Slide 1 · Normalized · Health 82/100" one-liner)
- Click to expand and change settings
- Use a `<details>` with a styled summary line

```
┌─────────────────────────────────────────────────────┐
│ ▸ Exemplar: Slide 1 · Normalized · Health 82/100    │  ← collapsed
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ▾ Exemplar setup                                    │  ← expanded
│   [Slide selector ▼]  [Mode selector ▼]  [Rescan]  │
└─────────────────────────────────────────────────────┘
```

---

## Slice 6: Button Hierarchy

**File:** `apps/slides-addon/src/styles.css`

Currently all buttons look the same (teal filled). Create three tiers:

```css
/* Primary — main actions (Apply fixes, Scan deck) */
.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Secondary — supporting actions (Scan deck when apply is primary, Reconcile) */
.btn-secondary {
  background: var(--surface-card);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-secondary:hover { background: var(--surface-card-hover); }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Ghost — tertiary actions (Dev toggle, Restore before, Ratify) */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
.btn-ghost:hover { background: var(--surface-inset); color: var(--text-primary); }
```

Apply these classes throughout App.tsx:
- "Apply fixes (N)" / "Scan deck" (when no findings) → `btn-primary`
- "Scan deck" (when findings exist) / "Reconcile now" → `btn-secondary`
- "Ratify style" / "Restore before" / DevModeToggle → `btn-ghost`
- Per-finding "Apply fix" → `btn-primary` (small)
- Per-finding "Review & apply" → `btn-secondary` (small)

---

## Slice 7: Empty & Loading States

**File:** `App.tsx` + CSS

### Loading state (line 70-72)
Replace "Loading Magistrat Google Slides..." with:
```tsx
<main className="shell loading-state">
  <div className="loading-spinner" />
  <span className="loading-text">Connecting to deck...</span>
</main>
```

CSS:
```css
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text {
  font-size: 13px;
  color: var(--text-tertiary);
}
```

### Empty state (no scan yet)
When `analysisState` is null and loading is false, show:
```
┌─────────────────────────────────┐
│                                 │
│    Scan your deck to check      │
│    alignment with the exemplar  │
│                                 │
│         [Scan deck]             │
│                                 │
└─────────────────────────────────┘
```

### Success state (0 findings after apply)
When findings.length === 0 after a scan:
```
┌─────────────────────────────────┐
│  ████████████████  All clear    │
│  No style issues found.         │
└─────────────────────────────────┘
```

---

## Slice 8: Message Footer Polish

**File:** `App.tsx` (line 345) + CSS

Replace the flat info panel with a toast-style notification at the bottom:

```css
.message-toast {
  position: sticky;
  bottom: 8px;
  margin-top: auto;
  padding: 8px 12px;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  font-size: 12.5px;
  color: var(--text-secondary);
  animation: slide-up 0.2s ease;
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Auto-dismiss after 5 seconds (add a `useEffect` with a timer that clears `message`).

---

## Slice 9: Patch Log Compact (non-dev mode)

**File:** `App.tsx` (Patch log section, lines 242-343) + CSS

Currently when devMode is off, the patch log shows the summary grid + "Enable Dev mode to see details". Replace with a compact one-liner:

```
┌─────────────────────────────────────────────────────┐
│  4 patches applied · 0 drifted        [Reconcile]   │
└─────────────────────────────────────────────────────┘
```

- If 0 patches: don't render the section at all
- If all applied and 0 issues: green dot + "4 patches applied"
- If any drifted/reverted: amber dot + counts
- "Reconcile" button right-aligned, `btn-ghost` style
- Full patch log details remain in devMode

---

## Execution Order

1. **Slice 1** (color reset) — do first, everything else builds on it
2. **Slice 6** (button hierarchy) — do second, buttons used everywhere
3. **Slice 2** (header) — now use new colors and btn-ghost for dev toggle
4. **Slice 7** (empty/loading states) — quick wins, independent
5. **Slice 3** (summary bar) — the most impactful single change
6. **Slice 4** (finding card polish) — builds on new colors
7. **Slice 5** (exemplar collapse) — small UX improvement
8. **Slice 8** (message toast) — small polish
9. **Slice 9** (patch log compact) — final cleanup

## Constraints

- **No changes to `packages/`** — this is pure UI/CSS
- **No new npm dependencies** — use CSS only, no Tailwind or UI libraries
- **Keep all existing functionality** — every button, every panel, every action must still work
- **Sidebar width context:** Google Slides sidebar is ~300px. Test at that width.
- **`npm run check` must pass** after every slice

## Verify

After all slices:
1. `npm run dev --workspace @magistrat/slides-addon`
2. Open at `http://localhost:3020` — resize browser to ~300px width
3. Full trust loop: Scan → Review findings → Apply safe → Reconcile → Ratify
4. Toggle Dev mode on/off — verify info hides/shows correctly
5. `npm run check && npm run test`
