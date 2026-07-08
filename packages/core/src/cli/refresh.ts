/**
 * THE one documented command (D-02/DATA-02): `npm run refresh -- [flags]`.
 *
 * `parseRefreshArgs` is a pure, unit-testable argument parser (security V5:
 * `--year` is validated as a bounded integer BEFORE any URL/path
 * interpolation happens anywhere downstream). `main()` is a thin
 * orchestrator that delegates to `fetch-corpus.ts` and
 * `normalize-corpus.ts` directly — no shelling out between CLI scripts.
 *
 * Flag semantics (D-05):
 *   --all             full historical pull: years corpusYearStart..currentYear + all sibling tables
 *   --year <YYYY>      (repeatable) only the named year(s); add --tables for sibling tables too
 *   --fetch-only       fetch only, skip census/normalize
 *   --census-only      run only the census report over committed raw data
 *   --normalize-only   run only the normalize step over committed raw JSON
 *   --input <dir>      input directory for --normalize-only (default: config.dataRawDir)
 *   --out <path>       output path for the normalized artifact (default: config.corpusArtifactPath)
 *   (no flags)         D-05 routine refresh: current year only, then census + normalize
 */
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import { fetchCorpus } from "./fetch-corpus.ts";
import { formatNormalizeSummary, runNormalizeCorpus } from "./normalize-corpus.ts";
import { runCensusCli } from "./run-census.ts";

export type RefreshMode = "all" | "year" | "current" | "normalize-only" | "census-only";

export interface RefreshOptions {
  mode: RefreshMode;
  /** Years to fetch — populated for "all" | "year" | "current". */
  years: number[];
  /** Whether to also fetch shows/songs/albums/jamcharts — "all" always true; "year" only with --tables. */
  includeTables: boolean;
  /** Skip census + normalize after fetching. */
  fetchOnly: boolean;
  /** Input directory for --normalize-only. */
  inputDir: string;
  /** Output path for --normalize-only. */
  outPath: string;
}

const KNOWN_FLAGS = [
  "--all",
  "--year",
  "--fetch-only",
  "--census-only",
  "--normalize-only",
  "--tables",
  "--input",
  "--out",
];
const FLAGS_TAKING_A_VALUE = new Set(["--year", "--input", "--out"]);

function printUsage(): void {
  console.log(`Usage: node packages/core/src/cli/refresh.ts [flags]

Flags:
  --all                   Fetch the full historical corpus (${config.corpusYearStart}..current year) + sibling tables
  --year <YYYY>           Fetch/refresh a single year (repeatable). Add --tables for sibling tables too
  --tables                With --year: also fetch shows/songs/albums/jamcharts
  --fetch-only            Fetch only, skip census/normalize
  --census-only           Run only the census report over committed raw data
  --normalize-only        Run only the normalize step over committed raw JSON
  --input <dir>           Input directory for --normalize-only (default: ${config.dataRawDir})
  --out <path>            Output path for the normalized artifact (default: ${config.corpusArtifactPath})
  (no flags)              D-05 routine refresh: current year only, then census + normalize

Valid --year range: ${config.cliYearMin}-${config.cliYearMax}.
`);
}

/**
 * Validates a `--year` value as a bounded integer BEFORE it is ever
 * interpolated into a URL path or filename (ASVS V5, T-01-08).
 */
function validateYearArg(rawValue: string | undefined): number {
  const rangeMessage = `Valid --year range is ${config.cliYearMin}-${config.cliYearMax}.`;
  if (rawValue === undefined || !/^-?\d+$/.test(rawValue)) {
    throw new Error(`Invalid --year value ${JSON.stringify(rawValue)}: must be an integer. ${rangeMessage}`);
  }
  const year = Number.parseInt(rawValue, 10);
  if (year < config.cliYearMin || year > config.cliYearMax) {
    throw new Error(`--year ${year} is out of range. ${rangeMessage}`);
  }
  return year;
}

/** Pure argument parser — no I/O, fully unit-testable (fetch.test.ts Task 7). */
export function parseRefreshArgs(argv: string[], currentYear: number): RefreshOptions {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue; // a flag's value, already consumed below
    if (!KNOWN_FLAGS.includes(arg)) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (FLAGS_TAKING_A_VALUE.has(arg)) i++; // skip the value
  }

  const years: number[] = [];
  let inputDir: string = config.dataRawDir;
  let outPath: string = config.corpusArtifactPath;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--year") years.push(validateYearArg(argv[++i]));
    else if (argv[i] === "--input") inputDir = argv[++i];
    else if (argv[i] === "--out") outPath = argv[++i];
  }

  const fetchOnly = argv.includes("--fetch-only");

  if (argv.includes("--normalize-only")) {
    return { mode: "normalize-only", years: [], includeTables: false, fetchOnly: false, inputDir, outPath };
  }
  if (argv.includes("--census-only")) {
    return { mode: "census-only", years: [], includeTables: false, fetchOnly: false, inputDir, outPath };
  }
  if (argv.includes("--all")) {
    const allYears: number[] = [];
    for (let y = config.corpusYearStart; y <= currentYear; y++) allYears.push(y);
    return { mode: "all", years: allYears, includeTables: true, fetchOnly, inputDir, outPath };
  }
  if (years.length > 0) {
    return { mode: "year", years, includeTables: argv.includes("--tables"), fetchOnly, inputDir, outPath };
  }
  // D-05 default: no flags -> current year only, no sibling tables.
  return { mode: "current", years: [currentYear], includeTables: false, fetchOnly, inputDir, outPath };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  let options: RefreshOptions;
  try {
    options = parseRefreshArgs(argv, new Date().getFullYear());
  } catch (err) {
    console.error((err as Error).message);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    if (options.mode === "normalize-only") {
      const result = await runNormalizeCorpus({ inputDir: options.inputDir, outPath: options.outPath });
      console.log(formatNormalizeSummary(result));
      return;
    }

    if (options.mode === "census-only") {
      const { census, filesRead } = await runCensusCli();
      console.log(
        `Census complete over ${filesRead.length} file(s). ${Object.keys(census.fields).length} fields censused, ` +
          `${census.derived.distinctKglwSongCount} distinct KGLW songs, ${census.derived.contiguityViolations.length} contiguity violations.`,
      );
      return;
    }

    const fetchResult = await fetchCorpus({ years: options.years, includeTables: options.includeTables });
    console.log(
      `Fetched ${fetchResult.filesWritten.length} file(s): ${fetchResult.filesWritten.join(", ")}`,
    );

    if (options.fetchOnly) {
      return;
    }

    // D-05 routine refresh: fetch, then census, then normalize.
    const { census, filesRead } = await runCensusCli();
    console.log(
      `Census complete over ${filesRead.length} file(s). ${Object.keys(census.fields).length} fields censused, ` +
        `${census.derived.distinctKglwSongCount} distinct KGLW songs, ${census.derived.contiguityViolations.length} contiguity violations.`,
    );

    const normalizeResult = await runNormalizeCorpus({
      inputDir: options.inputDir,
      outPath: options.outPath,
    });
    console.log(formatNormalizeSummary(normalizeResult));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await main();
}
