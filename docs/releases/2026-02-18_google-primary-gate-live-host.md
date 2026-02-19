# Google-Primary Gate Snapshot (2026-02-18 Live Host)

- Captured at: `2026-02-18 20:47:53 EST` (`2026-02-19 01:47:53 UTC`)
- Baseline commit before snapshot updates: `ed0bd42`
- Working tree at capture start: dirty (untracked `docs/releases/2026-02-19_google-primary-gate-manual-evidence.md`, untracked `output/`)
- Evidence standard: strict live hosts only (Google Slides bridge host + PowerPoint web/desktop hosts)
- Supplemental evidence reference (non-blocking): `docs/releases/2026-02-19_google-primary-gate-manual-evidence.md`

## Automated Command Results

| Command | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| `npm run test:gate-google-primary` | Gate tests pass. | Passed: `tests 6`, `pass 6`, `fail 0`. | PASS | Baseline gate test behavior intact. |
| `npm run gate:google-primary` | Gate script passes stale-phrase, anchor, portability checks. | Passed: `Google-primary gate passed. Checked 3 stale-phrase rules, 4 anchor files, and 8 portability files.` | PASS | Initial sandbox run failed with `tsx` IPC `listen EPERM`; escalated rerun succeeded. |
| `npm run check` | Workspace lint/typecheck/test checks pass. | Passed across all workspaces. | PASS | Includes compiler/google/office coverage suites. |
| `npm run test` | Workspace tests pass. | Passed across all workspaces. | PASS | Includes compiler/google/office adapter tests. |
| `rg -n '/(Users|home)/|C:\\\\Users\\\\' docs README.md AGENTS.md CONTEXT.md` | No machine-home path markers. | No matches; command exited `1` (expected when no matches). | PASS | Portability drift check remains clean. |

## Google Manual Checks (`docs/SLIDES_RUNBOOK.md`)

| Check | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Start sidebar app: `npm run dev --workspace @magistrat/slides-addon -- --host 127.0.0.1 --port 3020` | Local app serves and is ready for host attach. | Vite started; local URL `http://127.0.0.1:3020/`. | PASS | Preflight succeeded. |
| Live Google host availability preflight | Google Slides host reachable for add-on validation. | `curl -I https://slides.google.com` failed with `Could not resolve host`. | BLOCKED | Unblock: run in a networked environment with Google host DNS + account access. |
| Diagnostics truthfulness (live host mode/capability lines) | Live diagnostics match bridge reality. | Not executed in live Google Slides host session. | BLOCKED | Unblock: open add-on inside Google Slides with bridge enabled and record mode/capabilities. |
| Unsupported coverage honesty (`BP-COVERAGE-001`, `NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`) | Unsupported object yields explicit `NOT_ANALYZED`. | Not executed in live Google Slides host session. | BLOCKED | Unblock: run clean up on a live deck containing table/image/chart object. |
| Continuity findings (`BP-CONT-001`, `BP-CONT-002`) | Continuity findings emit when trigger conditions are present. | Not executed in live Google Slides host session. | BLOCKED | Unblock: run clean up in live host with agenda/title trigger conditions. |
| Safe-only apply (`Apply safe (N)`, `N > 0`) | Safe patches apply only allowlisted safe ops. | Not executed in live Google Slides host session. | BLOCKED | Unblock: execute `Apply safe` in live host with non-zero safe patch count and validate op class. |
| Reconcile truthfulness (`applied`, `reverted_externally`, `drifted`, `missing_target`) | Reconcile states match host-native post-apply mutations. | Not executed in live Google Slides host session. | BLOCKED | Unblock: perform live host undo/edit/delete scenarios and rerun reconcile. |
| Persistence rehydrate (`schemaVersion`, `lastUpdatedIso`, findings, patch log, ratify`) | State persists and rehydrates after reload. | Not executed in live Google Slides host session. | BLOCKED | Unblock: reload add-on in live host and verify persisted fields. |

## Office Manual Checks (`docs/SMOKE_TEST_RUNBOOK.md`)

| Check | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Start tunnel: `cloudflared tunnel --url http://localhost:3010` | Quick tunnel origin issued. | Tunnel created: `https://tiles-vocals-affair-fluid.trycloudflare.com`. | PASS | Cloudflared connected; command later terminated intentionally after capture. |
| Prepare smoke artifacts: `npm run smoke:prepare --workspace @magistrat/taskpane -- --origin https://tiles-vocals-affair-fluid.trycloudflare.com` | `.env.smoke.local` and `manifest.local.xml` generated for origin. | Passed; artifacts generated and host set to `tiles-vocals-affair-fluid.trycloudflare.com`. | PASS | Initial sandbox run hit `tsx` IPC `EPERM`; escalated rerun succeeded. |
| Start taskpane smoke server: `npm run dev --workspace @magistrat/taskpane -- --host 0.0.0.0 --mode smoke` | Taskpane serves locally and is ready for sideload flow. | Vite started; local `http://localhost:3010/`, network `http://192.168.1.196:3010/`. | PASS | Preflight succeeded. |
| Tunnel reachability preflight from current shell | Tunnel origin resolves/reaches from execution environment. | `curl -I https://tiles-vocals-affair-fluid.trycloudflare.com` failed with `Could not resolve host`. | BLOCKED | Unblock: run from environment with external DNS resolution to tunnel origin. |
| Manifest sideload in PowerPoint web (`OFFICE_SHADOW`) | Manifest uploads and taskpane loads in web host. | Not executed. | BLOCKED | Unblock: perform interactive PowerPoint web sideload session. |
| Manifest sideload in PowerPoint desktop (`OFFICE_READONLY`) | Manifest loads in desktop host with read-capable parity mode. | Not executed. | BLOCKED | Unblock: perform interactive desktop PowerPoint sideload session. |
| Diagnostics truthfulness by mode | `OFFICE_SHADOW`/`OFFICE_READONLY` diagnostics reflect host reality. | Not executed in PowerPoint hosts. | BLOCKED | Unblock: capture `Session diagnostics` in both web and desktop hosts. |
| Clean up execution gating | Clean up runs only where read capability is supported. | Not executed in PowerPoint hosts. | BLOCKED | Unblock: run clean up in both host modes and compare behavior. |
| Unsupported coverage (`NOT_ANALYZED`) | Unsupported object emits explicit coverage finding. | Not executed in PowerPoint hosts. | BLOCKED | Unblock: run clean up in host deck containing unsupported object type. |
| Apply-disabled parity policy | `Apply safe` disabled in `OFFICE_SHADOW` and `OFFICE_READONLY`. | Not executed in PowerPoint hosts. | BLOCKED | Unblock: verify disabled control state in both parity modes. |

## Environment Notes

- Google host app/platform: not reached (DNS resolution failure for `slides.google.com` in this environment).
- Office web host session: not reached (sideload not executed).
- Office desktop host session: not reached (sideload not executed).
- Tunnel origin captured: `https://tiles-vocals-affair-fluid.trycloudflare.com`.
- Sideload artifact path: `apps/taskpane/manifest.local.xml`.

## Drift / Portability Notes

- Gate portability checks remain passing.
- No machine-home markers found in scoped docs/governance files.
- This snapshot uses repo-relative paths only.

## Readiness Interpretation

- Automated gate readiness is current and passing.
- Strict live-host evidence is still incomplete.
- Remaining strict live rows:
  - Google diagnostics truthfulness
  - Google unsupported coverage (`NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`)
  - Google continuity findings (`BP-CONT-001`, `BP-CONT-002`)
  - Google safe-only apply
  - Google reconcile states (`applied`, `reverted_externally`, `drifted`, `missing_target`)
  - Google persistence rehydrate
  - Office web diagnostics (`OFFICE_SHADOW`)
  - Office desktop diagnostics (`OFFICE_READONLY`)
  - Office clean up gating
  - Office unsupported coverage (`NOT_ANALYZED`)
  - Office apply-disabled parity policy
