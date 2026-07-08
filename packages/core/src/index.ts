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
