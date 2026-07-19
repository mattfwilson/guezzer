/**
 * Read-only VALID-01 tuning-family review CLI (DATA-04, D-01/D-02/D-03).
 *
 * Purpose: prove the tuning-family tags are musically sane before show #1
 * WITHOUT blindly regenerating them. This CLI (a) cross-checks ~10 canonical
 * well-known songs (expected vs actual `family`) and (b) surfaces the two
 * families the album-default logic can NEVER assign — `cs-standard` (down-tuned
 * era) and `other` (covers) — plus the hand-tagged owner-knowledge overrides
 * worth re-confirming (those that diverge from their album default AND those
 * with no studio-album default to compare against).
 *
 * READ-ONLY (D-01): this CLI NEVER writes data/tuning-tags.json. It reuses the
 * pure, read-only helpers `deriveCatalogFromCorpus`, `findMatchedAlbumTitles`,
 * and `defaultFamilyForAlbum` from ../ingest/tuning-tags.ts — it never imports
 * the write path (`mergeTuningTags` / `generateTuningTags`). The only file it
 * may write is the optional `--out` review report.
 *
 * Never invoked from CI or a build step (CLAUDE.md: manual-run only, D-05
 * spirit) — a manual owner-run review action alongside cli/generate-tuning-tags.ts.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { config } from "../config.ts";
import type { NormalizedCorpus } from "../domain/types.ts";
import {
  albumRowSchema,
  defaultFamilyForAlbum,
  deriveCatalogFromCorpus,
  findMatchedAlbumTitles,
  tuningTagsFileSchema,
  type AlbumRow,
  type CatalogSong,
  type TuningFamily,
  type TuningTagEntry,
} from "../ingest/tuning-tags.ts";

/**
 * Canonical, well-known songs with an owner-obvious expected tuning family
 * (Phase 01 anchors + album-anchored classics). microtonal = Flying
 * Microtonal Banana / K.G. / L.W. material; everything else standard. >=10
 * entries so the owner always sees a substantive spot-check table (VALID-01).
 */
const CANONICAL_SPOT_CHECKS: { name: string; expected: TuningFamily }[] = [
  // Standard-tuned classics (debut, Nonagon Infinity, Polygondwanaland,
  // Omnium Gatherum, I'm In Your Mind Fuzz — all standard-tuned records).
  { name: "12 Bar Bruise", expected: "standard" },
  { name: "Robot Stop", expected: "standard" },
  { name: "Gamma Knife", expected: "standard" },
  { name: "Crumbling Castle", expected: "standard" },
  { name: "The Dripping Tap", expected: "standard" },
  { name: "Hot Water", expected: "standard" },
  // Microtonal-tuned material (Flying Microtonal Banana / K.G. / L.W. — the
  // three quarter-tone-guitar records).
  { name: "Doom City", expected: "microtonal" },
  { name: "Rattlesnake", expected: "microtonal" },
  { name: "Nuclear Fusion", expected: "microtonal" },
  { name: "Sleep Drifter", expected: "microtonal" },
  { name: "Straws in the Wind", expected: "microtonal" },
  { name: "Minimum Brain Size", expected: "microtonal" },
];

/**
 * Down-tuned-era studio albums whose songs the album-default logic can only
 * ever mark "standard" — but which are musically `cs-standard` (owner
 * knowledge, never auto-assigned per D-03). Seeded from the verified
 * albums.json `album_title` for Infest the Rats' Nest.
 */
const DOWN_TUNED_ALBUM_HINT: string[] = ["Infest the Rats' Nest"];

const REASON_CS_STANDARD = "down-tuned era album — album-default cannot assign cs-standard";
const REASON_OTHER = "cover — original-artist tuning is owner knowledge";
const REASON_DIVERGENCE =
  "hand-tagged override diverges from album default — already reviewed, confirm still intended";
const REASON_NO_DEFAULT = "hand-tagged, no album default to compare against — confirm still intended";

export interface SpotCheck {
  songId: number | null;
  name: string;
  expected: TuningFamily;
  actual: TuningFamily | "MISSING";
  ok: boolean;
}

export interface Anomaly {
  songId: number;
  name: string;
  actual: TuningFamily;
  reason: string;
}

export interface ReviewSummary {
  total: number;
  standard: number;
  microtonal: number;
  csStandard: number;
  other: number;
  handTagged: number;
}

export interface ReviewTuningTagsCliResult {
  spotChecks: SpotCheck[];
  anomalies: Anomaly[];
  summary: ReviewSummary;
}

export interface ReviewTuningTagsCliOptions {
  corpusPath: string;
  albumsPath: string;
  tagsPath: string;
  /** Optional review-report output path (--out). When omitted the CLI prints to stdout only and writes nothing. */
  outPath?: string;
}

/**
 * Pure derivation core (unit-tested directly): catalog + KGLW studio album
 * rows + the parsed tuning-tags entries -> the canonical spot-check table and
 * the anomaly sweep. Reads nothing, writes nothing.
 */
export function deriveReview(
  catalog: readonly CatalogSong[],
  kglwAlbumRows: readonly AlbumRow[],
  tags: readonly TuningTagEntry[],
): ReviewTuningTagsCliResult {
  const familyBySongId = new Map<number, TuningFamily>();
  const sourceBySongId = new Map<number, TuningTagEntry["source"]>();
  const needsReviewBySongId = new Map<number, boolean>();
  const nameBySongId = new Map<number, string>();
  for (const entry of tags) {
    familyBySongId.set(entry.songId, entry.family);
    sourceBySongId.set(entry.songId, entry.source);
    needsReviewBySongId.set(entry.songId, entry.needsReview);
    nameBySongId.set(entry.songId, entry.name);
  }

  // (1) SPOT CHECKS — match each canonical name case-insensitively against the
  // catalog; a name absent from the catalog is surfaced as MISSING (never a
  // silent skip) so the owner sees the gap.
  const catalogByNameLower = new Map<string, CatalogSong>();
  for (const song of catalog) {
    const key = song.name.toLowerCase();
    if (!catalogByNameLower.has(key)) catalogByNameLower.set(key, song);
  }
  const spotChecks: SpotCheck[] = CANONICAL_SPOT_CHECKS.map(({ name, expected }) => {
    const song = catalogByNameLower.get(name.toLowerCase());
    const actual = song ? familyBySongId.get(song.songId) : undefined;
    if (!song || actual === undefined) {
      return { songId: song?.songId ?? null, name, expected, actual: "MISSING", ok: false };
    }
    return { songId: song.songId, name, expected, actual, ok: expected === actual };
  });

  // (2) ANOMALY SWEEP (D-02) — the two families the album-default logic can
  // never assign, plus owner-overrides worth re-confirming.
  const anomalies: Anomaly[] = [];
  for (const song of catalog) {
    const family = familyBySongId.get(song.songId);
    if (family === undefined) continue;
    const source = sourceBySongId.get(song.songId);
    const matchedTitles = findMatchedAlbumTitles(song, kglwAlbumRows);
    const base = { songId: song.songId, name: song.name, actual: family };

    if (source === "album-default") {
      // (a) CS-STANDARD CANDIDATES — down-tuned-era album songs the
      // album-default logic could only mark "standard".
      if (matchedTitles.some((title) => DOWN_TUNED_ALBUM_HINT.includes(title))) {
        anomalies.push({ ...base, reason: REASON_CS_STANDARD });
      }
      // (b) OTHER CANDIDATES — covers still carrying an auto album-default
      // family; original-artist tuning is owner knowledge.
      if (song.isCover) {
        anomalies.push({ ...base, reason: REASON_OTHER });
      }
      continue;
    }

    if (source === "hand-tagged") {
      const albumDefaults = matchedTitles.map(defaultFamilyForAlbum);
      // (c-ii) NO ALBUM DEFAULT TO COMPARE — no matched studio album, or
      // flagged needsReview. These are the owner-knowledge edits the
      // auto-logic can never check — the owner must re-eyeball them directly.
      if (matchedTitles.length === 0 || needsReviewBySongId.get(song.songId) === true) {
        anomalies.push({ ...base, reason: REASON_NO_DEFAULT });
      } else if (!albumDefaults.some((def) => def === family)) {
        // (c-i) DIVERGENCE — has a matched studio album but the hand-tagged
        // family equals none of its album-default values.
        anomalies.push({ ...base, reason: REASON_DIVERGENCE });
      }
      // else: family matches a present album default -> nothing to re-confirm.
    }
  }

  // Summary counts over the full tag set.
  let standard = 0;
  let microtonal = 0;
  let csStandard = 0;
  let other = 0;
  let handTagged = 0;
  for (const entry of tags) {
    if (entry.family === "standard") standard++;
    else if (entry.family === "microtonal") microtonal++;
    else if (entry.family === "cs-standard") csStandard++;
    else if (entry.family === "other") other++;
    if (entry.source === "hand-tagged") handTagged++;
  }

  return {
    spotChecks,
    anomalies,
    summary: { total: tags.length, standard, microtonal, csStandard, other, handTagged },
  };
}

export interface RunReviewOptions extends Partial<ReviewTuningTagsCliOptions> {}

/** Accepts either a bare row array or a `{ data: [...] }` envelope — mirrors generate-tuning-tags.ts / normalize-corpus.ts. */
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

function defaultOptions(): Pick<ReviewTuningTagsCliOptions, "corpusPath" | "albumsPath" | "tagsPath"> {
  return {
    corpusPath: config.corpusArtifactPath,
    albumsPath: join(config.dataRawDir, "albums.json"),
    tagsPath: config.tuningTagsPath,
  };
}

/**
 * File-loading wrapper: read the committed corpus + albums.json + the
 * zod-validated tuning-tags.json, then run the pure `deriveReview`. Never
 * writes tuning-tags.json. If `outPath` is set, writes the review report there.
 */
export async function runReviewTuningTags(
  options: RunReviewOptions = {},
): Promise<ReviewTuningTagsCliResult> {
  const opts = { ...defaultOptions(), ...options };

  const corpusRaw = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;

  const albumsParsed: unknown = JSON.parse(await readFile(opts.albumsPath, "utf8"));
  const allAlbumRows: AlbumRow[] = z
    .array(albumRowSchema)
    .parse(extractRows(albumsParsed, opts.albumsPath));
  // T-01-13 mitigation: only artist_id === 1 (KGLW) rows ever contribute a
  // family default — the exact filter the write path uses.
  const kglwAlbumRows = allAlbumRows.filter((row) => row.artist_id === 1);

  // T-01-14/T-10-02 mitigation: a corrupt hand-edit hard-fails loudly here.
  const tagsRaw = await readFile(opts.tagsPath, "utf8");
  const tagsFile = tuningTagsFileSchema.parse(JSON.parse(tagsRaw));

  const catalog = deriveCatalogFromCorpus(corpusRaw);
  const result = deriveReview(catalog, kglwAlbumRows, tagsFile.entries);

  if (opts.outPath !== undefined) {
    const report = formatReviewReport(result);
    await mkdir(dirname(opts.outPath), { recursive: true });
    await writeFile(opts.outPath, report, "utf8");
  }

  return result;
}

/**
 * Escape catalog-sourced prose (song names) before embedding it in the
 * markdown report — T-10-01: markdown viewers (GitHub, VS Code preview)
 * render embedded HTML. Copied verbatim from run-backtest.ts / run-census.ts.
 */
function escapeMarkdownExcerpt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One-line stdout summary: totals, family counts, spot-check pass/fail, anomaly count. */
export function formatReviewSummary(result: ReviewTuningTagsCliResult): string {
  const { summary } = result;
  const pass = result.spotChecks.filter((s) => s.ok).length;
  const fail = result.spotChecks.length - pass;
  return (
    `tuning-review: ${summary.total} total ` +
    `(${summary.standard} standard, ${summary.microtonal} microtonal, ` +
    `${summary.csStandard} cs-standard, ${summary.other} other, ${summary.handTagged} hand-tagged), ` +
    `spot-check ${pass} pass / ${fail} fail, ${result.anomalies.length} anomaly candidate(s).`
  );
}

function anomaliesByReason(anomalies: readonly Anomaly[], reason: string): Anomaly[] {
  return anomalies.filter((a) => a.reason === reason);
}

function anomalyRows(anomalies: readonly Anomaly[]): string {
  return anomalies
    .map((a) => `| ${a.songId} | ${escapeMarkdownExcerpt(a.name)} | ${a.actual} |`)
    .join("\n");
}

function anomalySubSection(heading: string, anomalies: readonly Anomaly[]): string {
  if (anomalies.length === 0) {
    return `### ${heading}\n\n_None — nothing to re-confirm (a valid pass)._`;
  }
  return [
    `### ${heading}`,
    "",
    "| songId | name | current family |",
    "|---|---|---|",
    anomalyRows(anomalies),
  ].join("\n");
}

/** Owner-readable markdown report: `sections: string[]` joined with a blank line + trailing newline (mirrors run-backtest.ts). */
export function formatReviewReport(result: ReviewTuningTagsCliResult): string {
  const sections: string[] = [];

  sections.push(
    `# Tuning-Family Review (VALID-01)\n\n${formatReviewSummary(result)}\n\nRead-only review (DATA-04, D-01/D-02/D-03) — this report is generated by \`node packages/core/src/cli/review-tuning-tags.ts\` and NEVER mutates \`data/tuning-tags.json\`. Confirm the canonical spot-check rows are musically sensible, then eyeball the anomaly candidates.`,
  );

  const spotRows = result.spotChecks
    .map(
      (s) =>
        `| ${escapeMarkdownExcerpt(s.name)} | ${s.expected} | ${s.actual} | ${s.ok ? "✅" : "⚠️"} |`,
    )
    .join("\n");
  sections.push(
    [
      "## Canonical spot-check",
      "",
      "| song | expected | actual | ok |",
      "|---|---|---|---|",
      spotRows,
    ].join("\n"),
  );

  const csStandard = anomaliesByReason(result.anomalies, REASON_CS_STANDARD);
  const other = anomaliesByReason(result.anomalies, REASON_OTHER);
  const divergence = anomaliesByReason(result.anomalies, REASON_DIVERGENCE);
  const noDefault = anomaliesByReason(result.anomalies, REASON_NO_DEFAULT);

  sections.push(
    [
      "## Anomaly sweep",
      "",
      "The album-default logic can only ever emit `standard`/`microtonal`. These are the candidates only owner musical judgment can settle. An empty sub-section is a valid _nothing-to-re-confirm_ pass, not a bug.",
      "",
      anomalySubSection(
        "cs-standard candidates (down-tuned era — album-default cannot assign)",
        csStandard,
      ),
      "",
      anomalySubSection("other candidates (covers — original-artist tuning is owner knowledge)", other),
      "",
      anomalySubSection(
        "hand-tagged overrides that diverge from their album default — confirm still intended",
        divergence,
      ),
      "",
      anomalySubSection(
        "hand-tagged, no album default to compare against — confirm still intended",
        noDefault,
      ),
    ].join("\n"),
  );

  return `${sections.join("\n\n")}\n`;
}

function parseArgs(argv: string[]): RunReviewOptions {
  const options: RunReviewOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      options.outPath = argv[++i];
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
    const result = await runReviewTuningTags(options);
    console.log(formatReviewSummary(result));
    console.log(formatReviewReport(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
