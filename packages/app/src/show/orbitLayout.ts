/**
 * Deterministic radial layout for the orbit fan (SHOW-01/02, D-12). Pure math:
 * NO React, NO DOM reads — the viewport is passed in as `stage` (px), every
 * tunable is passed in as `cfg`, so the same `(rank, score, count, stage)` input
 * always produces the same orb positions (no drift between repredicts, SHOW-02).
 *
 * Placement rules (RESEARCH §Pattern 3):
 *   - angle: even by RANK, rank 0 at the top (-90°) — independent of score value.
 *   - radius: higher score → nearer the centre (equal-score divide-by-zero guarded).
 *   - diameter: higher score → larger, clamped to `cfg.orbMinDiameter` (never below
 *     the 44px hit floor, which ORB_MIN_DIAMETER=56 already clears).
 *
 * The displayed % is the ABSOLUTE score (see confidence.ts); only the geometry
 * here uses within-fan relative scaling so a fan of small scores still reads
 * sensibly. Scores are NEVER renormalized to sum to 1 (D-09).
 */
import { config } from "../config.ts";

/** One ranked candidate's layout-relevant input (a subset of PredictionCandidate). */
export interface OrbLayoutInput {
  songId: number;
  score: number;
}

/** A placed orb: absolute stage px + its clamped diameter. */
export interface OrbLayout {
  songId: number;
  x: number;
  y: number;
  diameterPx: number;
}

/** Measured stage size in px (passed in — the helper never reads the DOM). */
export interface OrbitStageSize {
  width: number;
  height: number;
}

/** All layout tunables, injected so the helper stays pure/testable. */
export interface OrbLayoutConfig {
  orbMinDiameter: number;
  orbMaxDiameter: number;
  ringInsetPx: number;
  innerRadiusRatio: number;
}

/** Adaptive-fan tunables (D-12). */
export interface FanConfig {
  min: number;
  max: number;
  dropScore: number;
}

/** Guards the equal-score span against a divide-by-zero. */
const SPAN_EPSILON = 1e-6;

/** Default layout cfg, sourced from `config.show` (no scattered magic numbers, CLAUDE.md). */
export const defaultOrbLayoutConfig: OrbLayoutConfig = {
  orbMinDiameter: config.show.ORB_MIN_DIAMETER,
  orbMaxDiameter: config.show.ORB_MAX_DIAMETER,
  ringInsetPx: config.show.RING_INSET_PX,
  innerRadiusRatio: config.show.ORB_INNER_RADIUS_RATIO,
};

/** Default adaptive-fan cfg, sourced from `config.show`. */
export const defaultFanConfig: FanConfig = {
  min: config.show.ORB_COUNT_MIN,
  max: config.show.ORB_COUNT_MAX,
  dropScore: config.show.ORB_DROP_SCORE,
};

/**
 * Adaptive 5–8 fan selector (D-12): drop candidates scoring below `dropScore`,
 * but always keep at least `min` and never more than `max`. `candidates` MUST be
 * sorted desc by score (predict() already returns them that way). Never
 * renormalizes.
 */
export function selectFan<T extends OrbLayoutInput>(
  candidates: readonly T[],
  cfg: FanConfig = defaultFanConfig,
): T[] {
  const aboveDrop = candidates.filter((c) => c.score >= cfg.dropScore).length;
  // Keep everything above the drop score, but clamp into [min, max]. Taking the
  // slice from the sorted list means the MIN floor may include a few sub-drop
  // orbs (D-12: "always ≥5") — that is intentional and honest.
  const count = Math.min(cfg.max, Math.max(cfg.min, aboveDrop));
  return candidates.slice(0, count);
}

/**
 * Place `candidates` (5–8, sorted desc) around the centre node. Pure and
 * deterministic — identical input yields deep-equal output.
 */
export function layoutOrbs(
  candidates: readonly OrbLayoutInput[],
  stage: OrbitStageSize,
  cfg: OrbLayoutConfig = defaultOrbLayoutConfig,
): OrbLayout[] {
  const n = candidates.length;
  if (n === 0) return [];

  const cx = stage.width / 2;
  const cy = stage.height / 2;
  const top = candidates[0].score;
  const min = candidates[n - 1].score;
  const span = Math.max(top - min, SPAN_EPSILON); // guard equal-score divide-by-zero
  const rMax = Math.min(cx, cy) - cfg.ringInsetPx; // outer bound keeps orbs off edges/notches
  const rMin = rMax * cfg.innerRadiusRatio; // inner bound clears the centre node
  const diaSpan = cfg.orbMaxDiameter - cfg.orbMinDiameter;

  return candidates.map((c, i) => {
    // angle: even by RANK, rank 0 at the top (-90°); deterministic, score-independent.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    // t: 0 for the top score, 1 for the weakest — drives radius + diameter together.
    const t = (top - c.score) / span;
    const r = rMin + t * (rMax - rMin);
    const diameterPx = Math.max(cfg.orbMinDiameter, cfg.orbMaxDiameter - t * diaSpan);
    return {
      songId: c.songId,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      diameterPx,
    };
  });
}
