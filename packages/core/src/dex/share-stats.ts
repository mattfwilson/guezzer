/**
 * SHAR-02 (D-18/D-19): the pure-core assembly of the PNG brag-card's numbers.
 * `buildShareStats` projects the already-derived `DexStats` (plus the archive
 * for name/venue resolution) into a flat, canvas-ready `ShareCardData` — every
 * figure the card draws. All stat math stays here so the app's draw layer only
 * draws, and the jsdom tests never need a canvas for the numbers (RESEARCH
 * Pitfall 8). Zero I/O, no DB imports — mirrors the pure-derivation shape of
 * derive-dex.ts / compare.ts.
 */
import type { ArchiveArtifact } from "./archive-types.ts";
import type { DexStats } from "./derive-dex.ts";
import type { RarityTier } from "./rarity.ts";

/** Tier render order — scarcest first (Legendary → Common), matching the card. */
const TIER_ORDER: RarityTier[] = ["legendary", "rare", "uncommon", "common"];

/** The flat, canvas-ready shape the share card draws — all figures pre-computed. */
export interface ShareCardData {
  /** Completion percentage (0–100, never NaN). */
  completionPct: number;
  /** Songs caught (numerator). */
  caught: number;
  /** Catalog size (denominator). */
  total: number;
  /** Deduped attended-show count. */
  showCount: number;
  /** The rarest caught song + its tier, or null on an empty dex. */
  rarestCatch: { songName: string; tier: RarityTier } | null;
  /** Per-tier counts over CAUGHT songs, scarcest-first; empty on a zero-catch dex. */
  tierBreakdown: Array<{ tier: RarityTier; count: number }>;
  /** The newest attended night (venue resolved from the archive when known), or null. */
  latestShow: { date: string; venue: string | null } | null;
}

/**
 * `buildShareStats(dex, archive) -> ShareCardData`. Pure projection:
 * completion/showCount come straight from the derivation; the tier breakdown and
 * latest-show date are aggregated over `dex.perSong` (every entry there is a
 * CAUGHT song); rarest-catch and latest-show venue resolve their display strings
 * from the archive. A zero-catch dex yields a valid card (0%, empty breakdown,
 * null rarest/latest) — no NaN by construction.
 */
export function buildShareStats(dex: DexStats, archive: ArchiveArtifact): ShareCardData {
  // Tier counts over caught songs + the newest sighting date, in one pass.
  const counts = new Map<RarityTier, number>();
  let latestDate: string | null = null;
  for (const stat of dex.perSong.values()) {
    if (stat.tier != null) counts.set(stat.tier, (counts.get(stat.tier) ?? 0) + 1);
    if (stat.lastSeenDate != null && (latestDate == null || stat.lastSeenDate > latestDate)) {
      latestDate = stat.lastSeenDate;
    }
  }

  const tierBreakdown = TIER_ORDER.filter((tier) => counts.has(tier)).map((tier) => ({
    tier,
    count: counts.get(tier) ?? 0,
  }));

  const rarestCatch =
    dex.rarestCatch != null
      ? {
          songName: archive.songs[String(dex.rarestCatch.songId)] ?? "",
          tier: dex.rarestCatch.tier,
        }
      : null;

  let latestShow: ShareCardData["latestShow"] = null;
  if (latestDate != null) {
    // First archive show on that date supplies the venue; unbound/post-corpus
    // nights simply carry a null venue (date is always honest).
    const show = archive.shows.find((s) => s.date === latestDate);
    latestShow = { date: latestDate, venue: show?.venue ?? null };
  }

  return {
    completionPct: dex.completion.pct,
    caught: dex.completion.caught,
    total: dex.completion.total,
    showCount: dex.showCount,
    rarestCatch,
    tierBreakdown,
    latestShow,
  };
}
