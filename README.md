# Magistrat

Magistrat is a trust-first slide compiler that performs deterministic deck analysis and reversible style fixes.

## Workspaces

- `apps/slides-addon` - Google Slides sidebar app shell (primary v1 surface).
- `apps/taskpane` - PowerPoint Office task-pane parity app shell.
- `packages/shared-types` - Locked cross-package contracts.
- `packages/compiler-core` - Deterministic analysis/check/planning logic.
- `packages/google-adapter` - Google Slides host abstraction with safe-only apply policy.
- `packages/office-adapter` - Office host abstraction for parity validation and document-state persistence.

## Runtime Modes

### Google Adapter

- `SIM` - Local fixture-backed mode when no Google bridge is present.
- `GOOGLE_SHADOW` - Bridge diagnostic mode that blocks read/apply when prerequisites are missing.
- `GOOGLE_READONLY` - Bridge mode with read enabled and apply disabled.
- `GOOGLE_SAFE` - Bridge mode with read enabled and safe-op-only apply enabled under revision guard.

### Office Adapter (Parity Track)

- `SIM` - Deterministic fixture-backed mode used for parity development and trust-loop validation.
- `OFFICE_SHADOW` - Diagnostic host mode that reports capabilities explicitly and blocks unsupported actions.
- `OFFICE_READONLY` - Desktop host mode with read enabled and patch apply intentionally policy-disabled for the Office parity track.

## Manual Validation

- Google Slides runbook (primary): `docs/SLIDES_RUNBOOK.md`
- Office smoke runbook (parity/diagnostic): `docs/SMOKE_TEST_RUNBOOK.md`
- Cloudflare bootstrap command for Office smoke: `./scripts/bootstrap-cloudflare-smoke.sh`
- Google-primary alignment plan: `docs/GOOGLE_PRIMARY_ALIGNMENT_PLAN.md`
- Google-primary drift checklist: `docs/GOOGLE_PRIMARY_DRIFT_CHECKLIST.md`

## Packaging Notes

- Workspace packages currently expose TypeScript source entrypoints for bootstrap velocity.
- Transitional `exports` maps are in place; full `dist` entrypoint migration is deferred to a later milestone.

## Commands

- `npm install`
- `npm run gate:google-primary`
- `npm run check`
- `npm run test`
- `npm run dev --workspace @magistrat/slides-addon`
- `npm run dev --workspace @magistrat/taskpane`
- `./scripts/bootstrap-cloudflare-smoke.sh`
