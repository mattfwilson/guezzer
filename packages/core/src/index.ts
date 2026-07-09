/**
 * Public API barrel for @guezzer/core. Raw kglw.net API schema types are
 * deliberately NOT re-exported here — they stay behind the ingestion
 * anti-corruption boundary; internal ingestion modules import them
 * directly. Downstream consumers (Phase 2 matrix builder, app) only ever
 * see the clean domain model + the pure normalizer.
 */
export type {
  NormalizedCorpus,
  NormalizedShow,
  Performance,
  SetSection,
  TransitionKind,
  Venue,
} from "./domain/types.ts";

/**
 * Phase 2 domain vocabulary (transition matrix, prediction, backtest).
 * Interface-first (D-16 / Claude's Discretion) — most of these types are
 * consumed by later plans in this phase, not yet by any pure fn exported
 * below.
 */
export type {
  AblationEntry,
  AsOfBound,
  BackoffTier,
  BacktestResult,
  BacktestSplit,
  MatrixEdge,
  MatrixNode,
  PredictionCandidate,
  PredictionFactors,
  ShowContext,
  SignalToggles,
  TransitionMatrix,
} from "./domain/types.ts";

export {
  normalizeCorpus,
  parseFootnotesGuarded,
  type NormalizeOptions,
  type NormalizeResult,
  type NormalizeStats,
} from "./ingest/normalize.ts";

/**
 * Tuning-family tagging (DATA-04, D-01..D-04). Phase 2's backoff tier
 * consumes `TuningFamily`/`TuningTagEntry` values from data/tuning-tags.json.
 */
export {
  deriveCatalogFromCorpus,
  generateTuningTags,
  mergeTuningTags,
  tuningFamilyValues,
  tuningTagEntrySchema,
  tuningTagsFileSchema,
  type CatalogSong,
  type MergeTuningTagsResult,
  type TuningFamily,
  type TuningTagEntry,
  type TuningTagsFile,
} from "./ingest/tuning-tags.ts";

/**
 * Phase 2 pure functions: matrix construction (D-08), the decay helper it
 * depends on, and the predictor's in-memory successor index. CLI internals
 * (cli/build-model.ts) stay behind the boundary — never exported here.
 */
export { buildMatrix, type BuildMatrixOptions } from "./model/matrix.ts";
export { decayedWeight } from "./model/decay.ts";
export { buildMatrixIndex, type MatrixIndex } from "./model/index-build.ts";

/**
 * D-02/D-01/D-06 predictor (Phase 2 plan 02-02). `scoreCandidate` and the
 * individual backoff-tier fns are exported for ablation/debugging (Plan 03
 * backtest, Explore Mode debugger EXPL-02 later) — `predict` is the primary
 * entrypoint downstream consumers use.
 */
export {
  albumEraAffinity,
  baseFactor,
  basePlayRate,
  defaultSignalToggles,
  predict,
  scoreCandidate,
  transitionProb,
  tuningAffinity,
  type ScoringConfig,
} from "./model/predict.ts";

/**
 * D-12 walk-forward backtest holdout identification (Phase 2 plan 02-04).
 * `findHoldoutShows` identifies the most-recent complete tour (never
 * `max(tourId)` -- Pitfall 3). `runBacktest` (Task 2, same plan) is added
 * to this barrel once `eval/backtest.ts` exists.
 */
export { findHoldoutShows } from "./eval/holdout.ts";
