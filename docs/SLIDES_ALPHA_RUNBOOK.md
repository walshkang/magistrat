# Magistrat Google Slides Alpha Runbook

This runbook defines manual validation for the private alpha Google Slides surface (`apps/slides-addon`) and `@magistrat/google-adapter` capability truthfulness.

## Scope

- Google Slides private alpha path only.
- Trust loop validation in sidebar UI: exemplar -> findings -> apply safe -> reconcile -> ratify.
- No shared backend; state is persisted in a document-owned hidden marker payload.

## Prerequisites

- Dependencies installed at repo root:

```bash
npm install
```

- Google bridge implementation available for the runtime environment (or SIM mode for local development).

## 1) Start the Sidebar App

From repo root:

```bash
npm run dev --workspace @magistrat/slides-addon
```

Open the local URL reported by Vite (default `http://localhost:3020`).

## 2) Runtime Truth Table

Expected diagnostics by environment:

| Environment | Expected mode | Read deck | Apply patches |
| --- | --- | --- | --- |
| Local browser (no bridge) | `SIM` | yes | yes (safe ops only) |
| Bridge present, read unavailable | `GOOGLE_SHADOW` | no | no |
| Bridge present, read yes, write no | `GOOGLE_READONLY` | yes | no |
| Bridge present, read yes, write yes + revision guard | `GOOGLE_SAFE` | yes | yes (safe ops only) |

## 3) Canonical Alpha Checks

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
- Re-run read/reconcile cycle and verify patch-log states remain truthful (`applied`, `reverted_externally`, `drifted`, `missing_target`).

5. Continuity findings
- Validate agenda/title checks are emitted deterministically (`BP-CONT-001`, `BP-CONT-002`) when input conditions are present.

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
