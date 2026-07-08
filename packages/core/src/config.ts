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

  // Microtonal album seed map for the tuning-tags generator — filled in
  // plan 01-05 (DATA-04). Left as a placeholder here so config.ts remains
  // the single file every later plan extends, never a second config module.
} as const;
