/**
 * Thin CLI wrapper around the pure `normalizeCorpus` function: read every
 * *.json file in an input directory, tolerate both a raw API envelope
 * (`{ error, error_message, data }`) and a bare row array (both committed
 * sample-data formats), concatenate rows, normalize, and write the
 * versioned artifact.
 *
 * `runNormalizeCorpus` is imported directly by `cli/refresh.ts
 * --normalize-only` — no shelling out between CLI scripts (CLAUDE.md: all
 * orchestration lives in Node).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import type { NormalizedCorpus } from "../domain/types.ts";
import { normalizeCorpus, type NormalizeStats } from "../ingest/normalize.ts";

export interface NormalizeCorpusCliOptions {
  inputDir: string;
  outPath: string;
}

export interface NormalizeCorpusCliResult {
  corpus: NormalizedCorpus;
  stats: NormalizeStats;
}

/** Accepts either a bare row array or a `{ data: [...] }` envelope — tolerates both committed sample-data shapes. */
function extractRows(parsed: unknown, fileName: string): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "data" in parsed &&
    Array.isArray((parsed as { data: unknown }).data)
  ) {
    return (parsed as { data: unknown[] }).data;
  }
  throw new Error(
    `${fileName}: expected either a bare row array or an API envelope ({ error, error_message, data }) — got neither.`,
  );
}

export async function runNormalizeCorpus(
  options: NormalizeCorpusCliOptions,
): Promise<NormalizeCorpusCliResult> {
  // Only setlists-*.json carries normalizeCorpus's expected row shape.
  // data/raw also holds sibling tables (shows.json, songs.json, albums.json,
  // jamcharts.json, fetch-meta.json) with entirely different schemas that
  // must never be fed into the setlist-row normalizer (Rule 3 fix, plan
  // 01-04 Task 2 — this CLI had never actually been exercised against the
  // full data/raw directory before this plan; the 25-show interim artifact
  // was produced by pointing --input at data/samples instead).
  const entries = await readdir(options.inputDir, { withFileTypes: true });
  const jsonFileNames = entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.startsWith("setlists-") && entry.name.endsWith(".json"),
    )
    .map((entry) => entry.name)
    .sort();

  if (jsonFileNames.length === 0) {
    throw new Error(`No setlists-*.json files found in input directory: ${options.inputDir}`);
  }

  const allRows: unknown[] = [];
  for (const fileName of jsonFileNames) {
    const raw = await readFile(join(options.inputDir, fileName), "utf8");
    const parsed: unknown = JSON.parse(raw);
    allRows.push(...extractRows(parsed, fileName));
  }

  const { corpus, stats } = normalizeCorpus(allRows);

  await mkdir(dirname(options.outPath), { recursive: true });
  // Stable 2-space formatting + trailing newline (LF via .gitattributes) — makes `git diff` the review mechanism (D-06 spirit).
  await writeFile(options.outPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

  return { corpus, stats };
}

export function formatNormalizeSummary(result: NormalizeCorpusCliResult): string {
  const { corpus, stats } = result;
  const excludedSettypes =
    stats.showsExcludedBySettype.map((show) => show.settype).join(", ") || "none";
  return (
    `Normalized ${corpus.showCount} shows, ${corpus.songCount} distinct songs, latest show ${corpus.latestShowDate}. ` +
    `Excluded ${stats.nonKglwRowsExcluded} non-KGLW rows and ${stats.showsExcludedBySettype.length} shows by settype (${excludedSettypes}).`
  );
}

function parseArgs(argv: string[]): NormalizeCorpusCliOptions {
  let inputDir: string = config.dataRawDir;
  let outPath: string = config.corpusArtifactPath;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") {
      inputDir = argv[++i];
    } else if (arg === "--out") {
      outPath = argv[++i];
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return { inputDir, outPath };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runNormalizeCorpus(options);
    console.log(formatNormalizeSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
