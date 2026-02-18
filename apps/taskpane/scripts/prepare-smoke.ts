import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { materializeManifestTemplate } from "../src/devtools/manifest-materializer";
import { materializeSmokeEnvFile } from "../src/devtools/smoke-prep";

interface CliOptions {
  origin?: string;
  envOut?: string;
  manifestOut?: string;
  addinId?: string;
  addinName?: string;
  help: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const origin = options.origin ?? process.env.TASKPANE_ORIGIN;
  if (!origin) {
    throw new Error("Missing origin. Provide --origin or TASKPANE_ORIGIN.");
  }

  const taskpaneDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const templatePath = resolve(taskpaneDir, "manifest.template.xml");
  const envOutputPath = options.envOut
    ? resolve(process.cwd(), options.envOut)
    : resolve(taskpaneDir, ".env.smoke.local");
  const manifestOutputPath = options.manifestOut
    ? resolve(process.cwd(), options.manifestOut)
    : resolve(taskpaneDir, "manifest.local.xml");

  const templateXml = await readFile(templatePath, "utf8");
  const manifest = materializeManifestTemplate({
    templateXml,
    origin,
    addinId: options.addinId,
    addinName: options.addinName
  });
  const env = materializeSmokeEnvFile({ origin: manifest.origin });

  await mkdir(dirname(envOutputPath), { recursive: true });
  await writeFile(envOutputPath, env.contents, "utf8");

  await mkdir(dirname(manifestOutputPath), { recursive: true });
  await writeFile(manifestOutputPath, manifest.manifestXml, "utf8");

  console.log("Prepared smoke-test artifacts:");
  console.log(`  env file: ${envOutputPath}`);
  console.log(`  manifest: ${manifestOutputPath}`);
  console.log(`  origin: ${manifest.origin}`);
  console.log(`  host: ${manifest.host}`);
  console.log(`  add-in id: ${manifest.addinId}`);
  console.log(`  add-in name: ${manifest.addinName}`);
  console.log("");
  console.log("Start taskpane dev server:");
  console.log("  npm run dev --workspace @magistrat/taskpane -- --host 0.0.0.0 --mode smoke");
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--origin":
        options.origin = expectValue(argv, index, arg);
        index += 1;
        break;
      case "--env-out":
        options.envOut = expectValue(argv, index, arg);
        index += 1;
        break;
      case "--manifest-out":
        options.manifestOut = expectValue(argv, index, arg);
        index += 1;
        break;
      case "--addin-id":
        options.addinId = expectValue(argv, index, arg);
        index += 1;
        break;
      case "--addin-name":
        options.addinName = expectValue(argv, index, arg);
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function expectValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/prepare-smoke.ts [options]

Options:
  --origin <https-origin>      Required unless TASKPANE_ORIGIN is set
  --env-out <path>             Output path for .env file (default: apps/taskpane/.env.smoke.local)
  --manifest-out <path>        Output path for manifest (default: apps/taskpane/manifest.local.xml)
  --addin-id <guid>            Optional add-in GUID override
  --addin-name <name>          Optional add-in display name override
  --help, -h                   Show this help
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`prepare-smoke failed: ${message}`);
  process.exitCode = 1;
});
