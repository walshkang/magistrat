# Google-Primary Drift Checklist

Run this checklist monthly or before any host-positioning announcement.

## 1) Positioning Consistency
- Confirm `docs/PRD.md`, `AGENTS.md`, `CONTEXT.md`, and `README.md` all state Google Slides primary and Office parity.
- Command:

```bash
rg -n "Primary platform|Google Slides|parity|PowerPoint task-pane remains|private alpha" docs README.md AGENTS.md CONTEXT.md
```

## 2) Invariant Language Integrity
- Confirm no regressions in mandatory trust-language (`NOT_ANALYZED`, reversible patches, reconcile truthfulness, no overlay sprawl).
- Command:

```bash
rg -n "NOT_ANALYZED|reversible|reconcile|no on-slide overlays|no floating overlay sprawl" docs AGENTS.md
```

## 3) Runbook Link Integrity
- Confirm README and runbooks reference canonical filenames.
- Command:

```bash
rg -n "SLIDES_RUNBOOK|SMOKE_TEST_RUNBOOK|GOOGLE_PRIMARY_ALIGNMENT_PLAN|GOOGLE_PRIMARY_DRIFT_CHECKLIST" README.md docs
```

## 4) Runtime Copy Parity
- Confirm app shell copy does not use stale alpha wording and reflects primary/parity split.
- Command:

```bash
rg -n "alpha|private alpha|PowerPoint compiler workflow|Google Slides compiler workflow" apps/slides-addon/src/App.tsx apps/taskpane/src/App.tsx
```

## 5) Gate Readiness Snapshot
- Run Google runbook canonical checks and Office parity smoke checks.
- Record date, commit, and pass/fail summary in release notes or changelog notes.
