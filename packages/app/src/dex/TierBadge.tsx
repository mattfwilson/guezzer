/**
 * The rarity/debut pill (06-06, D-15 / §B3). A Label-size pill whose WORD always
 * renders — color is reinforcement only (color-blind safety, WCAG 1.4.1). The
 * tier hue colors the text and a 40%-opacity border; the fill stays transparent
 * on the secondary surface. This is the ONLY place the two new Phase-6 hues
 * (`#60A5FA` Uncommon / `#E879F9` Rare) appear — the ramp is data semantics,
 * never chrome (never a button/surface/focus color).
 *
 * `tier="debut"` is the STAT-04 debut-candidate framing: a distinct, neutral
 * pill for zero-live-history songs — no rarity tier, no fake precision.
 */
import type { RarityTier } from "@guezzer/core";
import { config } from "../config.ts";

/** Tier → text/border hue (06-UI-SPEC §B3). Debut is neutral muted — not a tier. */
const TIER_COLOR: Record<RarityTier | "debut", string> = {
  common: "#A1A1AA", // reuses text-muted — unremarkable by design
  uncommon: "#60A5FA", // NEW hue, zero collision elsewhere in the app
  rare: "#E879F9", // NEW hue, hotter than tuning C#-violet (never co-occur)
  legendary: "#F2C14E", // reuses accent gold — scarce by construction (D-15)
  debut: "#A1A1AA", // neutral — debut is a state, not a rarity
};

interface TierBadgeProps {
  tier: RarityTier | "debut";
}

export function TierBadge({ tier }: TierBadgeProps) {
  const color = TIER_COLOR[tier];
  const label =
    tier === "debut" ? config.copy.dex.debutBadge : config.copy.dex.tierLabels[tier];

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[14px] font-semibold leading-tight"
      style={{ color, borderColor: `${color}66` }}
    >
      {label}
    </span>
  );
}
