# Magistrat

Magistrat is a trust-first PowerPoint compiler add-in that performs deterministic deck analysis and reversible style fixes.

## Workspaces

- `apps/taskpane` - Office task-pane app shell.
- `packages/shared-types` - Locked cross-package contracts.
- `packages/compiler-core` - Deterministic analysis/check/planning logic.
- `packages/office-adapter` - Office host abstraction and document-state persistence.

## Runtime Modes

- `SIM` - Deterministic fixture-backed mode used for bootstrap development and trust-loop validation.
- `OFFICE_SHADOW` - Diagnostic host mode that reports capabilities explicitly and blocks unsupported actions.
- `OFFICE_READONLY` - Desktop host mode with read enabled and patch apply intentionally policy-disabled for the bootstrap slice.

## Manual Smoke Validation

- Runbook: `/Users/walsh.kang/Documents/GitHub/magistrat/docs/SMOKE_TEST_RUNBOOK.md`
- Manifest template: `/Users/walsh.kang/Documents/GitHub/magistrat/apps/taskpane/manifest.template.xml`
- Generate local manifest:
  - `npm run manifest:local --workspace @magistrat/taskpane -- --origin https://<your-tunnel-host>`

## Packaging Notes

- Workspace packages currently expose TypeScript source entrypoints for bootstrap velocity.
- Transitional `exports` maps are in place; full `dist` entrypoint migration is deferred to a later milestone.

## Commands

- `npm install`
- `npm run check`
- `npm run test`
