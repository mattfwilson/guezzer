/**
 * SHAR-01 / D-17 (plan 06-10): the pure friend-file DIFF. `compareDexes` takes
 * two already-derived `DexStats` (yours + a friend's, each produced by running
 * `deriveDex` — RESEARCH Pattern 1) and returns set-difference lists plus
 * You-vs-them stat columns. It is the structural INVERSE of data-safety/merge.ts:
 * it reuses the same identity discipline (songId ONLY — never song name, since
 * the matrix has duplicate names "Bit"×3/"Jam"×2/"Ghost"×2) but NEVER produces a
 * merged snapshot. It writes nothing and imports nothing from the merge path — a
 * friend's file can never inflate your attendance by construction (T-06-24).
 *
 * Zero I/O, no Dexie types, name-free: diff lists are `songId[]` (the view
 * resolves display names from archive.songs). Mirrors model/matrix.ts's pure,
 * explicit-sort shape.
 */
import type { DexStats } from "./derive-dex.ts";
import type { RarityTier } from "./rarity.ts";

/** One side's headline stats (You / {name}) — all read straight off DexStats. */
export interface CompareColumn {
  /** Completion percentage (0–100), the DexStats completion pct. */
  completion: number;
  /** Songs caught (the completion numerator). */
  caught: number;
  /** Distinct attended shows (deduped tracked∪retro). */
  shows: number;
  /** Count of caught songs per rarity tier (untiered songs are counted nowhere). */
  tierCounts: Record<RarityTier, number>;
}

/** The read-only compare payload the CompareView renders (never a merge). */
export interface CompareResult {
  columns: { mine: CompareColumn; theirs: CompareColumn };
  /** Songs only YOU have caught (songId[], rarest tier first, then songId). */
  onlyMine: number[];
  /** Songs only THEY have caught (songId[], rarest tier first, then songId). */
  onlyTheirs: number[];
  /** Songs BOTH have caught (songId[], rarest tier first, then songId). */
  shared: number[];
}

/** Rarest → least-rare, for trophy-first diff-list ordering; untiered sorts last. */
const TIER_RARITY_RANK: Record<RarityTier, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  uncommon: 3,
  common: 4,
};

function tierRank(tier: RarityTier | null): number {
  return tier == null ? 5 : TIER_RARITY_RANK[tier];
}

/** The set of songIds a dex has actually caught (sightings > 0). */
function caughtSongIds(dex: DexStats): Set<number> {
  const ids = new Set<number>();
  for (const [songId, stats] of dex.perSong) {
    if (stats.sightings > 0) ids.add(songId);
  }
  return ids;
}

function tierCounts(dex: DexStats, ids: Set<number>): Record<RarityTier, number> {
  const counts: Record<RarityTier, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  for (const songId of ids) {
    const tier = dex.perSong.get(songId)?.tier ?? null;
    if (tier != null) counts[tier] += 1;
  }
  return counts;
}

function column(dex: DexStats, ids: Set<number>): CompareColumn {
  return {
    completion: dex.completion.pct,
    caught: dex.completion.caught,
    shows: dex.showCount,
    tierCounts: tierCounts(dex, ids),
  };
}

/** Sort songIds rarest-tier-first (legendary → common → untiered), songId tie-break. */
function sortByTierThenId(ids: number[], tierOf: (id: number) => RarityTier | null): number[] {
  return [...ids].sort((a, b) => {
    const ra = tierRank(tierOf(a));
    const rb = tierRank(tierOf(b));
    return ra !== rb ? ra - rb : a - b;
  });
}

/**
 * `compareDexes(mine, theirs) -> CompareResult`. Pure set arithmetic over the two
 * perSong maps (caught = sightings > 0), tier counts via each dex's own tier
 * fields, diff lists sorted rarest-first. Neither input is mutated.
 */
export function compareDexes(mine: DexStats, theirs: DexStats): CompareResult {
  const mineCaught = caughtSongIds(mine);
  const theirsCaught = caughtSongIds(theirs);

  const onlyMineIds: number[] = [];
  const sharedIds: number[] = [];
  for (const songId of mineCaught) {
    if (theirsCaught.has(songId)) sharedIds.push(songId);
    else onlyMineIds.push(songId);
  }
  const onlyTheirsIds: number[] = [];
  for (const songId of theirsCaught) {
    if (!mineCaught.has(songId)) onlyTheirsIds.push(songId);
  }

  const mineTierOf = (id: number): RarityTier | null => mine.perSong.get(id)?.tier ?? null;
  const theirsTierOf = (id: number): RarityTier | null => theirs.perSong.get(id)?.tier ?? null;

  return {
    columns: {
      mine: column(mine, mineCaught),
      theirs: column(theirs, theirsCaught),
    },
    onlyMine: sortByTierThenId(onlyMineIds, mineTierOf),
    onlyTheirs: sortByTierThenId(onlyTheirsIds, theirsTierOf),
    shared: sortByTierThenId(sharedIds, mineTierOf),
  };
}
