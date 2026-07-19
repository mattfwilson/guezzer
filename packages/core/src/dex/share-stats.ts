/**
 * SHAR-02 (D-18/D-19): the pure-core assembly of the PNG brag-card's numbers.
 * Two projections share one canvas-ready `ShareCardData` (a discriminated union
 * on `scope`):
 *
 *  - `buildShareStats(dex, archive)` → the LIFETIME `"collection"` card: the
 *    whole-GizzDex completion %, caught/total, show count, and the six-tier
 *    caught breakdown.
 *  - `buildRecapShareStats(recap, archive, meta)` → the PER-SHOW `"show"` card:
 *    only the night just tracked — its songs-caught count (no completion
 *    denominator exists for one show), its six-tier caught breakdown, the show
 *    date+venue, and the rarest catch of the night. It REUSES `deriveRecap`'s
 *    numbers (setlist rows + rarest-of-night) — it never re-runs catch logic.
 *
 * All stat math stays here so the app's draw layer only draws, and the jsdom
 * tests never need a canvas for the numbers (RESEARCH Pitfall 8). Zero I/O, no
 * DB imports — mirrors the pure-derivation shape of derive-dex.ts / compare.ts.
 */
import { config } from "../config.ts";
import type { ArchiveArtifact } from "./archive-types.ts";
import type { DexStats } from "./derive-dex.ts";
import type { RarityTier } from "./rarity.ts";
import type { RecapStats } from "./recap.ts";

/**
 * A tier ROW on the card — the five real rarity tiers plus `"debut"` (the
 * caught-but-no-live-history state, STAT-04). `"debut"` is a state, not a
 * rarity, so it is NOT a `RarityTier`; the card renders it in the shared
 * neutral debut hue.
 */
export type ShareTier = RarityTier | "debut";

/**
 * The fixed vertical tier-row order (least → most rare) both cards render — six
 * rows always, `0` where a tier has no caught songs, so the layout is stable
 * and aligned (06-UI-SPEC §Layout 5). `"debut"` leads as the entry state.
 */
const TIER_ROW_ORDER: readonly ShareTier[] = [
  "debut",
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

/** One row of the six-tier caught breakdown drawn on the card. */
export interface ShareTierRow {
  tier: ShareTier;
  count: number;
}

/** Fields both card variants carry — the rarest catch + the six-tier breakdown. */
interface ShareCardCommon {
  /** The rarest caught song + its tier, or null when nothing is caught. */
  rarestCatch: { songName: string; tier: RarityTier } | null;
  /** Per-tier caught counts, fixed order [debut … legendary], all six present (0 where none). */
  tierBreakdown: ShareTierRow[];
}

/** The LIFETIME whole-collection card (DexHeader entry point). */
export interface CollectionShareCard extends ShareCardCommon {
  scope: "collection";
  /** Completion percentage (0–100, never NaN). */
  completionPct: number;
  /** Songs caught (numerator). */
  caught: number;
  /** Catalog size (denominator). */
  total: number;
  /** Deduped attended-show count. */
  showCount: number;
  /** The newest attended night (venue resolved from the archive when known), or null. */
  latestShow: { date: string; venue: string | null } | null;
}

/** The PER-SHOW recap card (RecapView entry point) — scoped to one night. */
export interface ShowShareCard extends ShareCardCommon {
  scope: "show";
  /** Distinct non-placeholder catalog songs caught THIS show (no completion denominator exists for one night). */
  songsCaught: number;
  /** The show this card recaps — date always honest, venue nullable. */
  show: { date: string; venue: string | null };
}

/** The flat, canvas-ready shape the share card draws — a discriminated union on `scope`. */
export type ShareCardData = CollectionShareCard | ShowShareCard;

/** Build the fixed six-row breakdown from a tier→count map (0-filled, ordered). */
function orderedTierRows(counts: Map<ShareTier, number>): ShareTierRow[] {
  return TIER_ROW_ORDER.map((tier) => ({ tier, count: counts.get(tier) ?? 0 }));
}

/**
 * `buildShareStats(dex, archive) -> CollectionShareCard`. Pure projection:
 * completion/showCount come straight from the derivation; the tier breakdown and
 * latest-show date are aggregated over `dex.perSong` (every entry there is a
 * CAUGHT song — a null tier is the `"debut"` row); rarest-catch and latest-show
 * venue resolve their display strings from the archive. A zero-catch dex yields
 * a valid card (0%, all-zero breakdown, null rarest/latest) — no NaN.
 */
export function buildShareStats(dex: DexStats, archive: ArchiveArtifact): CollectionShareCard {
  // Tier counts over caught songs (null tier → "debut") + the newest sighting date.
  const counts = new Map<ShareTier, number>();
  let latestDate: string | null = null;
  for (const stat of dex.perSong.values()) {
    const tier: ShareTier = stat.tier ?? "debut";
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
    if (stat.lastSeenDate != null && (latestDate == null || stat.lastSeenDate > latestDate)) {
      latestDate = stat.lastSeenDate;
    }
  }

  const rarestCatch =
    dex.rarestCatch != null
      ? {
          songName: archive.songs[String(dex.rarestCatch.songId)] ?? "",
          tier: dex.rarestCatch.tier,
        }
      : null;

  let latestShow: CollectionShareCard["latestShow"] = null;
  if (latestDate != null) {
    // First archive show on that date supplies the venue; unbound/post-corpus
    // nights simply carry a null venue (date is always honest).
    const show = archive.shows.find((s) => s.date === latestDate);
    latestShow = { date: latestDate, venue: show?.venue ?? null };
  }

  return {
    scope: "collection",
    completionPct: dex.completion.pct,
    caught: dex.completion.caught,
    total: dex.completion.total,
    showCount: dex.showCount,
    rarestCatch,
    tierBreakdown: orderedTierRows(counts),
    latestShow,
  };
}

/**
 * `buildRecapShareStats(recap, archive, meta, cfg) -> ShowShareCard`. Pure
 * projection of ONE night's `deriveRecap` output. It REUSES the recap's numbers
 * — the caught-song set is read off `recap.setlist` rows (placeholder + sentinel
 * rows skipped, exactly as `deriveRecap` derived them) and the rarest catch is
 * `recap.rarity.rarestOfNight` — so no catch/tally logic is re-implemented here.
 * `songsCaught` is the count of distinct real songs; the six-tier breakdown
 * partitions them (a null tier → the `"debut"` row), so `songsCaught` always
 * equals the sum of the breakdown counts.
 */
export function buildRecapShareStats(
  recap: RecapStats,
  archive: ArchiveArtifact,
  meta: { date: string; venue: string | null },
  cfg: typeof config = config,
): ShowShareCard {
  const sentinelIds = new Set<number>(cfg.sentinelSongIds as readonly number[]);

  // Distinct non-placeholder, non-sentinel songs caught this show, with tier + name.
  const tierBySong = new Map<number, ShareTier>();
  const nameById = new Map<number, string>();
  for (const set of recap.setlist) {
    for (const row of set.rows) {
      if (row.isPlaceholder || row.songId == null || sentinelIds.has(row.songId)) continue;
      tierBySong.set(row.songId, row.tier ?? "debut");
      nameById.set(row.songId, row.songName);
    }
  }

  const counts = new Map<ShareTier, number>();
  for (const tier of tierBySong.values()) counts.set(tier, (counts.get(tier) ?? 0) + 1);

  const rarest = recap.rarity.rarestOfNight;
  const rarestCatch =
    rarest != null
      ? {
          songName: nameById.get(rarest.songId) ?? archive.songs[String(rarest.songId)] ?? "",
          tier: rarest.tier,
        }
      : null;

  return {
    scope: "show",
    songsCaught: tierBySong.size,
    show: { date: meta.date, venue: meta.venue },
    rarestCatch,
    tierBreakdown: orderedTierRows(counts),
  };
}
