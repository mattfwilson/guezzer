/**
 * App-side wrapper for the pre-opener SearchSheet suggestions (QUICK-260718-1no).
 * Bridges the bundled show archive to the pure core `deriveTopOpeners` ranking,
 * mirroring the archive-loader / showContext seam idiom: the derivation stays in
 * core (pure, fixture-tested), this module only sources the artifact + config.
 *
 * The recency anchor is `archive.latestShowDate` (NOT `Date.now()`), keeping the
 * ranking deterministic; the half-life is sourced from core config, never
 * hardcoded. On an archive-load failure the result is `[]` — the SearchSheet
 * simply shows its normal blank empty-query state.
 *
 * Memoized at module level: the archive is a static bundled artifact, so the
 * top-N ranking is computed exactly once (O(shows) single pass, negligible).
 */
import { deriveTopOpeners } from "@guezzer/core";
import { config as coreConfig } from "@guezzer/core/config";
import { config } from "../config.ts";
import { loadArchive } from "../dex/archive-loader.ts";

/** The minimal shape SearchSheet needs to render + select a suggestion row. */
export interface OpenerSuggestion {
  songId: number;
  songName: string;
}

let cached: OpenerSuggestion[] | null = null;

/**
 * The top-N recency-weighted openers as `{ songId, songName }` rows, memoized.
 * Returns `[]` if the bundled archive fails its schema guard.
 */
export function getOpenerSuggestions(): OpenerSuggestion[] {
  if (cached) return cached;

  const result = loadArchive();
  if (!result.ok) {
    cached = [];
    return cached;
  }

  const { archive } = result;
  cached = deriveTopOpeners(archive.shows, archive.songs, {
    asOfDate: archive.latestShowDate,
    halfLifeDays: coreConfig.decayHalfLifeDays,
    limit: config.show.OPENER_SUGGESTION_COUNT,
  }).map((o) => ({ songId: o.songId, songName: o.songName }));

  return cached;
}
