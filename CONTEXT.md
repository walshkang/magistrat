# Magistrat Context

## Active Phase
- Phase 2B: "Coverage" — Rule Coverage Push (8→16 rules)

## Active Epic
- Next: scope Phase 2B rule implementations
- Stitch screens available for Phase 3+4 future state reference

## Immediate Blocker
- None.

## Roadmap (approved 2026-03-28)
See `~/.claude/plans/keen-fluttering-sparrow.md` for full plan.

| Phase | Appetite | Status |
|-------|----------|--------|
| 1. Translate (consumer UI) | 2 wk | **Complete** |
| 2A. Alignment Score | 2 wk | **Complete** |
| 2B. Rule Coverage (8→16) | 4 wk | Queued |
| 3. Interactive Minimap | 2 wk | Queued |
| 4. Exceptions / Ignore | 1 wk | Queued |
| 5. Ship (CI, deploy, reliability) | 2 wk | Queued |
| 6. Complete (24 rules, Office write) | 6 wk | Queued |

## Decisions Locked For v1
- Google Slides sidebar primary target, with Office parity track maintained.
- In-document state persistence only.
- End-to-end trust loop prioritized over breadth.
- PowerPoint XML manifest path remains for parity and enterprise compatibility checks.
- No LLM inference in the deterministic pipeline.
