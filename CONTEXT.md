# Magistrat Context

## Active Phase
- Phase 6: "Complete" — **In Progress** (6A done, 6B/6C next)

## Next Epic
- Phase 7: "Intelligent" (customizable rulesets, exemplar inference, slide master generation)

## Immediate Blocker
- None.

## Roadmap (approved 2026-03-28)
See `~/.claude/plans/keen-fluttering-sparrow.md` for full plan.

| Phase | Appetite | Status |
|-------|----------|--------|
| 1. Translate (consumer UI) | 2 wk | **Complete** |
| 2A. Alignment Score | 2 wk | **Complete** |
| 2B. Rule Coverage (8→16) + Trust Loop Polish | 4 wk | **Complete** — 16 rules, ratify UX, change history |
| 3. Interactive Minimap | 2 wk | **Complete** — minimap, per-slide filtering, slide status |
| 4. Exceptions / Ignore | 1 wk | **Complete** — ignore workflow, score adjustment, exceptions panel |
| 5. Ship (CI, deploy, reliability) | 2 wk | **Complete** — CI gate, ErrorBoundary, telemetry, state migration, clasp deploy, office parity audit |
| 6. Complete (24 rules, Office write) | 6 wk | **6A done** — ToleranceConfig threaded through runChecks. 6B/6C next. |

## Decisions Locked For v1
- Google Slides sidebar primary target, with Office parity track maintained.
- In-document state persistence only.
- End-to-end trust loop prioritized over breadth.
- PowerPoint XML manifest path remains for parity and enterprise compatibility checks.
- No LLM inference in the deterministic pipeline.
