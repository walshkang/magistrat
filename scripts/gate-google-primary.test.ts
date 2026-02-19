import assert from "node:assert/strict";
import test from "node:test";

import { evaluateGooglePrimaryGate } from "./gate-google-primary.ts";

function createReadFile(contents: Record<string, string>): (file: string) => string | undefined {
  return (file: string) => contents[file];
}

function createPassingContents(): Record<string, string> {
  return {
    "apps/slides-addon/index.html": "Magistrat app shell",
    "packages/google-adapter/src/capability-registry.ts": "Google adapter registry",
    "packages/google-adapter/src/providers/google-readonly-provider.ts": "Readonly provider",
    "packages/google-adapter/src/providers/google-safe-provider.ts": "Safe provider",
    "packages/google-adapter/src/providers/sim-provider.ts": "Sim provider",
    "packages/office-adapter/src/capability-registry.ts": "Office adapter registry",
    "packages/office-adapter/src/providers/office-readonly-provider.ts": "Office readonly provider",
    "README.md":
      "Google Slides sidebar app shell (primary v1 surface). PowerPoint Office task-pane parity app shell.",
    "docs/PRD.md": "Primary platform: Google Slides Sidebar Add-on",
    "AGENTS.md": "Google Slides sidebar primary. Office task-pane parity track.",
    "CONTEXT.md": "Google Slides sidebar primary target. Office parity track maintained.",
    "docs/SLIDES_RUNBOOK.md": "Canonical path docs/SMOKE_TEST_RUNBOOK.md",
    "docs/SMOKE_TEST_RUNBOOK.md": "Local smoke output can be /tmp/taskpane.smoke.env",
    "docs/SLIDES_ALPHA_RUNBOOK.md": "Canonical path docs/SLIDES_RUNBOOK.md",
    "docs/GOOGLE_PRIMARY_DRIFT_CHECKLIST.md": "Runbook links use docs/*.md paths."
  };
}

test("passes with repo-relative links and allowed localhost/tmp examples", () => {
  const contents = createPassingContents();
  contents["docs/SLIDES_RUNBOOK.md"] =
    "Canonical path docs/SMOKE_TEST_RUNBOOK.md and dev URL http://localhost:3020";

  const errors = evaluateGooglePrimaryGate(createReadFile(contents));
  assert.deepEqual(errors, []);
});

test("fails on macOS home path marker", () => {
  const contents = createPassingContents();
  contents["docs/PRD.md"] = "Path /Users/alice/Documents/GitHub/magistrat/docs/SLIDES_RUNBOOK.md";

  const errors = evaluateGooglePrimaryGate(createReadFile(contents));
  assert.ok(errors.includes('[portability] "/Users/" found in docs/PRD.md'));
});

test("fails on linux home path marker", () => {
  const contents = createPassingContents();
  contents["docs/SMOKE_TEST_RUNBOOK.md"] = "Path /home/alice/magistrat/docs/SLIDES_RUNBOOK.md";

  const errors = evaluateGooglePrimaryGate(createReadFile(contents));
  assert.ok(errors.includes('[portability] "/home/" found in docs/SMOKE_TEST_RUNBOOK.md'));
});

test("fails on windows home path marker", () => {
  const contents = createPassingContents();
  contents["docs/SLIDES_ALPHA_RUNBOOK.md"] = "Path C:\\Users\\alice\\Documents\\GitHub\\magistrat\\docs";

  const errors = evaluateGooglePrimaryGate(createReadFile(contents));
  assert.ok(errors.includes('[portability] "C:\\Users\\" found in docs/SLIDES_ALPHA_RUNBOOK.md'));
});

test("preserves stale phrase gate behavior", () => {
  const contents = createPassingContents();
  contents["apps/slides-addon/index.html"] = "Magistrat Slides Alpha";

  const errors = evaluateGooglePrimaryGate(createReadFile(contents));
  assert.ok(errors.includes('[must-not-appear] "Magistrat Slides Alpha" found in apps/slides-addon/index.html'));
});

test("preserves required anchor gate behavior", () => {
  const contents = createPassingContents();
  contents["docs/PRD.md"] = "Google Slides Sidebar Add-on only";

  const errors = evaluateGooglePrimaryGate(createReadFile(contents));
  assert.ok(errors.includes('[must-appear] "Primary platform" missing from docs/PRD.md'));
});
