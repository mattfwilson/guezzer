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
 * D-12/D-13 walk-forward backtest (Phase 2 plan 02-04). `findHoldoutShows`
 * identifies the most-recent complete tour (never `max(tourId)` -- Pitfall
 * 3); `runBacktest` rebuilds a leak-free matrix as-of each held-out show
 * and reports top-1/5/10 hit rates overall and split by hard-segue vs
 * free-choice.
 */
export { findHoldoutShows } from "./eval/holdout.ts";
export { runBacktest } from "./eval/backtest.ts";

/**
 * SHOW-04 catalog fuzzy search (Phase 4 plan 04-02). `toCatalog` projects the
 * matrix nodes to the searchable `{ songId, songName }` shape; `makeCatalogSearcher`
 * returns a memoizable `(query) => SearchResult[]` fuse.js searcher. Lives in
 * core (not the app) so the miss path is Node-testable and the fuse.js wrapper
 * stays swappable per CLAUDE.md.
 */
export {
  makeCatalogSearcher,
  toCatalog,
  type CatalogEntry,
  type SearchResult,
} from "./search/search-catalog.ts";

/**
 * Phase 5 live-sync core (plan 05-01). Pure, DOM-free, dependency-injected —
 * the app tier (plan 05-04) owns only the poll lifecycle/timing. `pollLatest`
 * is the tolerant `latest` poller (SYNC-01/D-06); `latestSetlistRow` is its
 * dedicated schema; the suggest/bind functions are pure decision fns.
 */
export { pollLatest, type PollDeps, type PollResult } from "./live/poll-latest.ts";
export {
  detectNovelKeys,
  KNOWN_LATEST_KEYS,
  latestSetlistRow,
  type LatestSetlistRow,
} from "./ingest/latest-types.ts";
export {
  diffLatestAgainstTrail,
  guardLatestRows,
  resolvePlaceholders,
  type Suggestion,
  type FillHint,
  type TonightGuardInput,
  type TrailEntryInput,
} from "./live/suggest.ts";
export {
  bindShowFromLatest,
  type TrackedShowInput,
  type ShowBinding,
} from "./live/bind-show.ts";
/**
 * Run-grouping (plan 11-03, PRED-01/PRED-03). `currentRunShowSets` groups the
 * prior finalized shows into the current run by date gap (`config.runGapDays`),
 * honoring a manual reset boundary (D-04), and yields the `recentShowSongSets`
 * window the already-correct `rotationSuppression` is starved of in live use.
 * Pure, DOM-free; app wiring lands in plan 11-05.
 */
export {
  currentRunShowSets,
  type FinalizedShowInput,
} from "./live/run-grouping.ts";

/**
 * Phase 5 data-safety core (plan 05-02). Pure, DOM-free, dependency-injected —
 * the app tier (plan 05-05) owns only the DOM download/upload and the atomic
 * Dexie write. `exportEnvelope` is the strict D-09 schema; `serializeExport` is
 * the pure export assembler; `parseAndMergeImport` validates→migrates→
 * union-merges→same-show-dedupes entirely in memory, rejecting bad files whole
 * (D-10/D-11/D-12) and never dropping a local row.
 */
export {
  exportEnvelope,
  archiveShowRow,
  type ExportEnvelope,
} from "./data-safety/export-schema.ts";
export { serializeExport, type ExportSnapshot } from "./data-safety/serialize.ts";
export { parseAndMergeImport, type ImportResult } from "./data-safety/merge.ts";

/**
 * Phase 6 dex artifact schemas + types (plan 06-01). The two build-time
 * artifacts — the compact show archive (DEX-02) and the album-shelf mapping
 * (D-04) — are validated through these strict zod schemas by the build CLIs
 * and re-guarded by the app loaders (plan 06-05). Inferred types are shared
 * across the core/app boundary.
 */
export {
  archiveArtifact,
  archiveShowSchema,
  archiveSetSchema,
  albumTrackSchema,
  dexAlbumSchema,
  dexAlbumsArtifact,
  type ArchiveArtifact,
  type ArchiveShow,
  type ArchiveSet,
  type AlbumTrack,
  type DexAlbum,
  type DexAlbumsArtifact,
} from "./dex/archive-types.ts";

/**
 * Phase 6 dex derivation (plan 06-03). `buildRarityIndex`/`showRarityScore`
 * (D-15/STAT-01/STAT-02) are the corpus-honest rarity substrate; `deriveDex`
 * (DEX-03/DEX-04/STAT-03/STAT-04) is the single derivation entry point that
 * yields every dex stat from raw attendance; `deriveRecap` (SHOW-14/D-14)
 * assembles the night's scorecard. All pure, zero I/O, fixture-pinned.
 */
export {
  buildRarityIndex,
  showRarityScore,
  type RarityTier,
  type SongRarity,
  type RarityIndex,
} from "./dex/rarity.ts";
export {
  deriveDex,
  type DexSnapshotInput,
  type SongDexStats,
  type DexStats,
} from "./dex/derive-dex.ts";
export {
  deriveRecap,
  type RecapStats,
  type RecapSet,
  type RecapSetlistRow,
} from "./dex/recap.ts";

/**
 * Phase 6 friend-file compare (plan 06-10, SHAR-01/D-17). `compareDexes` is the
 * pure, read-only DIFF over two derived DexStats — the structural inverse of
 * parseAndMergeImport: same songId identity discipline, but it NEVER merges or
 * writes. Diff lists are songId-only (the view resolves names) and tier-sorted.
 */
export {
  compareDexes,
  type CompareResult,
  type CompareColumn,
} from "./dex/compare.ts";

/**
 * Phase 6 share-card stats (plan 06-11, SHAR-02/D-18/D-19). The pure projection
 * of the dex/recap derivations into the flat, canvas-ready `ShareCardData` the
 * PNG brag card draws — all stat math stays in core so the app draw layer only
 * draws (RESEARCH Pitfall 8). `buildShareStats` yields the LIFETIME collection
 * card; `buildRecapShareStats` (plan 10-02) yields the PER-SHOW recap card from
 * one night's `deriveRecap` output; `buildBingoShareCard` (plan 16-06) yields the
 * PER-CARD Gizz-Bingo trophy from a marked board + its wins. `ShareCardData` is a
 * discriminated union on `scope` ("collection" | "show" | "bingo"). Zero I/O.
 */
export {
  buildShareStats,
  buildRecapShareStats,
  buildBingoShareCard,
  type ShareCardData,
  type CollectionShareCard,
  type ShowShareCard,
  type BingoShareCard,
  type ShareTier,
  type ShareTierRow,
} from "./dex/share-stats.ts";

/**
 * Phase 6 archive search + year browse (plan 06-08). `makeArchiveSearcher` is
 * the memoizable fuse.js searcher over the bundled show archive (date/venue/
 * city, empty query → []); `groupShowsByYear` is the plain newest-first year
 * browse. Pure, DOM-free, config-tuned — the retro-mark ArchiveBrowser's
 * offline search substrate (DEX-02/D-10).
 */
export {
  makeArchiveSearcher,
  groupShowsByYear,
  type ArchiveSearchHit,
} from "./dex/search-archive.ts";

/**
 * Phase 7 Explore constellation core (plan 07-01). Three pure, DOM-free,
 * fixture-tested derivations over the SAME `transition-matrix.json` / `archive`
 * artifacts the predictor and dex already consume (one pipeline, CLAUDE.md):
 * `deriveConstellation` reshapes the matrix into the force-graph `{nodes, links}`
 * (mutation-safe fromId/toId, EXPL-01); `edgesAtThreshold` is the D-08 render-pass
 * edge filter (node population preserved); `topKEdgesPerNode` is the degree-aware
 * declutter sparsifier (each source's K highest-count OUT edges, EXPL-04/EXPL-06);
 * `rankOutgoing` yields a node's complete raw outgoing history — never `predict()`
 * (EXPL-02/D-01..D-04). The renderer (`react-force-graph-2d`) and rotation/dex
 * wiring live app-side.
 */
export {
  deriveConstellation,
  edgesAtThreshold,
  topKEdgesPerNode,
  type ConstellationNode,
  type ConstellationLink,
  type ConstellationData,
} from "./explore/derive-constellation.ts";
export {
  rankOutgoing,
  type OutgoingBar,
  type RankedOutgoing,
} from "./explore/rank-outgoing.ts";
export { rotationSongIds } from "./explore/rotation.ts";

/**
 * Phase 6 online recent-show fallback (plan 06-08). `fetchRecentShows` is the
 * polite, tolerant fetch for POST-corpus shows (mirrors pollLatest's never-throw
 * tier + reuses assertFilterApplied) — returns `{ shows, songs }` where the
 * songs record is the ONLY name source for post-corpus debut songs (D-09,
 * Pitfall 9). Etiquette is a caller contract: user-initiated, session-cached,
 * never retried.
 */
export {
  fetchRecentShows,
  type RecentShowsDeps,
  type RecentShowsResult,
} from "./dex/recent-shows.ts";

/**
 * Pre-opener opener suggestions (QUICK-260718-1no). `deriveTopOpeners` is a pure,
 * recency-weighted ranking of a song's Set-1 openers over the bundled archive —
 * the SearchSheet auto-populates the top N before the opener is logged, the one
 * moment `predict()` cannot help (no current song yet). Recency anchor is passed
 * in (`archive.latestShowDate`), so it stays pure/deterministic (zero Date.now).
 */
export {
  deriveTopOpeners,
  type TopOpener,
  type DeriveTopOpenersOptions,
} from "./dex/openers.ts";

/**
 * Gizz Bingo core (Phase 14, BINGO-03) — the third pure derivation over the
 * trail, alongside the predictor and the dex. A seeded `deal` mints a
 * serializable `BingoCard`; `deriveMarks` is the deterministic consume-once
 * marking fold (live == replay == catch-up by construction); `detectWins` +
 * `expectedFill` are the pure 4×4 win geometry; `buildBingoContext` resolves
 * the shipped matrix/archive/rarity/dex-albums artifacts into the fast lookup
 * bundle the fold and generator read. All DOM/DB-free — the app (Phase 16)
 * adapts its setlist rows to the minimal `MarkTrailEntry` contract (D-22). The
 * calibration CLI stays behind the boundary and is never barrel-exported
 * (matches `run-backtest.ts`).
 */
export { deal } from "./bingo/generate.ts";
export { deriveMarks, type MarkTrailEntry } from "./bingo/mark.ts";
export { detectWins, expectedFill } from "./bingo/wins.ts";
export {
  estimateFill,
  nearMiss,
  type FillEstimate,
  type FillBand,
  type NearMiss,
} from "./bingo/estimate.ts";
export { buildBingoContext, type BingoContext } from "./bingo/context.ts";
export type {
  BingoCard,
  BingoSquareDef,
  MarkedCard,
  MarkedSquare,
  Win,
  BingoVibe,
  BingoEvent,
  BingoWinKind,
} from "./bingo/types.ts";

/**
 * GizzMap core (owner-approved exploration 2026-07-21; GSD bypassed by owner).
 * Four pure slices, all Node-testable: `georef` maps GPS onto the illustrated
 * festival map (control points → mean-centered least-squares affine — global
 * affine is data-justified, piecewise REJECTED; see map/georef.ts header);
 * `presence` is the honest-staleness vocabulary (a stale pin never masquerades
 * as live; `now` always a parameter); `group-crypto` derives the relay token +
 * AES-GCM group key from one shared secret (relay stores only ciphertext);
 * `relay-client` is the pollLatest-style never-throw HTTP tier for the
 * self-owned Worker relay (packages/relay). The app owns all lifecycle/timing.
 */
export {
  solveGeoref,
  projectToPixel,
  pixelToLatLng,
  haversineMeters,
  initialBearingDeg,
  compass8,
  metersPerPixel,
  fitResidualsPx,
  controlPointSchema,
  festivalMapArtifact,
  type GeoPoint,
  type PixelPoint,
  type ControlPoint,
  type GeorefFit,
  type Compass8,
  type FestivalMapArtifact,
} from "./map/georef.ts";
export {
  stalenessTier,
  ageLabel,
  describeOffset,
  shouldPublishBeacon,
  friendBeaconSchema,
  meetPinSchema,
  type FriendBeacon,
  type MeetPin,
  type StalenessTier,
  type GeoOffset,
} from "./map/presence.ts";
export {
  deriveGroupKeys,
  encryptJson,
  decryptJson,
  type EncryptedEnvelope,
  type GroupKeys,
  type GroupCryptoKey,
} from "./map/group-crypto.ts";
export {
  publishBeacon,
  publishPin,
  deletePin,
  fetchGroupState,
  beaconRecordSchema,
  pinRecordSchema,
  groupStateSchema,
  type RelayDeps,
  type BeaconRecord,
  type PinRecord,
  type GroupState,
} from "./map/relay-client.ts";
