/**
 * Pure suggestion diff + placeholder resolver (SYNC-02 / D-02 / D-04, Phase 5
 * plan 05-01 Task 3).
 *
 * These are the "second set of eyes" decision functions: given the editor's
 * live `latest` rows and the user's own manually-tracked trail, they compute
 * what to OFFER — never what to apply. Manual entry stays primary; editor
 * songs are suggestions only, deduped by song_id, and NEVER contradict an
 * already-logged song (SYNC-02/D-02). The app tier (plan 05-04) renders these
 * as dismissible hints and adopts them through the existing logSong/renameEntry
 * paths.
 *
 * Zero DOM, zero db.ts dependency: the minimal `TrailEntryInput` shape below
 * mirrors the app's `TrackedEntry` (packages/app/src/db/db.ts) but is
 * re-declared locally to keep core free of any app import (CLAUDE.md strict
 * core/UI separation) — the same idiom db.ts uses to re-declare `SetNumber`.
 */
import type { LatestSetlistRow } from "../ingest/latest-types.ts";

/**
 * Minimal projection of the app's `TrackedEntry` (db.ts) that the diff needs.
 * Re-declared here — NOT imported — to keep core app-free.
 */
export interface TrailEntryInput {
  position: number;
  songId: number | null;
  isPlaceholder: boolean;
}

/** An editor-logged song offered to the user (SYNC-02). Never auto-applied. */
export interface Suggestion {
  songId: number;
  songName: string;
  position: number;
  setnumber: string;
}

/**
 * A hint to fill a "???" placeholder (D-04): the user logged a placeholder at
 * `entryPosition` and the editor's `latest` now names a real song at the same
 * position. Surfaced as a separate dismissible suggestion, adopted via
 * `renameEntry` — never auto-applied.
 */
export interface FillHint {
  position: number;
  songId: number;
  songName: string;
  entryPosition: number;
}

/**
 * The next 1–`suggestionCount` un-logged editor songs, deduped by song_id and
 * ordered by position (SYNC-02 / D-02).
 *
 * Dedupe is strict-by-song_id against the trail's non-null, non-placeholder
 * logged song ids: a song the user already logged NEVER reappears as a
 * suggestion (D-02 — filter only, never contradict a logged position). A trail
 * whose logged song_ids cover all latest rows yields `[]`.
 *
 * `excludeSongIds` (the app's locally-dismissed rows, D-01) is applied BEFORE
 * the slot fill, so a dismissed song frees its slot and the NEXT un-logged
 * editor song slides in. Found by Phase-5 UAT (Test 2): the app previously
 * filtered dismissed ids AFTER this function truncated to `suggestionCount`,
 * so two dismissals emptied the strip for the rest of the show even with more
 * un-logged editor songs queued.
 */
export function diffLatestAgainstTrail(
  latestRows: LatestSetlistRow[],
  trail: TrailEntryInput[],
  suggestionCount = 2,
  excludeSongIds?: ReadonlySet<number>,
): Suggestion[] {
  const loggedSongIds = new Set<number>();
  for (const entry of trail) {
    if (entry.isPlaceholder) continue;
    if (entry.songId === null) continue;
    loggedSongIds.add(entry.songId);
  }

  const ordered = [...latestRows].sort((a, b) => a.position - b.position);

  const suggestions: Suggestion[] = [];
  for (const row of ordered) {
    if (suggestions.length >= suggestionCount) break;
    if (loggedSongIds.has(row.song_id)) continue;
    if (excludeSongIds?.has(row.song_id)) continue;
    suggestions.push({
      songId: row.song_id,
      songName: row.songname,
      position: row.position,
      setnumber: row.setnumber,
    });
  }
  return suggestions;
}

/**
 * Fill hints for "???" placeholders the editor's `latest` can now name (D-04).
 *
 * For each trail entry with `isPlaceholder === true`, emit a `FillHint` iff a
 * latest row exists at the SAME position with a real song. Never returns a
 * hint for an already-named (non-placeholder) entry, and returns `[]` when no
 * placeholder positions align with a latest song.
 */
export function resolvePlaceholders(
  latestRows: LatestSetlistRow[],
  trail: TrailEntryInput[],
): FillHint[] {
  const hints: FillHint[] = [];
  for (const entry of trail) {
    if (!entry.isPlaceholder) continue;
    const match = latestRows.find((row) => row.position === entry.position);
    if (!match) continue;
    hints.push({
      position: match.position,
      songId: match.song_id,
      songName: match.songname,
      entryPosition: entry.position,
    });
  }
  return hints;
}
