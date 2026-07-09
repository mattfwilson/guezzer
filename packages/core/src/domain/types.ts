/**
 * Clean domain model for normalized KGLW show data — the anti-corruption
 * boundary output. ZERO raw kglw.net API field names appear here as key
 * names — every field is renamed to a project-owned vocabulary so that
 * downstream code (Phase 2 matrix builder, UI) never has to know the shape
 * of the kglw.net API. See docs/SCHEMA.md for the raw shape this is derived
 * from, and packages/core/src/ingest/normalize.ts for the derivation.
 *
 * Union type (not enum) per erasableSyntaxOnly (CLAUDE.md / tsconfig).
 */
export type TransitionKind = "none" | "segue" | "terminal";

/**
 * A single song occurrence within a show, in its set. Positions are
 * 1-indexed and contiguous within a show (see normalize.ts contiguity
 * assertion) — NOT scoped per-set, but global to the show as received from
 * the API (docs/SCHEMA.md §3).
 */
export interface Performance {
  songId: number;
  songName: string;
  slug: string;
  position: number;
  /** Derived from the raw transition_id — never used to determine set/show structure (docs/SCHEMA.md §4). */
  transitionKind: TransitionKind;
  /** Raw transition_id retained as provenance for debugging/census work — not used for structural decisions. */
  transitionId: number;
  isCover: boolean;
  originalArtist: string | null;
  /** True for the "Unknown" sentinel occurrence (docs/SCHEMA.md §6) — occupies a position slot but is not a real catalog song. */
  isPlaceholder: boolean;
  /** Parsed footnotes array when the guarded JSON.parse succeeds; null otherwise (see parseFootnotesGuarded). */
  footnotesParsed: string[] | null;
  /** Verbatim raw footnotes string when parsing fails or is inapplicable; null when parsing succeeded or footnotes was absent. */
  footnotesRaw: string | null;
  /** Plain display footnote string (never JSON-wrapped) — carried verbatim, untrusted content (docs/SCHEMA.md §12). */
  footnote: string;
}

/**
 * Locked to the full-corpus census vocabulary (plan 01-04, D-11) — no
 * other value exists anywhere in 2010-2026 (docs/SCHEMA.md §13a;
 * packages/core/src/ingest/api-types.ts `setnumberLocked`). Hand-authored
 * literal union (not zod-derived) to keep the domain layer free of
 * ingest-layer schema imports — the same convention `TransitionKind` above
 * already follows.
 */
export type SetNumber = "1" | "2" | "e";

export interface SetSection {
  setNumber: SetNumber;
  performances: Performance[];
}

export interface Venue {
  venueId: number;
  name: string;
  city: string;
  /** Null for venues outside a state/province system (e.g. some international shows) — verified in the full corpus (plan 01-03 Task 2), not present in the Phase-1-planning samples. */
  state: string | null;
  country: string;
}

export interface NormalizedShow {
  showId: number;
  date: string;
  showOrder: number;
  year: number;
  venue: Venue;
  tourId: number;
  tourName: string;
  sets: SetSection[];
}

/**
 * The D-08 header — the first frozen contract in the system. Phase 2's
 * sole input. `schemaVersion` is bumped only on breaking shape changes;
 * consumers check it before reading `shows`.
 */
export interface NormalizedCorpus {
  schemaVersion: 1;
  generatedAt: string;
  latestShowDate: string;
  showCount: number;
  songCount: number;
  shows: NormalizedShow[];
}

// --- Phase 2: transition matrix, model & backtest domain vocabulary ---
// Interface-first (CONTEXT.md D-16/Claude's Discretion): every new type for
// the whole phase is defined here even though only the matrix-related ones
// are consumed by plan 02-01. String-literal unions, never enums, per
// erasableSyntaxOnly (matches the TransitionKind/SetNumber convention
// above).
import type { TuningFamily } from "../ingest/tuning-tags.ts";

/**
 * One catalog song as it appears in the frozen TransitionMatrix (D-08).
 * `eraPlayCount` is baked in at build time (plays within the trailing
 * `config.eraWindowShows` shows before the matrix's `asOfDate`) so the
 * predictor's era-prior signal (MODL-07) stays a pure read — never
 * recomputed at scoring time, and never leak-unsafe in the backtest.
 */
export interface MatrixNode {
  songId: number;
  songName: string;
  playCount: number;
  eraPlayCount: number;
  tuningFamily: TuningFamily;
}

/**
 * One directed within-set transition edge (D-07 boundary exclusion — never
 * a set-boundary or encore adjacency). `count` is the raw observed
 * instance count; `weightedCount` is the recency-decayed sum (D-10, MODL-04).
 * `segueCount` is accumulated on the edge's FROM side — `A.transitionKind
 * === "segue"` is A's OUT-transition into B, never B's in-transition
 * (Pitfall 1 / RESEARCH "Segue direction"). `firstDate`/`lastDate` feed the
 * hard-segue "reason" string (D-06, M4) and future constellation edge
 * labels (Phase 7).
 */
export interface MatrixEdge {
  from: number;
  to: number;
  count: number;
  weightedCount: number;
  segueCount: number;
  firstDate: string;
  lastDate: string;
}

/**
 * The D-08/D-10 frozen artifact header — the second frozen contract in the
 * system (mirrors `NormalizedCorpus` above). `schemaVersion` is bumped only
 * on breaking shape changes. Consumed by BOTH the predictor (Phase 4) and
 * the constellation renderer (Phase 7) — one artifact, one pipeline
 * (CLAUDE.md constraint).
 */
export interface TransitionMatrix {
  schemaVersion: 1;
  generatedAt: string;
  asOfDate: string;
  showCount: number;
  nodeCount: number;
  edgeCount: number;
  nodes: MatrixNode[];
  edges: MatrixEdge[];
}

/**
 * D-09 refined by RESEARCH M5: an exclusive `(date, showOrder)` tuple bound
 * for walk-forward matrix construction — a `date`-only cutoff would leak a
 * same-date-but-later show (Pitfall 3). `inclusive: true` is used for the
 * shipped artifact's cutoff = latest show; the backtest always builds with
 * `inclusive: false` against the held-out show's own `(date, showOrder)`.
 */
export interface AsOfBound {
  date: string;
  showOrder: number;
  inclusive: boolean;
}

/** D-02: which backoff tier's value ultimately backed a candidate's base factor — part of the D-06 rich per-candidate breakdown. */
export type BackoffTier = "transition" | "tuning" | "albumEra" | "basePlayRate";

/** D-06: the individually-inspectable factors composing a PredictionCandidate's final score — one field per D-01 pipeline stage. */
export interface PredictionFactors {
  transitionProb: number;
  decay: number;
  rotation: number;
  alreadyPlayed: number;
  eraPrior: number;
  backoffTier: BackoffTier;
  hardSegueFlag: boolean;
}

/**
 * D-06: a single ranked next-song prediction with a rich, self-explaining
 * breakdown — not just `{songId, score}`. Powers ablation/debugging this
 * phase and the Show Mode per-orb "why" (SHOW-10) / Explore debugger
 * (EXPL-02) later at no rework.
 */
export interface PredictionCandidate {
  songId: number;
  songName: string;
  score: number;
  factors: PredictionFactors;
  reason: string;
}

/**
 * The in-progress show state the predictor conditions on: the current song,
 * the already-played trail so far this show (D-05 already-played signal),
 * and the song sets of the last N shows of the current tour (MODL-06
 * rotation-suppression window).
 */
export interface ShowContext {
  currentSongId: number;
  trail: number[];
  recentShowSongSets: number[][];
}

/**
 * D-01/D-14: per-signal ablation toggles. All default `true`; the backtest
 * flips exactly one `false` per ablation run so every variant shares one
 * scoring code path (RESEARCH Pattern 2) rather than a forked
 * implementation.
 */
export interface SignalToggles {
  decay: boolean;
  rotation: boolean;
  alreadyPlayed: boolean;
  eraPrior: boolean;
  hardSegue: boolean;
  tuning: boolean;
  albumEra: boolean;
}

/** D-13: top-1/5/10 hit-rate counts for one evaluation split (overall, hard-segue, or free-choice). */
export interface BacktestSplit {
  n: number;
  top1: number;
  top5: number;
  top10: number;
}

/** D-14: one leave-one-signal-out ablation variant's hit rates plus its delta vs. the full model — report-only, no automated go/no-go gate in Phase 2. */
export interface AblationEntry {
  signal: string;
  overall: BacktestSplit;
  hardSegue: BacktestSplit;
  freeChoice: BacktestSplit;
  deltaVsFull: { top1: number; top5: number; top10: number };
}

/**
 * D-12/D-13/D-15: the paired-.md+.json backtest report payload. Holdout is
 * the most recent complete tour (never `max(tourId)` — tourId is not
 * chronologically monotonic, Pitfall 3); evaluation is walk-forward within
 * that tour.
 */
export interface BacktestResult {
  schemaVersion: 1;
  generatedAt: string;
  holdoutTourId: number;
  holdoutTourName: string;
  holdoutShowCount: number;
  evalTransitionCount: number;
  overall: BacktestSplit;
  hardSegue: BacktestSplit;
  freeChoice: BacktestSplit;
  ablation: AblationEntry[];
}
