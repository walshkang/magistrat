# Magistrat — Product Requirements Document (PRD)

* **Status:** Draft (Source of truth v0.5 — Google pivot)
* **Owner:** Walsh
* **Date:** 2026-02-18
* **Product type:** **Slide compiler** (not a slide chatbot)
* **Primary platform:** **Google Slides Sidebar Add-on** (Apps Script + HTML service)

---

## 0) One-liner

**Magistrat compiles Google Slides decks into brand-perfect output** by inferring the *intended roles* of slide elements (title/subtitle/body/bullets/etc) from an **exemplar slide**, linting against an editable **Best Practices Playbook**, detecting drift with evidence, proposing reversible fixes, and guiding teams through **Clean up → Review changes → Ratify** inside the Google Slides sidebar during authoring.

---

## 1) Core decisions (locked for v1)

### Identity

* **Primary promise:** Brand-perfect, consulting-grade formatting you can trust.
* **Not:** “Write my deck,” generative slide authoring, or a loose AI formatting toy.
* **Hero user:** Consulting teams (associates → managers) reusing slides under time pressure.
* **Emotional outcome:** “I look polished; I’m not missing anything.”
* **Tone:** Editorial craftsmanship; calm, precise, non-hyped.
* **Core actions:** **Clean up → Review changes → Ratify**

### Strategic wedge

* **Wedge use case:** Slide reuse + last-mile cleanup + consistency across Frankenstein decks.
* **Differentiator:** Deterministic + evidence-backed + reversible (compiler-like), not “AI magic.”
* **Winning frame:** *Lint + formatter + reference checker for Google Slides.*

### Exemplar-first style source of truth (locked)

* Users select **a single slide as the exemplar** for this deck/run.
* Exemplar can be “dirty”; Magistrat treats it as the **intent anchor**.
* Magistrat extracts a **Role Style Map**:

  * `ROLE → style tokens (+ optional geometry cluster stats)`
* **Majority extraction is not the default.** It is only a fallback within a detected cluster after exemplar selection.

### Best Practices Playbook (new, locked)

* Magistrat ships with a default **Best Practices Playbook** (Markdown, “agents.md-style”).
* Playbook is **editable in-app** and can be customized per-deck and per-team.
* Playbook is used to:

  1. score **Exemplar Health**,
  2. optionally generate a **Normalized Exemplar** (virtual by default),
  3. inform Safe/Caution/Manual risk labeling and copy.

### Exemplar Health + Normalized Exemplar (new, locked)

* When an exemplar is chosen, Magistrat:

  * flags where it violates best practices (**Exemplar Health**)
  * offers a **Normalized Exemplar preview** before setting the style map
* User must choose:

  * **Use Original Exemplar** (intent anchor as-is), or
  * **Use Normalized Exemplar** (recommended; cleaner role map)
* Normalization is **virtual by default** (affects the Role Style Map, not the slide), unless the user explicitly applies it as a reversible patch.

### Closed-world semantic reasoning (locked)

* Magistrat may only label objects using a fixed enum (v1 roles below).
* No free-form labels, no invented roles.
* When confidence is low: label `UNKNOWN` and request a quick user correction (optional).

### v1 role enum (frozen)

* `TITLE`
* `SUBTITLE`
* `BODY`
* `BULLET_L1`
* `BULLET_L2`
* `FOOTER`
* `CALLOUT`
* `UNKNOWN`

(Explicitly out of scope for v1: chart labels, SmartArt semantics, deep table rewriting.)

### Continuity / reference integrity (locked)

* Magistrat checks whether slides **match how the deck refers to them** (agenda/TOC/section headers).
* Treat this as a compiler reference check: **definitions ↔ references** must agree.

### Suggestions-first + reversibility (locked)

* Magistrat never applies changes without review unless explicitly “Accept all safe.”
* Every applied change is logged as typed patch operations and is reversible (per-change and per-run).

### Native Undo/Redo interoperability (new, locked)

* Magistrat does not rely on host undo stacks **but must remain undo-aware**.
* If the user undoes/redoes changes natively, Magistrat must reconcile its patch log and never misrepresent reality.

### Ratify semantics are tolerant (locked)

* Ratification is split:

  * **Style Ratified** (Magistrat-owned)
  * **Content changed since style ratify** (informational)
* Typos should not invalidate **Style Ratified** unless they introduce measurable style drift (overflow, font change, role mismatch).

### Deployment & rollout (locked-ish)

* v1 targets a narrow “trust loop”: exemplar → checks → reversible fixes → ratify → drift detection.
* Team rollout is additive (no blocking gates).
* Google Slides sidebar is the primary v1 surface for the trust loop.
* PowerPoint remains an additive parity track and must not relax trust invariants.

### PowerPoint parity track (2026-02-18)

* Office task-pane support remains active for parity validation and enterprise compatibility testing.
* Parity track follows the same safeguards: in-document state persistence, safe-op-only bulk apply, explicit `NOT_ANALYZED`, and revision-guarded reconcile truthfulness.
* Parity track does not block Google-first v1 milestone decisions.

### Documentation migration note (2026-02-18)

* Google runbook canonical path: `docs/SLIDES_RUNBOOK.md`
* Backward-compatible alias retained: `docs/SLIDES_ALPHA_RUNBOOK.md`

---

## 2) Vision (where this plays)

Magistrat is the **authoring-time compiler** for executive communication: it turns deck cleanup from a subjective, error-prone polish sprint into a deterministic, inspectable, reversible process.

---

## 3) Problem statement

Consulting teams reuse slides constantly. Masters are often unusable. Teams still need brand-consistent output, fast, under pressure—without breaking layouts or missing continuity issues (agenda mismatch, wrong section headers, inconsistent titles, etc.). Existing “AI slide tools” optimize for generation, not trust.

---

## 4) Goals and non-goals

### Goals (v1)

* Deterministic role inference + style linting based on exemplar
* Best Practices Playbook-driven exemplar health + optional normalization
* Evidence-backed findings with confidence + risk labels
* Reversible patch application (per-finding, per-run)
* Native Undo/Redo reconciliation
* Continuity checks (agenda/TOC ↔ slides)
* Ratify + drift detection with tolerant semantics
* Always-visible **Coverage Meter** (what was analyzed vs not)

### Non-goals (v1)

* Generating new slides or rewriting content
* Fully redesigning layouts or changing deck narrative
* Aggressive geometry auto-fixes (detection-first; fixes are gated)
* Table/SmartArt “rebuild” operations
* Automatic deletion of masters/layouts in bulk (report-only or explicit command later)

---

## 5) Target users and primary jobs

### Primary user (hero)

* Consulting associate producing decks from reused slides

### Secondary users

* Manager doing “final pass”
* Ops / brand team wanting consistency without template rollouts

### Jobs to be done

* “Make this Franken-deck look like it came from one hand.”
* “Fix drift without breaking layout.”
* “Prove it’s consistent (or show exactly what isn’t).”
* “Catch embarrassing continuity/reference mistakes.”

---

## 6) Product experience requirements

### Core workflow (v1)

**0. Choose style source**

* User selects **Exemplar slide**.
* Magistrat runs **Exemplar Health** (Best Practices Playbook) and shows:

  * score + top issues (“why this exemplar will be noisy”)
  * role coverage preview (“We can confidently extract: Title, Subtitle, Body, Bullet L1, Footer”)
* Magistrat offers **Normalized Exemplar preview**:

  * **Use Original Exemplar**
  * **Use Normalized Exemplar** (recommended)
  * Optional: **Apply normalization to exemplar slide** (explicit reversible patch)
* Optional quick correction UI for low-confidence roles (“This is Subtitle, not Title”).

**1. Clean up**

* Scope selection: **Current slide | Selected slides | Whole deck**
* Magistrat runs checks progressively (see performance strategy).

**2. Review findings**

* Findings list grouped by: **Slide → Role → Rule**
* Each finding includes:

  * Observed vs expected
  * Evidence (why expected)
  * Confidence
  * Risk label (Safe / Caution / Manual)
  * **Source**: exemplar | playbook | continuity
* **Coverage Meter (always visible):**

  * Slides analyzed / total
  * Objects analyzed / total
  * Top unhandled object types
  * Continuity coverage (may be higher than shape coverage)
* Actions:

  * Apply fix
  * Dismiss (wrong)
  * Ignore rule (deck-level) with required rationale
  * Jump to object (selects shape)
  * Mark exemplar correction (if misclassified)

**3. Review changes**

* Patch timeline:

  * “Before” vs “After” preview when available
  * Typed patch list + jump-to-object
  * Revert per patch / per finding / per run

**4. Ratify**

* User can ratify **Style Ratified** for deck (or scoped subset).
* Subsequent changes show:

  * Still Style Ratified
  * Content changed since ratify (info)
  * Style drift detected (requires review)
* Ratify view includes a short “what was checked” coverage summary.

### UI surfaces (v1)

* **Single Google Slides sidebar** with Swiss Monitor density:

  1. **HUD (top):** health ring, current anchor, and primary action (`Fix safe` or `Ratify style`)
  2. **Linter stream (middle):** grouped findings with observed vs expected diff rows in monospace values
  3. **Patch + ratify surface (bottom/tab):** typed patch log, reconciliation state, revert controls, ratify summary
  4. **Foundry (phase 2 tab):** exemplar/library-backed smart snippet insertions via deterministic clone ops
* No on-slide overlays in v1 (only select/jump + task-pane preview markers, plus temporary host selection highlight when available).
* No chatbot interaction pattern in v1; user input is structured controls, not prompts.

### Language and copy (locked)

* Calm, precise, non-hyped.
* Avoid anthropomorphism (“I think…”).
* Prefer compiler metaphors: “finding,” “evidence,” “patch,” “precondition failed,” “not analyzed.”

---

## 7) Compiler model (how Magistrat works)

### Host integration (Google Slides-first, parity-capable)

* Reads shapes/text runs/layout attributes from the live presentation.
* Applies changes via typed patch operations.
* Tracks stable object references best-effort; if a target cannot be resolved, patch is skipped and flagged.
* Google-first execution model uses deterministic `presentations.get` reads + atomic `presentations.batchUpdate` writes.
* PowerPoint parity implementation remains supported under the same deterministic read/write and reconcile contract.

### Runtime capability gating (v1)

* Every host operation is guarded by feature/requirement-set checks before execution.
* Unsupported feature paths degrade to explicit findings with `NOT_ANALYZED` + reason code (never silent fallback).
* Capability model must be stable across Google bridge modes and Office parity modes, with deterministic behavior under partial API support.

### Inputs

* Presentation content (shapes/text/tables, slide order)
* **Exemplar slide** (mandatory for v1)
* **Best Practices Playbook** (default + per-deck overrides)
* Optional future: reference deck / org rulepack

### Intermediate representation (IR) (v1)

Conservative IR sufficient for linting + safe formatting:

* Slides
* Shapes (text boxes, basic shapes, images)
* Text properties (runs/paragraph-ish summary; bullets + indent)
* Geometry (x/y/w/h, rotation)
* Z-order index
* Group membership (read-only; do not break)

**Tables (v1):**

* Detect tables and run high-signal checks
* Avoid risky table rewrites unless explicitly allowlisted

### Role inference (closed-world)

For each text-containing shape:

* Extract features:

  * Typography: font family/size/weight/color/case
  * Geometry: top-of-slide, centeredness, margins
  * Structure: bullets + indent level, line count
  * Text signals: length, stopwords ratio (very light)
* Predict role label from the fixed enum.
* If confidence below threshold → `UNKNOWN` + optional user correction.

### Role Style Map (from exemplar)

* For each role found on exemplar: store dominant tokens

  * font family/size/weight/color
  * bullet properties (for bullet roles)
  * optional geometry cluster bands (very conservative)

### Best Practices evaluation

* Playbook rules evaluate:

  * exemplar quality (Exemplar Health)
  * deck findings (where applicable)
* Rules can be suppressed with rationale (audit trail).

### Normalized Exemplar (virtual)

* Apply allowlisted normalization transforms to the exemplar IR to produce a cleaner Role Style Map.
* Do not change the slide unless user explicitly “Apply normalization.”

### Deck Outline Graph (continuity engine)

* Parses agenda/section patterns and maps to slide titles/archetypes where possible.
* Produces referential findings: missing/mismatched entries, inconsistent section headers, etc.

### Findings and patches

* Finding = deterministic predicate + evidence + confidence + risk label + suggested patch (optional).
* Patch ops are typed, small, and reversible.

### Reversibility + reconciliation model (v1)

* Every applied fix generates a typed patch record:

  * `before` snapshot of changed properties
  * `after` properties
  * `target_fingerprint` (object identity + precondition hash)
* Revert:

  * per-finding
  * per-run (undo batch)

**Native Undo/Redo interoperability (required):**

* Magistrat remains correct even if the user uses native host Undo/Redo.
* Each patch has a reconciliation state:

  * **Applied** (matches expected after)
  * **Reverted externally** (matches before)
  * **Drifted** (matches neither; user edits intervened)
  * **Missing target** (object not found)
* UI rules:

  * “Revert” on **Reverted externally** is a no-op with clear status.
  * **Drifted** requires manual review; never apply blind reversions.

### Output artifacts (v1)

* Patch log (in-app)
* Ratify stamp + style signature (stored in-document; mechanism TBD)
* Optional future: exportable “Magistrat report”

---

## 8) Findings contract (must-have)

### Evidence types (v1)

* **Exemplar evidence:** role style map derived from chosen exemplar (original or normalized)
* **Playbook evidence:** best-practice rules (explicit rule IDs)
* **Typographic evidence:** mismatch in font family/size/weight/color vs expected role
* **Structural evidence:** bullet level/indent mismatch
* **Geometric evidence (constrained):** detection-first; fix only with strong cluster + validation
* **Referential evidence:** agenda/TOC/reference mismatch vs target slide
* **Hygiene evidence:** ghost objects, invisible objects, placeholder text, language tags
* **Masters/layout hygiene:** **report-only in v1** (explicit command later)

### Confidence gating (v1, non-negotiable)

Magistrat may only auto-apply in bulk when:

* role classification confidence is high **and**
* expected style confidence is high **and**
* patch op is allowlisted “Safe” **and**
* any required validation passes (e.g., no overflow)

Otherwise: suggest-only or Manual.

### Severity policy (v1)

* **Error:** objectively wrong (placeholder text; missing title if required; font mismatch for high-confidence role)
* **Warn:** likely wrong; needs review (font size; bullets; drift)
* **Info:** hygiene/consistency suggestion

### Finding actions (v1)

* Apply safe fix
* Apply caution fix (explicit review; may require validation)
* Dismiss (wrong) with optional note
* Suppress rule (deck-level) with required rationale

---

## 9) Checks (modules)

### v1 required: Exemplar role + brand checks

* Role token mismatch: font family / weight / color
* Font size mismatch (caution; validate overflow)
* Mixed font families inside one role box (suggest/manual)
* Bullet indent/level mismatch (safe when confident)

### v1 required: Hygiene checks (high ROI)

* Ghost/off-slide objects (suggest delete; safe only when clearly stray)
* Invisible accidental objects (exemplar normalization safe; deck actions cautious)
* Placeholder text detection (error)
* Duplicate overlapping identical text boxes (manual)
* Language tag / proofing language consistency (warn/info)

### v1 required: Continuity checks

* Agenda items without matching slide titles/archetypes
* Section header archetype consistency
* “Slide references” sanity (where detectable)

### Future modules

* Table normalization (high-risk; later)
* Brand palette enforcement (org rulepacks)
* Multi-exemplar blending / per-section style maps

---

## 10) Safety and trust rules (non-negotiable)

* Never apply changes without user intent (except explicit “Accept all safe”).
* Never hide “not analyzed.” Coverage must be visible.
* Never claim a fix is safe if validation is missing.
* Never delete masters/layouts automatically in v1.
* Never break groups in v1.
* Always provide evidence: “why expected,” “what changed,” “how to revert.”
* Always reconcile with reality after native Undo/Redo.

---

## 11) Non-functional requirements (v1)

### Fidelity (must)

* No corrupted decks
* No silent layout shifts
* Patch application is deterministic and scoped

### Performance (targets + strategy)

* Progressive scanning by scope
* Cache IR per slide where possible
* Avoid full-deck rescans unless requested
* Batch host bridge reads/writes to reduce process-bridge chatter (`presentations.get` + `batchUpdate` on Google).
* Chunk large deck operations (target batch size 50–100 objects), yielding between chunks to keep sidebar/task-pane UI responsive.
* Avoid loading broad object graphs by default; load only required properties.

### Reliability

* Graceful degradation on unsupported objects
* “Not analyzed” is an explicit state, not a failure
* Reconciliation remains truthful after native Undo/Redo even when external edits happen between scans.
* Windows/Mac runtime variance is expected; platform-specific gaps must map to explicit capability states, not hidden behavior changes.

### Security & privacy (v1 posture)

* On-device / in-app processing preferred where feasible
* No training on user decks
* Minimal telemetry; opt-in for content-derived metrics
* Authentication-heavy cloud workflows (including NAA) are deferred until after trust-loop hardening.

---

## 12) KPIs (v1 instrumentation)

* Time-to-ratify (per deck)
* Findings resolved per minute
* % safe fixes accepted vs reverted
* Drift detected after ratify (rate)
* Coverage % (and top unhandled objects)
* User suppression rate by rule (signals noisy rules)

---

## 13) Competitive posture (Copilot / Gemini / Claude)

* Magistrat = trust-first compiler inside slide authoring hosts, not content generator.
* Differentiation = exemplar-first intent anchoring + reversible patches + continuity checks + coverage transparency.

---

## 14) Roadmap framing (dev order principles)

### Principles

* Ship the trust loop before breadth.
* Prefer detection before automatic fixing for risky domains.
* Keep ops allowlist small and defensible.

### Suggested slices (v1)

1. Exemplar picker + Exemplar Health + Normalized Exemplar (virtual)
2. Role inference + core typographic checks + safe patch ops + patch log
3. Coverage meter + not-analyzed surfacing + capability gating
4. Google `batchUpdate`/chunking runtime path for large decks (+ Office parity path)
5. Undo/Redo reconciliation states
6. Continuity engine v1
7. Ratify + drift semantics

---

## 15) Open questions (explicit TBDs)

* Best Practices Playbook storage format and persistence mechanism (per deck vs org rulepacks)
* Best way to fingerprint shapes robustly across edits (object identity model)
* Exact triggers for reconciliation (selection change, scan run, ratify check)
* Requirement-set capability registry design (where feature gates live and how rule modules consume them)
* Ratify stamp storage location + compatibility (desktop vs web vs mac)
* Handling decks with multiple true “styles” (client appendix sections, etc.)

---

## Appendix A — Glossary

* **Exemplar:** the selected slide that anchors intent.
* **Role Style Map:** mapping from role → expected style tokens (and optional geometry bands).
* **Best Practices Playbook:** editable rulepack used for exemplar health + best-practice findings.
* **Finding:** evidence-backed rule violation.
* **Patch:** typed reversible change.
* **Ratify:** user asserts “style is correct” under Magistrat’s rules at a point in time.

---

## Appendix B — Minimal JSON schemas (starter)

### Finding (conceptual)

```json
{
  "id": "finding_123",
  "source": "exemplar|playbook|continuity",
  "rule_id": "BP-TYPO-001",
  "slide_id": "slide_7",
  "object_id": "shape_44",
  "role": "TITLE",
  "observed": { "fontFamily": "Calibri" },
  "expected": { "fontFamily": "Aptos Display" },
  "evidence": { "from": "style_map", "exemplar_slide": "slide_2" },
  "confidence": 0.93,
  "risk": "safe|caution|manual",
  "severity": "info|warn|error",
  "suggested_patch": "patch_987"
}
```

### Patch op (conceptual)

```json
{
  "id": "patch_987",
  "target_fingerprint": { "slide_id": "slide_7", "object_id": "shape_44", "precondition_hash": "abc" },
  "before": { "fontFamily": "Calibri" },
  "after": { "fontFamily": "Aptos Display" },
  "reconcile_state": "applied|reverted_externally|drifted|missing_target"
}
```

---

## Appendix C — Safe ops allowlist (v1 draft)

**Safe (allow bulk apply when confidence gates pass):**

* Set font family
* Set font color
* Set bold/italic
* Set bullet indent/hanging (for bullet roles)

**Caution (requires review + validation, never bulk by default):**

* Set font size (validate no overflow/reflow)
* Set line spacing (validate no overflow/reflow)

**Manual (suggest-only):**

* Geometry moves (position/size), except exemplar micro-snap ≤ 0.5pt in normalization
* Duplicate overlap deletion
* Any master/layout operations

---

## Appendix D — Torture tests (must pass before broad rollout)

* Franken-deck: mixed templates + pasted slides + random fonts → can still extract roles and apply safe fixes without layout corruption
* Exemplar is messy → Exemplar Health flags issues and Normalized Exemplar produces cleaner style map
* Undo/Redo: apply 10 patches → native Undo 5 → Magistrat patch log reconciles correctly and never lies
* Drift after ratify: typo edit stays ratified; font edit triggers drift finding
* Coverage: deck heavy with charts/SmartArt → Coverage Meter is honest, continuity checks still run where possible

---
