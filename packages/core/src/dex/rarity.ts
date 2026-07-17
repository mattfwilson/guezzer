/**
 * D-15 / STAT-01 / STAT-02: corpus-honest song rarity, derived purely from the
 * compact show archive. This module is the app's ONLY source of corpus gap,
 * play count, and last-played date (the transition matrix carries playCount but
 * no dates — RESEARCH-verified), so `SongRarity` bundles everything the dex song
 * rows and the WhyDetail panel need.
 *
 * Zero I/O, no `Date.now()` — mirrors model/matrix.ts's "pure module, one
 * top-level fn, Map-keyed accumulation, explicit sort comparators" shape. All
 * tunables (the tie-inclusive playCount band boundaries) come from config.dex —
 * this module holds zero numeric tier literals (single-config rule, CLAUDE.md).
 */
import { config } from "../config.ts";
import type { ArchiveArtifact } from "./archive-types.ts";

/** Game-style rarity tiers, most-rare → least-rare: legendary > epic > rare > uncommon > common. */
export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Everything a dex song row / WhyDetail needs about one song's corpus rarity. */
export interface SongRarity {
  songId: number;
  /** Total corpus performances (all shows in the archive). */
  playCount: number;
  /** ISO date of the newest archive show containing the song. */
  lastPlayedDate: string;
  /** Number of archive shows strictly after the song's last play (STAT-01). */
  corpusGap: number;
  tier: RarityTier;
}

export type RarityIndex = Map<number, SongRarity>;

interface RarityAccumulator {
  playCount: number;
  lastIndex: number;
  lastPlayedDate: string;
}

/**
 * `buildRarityIndex(archive, cfg) -> RarityIndex`. Single pass over the
 * date-sorted archive accumulating per-song playCount and last-played show
 * position; corpusGap = shows-after-last-play. Tiers are assigned by a
 * tie-inclusive lookup of each song's total corpus playCount against
 * `cfg.dex.RARITY_BANDS` (first band whose `maxPlays >= playCount` wins; songs
 * past the last band fall through to `common`). Two songs with the same
 * playCount ALWAYS get the same tier — there is no songId tie-break, so equal
 * rarity is never split across tiers. The old RARITY_MIN_PLAYS "fake Legendary"
 * cap is retired by design: a played-once-ever song IS legendary (accepted
 * trade-off — corpus is curated + sentinel-filtered). Sentinel ids are excluded.
 */
export function buildRarityIndex(
  archive: ArchiveArtifact,
  cfg: typeof config = config,
): RarityIndex {
  const sentinelIds = cfg.sentinelSongIds as readonly number[];

  // Defensive chronological sort (archive is stored newest-first — never assume).
  const shows = [...archive.shows].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id,
  );
  const totalShows = shows.length;

  const acc = new Map<number, RarityAccumulator>();
  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];
    for (const set of show.sets) {
      for (const songId of set.songs) {
        if (sentinelIds.includes(songId)) continue;
        let entry = acc.get(songId);
        if (!entry) {
          entry = { playCount: 0, lastIndex: -1, lastPlayedDate: "" };
          acc.set(songId, entry);
        }
        entry.playCount += 1;
        // Ascending iteration → each hit is the newest so far.
        entry.lastIndex = i;
        entry.lastPlayedDate = show.date;
      }
    }
  }

  const bands = cfg.dex.RARITY_BANDS;

  // Tie-inclusive band lookup: tier is a pure function of playCount, so equal
  // playCounts always share a tier (no songId tie-break). Iterate the
  // accumulator in ascending songId order for a deterministic index.
  const tierForPlayCount = (playCount: number): RarityTier => {
    for (const band of bands) {
      if (playCount <= band.maxPlays) return band.tier;
    }
    return "common";
  };

  const index: RarityIndex = new Map();
  const entries = [...acc.entries()].sort((a, b) => a[0] - b[0]);
  for (const [songId, entry] of entries) {
    index.set(songId, {
      songId,
      playCount: entry.playCount,
      lastPlayedDate: entry.lastPlayedDate,
      corpusGap: totalShows - 1 - entry.lastIndex,
      tier: tierForPlayCount(entry.playCount),
    });
  }

  return index;
}

/**
 * STAT-02: a night's rarity score = the average corpusGap of the night's songs
 * (how "overdue" the set was, on average), ignoring ids absent from the index.
 * Rounded to one decimal; 0 when no given id is known.
 */
export function showRarityScore(songIds: number[], index: RarityIndex): number {
  const gaps: number[] = [];
  for (const songId of songIds) {
    const entry = index.get(songId);
    if (entry) gaps.push(entry.corpusGap);
  }
  if (gaps.length === 0) return 0;
  const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return Math.round(avg * 10) / 10;
}
