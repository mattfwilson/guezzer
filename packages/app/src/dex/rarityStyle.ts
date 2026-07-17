/**
 * The single UI rarity-styling primitive (quick 260717-p4s). Every rarity
 * surface in the app — GizzDex chips, recap, compare, retro-setlist, the share
 * card, AND the Show Mode prediction orbs / center node / comet trail — reads
 * its hue through THIS module, so a tier recolor propagates from one place and
 * can never drift again.
 *
 * `config.dex.tierColors` remains the ONE source of truth for the hexes (per
 * CLAUDE.md's single-config rule); this module only READS it. `rarityColor` is
 * the ONLY expression in packages/app that indexes `config.dex.tierColors` — no
 * component reaches into the map directly and no surface hardcodes a tier hex.
 *
 * Pure module (zero JSX): a clean styling primitive importable by both the
 * canvas share card and the React orb/trail surfaces.
 */
import type { RarityTier } from "@guezzer/core";
import { config } from "../config.ts";
import { getRarityIndex } from "./rarityIndex.ts";

/**
 * The rarity-tier fill/text hue. The single index into `config.dex.tierColors`
 * — every other surface routes through here. `"debut"` is the neutral state for
 * ??? / off-matrix / zero-history songs (gray, not a rarity).
 */
export function rarityColor(tier: RarityTier | "debut"): string {
  return config.dex.tierColors[tier];
}

/**
 * The shared song → rarity-tier bridge for the orb/trail surfaces, so they
 * never re-derive rarity independently. Resolves via the memoized corpus rarity
 * index: a null songId (pre-opener / ??? placeholder), a song absent from the
 * index (off-matrix), or a failed archive guard all degrade to the neutral
 * `"debut"` — mirroring the current muted-fallback semantics.
 */
export function rarityTierForSong(songId: number | null): RarityTier | "debut" {
  if (songId == null) return "debut";
  return getRarityIndex()?.get(songId)?.tier ?? "debut";
}

/**
 * The dark text color drawn ON a rarity fill (name + percentage on an orb).
 * Verified ≥4.5:1 against all six tier hues, which are all light-to-mid so
 * near-black text passes on each:
 *   debut #A1A1AA (~6.6:1), common #E4E4E7 (~13:1), uncommon #34D399 (~9.6:1),
 *   rare #60A5FA (~7.3:1), epic #A855F7 (~5.0:1), legendary #FB923C (~9.4:1).
 */
export const RARITY_ORB_TEXT_COLOR = "#0C0C10";
