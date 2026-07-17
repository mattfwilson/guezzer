/**
 * The orbit stage (04-UI-SPEC §Layout region 3): the current song at centre with
 * an adaptive 5–8 orb fan placed by the deterministic radial layout (SHOW-01/02;
 * never a force simulation). Presentational — it renders the candidates it is
 * given; data fetching / predict happens in ShowView (plan 04-04).
 *
 * It measures its own px box (ResizeObserver), runs `selectFan` → `layoutOrbs`,
 * computes `isWeakFan` once (D-10) and passes it to every orb plus a muted
 * weak-fan hint. Tap + why are callback props ready for wiring.
 */
import { useEffect, useRef, useState } from "react";
import type { TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import { isWeakFan } from "./confidence.ts";
import { layoutOrbs, selectFan } from "./orbitLayout.ts";
import { CenterNode } from "./CenterNode.tsx";
import { PredictionOrb, type OrbitCandidate } from "./PredictionOrb.tsx";

interface CurrentSong {
  songName: string;
  tuningFamily: TuningFamily | null;
}

interface OrbitStageProps {
  /** Current centre song, or null before the opener is seeded. */
  currentSong: CurrentSong | null;
  /** Ranked, tuning-enriched candidates (already sorted desc by score). */
  candidates: OrbitCandidate[];
  /** Log path: a plain orb tap logs a hit (SHOW-03). */
  onTapOrb: (candidate: OrbitCandidate) => void;
  /** Why path: the orb's Info dot opens the reason — never logs (D-11). */
  onWhy: (candidate: OrbitCandidate) => void;
}

export function OrbitStage({
  currentSong,
  candidates,
  onTapOrb,
  onWhy,
}: OrbitStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fan = selectFan(candidates);
  const weak = isWeakFan(candidates);
  const orbs =
    size.width > 0 && size.height > 0 ? layoutOrbs(fan, size) : [];

  return (
    <div
      ref={stageRef}
      className="orbit-stage relative flex-1 touch-none select-none overflow-hidden"
      style={{ overscrollBehavior: "none" }}
    >
      {/* Centre node — absolutely centred over the stage. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto">
          <CenterNode
            songName={currentSong?.songName ?? null}
            tuningFamily={currentSong?.tuningFamily ?? null}
          />
        </div>
      </div>

      {orbs.map((layout, i) => {
        const candidate = fan[i];
        return (
          <PredictionOrb
            key={candidate.songId}
            candidate={candidate}
            layout={layout}
            isWeak={weak}
            onTap={onTapOrb}
            onWhy={onWhy}
          />
        );
      })}

      {weak && fan.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center px-4 text-center">
          <span className="text-[14px] font-semibold leading-tight text-text-muted">
            {config.copy.show.weakFanHeading}
          </span>
          <span className="text-[14px] leading-tight text-text-muted">
            {config.copy.show.weakFanBody}
          </span>
        </div>
      )}
    </div>
  );
}
