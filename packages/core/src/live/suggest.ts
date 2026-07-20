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

/**
 * Minimal projection of the tracked show that `guardLatestRows` keys off
 * (LIVE-01). Re-declared locally — NEVER imported from the app — mirroring
 * `bind-show.ts`'s `TrackedShowInput` idiom (CLAUDE.md strict core/UI
 * separation). `showId` is the canonical kglw.net id once bound (else null,
 * still provisional); `date` is the show's OWN stored date (never wall-clock).
 */
export interface TonightGuardInput {
  showId: number | null;
  date: string;
}

/**
 * Keep only the tracked show's `latest` rows, dropping a cached previous-night
 * payload before it can leak into suggestions/fill-hints (LIVE-01).
 *
 * - Bound show (`showId !== null`): identity match — keep rows whose
 *   `show_id === guard.showId`, drop everything else (a previous night still
 *   cached under a different `show_id` is discarded; D-09).
 * - Unbound show (`showId === null`): date match against the show's OWN stored
 *   date — keep rows whose `showdate === guard.date`. This NEVER reads
 *   wall-clock `todayIso`, so a past-midnight set (the show's date is the 14th
 *   while "today" has rolled to the 15th) is not self-rejected (D-10).
 *
 * Pure filter: no sort, no clock, empty in → empty out. Applied ONCE by the app
 * (plan 11-04) upstream of `diffLatestAgainstTrail`/`resolvePlaceholders` — it
 * is deliberately NOT embedded inside them (RESEARCH anti-pattern: the guard is
 * a single ingress point, not a per-consumer re-filter).
 */
export function guardLatestRows(
  rows: LatestSetlistRow[],
  guard: TonightGuardInput,
): LatestSetlistRow[] {
  if (guard.showId !== null) {
    return rows.filter((r) => r.show_id === guard.showId);
  }
  return rows.filter((r) => r.showdate === guard.date);
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
 * Fill hints for "???" placeholders the editor's `latest` can now name (D-04 /
 * UX-03).
 *
 * Conservative-suppress contract — NO hint beats a WRONG hint. Trail
 * `TrackedEntry.position` is monotonic max+1 and GAPS on skipped/deleted
 * entries (db.ts), while editor `LatestSetlistRow.position` is contiguous. The
 * old raw `row.position === entry.position` matcher named an off-by-N song
 * after the first divergence — one tap from applying the wrong song via
 * `renameEntry`. This resolver instead brackets placeholders between logged
 * anchors and only names one when the bracket is unambiguous:
 *
 *   1. Sort copies of `latestRows` and `trail` by `position`.
 *   2. Anchors = logged trail entries (`!isPlaceholder && songId !== null`),
 *      matched to editor rows BY `songId` (the sibling `diffLatestAgainstTrail`
 *      keying), required to form a strictly-increasing editor-index subsequence.
 *      Any anchor absent-from-editor or out-of-order → suppress everything
 *      (safe fallback).
 *   3. Partition both sequences into intervals bounded by consecutive anchors —
 *      including the head (before the first anchor) and tail (after the last).
 *   4. Per interval: emit `FillHint`s 1:1 from the BRACKETED editor rows ONLY
 *      when `#placeholder-slots === #editor-rows-in-interval`; otherwise emit
 *      nothing for that interval.
 *
 * `FillHint.entryPosition` stays the placeholder's own position (the UI's
 * `renameEntry` handle); `position`/`songId`/`songName` come from the bracketed
 * editor row, never the raw same-position row. Pure: no DOM, no db import, no
 * clock; empty in → empty out.
 */
export function resolvePlaceholders(
  latestRows: LatestSetlistRow[],
  trail: TrailEntryInput[],
): FillHint[] {
  const rows = [...latestRows].sort((a, b) => a.position - b.position);
  const entries = [...trail].sort((a, b) => a.position - b.position);

  // Editor-row index keyed by songId (first occurrence), the anchor lookup.
  const editorIndexBySongId = new Map<number, number>();
  rows.forEach((r, i) => {
    if (!editorIndexBySongId.has(r.song_id)) editorIndexBySongId.set(r.song_id, i);
  });

  // Anchors: logged trail entries matched to an editor row by songId, requiring
  // a strictly-increasing editor-index subsequence. Any broken anchor
  // (absent-from-editor or out-of-order) trips the safe fallback → suppress all.
  const anchors: { trailIdx: number; editorIdx: number }[] = [];
  let lastEditorIdx = -1;
  for (let trailIdx = 0; trailIdx < entries.length; trailIdx++) {
    const e = entries[trailIdx];
    if (e.isPlaceholder || e.songId === null) continue;
    const editorIdx = editorIndexBySongId.get(e.songId);
    if (editorIdx === undefined || editorIdx <= lastEditorIdx) {
      return []; // absent-from-editor or out-of-order anchor → suppress everything
    }
    lastEditorIdx = editorIdx;
    anchors.push({ trailIdx, editorIdx });
  }

  // Partition into intervals bounded by consecutive anchors, including the head
  // (prev = -1) and the tail (sentinel past the ends). Emit 1:1 only on a count
  // match; otherwise suppress that interval.
  const hints: FillHint[] = [];
  const boundaries = [
    ...anchors,
    { trailIdx: entries.length, editorIdx: rows.length },
  ];
  let prevTrailIdx = -1;
  let prevEditorIdx = -1;
  for (const boundary of boundaries) {
    const slots: TrailEntryInput[] = [];
    for (let t = prevTrailIdx + 1; t < boundary.trailIdx; t++) {
      if (entries[t].isPlaceholder) slots.push(entries[t]);
    }
    const bracket = rows.slice(prevEditorIdx + 1, boundary.editorIdx);
    if (slots.length > 0 && slots.length === bracket.length) {
      slots.forEach((slot, k) => {
        const r = bracket[k];
        hints.push({
          position: r.position,
          songId: r.song_id,
          songName: r.songname,
          entryPosition: slot.position,
        });
      });
    }
    prevTrailIdx = boundary.trailIdx;
    prevEditorIdx = boundary.editorIdx;
  }
  return hints;
}
