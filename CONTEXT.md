# Magistrat Context

## Active Phase
- Phase 7C: "Multi-exemplar" — Multiple exemplar slides contributing rules **Done**

## Next Epic
- Phase 7D: TBD — slide master generation, or real-doc validation pass

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
| 7C. Multi-exemplar | — | **Complete** — mergeStyleMaps, up to 3 exemplar slides, additional fills missing roles |

## Known Gaps (Phase 7B)
- Export profile button only appears after a scan (`analysisState && ruleProfile`). A user who imports a profile but hasn't scanned yet cannot re-export it to verify. Low priority: they can scan first.

## Phase 7D — REST API Provider (prerequisite for 7E+)
The Apps Script Add-on API returns `null` for theme-inherited typography (fontFamily, fontSize, etc.), causing widespread `API_LIMITATION` skips on real decks. The Google Slides REST API returns resolved/computed values. This is a prerequisite for:
- Accurate inspection of master-styled slides (the majority of shapes in real decks)
- Slide master generation (7E) — reading and writing master layouts requires REST API

**Scope:** New `google-rest-provider.ts` in google-adapter alongside the existing providers. Reads presentation via `slides.presentations.get` (OAuth token from Apps Script `ScriptApp.getOAuthToken()`). Bridges into the existing `DeckSnapshot` shape. No write path needed in this slice.

## Phase 7E Candidates (after REST API)
- **Slide master generation**: infer style map + position bands → generate a Google Slides master layout
- **Visual error highlighting**: navigate sidebar to the offending shape on click (requires REST API or `SlidesApp.getSelection()`)

## Decisions Locked For v1
- Google Slides sidebar primary target, with Office parity track maintained.
- In-document state persistence only.
- End-to-end trust loop prioritized over breadth.
- PowerPoint XML manifest path remains for parity and enterprise compatibility checks.
- No LLM inference in the deterministic pipeline.
