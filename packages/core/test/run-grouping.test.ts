import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { rotationSuppression } from "../src/model/predict.ts";
import type { ShowContext } from "../src/domain/types.ts";
import {
  currentRunShowSets,
  type FinalizedShowInput,
} from "../src/live/run-grouping.ts";

const CFG = { runGapDays: 2 };

function show(date: string, songIds: number[]): FinalizedShowInput {
  return { date, songIds };
}

describe("currentRunShowSets (PRED-01/PRED-03, D-02/D-03/D-04)", () => {
  it("groups consecutive nights within runGapDays into one run, newest-first", () => {
    // Residency: 13th/14th/15th are one run; the 8th is a separate weekend.
    const finalized = [
      show("2026-08-13", [103, 200]),
      show("2026-08-08", [999]),
      show("2026-08-15", [101, 200]),
      show("2026-08-14", [102, 200]),
    ];
    const result = currentRunShowSets(finalized, "2026-08-16", CFG);
    expect(result).toEqual([
      [101, 200],
      [102, 200],
      [103, 200],
    ]);
  });

  it("breaks the run at a gap > runGapDays (a separate weekend does not suppress)", () => {
    const finalized = [
      show("2026-08-15", [101, 200]),
      show("2026-08-14", [102, 200]),
      show("2026-08-08", [999]), // 6-day gap from the run
    ];
    const result = currentRunShowSets(finalized, "2026-08-16", CFG);
    expect(result).toEqual([
      [101, 200],
      [102, 200],
    ]);
    // The separated show's songs are excluded entirely.
    expect(result.flat()).not.toContain(999);
  });

  it("includes a show exactly runGapDays away (<= boundary is inclusive)", () => {
    const finalized = [
      show("2026-08-08", [101]), // gap exactly 2 from currentDate
      show("2026-08-05", [999]), // gap 3 from the 8th → excluded
    ];
    const result = currentRunShowSets(finalized, "2026-08-10", CFG);
    expect(result).toEqual([[101]]);
  });

  it("excludes shows on/after the reset boundary date (manual reset, D-04)", () => {
    const finalized = [
      show("2026-08-15", [101, 200]),
      show("2026-08-14", [102, 200]),
      show("2026-08-13", [103, 200]),
    ];
    // Owner reset at the 15th: everything from the 15th forward drops out.
    const result = currentRunShowSets(finalized, "2026-08-16", CFG, "2026-08-15");
    expect(result).toEqual([
      [102, 200],
      [103, 200],
    ]);
    expect(result.flat()).not.toContain(101);
  });

  it("never includes the current/active show (date >= currentDate excluded)", () => {
    const finalized = [
      show("2026-08-16", [777]), // same as currentDate — the active show
      show("2026-08-15", [101]),
    ];
    const result = currentRunShowSets(finalized, "2026-08-16", CFG);
    expect(result).toEqual([[101]]);
    expect(result.flat()).not.toContain(777);
  });

  it("returns [] for empty input", () => {
    expect(currentRunShowSets([], "2026-08-16", CFG)).toEqual([]);
  });

  it("returns [] when the nearest prior show is beyond runGapDays", () => {
    const finalized = [show("2026-08-01", [101])];
    expect(currentRunShowSets(finalized, "2026-08-16", CFG)).toEqual([]);
  });

  it("feeds rotationSuppression: a song played across the run scores lower than an unplayed one", () => {
    const finalized = [
      show("2026-08-15", [101, 200]),
      show("2026-08-14", [102, 200]),
      show("2026-08-13", [103, 200]),
    ];
    const recentShowSongSets = currentRunShowSets(finalized, "2026-08-16", CFG);
    const ctx: ShowContext = { currentSongId: 500, trail: [], recentShowSongSets };

    const playedEveryNight = rotationSuppression(200, ctx, config); // in all 3 run shows
    const neverPlayed = rotationSuppression(500, ctx, config); // in none

    expect(playedEveryNight).toBeLessThan(1);
    expect(playedEveryNight).toBeLessThan(neverPlayed);
    expect(neverPlayed).toBe(1);
    // Never a hard zero (no exclusion), matching MODL-06 intent.
    expect(playedEveryNight).toBeGreaterThan(0);
  });
});
