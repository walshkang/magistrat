# Magistrat Google Slides Runbook (Primary v1)

This runbook defines canonical manual validation for the Google Slides sidebar surface (`apps/slides-addon`) and `@magistrat/google-adapter` capability truthfulness.

> Filename note: this file was renamed from `SLIDES_ALPHA_RUNBOOK.md` as part of the Google-primary documentation pivot.

## Scope

- Google Slides is the primary v1 host path.
- Trust loop validation in sidebar UI: exemplar -> findings -> apply safe -> reconcile -> ratify.
- No shared backend; state is persisted in a document-owned hidden marker payload.
- Office parity validation is documented in `docs/SMOKE_TEST_RUNBOOK.md`.
- Positioning drift checks are documented in `docs/GOOGLE_PRIMARY_DRIFT_CHECKLIST.md`.

## Prerequisites

- Dependencies installed at repo root:

```bash
npm install
```

- Google bridge implementation available for the runtime environment (or SIM mode for local development).

---

## Deploy to Google Slides (Real Document Testing)

This section covers deploying Magistrat as an actual Google Slides sidebar add-on so you can test against real presentations.

### One-time setup

1. **Install clasp** (Google Apps Script CLI):

```bash
npm install -g @google/clasp
```

2. **Log in to your Google account:**

```bash
clasp login
```

This opens a browser for OAuth. Approve the permissions.

3. **Enable the Apps Script API** in your Google account:
   - Go to https://script.google.com (Settings → Google Apps Script API)
   - Turn on "Google Apps Script API"

4. **Create a new Apps Script project** bound to a test Google Slides presentation:
   - Open a Google Slides presentation (create a test one)
   - Go to **Extensions → Apps Script**
   - This creates a bound script project — copy the **Script ID** from the URL:
     `https://script.google.com/macros/d/SCRIPT_ID_HERE/edit`

5. **Create `.clasp.json`** at the repo root:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "output/clasp-stage"
}
```

> Do NOT commit `.clasp.json` — it contains your personal script ID. It is already covered by `.gitignore` patterns.

### Deploy

Run the deploy script from the repo root:

```bash
./scripts/deploy-slides-addon.sh
```

This will:
1. Build the Vite React app (`npm run build --workspace @magistrat/slides-addon`)
2. Inline the JS + CSS into the Apps Script `sidebar.html`
3. Stage `Code.gs`, `appsscript.json`, and `sidebar.html` into `output/clasp-stage/`
4. Push to Google via `clasp push`

### Dry run (build without pushing)

```bash
./scripts/deploy-slides-addon.sh --dry
```

Inspect the staged files in `output/clasp-stage/` before pushing.

### Open the sidebar in Google Slides

1. After `clasp push`, go back to your test Google Slides presentation
2. Reload the page (the script needs a fresh load)
3. Go to **Extensions → Magistrat → Open sidebar**
4. The sidebar should appear with the full Magistrat UI

> **First run:** Google may ask you to authorize the script. Click through the "Advanced" → "Go to Magistrat (unsafe)" flow. This is normal for unverified personal scripts.

### Updating after code changes

After making changes to the React app or Apps Script code:

```bash
./scripts/deploy-slides-addon.sh
```

Then reload the Google Slides tab and reopen the sidebar.

### Troubleshooting deployment

- **`clasp push` fails with "not logged in"** — Run `clasp login` again.
- **`clasp push` fails with "API not enabled"** — Enable at https://script.google.com (Settings → Google Apps Script API)
- **Sidebar doesn't appear in Extensions menu** — The script must be bound to the presentation (created via Extensions → Apps Script, not standalone).
- **Sidebar shows blank / errors** — Open browser DevTools (F12) in the sidebar iframe. Check for JS errors. The sidebar.html is an iframe; errors appear in its console.
- **"Authorization required" popup** — Click through the OAuth flow. For personal test scripts, you'll see an "unverified app" warning — this is expected.
- **Changes not showing up** — Google caches aggressively. Close and reopen the presentation tab entirely, then reopen the sidebar.

---

## 1) Start the Sidebar App (Local / SIM Mode)

From repo root:

```bash
npm run dev --workspace @magistrat/slides-addon
```

Open the local URL reported by Vite (default `http://localhost:3020`).

In local mode, the app runs in **SIM** mode with fixture data — no Google bridge required.

## 2) Runtime Truth Table

Expected diagnostics by environment:

| Environment | Expected mode | Read deck | Apply patches |
| --- | --- | --- | --- |
| Local browser (no bridge) | `SIM` | yes | yes (safe ops only) |
| Bridge present, read unavailable | `GOOGLE_SHADOW` | no | no |
| Bridge present, read yes, write no | `GOOGLE_READONLY` | yes | no |
| Bridge present, read yes, write yes + revision guard | `GOOGLE_SAFE` | yes | yes (safe ops only) |

## 3) Canonical Checks

1. Diagnostics truthfulness
- Verify runtime mode and capability lines match the truth table.

2. Coverage honesty
- Include unsupported objects (table/image/chart) and run clean up.
- Verify findings include explicit `NOT_ANALYZED` coverage entries.

3. Safe-only apply policy
- Confirm `Apply safe` applies only safe patch ops.
- Confirm caution/manual patch ops are not bulk-applied.

4. Reconcile correctness
- Apply one safe patch.
- Use the Patch log panel and click `Reconcile now`.
- Verify patch-log states remain truthful (`applied`, `reverted_externally`, `drifted`, `missing_target`) after native Undo/edit/delete changes in the host.
- Confirm preflight reconcile is reflected before any restore attempt.

5. Restore before (safe-only)
- Use `Restore before` on a patch record currently in `applied` state.
- Verify restore appends new patch records, then reconciles.
- Verify `drifted`, `reverted_externally`, `missing_target`, and delete-like records remain non-restorable.
- Verify messaging is explicit that only safe fields are restored.

6. Continuity findings
- Validate agenda/title checks are emitted deterministically (`BP-CONT-001`, `BP-CONT-002`) when input conditions are present.

7. Alignment Score (Phase 2A)
- After scan, verify the Alignment Score bar appears above the summary panel.
- Score should reflect percentage of analyzed objects with zero findings.
- Bar color: green (≥80%), yellow (50–79%), red (<50%).
- After applying all safe fixes, re-scan and verify score increases.

8. Batch 1 rule coverage (Phase 2B)
- **BP-TYPO-005 — Line spacing mismatch:** Sim deck slide 2 title has `lineSpacing: 1.5`. If exemplar (slide 1) has different line spacing, a caution finding should appear with "line spacing should be X×, currently 1.5×".
- **BP-COLOR-002 — Semi-transparent text:** Sim deck slide 2 has "Draft — do not distribute" at `fontAlpha: 0.4`. Verify a manual finding appears: "Semi-transparent text detected" with "40% opacity".
- **BP-HYGIENE-002 — Off-slide object:** Sim deck slide 2 has "old notes" at position (800, 500) — fully outside the 720×405 canvas. Verify a manual finding: "Object is off-slide" with low overlap percentage.
- **BP-BULLET-002 — Bullet glyph mismatch:** Sim deck slide 3 has bullets with glyph "–". If exemplar bullets use "•", verify a manual finding: "bullet glyph should be •, currently –".

## 4) Persistence Checks

- Perform clean up and ratify.
- Reload the app.
- Verify document state returns with expected `schemaVersion`, `lastUpdatedIso`, findings, patch log, and ratify state.

## 5) Troubleshooting

- Mode stuck in `GOOGLE_SHADOW`
- Confirm bridge capability registration for deck read and revision-guarded apply.

- Apply blocked with revision mismatch
- Re-run clean up to refresh snapshot and retry apply.

- Reconcile state looks unexpected
- Validate adapter read fidelity for signature fields (font family/size/color/bold/italic, bullet indent/hanging).

- Missing persisted state
- Verify document carrier text includes marker block:
  - `MAGISTRAT_STATE_V1_START`
  - `MAGISTRAT_STATE_V1_END`
