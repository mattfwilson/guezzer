/**
 * D-15 / STAT-01 / STAT-02: corpus-honest song rarity, derived purely from the
 * compact show archive. This module is the app's ONLY source of corpus gap,
 * play count, and last-played date (the transition matrix carries playCount but
 * no dates — RESEARCH-verified), so `SongRarity` bundles everything the dex song
 * rows and the WhyDetail panel need.
 *
 * Zero I/O, no `Date.now()` — mirrors model/matrix.ts's "pure module, one
 * top-level fn, Map-keyed accumulation, explicit sort comparators" shape. All
 * tunables (quantile boundaries, min-plays cap) come from config.dex.
 */
import { config } from "../config.ts";
import type { ArchiveArtifact } from "./archive-types.ts";

/** Game-style rarity tiers, most-rare → least-rare: legendary > rare > uncommon > common. */
export type RarityTier = "common" | "uncommon" | "rare" | "legendary";

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
 * position; corpusGap = shows-after-last-play. Tiers are assigned by sorting
 * played songs on play RATE (playCount / total shows) ascending and cutting at
 * the config quantile boundaries, then applying the RARITY_MIN_PLAYS cap (a
 * tiny-sample song can never exceed rare — defeats the "fake Legendary" of a
 * single-play-in-2011 song, Pitfall 12). Sentinel song ids are excluded.
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

  const quantiles = cfg.dex.RARITY_QUANTILES;
  const minPlays = cfg.dex.RARITY_MIN_PLAYS;

  // Rank played songs by play rate ascending (tie-break by songId for
  // determinism). Rate uses a constant denominator, so rank order equals
  // playCount order — but rate keeps the quantile math self-documenting.
  const ranked = [...acc.entries()]
    .map(([songId, entry]) => ({ songId, entry, rate: entry.playCount / totalShows }))
    .sort((x, y) => (x.rate !== y.rate ? x.rate - y.rate : x.songId - y.songId));

  const total = ranked.length;
  const index: RarityIndex = new Map();
  ranked.forEach(({ songId, entry }, rank) => {
    let tier: RarityTier;
    if (rank < quantiles.legendary * total) tier = "legendary";
    else if (rank < quantiles.rare * total) tier = "rare";
    else if (rank < quantiles.uncommon * total) tier = "uncommon";
    else tier = "common";

    // RARITY_MIN_PLAYS cap: a sparse song can never be Legendary.
    if (tier === "legendary" && entry.playCount < minPlays) tier = "rare";

    index.set(songId, {
      songId,
      playCount: entry.playCount,
      lastPlayedDate: entry.lastPlayedDate,
      corpusGap: totalShows - 1 - entry.lastIndex,
      tier,
    });
  });

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
