import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface MustNotAppearCheck {
  phrase: string;
  files: string[];
}

interface MustAppearCheck {
  file: string;
  requiredPhrases: string[];
}

const mustNotAppearChecks: MustNotAppearCheck[] = [
  {
    phrase: "Magistrat Slides Alpha",
    files: ["apps/slides-addon/index.html"]
  },
  {
    phrase: "Google alpha",
    files: [
      "packages/google-adapter/src/capability-registry.ts",
      "packages/google-adapter/src/providers/google-readonly-provider.ts",
      "packages/google-adapter/src/providers/google-safe-provider.ts",
      "packages/google-adapter/src/providers/sim-provider.ts"
    ]
  },
  {
    phrase: "bootstrap slice",
    files: [
      "packages/office-adapter/src/capability-registry.ts",
      "packages/office-adapter/src/providers/office-readonly-provider.ts",
      "README.md"
    ]
  }
];

const mustAppearChecks: MustAppearCheck[] = [
  {
    file: "docs/PRD.md",
    requiredPhrases: ["Primary platform", "Google Slides Sidebar Add-on"]
  },
  {
    file: "AGENTS.md",
    requiredPhrases: ["Google Slides sidebar primary", "Office task-pane parity track"]
  },
  {
    file: "CONTEXT.md",
    requiredPhrases: ["Google Slides sidebar primary target", "Office parity track maintained"]
  },
  {
    file: "README.md",
    requiredPhrases: ["Google Slides sidebar app shell (primary v1 surface).", "PowerPoint Office task-pane parity app shell."]
  }
];

const portabilityFiles = [
  "README.md",
  "AGENTS.md",
  "CONTEXT.md",
  "docs/PRD.md",
  "docs/SLIDES_RUNBOOK.md",
  "docs/SMOKE_TEST_RUNBOOK.md",
  "docs/SLIDES_ALPHA_RUNBOOK.md",
  "docs/GOOGLE_PRIMARY_DRIFT_CHECKLIST.md"
];

const machineHomePathMarkers = ["/Users/", "/home/", "C:\\Users\\"];

export function evaluateGooglePrimaryGate(readFile: (file: string) => string | undefined): string[] {
  const errors: string[] = [];

  for (const check of mustNotAppearChecks) {
    for (const file of check.files) {
      const content = readFile(file);
      if (!content) {
        continue;
      }

      if (content.includes(check.phrase)) {
        errors.push(`[must-not-appear] "${check.phrase}" found in ${file}`);
      }
    }
  }

  for (const check of mustAppearChecks) {
    const content = readFile(check.file);
    if (!content) {
      continue;
    }

    for (const phrase of check.requiredPhrases) {
      if (!content.includes(phrase)) {
        errors.push(`[must-appear] "${phrase}" missing from ${check.file}`);
      }
    }
  }

  for (const file of portabilityFiles) {
    const content = readFile(file);
    if (!content) {
      continue;
    }

    for (const marker of machineHomePathMarkers) {
      if (content.includes(marker)) {
        errors.push(`[portability] "${marker}" found in ${file}`);
      }
    }
  }

  return errors;
}

export function runGooglePrimaryGate(repoRoot = process.cwd()): number {
  const { readFile, readErrors } = createRepoFileReader(repoRoot);
  const errors = [...evaluateGooglePrimaryGate(readFile), ...readErrors];

  if (errors.length > 0) {
    console.error("Google-primary gate failed.");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  console.log("Google-primary gate passed.");
  console.log(
    `Checked ${mustNotAppearChecks.length} stale-phrase rules, ${mustAppearChecks.length} anchor files, and ${portabilityFiles.length} portability files.`
  );
  return 0;
}

function createRepoFileReader(repoRoot: string): {
  readFile: (file: string) => string | undefined;
  readErrors: string[];
} {
  const cache = new Map<string, string | undefined>();
  const readErrors: string[] = [];

  const readFile = (file: string): string | undefined => {
    if (cache.has(file)) {
      return cache.get(file);
    }

    try {
      const content = readFileSync(resolve(repoRoot, file), "utf8");
      cache.set(file, content);
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      readErrors.push(`[read] ${file}: ${message}`);
      cache.set(file, undefined);
      return undefined;
    }
  };

  return { readFile, readErrors };
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  process.exit(runGooglePrimaryGate());
}
