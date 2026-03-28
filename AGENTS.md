# MAGISTRAT — AGENT OPERATING RULES

This file is the single source of truth for how we build here. It applies to humans and all AI agents.

## Platform Context
Google Slides sidebar primary surface for v1. Office task-pane parity track maintained for enterprise compatibility.

## Read First
- `AGENTS.md` (this file) — operating rules, invariants, multi-agent routing
- `DESIGN.md` — UI/UX source of truth (layout, interaction, visual system, component inventory)
- `CONTEXT.md` — active phase, immediate blockers, implementation memory
- `docs/VIBE_PLAYBOOK.md` — product voice and interaction principles
- `docs/UX_RULES.md` — surface model and UX guardrails
- `docs/BEST_PRACTICES_PLAYBOOK.md` — deterministic rules, evidence contracts, patch safety

## Instruction Priority (highest -> lowest)
1. `AGENTS.md`
2. `DESIGN.md`
3. `CONTEXT.md`
4. `docs/PRD.md` + `docs/BEST_PRACTICES_PLAYBOOK.md` (win for product behavior if conflicts)
5. `docs/UX_RULES.md` + `docs/VIBE_PLAYBOOK.md`
6. Other docs in `/docs`

---

## Constitution (non-negotiable invariants)

1. **Logic over magic:**
   - Runtime behavior is deterministic.
   - No LLM inference for routing/filtering/scoring/apply decisions.

2. **Closed-world semantics:**
   - v1 roles are fixed: `TITLE`, `SUBTITLE`, `BODY`, `BULLET_L1`, `BULLET_L2`, `FOOTER`, `CALLOUT`, `UNKNOWN`
   - No free-form role labels.

3. **Evidence-first findings:**
   - Every finding includes observed/expected/evidence/confidence/risk/severity/source.
   - `NOT_ANALYZED` is explicit with reason code. Never silent.

4. **Suggestions-first + reversibility:**
   - No automatic risky actions.
   - All patches are typed, logged, and reversible.

5. **Reconciliation truthfulness:**
   - Patch log state must reconcile with host-native undo/redo reality.
   - Never show stale or misleading apply state.

If you must break an invariant, note it explicitly in the PR and update this file.

---

## Definition of Done

- Tests updated/added for behavior changes.
- Verification steps listed and run when possible.
- New API contracts exported through package public entrypoints.
- Migrations + type regeneration when schema changes.
- `npm run check` and `npm run test` pass locally when environment allows.

## Diff Hygiene

- Smallest diff that satisfies acceptance criteria.
- Separate behavior changes from regen/formatting churn.
- Keep diffs minimal; avoid drive-by refactors while bootstrapping.
- Keep interfaces stable once published under `packages/shared-types`.

## Preferred Patterns

- Server-side operations for privileged logic; no service role keys in client code.
- Centralize adapter creation (`packages/google-adapter`, `packages/office-adapter`).
- Deterministic outputs for same input — always.
- Typed patch ops from `packages/shared-types/src/patches.ts`.
- Evidence types from `packages/shared-types/src/findings.ts`.

---

## Required Execution Pattern for Every Task

### A) Plan
- Problem statement
- Invariants touched
- Minimal files to edit
- Explicit non-goals

### B) Implementation
- File-by-file changes (concise, deterministic)

### C) Verification
- Commands run
- Expected and observed outcomes
- Edge cases covered

### D) Risks / Follow-ups
- Remaining risks
- Strictly scoped next steps

---

## Multi-Agent Routing

We use multiple AI agents and tools. Each agent should self-assess whether it is the right tool for the current task, execute if so, or recommend delegating if not. This section is the shared contract all agents read.

### Agent Tiers

Agents self-assign to a tier based on what they can actually do in this session — not by product name. Claude Code, Cursor Composer, Gemini CLI, Copilot CLI, and others all fit somewhere here.

| Tier | Capability | Fits When |
|------|-----------|-----------|
| **Deep** | Cross-file reasoning, architecture, planning, debugging across boundaries, running tests | You can read 5+ files, run shell commands, hold the full context of a contract change |
| **Bounded** | Implementing against an existing contract, component work, pattern-following, unit tests | The contract/interface already exists; you need 1-3 files to execute |
| **Quick** | Trivial edits, renames, type fixes, one-liners, lint | Single file, no design decisions |

### Self-Assessment: "Should I do this or delegate?"

Before starting work, ask these questions:

**1. Does this task cross architectural boundaries?**
Boundaries in this codebase: `shared-types` contracts <-> `compiler-core` logic <-> `google-adapter` / `office-adapter` host abstraction <-> `slides-addon` / `taskpane` UI <-> `docs/BEST_PRACTICES_PLAYBOOK.md` rules.
- Crosses 3+ boundaries -> **Deep** tier plans it, may delegate slices to Bounded.
- Crosses 1-2 boundaries -> **Bounded** can execute if the contract/interface already exists.
- Stays within one file or layer -> **Quick** is fine.

**2. Does it require inventing a new contract, schema, or type?**
New types in `shared-types`, new rule IDs in the playbook, new runtime modes, new reconcile states.
- Yes -> **Deep**. Bounded must not invent contracts; it implements them.
- No, just implementing against an existing contract -> **Bounded**.

**3. Does it require reading 5+ files to understand the change?**
- Yes -> **Deep** (can hold the full context and reason across files).
- No -> **Bounded** or lower.

**4. Is it debugging a cross-boundary failure?**
Adapter mode + compiler logic + UI rendering, or reconcile state + patch log + host undo/redo.
- Yes -> **Deep** (can run tests, read errors, iterate).
- No, isolated bug in one layer -> **Bounded**.

**5. Is it a known pattern with a clear example in the codebase?**
Adding a new rule following existing BP-* patterns, adding a new evidence type through the existing pipeline, adding a new check in `compiler-core/checks.ts`.
- Yes -> **Bounded**. Point it at the example file.
- No precedent exists -> **Deep** creates the first instance, then Bounded follows the pattern.

### Task Routing Reference

#### Deep Tier (plan + execute or plan + delegate)
- New or modified types in `packages/shared-types`
- New or modified rules in `docs/BEST_PRACTICES_PLAYBOOK.md`
- New runtime modes or capability policies in adapters
- `compiler-core` algorithm changes (role inference, style map, patch planner, reconcile)
- UI shell architecture changes (sidebar layout, new zones, new phases)
- Multi-file refactors across package boundaries
- Test strategy design (what to test, edge cases, acceptance criteria)
- Debugging failures that span adapter -> compiler -> UI
- Gate readiness assessment and release decisions
- Updating `AGENTS.md`, `DESIGN.md`, `CONTEXT.md` when scope changes

#### Bounded Tier (execute against existing contracts)
- Individual UI component implementation (when design spec exists in `DESIGN.md`)
- New check implementation in `compiler-core/checks.ts` (when rule is defined in playbook)
- Unit tests following existing patterns in the workspace
- Adapter method implementation (when capability contract is defined)
- CSS / styling per `DESIGN.md` visual system
- Adding new items to existing exhaustive pipelines (new role -> inference -> checks -> patches)
- Documentation updates within existing structure

#### Quick Tier (no design decisions)
- Inline type fixes, import cleanup, rename refactors
- Adding a single enum case to an existing switch
- Fixing lint / prettier issues
- Small copy changes per `docs/VIBE_PLAYBOOK.md`
- Boilerplate completions (filling out a test skeleton that Deep tier outlined)

### Parallel Workflow

When a task can be split:

1. **Deep tier plans.** Read `CONTEXT.md` and the relevant contract docs. Produce a plan that lists:
   - Files to change and why
   - Which slices are safe for Bounded (contract exists, pattern exists)
   - Which slices Deep must own (cross-boundary, new contract, architectural)
   - Intermediate checkpoints (where to sync)

2. **Split and execute in parallel.**
   - Deep works on contract/type/algorithm changes.
   - Bounded works on component/test/styling slices.
   - Neither should block-wait for the other; work on independent slices.

3. **Converge and verify.**
   - Deep reviews Bounded output against invariants.
   - Run `npm run check` and `npm run test`.
   - Verify gate readiness if applicable: `npm run gate:google-primary`.

### Delegation Protocol

When delegating, produce a **handoff block** the human can paste into the other agent's context:

```
## Handoff: [task summary]
**From:** [Deep / Bounded]
**To:** [Deep / Bounded]
**Context:** [1-2 sentences on what's already done]
**Task:** [specific bounded task]
**Contract:** [file path to the contract/types/interface to implement against]
**Pattern:** [file path to an example of the pattern to follow]
**Constraints:**
- Do not modify [specific files/contracts]
- Follow [specific doc] for [specific concern]
**Verify:** [how to check the work, e.g., `npm test --workspace @magistrat/compiler-core`]
```

### Red Lines (any agent)

Stop and re-route if:

- Any agent creating new types in `packages/shared-types` -> must be Deep tier.
- Any agent modifying `docs/BEST_PRACTICES_PLAYBOOK.md` rules -> must be Deep tier.
- Any agent adding new runtime modes or capability policies -> must be Deep tier.
- Any agent restructuring `compiler-core` algorithm flow -> must be Deep tier.
- Deep tier spending time on single-file CSS tweaks or lint fixes -> delegate to Quick.
- Deep tier writing boilerplate tests that follow an existing pattern exactly -> delegate to Bounded.
- Any agent violating an invariant from the Constitution above -> stop, flag it, re-route.

---

## Hard Restrictions

- Do not add AI chat-based slide authoring flows.
- Do not auto-apply manual risk ops in bulk.
- Do not hide unsupported/unknown coverage (NOT_ANALYZED must be visible).
- Do not break groups or mutate masters/layouts in v1.
- Do not introduce LLM inference into the deterministic pipeline.
