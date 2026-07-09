/**
 * Thin CLI wrapper around the pure `buildMatrix` function (D-08): read the
 * committed normalized corpus + owner-edited tuning-tags file, derive the
 * as-of bound (ship-time default: cutoff = latest show, D-09), build the
 * `TransitionMatrix`, and write the versioned artifact. Mirrors
 * `cli/normalize-corpus.ts`'s structure exactly.
 *
 * `runBuildModel` is exported directly (no shelling out between CLI
 * scripts, CLAUDE.md: all orchestration lives in Node).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import type { AsOfBound, NormalizedCorpus, TransitionMatrix } from "../domain/types.ts";
import { tuningTagsFileSchema, type TuningFamily, type TuningTagsFile } from "../ingest/tuning-tags.ts";
import { buildMatrix } from "../model/matrix.ts";

export interface BuildModelCliOptions {
  corpusPath: string;
  tuningTagsPath: string;
  outPath: string;
  /** YYYY-MM-DD override for the as-of cutoff date. Defaults to the corpus's latest show (D-09). */
  cutoff?: string;
}

export interface BuildModelCliResult {
  matrix: TransitionMatrix;
}

function defaultOptions(): BuildModelCliOptions {
  return {
    corpusPath: config.corpusArtifactPath,
    tuningTagsPath: config.tuningTagsPath,
    outPath: config.matrixArtifactPath,
  };
}

/** Finds the show with the max (date, showOrder) — mirrors 02-RESEARCH.md's findHoldoutShows latest-show reducer. */
function findLatestShow(corpus: NormalizedCorpus) {
  if (corpus.shows.length === 0) {
    throw new Error("Cannot build a transition matrix from an empty corpus (0 shows).");
  }
  return corpus.shows.reduce((latest, show) =>
    show.date > latest.date || (show.date === latest.date && show.showOrder > latest.showOrder)
      ? show
      : latest,
  corpus.shows[0]);
}

/** Loads data/tuning-tags.json (zod-validated, D-01) into a songId -> TuningFamily lookup for buildMatrix's node-decoration parameter. Missing file (not yet generated) yields an empty map -- every node then defaults to "other". */
async function loadTuningFamilyBySongId(tagsPath: string): Promise<Map<number, TuningFamily>> {
  let file: TuningTagsFile;
  try {
    const raw = await readFile(tagsPath, "utf8");
    file = tuningTagsFileSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map();
    }
    throw err;
  }
  const bySongId = new Map<number, TuningFamily>();
  for (const entry of file.entries) {
    bySongId.set(entry.songId, entry.family);
  }
  return bySongId;
}

export async function runBuildModel(
  options: Partial<BuildModelCliOptions> = {},
): Promise<BuildModelCliResult> {
  const opts: BuildModelCliOptions = { ...defaultOptions(), ...options };

  const corpus = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;
  const tuningFamilyBySongId = await loadTuningFamilyBySongId(opts.tuningTagsPath);

  const asOf: AsOfBound = opts.cutoff
    ? { date: opts.cutoff, showOrder: Number.MAX_SAFE_INTEGER, inclusive: true }
    : (() => {
        const latest = findLatestShow(corpus);
        return { date: latest.date, showOrder: latest.showOrder, inclusive: true };
      })();

  // Deterministic provenance (Pitfall 2 / "byte-stable across repeated
  // rebuilds"): reuse the input corpus's own generatedAt rather than
  // wall-clock `new Date()` -- two build-model runs against the SAME
  // committed corpus.json must emit byte-identical matrix artifacts. The
  // matrix's generatedAt changes only when its input snapshot changes.
  const matrix = buildMatrix(corpus, asOf, config, {
    tuningFamilyBySongId,
    generatedAt: corpus.generatedAt,
  });

  await mkdir(dirname(opts.outPath), { recursive: true });
  // Stable 2-space formatting + trailing newline — makes `git diff` the review mechanism (Pitfall 2).
  await writeFile(opts.outPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

  return { matrix };
}

export function formatBuildModelSummary(result: BuildModelCliResult): string {
  const { matrix } = result;
  return (
    `Built transition matrix: ${matrix.nodeCount} nodes, ${matrix.edgeCount} edges, ` +
    `as-of ${matrix.asOfDate} (${matrix.showCount} shows).`
  );
}

/** Validates --cutoff as a bounded YYYY-MM-DD date BEFORE it is ever used to construct an AsOfBound (Security V5, mirrors cli/refresh.ts's validateYearArg bounded-integer convention). */
function validateCutoffArg(rawValue: string | undefined): string {
  if (rawValue === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    throw new Error(
      `Invalid --cutoff value ${JSON.stringify(rawValue)}: must be a YYYY-MM-DD date.`,
    );
  }
  const year = Number.parseInt(rawValue.slice(0, 4), 10);
  if (year < config.cliYearMin || year > config.cliYearMax) {
    throw new Error(
      `--cutoff year ${year} is out of range. Valid range is ${config.cliYearMin}-${config.cliYearMax}.`,
    );
  }
  return rawValue;
}

function parseArgs(argv: string[]): Partial<BuildModelCliOptions> {
  const options: Partial<BuildModelCliOptions> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      options.outPath = argv[++i];
    } else if (arg === "--cutoff") {
      options.cutoff = validateCutoffArg(argv[++i]);
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return options;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runBuildModel(options);
    console.log(formatBuildModelSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
