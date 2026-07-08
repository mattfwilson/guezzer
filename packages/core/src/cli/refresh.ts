/**
 * THE one documented command (D-02/DATA-02): `npm run refresh -- [flags]`.
 *
 * This plan implements the `--normalize-only` skeleton path only — it
 * delegates to `normalize-corpus.ts`'s exported function directly (no
 * shelling out between CLI scripts). `--all` / `--year` / `--census-only`
 * / `--fetch-only` arrive in plan 01-03; they are listed in usage now,
 * marked "not yet implemented", so the command surface is stable from day
 * one and future plans only fill in behavior, never add new flags.
 */
import { config } from "../config.ts";
import { formatNormalizeSummary, runNormalizeCorpus } from "./normalize-corpus.ts";

const IMPLEMENTED_FLAGS = ["--normalize-only", "--input", "--out"];
const NOT_YET_IMPLEMENTED_FLAGS = ["--all", "--year", "--census-only", "--fetch-only"];
const FLAGS_TAKING_A_VALUE = new Set(["--input", "--out", "--year"]);

function printUsage(): void {
  console.log(`Usage: node packages/core/src/cli/refresh.ts [flags]

Flags (implemented this plan):
  --normalize-only        Run only the normalize step over committed raw JSON
  --input <dir>           Input directory for --normalize-only (default: ${config.dataRawDir})
  --out <path>            Output path for the normalized artifact (default: ${config.corpusArtifactPath})

Flags (not yet implemented — arriving in plan 01-03):
  --all                   Fetch the full historical corpus from kglw.net
  --year <YYYY>           Fetch/refresh a single year
  --census-only           Run the census report over committed raw data
  --fetch-only            Fetch only, skip normalize
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const allKnownFlags = [...IMPLEMENTED_FLAGS, ...NOT_YET_IMPLEMENTED_FLAGS];

  if (argv.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue; // a flag's value, already consumed by its flag below
    if (!allKnownFlags.includes(arg)) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    if (FLAGS_TAKING_A_VALUE.has(arg)) {
      i++; // skip the value
    }
  }

  const requestedNotYetImplemented = NOT_YET_IMPLEMENTED_FLAGS.find((flag) => argv.includes(flag));
  if (requestedNotYetImplemented !== undefined) {
    console.error(`${requestedNotYetImplemented} is not yet implemented (arriving in plan 01-03).`);
    process.exitCode = 1;
    return;
  }

  if (!argv.includes("--normalize-only")) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  let inputDir: string = config.dataRawDir;
  let outPath: string = config.corpusArtifactPath;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") inputDir = argv[++i];
    else if (argv[i] === "--out") outPath = argv[++i];
  }

  try {
    const result = await runNormalizeCorpus({ inputDir, outPath });
    console.log(formatNormalizeSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

await main();
