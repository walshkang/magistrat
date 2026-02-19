# Google-Primary Gate Snapshot (2026-02-19 Manual Evidence)

- Captured at: `2026-02-18 20:19:15 EST` (`2026-02-19 01:19:15 UTC`)
- Baseline commit before snapshot updates: `ed0bd42`
- Working tree at capture start: clean (`## main...origin/main`)
- Scope: manual evidence capture refresh for Google-primary runbook + Office parity smoke runbook

## Automated Command Results

| Command | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| `npm run test:gate-google-primary` | Gate tests pass. | Passed: `tests 6`, `pass 6`, `fail 0`. | PASS | Verifies stale-phrase, anchor, and portability rule behavior. |
| `npm run gate:google-primary` | Gate script passes stale-phrase, anchor, and portability checks. | Passed: `Google-primary gate passed. Checked 3 stale-phrase rules, 4 anchor files, and 8 portability files.` | PASS | Initial sandbox run failed with `tsx` IPC `listen EPERM`; escalated rerun succeeded. |
| `npm run check` | Workspace lint/typecheck/test checks pass. | Passed across all workspaces. | PASS | Includes compiler/google/office coverage test runs. |
| `npm run test` | Workspace test suites pass. | Passed across all workspaces. | PASS | Includes compiler/google/office adapter tests. |
| `rg -n '/(Users|home)/|C:\\\\Users\\\\' docs README.md AGENTS.md CONTEXT.md` | No machine-home markers in docs/governance files. | No matches; command exited `1` (expected for no matches). | PASS | Confirms portability drift check remains clean. |

## Google Primary Runbook Manual Checks (`docs/SLIDES_RUNBOOK.md`)

| Check | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Sidebar app startup (`npm run dev --workspace @magistrat/slides-addon -- --host 127.0.0.1 --port 3020`) | Vite dev server starts and exposes local URL for manual host validation. | Started successfully; local URL reported as `http://127.0.0.1:3020/`. | PASS | Terminal preflight only; does not validate bridge-backed Google host mode. |
| Diagnostics truthfulness (runtime mode + capability lines) | Mode/capability lines match Google truth table (`SIM`, `GOOGLE_SHADOW`, `GOOGLE_READONLY`, `GOOGLE_SAFE`). | Not executed in bridge-enabled Google Slides host. | BLOCKED | Requires Google Slides host environment + bridge capability registration. |
| Coverage honesty with unsupported object (`NOT_ANALYZED`) | Findings include explicit unsupported coverage entries. | Not executed in bridge-enabled Google Slides host. | BLOCKED | Requires manual run inside host document with unsupported object types. |
| Safe-only apply policy | `Apply safe` mutates only allowlisted safe ops. | Not executed in bridge-enabled Google Slides host. | BLOCKED | Requires manual apply attempt in host. |
| Reconcile correctness | Patch states remain truthful (`applied`, `reverted_externally`, `drifted`, `missing_target`). | Not executed in bridge-enabled Google Slides host. | BLOCKED | Requires apply + external mutate/re-read loop in host. |
| Continuity findings (`BP-CONT-001`, `BP-CONT-002`) | Deterministic continuity findings appear when triggering conditions are present. | Not executed in bridge-enabled Google Slides host. | BLOCKED | Manual host evidence still required for this runbook item. |
| Persistence checks (`schemaVersion`, `lastUpdatedIso`, findings, patch log, ratify state) | State persists and reloads with expected fields. | Not executed in bridge-enabled Google Slides host. | BLOCKED | Requires host-backed document-state carrier validation. |

## Office Parity Smoke Manual Checks (`docs/SMOKE_TEST_RUNBOOK.md`)

| Check | Expected | Observed | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Tunnel preflight | At least one tunnel path is available (`ngrok` or `cloudflared`). | `cloudflared` available (`2026.2.0`); `ngrok` not found. | PASS | Can proceed via `cloudflared` path. |
| Smoke prep command | Smoke artifacts generated for supplied origin. | Passed with custom outputs: `/tmp/taskpane.smoke.env`, `/tmp/manifest.test.xml`. | PASS | Command: `npm run smoke:prepare --workspace @magistrat/taskpane -- --origin https://example.ngrok-free.app --env-out /tmp/taskpane.smoke.env --manifest-out /tmp/manifest.test.xml`. |
| Taskpane smoke-mode startup | Vite starts in smoke mode and exposes local URL. | Started successfully at `http://127.0.0.1:3010/` (process then intentionally terminated). | PASS | Exit code `143` after intentional kill during log capture. |
| Manifest sideload into PowerPoint host | Manifest uploads successfully in desktop/web PowerPoint host. | Not executed in Office host. | BLOCKED | Requires interactive PowerPoint sideload environment. |
| Diagnostics truthfulness by Office mode | Diagnostics match `SIM`/`OFFICE_SHADOW`/`OFFICE_READONLY` truth table. | Not executed in Office host. | BLOCKED | Requires PowerPoint host session. |
| Clean up execution behavior | Clean up executes only where read capability is supported. | Not executed in Office host. | BLOCKED | Requires in-host invocation. |
| `NOT_ANALYZED` coverage on unsupported object | Findings include explicit unsupported coverage entry. | Not executed in Office host. | BLOCKED | Requires unsupported object in host deck. |
| `Apply safe` disabled in parity modes | `Apply safe` remains disabled in `OFFICE_SHADOW` + `OFFICE_READONLY`. | Not executed in Office host. | BLOCKED | Requires in-host UI validation. |

## Reproducible Host Command Set (Runbook Canonical)

### Google primary

```bash
npm run dev --workspace @magistrat/slides-addon
```

### Office parity

```bash
cloudflared tunnel --url http://localhost:3010
```

```bash
npm run smoke:prepare --workspace @magistrat/taskpane -- --origin https://<tunnel-host>
```

```bash
npm run dev --workspace @magistrat/taskpane -- --host 0.0.0.0 --mode smoke
```

Use `apps/taskpane/manifest.local.xml` for PowerPoint sideload after smoke prep.

## Drift / Portability Notes

- Stale-phrase, anchor, and portability checks are passing via `npm run gate:google-primary`.
- No machine-home path markers found in `docs/`, `README.md`, `AGENTS.md`, or `CONTEXT.md`.

## Readiness Interpretation

- Automated gate/readiness evidence is current and passing.
- Manual host evidence is still incomplete because bridge-enabled Google host and Office sideload host checks were not executed in this terminal session.
- Release confidence for host positioning remains blocked until runbook manual checks complete in host-capable environments.
