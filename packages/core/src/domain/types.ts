/**
 * Clean domain model for normalized KGLW show data — the anti-corruption
 * boundary output. ZERO raw API field names appear here (no `showdate`,
 * `songname`, `setnumber`-as-a-verbatim-key-name-elsewhere, `venuename`,
 * etc.) — every field is renamed to a project-owned vocabulary so that
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
 * setNumber typed as `string` this plan ("1" | "2" | "3" | "e" observed so
 * far) — tightened to a locked union after the full-corpus census resolves
 * the vocabulary (plan 01-04, D-11).
 */
export interface SetSection {
  setNumber: string;
  performances: Performance[];
}

export interface Venue {
  venueId: number;
  name: string;
  city: string;
  state: string;
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
