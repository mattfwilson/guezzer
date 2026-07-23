/**
 * PROG-01 / PROG-06 / PROG-07 / PROG-08 (Phase 19, D-12/D-13/D-19): the pure-core
 * bridge between a locally-derived `DexStats` and the multi-user "shared progress"
 * payload synced between friends. The whole phase premise is REUSE, not reinvent:
 * the live head-to-head must reach the EXACT shipped `compareDexes` diff by feeding
 * it a reconstructed `theirs`, with zero change to compare.ts and zero change to the
 * file-import path.
 *
 *  - `deriveSharedProgress(dex)` → the Option-B `SharedProgress` summary (PROG-01):
 *    a lean, serializable projection of one `DexStats`. Mirrors `buildShareStats`'s
 *    pure dex-only shape — no I/O, no wall-clock read (the app stamps `updated_at`).
 *  - `reconstructDexStats(summary, rarity)` → a MINIMAL `DexStats` rebuilt from that
 *    summary (PROG-06/07), carrying exactly the read-set `compareDexes` consumes and
 *    stubbing every field it never reads. Tiers come from the LOCAL rarity index
 *    (D-13): rarity is a pure function of the shared static corpus, so mine and a
 *    friend's derive the identical tier for a songId — no need to ship tiers.
 *  - `selectRarestCaught(caughtSongIds, rarity, limit)` → a friend's top-N rarest
 *    catches (PROG-08), rarest-tier-first with songId tie-break — the SAME ordering
 *    `compareDexes`' diff lists use.
 *  - `sharedProgressSchema` / `parseSharedProgress(raw)` → read-boundary validation
 *    (D-19, T-19-01): an untrusted synced summary is zod-`safeParse`d — malformed /
 *    out-of-range rows return `null` (skipped), never throw.
 *
 * Zero I/O, no Supabase, no DOM globals — imports ONLY `zod` + core-internal types,
 * so packages/core/test/purity.test.ts stays green by construction (CLAUDE.md
 * core-purity constraint).
 */
import { z } from "zod";
import type { DexStats, SongDexStats } from "./derive-dex.ts";
import type { RarityIndex, RarityTier } from "./rarity.ts";

/**
 * The Option-B synced payload — a pure, serializable projection of one `DexStats`.
 * NOTE: no `display_name` field. Per RESEARCH A1 / Open-Q1 the app writes
 * `display_name` as a first-class row column (authoritative on read), so PROG-01's
 * name requirement is satisfied at the row level — keeping this projector a pure fn
 * of `DexStats` alone (matching `buildShareStats`'s signature). `tierCounts` uses
 * exactly the 5 `RarityTier` keys (no `"debut"` — that is a share-card state, not a
 * rarity).
 */
export interface SharedProgress {
  /** Literal version guard — bumped if the payload shape ever changes. */
  v: 1;
  /** Completion headline, straight off `DexStats.completion`. */
  completion: { caught: number; total: number; pct: number };
  /** Deduped attended-show count. */
  showCount: number;
  /** The rarest caught song + its tier, or null when nothing is caught. */
  rarest: { songId: number; tier: RarityTier } | null;
  /** Count of caught songs per rarity tier (untiered songs counted nowhere). */
  tierCounts: Record<RarityTier, number>;
  /** Per-album tallies, serialized as an array (a Map does not survive JSON — Pitfall 6). */
  perAlbum: Array<{ key: string; caught: number; total: number }>;
  /** The caught set (sightings > 0), sorted ascending for determinism. */
  caughtSongIds: number[];
}

/**
 * Rarest → least-rare rank for trophy-first ordering; untiered sorts last. This is a
 * deliberate ECHO of compare.ts's private `TIER_RARITY_RANK`/`sortByTierThenId` so
 * the showcase (PROG-08) and the diff lists agree — compare.ts stays UNCHANGED, so
 * the ordering cannot be imported and is mirrored here instead.
 */
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

/** The five real rarity tiers, ascending songId-independent — the closed tierCounts key set. */
const RARITY_TIERS = ["common", "uncommon", "rare", "epic", "legendary"] as const;

/**
 * Defensive length ceiling on `caughtSongIds` for the untrusted read boundary
 * (§Untrusted-Data, T-19-01): the real catalog is ~260 songs; a payload claiming
 * more caught songs than the catalog can plausibly hold is rejected outright. Kept
 * generous so future catalog growth never trips a legitimate friend's summary.
 */
const MAX_CAUGHT_SONG_IDS = 1000;

/**
 * `deriveSharedProgress(dex) -> SharedProgress` (PROG-01). Pure projection mirroring
 * `buildShareStats`: iterate `dex.perSong`, collect the caught set (`sightings > 0`
 * — EXACTLY `compareDexes`' caught rule) and tally tier counts; pass
 * `completion`/`showCount`/`rarestCatch` straight through; serialize `perAlbum` from a
 * Map to an array (Pitfall 6). No wall-clock read, no I/O. Two invariants hold by
 * construction (both derive from the same dex): `caughtSongIds` === the `sightings>0`
 * set, and `completion.caught` === `caughtSongIds.length`.
 */
export function deriveSharedProgress(dex: DexStats): SharedProgress {
  const caughtSongIds: number[] = [];
  const tierCounts: Record<RarityTier, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };

  for (const stat of dex.perSong.values()) {
    if (stat.sightings > 0) {
      caughtSongIds.push(stat.songId);
      if (stat.tier != null) tierCounts[stat.tier] += 1;
    }
  }
  caughtSongIds.sort((a, b) => a - b);

  const perAlbum: SharedProgress["perAlbum"] = [];
  for (const [key, tally] of dex.perAlbum) {
    perAlbum.push({ key, caught: tally.caught, total: tally.total });
  }

  return {
    v: 1,
    completion: {
      caught: dex.completion.caught,
      total: dex.completion.total,
      pct: dex.completion.pct,
    },
    showCount: dex.showCount,
    rarest: dex.rarestCatch,
    tierCounts,
    perAlbum,
    caughtSongIds,
  };
}

/**
 * `reconstructDexStats(summary, rarity) -> DexStats` (PROG-06/07). Rebuilds the
 * MINIMAL `DexStats` `compareDexes` reads: a `perSong` Map with one entry per caught
 * id, tiers resolved from the LOCAL rarity index (D-13). Every other field is either
 * passed through (`completion`, `showCount`, `rarestCatch`) or a stub `compareDexes`
 * NEVER reads (`neverSeen`, per-song `lastSeenDate`/`personalGap`).
 *
 * `sightings: 1` is CAUGHT/NOT-CAUGHT only — a boolean-equivalent flag, never a
 * magnitude (Pitfall 1 / T-19-02). `compareDexes` reads it solely as `> 0`; the
 * round-trip fidelity test pins that this reconstruction produces the identical diff.
 */
export function reconstructDexStats(summary: SharedProgress, rarity: RarityIndex): DexStats {
  const perSong = new Map<number, SongDexStats>();
  for (const songId of summary.caughtSongIds) {
    perSong.set(songId, {
      songId,
      // Boolean-equivalent: compareDexes only tests `sightings > 0`, never magnitude.
      sightings: 1,
      lastSeenDate: null,
      personalGap: null,
      tier: rarity.get(songId)?.tier ?? null,
    });
  }

  const perAlbum = new Map<string, { caught: number; total: number }>();
  for (const album of summary.perAlbum) {
    perAlbum.set(album.key, { caught: album.caught, total: album.total });
  }

  return {
    completion: {
      caught: summary.completion.caught,
      total: summary.completion.total,
      pct: summary.completion.pct,
    },
    perSong,
    neverSeen: [],
    rarestCatch: summary.rarest,
    showCount: summary.showCount,
    perAlbum,
  };
}

/**
 * `selectRarestCaught(caughtSongIds, rarity, limit) -> Array<{songId, tier}>`
 * (PROG-08). The friend's top-N rarest catches: each caught id is mapped to its LOCAL
 * rarity tier (ids absent from the index — untiered — are skipped, since a showcase
 * entry needs a real tier), then sorted rarest-tier-first with an ascending songId
 * tie-break (the SAME ordering compare.ts's `sortByTierThenId` uses), and truncated to
 * `limit`.
 */
export function selectRarestCaught(
  caughtSongIds: number[],
  rarity: RarityIndex,
  limit: number,
): Array<{ songId: number; tier: RarityTier }> {
  const tiered: Array<{ songId: number; tier: RarityTier }> = [];
  for (const songId of caughtSongIds) {
    const tier = rarity.get(songId)?.tier;
    if (tier != null) tiered.push({ songId, tier });
  }
  tiered.sort((a, b) => {
    const ra = tierRank(a.tier);
    const rb = tierRank(b.tier);
    return ra !== rb ? ra - rb : a.songId - b.songId;
  });
  return limit >= 0 ? tiered.slice(0, limit) : [];
}

/** The 5-tier rarity enum for the untrusted read boundary. */
const rarityTierSchema = z.enum(RARITY_TIERS);

/** Non-negative integer helper for counts. */
const nonNegativeInt = z.number().int().min(0);

/**
 * `sharedProgressSchema` — the read-boundary zod schema (D-19, T-19-01). Mirrors
 * archive-types.ts's `z.strictObject` / `z.number().int()` / `z.literal(1)` idiom:
 * an unexpected key hard-fails, `pct` is bounded to `[0, 100]`, all counts are
 * non-negative ints, ids are ints, and `caughtSongIds` is capped so a hostile
 * oversized array is rejected before any set arithmetic.
 */
export const sharedProgressSchema = z.strictObject({
  v: z.literal(1),
  completion: z.strictObject({
    caught: nonNegativeInt,
    total: nonNegativeInt,
    pct: z.number().min(0).max(100),
  }),
  showCount: nonNegativeInt,
  rarest: z
    .strictObject({
      songId: z.number().int(),
      tier: rarityTierSchema,
    })
    .nullable(),
  tierCounts: z.strictObject({
    common: nonNegativeInt,
    uncommon: nonNegativeInt,
    rare: nonNegativeInt,
    epic: nonNegativeInt,
    legendary: nonNegativeInt,
  }),
  perAlbum: z.array(
    z.strictObject({
      key: z.string(),
      caught: nonNegativeInt,
      total: nonNegativeInt,
    }),
  ),
  caughtSongIds: z.array(z.number().int()).max(MAX_CAUGHT_SONG_IDS),
});

/**
 * `parseSharedProgress(raw) -> SharedProgress | null` (D-19). A `safeParse` wrapper:
 * a valid untrusted summary returns the typed payload; anything malformed / hostile /
 * out-of-range returns `null` (skipped), NEVER throws — matching the file-import
 * discipline so a corrupt friend row can never crash a read or poison set arithmetic.
 */
export function parseSharedProgress(raw: unknown): SharedProgress | null {
  const result = sharedProgressSchema.safeParse(raw);
  return result.success ? result.data : null;
}
