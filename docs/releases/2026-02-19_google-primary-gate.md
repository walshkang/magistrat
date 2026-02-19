# Google-Primary Gate Snapshot (2026-02-19)

- Captured at: `2026-02-19 08:51:19 EST` (`2026-02-19 13:51:19 UTC`)
- Baseline commit before snapshot updates: `e9311e6`
- Working tree at capture start: clean (`## main...origin/main`)
- Scope: canonical readiness refresh (automated checks + manual preflight + strict live-host status)
- Snapshot policy: canonical single-file daily update (`docs/releases/YYYY-MM-DD_google-primary-gate.md`)

## Automated Command Results

| Command | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| `npm run test:gate-google-primary` | Gate tests pass. | Passed: `tests 6`, `pass 6`, `fail 0`. | PASS | Portability + stale phrase + anchor behavior intact. |
| `npm run gate:google-primary` | Gate script passes stale-phrase, anchor, portability checks. | Passed: `Google-primary gate passed. Checked 3 stale-phrase rules, 4 anchor files, and 8 portability files.` | PASS | No rerun needed in this session. |
| `npm run check` | Workspace lint/typecheck/tests pass. | Passed across all workspaces. | PASS | Includes compiler/google/office/shared-types checks. |
| `npm run test` | Workspace test suites pass. | Passed across all workspaces. | PASS | Includes compiler/google/office adapter suites. |
| `rg -n '/(Users|home)/|C:\\\\Users\\\\' docs README.md AGENTS.md CONTEXT.md` | No machine-home path markers. | No matches; exit code `1`. | PASS | `rg` exit code `1` is expected when there are no matches. |

## Google Manual Checks (`docs/SLIDES_RUNBOOK.md`)

| Check | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Sidebar startup preflight (`npm run dev --workspace @magistrat/slides-addon -- --host 127.0.0.1 --port 3020`) | Dev server starts and exposes local URL. | Sandbox run failed with `listen EPERM`; escalated rerun succeeded with `http://127.0.0.1:3020/`. | PASS | Preflight only; not a live Google host validation. |
| Live Google host availability preflight (`curl -I https://slides.google.com`) | Google host reachable for bridge-backed runbook execution. | Failed with `curl: (6) Could not resolve host: slides.google.com`. | BLOCKED | Strict live-host checks remain blocked in this environment. |
| Diagnostics truthfulness (mode + capability lines) | Runtime diagnostics match truth table (`SIM`, `GOOGLE_SHADOW`, `GOOGLE_READONLY`, `GOOGLE_SAFE`) and capability fields. | Not observed in a bridge-enabled Google Slides host. | BLOCKED | Source-verified literals pending host observation: `Deck snapshot is unavailable in GOOGLE_SHADOW mode.`, `Patch application is disabled in GOOGLE_SHADOW mode.`, `Patch application is disabled in GOOGLE_READONLY mode.` |
| Coverage honesty (`NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`) | Unsupported objects emit explicit coverage findings. | Not observed in a bridge-enabled Google Slides host. | BLOCKED | Requires live host run with unsupported object types (table/image/chart). |
| Continuity findings (`BP-CONT-001`, `BP-CONT-002`) | Continuity findings emit deterministically when triggers are present. | Not observed in a bridge-enabled Google Slides host. | BLOCKED | Requires live host run with agenda/title trigger conditions. |
| Safe-only apply policy | `Apply safe` mutates allowlisted safe ops only. | Not observed in a bridge-enabled Google Slides host. | BLOCKED | Requires live host apply execution with mixed safe/caution findings. |
| Reconcile truthfulness (`applied`, `reverted_externally`, `drifted`, `missing_target`) | Patch-log states reconcile with host-native changes/undo. | Not observed in a bridge-enabled Google Slides host. | BLOCKED | Requires apply + external mutate/delete + reread loop in host. |
| Persistence rehydrate (`schemaVersion`, `lastUpdatedIso`, findings, patch log, ratify, coverage) | State persists and reloads accurately. | Host-backed reload not observed. | BLOCKED | Source verification confirms `DocumentStateV1` initializes `schemaVersion: 1`; strict host persistence evidence still pending. |

## Office Parity Manual Checks (`docs/SMOKE_TEST_RUNBOOK.md`)

| Check | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Tunnel tool preflight | At least one tunnel tool available. | `cloudflared version 2026.2.0` found; `ngrok` not installed. | PASS | `cloudflared` path remains available. |
| Smoke prep (`npm run smoke:prepare --workspace @magistrat/taskpane -- --origin https://example.ngrok-free.app --env-out /tmp/taskpane.smoke.env --manifest-out /tmp/manifest.test.xml`) | Smoke artifacts generated for provided origin. | Sandbox run failed with `tsx` IPC `listen EPERM`; escalated rerun succeeded and wrote `/tmp/taskpane.smoke.env` + `/tmp/manifest.test.xml`. | PASS | Preflight generation confirmed. |
| Taskpane smoke startup preflight (`npm run dev --workspace @magistrat/taskpane -- --host 0.0.0.0 --mode smoke`) | Dev server starts and exposes URLs. | Sandbox run failed with `listen EPERM`; escalated rerun succeeded with `http://localhost:3010/` and `http://192.168.1.196:3010/`. | PASS | Preflight only; not a sideloaded Office host validation. |
| Tunnel/host reachability preflight (`curl -I https://example.ngrok-free.app`) | Smoke origin reachable from execution environment. | Failed with `curl: (6) Could not resolve host: example.ngrok-free.app`. | BLOCKED | Live sideload path remains blocked in this environment. |
| Manifest sideload in PowerPoint web (`OFFICE_SHADOW`) | Manifest uploads and taskpane loads in web host. | Not observed in PowerPoint web host session. | BLOCKED | Requires interactive sideload flow in Office web. |
| Manifest sideload in PowerPoint desktop (`OFFICE_READONLY`) | Manifest loads in desktop host with parity mode. | Not observed in PowerPoint desktop host session. | BLOCKED | Requires interactive sideload flow in Office desktop. |
| Diagnostics truthfulness (mode/capability/reason fields) | Diagnostics match truth table and capability reasons in host. | Not observed in Office hosts. | BLOCKED | Source-verified apply-disabled literals pending host observation: `Patch application is disabled in OFFICE_SHADOW mode until live host mutations are validated.` and `Patch application is disabled in OFFICE_READONLY mode for the Office parity track.` |
| Clean up execution gating | Clean up runs only where read capability is supported. | Not observed in Office hosts. | BLOCKED | Requires run in web + desktop hosts. |
| Unsupported coverage (`BP-COVERAGE-001`, `NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`) | Unsupported objects emit explicit coverage findings. | Not observed in Office hosts. | BLOCKED | Requires unsupported object in sideloaded host deck. |
| Apply-disabled parity policy | `Apply safe` disabled in `OFFICE_SHADOW` and `OFFICE_READONLY`. | Not observed in Office hosts. | BLOCKED | Expected literal disabled reasons listed above; host evidence pending. |

## Drift / Portability Notes

- Stale-phrase, anchor, and portability checks are passing via `npm run gate:google-primary`.
- No machine-home path markers found in scoped docs/governance files.
- This snapshot uses repo-relative paths only.

## Readiness Interpretation

- Automated gate/readiness evidence is current and passing.
- Strict live-host evidence remains incomplete in this environment.
- Remaining blocked rows:
  - Google diagnostics truthfulness
  - Google unsupported coverage (`NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`)
  - Google continuity findings (`BP-CONT-001`, `BP-CONT-002`)
  - Google safe-only apply
  - Google reconcile states (`applied`, `reverted_externally`, `drifted`, `missing_target`)
  - Google persistence rehydrate
  - Office web diagnostics (`OFFICE_SHADOW`)
  - Office desktop diagnostics (`OFFICE_READONLY`)
  - Office clean up gating
  - Office unsupported coverage (`NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`)
  - Office apply-disabled parity policy
