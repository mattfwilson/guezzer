import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { bingoEventValues } from "../src/bingo/types.ts";

/**
 * Pins the config.bingo invariants that later plans (context/wins/mark/
 * generate/calibrate) treat as stable inputs: the freeIndex domain, the
 * specificityRank total order (D-08/D-09/D-10), reliable/glory event coverage,
 * the LOCKED rosters + per-vibe mix weights (locked at the Plan 06 D-20 gate,
 * 2026-07-20), and the retargeted per-vibe bands (D-02/D-03 amendment) whose
 * chill > balanced > glory ordering must hold.
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

  it("locks non-empty jam-vehicle and album-square rosters (Plan 06 D-20 gate)", () => {
    expect(bingo.jamVehicleSongIds.length).toBeGreaterThan(0);
    expect(bingo.albumSquarePool.length).toBeGreaterThan(0);
    // Rosters are the owner-approved shapes the calibration fire-rates reproduce.
    for (const songId of bingo.jamVehicleSongIds) {
      expect(Number.isInteger(songId)).toBe(true);
      expect(songId).toBeGreaterThan(0);
    }
    for (const albumUrl of bingo.albumSquarePool) {
      expect(typeof albumUrl).toBe("string");
      expect(albumUrl.length).toBeGreaterThan(0);
    }
  });

  it("every vibe has a line target, a blackout upper cap, and present mix weights", () => {
    for (const vibe of ["chill", "balanced", "glory"] as const) {
      const band = bingo.vibes[vibe];
      expect(typeof band.line).toBe("number");
      expect(band.line).toBeGreaterThan(0);
      expect(band.line).toBeLessThanOrEqual(1);
      // D-03 amendment: every vibe now carries an upper-cap `blackoutMax` (no floor).
      expect(typeof band.blackoutMax).toBe("number");
      expect(band.blackoutMax).toBeGreaterThanOrEqual(0);
      // Plan-06 lock: per-vibe mix weights are present (non-empty) and non-negative.
      const mix = band.mix as Record<string, number>;
      const mixKeys = Object.keys(mix);
      expect(mixKeys.length).toBeGreaterThan(0);
      for (const weight of Object.values(mix)) {
        expect(typeof weight).toBe("number");
        expect(weight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("retargeted P(line) bands preserve chill > balanced > glory ordering (D-02 amendment)", () => {
    expect(bingo.vibes.chill.line).toBeGreaterThan(bingo.vibes.balanced.line);
    expect(bingo.vibes.balanced.line).toBeGreaterThan(bingo.vibes.glory.line);
  });
});
