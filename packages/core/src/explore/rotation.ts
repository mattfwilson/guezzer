/**
 * EXPL-03 / D-05: the "active rotation" node set — the distinct songIds played
 * in the last N shows, derived from the Phase-6 `archive` artifact (NOT the
 * matrix's `eraPlayCount`). Zero I/O, no React/DOM.
 *
 * The default caller passes `config.explore.ROTATION_WINDOW_SHOWS` (5 → 56
 * songs, D-06). Sorts by date DESCENDING before slicing rather than trusting
 * the artifact's array order (RESEARCH Pitfall 5): a future archive rebuild that
 * changed ordering would otherwise silently read the OLDEST shows.
 */
import type { ArchiveArtifact } from "../dex/archive-types.ts";

/**
 * Return the distinct songIds of the newest `windowShows` shows by date. A
 * zero/negative window or an empty archive yields an empty Set (no throw).
 */
export function rotationSongIds(archive: ArchiveArtifact, windowShows: number): Set<number> {
  const recent = [...archive.shows] // copy — never mutate the artifact in place
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) // newest-first (Pitfall 5)
    .slice(0, Math.max(0, windowShows));

  const ids = new Set<number>();
  for (const show of recent) {
    for (const set of show.sets) {
      for (const songId of set.songs) ids.add(songId);
    }
  }
  return ids;
}
