/**
 * One outgoing-transition bar row in the NodeSheet (EXPL-02, D-01/D-02/D-16).
 * The WHOLE row is a ≥44px tappable chain-hop: tapping it selects this bar's
 * target song as the new focus (D-16), which refocuses the canvas and reloads
 * the sheet with that song's bars.
 *
 * Visual (§B1/§Typography): a `#2A2A34` track with a fill whose width is the raw
 * outgoing percentage and whose color is the TARGET song's tuning family at 60%
 * opacity (the bar represents a song). Name + `{pct}%` render in Label semibold,
 * `tabular-nums`; `<1%` never renders a bare `0%` (inherited rule). The muted
 * "why" line is assembled from the raw edge stats via `config.copy.explore.barWhy`
 * (count / total / lastDate / segueCount) — zero new derivation (D-02).
 *
 * Song names are kglw-derived and render as React text ONLY — never
 * `dangerouslySetInnerHTML` (T-07-05, inherited T-04-14, ASVS V5).
 *
 * The caught-tick (green Check / hollow circle) is wired live for the dex overlay:
 * ExploreView passes `caught` through when the overlay is active, so the tick
 * draws. It only stays absent in the fallback — when `caught` is `undefined`
 * (overlay off / not passed) — so no leading indicator renders.
 */
import { Check, ChevronRight } from "lucide-react";
import type { OutgoingBar, TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import { tuningColor } from "../show/tuningColor.ts";

/** hit-green (§B2) — the caught success semantic, reused, not re-derived. */
const CAUGHT_GREEN = "#22C55E";

interface RankedBarProps {
  /** One ranked outgoing edge — raw stats off the matrix (D-01/D-02). */
  bar: OutgoingBar;
  /** The outgoing denominator (sum of all outgoing counts) for the "why" line. */
  total: number;
  /** Resolved target song name (kglw-derived, React text only). */
  targetName: string;
  /** Target song tuning family → bar fill color (§B1). */
  targetTuningFamily: TuningFamily;
  /**
   * Dex-overlay caught state (D-11): green Check when caught, hollow circle when
   * not. Passed live by ExploreView when the overlay is active; `undefined`
   * (overlay off / not passed) → no leading indicator renders.
   */
  caught?: boolean;
  /** Chain-hop (D-16): make this bar's target the new focus. */
  onSelect: (songId: number) => void;
}

export function RankedBar({
  bar,
  total,
  targetName,
  targetTuningFamily,
  caught,
  onSelect,
}: RankedBarProps) {
  // pct is a 0..1 fraction; every edge has count ≥ 1 so it is always > 0. Never
  // render a bare "0%" for a sub-1% share (inherited rule).
  const pctVal = bar.pct * 100;
  const pctLabel = pctVal < 1 ? "<1%" : `${Math.round(pctVal)}%`;
  const why = config.copy.explore.barWhy(
    bar.count,
    total,
    bar.lastDate,
    bar.segueCount,
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(bar.songId)}
      className="relative flex min-h-11 w-full flex-col justify-center gap-1 overflow-hidden border-b border-hairline px-4 py-2 text-left touch-manipulation"
    >
      {/* Track + fill (§B1) — behind the content, non-interactive. */}
      <span aria-hidden className="absolute inset-0 bg-[#2A2A34]" />
      <span
        aria-hidden
        className="absolute inset-y-0 left-0"
        style={{
          width: `${pctVal}%`,
          backgroundColor: tuningColor(targetTuningFamily),
          opacity: 0.6,
        }}
      />

      <span className="relative flex items-center gap-2">
        {/* Caught-tick — drawn live when the dex overlay passes `caught`. */}
        {caught === true ? (
          <Check
            size={16}
            color={CAUGHT_GREEN}
            aria-hidden
            className="shrink-0"
          />
        ) : caught === false ? (
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 rounded-full border border-hairline"
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-tight text-text-primary">
          {targetName}
        </span>
        <span className="shrink-0 text-[14px] font-semibold leading-tight tabular-nums text-text-primary">
          {pctLabel}
        </span>
        <ChevronRight
          size={16}
          aria-hidden
          className="shrink-0 text-text-muted"
        />
      </span>
      <span className="relative text-base leading-normal text-text-muted">
        {why}
      </span>
    </button>
  );
}
