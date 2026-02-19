# Magistrat Office Parity Smoke Runbook

This runbook defines manual validation for sideloading `@magistrat/taskpane` and verifying Office parity diagnostics truthfulness.

## Scope

- Office host validation is a parity and diagnostics track.
- Desktop validation is required for parity confidence.
- PowerPoint web validation is diagnostic-only.
- Product runtime behavior is not changed by this runbook.
- Google Slides primary-host validation lives in `docs/SLIDES_RUNBOOK.md`.
- Positioning drift checks are documented in `docs/GOOGLE_PRIMARY_DRIFT_CHECKLIST.md`.

## Prerequisites

- Dependencies installed at repo root:

```bash
npm install
```

- PowerPoint account/tenant that allows sideloading add-ins.
- One HTTPS tunnel option installed and authenticated (`ngrok` or `cloudflared`).

## 0) Quick Bootstrap (Recommended)

From repo root:

```bash
./scripts/bootstrap-cloudflare-smoke.sh
```

What this does:

1. Starts a `cloudflared` tunnel to local taskpane port `3010` and captures the HTTPS origin.
2. Runs `smoke:prepare` with that origin to generate:
- `apps/taskpane/.env.smoke.local`
- `apps/taskpane/manifest.local.xml`
3. Starts the taskpane dev server in smoke mode.

Useful options:

```bash
./scripts/bootstrap-cloudflare-smoke.sh --help
./scripts/bootstrap-cloudflare-smoke.sh --origin https://<existing-origin>
```

## 1) Start HTTPS Tunnel

Use one of:

```bash
ngrok http 3010
```

```bash
cloudflared tunnel --url http://localhost:3010
```

Copy the final HTTPS origin (for example `https://abc.ngrok-free.app`).

## 2) Prepare Local Smoke Artifacts

From repo root:

```bash
npm run smoke:prepare --workspace @magistrat/taskpane -- --origin https://abc.ngrok-free.app
```

This command writes:

- `apps/taskpane/.env.smoke.local`
- `apps/taskpane/manifest.local.xml`

Custom output path example:

```bash
npm run smoke:prepare --workspace @magistrat/taskpane -- --origin https://abc.ngrok-free.app --env-out /tmp/taskpane.smoke.env --manifest-out /tmp/manifest.test.xml
```

## 3) Start Taskpane Dev Server

From repo root:

```bash
npm run dev --workspace @magistrat/taskpane -- --host 0.0.0.0 --mode smoke
```

Manual override path (without `.env.smoke.local`):

```bash
VITE_PUBLIC_ORIGIN=https://<tunnel-host> \
VITE_ALLOWED_HOST=<tunnel-host> \
VITE_HMR_HOST=<tunnel-host> \
npm run dev --workspace @magistrat/taskpane -- --host 0.0.0.0
```

## 4) Sideload Manifest

Use the generated XML file.

- PowerPoint on the web: `Insert` -> `Add-ins` -> `My Add-ins` -> `Upload My Add-in`.
- PowerPoint desktop (Windows/Mac): use `My Add-ins` upload flow or tenant-approved sideload path.

## 5) Runtime Truth Table

Expected `Session diagnostics` values by environment:

| Host environment | Expected mode | Read deck | Apply patches |
| --- | --- | --- | --- |
| Non-Office browser | `SIM` | yes | yes |
| PowerPoint web | `OFFICE_SHADOW` | no | no |
| PowerPoint desktop + requirement/capability gate pass | `OFFICE_READONLY` | yes | no |
| PowerPoint desktop + requirement/capability gate fail | `OFFICE_SHADOW` | no | no |

## 6) Canonical Smoke Cases

1. Diagnostics truthfulness
- Open `Session diagnostics` and verify mode + read/apply capability lines match the truth table.

2. Clean up execution behavior
- Run `Run clean up`.
- Confirm execution only where read capability is supported.

3. Coverage honesty (`NOT_ANALYZED`) using unsupported object type
- Include at least one unsupported object type in the deck (for example a table).
- Run clean up and check `Findings` for `BP-COVERAGE-001` with `NOT_ANALYZED:UNSUPPORTED_OBJECT_TYPE`.

4. Patch-apply policy confirmation
- In `OFFICE_READONLY` and `OFFICE_SHADOW`, confirm `Apply safe` remains disabled.

## 7) Troubleshooting

- Stale tunnel origin or env/manifest mismatch
- Re-run `smoke:prepare` whenever tunnel origin changes.
- Re-upload `manifest.local.xml` after regeneration.

- Sideload blocked by tenant policy
- Use approved organizational sideload process or admin-enabled testing tenant.

- Tunnel mismatch / blank task pane
- Ensure `apps/taskpane/.env.smoke.local` and manifest origin match exactly.
- Ensure `VITE_ALLOWED_HOST` includes the tunnel host.

- HMR instability through tunnel
- Set `VITE_HMR_HOST` to the tunnel host (enables `wss` + `443` HMR override).

- Runtime mode not as expected
- Confirm host/platform in `Session diagnostics`.
- Confirm Office requirement-set support and `PowerPoint.run` availability.
