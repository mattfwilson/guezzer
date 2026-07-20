import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { bingoEventValues } from "../src/bingo/types.ts";

/**
 * Pins the config.bingo invariants that later plans (context/wins/mark/
 * generate/calibrate) treat as stable inputs: the freeIndex domain, the
 * specificityRank total order (D-08/D-09/D-10), reliable/glory event coverage,
 * empty rosters (locked only at the Plan 06 gate), and the per-vibe bands.
 */
describe("config.bingo", () => {
  const bingo = config.bingo;

  it("freeIndex is one of the four center cells {5,6,9,10}", () => {
    expect([5, 6, 9, 10]).toContain(bingo.freeIndex);
  });

  it("specificityRank is a total order over the seven square-kinds", () => {
    const rank = bingo.specificityRank;
    const expectedKinds = [
      "song",
      "neverCaught",
      "bustOut",
      "opener",
      "microtonal",
      "marathonJam",
      "album",
    ];
    // Every kind present.
    for (const kind of expectedKinds) {
      expect(rank).toHaveProperty(kind);
    }
    expect(Object.keys(rank).sort()).toEqual([...expectedKinds].sort());
    // song is the strictly lowest (most specific); neverCaught outranks bustOut (D-09).
    const values = Object.values(rank);
    expect(rank.song).toBe(0);
    expect(rank.song).toBe(Math.min(...values));
    expect(rank.neverCaught).toBeLessThan(rank.bustOut);
    // Every rank is a finite non-negative integer.
    for (const value of values) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("reliableEvents and gloryEvents are disjoint and together cover the event union", () => {
    const reliable = new Set<string>(bingo.reliableEvents);
    const glory = new Set<string>(bingo.gloryEvents);
    // Disjoint.
    for (const event of reliable) {
      expect(glory.has(event)).toBe(false);
    }
    // Union equals the full bingoEvent vocabulary.
    const union = new Set<string>([...reliable, ...glory]);
    expect([...union].sort()).toEqual([...bingoEventValues].sort());
  });

  it("ships empty jam-vehicle and album-square rosters (locked in Plan 06)", () => {
    expect(bingo.jamVehicleSongIds).toEqual([]);
    expect(bingo.albumSquarePool).toEqual([]);
  });

  it("every vibe has a line target and a blackout target/band", () => {
    for (const vibe of ["chill", "balanced", "glory"] as const) {
      const band = bingo.vibes[vibe];
      expect(typeof band.line).toBe("number");
      expect(band.line).toBeGreaterThan(0);
      expect(band.line).toBeLessThanOrEqual(1);
      const hasBlackout =
        "blackoutMax" in band || "blackout" in band;
      expect(hasBlackout).toBe(true);
    }
  });
});
