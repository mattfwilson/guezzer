/**
 * One tappable prediction orb (SHOW-01/02/03/10, D-09/D-10/D-11). Presentational
 * only — all data/predict wiring lives in ShowView (plan 04-04).
 *
 * Contract:
 *   - Absolutely positioned at the layout's stage px, sized by `diameterPx`
 *     (≥ ORB_MIN_DIAMETER via layoutOrbs) with a `min-h-11 min-w-11` hit floor.
 *   - Face shows truncated song name + ABSOLUTE `formatOrbPercent(score)`
 *     (`tabular-nums`); fill from the song's RARITY TIER (`rarityColor` via
 *     `rarityTierForSong`, quick 260717-p4s) — no longer tuning family.
 *   - A quick face TAP → `onTap` (log path, SHOW-03). A LONG-PRESS on the face
 *     (config `ORB_LONG_PRESS_MS`) → `onWhy` and suppresses the trailing tap so a
 *     hold never also logs (D-11: the why path never logs). Native long-press
 *     side effects (iOS callout, context menu, selection) are suppressed.
 *   - The old visible (i) dot is now `sr-only`: long-press is a hidden gesture
 *     with no keyboard/AT equivalent (WCAG 2.5.1/2.1.1), so a real, focusable
 *     "Why {song}?" button stays in the tree for keyboard + screen readers while
 *     the sighted-touch affordance becomes the hold. Owner accepts the hidden
 *     gesture for this personal tool; the AT button preserves the a11y contract.
 *   - Weak-fan softening (D-10): reduced opacity + desaturation when `isWeak`.
 */
import { useEffect, useRef } from "react";
import { Info } from "lucide-react";
import type { PredictionCandidate, TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import type { OrbLayout } from "./orbitLayout.ts";
import { formatOrbPercent } from "./confidence.ts";
import { fitOrbLabel } from "./orbLabelFit.ts";
import { RARITY_ORB_TEXT_COLOR, rarityColor, rarityTierForSong } from "../dex/rarityStyle.ts";

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
  /** True while this orb is the one gliding to the centre (collapse): its confidence
   *  %, no longer a prediction, fades out over the glide so it's gone as it lands. */
  collapsing?: boolean;
}

export function PredictionOrb({
  candidate,
  layout,
  isWeak,
  onTap,
  onWhy,
  collapsing = false,
}: PredictionOrbProps) {
  const fill = rarityColor(rarityTierForSong(candidate.songId));
  const percent = formatOrbPercent(candidate.score);

  // D-21 + POLISH-01 (08-08): wrap + scale-to-fit the full name inside this orb's
  // CIRCLE. Fit against the CONTENT diameter (raw diameter minus the `px-1` face
  // padding per side) and reserve vertical room for the always-present percent line
  // below, so the circle-aware fitter never over-grants width/height. Pure — no
  // re-layout of the fan.
  const fit = fitOrbLabel(
    candidate.songName,
    layout.diameterPx - 2 * config.show.ORB_LABEL_FACE_PADDING_PX,
    {
      baseFontPx: config.show.ORB_LABEL_BASE_FONT_PX,
      minFontPx: config.show.ORB_LABEL_MIN_FONT_PX,
      maxLines: config.show.ORB_LABEL_MAX_LINES,
      lineHeightFactor: config.show.ORB_LABEL_LINE_HEIGHT_FACTOR,
      reservedHeightPx: config.show.ORB_LABEL_PERCENT_LINE_PX,
    },
  );

  // Long-press → why; quick tap → log. A pointerdown arms a timer; if it fires
  // before release (and the pointer hasn't drifted past the move threshold, which
  // reads as a scroll/drag) we open the why sheet and flag the gesture so the
  // trailing click does NOT also log. Timer is cleared on any release/leave/cancel
  // or drift, and on unmount so a held-then-unmounted orb can't fire late.
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  useEffect(() => clearLongPress, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    longPressFired.current = false;
    pressStart.current = { x: event.clientX, y: event.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onWhy(candidate);
    }, config.show.ORB_LONG_PRESS_MS);
  };
  const handlePointerMove = (event: React.PointerEvent) => {
    const start = pressStart.current;
    if (!start) return;
    const moved = config.show.ORB_LONG_PRESS_MOVE_PX;
    if (
      Math.abs(event.clientX - start.x) > moved ||
      Math.abs(event.clientY - start.y) > moved
    ) {
      clearLongPress();
    }
  };
  const handlePointerEnd = () => {
    clearLongPress();
    pressStart.current = null;
  };
  const handleTap = () => {
    // Swallow the click that trails a fired long-press so a hold never logs.
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onTap(candidate);
  };

  // The face-tap control and the "why" control are SIBLINGS inside a
  // non-interactive wrapper — never nested (WR-02). Nesting an interactive
  // element inside the face <button> is invalid HTML and a WCAG name/role
  // violation; as siblings each is a real, independently-labelled control (tap
  // face → log SHOW-03; long-press face OR activate the sr-only why button →
  // why, never logs, D-11). Positioning + enter/exit motion is owned by the
  // OrbitStage wrapper (this fills it, w-full/h-full); only the weak-fan
  // softening (D-10) lives here.
  return (
    <div
      className="relative h-full w-full"
      style={{
        opacity: isWeak ? 0.55 : 1,
        filter: isWeak ? "saturate(0.5)" : undefined,
      }}
    >
      <button
        type="button"
        onClick={handleTap}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={`Log ${candidate.songName}, ${percent} confidence`}
        className="flex h-full w-full min-h-11 min-w-11 select-none flex-col items-center justify-center rounded-full px-1 text-center touch-manipulation motion-safe:transition-all motion-safe:duration-200"
        style={{
          backgroundColor: fill,
          color: RARITY_ORB_TEXT_COLOR,
          WebkitTouchCallout: "none",
        }}
      >
        <span
          className="flex max-w-full flex-col items-center font-semibold leading-tight"
          style={{ fontSize: fit.fontPx }}
        >
          {fit.lines.map((line, i) => (
            <span key={i} className="max-w-full">
              {line}
            </span>
          ))}
        </span>
        <span
          className="text-[14px] font-semibold leading-tight tabular-nums motion-safe:transition-opacity"
          style={{
            opacity: collapsing ? 0 : 1,
            transitionDuration: `${config.show.orbitAnim.COLLAPSE_MS}ms`,
          }}
        >
          {percent}
        </span>
      </button>

      {/* Why affordance (D-11) — now sr-only: the sighted-touch path is the
          face long-press, but this real, focusable button keeps the "why" path
          reachable by keyboard + screen readers (WCAG 2.5.1/2.1.1). It never
          logs (a sibling of the face button, not nested). */}
      <button
        type="button"
        aria-label={`Why ${candidate.songName}?`}
        onClick={() => onWhy(candidate)}
        className="sr-only"
      >
        <Info size={16} />
      </button>
    </div>
  );
}
