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
- Repository started empty; baseline architecture, contracts, and docs had to be created from scratch.

## Immediate Priorities (next 2 weeks)
1. Stand up monorepo with locked shared contracts.
2. Ship Google Slides sidebar shell with host diagnostics.
3. Implement deterministic IR, role inference, and exemplar health.
4. Introduce findings engine and safe/caution/manual patch planning.
5. Establish test coverage for role inference, scoring, findings integrity, and patch policy.
6. Harden Google adapter runtime path with revision-guarded apply and chunked execution.
7. Add per-feature capability gates with explicit NOT_ANALYZED fallback reasons.
8. Add Office parity verification scenarios for Windows (WebView2) and Mac (WebKit) host behavior differences.

## Decisions Locked For v1
- Google Slides sidebar primary target, with Office parity track maintained.
- In-document state persistence only.
- End-to-end trust loop prioritized over breadth.
- PowerPoint XML manifest path remains for parity and enterprise compatibility checks; unified manifest reevaluation stays future-scoped.
