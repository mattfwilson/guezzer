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
} as const;
