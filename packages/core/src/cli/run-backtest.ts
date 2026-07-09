/**
 * Thin CLI wrapper around the pure `runBacktest` function (D-12/D-13/D-14):
 * read the committed normalized corpus, run the leak-free walk-forward
 * backtest plus its leave-one-signal-out ablation sweep, and write both
 * `data/backtest.json` (machine-readable, diffable) and
 * `data/backtest-report.md` (the owner-readable trust report, D-15).
 * Mirrors `cli/run-census.ts`'s paired-report structure exactly. Performs
 * ZERO network requests -- reads only the already-committed corpus
 * artifact.
 *
 * `runBacktestCli` is exported directly (no shelling out between CLI
 * scripts, CLAUDE.md: all orchestration lives in Node).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import type { AblationEntry, BacktestResult, BacktestSplit, NormalizedCorpus } from "../domain/types.ts";
import { runBacktest } from "../eval/backtest.ts";

export interface RunBacktestCliOptions {
  /** Normalized corpus artifact to backtest against. Defaults to config.corpusArtifactPath. */
  corpusPath?: string;
  jsonOutPath?: string;
  reportOutPath?: string;
}

export interface RunBacktestCliResult {
  result: BacktestResult;
  report: string;
}

/**
 * Escape catalog-sourced prose (song names, model-generated reason strings)
 * before embedding it in the markdown report -- reused verbatim from
 * `cli/run-census.ts`'s `escapeMarkdownExcerpt` (threat T-01-03/F1,
 * re-flagged as T-02-10: markdown viewers such as GitHub or VS Code's
 * preview render embedded HTML by default, so this report is a rendering
 * surface even though it's a build artifact, not just plain text).
 */
function escapeMarkdownExcerpt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `n > 0` hit rate as a percentage string; `n === 0` renders as an em dash rather than a NaN/divide-by-zero artifact. */
function ratePct(n: number, k: number): string {
  return n > 0 ? `${((k / n) * 100).toFixed(1)}%` : "—";
}

function formatSplitRow(label: string, split: BacktestSplit): string {
  return `| ${escapeMarkdownExcerpt(label)} | ${split.n} | ${split.top1} (${ratePct(split.n, split.top1)}) | ${split.top5} (${ratePct(split.n, split.top5)}) | ${split.top10} (${ratePct(split.n, split.top10)}) |`;
}

function formatTopKTable(result: BacktestResult): string {
  const lines = [
    "| Split | n | Top-1 | Top-5 | Top-10 |",
    "|---|---|---|---|---|",
    formatSplitRow("Overall", result.overall),
    formatSplitRow("Hard segue", result.hardSegue),
    formatSplitRow("Free choice", result.freeChoice),
  ];
  return lines.join("\n");
}

/** Renders a `deltaVsFull` fraction (variant hit rate minus full-model hit rate) as signed percentage points -- 0 renders as a plain "0.0pp" rather than "+0.0pp"/"-0.0pp" so a true no-op ablation reads unambiguously. */
function formatDeltaPct(value: number): string {
  if (value === 0) return "0.0pp";
  const pct = (value * 100).toFixed(1);
  return `${value > 0 ? "+" : ""}${pct}pp`;
}

function formatAblationRow(entry: AblationEntry): string {
  return (
    `| ${escapeMarkdownExcerpt(entry.signal)} | ${entry.overall.n} | ` +
    `${entry.overall.top1} (${ratePct(entry.overall.n, entry.overall.top1)}) | ` +
    `${entry.overall.top5} (${ratePct(entry.overall.n, entry.overall.top5)}) | ` +
    `${entry.overall.top10} (${ratePct(entry.overall.n, entry.overall.top10)}) | ` +
    `${formatDeltaPct(entry.deltaVsFull.top1)} | ${formatDeltaPct(entry.deltaVsFull.top5)} | ${formatDeltaPct(entry.deltaVsFull.top10)} |`
  );
}

function formatAblationTable(ablation: AblationEntry[]): string {
  const lines = [
    "| Signal off | n | Top-1 | Top-5 | Top-10 | Δ Top-1 | Δ Top-5 | Δ Top-10 |",
    "|---|---|---|---|---|---|---|---|",
    ...ablation.map(formatAblationRow),
  ];
  return lines.join("\n");
}

/** D-15/D-14: builds the human-readable `.md` report, mirroring `run-census.ts`'s `sections: string[]` joined-with-blank-line + trailing-newline convention. */
export function formatBacktestReport(result: BacktestResult): string {
  const sections: string[] = [];

  sections.push(`# Backtest Report

Generated ${result.generatedAt} from the committed normalized corpus. Zero network requests were made to produce this report -- it is a pure derivation over the already-committed \`data/normalized/corpus.json\` artifact (D-15, mirrors \`census-report.md\`, D-10).

**Holdout:** ${escapeMarkdownExcerpt(result.holdoutTourName)} (tour ${result.holdoutTourId}), ${result.holdoutShowCount} show(s), ${result.evalTransitionCount} evaluated within-set transitions.

This is a leak-free walk-forward backtest (D-12): for each held-out show, the transition matrix is rebuilt with an exclusive as-of cutoff so the show's own transitions are never in its own training data, while the tour's earlier nights are.

This report is a non-negotiable trust gate before relying on the model live (CLAUDE.md Timeline constraint) -- the owner reads the numbers below and judges credibility. Ablation is report-only: there is no automated go/no-go gate in Phase 2 (D-14). Any signal whose ablation delta shows it does not earn its place is a candidate for deletion.`);

  sections.push(`## Top-k hit rates\n\n${formatTopKTable(result)}`);

  sections.push(
    `## Leave-one-signal-out ablation (D-14)\n\nEach row re-runs the identical walk-forward backtest with exactly one signal disabled (every other signal stays on), through the same scoring code path as the full model -- never a forked implementation. \`Δ\` columns are the signal-off hit rate minus the full model's overall hit rate, in percentage points: negative means the signal HELPS (removing it hurts accuracy); positive means the signal HURTS (removing it would improve accuracy); zero means the signal made no difference on this holdout tour.\n\n${formatAblationTable(result.ablation)}`,
  );

  return `${sections.join("\n\n")}\n`;
}

export async function runBacktestCli(options: RunBacktestCliOptions = {}): Promise<RunBacktestCliResult> {
  const corpusPath = options.corpusPath ?? config.corpusArtifactPath;
  const jsonOutPath = options.jsonOutPath ?? config.backtestJsonPath;
  const reportOutPath = options.reportOutPath ?? config.backtestReportPath;

  const corpus = JSON.parse(await readFile(corpusPath, "utf8")) as NormalizedCorpus;
  const result = runBacktest(corpus);
  const report = formatBacktestReport(result);

  // Stable 2-space formatting + trailing newline (Pitfall 2) -- makes
  // `git diff` the review mechanism and keeps data/backtest.json byte-stable
  // across reruns of the same committed corpus (result.generatedAt is
  // sourced from corpus.generatedAt, never wall-clock, in eval/backtest.ts).
  await mkdir(dirname(jsonOutPath), { recursive: true });
  await writeFile(jsonOutPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  await mkdir(dirname(reportOutPath), { recursive: true });
  await writeFile(reportOutPath, report, "utf8");

  // D-15: print the .md report to stdout in addition to writing it, so the
  // owner sees the trust-gate numbers immediately after running the CLI.
  console.log(report);

  return { result, report };
}

function parseArgs(argv: string[]): RunBacktestCliOptions {
  const options: RunBacktestCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      options.reportOutPath = argv[++i];
    } else if (arg === "--json-out") {
      options.jsonOutPath = argv[++i];
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
    const { result } = await runBacktestCli(options);
    console.error(
      `Backtest complete: holdout "${result.holdoutTourName}" (${result.holdoutShowCount} shows), ` +
        `${result.evalTransitionCount} eval transitions, overall top-1 ${result.overall.top1}/${result.overall.n}, ` +
        `${result.ablation.length} ablation variants.`,
    );
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
