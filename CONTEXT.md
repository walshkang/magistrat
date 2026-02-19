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
- Fresh strict live-host evidence is incomplete as of `docs/releases/2026-02-19_google-primary-gate.md`; automated gate readiness is green, but remaining rows are: Google diagnostics truthfulness, Google unsupported coverage (`NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`), Google continuity findings (`BP-CONT-001`, `BP-CONT-002`), Google safe-only apply, Google reconcile states (`applied`, `reverted_externally`, `drifted`, `missing_target`), Google persistence rehydrate, Office web diagnostics (`OFFICE_SHADOW`), Office desktop diagnostics (`OFFICE_READONLY`), Office clean up gating, Office unsupported coverage (`NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`), and Office apply-disabled parity policy.

## Immediate Priorities (next 2 weeks)
1. Keep a dated gate-readiness snapshot cadence with command outcomes and explicit manual runbook status.
2. Capture manual Google (`docs/SLIDES_RUNBOOK.md`) and Office parity (`docs/SMOKE_TEST_RUNBOOK.md`) runbook evidence in a host-capable environment.
3. Start decision-complete trust-loop UX depth planning after manual gate evidence is current.
4. Maintain deterministic `NOT_ANALYZED` and reconcile truthfulness while hardening release language.
5. Keep Google safe-apply revision guard and chunking behavior stable under gate maintenance.
6. Maintain Office parity diagnostics truth without enabling live patch apply.
7. Keep Google-primary drift checks (copy, runbook links, portability markers) current as docs evolve.

## Decisions Locked For v1
- Google Slides sidebar primary target, with Office parity track maintained.
- In-document state persistence only.
- End-to-end trust loop prioritized over breadth.
- PowerPoint XML manifest path remains for parity and enterprise compatibility checks; unified manifest reevaluation stays future-scoped.
