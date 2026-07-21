/**
 * BINGO-02/04 (D-10/D-13/D-14/D-15): the two pure pre-/live-play heuristics
 * that sit on top of the shipped marking geometry.
 *
 *  - `estimateFill(card, ctx, caughtSnapshot, cfg)` — the D-10 PRE-LOCK
 *    difficulty meter. A cheap runtime estimate of how many of a card's 16
 *    squares will end the show marked, plus the line/blackout likelihood bands
 *    the fill-meter caption reads. It is the honest twin of the expensive
 *    build-time `bingo-calibrate` Monte-Carlo: `estimate.test.ts` gates its mean
 *    against the same corpus means so the meter never lies.
 *  - `nearMiss(marked, card, ctx, caughtSnapshot, cfg)` — the D-13/14/15 live
 *    one-away detector. Over a live `MarkedCard`, it returns the SINGLE closest
 *    one-away target (a line needing one square, or the blackout-minus-one),
 *    crowning blackout over a line, and NEVER four-corners or X (D-15).
 *
 * Pure core, mirrors `wins.ts`/`mark.ts` discipline exactly: no I/O, no DOM, no
 * wall-clock, no entropy; `cfg: typeof config = config` injected last. The line/
 * diagonal geometry is the SAME `ROWS`/`COLS`/`DIAG_MAIN`/`DIAG_ANTI` exported
 * from `wins.ts` — one geometry source, never a second copy. All numeric
 * constants (fire-rates, era denominator, band thresholds) live in
 * `cfg.bingo.fireRates`/`eraShowCount`/`fillMeter` — never inlined here.
 */
import { config } from "../config.ts";
import type { BingoContext } from "./context.ts";
import type { BingoCard, BingoEvent, BingoSquareDef, MarkedCard } from "./types.ts";
import { COLS, DIAG_ANTI, DIAG_MAIN, ROWS } from "./wins.ts";

/** The three-step confidence band shared by both the line and blackout odds. */
export type FillBand = "likely" | "possible" | "unlikely";

/** The pre-lock difficulty estimate the fill-meter renders (D-10/D-11). */
export interface FillEstimate {
  /** Expected number of marked squares at show end (1..16, free cell included). */
  expectedMarks: number;
  /** `expectedMarks / 16` — the meter's fill fraction. */
  fillFraction: number;
  /** Likelihood the card completes at least one line. */
  lineLikelihood: FillBand;
  /** Likelihood of a full blackout — honestly `"unlikely"` on every reachable card. */
  blackoutLikelihood: FillBand;
}

/** The single closest one-away target on a live board (D-13/14/15), or null. */
export interface NearMiss {
  /** Board index (0..15) of the one unmarked square that completes the target. */
  neededSquareIndex: number;
  /** The needed square's frozen display label (kglw-derived; rendered as escaped text). */
  neededLabel: string;
  /** A human bucket word for the one-away banner (e.g. "microtonal", the album, the song name). */
  bucket: string;
  /** Whether the one-away target is a line or the blackout crown (D-15). */
  kind: "line" | "blackout";
}

/**
 * Per-square marginal fill probability by kind (RESEARCH §"squareMatches"):
 *  - free: 1 (pre-marked center);
 *  - song: `min(1, eraPlayRate/eraShowCount)` — the labeled-approximation base rate;
 *  - album: `cfg.bingo.fireRates.album[albumUrl]` (0 for an album outside the pool);
 *  - event: `cfg.bingo.fireRates.event[event]`.
 * These are the HONEST marginals; the consume-once overcount is corrected by
 * the caller via `cfg.bingo.fillMeter.consumeOnceDiscount`.
 */
function squareFillProb(def: BingoSquareDef, ctx: BingoContext, cfg: typeof config): number {
  switch (def.kind) {
    case "free":
      return 1;
    case "song":
      return Math.min(1, (ctx.eraPlayRate.get(def.songId) ?? 0) / cfg.bingo.eraShowCount);
    case "album":
      return cfg.bingo.fireRates.album[def.albumUrl] ?? 0;
    case "event":
      return cfg.bingo.fireRates.event[def.event] ?? 0;
  }
}

/**
 * The one-away banner bucket word per event kind (mirrors `EVENT_LABELS` in
 * generate.ts — a core-domain vocabulary map, not chrome). Song/album squares
 * use their frozen label instead (the song name / album title IS the word).
 */
const EVENT_BUCKET: Readonly<Record<BingoEvent, string>> = {
  opener: "opener",
  microtonal: "microtonal",
  marathonJam: "marathon-jam",
  bustOut: "bust-out",
  neverCaught: "never-caught",
};

/** A short human bucket word for the one-away banner, derived from the needed square. */
function bucketWord(def: BingoSquareDef): string {
  switch (def.kind) {
    case "song":
    case "album":
      // The frozen label IS the human word (the song name / album title).
      return def.label;
    case "event":
      return EVENT_BUCKET[def.event];
    case "free":
      // Unreachable: the free cell is pre-marked, so it is never a needed square.
      throw new Error("bucketWord: the free cell is never a one-away target");
  }
}

/** The needed square's display label; free is unreachable (pre-marked). */
function neededLabelOf(def: BingoSquareDef): string {
  switch (def.kind) {
    case "song":
    case "album":
    case "event":
      return def.label;
    case "free":
      throw new Error("neededLabelOf: the free cell is never a one-away target");
  }
}

/**
 * `estimateFill(card, ctx, caughtSnapshot, cfg) -> FillEstimate`. Pure pre-lock
 * difficulty estimate: `expectedMarks ≈ 1 (free) + discount · Σ p_s` over the 15
 * fillable squares, where `discount = cfg.bingo.fillMeter.consumeOnceDiscount`
 * corrects the consume-once overcount. Bands come from the `fillMeter`
 * thresholds; blackout is honestly `"unlikely"` on every reachable card
 * (P(blackout) ≈ 0 everywhere under D-11 single-show marking).
 *
 * `caughtSnapshot` is accepted for signature parity with the marking fold /
 * generator (and a future dex-aware refinement) — the band model reads fixed
 * per-kind fire-rates, so it does not consult the snapshot today.
 */
export function estimateFill(
  card: BingoCard,
  ctx: BingoContext,
  caughtSnapshot: ReadonlySet<number>,
  cfg: typeof config = config,
): FillEstimate {
  void caughtSnapshot; // reserved for future dex-aware refinement (see header).

  let fillableSum = 0;
  for (const def of card.squares) {
    if (def.kind === "free") continue; // the pre-marked +1 base, not part of the sum
    fillableSum += squareFillProb(def, ctx, cfg);
  }

  const expectedMarks = 1 + cfg.bingo.fillMeter.consumeOnceDiscount * fillableSum;
  const fillFraction = expectedMarks / 16;

  const lineLikelihood: FillBand =
    expectedMarks >= cfg.bingo.fillMeter.lineLikelyThreshold
      ? "likely"
      : expectedMarks >= cfg.bingo.fillMeter.linePossibleThreshold
        ? "possible"
        : "unlikely";

  // Honest: a full blackout is effectively unreachable — only near-16 lifts it.
  const blackoutLikelihood: FillBand =
    expectedMarks >= 15.5 ? "likely" : expectedMarks >= 14 ? "possible" : "unlikely";

  return { expectedMarks, fillFraction, lineLikelihood, blackoutLikelihood };
}

/** The line/diagonal geometry `nearMiss` scans — EXCLUDES four-corners and X (D-15). */
const LINE_SETS: readonly (readonly number[])[] = [...ROWS, ...COLS, DIAG_MAIN, DIAG_ANTI];

/**
 * `nearMiss(marked, card, ctx, caughtSnapshot, cfg) -> NearMiss | null`. Scans a
 * live `MarkedCard` for the single closest one-away target:
 *  - a line (row/col/diagonal) with EXACTLY one unmarked square, tie-broken by
 *    the needed square's highest fill probability (then lowest board index);
 *  - the blackout-minus-one case (15 of 16 marked).
 * Blackout CROWNS a line when both are one-away (D-15). Four-corners and X are
 * deliberately excluded (D-15 — they get no near-miss drum-roll). Returns null
 * when nothing is one square away.
 *
 * `card` and `caughtSnapshot` are accepted for call-site signature parity
 * (`marked.squares[i].def` already carries every frozen def) — see header.
 */
export function nearMiss(
  marked: MarkedCard,
  card: BingoCard,
  ctx: BingoContext,
  caughtSnapshot: ReadonlySet<number>,
  cfg: typeof config = config,
): NearMiss | null {
  void card;
  void caughtSnapshot;

  const isMarked = (index: number): boolean => marked.squares[index].markedByPosition !== null;

  // Blackout-minus-one crowns everything (D-15): 15 of 16 marked → the lone gap.
  if (marked.markedCount === 15) {
    const gap = marked.squares.find((square) => square.markedByPosition === null);
    if (gap !== undefined) {
      return {
        neededSquareIndex: gap.index,
        neededLabel: neededLabelOf(gap.def),
        bucket: bucketWord(gap.def),
        kind: "blackout",
      };
    }
  }

  // Otherwise the single closest one-away LINE, by needed-square fill probability.
  let bestIndex: number | null = null;
  let bestProb = -Infinity;
  for (const line of LINE_SETS) {
    const unmarked = line.filter((index) => !isMarked(index));
    if (unmarked.length !== 1) continue;
    const needed = unmarked[0];
    const prob = squareFillProb(marked.squares[needed].def, ctx, cfg);
    // Higher fill-rate wins; ties break to the lower board index for determinism.
    if (prob > bestProb || (prob === bestProb && (bestIndex === null || needed < bestIndex))) {
      bestProb = prob;
      bestIndex = needed;
    }
  }

  if (bestIndex === null) return null;
  const def = marked.squares[bestIndex].def;
  return {
    neededSquareIndex: bestIndex,
    neededLabel: neededLabelOf(def),
    bucket: bucketWord(def),
    kind: "line",
  };
}
