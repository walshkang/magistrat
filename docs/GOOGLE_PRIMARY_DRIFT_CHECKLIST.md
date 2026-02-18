# Google-Primary Drift Checklist

Run this checklist monthly or before any host-positioning announcement.

`npm run gate:google-primary` is the canonical pass/fail check for this checklist.

## 1) Automated Gate (required)
- Run the gate and treat failures as blocking:

```bash
npm run gate:google-primary
```

## 2) Positioning Consistency (informational)
- Confirm `docs/PRD.md`, `AGENTS.md`, `CONTEXT.md`, and `README.md` still reflect Google primary and Office parity.
- Command:

```bash
rg -n "Primary platform|Google Slides|parity|Office parity" docs/PRD.md README.md AGENTS.md CONTEXT.md
```

## 3) Invariant Language Integrity (informational)
- Confirm no regressions in mandatory trust-language (`NOT_ANALYZED`, reversible patches, reconcile truthfulness, no overlay sprawl).
- Command:

```bash
rg -n "NOT_ANALYZED|reversible|reconcile|no on-slide overlays|no floating overlay sprawl" docs AGENTS.md
```

## 4) Runbook Link Integrity (informational)
- Confirm README and runbooks reference canonical filenames.
- Command:

```bash
rg -n "SLIDES_RUNBOOK|SMOKE_TEST_RUNBOOK|GOOGLE_PRIMARY_ALIGNMENT_PLAN|GOOGLE_PRIMARY_DRIFT_CHECKLIST" README.md docs
```

## 5) Gate Readiness Snapshot
- Run Google runbook canonical checks and Office parity smoke checks.
- Record date, commit, and pass/fail summary in release notes or changelog notes.
