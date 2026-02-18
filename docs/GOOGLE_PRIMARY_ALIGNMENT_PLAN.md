# Google-Primary Alignment Plan

## Objective
Align runtime behavior, release gates, and parity checks with the Google Slides primary-host positioning while preserving trust-loop invariants.

## Scope
- Google Slides host path is the primary release lane.
- Office host path remains a parity lane.
- Deterministic checks, explicit `NOT_ANALYZED`, typed reversible patches, and reconcile truthfulness are non-negotiable.

## Workstream Steps (1-5)

1. Runtime Surface Copy Alignment
- Remove stale "alpha" and Office-first language from user-facing shell copy.
- Keep compiler-language tone and no-chat framing.
- Done when both shells describe their role accurately (Google primary, Office parity).

2. Capability Truth Table Lock
- Ensure documented truth tables match adapter runtime modes for Google and Office.
- Validate diagnostics fields remain explicit for unsupported capability paths.
- Done when runbooks and runtime diagnostics labels are consistent.

3. Google Release Gate (Primary Lane)
- Define required checks before Google-host release: clean up scan, safe apply, reconcile states, ratify persistence, `NOT_ANALYZED` visibility.
- Define minimum manual scenarios for local SIM and bridge-enabled mode.
- Done when all gate checks are captured in the Google runbook and pass in target environments.

4. Office Parity Gate (Secondary Lane)
- Maintain parity smoke coverage without blocking Google-primary delivery.
- Require diagnostics truthfulness and policy constraints (`OFFICE_READONLY`/`OFFICE_SHADOW` apply disabled).
- Done when Office smoke results are stable and mapped to parity status.

5. Operational Readiness + Drift Control
- Add lightweight cadence for doc/runtime drift checks (copy, runbook links, mode names, safety semantics).
- Capture ownership and update path for future host-mode additions.
- Done when a single monthly drift-check checklist is in place and linked from README/runbooks.

## Acceptance Criteria
- No top-level docs contradict Google-primary positioning.
- Runbook links resolve and use canonical filenames.
- UI shell copy does not claim private alpha status.
- Trust-loop invariant language remains explicit in docs and runtime diagnostics surfaces.

## Out of Scope
- Feature redesign of patch engine, role inference, or evidence schema.
- New backend/cloud state architecture.
- Expanding role enum beyond v1 closed-world labels.
