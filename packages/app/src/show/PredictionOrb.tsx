/**
 * One tappable prediction orb (SHOW-01/02/03/10, D-09/D-10/D-11). Presentational
 * only — all data/predict wiring lives in ShowView (plan 04-04).
 *
 * Contract:
 *   - Absolutely positioned at the layout's stage px, sized by `diameterPx`
 *     (≥ ORB_MIN_DIAMETER via layoutOrbs) with a `min-h-11 min-w-11` hit floor.
 *   - Face shows truncated song name + ABSOLUTE `formatOrbPercent(score)`
 *     (`tabular-nums`); family fill from `tuningColor`.
 *   - The whole face taps → `onTap` (log path, SHOW-03). A SEPARATE `Info` dot
 *     taps → `onWhy` ONLY (D-11: Info never logs) via stopPropagation.
 *   - Weak-fan softening (D-10): reduced opacity + desaturation when `isWeak`.
 */
import { Info } from "lucide-react";
import type { PredictionCandidate, TuningFamily } from "@guezzer/core";
import type { OrbLayout } from "./orbitLayout.ts";
import { formatOrbPercent } from "./confidence.ts";
import { ORB_TEXT_COLOR, tuningColor } from "./tuningColor.ts";

/** A ranked candidate enriched with its tuning family (resolved from the matrix node in ShowView). */
export interface OrbitCandidate extends PredictionCandidate {
  tuningFamily: TuningFamily | null;
}

interface PredictionOrbProps {
  candidate: OrbitCandidate;
  layout: OrbLayout;
  /** True when the whole fan is weak (D-10) — softens this orb visually. */
  isWeak: boolean;
  /** Log path: a plain face tap logs the orb as a hit (SHOW-03). */
  onTap: (candidate: OrbitCandidate) => void;
  /** Why path: the Info dot opens the verbatim reason — NEVER logs (D-11). */
  onWhy: (candidate: OrbitCandidate) => void;
}

export function PredictionOrb({
  candidate,
  layout,
  isWeak,
  onTap,
  onWhy,
}: PredictionOrbProps) {
  const fill = tuningColor(candidate.tuningFamily);
  const percent = formatOrbPercent(candidate.score);

  return (
    <button
      type="button"
      onClick={() => onTap(candidate)}
      aria-label={`Log ${candidate.songName}, ${percent} confidence`}
      className="absolute flex min-h-11 min-w-11 select-none flex-col items-center justify-center rounded-full px-1 text-center touch-manipulation motion-safe:transition-all motion-safe:duration-200"
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.diameterPx,
        height: layout.diameterPx,
        transform: "translate(-50%, -50%)",
        backgroundColor: fill,
        color: ORB_TEXT_COLOR,
        opacity: isWeak ? 0.55 : 1,
        filter: isWeak ? "saturate(0.5)" : undefined,
      }}
    >
      <span className="max-w-full truncate text-[14px] font-semibold leading-tight">
        {candidate.songName}
      </span>
      <span className="text-[14px] font-semibold leading-tight tabular-nums">
        {percent}
      </span>

      {/* Separate "why" affordance (D-11) — stopPropagation so it never logs. */}
      <span
        role="button"
        tabIndex={0}
        aria-label={`Why ${candidate.songName}?`}
        onClick={(event) => {
          event.stopPropagation();
          onWhy(candidate);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation();
            event.preventDefault();
            onWhy(candidate);
          }
        }}
        className="absolute -right-1 -top-1 flex min-h-8 min-w-8 items-center justify-center rounded-full bg-surface/80 text-text-muted"
      >
        <Info size={16} />
      </span>
    </button>
  );
}
