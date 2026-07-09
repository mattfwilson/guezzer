/**
 * D-01/D-02/D-06: the predictor. Pure, zero I/O — never reads
 * data/tuning-tags.json or any file directly; every signal it needs
 * (tuningFamily, eraPlayCount, playCount) is already baked into the frozen
 * `TransitionMatrix` at build time (model/matrix.ts). Mirrors
 * `ingest/tuning-tags.ts`'s staged-helper decomposition: several small named
 * pure fns compose into one entrypoint.
 *
 * Plan 02-02 delivered the D-02 interpolated backoff base (four normalized
 * tiers blended Jelinek-Mercer style) and the D-01 multiplicative pipeline
 * skeleton + `predict` entrypoint. Plan 02-03 (this plan) fills in the real
 * bodies of every downstream modifier — rotation suppression (MODL-06),
 * already-played conditioning (D-05/MODL-10), era prior (MODL-07), and the
 * consistency-gated hard-segue override/boost (D-04/MODL-05) — without
 * touching the call-site structure, so per-signal ablation (D-14) stays a
 * pure flag-flip.
 */
import { config } from "../config.ts";
import type {
  BackoffTier,
  MatrixEdge,
  PredictionCandidate,
  PredictionFactors,
  ShowContext,
  SignalToggles,
  TransitionMatrix,
} from "../domain/types.ts";
import { buildMatrixIndex, type MatrixIndex } from "./index-build.ts";

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

// --- Downstream multiplier pipeline (D-01) — real bodies (Plan 03) ---
// Every downstream fn below replaces the Plan 02 neutral stub; the
// toggle-gated call sites in `scoreCandidate` are unchanged from Plan 02
// (a pure body-fill, never a pipeline restructure).

/** Clamp `value` into `[min, max]` — shared by eraPrior (M8) and applyOverride's pin ceiling. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * MODL-06 (M3, D-01): conditions on the RECENT PRIOR TOUR shows in
 * `ctx.recentShowSongSets` — distinct from `alreadyPlayedFactor`'s
 * in-progress-show trail. `rotationPenaltyPerShow ^ n`, where `n` is how
 * many of the last `cfg.rotationWindowShows` recent shows played `B` — a
 * song played every recent night approaches hard exclusion
 * (`0.5^3 = 0.125`) without ever hitting exactly 0 (no hard-zeros, RESEARCH
 * Pitfall "Hard-zeros anywhere").
 */
export function rotationSuppression(B: number, ctx: ShowContext, cfg: ScoringConfig): number {
  const window = ctx.recentShowSongSets.slice(-cfg.rotationWindowShows);
  const timesPlayed = window.filter((songSet) => songSet.includes(B)).length;
  return Math.pow(cfg.rotationPenaltyPerShow, timesPlayed);
}

/**
 * D-05/MODL-10: conditions on the IN-PROGRESS current show's trail
 * (`ctx.trail`) — distinct from rotation suppression (M3). A boolean
 * membership check (once per candidate, not per prior occurrence): if `B`
 * has already appeared this show, apply the near-zero (never hard-zero)
 * `cfg.alreadyPlayedFactor` so a sandwich/reprise stays scoreable.
 */
export function alreadyPlayedFactor(B: number, ctx: ShowContext, cfg: ScoringConfig): number {
  return ctx.trail.includes(B) ? cfg.alreadyPlayedFactor : 1;
}

/**
 * MODL-07 (M8, Pitfall 5 — avoid double-counting with t3 `albumEraAffinity`):
 * a RELATIVE "is B hot right now vs its career" multiplier centered near 1.
 * `eraRate(B) = eraPlayCount / cfg.eraWindowShows` (recent per-window
 * activity) vs `allTimeRate(B) = basePlayRate(B, index)` — t4's own
 * all-time marginal (M8: "allTimeRate(B) = t4's marginal"), reused rather
 * than re-derived so this stays orthogonal to t3's pairwise A–B affinity.
 * Additive smoothing (`cfg.eraPriorSmoothingK`) on both sides of the ratio
 * guarantees a finite, gently-centered result even when `allTimeRate` is
 * near zero (T-02-07), and the result is clamped to
 * `[eraPriorFloor, eraPriorCeil]`.
 */
export function eraPrior(B: number, index: MatrixIndex, cfg: ScoringConfig): number {
  const node = index.nodeById.get(B);
  if (!node) return 1;
  const k = cfg.eraPriorSmoothingK;
  const eraRate = node.eraPlayCount / cfg.eraWindowShows;
  const allTimeRate = basePlayRate(B, index);
  const ratio = (eraRate + k) / (allTimeRate + k);
  return clamp(ratio, cfg.eraPriorFloor, cfg.eraPriorCeil);
}

/** `totalExits(A)` (M4/D-04): sum of the RAW `count` (never `weightedCount`) over every edge out of `A` — the denominator of `segueRate`. A swappable helper per the plan's "keep the denominator a swappable helper" note. */
function totalExits(A: number, index: MatrixIndex): number {
  const edges = index.edgesFrom.get(A) ?? [];
  return edges.reduce((sum, edge) => sum + edge.count, 0);
}

/** D-04: the hard-segue override descriptor — `pin` forces the near-1.0 ceiling (only when consistency-gated), `boost` strongly multiplies an inconsistent/one-off segue without pinning it. */
export interface SegueOverride {
  kind: "pin" | "boost";
  value: number;
}

/**
 * MODL-05/D-04 (M4): consistency-gated hard-segue override. Segue direction
 * is CORRECTNESS-CRITICAL (RESEARCH Pitfall 1) but already resolved at
 * matrix-build time — `edge.segueCount` only ever accumulates from `A`'s OUT
 * transition (`A.transitionKind === "segue"`, matrix.ts), so this function
 * never re-reads `B`'s kind, only the stored edge. `segueRate(A→B) =
 * segueCount(A→B) / totalExits(A)`; the gate requires BOTH a high rate AND
 * enough support (`hardSegueMinSupport`) to avoid a single 1/1 pinning false
 * certainty (T-02-06 guards `totalExits === 0` structurally: a nonzero
 * `segueCount` implies `totalExits >= segueCount >= 1`, so this never
 * divides by zero).
 */
export function hardSegueOverride(
  A: number,
  B: number,
  index: MatrixIndex,
  cfg: ScoringConfig,
): SegueOverride | null {
  const edges = index.edgesFrom.get(A) ?? [];
  const edge = edges.find((e) => e.to === B);
  if (!edge || edge.segueCount <= 0) return null;

  const exits = totalExits(A, index);
  const segueRate = exits > 0 ? edge.segueCount / exits : 0;

  if (segueRate >= cfg.hardSegueConsistencyThreshold && exits >= cfg.hardSegueMinSupport) {
    return { kind: "pin", value: cfg.hardSegueOverrideCeiling };
  }
  return { kind: "boost", value: cfg.hardSegueBoost };
}

/**
 * D-04: applies the `hardSegueOverride` descriptor on top of the
 * multiplicative `score`. `pin` forces the near-1.0 ceiling — the ONLY path
 * that represents a genuinely gated, consistency-verified hard segue
 * (`factors.hardSegueFlag`). `boost` multiplies the existing score and
 * `null` passes it through unchanged; BOTH are still capped at
 * `cfg.hardSegueOverrideCeiling` (reusing the existing config constant,
 * never a new magic number, CLAUDE.md single-config-file constraint) so
 * nothing except a gated hard segue can ever reach the near-1.0 ceiling.
 * Without this cap the multiplicative pipeline isn't bound to `[0,1]` —
 * `eraPrior` alone can reach `eraPriorCeil` (2.0) and `hardSegueBoost` is
 * 3.0×, either of which can otherwise push an un-gated candidate's score
 * past 1.0, violating "never 100% except a notated hard segue" (CONTEXT
 * D-02).
 */
export function applyOverride(score: number, override: SegueOverride | null, cfg: ScoringConfig): number {
  if (override?.kind === "pin") return Math.min(override.value, cfg.hardSegueOverrideCeiling);
  const raw = override?.kind === "boost" ? score * override.value : score;
  return Math.min(raw, cfg.hardSegueOverrideCeiling);
}

/** Informational only — reports how much recency decay shaped an observed edge's weight (`weightedCount / count`); never itself multiplied into `score` (decay is already baked into `transitionProb` via `edgeWeight`'s toggle). Neutral 1.0 when the toggle is off or no edge is observed. */
function decayInfoFactor(A: number, B: number, index: MatrixIndex, toggles: SignalToggles): number {
  if (!toggles.decay) return 1;
  const edges = index.edgesFrom.get(A) ?? [];
  const edge = edges.find((e) => e.to === B);
  if (!edge || edge.count <= 0) return 1;
  return edge.weightedCount / edge.count;
}

/** Fixed evaluation-priority order for the tie-break inside `dominantBackoffTier` — first strict-max wins so the choice is deterministic even when multiple tiers land on the exact same contribution (e.g. all-zero). */
const BACKOFF_TIER_PRIORITY: BackoffTier[] = ["transition", "tuning", "albumEra", "basePlayRate"];

/** D-06/D-02: which tier contributed the most weighted mass to `baseFactor(A,B)` — part of the rich per-candidate breakdown and the input to `buildReason`'s backoff-tier label. */
function dominantBackoffTier(
  A: number,
  B: number,
  index: MatrixIndex,
  cfg: ScoringConfig,
  toggles: SignalToggles,
): BackoffTier {
  const weights = effectiveBackoffWeights(cfg, toggles);
  const contributions: Record<BackoffTier, number> = {
    transition: weights.w1 * transitionProb(A, B, index, cfg, toggles),
    tuning: weights.w2 * tuningAffinity(A, B, index, toggles),
    albumEra: weights.w3 * albumEraAffinity(A, B, index),
    basePlayRate: weights.w4 * basePlayRate(B, index),
  };
  let best = BACKOFF_TIER_PRIORITY[0];
  for (const tier of BACKOFF_TIER_PRIORITY.slice(1)) {
    if (contributions[tier] > contributions[best]) best = tier;
  }
  return best;
}

/**
 * D-06: concrete, count-backed reason string. A gated (`pin`) hard segue
 * reads like "notated segue 14/15 times since 2024" (M4/D-06, using the
 * edge's own `segueCount`/`totalExits(A)`/`firstDate` — never a vague
 * label). An observed non-gated edge reads like "seen 8× since 2024"; an
 * unobserved pair reads as which backoff tier carried it, e.g. "backoff:
 * base play rate" (powers the future Show Mode per-orb "why", SHOW-10).
 */
function buildReason(
  A: number,
  B: number,
  index: MatrixIndex,
  tier: BackoffTier,
  segueOverride: SegueOverride | null,
): string {
  const edges = index.edgesFrom.get(A) ?? [];
  const edge = edges.find((e) => e.to === B);
  if (segueOverride?.kind === "pin" && edge) {
    const exits = totalExits(A, index);
    const year = edge.firstDate.slice(0, 4);
    return `notated segue ${edge.segueCount}/${exits} times since ${year}`;
  }
  if (edge && edge.count > 0) {
    const year = edge.firstDate.slice(0, 4);
    return `seen ${edge.count}× since ${year}`;
  }
  switch (tier) {
    case "transition":
      return "backoff: transition frequency";
    case "tuning":
      return "backoff: tuning-family affinity";
    case "albumEra":
      return "backoff: era affinity";
    case "basePlayRate":
      return "backoff: base play rate";
  }
}

/**
 * D-01 (Pattern 2): the multiplicative pipeline for one `A→B` candidate —
 * `base * rotation * alreadyPlayed * eraPrior`, then a consistency-gated
 * hard-segue override/boost (`applyOverride`) applied on top. Every
 * downstream stage is independently toggle-gated (D-14) so per-signal
 * ablation stays a pure flag-flip.
 */
export function scoreCandidate(
  A: number,
  B: number,
  index: MatrixIndex,
  cfg: ScoringConfig,
  toggles: SignalToggles,
  ctx: ShowContext,
): PredictionCandidate {
  const base = baseFactor(A, B, index, cfg, toggles);
  const rotationFactor = toggles.rotation ? rotationSuppression(B, ctx, cfg) : 1;
  const alreadyPlayedFactorValue = toggles.alreadyPlayed ? alreadyPlayedFactor(B, ctx, cfg) : 1;
  const eraPriorFactor = toggles.eraPrior ? eraPrior(B, index, cfg) : 1;
  const segueOverride = toggles.hardSegue ? hardSegueOverride(A, B, index, cfg) : null;

  const multiplied = base * rotationFactor * alreadyPlayedFactorValue * eraPriorFactor;
  const score = applyOverride(multiplied, segueOverride, cfg);

  const tier = dominantBackoffTier(A, B, index, cfg, toggles);
  const node = index.nodeById.get(B);

  const factors: PredictionFactors = {
    transitionProb: transitionProb(A, B, index, cfg, toggles),
    decay: decayInfoFactor(A, B, index, toggles),
    rotation: rotationFactor,
    alreadyPlayed: alreadyPlayedFactorValue,
    eraPrior: eraPriorFactor,
    backoffTier: tier,
    // D-04: only a GATED (pin) override counts as "hard segue" — a boosted
    // one-off/inconsistent segue is a strong multiplier, not the flag.
    hardSegueFlag: segueOverride?.kind === "pin",
  };

  return {
    songId: B,
    songName: node?.songName ?? "",
    score,
    factors,
    reason: buildReason(A, B, index, tier, segueOverride),
  };
}

/**
 * `predict(matrix, context, cfg, toggles) -> PredictionCandidate[]` — the
 * entrypoint. Scores every song in the candidate universe `C` (all
 * non-placeholder `MatrixNode`s the frozen matrix already carries — 264
 * songs is trivial to rank fully, M7), sorts by `score` desc with a
 * deterministic tie-break (`playCount` desc, then `songId` asc — Pitfall
 * 2), and returns the top `cfg.candidateListSize`.
 */
export function predict(
  matrix: TransitionMatrix,
  context: ShowContext,
  cfg: ScoringConfig = config,
  toggles: SignalToggles = defaultSignalToggles,
): PredictionCandidate[] {
  const index = buildMatrixIndex(matrix);
  const candidates = [...index.nodeById.values()].map((node) =>
    scoreCandidate(context.currentSongId, node.songId, index, cfg, toggles, context),
  );

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const playA = index.nodeById.get(a.songId)?.playCount ?? 0;
    const playB = index.nodeById.get(b.songId)?.playCount ?? 0;
    if (playB !== playA) return playB - playA;
    return a.songId - b.songId;
  });

  return candidates.slice(0, cfg.candidateListSize);
}
