import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { materializeManifestTemplate } from "../src/devtools/manifest-materializer";

interface CliOptions {
  origin?: string;
  out?: string;
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
  const outputPath = options.out ? resolve(process.cwd(), options.out) : resolve(taskpaneDir, "manifest.local.xml");

  const templateXml = await readFile(templatePath, "utf8");
  const result = materializeManifestTemplate({
    templateXml,
    origin,
    addinId: options.addinId,
    addinName: options.addinName
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.manifestXml, "utf8");

  console.log(`Generated manifest: ${outputPath}`);
  console.log(`Taskpane origin: ${result.origin}`);
  console.log(`Taskpane host: ${result.host}`);
  console.log(`Add-in id: ${result.addinId}`);
  console.log(`Add-in name: ${result.addinName}`);
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
      case "--out":
        options.out = expectValue(argv, index, arg);
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
  console.log(`Usage: tsx scripts/materialize-manifest.ts [options]

Options:
  --origin <https-origin>   Required unless TASKPANE_ORIGIN is set
  --out <path>              Output path (default: apps/taskpane/manifest.local.xml)
  --addin-id <guid>         Optional add-in GUID override
  --addin-name <name>       Optional add-in display name override
  --help, -h                Show this help
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`materialize-manifest failed: ${message}`);
  process.exitCode = 1;
});
