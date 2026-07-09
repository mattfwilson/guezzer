/**
 * D-12/D-13: the walk-forward backtest -- the non-negotiable trust gate.
 * Pure, zero I/O (EVAL-03): reads only what the caller passes in, performs
 * no network/disk access. Mirrors `ingest/census.ts`'s "one exported
 * *Result interface + interior sub-interfaces + one top-level pure fn"
 * batch-derivation shape.
 *
 * Algorithm (RESEARCH M5): (1) `findHoldoutShows` identifies the most
 * recent complete tour; (2) process held-out shows in `(date, showOrder)`
 * order; (3) for each held-out show S, rebuild the matrix with the
 * EXCLUSIVE `(S.date, S.showOrder)` as-of bound -- so S's own transitions
 * are never in training, but the tour's earlier nights ARE (this is what
 * genuinely exercises rotation suppression, MODL-06); (4) walk every
 * within-set adjacent transition A->B, skipping placeholder targets (M7);
 * (5) score with `predict`, record top-1/5/10 hits; (6) split by whether
 * the actual transition was a notated hard segue (`A.transitionKind ===
 * "segue"`, D-13).
 */
import { config } from "../config.ts";
import type {
  AblationEntry,
  AsOfBound,
  BacktestResult,
  BacktestSplit,
  NormalizedCorpus,
  NormalizedShow,
  PredictionCandidate,
  ShowContext,
  SignalToggles,
  TransitionMatrix,
} from "../domain/types.ts";
import { buildMatrix } from "../model/matrix.ts";
import { defaultSignalToggles, predict, type ScoringConfig } from "../model/predict.ts";
import { findHoldoutShows } from "./holdout.ts";

/** One walked within-set adjacent transition A->B, already scored against its leak-free as-of matrix. */
interface EvalTransitionResult {
  A: number;
  B: number;
  /** D-13 split criterion: the ACTUAL transition was notated (`A.transitionKind === "segue"`) -- never the predicted/candidate's kind. */
  hardSegue: boolean;
  candidates: PredictionCandidate[];
}

/** `hitAtK` (M7): true iff the true target `B` appears among the top `k` ranked candidates. */
function hitAtK(candidates: PredictionCandidate[], target: number, k: number): boolean {
  return candidates.slice(0, k).some((c) => c.songId === target);
}

/** `splitBy`-shaped aggregation: reduces a set of eval-transition results to one `BacktestSplit` (D-13). */
function aggregateSplit(results: EvalTransitionResult[]): BacktestSplit {
  let top1 = 0;
  let top5 = 0;
  let top10 = 0;
  for (const result of results) {
    if (hitAtK(result.candidates, result.B, 1)) top1++;
    if (hitAtK(result.candidates, result.B, 5)) top5++;
    if (hitAtK(result.candidates, result.B, 10)) top10++;
  }
  return { n: results.length, top1, top5, top10 };
}

/** The songIds performed in a show (all sets, in order), excluding placeholders -- one entry of `ShowContext.recentShowSongSets` (MODL-06). */
function showSongSet(show: NormalizedShow): number[] {
  const songIds: number[] = [];
  for (const set of show.sets) {
    for (const performance of set.performances) {
      if (!performance.isPlaceholder) songIds.push(performance.songId);
    }
  }
  return songIds;
}

/**
 * `evalTransitions` (M5/M7): walks every within-set adjacent pair of a
 * single held-out show against its (already leak-free) as-of `matrix`,
 * skipping placeholder targets (B.isPlaceholder), set-openers (no
 * within-set predecessor -- structurally excluded since only adjacent
 * PAIRS are walked, never a lone first performance), and single-song sets
 * (0 pairs). The "current context" for each pair is `A` plus the
 * in-progress trail -- every performance strictly before `A`, accumulated
 * across the WHOLE show (not reset per set, matching D-05's "already-played
 * so far this show") -- plus `recentShowSongSets`, the prior processed
 * held-out shows of this same tour (MODL-06; `rotationSuppression` itself
 * windows this to the trailing `cfg.rotationWindowShows`, so the FULL list
 * is passed here, unsliced).
 */
function evalTransitions(
  show: NormalizedShow,
  matrix: TransitionMatrix,
  cfg: ScoringConfig,
  toggles: SignalToggles,
  recentShowSongSets: number[][],
): EvalTransitionResult[] {
  const results: EvalTransitionResult[] = [];
  const trailSoFar: number[] = [];

  for (const set of show.sets) {
    const performances = set.performances;
    for (let i = 0; i < performances.length; i++) {
      const current = performances[i];
      const next = i < performances.length - 1 ? performances[i + 1] : undefined;

      if (next && !next.isPlaceholder) {
        const ctx: ShowContext = {
          currentSongId: current.songId,
          trail: [...trailSoFar],
          recentShowSongSets,
        };
        const candidates = predict(matrix, ctx, cfg, toggles);
        results.push({
          A: current.songId,
          B: next.songId,
          hardSegue: current.transitionKind === "segue",
          candidates,
        });
      }

      trailSoFar.push(current.songId);
    }
  }

  return results;
}

/** The full-model result plus every per-signal ablation split, without the header fields -- shared by `runBacktest`'s full run and each ablation-variant run (D-14/M6, single scoring code path). */
interface WalkForwardMetrics {
  evalTransitionCount: number;
  overall: BacktestSplit;
  hardSegue: BacktestSplit;
  freeChoice: BacktestSplit;
}

/**
 * The walk-forward loop itself (D-12/M5), factored out of `runBacktest` so
 * both the full model and every leave-one-signal-out ablation variant
 * (Plan 05) drive it through the exact same code path -- `toggles` is the
 * only thing that ever differs between calls, never a forked
 * implementation. `sortedHoldoutShows` is precomputed once by the caller
 * (holdout identification/order does not depend on `toggles`).
 */
function walkForward(
  sortedHoldoutShows: NormalizedShow[],
  corpus: NormalizedCorpus,
  cfg: typeof config,
  toggles: SignalToggles,
): WalkForwardMetrics {
  const allResults: EvalTransitionResult[] = [];
  const processedSongSets: number[][] = [];

  for (const show of sortedHoldoutShows) {
    // Exclusive (date, showOrder) tuple bound (D-12/M5, Pitfall 3): train =
    // everything strictly prior to S, including this tour's earlier
    // nights, but never S itself.
    const asOf: AsOfBound = { date: show.date, showOrder: show.showOrder, inclusive: false };
    const matrix = buildMatrix(corpus, asOf, cfg);

    const results = evalTransitions(show, matrix, cfg, toggles, processedSongSets);
    allResults.push(...results);

    processedSongSets.push(showSongSet(show));
  }

  return {
    evalTransitionCount: allResults.length,
    overall: aggregateSplit(allResults),
    hardSegue: aggregateSplit(allResults.filter((r) => r.hardSegue)),
    freeChoice: aggregateSplit(allResults.filter((r) => !r.hardSegue)),
  };
}

/** D-14/M6: every toggleable signal, ablated one at a time -- fixed order so `BacktestResult.ablation` is deterministic/diffable (Pitfall 2). Mirrors `SignalToggles`'s field order (`domain/types.ts`). */
const ABLATION_SIGNALS: (keyof SignalToggles)[] = [
  "decay",
  "rotation",
  "alreadyPlayed",
  "eraPrior",
  "hardSegue",
  "tuning",
  "albumEra",
];

/** `hitRate` (D-14): a `BacktestSplit`'s top-`k` count expressed as a fraction of `n`, 0 when `n === 0` (no eval transitions -- avoids a NaN in `deltaVsFull`). */
function hitRate(split: BacktestSplit, key: "top1" | "top5" | "top10"): number {
  return split.n > 0 ? split[key] / split.n : 0;
}

/**
 * `runBacktest(corpus, cfg, toggles) -> BacktestResult` (D-12/D-13/D-14).
 * Runs the full model once via `walkForward`, then re-runs the identical
 * walk-forward loop once per signal in `ABLATION_SIGNALS` with `toggles`
 * cloned and exactly that one field flipped `false` -- every variant shares
 * the same `predict`/`scoreCandidate` code path (M6); a backoff-tier
 * ablation (`tuning`/`albumEra`) re-normalizes the remaining weights inside
 * `predict.ts`'s `effectiveBackoffWeights`, never forked here.
 * `deltaVsFull` is the variant's overall hit RATE (top-k / n) minus the full
 * model's -- report-only, D-14: this function never throws or returns a
 * pass/fail flag based on the numbers.
 */
export function runBacktest(
  corpus: NormalizedCorpus,
  cfg: typeof config = config,
  toggles: SignalToggles = defaultSignalToggles,
): BacktestResult {
  const holdoutShows = findHoldoutShows(corpus, cfg.tourIdSentinel);

  // Deterministic (date, showOrder) walk-forward order (Pitfall 2) --
  // computed once; holdout identification/order never depends on toggles.
  const sorted = [...holdoutShows].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.showOrder - b.showOrder,
  );

  const full = walkForward(sorted, corpus, cfg, toggles);

  const ablation: AblationEntry[] = ABLATION_SIGNALS.map((signal) => {
    const variantToggles: SignalToggles = { ...toggles, [signal]: false };
    const variant = walkForward(sorted, corpus, cfg, variantToggles);
    return {
      signal,
      overall: variant.overall,
      hardSegue: variant.hardSegue,
      freeChoice: variant.freeChoice,
      deltaVsFull: {
        top1: hitRate(variant.overall, "top1") - hitRate(full.overall, "top1"),
        top5: hitRate(variant.overall, "top5") - hitRate(full.overall, "top5"),
        top10: hitRate(variant.overall, "top10") - hitRate(full.overall, "top10"),
      },
    };
  });

  const first = sorted[0];

  return {
    schemaVersion: 1,
    // Determinism (established in Plan 01 for TransitionMatrix.generatedAt,
    // mirrored by cli/build-model.ts): reuse the input corpus's own
    // generatedAt, never wall-clock `new Date()` -- runBacktest stays pure
    // and re-running the CLI against the same committed corpus.json emits
    // a byte-stable data/backtest.json (Plan 05 acceptance criteria).
    generatedAt: corpus.generatedAt,
    holdoutTourId: first.tourId,
    holdoutTourName: first.tourName,
    holdoutShowCount: sorted.length,
    evalTransitionCount: full.evalTransitionCount,
    overall: full.overall,
    hardSegue: full.hardSegue,
    freeChoice: full.freeChoice,
    ablation,
  };
}
