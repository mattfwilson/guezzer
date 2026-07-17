/**
 * The rarity/debut pill (06-06, D-15 / §B3). A Label-size pill whose WORD always
 * renders — color is reinforcement only (color-blind safety, WCAG 1.4.1). The
 * pill reads its hue from the single `config.dex.tierColors` source of truth
 * (shared with the share card — no second map to drift); the hue colors the text
 * and a 40%-opacity border while the fill stays transparent on the secondary
 * surface. The ramp is data semantics, never chrome (never a button/surface/focus
 * color).
 *
 * `tier="debut"` is the STAT-04 debut-candidate framing: a distinct, neutral pill
 * for zero-live-history songs — no rarity tier, no fake precision. The debut pill
 * alone renders a DOTTED border to read as "not-yet-a-tier"; every real tier keeps
 * a solid border.
 */
import type { RarityTier } from "@guezzer/core";
import { config } from "../config.ts";

interface TierBadgeProps {
  tier: RarityTier | "debut";
}

export function TierBadge({ tier }: TierBadgeProps) {
  const color = config.dex.tierColors[tier];
  const label =
    tier === "debut" ? config.copy.dex.debutBadge : config.copy.dex.tierLabels[tier];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[14px] font-semibold leading-tight${
        tier === "debut" ? " border-dotted" : ""
      }`}
      style={{ color, borderColor: `${color}66` }}
    >
      {label}
    </span>
  );
}
