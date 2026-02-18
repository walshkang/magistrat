import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface MustNotAppearCheck {
  phrase: string;
  files: string[];
}

interface MustAppearCheck {
  file: string;
  requiredPhrases: string[];
}

const repoRoot = process.cwd();
const errors: string[] = [];
const cache = new Map<string, string>();

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

if (errors.length > 0) {
  console.error("Google-primary gate failed.");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Google-primary gate passed.");
console.log(`Checked ${mustNotAppearChecks.length} stale-phrase rules and ${mustAppearChecks.length} anchor files.`);

function readFile(file: string): string | undefined {
  if (cache.has(file)) {
    return cache.get(file);
  }

  try {
    const content = readFileSync(resolve(repoRoot, file), "utf8");
    cache.set(file, content);
    return content;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    errors.push(`[read] ${file}: ${message}`);
    return undefined;
  }
}
