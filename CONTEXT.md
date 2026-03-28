# Magistrat Context

## Active Phase
- Phase 3: "Navigate" — Interactive Minimap + Per-Slide Fix

## Active Epic
- Next: scope Phase 3 (minimap, per-slide filtering, per-finding apply)
- Stitch future-state screen available for reference (minimap + exceptions)

## Immediate Blocker
- None.

## Roadmap (approved 2026-03-28)
See `~/.claude/plans/keen-fluttering-sparrow.md` for full plan.

| Phase | Appetite | Status |
|-------|----------|--------|
| 1. Translate (consumer UI) | 2 wk | **Complete** |
| 2A. Alignment Score | 2 wk | **Complete** |
| 2B. Rule Coverage (8→16) + Trust Loop Polish | 4 wk | **Complete** — 16 rules, ratify UX, change history |
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
