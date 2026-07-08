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

export {
  normalizeCorpus,
  parseFootnotesGuarded,
  type NormalizeOptions,
  type NormalizeResult,
  type NormalizeStats,
} from "./ingest/normalize.ts";
