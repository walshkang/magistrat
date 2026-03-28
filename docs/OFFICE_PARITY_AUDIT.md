# Office parity audit

Phase 5 deliverable: how compiler rules line up across Google (primary) and Office (parity) tracks.

**Office parity track:** Analysis uses a [`DeckSnapshot`](../packages/shared-types/src/ir.ts) from the Office adapter. In **`OFFICE_READONLY`**, the host is read-capable but **patch application is policy-disabled** (Office parity policy). **`SIM`** mode uses deterministic fixture-backed snapshots for local development and trust-loop validation; capabilities and apply behavior follow that adapter’s policy (see [`README.md`](../README.md) and [`docs/SMOKE_TEST_RUNBOOK.md`](SMOKE_TEST_RUNBOOK.md)).

**Google:** Full analysis and apply where the runtime mode and capabilities allow (see adapter truth tables in runbooks).

The table below lists the **16** distinct `ruleId` values emitted from [`packages/compiler-core/src/checks.ts`](../packages/compiler-core/src/checks.ts). Rule **names** match the **`title`** patterns in [`packages/compiler-core/src/finding-translator.ts`](../packages/compiler-core/src/finding-translator.ts) (`RULE_TRANSLATORS`). Where the UI title is parameterized by role and observed/expected fields, the name is given as the template shape.

| Rule ID | Rule name (from `finding-translator.ts` `title`) | Google | Office | Notes |
| --- | --- | --- | --- | --- |
| BP-TYPO-001 | `{Role} font should be {expected fontFamily}, currently {observed fontFamily}` | ✅ | 🔍 | Read-only analysis on snapshot; apply disabled in `OFFICE_READONLY`. |
| BP-TYPO-002 | `{Role} should be {expected bold/italic}, currently {observed}` | ✅ | 🔍 | Same as above. |
| BP-TYPO-003 | `{Role} font size should be {expected}pt, currently {observed}pt` | ✅ | 🔍 | Same as above. Autofit still gates font-size checks in `checks.ts` (may yield `NOT_ANALYZED` / `BP-COVERAGE-001`). |
| BP-TYPO-004 | Mixed font families in one text box | ✅ | 🔍 | Requires multiple text runs with differing families. Current [`office-readonly-provider`](../packages/office-adapter/src/providers/office-readonly-provider.ts) aggregates a single run per shape, so this rule **typically does not emit** on that snapshot even when mixed fonts exist in the host. |
| BP-TYPO-005 | `{Role} line spacing should be {expected}×, currently {observed}×` | ✅ | 🔍 | Read-only analysis; apply disabled in `OFFICE_READONLY`. |
| BP-COLOR-001 | `{Role} color should be {expected fontColor}, currently {observed fontColor}` | ✅ | 🔍 | Same as above. |
| BP-COLOR-002 | Semi-transparent text detected | ✅ | 🔍 | Same as above. |
| BP-COLOR-003 | Callout fill color should be {expected fillColor}, currently {observed fillColor} | ✅ | 🔍 | Same as above. |
| BP-BULLET-001 | `{Role} bullet indent does not match exemplar` | ✅ | 🔍 | Office readonly snapshot sets `inspectability.bullets: false`; when bullet metrics are required, `checks.ts` surfaces **`NOT_ANALYZED`** (with `BP-COVERAGE-001`) rather than `BP-BULLET-001` / `BP-BULLET-002`. Apply disabled in `OFFICE_READONLY` regardless. |
| BP-BULLET-002 | `{Role} bullet glyph should be "{expected}", currently "{observed}"` | ✅ | 🔍 | Same bullet / coverage gating as BP-BULLET-001. |
| BP-HYGIENE-001 | Invisible object blocking content | ✅ | 🔍 | Geometry + visibility + text alpha; read-only analysis. |
| BP-HYGIENE-002 | Object is off-slide | ✅ | 🔍 | Uses slide canvas constants in `checks.ts` (720×405); read-only analysis. |
| BP-HYGIENE-003 | Possible duplicate object | ✅ | 🔍 | IOU + text match; read-only analysis. |
| BP-HYGIENE-004 | Placeholder text detected | ✅ | 🔍 | Text pattern match; read-only analysis. |
| BP-HYGIENE-005 | Proofing language is {observed}, deck uses {expected} | ✅ | 🔍 | Depends on `proofingLanguage` on text runs. Current Office readonly mapper does not populate it; rule **typically does not emit** on that snapshot. Apply still policy-disabled in `OFFICE_READONLY`. |
| BP-COVERAGE-001 | Not analyzed | ✅ | 🔍 | Explicit `NOT_ANALYZED` / coverage contract (`ruleId` `BP-COVERAGE-001`). `translateFinding` routes these to `translateNotAnalyzed`, so the UI title is **"Not analyzed"**, not a dedicated `RULE_TRANSLATORS` entry. |

### Continuity rules (outside the 16 `checks.ts` IDs)

Deck continuity checks live in [`packages/compiler-core/src/continuity.ts`](../packages/compiler-core/src/continuity.ts) and still participate in `runChecks` output. They use the same translator table:

| Rule ID | Rule name (from `finding-translator.ts` `title`) | Google | Office | Notes |
| --- | --- | --- | --- | --- |
| BP-CONT-001 | Slide has no title | ✅ | 🔍 | Read-only analysis on snapshot; apply disabled in `OFFICE_READONLY`. |
| BP-CONT-002 | Agenda item has no matching slide | ✅ | 🔍 | Same as above. |
