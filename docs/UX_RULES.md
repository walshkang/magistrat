# Magistrat UX Rules

## Core Flow
1. Choose exemplar and inspect health.
2. Run clean-up checks for selected scope.
3. Review findings with evidence, confidence, and risk.
4. Apply/revert typed patches.
5. Ratify style status and monitor drift.

## Required UI Elements (v1)
- Exemplar selection with original vs normalized choice.
- Swiss Monitor layout with three layers: HUD (top), linter stream (middle), patch/ratify surface (bottom or tab).
- Findings list grouped by slide/role/rule.
- Coverage meter showing analyzed and not analyzed states.
- Patch log with reconciliation state and revert actions.
- Session diagnostics for host and document state schema.
- Dense, code-precise rendering for measured values (for example `12pt`, `#1A1A1A`, `4px`).

## Guardrails
- No hidden automated mutations.
- No floating overlay sprawl; sidebar/task-pane-first workflow.
- Any ghosting must be preview/select mediated from the host surface, not persistent on-canvas overlays.
- No high-risk geometry or master/layout mutations in v1.
