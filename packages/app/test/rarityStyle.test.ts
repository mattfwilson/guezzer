import { describe, expect, it } from "vitest";
import type { RarityTier } from "@guezzer/core";
import {
  RARITY_ORB_TEXT_COLOR,
  rarityColor,
  rarityTierForSong,
} from "../src/dex/rarityStyle.ts";
import { config } from "../src/config.ts";
import { getRarityIndex } from "../src/dex/rarityIndex.ts";

/**
 * The single UI rarity-styling primitive (quick 260717-p4s). rarityColor is the
 * ONLY expression in the app that indexes config.dex.tierColors; every rarity
 * surface (chips, share card, orbs, trail) routes its hue through it, so a tier
 * recolor in config restyles every surface at once.
 */
describe("rarityStyle primitive", () => {
  const ALL_TIERS: Array<RarityTier | "debut"> = [
    "debut",
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
  ];

  it("rarityColor(tier) === config.dex.tierColors[tier] for every tier + debut", () => {
    for (const tier of ALL_TIERS) {
      expect(rarityColor(tier)).toBe(config.dex.tierColors[tier]);
    }
  });

  it("rarityTierForSong(null) is the neutral debut state", () => {
    expect(rarityTierForSong(null)).toBe("debut");
  });

  it("rarityTierForSong resolves a real corpus song's tier, debut when absent", () => {
    const index = getRarityIndex();
    expect(index).toBeTruthy();
    const [songId, rarity] = [...index!.entries()][0];
    expect(rarityTierForSong(songId)).toBe(rarity.tier);
    // A songId absent from the index (off-matrix) degrades to the debut neutral.
    expect(rarityTierForSong(-99999)).toBe("debut");
  });

  it("RARITY_ORB_TEXT_COLOR is the single dark on-fill text color", () => {
    expect(RARITY_ORB_TEXT_COLOR).toBe("#0C0C10");
  });
});
