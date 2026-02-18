# Magistrat Context

## Active Phase
- Phase 0: Greenfield bootstrap.

## Active Epic
- Foundations + vertical trust-loop slice:
  - exemplar selection
  - deterministic checks
  - reversible patches
  - ratify + drift scaffolding

## Immediate Blocker
- Google-primary release gate is not yet fully codified in CI; stale policy copy and drift checks remain partially manual.

## Immediate Priorities (next 2 weeks)
1. Codify Google-primary drift gate as a CI-blocking check.
2. Remove stale alpha/bootstrap wording from user-facing policy copy.
3. Keep runbook references portable (repo-relative) and aligned with canonical docs.
4. Capture a dated gate-readiness snapshot with command outcomes and manual runbook status.
5. Maintain deterministic `NOT_ANALYZED` and reconcile truthfulness while hardening release language.
6. Keep Google safe-apply revision guard and chunking behavior stable under gate updates.
7. Maintain Office parity diagnostics truth without enabling live patch apply.
8. Start trust-loop UX depth planning after gate baseline is stable.

## Decisions Locked For v1
- Google Slides sidebar primary target, with Office parity track maintained.
- In-document state persistence only.
- End-to-end trust loop prioritized over breadth.
- PowerPoint XML manifest path remains for parity and enterprise compatibility checks; unified manifest reevaluation stays future-scoped.
