import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import type { MarkTrailEntry } from "../../src/bingo/mark.ts";
import type { BingoVibe } from "../../src/bingo/types.ts";
import {
  assertCalibrationInvariants,
  buildRosterCandidates,
  formatCalibrationReport,
  runBingoCalibration,
  type CalibrationResult,
  type CalibrationShow,
  type VibeCalibration,
} from "../../src/cli/bingo-calibrate.ts";
import {
  SONG_ALBUM,
  SONG_BUSTOUT,
  SONG_JAM_VEHICLE,
  SONG_MICROTONAL,
  SONG_NEVER_CAUGHT,
  SONG_PLAIN,
  bingoContext,
} from "../fixtures/bingo/synthetic.ts";

/**
 * Success Criterion for Plan 14-05: the calibration gate's AGGREGATION + GATE
 * logic, exercised on a tiny synthetic corpus (NOT the full 241-show run — that
 * is the Plan-06 gate execution). Pins (1) the per-vibe aggregation shape from
 * `runBingoCalibration`, (2) that `assertCalibrationInvariants` flags a
 * reliable square with dark-share == 1.0 and passes a green synthetic result,
 * and (3) that the report/roster formatters produce a string.
 */

/** A play-ordered synthetic trail: contract position is 0-based (opener = 0). */
function trail(songIds: Array<number | null>): MarkTrailEntry[] {
  return songIds.map((songId, position) => ({
    songId,
    position,
    isPlaceholder: songId === null,
  }));
}

function syntheticShows(): CalibrationShow[] {
  return [
    {
      showId: 1,
      songIds: [SONG_PLAIN, SONG_MICROTONAL, SONG_ALBUM, SONG_BUSTOUT],
      trail: trail([SONG_PLAIN, SONG_MICROTONAL, SONG_ALBUM, SONG_BUSTOUT]),
    },
    {
      showId: 2,
      songIds: [SONG_MICROTONAL, SONG_JAM_VEHICLE, SONG_NEVER_CAUGHT],
      trail: trail([SONG_MICROTONAL, SONG_JAM_VEHICLE, SONG_NEVER_CAUGHT]),
    },
    {
      showId: 3,
      songIds: [SONG_PLAIN, SONG_ALBUM, SONG_MICROTONAL],
      trail: trail([SONG_PLAIN, SONG_ALBUM, SONG_MICROTONAL]),
    },
  ];
}

/** Recursively strips `readonly` so a test can clone a result and break one field. */
type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };

/** A deep, mutable clone of a green result — mutate one field to build a broken variant. */
function brokenClone(): DeepMutable<CalibrationResult> {
  return structuredClone(greenResult()) as DeepMutable<CalibrationResult>;
}

/** A hand-built passing result: every reliable square clears the floor, every band holds. */
function greenResult(): CalibrationResult {
  const vibe = (v: BingoVibe): VibeCalibration => ({
    vibe: v,
    cards: 10,
    shows: 4,
    trials: 40,
    pLine: config.bingo.vibes[v].line, // exactly on target — inside any tolerance
    pBlackout: v === "chill" ? 0 : v === "balanced" ? 0.03 : 0.07,
    pCorners: 0.1,
    pX: 0.05,
    expectedMarks: { median: 6, mean: 6, min: 3, max: 9 },
    reliableSquares: [
      { type: "microtonal", trials: 40, fires: 20, fireRate: 0.5, darkShare: 0.5 },
      { type: "opener", trials: 40, fires: 16, fireRate: 0.4, darkShare: 0.6 },
    ],
  });
  return {
    generatedAt: "2026-01-01T00:00:00Z",
    corpusVersion: "test-corpus",
    showCount: 4,
    simCardsPerVibe: 10,
    assumptions: [
      { assumption: "empty", gated: false, vibes: [vibe("chill"), vibe("balanced"), vibe("glory")] },
      { assumption: "mid-collection", gated: true, vibes: [vibe("chill"), vibe("balanced"), vibe("glory")] },
    ],
  };
}

describe("runBingoCalibration — aggregation shape", () => {
  it("aggregates per-vibe P values and expected marks over the real fold", () => {
    const ctx = bingoContext();
    const result = runBingoCalibration(ctx, syntheticShows(), config, {
      cardsPerVibe: 5,
      generatedAt: "G",
      corpusVersion: "V",
      dexModel: new Set<number>([SONG_PLAIN]),
    });

    expect(result.showCount).toBe(3);
    expect(result.simCardsPerVibe).toBe(5);
    expect(result.generatedAt).toBe("G");
    expect(result.corpusVersion).toBe("V");
    // Both dex assumptions present, empty first (edge, not gated), mid gated.
    expect(result.assumptions.map((a) => a.assumption)).toEqual(["empty", "mid-collection"]);
    expect(result.assumptions.find((a) => a.assumption === "mid-collection")?.gated).toBe(true);
    expect(result.assumptions.find((a) => a.assumption === "empty")?.gated).toBe(false);

    for (const assumption of result.assumptions) {
      expect(assumption.vibes.map((v) => v.vibe)).toEqual(["chill", "balanced", "glory"]);
      for (const v of assumption.vibes) {
        expect(v.cards).toBe(5);
        expect(v.shows).toBe(3);
        expect(v.trials).toBe(15);
        for (const p of [v.pLine, v.pBlackout, v.pCorners, v.pX]) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
        expect(Number.isFinite(v.expectedMarks.mean)).toBe(true);
        expect(v.expectedMarks.min).toBeLessThanOrEqual(v.expectedMarks.max);
        for (const rel of v.reliableSquares) {
          expect(rel.fireRate).toBeGreaterThanOrEqual(0);
          expect(rel.fireRate).toBeLessThanOrEqual(1);
          expect(rel.darkShare).toBeCloseTo(1 - rel.fireRate, 10);
        }
      }
    }
  });

  it("is deterministic — identical inputs produce a byte-identical result", () => {
    const ctx = bingoContext();
    const opts = { cardsPerVibe: 4, generatedAt: "G", corpusVersion: "V" } as const;
    const a = runBingoCalibration(ctx, syntheticShows(), config, opts);
    const b = runBingoCalibration(ctx, syntheticShows(), config, opts);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("assertCalibrationInvariants — the D-02/D-03/D-05 hard gate", () => {
  it("returns no failures for a green synthetic result", () => {
    expect(assertCalibrationInvariants(greenResult(), config)).toEqual([]);
  });

  it("flags a reliable square with dark-share == 1.0 (never fired)", () => {
    const broken = brokenClone();
    const mid = broken.assumptions.find((a) => a.assumption === "mid-collection")!;
    // Force the balanced vibe's microtonal square to never fire.
    const microtonal = mid.vibes[1].reliableSquares.find((r) => r.type === "microtonal")!;
    microtonal.fires = 0;
    microtonal.fireRate = 0;
    microtonal.darkShare = 1;

    const failures = assertCalibrationInvariants(broken, config);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((f) => /dark-share|dark square|never fired/i.test(f))).toBe(true);
  });

  it("flags a P(line) outside its per-vibe target band", () => {
    const broken = brokenClone();
    const mid = broken.assumptions.find((a) => a.assumption === "mid-collection")!;
    mid.vibes[0].pLine = 0.1; // chill target is 0.82 — wildly off
    const failures = assertCalibrationInvariants(broken, config);
    expect(failures.some((f) => /line/i.test(f))).toBe(true);
  });

  it("only gates the mid-collection assumption (empty is the reported edge)", () => {
    const broken = brokenClone();
    const empty = broken.assumptions.find((a) => a.assumption === "empty")!;
    empty.vibes[0].pLine = 0.01; // break the NON-gated assumption only
    const microtonal = empty.vibes[1].reliableSquares.find((r) => r.type === "microtonal")!;
    microtonal.fires = 0;
    microtonal.fireRate = 0;
    microtonal.darkShare = 1;
    expect(assertCalibrationInvariants(broken, config)).toEqual([]);
  });
});

describe("formatters", () => {
  it("renders a calibration report string with the per-vibe numbers", () => {
    const report = formatCalibrationReport(greenResult());
    expect(report).toContain("Bingo Calibration");
    expect(report).toContain("chill");
    expect(report.endsWith("\n")).toBe(true);
  });

  it("buildRosterCandidates ranks album + jam-vehicle candidates by measured fire-rate", () => {
    const ctx = bingoContext();
    const candidates = buildRosterCandidates(ctx, syntheticShows(), config, {
      songNames: new Map<number, string>([[SONG_JAM_VEHICLE, "Marathon Jam Vehicle"]]),
      generatedAt: "G",
    });
    expect(candidates.generatedAt).toBe("G");
    expect(candidates.showCount).toBe(3);
    // The fixture album has SONG_ALBUM as a member, which fires in 2 of 3 shows.
    const album = candidates.albumCandidates.find((c) => c.albumUrl.includes("alpha"));
    expect(album?.fireRate).toBeCloseTo(2 / 3, 6);
  });
});
