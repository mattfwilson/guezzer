import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  layoutOrbs,
  selectFan,
  type OrbLayoutConfig,
  type OrbLayoutInput,
} from "../src/show/orbitLayout.ts";

/**
 * Deterministic radial-layout math (SHOW-01/02, D-12). All constants come from
 * an explicit cfg so the fn stays pure/testable — never inline literals.
 */
const CFG: OrbLayoutConfig = {
  orbMinDiameter: config.show.ORB_MIN_DIAMETER,
  orbMaxDiameter: config.show.ORB_MAX_DIAMETER,
  ringInsetPx: config.show.RING_INSET_PX,
  centerDiameter: config.show.ORB_CENTER_DIAMETER,
  orbGapPx: config.show.ORB_RING_GAP_PX,
};

const STAGE = { width: 360, height: 640 };

/** Descending-score fan of `n` candidates (predict() already returns desc). */
function fan(n: number, top = 0.24, step = 0.02): OrbLayoutInput[] {
  return Array.from({ length: n }, (_, i) => ({
    songId: 100 + i,
    score: Math.max(top - i * step, 0.001),
  }));
}

describe("orbitLayout.layoutOrbs", () => {
  it("orbitLayout is deterministic — same (rank, score, count, stage) → deep-equal output", () => {
    const input = fan(6);
    const a = layoutOrbs(input, STAGE, CFG);
    const b = layoutOrbs(input, STAGE, CFG);
    expect(a).toEqual(b);
  });

  it("orbitLayout gives every orb a diameter ≥ ORB_MIN_DIAMETER regardless of probability", () => {
    // Include a near-zero score orb — it must still clamp to the visual floor.
    const input = [...fan(7), { songId: 999, score: 0.0005 }];
    const layout = layoutOrbs(input, STAGE, CFG);
    for (const orb of layout) {
      expect(orb.diameterPx).toBeGreaterThanOrEqual(CFG.orbMinDiameter);
    }
  });

  it("orbitLayout keeps every orb centre within the stage bounds", () => {
    const layout = layoutOrbs(fan(8), STAGE, CFG);
    for (const orb of layout) {
      expect(orb.x).toBeGreaterThanOrEqual(0);
      expect(orb.x).toBeLessThanOrEqual(STAGE.width);
      expect(orb.y).toBeGreaterThanOrEqual(0);
      expect(orb.y).toBeLessThanOrEqual(STAGE.height);
    }
  });

  it("orbitLayout places rank 0 at the top (-90°) on a single evenly-spread ring", () => {
    const input = fan(5);
    const layout = layoutOrbs(input, STAGE, CFG);
    const cx = STAGE.width / 2;
    const cy = STAGE.height / 2;
    // Rank 0 sits directly above centre.
    expect(layout[0].x).toBeCloseTo(cx, 5);
    expect(layout[0].y).toBeLessThan(cy);
    // Every orb is EQUIDISTANT from the centre (one shared ring = even spread)…
    const radii = layout.map((o) => Math.hypot(o.x - cx, o.y - cy));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 5);
    // …and UNIFORM in size (no score-driven radius/diameter variation anymore).
    for (const o of layout) expect(o.diameterPx).toBeCloseTo(layout[0].diameterPx, 5);
    // Angular step is even: 360°/n between adjacent orbs.
    const angle = (o: (typeof layout)[number]) => Math.atan2(o.y - cy, o.x - cx);
    const step = 2 * Math.PI / layout.length;
    for (let i = 1; i < layout.length; i++) {
      let delta = angle(layout[i]) - angle(layout[i - 1]);
      delta = ((delta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      expect(delta).toBeCloseTo(step, 5);
    }
  });

  it("orbitLayout keeps orbs clear of the centre node and each other (no overlap)", () => {
    const layout = layoutOrbs(fan(5), STAGE, CFG);
    const cx = STAGE.width / 2;
    const cy = STAGE.height / 2;
    const r = Math.hypot(layout[0].x - cx, layout[0].y - cy);
    const d = layout[0].diameterPx;
    // Inner edge clears the centre node + gap.
    expect(r - d / 2).toBeGreaterThanOrEqual(
      CFG.centerDiameter / 2 + CFG.orbGapPx - 1e-6,
    );
    // Adjacent chord ≥ diameter + gap (no orb–orb overlap).
    const chord = 2 * r * Math.sin(Math.PI / layout.length);
    expect(chord).toBeGreaterThanOrEqual(d + CFG.orbGapPx - 1e-6);
  });

  it("orbitLayout does not renormalize — equal scores never divide-by-zero", () => {
    const flat: OrbLayoutInput[] = [
      { songId: 1, score: 0.2 },
      { songId: 2, score: 0.2 },
      { songId: 3, score: 0.2 },
    ];
    const layout = layoutOrbs(flat, STAGE, CFG);
    expect(layout).toHaveLength(3);
    for (const orb of layout) {
      expect(Number.isFinite(orb.x)).toBe(true);
      expect(Number.isFinite(orb.y)).toBe(true);
      expect(Number.isFinite(orb.diameterPx)).toBe(true);
    }
  });
});

describe("orbitLayout.selectFan — adaptive 5–8 fan (D-12)", () => {
  it("orbitLayout selectFan clamps a large fan down to ORB_COUNT_MAX", () => {
    const kept = selectFan(fan(12));
    expect(kept).toHaveLength(config.show.ORB_COUNT_MAX);
  });

  it("orbitLayout selectFan always keeps at least ORB_COUNT_MIN", () => {
    // Only 3 candidates clear ORB_DROP_SCORE, but the fan must still be ≥ MIN.
    const candidates: OrbLayoutInput[] = [
      { songId: 1, score: 0.2 },
      { songId: 2, score: 0.1 },
      { songId: 3, score: 0.05 },
      { songId: 4, score: 0.001 },
      { songId: 5, score: 0.0005 },
      { songId: 6, score: 0.0001 },
    ];
    const kept = selectFan(candidates);
    expect(kept).toHaveLength(config.show.ORB_COUNT_MIN);
  });

  it("orbitLayout selectFan drops sub-ORB_DROP_SCORE orbs above the MIN floor", () => {
    // 9 candidates: 6 clear the drop score, 3 do not.
    const candidates: OrbLayoutInput[] = [
      { songId: 1, score: 0.24 },
      { songId: 2, score: 0.2 },
      { songId: 3, score: 0.12 },
      { songId: 4, score: 0.08 },
      { songId: 5, score: 0.05 },
      { songId: 6, score: 0.03 },
      { songId: 7, score: 0.01 },
      { songId: 8, score: 0.005 },
      { songId: 9, score: 0.001 },
    ];
    const kept = selectFan(candidates);
    // 6 clear drop but MAX is 5 → count clamps to 5; the kept 5 all clear drop.
    expect(kept).toHaveLength(config.show.ORB_COUNT_MAX);
    expect(kept.every((c) => c.score >= config.show.ORB_DROP_SCORE)).toBe(true);
  });
});
