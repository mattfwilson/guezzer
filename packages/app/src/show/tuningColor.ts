/**
 * Tuning-family → orb fill color (04-UI-SPEC §B1, RESEARCH Pitfall 3). Keys off
 * the EXACT core union (`"standard" | "cs-standard" | "microtonal" | "other"`,
 * from `tuning-tags.ts`) — NEVER the UI-SPEC display label "C# standard", which
 * would silently miss. All four literals are mapped; an unmapped/missing family
 * falls back to text-muted (`#A1A1AA`), never an invented color.
 *
 * Fills are light pastels chosen for ≥3:1 graphical contrast against the
 * `#0C0C10` stage (WCAG 1.4.11). On-orb text therefore uses the dark surface
 * color (`ORB_TEXT_COLOR`), which clears 4.5:1 on every family fill.
 */
import type { TuningFamily } from "@guezzer/core";

/** Muted neutral (text-muted) — the fallback for an unmapped/missing family. */
const FALLBACK_COLOR = "#A1A1AA";

const TUNING_FAMILY_COLORS: Record<TuningFamily, string> = {
  standard: "#5EC8E5", // cyan — most of the catalog
  "cs-standard": "#B98CF2", // violet — C# standard (metal material); absent in today's data
  microtonal: "#FF8A5B", // warm coral — gold-shifted, kept distinct from chrome accent
  other: FALLBACK_COLOR, // muted neutral
};

/** Dark on-orb text color — clears 4.5:1 on all four (light) family fills. */
export const ORB_TEXT_COLOR = "#0C0C10";

/**
 * Resolve a tuning family to its orb/center fill hex. Unmapped or null/undefined
 * → muted fallback.
 */
export function tuningColor(family: TuningFamily | null | undefined): string {
  if (family == null) return FALLBACK_COLOR;
  return TUNING_FAMILY_COLORS[family] ?? FALLBACK_COLOR;
}
