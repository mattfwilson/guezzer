/**
 * Pure derivation of the compact offline show archive (`archive.json`) from
 * the normalized corpus. Zero I/O — mirrors model/matrix.ts's "pure module,
 * one top-level fn, config injected with a default" shape. The CLI
 * (cli/build-archive.ts) is the only file that reads disk and writes.
 *
 * Why a derived artifact and not the raw corpus: corpus.json is 4.86 MB (34×
 * too large to bundle). This artifact is ~141 KB — the DEX-02 retro-marking
 * substrate and the STAT-01 gap/last-played source (the matrix has playCount
 * but no dates). It preserves per-show set structure (HIST-01 retro setlist
 * views) as a songId→name map plus date-descending shows.
 *
 * The sentinel song (config.sentinelSongIds) and placeholder performances are
 * excluded from both the song map and every set's song list (RESEARCH Pitfall
 * 4 — the sentinel is never a real catalog song).
 */
import { config } from "../config.ts";
import type { NormalizedCorpus } from "../domain/types.ts";
import { archiveArtifact, type ArchiveArtifact, type ArchiveShow } from "./archive-types.ts";

/** Minimal config surface deriveArchive reads (a structural subset of `config`). */
export interface ArchiveDerivationConfig {
  sentinelSongIds: readonly number[];
}

export function deriveArchive(
  corpus: NormalizedCorpus,
  cfg: ArchiveDerivationConfig = config,
): ArchiveArtifact {
  const sentinelIds = new Set<number>(cfg.sentinelSongIds);

  // songId → name, built from every non-sentinel, non-placeholder performance.
  const songNames = new Map<number, string>();
  let latestShowDate = "";

  // Shows sorted newest-first: date descending, then showOrder descending so a
  // multi-show day is stably ordered (deterministic — no wall-clock input).
  const sortedShows = [...corpus.shows].sort(
    (a, b) => b.date.localeCompare(a.date) || b.showOrder - a.showOrder,
  );

  const shows: ArchiveShow[] = [];
  for (const show of sortedShows) {
    if (show.date > latestShowDate) latestShowDate = show.date;

    const sets = [];
    for (const set of show.sets) {
      const songs: number[] = [];
      for (const perf of set.performances) {
        if (perf.isPlaceholder || sentinelIds.has(perf.songId)) continue;
        songs.push(perf.songId);
        if (!songNames.has(perf.songId)) songNames.set(perf.songId, perf.songName);
      }
      // Drop a set that is empty after sentinel/placeholder exclusion.
      if (songs.length > 0) sets.push({ n: set.setNumber, songs });
    }

    shows.push({
      id: show.showId,
      date: show.date,
      venue: show.venue.name,
      city: show.venue.city,
      state: show.venue.state,
      country: show.venue.country,
      sets,
    });
  }

  // Stable songId-ascending key order (readability + byte-determinism).
  const songs: Record<string, string> = {};
  for (const songId of [...songNames.keys()].sort((a, b) => a - b)) {
    songs[String(songId)] = songNames.get(songId) as string;
  }

  const artifact: ArchiveArtifact = {
    schemaVersion: 1,
    latestShowDate,
    songs,
    shows,
  };

  // Validate through the strict schema before returning (T-06-02).
  return archiveArtifact.parse(artifact);
}
