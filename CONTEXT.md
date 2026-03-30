# Magistrat Context

## Active Phase
- Phase 7B: "Profiles as Templates" — Rule profile export/import **Done**

## Next Epic
- Phase 7C: Multi-exemplar (multiple slides contributing rules for different roles)

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
| 6. Complete (24 rules, Office write) | 6 wk | **Complete** — ToleranceConfig, 23 rules, Office SAFE write, taskpane UI parity |
| 7A. Intelligent (exemplar inference) | — | **Complete** — inferCandidateRules, RuleConfirmationPanel, RuleProfile persisted |
| 7B. Profiles as Templates (export/import) | — | **Complete** — clipboard export, JSON paste import, auto-close on success |

## Known Gaps (Phase 7B)
- Export profile button only appears after a scan (`analysisState && ruleProfile`). A user who imports a profile but hasn't scanned yet cannot re-export it to verify. Low priority: they can scan first.

## Phase 7C Candidates
- **Multi-exemplar**: multiple slides each contributing rules for the roles they contain (solves "different roles on different slides" gap from real-doc testing)
- **Slide master generation**: infer style map + position bands → generate Google Slides master (needs Slides API, not Apps Script)

## Decisions Locked For v1
- Google Slides sidebar primary target, with Office parity track maintained.
- In-document state persistence only.
- End-to-end trust loop prioritized over breadth.
- PowerPoint XML manifest path remains for parity and enterprise compatibility checks.
- No LLM inference in the deterministic pipeline.
