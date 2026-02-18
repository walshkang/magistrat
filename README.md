# Magistrat

Magistrat is a trust-first slide compiler that performs deterministic deck analysis and reversible style fixes.

## Workspaces

- `apps/taskpane` - PowerPoint Office task-pane app shell.
- `apps/slides-addon` - Google Slides sidebar alpha app shell.
- `packages/shared-types` - Locked cross-package contracts.
- `packages/compiler-core` - Deterministic analysis/check/planning logic.
- `packages/office-adapter` - Office host abstraction and document-state persistence.
- `packages/google-adapter` - Google Slides host abstraction with safe-only alpha apply policy.

## Runtime Modes

### Office Adapter

- `SIM` - Deterministic fixture-backed mode used for bootstrap development and trust-loop validation.
- `OFFICE_SHADOW` - Diagnostic host mode that reports capabilities explicitly and blocks unsupported actions.
- `OFFICE_READONLY` - Desktop host mode with read enabled and patch apply intentionally policy-disabled for the bootstrap slice.

### Google Adapter

- `SIM` - Local fixture-backed mode when no Google bridge is present.
- `GOOGLE_SHADOW` - Bridge diagnostic mode that blocks read/apply when prerequisites are missing.
- `GOOGLE_READONLY` - Bridge mode with read enabled and apply disabled.
- `GOOGLE_SAFE` - Bridge mode with read enabled and safe-op-only apply enabled under revision guard.

## Manual Validation

- Office smoke runbook: `/Users/walsh.kang/Documents/GitHub/magistrat/docs/SMOKE_TEST_RUNBOOK.md`
- Google Slides alpha runbook: `/Users/walsh.kang/Documents/GitHub/magistrat/docs/SLIDES_ALPHA_RUNBOOK.md`

## Packaging Notes

- Workspace packages currently expose TypeScript source entrypoints for bootstrap velocity.
- Transitional `exports` maps are in place; full `dist` entrypoint migration is deferred to a later milestone.

## Commands

- `npm install`
- `npm run check`
- `npm run test`
- `npm run dev --workspace @magistrat/taskpane`
- `npm run dev --workspace @magistrat/slides-addon`
