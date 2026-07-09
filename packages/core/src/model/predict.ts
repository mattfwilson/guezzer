/**
 * D-01/D-02/D-06: the predictor. Pure, zero I/O — never reads
 * data/tuning-tags.json or any file directly; every signal it needs
 * (tuningFamily, eraPlayCount, playCount) is already baked into the frozen
 * `TransitionMatrix` at build time (model/matrix.ts). Mirrors
 * `ingest/tuning-tags.ts`'s staged-helper decomposition: several small named
 * pure fns compose into one entrypoint.
 *
 * This plan (02-02) delivers the D-02 interpolated backoff base (four
 * normalized tiers blended Jelinek-Mercer style) in Task 1, then the D-01
 * multiplicative pipeline SKELETON + `predict` entrypoint in Task 2. Every
 * downstream modifier (rotation, alreadyPlayed, eraPrior, hardSegue) is a
 * stub returning the neutral value this plan — Plan 03 fills in the real
 * bodies.
 */
import type { MatrixEdge, SignalToggles } from "../domain/types.ts";
import type { MatrixIndex } from "./index-build.ts";

/**
 * The subset of `config`'s model constants the predictor reads, widened to
 * plain `number` (not the `as const` literal types `typeof config` carries)
 * so ablation callers (Plan 03 backtest, this plan's tests) can pass a
 * clone with an overridden value without fighting the type checker. `config`
 * itself satisfies this shape structurally — no cast needed at call sites.
 */
export interface ScoringConfig {
  backoffWeights: { w1: number; w2: number; w3: number; w4: number };
  transitionAddAlpha: number;
  rotationWindowShows: number;
  rotationPenaltyPerShow: number;
  alreadyPlayedFactor: number;
  hardSegueConsistencyThreshold: number;
  hardSegueMinSupport: number;
  hardSegueOverrideCeiling: number;
  hardSegueBoost: number;
  eraWindowShows: number;
  eraPriorSmoothingK: number;
  eraPriorFloor: number;
  eraPriorCeil: number;
  candidateListSize: number;
}

/** D-01/D-14: all signals on by default — the shipped model. Backtest ablation (Plan 03) clones this with exactly one field flipped false per run. */
export const defaultSignalToggles: SignalToggles = {
  decay: true,
  rotation: true,
  alreadyPlayed: true,
  eraPrior: true,
  hardSegue: true,
  tuning: true,
  albumEra: true,
};

/** M1: use the recency-decayed weight when the `decay` toggle is on, else the raw observed count — the single point where every tier-1/2 helper picks its edge magnitude. */
function edgeWeight(edge: MatrixEdge, toggles: SignalToggles): number {
  return toggles.decay ? edge.weightedCount : edge.count;
}

function candidateCount(index: MatrixIndex): number {
  return index.nodeById.size;
}

/** Pitfall 4 fallback: when a tier has no observed mass to distribute (e.g. `A` has never been played, or nothing is era-active), spread it uniformly over the full candidate universe `C` so the tier still sums to ~1 instead of collapsing to all-zero. */
function uniformFallback(index: MatrixIndex): number {
  const n = candidateCount(index);
  return n > 0 ? 1 / n : 0;
}

/**
 * t1 (M1/MODL-03): MLE first-order transition probability, `weightedCount(A→B)
 * / Σ_x weightedCount(A→x)`, with an add-α Lidstone floor in the numerator
 * (seed 0.0 — interpolation already supplies the D-02 floor via t4). Zero
 * for every unobserved `B` — the floor for unseen pairs comes from the
 * lower tiers in `baseFactor`, never from here (that is the whole point of
 * D-02 interpolated smoothing over a hard backoff cliff).
 */
export function transitionProb(
  A: number,
  B: number,
  index: MatrixIndex,
  cfg: ScoringConfig,
  toggles: SignalToggles,
): number {
  const edges = index.edgesFrom.get(A) ?? [];
  const alpha = cfg.transitionAddAlpha;
  const total = edges.reduce((sum, edge) => sum + edgeWeight(edge, toggles), 0);
  const denom = total + alpha * candidateCount(index);
  if (denom <= 0) return uniformFallback(index);
  const observed = edges.find((edge) => edge.to === B);
  const numerator = (observed ? edgeWeight(observed, toggles) : 0) + alpha;
  return numerator / denom;
}

/**
 * t2 (M1/MODL-09, D-03): successor frequency of `B` among the pooled
 * within-set successors of every song sharing `A`'s tuning family,
 * normalized over `C`. Contributes ONLY here, inside the backoff blend —
 * never as a top-level multiplier (D-03; enforced structurally by
 * `PredictionFactors` never carrying a separate tuning field, see
 * `scoreCandidate` in Task 2).
 */
export function tuningAffinity(
  A: number,
  B: number,
  index: MatrixIndex,
  toggles: SignalToggles,
): number {
  const nodeA = index.nodeById.get(A);
  if (!nodeA) return uniformFallback(index);

  const family = nodeA.tuningFamily;
  let total = 0;
  let mass = 0;
  for (const node of index.nodeById.values()) {
    if (node.tuningFamily !== family) continue;
    const edges = index.edgesFrom.get(node.songId) ?? [];
    for (const edge of edges) {
      const w = edgeWeight(edge, toggles);
      total += w;
      if (edge.to === B) mass += w;
    }
  }
  if (total <= 0) return uniformFallback(index);
  return mass / total;
}

/**
 * t4 (M1): the all-time marginal `playCount(B) / Σ playCount` — the
 * nonzero floor guaranteeing MODL-08 (a plausible unseen pair still scores
 * `> 0`), since every catalog song in `C` has `playCount >= 1` by
 * construction (`buildMatrix` only ever creates a node from an actual
 * performance).
 */
export function basePlayRate(B: number, index: MatrixIndex): number {
  let totalPlay = 0;
  for (const node of index.nodeById.values()) totalPlay += node.playCount;
  if (totalPlay <= 0) return uniformFallback(index);
  const node = index.nodeById.get(B);
  return (node?.playCount ?? 0) / totalPlay;
}

/**
 * t3 (M1/M8, MODL-07 "Claude's Discretion"): `[ASSUMED]` operational
 * "album/era cluster" affinity. Album metadata is not present in the
 * normalized corpus (RESEARCH M8/CONTEXT D-16 discretion note), so this
 * approximates same-era co-activity using each `MatrixNode.eraPlayCount`
 * baked in at build time (plays within the trailing `config.eraWindowShows`
 * shows before the matrix's `asOfDate` — already leak-safe, computed once
 * in `buildMatrix`). When `A` is itself era-active, `B`'s mass is its share
 * of the era-active songs' total era play; when `A` is NOT era-active (a
 * retired song), fall back to the flat all-time marginal (`basePlayRate`)
 * so the tier degrades gracefully instead of collapsing to zero. This is
 * deliberately distinct from the top-level `eraPrior` multiplier (Plan 03,
 * MODL-07): `eraPrior` is a *marginal*, B-only relative-to-career boost,
 * while this tier is *pairwise* — it only fires when `A` shares the current
 * era with `B` — avoiding the Pitfall 5 double-count RESEARCH flags.
 */
export function albumEraAffinity(A: number, B: number, index: MatrixIndex): number {
  const nodeA = index.nodeById.get(A);
  let totalEraPlay = 0;
  for (const node of index.nodeById.values()) totalEraPlay += node.eraPlayCount;

  if (!nodeA || nodeA.eraPlayCount <= 0 || totalEraPlay <= 0) {
    return basePlayRate(B, index);
  }

  const nodeB = index.nodeById.get(B);
  if (!nodeB || nodeB.eraPlayCount <= 0) return 0;
  return nodeB.eraPlayCount / totalEraPlay;
}

interface EffectiveBackoffWeights {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
}

/**
 * D-02/M6: re-normalizes the four backoff-tier weights to sum to 1 after
 * dropping any tier whose ablation toggle (`toggles.tuning`/`albumEra`) is
 * off, so `baseFactor` stays a valid convex interpolation under every
 * ablation variant (Plan 03 just flips a flag; this helper does the rest).
 */
function effectiveBackoffWeights(cfg: ScoringConfig, toggles: SignalToggles): EffectiveBackoffWeights {
  const raw = cfg.backoffWeights;
  const w1 = raw.w1;
  const w2 = toggles.tuning ? raw.w2 : 0;
  const w3 = toggles.albumEra ? raw.w3 : 0;
  const w4 = raw.w4;
  const sum = w1 + w2 + w3 + w4;
  if (sum <= 0) return { w1: 0, w2: 0, w3: 0, w4: 0 };
  return { w1: w1 / sum, w2: w2 / sum, w3: w3 / sum, w4: w4 / sum };
}

/**
 * D-02 (Pattern 1): the interpolated backoff base — a weighted (Jelinek-
 * Mercer) blend of the four tiers above, each independently normalized over
 * `C` before blending (Pitfall 4). `t4 basePlayRate` guarantees the MODL-08
 * nonzero floor for every plausible pair even when the other three tiers
 * are all zero for an unseen `A→B`.
 */
export function baseFactor(
  A: number,
  B: number,
  index: MatrixIndex,
  cfg: ScoringConfig,
  toggles: SignalToggles,
): number {
  const weights = effectiveBackoffWeights(cfg, toggles);
  return (
    weights.w1 * transitionProb(A, B, index, cfg, toggles) +
    weights.w2 * tuningAffinity(A, B, index, toggles) +
    weights.w3 * albumEraAffinity(A, B, index) +
    weights.w4 * basePlayRate(B, index)
  );
}
