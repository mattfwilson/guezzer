/**
 * The orbit stage (04-UI-SPEC §Layout region 3): the current song at centre with
 * an adaptive fan placed by the deterministic radial layout (SHOW-01/02; never a
 * force simulation). Presentational — it renders the candidates it is given; data
 * fetching / predict happens in ShowView (plan 04-04).
 *
 * It measures its own px box (ResizeObserver), runs `selectFan` → `layoutOrbs`,
 * computes `isWeakFan` once (D-10) and passes it to every orb.
 *
 * Choreography (owner 2026-07-17, "cinematic & sequenced", `motion`):
 *   - FAN-OUT: whenever the current song changes the orbs mount and spread from
 *     behind the centre to their ring seats (staggered by rank, smooth easing).
 *   - FLOAT: each orb drifts subtly in place (CSS `.orb-float`) so the fan feels
 *     alive; the centre orb breathes (`.orb-breathe`).
 *   - COLLAPSE (on tapping a prediction orb): the tapped orb glides to the centre
 *     while the others dissolve; the next fan is held until the collapse finishes
 *     (SEQUENTIAL). Taps are ignored during that collapse window, never lost —
 *     the log is persisted immediately via `onTapOrb`.
 * All of the above is disabled under `prefers-reduced-motion` (instant swaps).
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
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
  /** Why path: the orb's long-press / sr-only why control opens the reason — never logs (D-11). */
  onWhy: (candidate: OrbitCandidate) => void;
  /** Pre-opener: tapping the center prompt opens Search to seed the opener (SHOW-04). */
  onOpenSearch: () => void;
}

/** The tapped-orb collapse animation: a frozen snapshot of the OUTGOING fan +
 *  centre so we can glide the selected orb to centre and dissolve the rest before
 *  adopting the (already-live) new fan. */
interface CollapseState {
  selectedId: number;
  orbs: OrbitCandidate[];
  layouts: ReturnType<typeof layoutOrbs>;
  center: CurrentSong | null;
}

/** Standard fan easings (cubic-bezier). */
const EASE_FAN_OUT = [0.22, 1, 0.36, 1] as const; // easeOutQuint-ish — a lively open
const EASE_COLLAPSE = [0.4, 0, 0.2, 1] as const; // standard — a settled glide

/** Deterministic per-orb idle-float CSS vars (varied by song id so orbs desync). */
function floatVars(songId: number): React.CSSProperties {
  const { FLOAT_PX, FLOAT_PERIOD_MS } = config.show.orbitAnim;
  const angle = ((songId * 47) % 360) * (Math.PI / 180);
  const fx = Math.round(Math.cos(angle) * FLOAT_PX);
  const fy = Math.round(Math.sin(angle) * FLOAT_PX);
  const delay = -(((songId * 31) % FLOAT_PERIOD_MS)); // negative → start mid-phase
  return {
    "--float-x": `${fx}px`,
    "--float-y": `${fy}px`,
    "--float-period": `${FLOAT_PERIOD_MS}ms`,
    "--float-delay": `${delay}ms`,
  } as React.CSSProperties;
}

export function OrbitStage({
  currentSong,
  candidates,
  onTapOrb,
  onWhy,
  onOpenSearch,
}: OrbitStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reduce = useReducedMotion() ?? false;

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

  // The tapped-orb collapse; cleared after COLLAPSE_MS so the next fan spreads
  // (sequential). A timeout, not motion's onAnimationComplete, so the phase
  // advances on a deterministic clock even if an orb unmounts mid-glide.
  const [collapse, setCollapse] = useState<CollapseState | null>(null);
  useEffect(() => {
    if (!collapse) return;
    const t = window.setTimeout(
      () => setCollapse(null),
      config.show.orbitAnim.COLLAPSE_MS,
    );
    return () => window.clearTimeout(t);
  }, [collapse]);

  const laidOut = size.width > 0 && size.height > 0;
  const fan = selectFan(candidates);
  const weak = isWeakFan(candidates);
  const orbs = laidOut ? layoutOrbs(fan, size) : [];

  const handleTap = (candidate: OrbitCandidate) => {
    // Sequential: ignore taps while a collapse is playing (the log isn't lost —
    // the user simply taps once; nothing is queued mid-choreography).
    if (collapse) return;
    // Snapshot the CURRENT fan/centre so the collapse can animate the outgoing
    // set even though onTapOrb immediately flips the live props to the new song.
    if (!reduce && laidOut) {
      setCollapse({
        selectedId: candidate.songId,
        orbs: fan,
        layouts: orbs,
        center: currentSong,
      });
    }
    onTapOrb(candidate);
  };

  // During a collapse we render the frozen snapshot; otherwise the live fan.
  const inCollapse = collapse !== null;
  const renderOrbs = inCollapse ? collapse.orbs : fan;
  const renderLayouts = inCollapse ? collapse.layouts : orbs;
  const renderCenter = inCollapse ? collapse.center : currentSong;
  // Remount-on-centre-change → guarantees a fresh fan-out for every new song.
  const centerKey = renderCenter?.songName ?? "pre-opener";

  const cx = size.width / 2;
  const cy = size.height / 2;
  const dur = (ms: number) => (reduce ? 0 : ms / 1000);

  return (
    <div
      ref={stageRef}
      className="orbit-stage relative flex-1 touch-none select-none overflow-hidden"
      style={{ overscrollBehavior: "none" }}
    >
      {/* Centre node — absolutely centred over the stage. During a collapse the
          OUTGOING song shrinks + fades out (making room for the arriving orb);
          when the collapse clock clears, the content swaps to the new song and it
          scales back in — so the tapped orb reads as "becoming" the current song. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className="pointer-events-auto"
          initial={false}
          animate={
            !reduce && inCollapse
              ? { scale: 0.3, opacity: 0 }
              : { scale: 1, opacity: 1 }
          }
          transition={{
            duration: inCollapse
              ? dur(config.show.orbitAnim.COLLAPSE_MS)
              : dur(config.show.orbitAnim.CENTER_IN_MS),
            ease: inCollapse ? EASE_COLLAPSE : EASE_FAN_OUT,
          }}
        >
          <CenterNode
            songName={renderCenter?.songName ?? null}
            tuningFamily={renderCenter?.tuningFamily ?? null}
            onOpenSearch={onOpenSearch}
          />
        </motion.div>
      </div>

      {laidOut &&
        renderOrbs.map((candidate, i) => {
          const layout = renderLayouts[i];
          if (!layout) return null;
          const d = layout.diameterPx;
          const dx = layout.x - cx;
          const dy = layout.y - cy;
          const isSelected = inCollapse && candidate.songId === collapse.selectedId;

          // Fan-out from behind the centre: start translated back to centre,
          // small + transparent; the resting seat is x/y = 0 (see wrapper left/top).
          const initial = reduce
            ? false
            : { x: -dx, y: -dy, scale: 0.2, opacity: 0 };

          let animate: Record<string, number>;
          let transition: Record<string, unknown>;
          if (inCollapse && isSelected) {
            // Glide the tapped orb onto the centre, growing to its size, fading out.
            animate = {
              x: -dx,
              y: -dy,
              scale: config.show.ORB_CENTER_DIAMETER / d,
              opacity: 0,
            };
            transition = { duration: dur(config.show.orbitAnim.COLLAPSE_MS), ease: EASE_COLLAPSE };
          } else if (inCollapse) {
            // Dissolve the unselected orbs to clear the stage.
            animate = { x: 0, y: 0, scale: 0.6, opacity: 0 };
            transition = { duration: dur(config.show.orbitAnim.COLLAPSE_MS * 0.7), ease: EASE_COLLAPSE };
          } else {
            // Rest / fan-out target — staggered by rank so the fan opens in order.
            animate = { x: 0, y: 0, scale: 1, opacity: 1 };
            transition = {
              duration: dur(config.show.orbitAnim.FAN_OUT_MS),
              ease: EASE_FAN_OUT,
              delay: dur(config.show.orbitAnim.FAN_OUT_STAGGER_MS * i),
            };
          }

          return (
            <motion.div
              key={`${centerKey}:${candidate.songId}`}
              initial={initial}
              animate={animate}
              transition={transition}
              style={{
                position: "absolute",
                left: layout.x - d / 2,
                top: layout.y - d / 2,
                width: d,
                height: d,
              }}
            >
              {/* Inner float wrapper — its transform composes with motion's on the
                  outer element, so the idle drift never fights the fan-out/glide. */}
              <div className="orb-float h-full w-full" style={floatVars(candidate.songId)}>
                <PredictionOrb
                  candidate={candidate}
                  layout={layout}
                  isWeak={weak}
                  onTap={handleTap}
                  onWhy={onWhy}
                />
              </div>
            </motion.div>
          );
        })}

      {weak && !inCollapse && fan.length > 0 && (
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
