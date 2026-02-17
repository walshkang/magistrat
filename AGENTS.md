# MAGISTRAT — AGENT OPERATING RULES

## 0) Instruction Priority (highest -> lowest)
1. `AGENTS.md`
2. `CONTEXT.md`
3. `docs/UX_RULES.md` + `docs/VIBE_PLAYBOOK.md`
4. Other docs in `/docs`

If a rule conflicts with `/Users/walsh.kang/Downloads/magistrat-prd-v3.md` or `/Users/walsh.kang/Downloads/magistrat-bestpracticesplaybook-v1.md`, the PRD and playbook win for product behavior.

## 1) Startup Protocol (must run before coding)
Before proposing or writing code:
- Read: `AGENTS.md`, `CONTEXT.md`, `docs/VIBE_PLAYBOOK.md`, `docs/UX_RULES.md`
- Summarize in 5 bullets:
  - active phase
  - active epic
  - immediate blocker
  - invariants at risk
  - minimal file set to change

## 2) Constitution (non-negotiable invariants)
1. Logic over magic:
- Runtime behavior is deterministic.
- No LLM inference for routing/filtering/scoring/apply decisions.

2. Closed-world semantics:
- v1 roles are fixed:
  - `TITLE`, `SUBTITLE`, `BODY`, `BULLET_L1`, `BULLET_L2`, `FOOTER`, `CALLOUT`, `UNKNOWN`
- No free-form role labels.

3. Evidence-first findings:
- Every finding includes observed/expected/evidence/confidence/risk/severity/source.
- `NOT_ANALYZED` is explicit with reason code.

4. Suggestions-first + reversibility:
- No automatic risky actions.
- All patches are typed, logged, and reversible.

5. Reconciliation truthfulness:
- Patch log state must reconcile with native PowerPoint undo/redo reality.
- Never show stale or misleading apply state.

## 3) Surface Model + UX Guardrails
- Single task-pane as v1 host UI.
- Calm copy: precise, non-hyped, compiler-language-first.
- Mandatory visibility:
  - findings evidence
  - confidence + risk
  - coverage and `NOT_ANALYZED`
- No generative writing assistant surface in v1.

## 4) Data + Backend Rules
- v1 persistence is in-document only.
- No cloud auth or multi-user backend in bootstrap scope.
- Store schema-versioned state and migration hooks.

## 5) Scope Discipline
- Smallest diff that satisfies acceptance criteria.
- Avoid broad refactors while bootstrapping.
- Keep interfaces stable once published under `packages/shared-types`.

## 6) Definition of Done
1. Tests updated or added for behavior changes.
2. Verification commands and outcomes documented.
3. New API contracts exported through package public entrypoints.
4. `npm run check` and `npm run test` pass locally when environment allows.

## 7) Required Execution Pattern for Every Task
Use this structure in implementation responses:

### A) Plan
- problem statement
- invariants touched
- minimal files to edit
- explicit non-goals

### B) Implementation
- file-by-file changes (concise, deterministic)

### C) Verification
- commands run
- expected and observed outcomes
- edge cases covered

### D) Risks / Follow-ups
- remaining risks
- strictly scoped next steps

## 8) Hard Restrictions
- Do not add AI chat-based slide authoring flows.
- Do not auto-apply manual risk ops in bulk.
- Do not hide unsupported/unknown coverage.
- Do not break groups or mutate masters/layouts in v1.
