/**
 * Gizz-Bingo calibration gate CLI (D-19) — the Bingo equivalent of the Phase-2
 * backtest trust gate. Models `cli/run-backtest.ts` nearly cell-for-cell: pure
 * exported engine fns + a thin `isMain` wrapper that reads the committed
 * artifacts, prints the human-trust report, and `process.exit(1)`s on any
 * D-02/D-03/D-05 violation. Performs ZERO network requests — reads only the
 * already-committed corpus/matrix/archive/dex-albums JSON.
 *
 * The Monte-Carlo sim IS production marking: it imports and calls the SAME
 * `deriveMarks`/`deal`/`detectWins`/`buildBingoContext` the app uses, never a
 * forked reimplementation (Pitfall 3 / T-14-12). Output JSON is byte-stable —
 * `generatedAt` comes from `corpus.generatedAt` (never wall-clock), every Map
 * iteration is stable-key sorted (Pitfall 4 / T-14-14).
 *
 * This plan (05) builds the machinery; Plan 06 RUNS the D-20 roster checkpoint
 * and locks the `config.bingo` constants against a green gate.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
import { buildBingoContext, type BingoContext } from "../bingo/context.ts";
import { deal } from "../bingo/generate.ts";
import { deriveMarks, type MarkTrailEntry } from "../bingo/mark.ts";
import { detectWins } from "../bingo/wins.ts";
import { mulberry32, xmur3 } from "../bingo/prng.ts";
import { bingoVibeValues, type BingoVibe } from "../bingo/types.ts";
import { buildRarityIndex } from "../dex/rarity.ts";
import type { ArchiveArtifact, DexAlbumsArtifact } from "../dex/archive-types.ts";
import type { NormalizedCorpus, NormalizedShow } from "../domain/types.ts";

/**
 * P(line) tolerance around each vibe's target band. Kept a CLI-internal gate
 * constant (config.bingo owns the point targets; Plan 06 may promote this to
 * config when the constants are locked). ±0.05 is wide enough to swallow
 * Monte-Carlo noise (<~0.3pp at N=500) yet tight enough to catch a mis-mix.
 */
const LINE_TARGET_TOLERANCE = 0.05;

/** D-17 album-square thresholds: a "set" album fires in ≥53% of shows; a lower-fire album still clears ≥20%. */
const ALBUM_SET_FIRE_RATE = 0.53;
const ALBUM_MIN_FIRE_RATE = 0.2;

/** Seeded by name-substring (owner knowledge, not derivable) → resolved to songIds in `--candidates` mode. */
const JAM_VEHICLE_NAME_HINTS: readonly string[] = [
  "Head On/Pill",
  "Float Along",
  "Crumbling Castle",
  "The River",
  "Am I in Heaven?",
  "Robot Stop",
  "Rattlesnake",
  "Hypertension",
  "Magma",
  "Sea of Trees",
];

/** Recent-era cutoff: the calibration fold replays shows from this year onward (241 shows). */
const RECENT_ERA_MIN_YEAR = 2022;

// ── Public engine types ──────────────────────────────────────────────────────

/** One recent-era show reduced to what the sim reads: a play-ordered trail + its song set (for dex/fire-rate). */
export interface CalibrationShow {
  readonly showId: number;
  /** Distinct non-placeholder song ids played (for the mid-collection dex + corpus fire-rates). */
  readonly songIds: readonly number[];
  /** The 0-based play-ordered trail the marking fold consumes (opener = position 0). */
  readonly trail: readonly MarkTrailEntry[];
}

/** median/mean/min/max of a vibe's per-(card,show) mark counts. */
export interface ExpectedMarks {
  readonly median: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

/** Per reliable square TYPE (opener/microtonal/marathonJam/album): how often it fired across trials. */
export interface ReliableSquareStat {
  readonly type: string;
  /** (card,show) trials where the card carried ≥1 square of this type. */
  readonly trials: number;
  /** Trials where ≥1 such square was marked. */
  readonly fires: number;
  /** fires / trials (0 when trials === 0). */
  readonly fireRate: number;
  /** 1 − fireRate (the D-05 dark-square share). */
  readonly darkShare: number;
}

/** The aggregate for one vibe under one dex assumption. */
export interface VibeCalibration {
  readonly vibe: BingoVibe;
  readonly cards: number;
  readonly shows: number;
  readonly trials: number;
  readonly pLine: number;
  readonly pBlackout: number;
  readonly pCorners: number;
  readonly pX: number;
  readonly expectedMarks: ExpectedMarks;
  /** Sorted by type (stable output). */
  readonly reliableSquares: ReliableSquareStat[];
}

/** empty = first-show edge (reported, NOT gated); mid-collection = the representative gated run. */
export type DexAssumption = "empty" | "mid-collection";

export interface DexAssumptionResult {
  readonly assumption: DexAssumption;
  readonly gated: boolean;
  /** In fixed [chill, balanced, glory] order. */
  readonly vibes: VibeCalibration[];
}

/** The full byte-stable calibration artifact. */
export interface CalibrationResult {
  /** From `corpus.generatedAt`, never wall-clock (Pitfall 4). */
  readonly generatedAt: string;
  readonly corpusVersion: string;
  readonly showCount: number;
  readonly simCardsPerVibe: number;
  /** In fixed [empty, mid-collection] order. */
  readonly assumptions: DexAssumptionResult[];
}

export interface RunCalibrationOptions {
  /** The mid-collection caught snapshot (D-13). Built deterministically from `shows` when omitted. */
  readonly dexModel?: ReadonlySet<number>;
  /** Overrides `cfg.bingo.simCardsPerVibe` (tests inject a small N). */
  readonly cardsPerVibe?: number;
  /** Byte-stable report timestamp; from `corpus.generatedAt` in the CLI. */
  readonly generatedAt?: string;
  /** Scopes the seeded deal determinism to a corpus snapshot. */
  readonly corpusVersion?: string;
}

// ── Roster-candidate types (`--candidates` mode) ─────────────────────────────

export interface AlbumCandidate {
  readonly albumUrl: string;
  readonly memberCount: number;
  readonly fireRate: number;
  readonly tier: "set" | "lower-fire";
}

export interface JamVehicleCandidate {
  readonly songId: number;
  readonly name: string;
  readonly fireRate: number;
}

export interface RosterCandidates {
  readonly generatedAt: string;
  readonly showCount: number;
  readonly albumCandidates: AlbumCandidate[];
  readonly jamVehicleCandidates: JamVehicleCandidate[];
}

export interface RosterCandidatesOptions {
  /** songId → display name (from the matrix nodes in the CLI). Missing names skip a jam-vehicle hint match. */
  readonly songNames?: ReadonlyMap<number, string>;
  readonly generatedAt?: string;
}

// ── Report escaping (T-14-11) ────────────────────────────────────────────────

/**
 * Escape catalog-sourced prose (song / album names) before embedding it in the
 * markdown report — reused verbatim from `run-backtest.ts` (T-14-11: markdown
 * viewers such as GitHub or VS Code preview render embedded HTML by default).
 */
function escapeMarkdownExcerpt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Aggregation engine ───────────────────────────────────────────────────────

/** A number → fixed-precision percent string; guards the trials === 0 divide. */
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** median/mean/min/max over a non-empty numeric array (returns zeros for empty). */
function summarize(values: number[]): ExpectedMarks {
  if (values.length === 0) return { median: 0, mean: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { median, mean, min: sorted[0], max: sorted[sorted.length - 1] };
}

/**
 * Classify a card's squares into reliable TYPES → the board indices carrying
 * them. Reliable = album squares + the `cfg.bingo.reliableEvents` (opener /
 * microtonal / marathonJam). Glory events (bustOut / neverCaught) are EXEMPT
 * from the floor (D-15) and deliberately excluded here.
 */
function reliableTypesOf(
  squares: ReadonlyArray<{ kind: string; event?: string }>,
  cfg: typeof config,
): Map<string, number[]> {
  const reliableEvents = new Set<string>(cfg.bingo.reliableEvents);
  const byType = new Map<string, number[]>();
  squares.forEach((def, index) => {
    let type: string | null = null;
    if (def.kind === "album") type = "album";
    else if (def.kind === "event" && def.event !== undefined && reliableEvents.has(def.event)) {
      type = def.event;
    }
    if (type === null) return;
    const list = byType.get(type);
    if (list) list.push(index);
    else byType.set(type, [index]);
  });
  return byType;
}

/** Run the sim for a single vibe under one caught snapshot. */
function calibrateVibe(
  vibe: BingoVibe,
  ctx: BingoContext,
  shows: readonly CalibrationShow[],
  caughtSnapshot: ReadonlySet<number>,
  cardsPerVibe: number,
  corpusVersion: string,
  cfg: typeof config,
): VibeCalibration {
  const cards = Array.from({ length: cardsPerVibe }, (_unused, i) =>
    deal(`sim-${vibe}-${i}`, vibe, ctx, caughtSnapshot, corpusVersion, cfg),
  );
  const cardReliable = cards.map((card) => reliableTypesOf(card.squares, cfg));

  let lineCount = 0;
  let blackoutCount = 0;
  let cornersCount = 0;
  let xCount = 0;
  const markCounts: number[] = [];
  const relAgg = new Map<string, { trials: number; fires: number }>();

  for (let ci = 0; ci < cards.length; ci++) {
    const card = cards[ci];
    const reliable = cardReliable[ci];
    for (const show of shows) {
      const marked = deriveMarks(card, show.trail, ctx, caughtSnapshot, cfg);
      const wins = detectWins(marked);
      if (wins.some((w) => w.kind === "line")) lineCount++;
      if (wins.some((w) => w.kind === "blackout")) blackoutCount++;
      if (wins.some((w) => w.kind === "corners")) cornersCount++;
      if (wins.some((w) => w.kind === "x")) xCount++;
      markCounts.push(marked.markedCount);

      for (const [type, indices] of reliable) {
        let agg = relAgg.get(type);
        if (!agg) {
          agg = { trials: 0, fires: 0 };
          relAgg.set(type, agg);
        }
        agg.trials++;
        if (indices.some((idx) => marked.squares[idx].markedByPosition !== null)) agg.fires++;
      }
    }
  }

  const trials = cards.length * shows.length;
  const denom = trials === 0 ? 1 : trials;
  const reliableSquares: ReliableSquareStat[] = [...relAgg.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([type, agg]) => {
      const fireRate = agg.trials === 0 ? 0 : agg.fires / agg.trials;
      return { type, trials: agg.trials, fires: agg.fires, fireRate, darkShare: 1 - fireRate };
    });

  return {
    vibe,
    cards: cards.length,
    shows: shows.length,
    trials,
    pLine: lineCount / denom,
    pBlackout: blackoutCount / denom,
    pCorners: cornersCount / denom,
    pX: xCount / denom,
    expectedMarks: summarize(markCounts),
    reliableSquares,
  };
}

/**
 * Deterministic mid-collection dex: caught = union of the song sets of a seeded
 * ~50% subset of the shows (D-13 — treats a partial collection as the
 * representative gated case). Seeded so the snapshot is byte-stable across runs.
 */
function buildMidCollectionDex(shows: readonly CalibrationShow[]): Set<number> {
  const rand = mulberry32(xmur3("bingo-mid-collection-dex")());
  const caught = new Set<number>();
  for (const show of shows) {
    if (rand() < 0.5) for (const songId of show.songIds) caught.add(songId);
  }
  return caught;
}

/**
 * `runBingoCalibration(ctx, shows, cfg, opts)` — the real-fold Monte-Carlo core
 * (RESEARCH §"Monte-Carlo calibration methodology"). For BOTH dex assumptions
 * (empty first-show edge → reported not gated; mid-collection → gated), for each
 * vibe, deals `cardsPerVibe` deterministic cards (`sim-${vibe}-${i}`) and
 * replays every show through the REAL `deriveMarks` + `detectWins`, aggregating
 * P(line)/P(blackout)/P(corners)/P(X), expected marks, and per-reliable-type
 * dark share. Pure: no I/O, no wall-clock.
 */
export function runBingoCalibration(
  ctx: BingoContext,
  shows: readonly CalibrationShow[],
  cfg: typeof config = config,
  opts: RunCalibrationOptions = {},
): CalibrationResult {
  const cardsPerVibe = opts.cardsPerVibe ?? cfg.bingo.simCardsPerVibe;
  const corpusVersion = opts.corpusVersion ?? "unknown";
  const midDex = opts.dexModel ?? buildMidCollectionDex(shows);
  const emptyDex: ReadonlySet<number> = new Set<number>();

  const runAssumption = (
    assumption: DexAssumption,
    caughtSnapshot: ReadonlySet<number>,
    gated: boolean,
  ): DexAssumptionResult => ({
    assumption,
    gated,
    vibes: bingoVibeValues.map((vibe) =>
      calibrateVibe(vibe, ctx, shows, caughtSnapshot, cardsPerVibe, corpusVersion, cfg),
    ),
  });

  return {
    generatedAt: opts.generatedAt ?? "unknown",
    corpusVersion,
    showCount: shows.length,
    simCardsPerVibe: cardsPerVibe,
    assumptions: [
      runAssumption("empty", emptyDex, false),
      runAssumption("mid-collection", midDex, true),
    ],
  };
}

// ── The hard-assert gate (D-19b) ─────────────────────────────────────────────

/** The per-vibe blackout band: chill is upper-bound-only; balanced/glory pin [min,max]. */
function blackoutBand(vibe: BingoVibe, cfg: typeof config): { min: number | null; max: number } {
  switch (vibe) {
    case "chill":
      return { min: null, max: cfg.bingo.vibes.chill.blackoutMax };
    case "balanced": {
      const [lo, hi] = cfg.bingo.vibes.balanced.blackout;
      return { min: lo, max: hi };
    }
    case "glory": {
      const [lo, hi] = cfg.bingo.vibes.glory.blackout;
      return { min: lo, max: hi };
    }
  }
}

/**
 * `assertCalibrationInvariants(result, cfg)` — the D-02/D-03/D-05 gate over the
 * GATED (mid-collection) assumption only. Returns a list of human-readable
 * failure strings (empty ⇒ green). Checks: every reliable event/album square's
 * fire-rate ≥ `cfg.bingo.darkSquareFloor` (bustOut/neverCaught EXEMPT, D-15); no
 * reliable square with dark-share == 1.0; per-vibe P(line) within target ±
 * tolerance (D-02); per-vibe P(blackout) inside its band (D-03).
 */
export function assertCalibrationInvariants(
  result: CalibrationResult,
  cfg: typeof config = config,
): string[] {
  const failures: string[] = [];
  const gated = result.assumptions.find((a) => a.gated);
  if (!gated) {
    failures.push("No gated (mid-collection) assumption present in the calibration result.");
    return failures;
  }

  for (const vibe of gated.vibes) {
    // D-05: reliable-square fire floor + the explicit never-fired check.
    for (const rel of vibe.reliableSquares) {
      if (rel.trials === 0) continue; // type not represented on any card
      if (rel.darkShare >= 1) {
        failures.push(
          `[${vibe.vibe}] reliable square "${rel.type}" has dark-share 1.0 — it NEVER fired across ${rel.trials} trials.`,
        );
      }
      if (rel.fireRate < cfg.bingo.darkSquareFloor) {
        failures.push(
          `[${vibe.vibe}] reliable square "${rel.type}" fire-rate ${pct(rel.fireRate)} is below the dark-square floor ${pct(
            cfg.bingo.darkSquareFloor,
          )}.`,
        );
      }
    }

    // D-02: P(line) within target ± tolerance.
    const target = cfg.bingo.vibes[vibe.vibe].line;
    if (Math.abs(vibe.pLine - target) > LINE_TARGET_TOLERANCE) {
      failures.push(
        `[${vibe.vibe}] P(line) ${pct(vibe.pLine)} is outside target ${pct(target)} ± ${pct(
          LINE_TARGET_TOLERANCE,
        )}.`,
      );
    }

    // D-03: P(blackout) inside the per-vibe band.
    const band = blackoutBand(vibe.vibe, cfg);
    if (vibe.pBlackout > band.max) {
      failures.push(
        `[${vibe.vibe}] P(blackout) ${pct(vibe.pBlackout)} exceeds the band max ${pct(band.max)}.`,
      );
    }
    if (band.min !== null && vibe.pBlackout < band.min) {
      failures.push(
        `[${vibe.vibe}] P(blackout) ${pct(vibe.pBlackout)} is below the band min ${pct(band.min)}.`,
      );
    }
  }

  return failures;
}

// ── Report formatter (D-19a) ─────────────────────────────────────────────────

function formatVibeTable(vibes: VibeCalibration[]): string {
  const rows = [
    "| Vibe | P(line) | P(blackout) | P(corners) | P(X) | marks median | mean | min | max |",
    "|---|---|---|---|---|---|---|---|---|",
    ...vibes.map(
      (v) =>
        `| ${escapeMarkdownExcerpt(v.vibe)} | ${pct(v.pLine)} | ${pct(v.pBlackout)} | ${pct(
          v.pCorners,
        )} | ${pct(v.pX)} | ${v.expectedMarks.median} | ${v.expectedMarks.mean.toFixed(2)} | ${
          v.expectedMarks.min
        } | ${v.expectedMarks.max} |`,
    ),
  ];
  return rows.join("\n");
}

function formatDarkShareTable(vibes: VibeCalibration[]): string {
  const rows = [
    "| Vibe | Reliable square | trials | fire-rate | dark-share |",
    "|---|---|---|---|---|",
  ];
  for (const v of vibes) {
    for (const rel of v.reliableSquares) {
      rows.push(
        `| ${escapeMarkdownExcerpt(v.vibe)} | ${escapeMarkdownExcerpt(rel.type)} | ${rel.trials} | ${pct(
          rel.fireRate,
        )} | ${pct(rel.darkShare)} |`,
      );
    }
  }
  return rows.join("\n");
}

/** D-19a: the owner-readable markdown trust report. `sections` joined with blank lines + trailing newline (run-backtest idiom). */
export function formatCalibrationReport(result: CalibrationResult): string {
  const sections: string[] = [];

  sections.push(`# Bingo Calibration Report

Generated ${escapeMarkdownExcerpt(result.generatedAt)} from the committed corpus (version ${escapeMarkdownExcerpt(
    result.corpusVersion,
  )}). Zero network requests — a pure Monte-Carlo replay of ${result.showCount} recent-era shows through the REAL \`deriveMarks\` + \`detectWins\` marking fold (Pitfall 3), ${result.simCardsPerVibe} seeded cards per vibe.

This is the Bingo trust gate (D-19): the owner reads the per-vibe numbers below and the hard-assert gate exits non-zero on any D-02/D-03/D-05 violation. The **mid-collection** dex assumption is GATED; the **empty** dex assumption is the first-show edge — reported, not gated.`);

  for (const assumption of result.assumptions) {
    const heading =
      assumption.assumption === "mid-collection"
        ? "Mid-collection dex (GATED)"
        : "Empty dex (first-show edge — reported, not gated)";
    sections.push(
      `## ${heading}\n\n${formatVibeTable(assumption.vibes)}\n\n### Reliable-square dark share (D-05)\n\n${formatDarkShareTable(
        assumption.vibes,
      )}`,
    );
  }

  return `${sections.join("\n\n")}\n`;
}

// ── Roster-candidate mode (`--candidates`, D-20 input) ───────────────────────

/** Fraction of shows in which ≥1 of `memberIds` was played. */
function measuredFireRate(shows: readonly CalibrationShow[], memberIds: ReadonlySet<number>): number {
  if (shows.length === 0) return 0;
  let hits = 0;
  for (const show of shows) {
    if (show.songIds.some((songId) => memberIds.has(songId))) hits++;
  }
  return hits / shows.length;
}

/**
 * `buildRosterCandidates(ctx, shows, cfg, opts)` — measures corpus fire-rates to
 * PROPOSE the two owner-curated rosters (D-20). Album pool: every album in
 * `ctx.albumSongIds` scored by member fire-rate (≥53% = "set", ≥20% = lower-fire
 * candidate, D-17). Jam vehicles: `JAM_VEHICLE_NAME_HINTS` substring-matched
 * against the injected `songNames`, ranked by measured fire-rate. Emitted to a
 * REVIEW file (never config.ts) for the human checkpoint — corpus proposes, the
 * owner disposes.
 */
export function buildRosterCandidates(
  ctx: BingoContext,
  shows: readonly CalibrationShow[],
  cfg: typeof config = config,
  opts: RosterCandidatesOptions = {},
): RosterCandidates {
  void cfg;
  const albumCandidates: AlbumCandidate[] = [...ctx.albumSongIds.entries()]
    .map(([albumUrl, memberIds]): AlbumCandidate => {
      const fireRate = measuredFireRate(shows, memberIds);
      return {
        albumUrl,
        memberCount: memberIds.size,
        fireRate,
        tier: fireRate >= ALBUM_SET_FIRE_RATE ? "set" : "lower-fire",
      };
    })
    .filter((c) => c.fireRate >= ALBUM_MIN_FIRE_RATE)
    .sort((a, b) => b.fireRate - a.fireRate || (a.albumUrl < b.albumUrl ? -1 : 1));

  const songNames = opts.songNames ?? new Map<number, string>();
  const hints = JAM_VEHICLE_NAME_HINTS.map((h) => h.toLowerCase());
  const jamVehicleCandidates: JamVehicleCandidate[] = [...songNames.entries()]
    .filter(([, name]) => hints.some((hint) => name.toLowerCase().includes(hint)))
    .map(([songId, name]): JamVehicleCandidate => ({
      songId,
      name,
      fireRate: measuredFireRate(shows, new Set<number>([songId])),
    }))
    .sort((a, b) => b.fireRate - a.fireRate || a.songId - b.songId);

  return {
    generatedAt: opts.generatedAt ?? "unknown",
    showCount: shows.length,
    albumCandidates,
    jamVehicleCandidates,
  };
}

/** The owner-facing roster review markdown (D-20). Song / album names are escaped (T-14-11). */
export function formatRosterCandidates(candidates: RosterCandidates): string {
  const sections: string[] = [];

  sections.push(`# Bingo Roster Candidates (review — DO NOT auto-apply)

Generated ${escapeMarkdownExcerpt(candidates.generatedAt)} from ${candidates.showCount} recent-era shows. These are corpus-measured PROPOSALS for \`config.bingo.jamVehicleSongIds\` and \`config.bingo.albumSquarePool\`. Corpus proposes, the owner disposes (D-16/D-20) — edit and paste the approved rosters into config.ts, then rerun the gate to green.`);

  const albumRows = [
    "| Album | members | fire-rate | tier |",
    "|---|---|---|---|",
    ...candidates.albumCandidates.map(
      (c) =>
        `| ${escapeMarkdownExcerpt(c.albumUrl)} | ${c.memberCount} | ${pct(c.fireRate)} | ${c.tier} |`,
    ),
  ];
  sections.push(`## Album-square candidates (D-17)\n\n${albumRows.join("\n")}`);

  const jamRows = [
    "| Song | songId | fire-rate |",
    "|---|---|---|",
    ...candidates.jamVehicleCandidates.map(
      (c) => `| ${escapeMarkdownExcerpt(c.name)} | ${c.songId} | ${pct(c.fireRate)} |`,
    ),
  ];
  sections.push(`## Marathon-jam-vehicle candidates\n\n${jamRows.join("\n")}`);

  return `${sections.join("\n\n")}\n`;
}

// ── CLI wrapper (isMain) ─────────────────────────────────────────────────────

interface BingoCalibrateCliOptions {
  candidates: boolean;
  reportOutPath?: string;
  jsonOutPath?: string;
}

/** Flatten a recent-era corpus show into a 0-based play-ordered trail + its distinct non-placeholder song set. */
function showToCalibration(show: NormalizedShow, sentinelIds: readonly number[]): CalibrationShow {
  const sentinels = new Set<number>(sentinelIds);
  const performances = show.sets
    .flatMap((set) => set.performances)
    .slice()
    .sort((a, b) => a.position - b.position);

  const trail: MarkTrailEntry[] = performances.map((perf) => ({
    // Corpus position is 1-indexed global to the show → contract index = position − 1 (opener = 0).
    position: perf.position - 1,
    songId: perf.isPlaceholder ? null : perf.songId,
    isPlaceholder: perf.isPlaceholder,
  }));

  const songIds = [
    ...new Set<number>(
      performances
        .filter((perf) => !perf.isPlaceholder && !sentinels.has(perf.songId))
        .map((perf) => perf.songId),
    ),
  ].sort((a, b) => a - b);

  return { showId: show.showId, songIds, trail };
}

function parseArgs(argv: string[]): BingoCalibrateCliOptions {
  const options: BingoCalibrateCliOptions = { candidates: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") options.reportOutPath = argv[++i];
    else if (arg === "--json-out") options.jsonOutPath = argv[++i];
    else if (arg === "--candidates") options.candidates = true;
    else throw new Error(`Unknown flag: ${arg}`);
  }
  return options;
}

/**
 * Read the committed artifacts, build one `BingoContext`, and reduce the recent-era
 * (year ≥ 2022) corpus shows to `CalibrationShow`s + a songId→name map. Pure of the
 * gate itself — the `isMain` block decides candidates-vs-calibrate.
 */
async function loadCalibrationInputs(): Promise<{
  ctx: BingoContext;
  shows: CalibrationShow[];
  songNames: Map<number, string>;
  generatedAt: string;
  corpusVersion: string;
}> {
  const corpus = JSON.parse(await readFile(config.corpusArtifactPath, "utf8")) as NormalizedCorpus;
  const matrix = JSON.parse(await readFile(config.matrixArtifactPath, "utf8")) as {
    nodes: Array<{ songId: number; songName: string; eraPlayCount: number; tuningFamily: string }>;
  };
  const archive = JSON.parse(
    await readFile(config.dex.archiveArtifactPath, "utf8"),
  ) as ArchiveArtifact;
  const albums = JSON.parse(
    await readFile(config.dex.dexAlbumsArtifactPath, "utf8"),
  ) as DexAlbumsArtifact;

  const rarity = buildRarityIndex(archive);
  const ctx = buildBingoContext(matrix, archive, rarity, albums);

  const shows = corpus.shows
    .filter((show) => show.year >= RECENT_ERA_MIN_YEAR)
    .map((show) => showToCalibration(show, config.sentinelSongIds as readonly number[]));

  const songNames = new Map<number, string>();
  for (const node of matrix.nodes) songNames.set(node.songId, node.songName);

  return {
    ctx,
    shows,
    songNames,
    generatedAt: corpus.generatedAt,
    corpusVersion: corpus.generatedAt,
  };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { ctx, shows, songNames, generatedAt, corpusVersion } = await loadCalibrationInputs();

    if (options.candidates) {
      // Roster mode: emit the review worksheet, NO gate, NO config write (D-20).
      const candidates = buildRosterCandidates(ctx, shows, config, { songNames, generatedAt });
      const report = formatRosterCandidates(candidates);
      const outPath = options.reportOutPath ?? config.bingo.rosterCandidatesPath;
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, report, "utf8");
      console.log(report);
      console.error(
        `Roster candidates written to ${outPath}: ${candidates.albumCandidates.length} album(s), ${candidates.jamVehicleCandidates.length} jam vehicle(s). No gate run (D-20 review).`,
      );
    } else {
      const result = runBingoCalibration(ctx, shows, config, { generatedAt, corpusVersion });
      const report = formatCalibrationReport(result);

      const jsonOutPath = options.jsonOutPath ?? config.bingo.calibrationJsonPath;
      const reportOutPath = options.reportOutPath ?? config.bingo.calibrationReportPath;
      await mkdir(dirname(jsonOutPath), { recursive: true });
      await writeFile(jsonOutPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      await mkdir(dirname(reportOutPath), { recursive: true });
      await writeFile(reportOutPath, report, "utf8");
      console.log(report);

      const failures = assertCalibrationInvariants(result, config);
      if (failures.length > 0) {
        console.error(`\nCalibration gate FAILED — ${failures.length} violation(s):`);
        for (const failure of failures) console.error(`  - ${failure}`);
        process.exit(1);
      }
      console.error(`\nCalibration gate PASSED (${result.showCount} shows, ${result.simCardsPerVibe} cards/vibe).`);
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
