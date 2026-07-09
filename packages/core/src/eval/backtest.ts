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

/**
 * `runBacktest(corpus, cfg, toggles) -> BacktestResult` (D-12/D-13). The
 * `ablation` array is always empty here -- populated by Plan 05's
 * leave-one-signal-out sweep, which re-invokes this same function once per
 * signal with `toggles` cloned and one flag flipped (D-14, single scoring
 * code path).
 */
export function runBacktest(
  corpus: NormalizedCorpus,
  cfg: typeof config = config,
  toggles: SignalToggles = defaultSignalToggles,
): BacktestResult {
  const holdoutShows = findHoldoutShows(corpus, cfg.tourIdSentinel);

  // Deterministic (date, showOrder) walk-forward order (Pitfall 2).
  const sorted = [...holdoutShows].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.showOrder - b.showOrder,
  );

  const allResults: EvalTransitionResult[] = [];
  const processedSongSets: number[][] = [];

  for (const show of sorted) {
    // Exclusive (date, showOrder) tuple bound (D-12/M5, Pitfall 3): train =
    // everything strictly prior to S, including this tour's earlier
    // nights, but never S itself.
    const asOf: AsOfBound = { date: show.date, showOrder: show.showOrder, inclusive: false };
    const matrix = buildMatrix(corpus, asOf, cfg);

    const results = evalTransitions(show, matrix, cfg, toggles, processedSongSets);
    allResults.push(...results);

    processedSongSets.push(showSongSet(show));
  }

  const overall = aggregateSplit(allResults);
  const hardSegue = aggregateSplit(allResults.filter((r) => r.hardSegue));
  const freeChoice = aggregateSplit(allResults.filter((r) => !r.hardSegue));

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
    evalTransitionCount: allResults.length,
    overall,
    hardSegue,
    freeChoice,
    ablation: [],
  };
}
