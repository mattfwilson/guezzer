/**
 * Deterministic radial layout for the orbit fan (SHOW-01/02, D-12). Pure math:
 * NO React, NO DOM reads — the viewport is passed in as `stage` (px), every
 * tunable is passed in as `cfg`, so the same `(rank, score, count, stage)` input
 * always produces the same orb positions (no drift between repredicts, SHOW-02).
 *
 * Placement rules (owner 2026-07-17 — evenly-spread non-overlapping ring):
 *   - angle: even by RANK, rank 0 at the top (-90°), every 360°/n clockwise —
 *     so the orbs sit at the vertices of a regular polygon around the centre.
 *   - radius: a SINGLE shared ring radius (equidistant orbs = maximally even
 *     spread) — score is conveyed by rank order + the % label, not by radius.
 *   - diameter: a SINGLE uniform diameter, grown as large as will fit the stage
 *     WITHOUT overlapping ring neighbours or the centre node, then clamped to
 *     [orbMinDiameter, orbMaxDiameter] (never below the 44px hit floor, which
 *     ORB_MIN_DIAMETER=56 already clears). Closed-form solver — see layoutOrbs.
 *
 * The displayed % is the ABSOLUTE score (see confidence.ts). Scores are NEVER
 * renormalized to sum to 1 (D-09).
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
  /** Centre-node diameter the ring must clear so no orb overlaps the current song. */
  centerDiameter: number;
  /** Min gap between adjacent orbs AND between an orb and the centre node. */
  orbGapPx: number;
}

/** Adaptive-fan tunables (D-12). */
export interface FanConfig {
  min: number;
  max: number;
  dropScore: number;
}


/** Default layout cfg, sourced from `config.show` (no scattered magic numbers, CLAUDE.md). */
export const defaultOrbLayoutConfig: OrbLayoutConfig = {
  orbMinDiameter: config.show.ORB_MIN_DIAMETER,
  orbMaxDiameter: config.show.ORB_MAX_DIAMETER,
  ringInsetPx: config.show.RING_INSET_PX,
  centerDiameter: config.show.ORB_CENTER_DIAMETER,
  orbGapPx: config.show.ORB_RING_GAP_PX,
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
 * Place `candidates` (≤5, sorted desc) evenly around the centre node on a single
 * ring. Pure and deterministic — identical input yields deep-equal output.
 *
 * The uniform orb diameter D and shared ring radius R are chosen so orbs are as
 * LARGE as possible while (a) staying inside the stage, (b) not overlapping ring
 * neighbours, and (c) clearing the centre node. With orbs pushed to the outer
 * edge R = outer − D/2 (outer = the max orb-EDGE distance from centre), the three
 * constraints reduce to two upper bounds on D:
 *   - fit + no-overlap: chord 2·R·sin(π/n) ≥ D + gap  ⇒  D ≤ (2·sin(π/n)·outer − gap)/(1 + sin(π/n))
 *   - fit + clear-centre: R − D/2 ≥ centreRadius + gap ⇒  D ≤ outer − (centreDiameter/2 + gap)
 * Take the smaller, clamp to [min, max], then R = outer − D/2.
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
  const outer = Math.min(cx, cy) - cfg.ringInsetPx; // max orb-EDGE distance from centre
  const centerClear = cfg.centerDiameter / 2 + cfg.orbGapPx; // min orb-EDGE distance (inner)
  const s = Math.sin(Math.PI / n); // half the angular step between adjacent orbs

  // Upper bounds on a uniform diameter (see the doc-comment derivation); a single
  // orb has no ring neighbour, so only the centre-clearance bound applies.
  const overlapBound =
    n > 1 ? (2 * s * outer - cfg.orbGapPx) / (1 + s) : Number.POSITIVE_INFINITY;
  const centerBound = outer - centerClear;
  const diameterPx = Math.max(
    cfg.orbMinDiameter,
    Math.min(cfg.orbMaxDiameter, overlapBound, centerBound),
  );
  const r = outer - diameterPx / 2; // push orbs to the outer edge

  return candidates.map((c, i) => {
    // angle: even by RANK, rank 0 at the top (-90°), clockwise; score-independent.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      songId: c.songId,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      diameterPx,
    };
  });
}
