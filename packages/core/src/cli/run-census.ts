/**
 * Thin CLI wrapper around the pure `runCensus` function: read every
 * `data/raw/setlists-*.json` file (default) or `--input <dir>`'s *.json
 * files, run the census, and write both `data/census.json` (machine-
 * readable) and `data/census-report.md` (the first-class owner-readable
 * deliverable, D-10). Performs ZERO network requests — reads only already-
 * committed raw data.
 *
 * `runCensusCli` is imported directly by `cli/refresh.ts --census-only` —
 * no shelling out between CLI scripts.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import { runCensus, type CensusFieldValue, type CensusResult } from "../ingest/census.ts";

export interface RunCensusCliOptions {
  /** Directory of raw *.json files to census. Defaults to config.dataRawDir. */
  inputDir?: string;
  /** Only census files matching this filename prefix (default: "setlists-", i.e. per-year files only — sibling tables like shows.json don't carry setlist rows). */
  filePrefix?: string;
  jsonOutPath?: string;
  reportOutPath?: string;
}

export interface RunCensusCliResult {
  census: CensusResult;
  filesRead: string[];
}

async function loadRowsByFile(inputDir: string, filePrefix: string): Promise<Map<string, unknown[]>> {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name.startsWith(filePrefix))
    .map((entry) => entry.name)
    .sort();

  if (fileNames.length === 0) {
    throw new Error(`No *.json files matching prefix "${filePrefix}" found in input directory: ${inputDir}`);
  }

  const rowsByFile = new Map<string, unknown[]>();
  for (const fileName of fileNames) {
    const raw = await readFile(join(inputDir, fileName), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const rows = Array.isArray(parsed)
      ? parsed
      : (parsed as { data?: unknown[] }).data;
    if (!Array.isArray(rows)) {
      throw new Error(`${fileName}: expected either a bare row array or an API envelope — got neither.`);
    }
    rowsByFile.set(fileName, rows);
  }
  return rowsByFile;
}

/**
 * Escape editor-entered prose (shownotes/footnote excerpts) before embedding it in the
 * markdown report. These fields are untrusted (SCHEMA.md §12) and have been observed
 * containing raw HTML (e.g. "<b>KGLW.net Staff Notes: </b>") — markdown viewers such as
 * GitHub or VS Code's preview render embedded HTML by default, so this report is a
 * rendering surface even though it's a build artifact, not just plain text (T-01-03/F1).
 */
function escapeMarkdownExcerpt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatFieldTable(values: CensusFieldValue[]): string {
  const lines = ["| Value | Row Count | Show Count | Example Shows |", "|---|---|---|---|"];
  for (const v of values) {
    const examples = v.exampleShows.map((s) => `${s.showId} (${s.showdate})`).join(", ") || "—";
    lines.push(`| ${v.value} | ${v.rowCount} | ${v.showCount} | ${examples} |`);
  }
  return lines.join("\n");
}

function formatReport(census: CensusResult, filesRead: string[]): string {
  const sections: string[] = [];

  sections.push(`# kglw.net Full-Corpus Census Report

Generated from ${filesRead.length} committed raw file(s): ${filesRead.join(", ")}. Zero network requests were made to produce this report — it is a pure derivation over already-fetched data/raw/ files (D-10).

## What this resolves

This report answers docs/SCHEMA.md §13's Open Unknowns with full-corpus evidence:

- **(a) Does \`setnumber: "3"\` exist?** See the "setnumber" field table below.
- **(b) Full-corpus \`transition_id\` 4/5/6 distribution and reliability across eras.** See the "transition_id" field table and the "Last-row transition_id distribution by year" derived section.
- **(c) Tease notation location/conventions.** See the "Tease-notation candidates" derived section.
- **(d) Full \`settype\` variant list across 15 years.** See the "settype" field table below.
- **(e) Footnotes rows that fail JSON.parse.** See the "Footnote parse failures" derived section.
`);

  for (const [field, values] of Object.entries(census.fields)) {
    sections.push(`## Field: \`${field}\`\n\n${formatFieldTable(values)}`);
  }

  sections.push("## Derived: last-row transition_id distribution by year (terminal reliability by era)");
  const lastRowLines = ["| Year | transition_id | Show Count |", "|---|---|---|"];
  for (const [year, byTid] of Object.entries(census.derived.lastRowTransitionByYear).sort()) {
    for (const [tid, count] of Object.entries(byTid).sort()) {
      lastRowLines.push(`| ${year} | ${tid} | ${count} |`);
    }
  }
  sections.push(lastRowLines.join("\n"));

  sections.push("## Derived: per-year segue frequency (transition_id 2 or 3 as % of rows)");
  const segueLines = ["| Year | Segue Rows | Total Rows | Frequency |", "|---|---|---|---|"];
  for (const [year, entry] of Object.entries(census.derived.segueFrequencyByYear).sort()) {
    segueLines.push(
      `| ${year} | ${entry.segueRows} | ${entry.totalRows} | ${(entry.frequency * 100).toFixed(1)}% |`,
    );
  }
  sections.push(segueLines.join("\n"));

  sections.push(
    `## Derived: footnote parse failures\n\n${
      census.derived.footnoteParseFailures.length === 0
        ? "None — every non-null \`footnotes\` value parsed cleanly."
        : census.derived.footnoteParseFailures
            .map((f) => `- Show ${f.showId} (${f.showdate}): \`${f.raw}\``)
            .join("\n")
    }`,
  );

  sections.push(
    `## Derived: contiguity violations (non-contiguous position sequences — expect none)\n\n${
      census.derived.contiguityViolations.length === 0
        ? "None — every show's positions are contiguous 1..N."
        : census.derived.contiguityViolations
            .map(
              (v) =>
                `- Show ${v.showId} (${v.showdate}): expected position ${v.expectedPosition}, found ${v.foundPosition}`,
            )
            .join("\n")
    }`,
  );

  sections.push("## Derived: side-project row counts by year (visible, excluded from KGLW stats)");
  const sideProjectLines = ["| Year | Non-KGLW Row Count |", "|---|---|"];
  for (const [year, count] of Object.entries(census.derived.sideProjectRowsByYear).sort()) {
    sideProjectLines.push(`| ${year} | ${count} |`);
  }
  sections.push(
    sideProjectLines.length > 2 ? sideProjectLines.join("\n") : "No side-project rows observed in the committed raw corpus.",
  );

  sections.push("## Derived: shows per year (KGLW only)");
  const showsPerYearLines = ["| Year | Show Count |", "|---|---|"];
  for (const [year, count] of Object.entries(census.derived.showsPerYear).sort()) {
    showsPerYearLines.push(`| ${year} | ${count} |`);
  }
  sections.push(showsPerYearLines.join("\n"));

  sections.push(
    `## Derived: corpus totals\n\n` +
      `- Distinct KGLW songs (excluding the Unknown sentinel): ${census.derived.distinctKglwSongCount}\n` +
      `- Covers count (isoriginal: 0, excluding the Unknown sentinel): ${census.derived.coversCount}`,
  );

  sections.push(
    `## Derived: tease-notation candidates (footnote/shownotes matching /tease/i)\n\n` +
      `**Caveat:** a large share of these hits (see the excerpts below) come from a generic ` +
      `KGLW.net staff disclaimer boilerplate — "...any additional setlist notations that require ` +
      `audio confirmation (segues, quotes or teases) may be incomplete." — rather than a genuine ` +
      `tease call-out. This is exactly the kind of unstructured-prose ambiguity docs/SCHEMA.md §13c ` +
      `flags: there is no dedicated tease field/row type, so manual review of the excerpts remains ` +
      `necessary before treating any of these as confirmed tease evidence.\n\n${
        census.derived.teaseCandidates.length === 0
          ? "None found."
          : census.derived.teaseCandidates
              .slice(0, 50)
              .map((t) => `- Show ${t.showId} (${t.showdate}), \`${t.field}\`: "${escapeMarkdownExcerpt(t.excerpt)}"`)
              .join("\n") +
            (census.derived.teaseCandidates.length > 50
              ? `\n\n...and ${census.derived.teaseCandidates.length - 50} more (see census.json for the full list).`
              : "")
      }`,
  );

  return `${sections.join("\n\n")}\n`;
}

export async function runCensusCli(options: RunCensusCliOptions = {}): Promise<RunCensusCliResult> {
  const inputDir = options.inputDir ?? config.dataRawDir;
  const filePrefix = options.filePrefix ?? "setlists-";
  const jsonOutPath = options.jsonOutPath ?? config.censusJsonPath;
  const reportOutPath = options.reportOutPath ?? config.censusReportPath;

  const rowsByFile = await loadRowsByFile(inputDir, filePrefix);
  const filesRead = [...rowsByFile.keys()];
  const census = runCensus(rowsByFile);

  await mkdir(dirname(jsonOutPath), { recursive: true });
  await writeFile(jsonOutPath, `${JSON.stringify(census, null, 2)}\n`, "utf8");

  await mkdir(dirname(reportOutPath), { recursive: true });
  await writeFile(reportOutPath, formatReport(census, filesRead), "utf8");

  return { census, filesRead };
}

function parseArgs(argv: string[]): RunCensusCliOptions {
  let inputDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") inputDir = argv[++i];
    else throw new Error(`Unknown flag: ${argv[i]}`);
  }
  return { inputDir };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { census, filesRead } = await runCensusCli(options);
    console.log(
      `Census complete over ${filesRead.length} file(s). ${Object.keys(census.fields).length} fields censused, ` +
        `${census.derived.distinctKglwSongCount} distinct KGLW songs, ${census.derived.contiguityViolations.length} contiguity violations.`,
    );
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
