/**
 * Single source of truth for every pipeline constant (CLAUDE.md: "All model
 * constants ... in a single config file — no scattered magic numbers").
 *
 * No other file under packages/core/src should hardcode a numeric literal
 * for delay/timeout/year bounds, or a string literal for the API base URL,
 * User-Agent, sentinel song IDs, or settype allowlist.
 */
export const config = {
  /** kglw.net API v2 base URL. No auth. Source: PROJECT.md Context / ARCHITECTURE.md Part 1. */
  apiBase: "https://kglw.net/api/v2",

  /**
   * SYNC-01 / D-06 (Phase 5): the ONLY endpoint the live poller touches. The
   * lightweight `latest` endpoint returns the single most-recent show's rows,
   * updated live by editors — never poll the bulk `setlists` table from a
   * client device (API etiquette, CLAUDE.md). The ≤1/60s cadence + active-show
   * gate is enforced by the app hook (plan 05-04), not here.
   */
  latestPath: "/latest.json",

  /** D-07: strictly sequential fetch pacing — courtesy delay between requests. */
  fetchDelayMs: 2000,

  /** D-07: fetch abort timeout per request. */
  fetchTimeoutMs: 30_000,

  /** D-07: descriptive User-Agent naming the project and owner contact. */
  userAgent: "Guezzer setlist tool (matt.f.wilson@gmail.com)",

  /** Earliest year the historical corpus fetch probes. */
  corpusYearStart: 2010,

  /** CLI `--year` argument bounds (security V5 — validate before URL/path construction). */
  cliYearMin: 2010,
  cliYearMax: 2100,

  /**
   * D-16 corpus-scope exclusion allowlist. CONFIRMED FINAL by the plan
   * 01-03 Task 3 full-corpus census (data/census-report.md, 2010-2026,
   * 10,210 rows): the only settype values in the entire corpus are "Set"
   * (9,562 rows/696 shows), "One Set" (210 rows/42 shows), and "Live
   * Session" (86 rows/19 shows, all excluded radio sessions per D-16). No
   * other variant exists anywhere. See docs/SCHEMA.md §13d.
   */
  settypeAllowlist: ["Set", "One Set"],

  /**
   * Pitfall 7 / docs/SCHEMA.md §6: song_id 1 ("Unknown", slug "_custom_") is
   * a placeholder sentinel, never a real catalog song — excluded from the
   * song catalog and from transition-edge emission.
   */
  sentinelSongIds: [1],

  /** Pitfall 3: a fetched year with more rows than this is almost certainly a silent-filter-ignore poisoning (Pitfall 3 / docs/SCHEMA.md §9). */
  maxRowsPerYearSanity: 5000,

  /** ARCHITECTURE.md Part 1.9 / docs/SCHEMA.md §11: tour_id 1 = "Not Part of a Tour" sentinel — one-off shows, never a real tour to group by. Used by the census's tour_id sentinel-usage bucketing. */
  tourIdSentinel: 1,

  /** Committed raw per-year API snapshots (D-05/D-06). */
  dataRawDir: "data/raw",

  /** Committed real API response samples used as fixtures (this plan). */
  dataSamplesDir: "data/samples",

  /** Normalized artifact output directory (D-08). */
  dataNormalizedDir: "data/normalized",

  /** The versioned normalized corpus artifact — Phase 2's sole input (D-08). */
  corpusArtifactPath: "data/normalized/corpus.json",

  /** Human-readable census report (D-10). */
  censusReportPath: "data/census-report.md",

  /** Machine-readable census output, paired with censusReportPath (D-10). */
  censusJsonPath: "data/census.json",

  /** Owner-editable tuning-family tagging file (D-01..D-04). */
  tuningTagsPath: "data/tuning-tags.json",

  /**
   * A1 seed (01-RESEARCH.md Assumption A1): the three microtonal-tuned
   * studio albums — dedicated quarter-tone guitars, per PROJECT.md Context.
   * Verified present verbatim in data/raw/albums.json's artist_id === 1
   * rows. This is a starting default, not authoritative — the owner
   * corrects any misclassification via tuning-tags.json's `needsReview`
   * flow (D-02); `cs-standard` is never auto-assigned from this list.
   */
  microtonalAlbums: ["Flying Microtonal Banana", "K.G.", "L.W."],

  // --- Phase 2: transition matrix, model & backtest (D-16 / MODL-11) ---
  // Every constant below is [ASSUMED] — a starting default seeded from
  // 02-RESEARCH.md M1-M8, not authoritative. The backtest (run-backtest CLI,
  // later plans in this phase) is the mechanism that justifies or overrides
  // each value; nothing here is a claim of optimality.

  /** D-08: the frozen TransitionMatrix artifact — Phase 2's primary output, sibling of corpusArtifactPath. */
  matrixArtifactPath: "data/normalized/transition-matrix.json",

  /** D-15: human-readable backtest report, mirrors censusReportPath. */
  backtestReportPath: "data/backtest-report.md",

  /** D-15: machine-readable backtest output, paired with backtestReportPath, mirrors censusJsonPath. */
  backtestJsonPath: "data/backtest.json",

  /**
   * [ASSUMED] M2/A2 (02-RESEARCH.md): exponential recency-decay half-life in
   * days, measured relative to the matrix's own as-of cutoff (never
   * wall-clock now, D-10). 365 days makes a transition exactly one year
   * before cutoff contribute weight 0.5 — current + previous tour dominate
   * (MODL-04) while the deep catalog keeps a faint nonzero voice. Tunable
   * via backtest.
   */
  decayHalfLifeDays: 365,

  /** Round weightedCount to a fixed precision before serialization — float-summation-order determinism (RESEARCH Pitfall 2). */
  weightedCountPrecision: 1e9,

  /** [ASSUMED] M1 (02-RESEARCH.md): additive Lidstone/add-alpha floor inside backoff tier t1 (transitionProb numerator). 0.0 — interpolation (D-02) already supplies the nonzero floor via t4; exposed as a backtest knob. */
  transitionAddAlpha: 0.0,

  /**
   * [ASSUMED] M1/A1 (02-RESEARCH.md), D-02: Jelinek-Mercer interpolation
   * weights for the 4-tier backoff blend (transitionProb, tuningAffinity,
   * albumEraAffinity, basePlayRate). Must sum to 1.0 — verified by a config
   * test. When a tier is ablated off (D-14), remaining weights are
   * re-normalized to sum to 1 at scoring time.
   */
  backoffWeights: { w1: 0.6, w2: 0.2, w3: 0.15, w4: 0.05 },

  /** [ASSUMED] M3/A4 (02-RESEARCH.md), MODL-06: number of most-recent shows in the current tour that feed rotation suppression. */
  rotationWindowShows: 3,

  /** [ASSUMED] M3/A4 (02-RESEARCH.md), MODL-06: per-show multiplicative penalty applied for each of the last rotationWindowShows shows a candidate was played in — e.g. played all 3 recent nights scores this value cubed. Never a hard zero. */
  rotationPenaltyPerShow: 0.5,

  /** [ASSUMED] M3/A3 (02-RESEARCH.md), D-05: near-zero (not zero) multiplier applied once per candidate already present in the in-progress show's trail — sandwich/reprise-aware (MODL-10). */
  alreadyPlayedFactor: 0.02,

  /** [ASSUMED] M4/A5 (02-RESEARCH.md), D-04: minimum segueRate(A→B) = segueCount/totalExits(A) required to qualify a pair for the hard-segue override gate. */
  hardSegueConsistencyThreshold: 0.7,

  /** [ASSUMED] M4/A5 (02-RESEARCH.md), D-04: minimum totalExits(A) required alongside hardSegueConsistencyThreshold — prevents a single 1/1 instance from pinning false certainty. */
  hardSegueMinSupport: 3,

  /** [ASSUMED] M4/A5 (02-RESEARCH.md), D-04: near-1.0 (never literally 1.0) score ceiling applied when a pair passes the hard-segue consistency gate — only notated hard segues approach 100%. */
  hardSegueOverrideCeiling: 0.97,

  /** [ASSUMED] M4/A5 (02-RESEARCH.md), D-04: multiplicative boost (not an override) applied to inconsistent/one-off segue pairs that fail the consistency gate. */
  hardSegueBoost: 3.0,

  /** [ASSUMED] M8/A6 (02-RESEARCH.md), MODL-07: trailing window (in shows, before the as-of cutoff) defining "current era" for the eraPrior relative-marginal multiplier. */
  eraWindowShows: 40,

  /** [ASSUMED] M8/A6 (02-RESEARCH.md), MODL-07: additive smoothing constant for the era-rate / all-time-rate ratio underlying eraPrior, avoiding divide-by-near-zero on sparse songs. */
  eraPriorSmoothingK: 1,

  /** [ASSUMED] M8/A6 (02-RESEARCH.md), MODL-07: lower clamp bound for the eraPrior relative multiplier (retired-song floor). */
  eraPriorFloor: 0.3,

  /** [ASSUMED] M8/A6 (02-RESEARCH.md), MODL-07: upper clamp bound for the eraPrior relative multiplier (current-rotation ceiling). */
  eraPriorCeil: 2.0,

  /** [ASSUMED] M7/A7 (02-RESEARCH.md): number of ranked candidates the predictor returns. Must be >= 10 for the backtest's top-10 metric (EVAL-01); Phase 4 UI shows only the top 5-8. */
  candidateListSize: 15,

  // --- Phase 4: Show Mode catalog search (SHOW-04) ---
  // Tunables for the fuse.js-backed searchCatalog (search/search-catalog.ts).
  // A1 (04-RESEARCH.md): starting defaults for drunk-thumb typo tolerance over
  // the 264-song catalog — swappable/tunable per CLAUDE.md, never a hard claim.
  search: {
    /**
     * [ASSUMED] A1 (04-RESEARCH.md): fuse.js fuzzy-match threshold. 0.0 = exact
     * only, 1.0 = match anything. 0.4 tolerates a one-character typo for
     * one-thumb-in-the-dark entry without dumping the whole catalog on a
     * near-miss. Tune if real-world match quality disappoints.
     */
    threshold: 0.4,

    /**
     * [ASSUMED] A1 (04-RESEARCH.md): fuse.js `distance` — how far into a string
     * a match may drift before scoring degrades. Paired with `ignoreLocation`
     * at the call site so position within the song name is not penalized.
     */
    distance: 100,
  },

  // --- Phase 6: Pokédex, History & Stats (D-04 / D-15) ---
  // All Phase-6 tunables live here (CLAUDE.md single-config-file constraint).
  // Tuning values are [ASSUMED] — starting defaults per 06-UI-SPEC §Config /
  // 06-RESEARCH A5, surfaced at the end-of-phase human-verify gate, not claims
  // of optimality. `cardAlbumUrls` is the ONE home for the D-04 card-album
  // allowlist — no allowlist ever lives in derivation code (dex/albums.ts).
  dex: {
    /**
     * [ASSUMED] A5 (06-RESEARCH.md), D-15: corpus play-rate quantile cut-points
     * for the game-style rarity tiers. A song in the bottom `legendary` fraction
     * of catalog play-rate is Legendary; below `rare` is Rare; below `uncommon`
     * is Uncommon; `>= uncommon` (i.e. ≥0.50) is Common. Tunable — the build
     * prints the tier histogram so the distribution can be eyeballed.
     */
    RARITY_QUANTILES: { legendary: 0.05, rare: 0.2, uncommon: 0.5 },

    /**
     * [ASSUMED] D-15, RESEARCH Pitfall 12: a played song with fewer than this
     * many corpus plays caps at Rare — guards the "fake Legendary" a
     * single-play-in-2011 song would otherwise earn (epistemically garbage on a
     * tiny sample).
     */
    RARITY_MIN_PLAYS: 3,

    /**
     * D-17 (plan 06-07): max length of the export-envelope `owner` identity
     * field. An ASVS V5 length clamp on an untrusted, friend-file-crossing
     * string — the schema hard-rejects an over-length owner before any merge,
     * and the Settings input mirrors this as a `maxLength` attribute. 40 chars
     * comfortably fits a display name for the ≤10-friend fork-key use (SHAR-01).
     */
    OWNER_NAME_MAX_LENGTH: 40,

    /** The compact offline show archive artifact (DEX-02 substrate) — sibling of matrixArtifactPath. */
    archiveArtifactPath: "data/normalized/archive.json",

    /** The album-shelf mapping artifact (D-04) — cards + Covers/Miscellaneous buckets. */
    dexAlbumsArtifactPath: "data/normalized/dex-albums.json",

    /**
     * [ASSUMED] fuse.js tunables for the archive date/venue/city search
     * (plan 06-08). Seeded from `config.search` as starting points — the
     * archive corpus (738 shows) is a different search surface than the song
     * catalog, so these are separated to tune independently.
     */
    archiveSearch: {
      threshold: 0.4,
      distance: 100,
    },

    /**
     * [ASSUMED] A4 (06-RESEARCH.md), D-04: the canonical studio-discography
     * "shelf" — card membership is by `album_url` (NEVER title: duplicates and
     * trailing-space collisions verified, Pitfall 3). D-04's `islive=0` +
     * earliest-release-date heuristic operates WITHIN this allowlist (defeating
     * Pitfalls 1-2: recent official live albums carry `islive:0`; singles
     * predate the LPs that carry their songs). Every entry verified present in
     * data/raw/albums.json (drift-guard test). Pins `/albums/fishing-for-fishies`
     * NOT the `-video` duplicate (Open Question 4). Excludes demos, singles,
     * promos, and every "Live in/at ..." title. ~29 entries — cosmetic and
     * config-editable, surfaced at the phase human-verify gate.
     */
    cardAlbumUrls: [
      "/albums/12-bar-bruise",
      "/albums/eyes-like-the-sky",
      "/albums/float-along-fill-your-lungs",
      "/albums/oddments",
      "/albums/im-in-your-mind-fuzz",
      "/albums/quarters",
      "/albums/paper-mache-dream-balloon",
      "/albums/nonagon-infinity",
      "/albums/flying-microtonal-banana",
      "/albums/murder-of-the-universe",
      "/albums/sketches-of-brunswick-east",
      "/albums/polygondwanaland",
      "/albums/gumboot-soup",
      "/albums/fishing-for-fishies",
      "/albums/infest-the-rats-nest",
      "/albums/kg",
      "/albums/lw",
      "/albums/butterfly-3000",
      "/albums/made-in-timeland",
      "/albums/omnium-gatherum",
      "/albums/ice-death-planets-lungs-mushrooms-and-lava",
      "/albums/laminated-denim",
      "/albums/changes",
      "/albums/petrodragonic-apocalypse",
      "/albums/the-silver-cord",
      "/albums/flight-b741",
      "/albums/phantom-island",
      "/albums/willoughbys-beach",
      "/albums/teenage-gizzard",
    ],
  },

  // --- Phase 7: Explore Mode constellation — pure-derivation constants ---
  // Data-driven defaults (D-06/D-07) measured against the shipped artifacts
  // (07-RESEARCH §Data-Driven Defaults, recomputed 2026-07-16). Unlike the
  // [ASSUMED] Phase-2 model knobs, these are [VERIFIED] against real corpus
  // density — re-run the measurement if the corpus is refreshed. Derivation
  // constants live in CORE (this file); rendering constants live app-side.
  explore: {
    /**
     * [VERIFIED] D-05/D-06 (07-RESEARCH §Data-Driven Defaults): last-N-shows
     * rotation window. Distinct songs in the last N shows of archive.json:
     * N=4→40, N=5→56, N=6→71, N=7→84 (breaches the ~40–80 readable band).
     * N=5 lands mid-band at 56 nodes and reads naturally ("the last five
     * shows" ≈ the current tour leg). Config-only — no UI slider (D-12).
     */
    ROTATION_WINDOW_SHOWS: 5,

    /**
     * [VERIFIED] D-07 (07-RESEARCH §Data-Driven Defaults): edge slider default
     * ("played together ≥ X times"). 1,946 of 2,987 corpus edges (65%) are
     * one-play edges — exactly the misleading 100%-from-one-play class D-07
     * exists to kill. Threshold ≥2 removes all of them by construction,
     * leaving a legible 56-node / 174-edge default sky within the N=5
     * rotation subgraph (≥3 would thin it to 103 edges).
     */
    EDGE_COUNT_THRESHOLD_DEFAULT: 2,

    /**
     * [VERIFIED] D-07: edge slider lower bound (count ≥ X). Minimum 1 restores
     * the full truth — every observed transition — for whoever wants it.
     */
    EDGE_SLIDER_MIN: 1,

    /**
     * [VERIFIED] D-07: edge slider upper bound. Max observed count is 224, but
     * ≥10 already thins to 133 edges catalog-wide — deeper cuts add nothing
     * legible, so the slider caps at 10.
     */
    EDGE_SLIDER_MAX: 10,

    /**
     * [VERIFIED] D-04: ranked outgoing bars shown before the "Show all N"
     * expander. rankOutgoing returns the COMPLETE history; the app slices to
     * this top-N for the initial sheet view.
     */
    BARS_TOP_N: 10,
  },
} as const;
