import { describe, expect, it } from "vitest";
import { detectWins, expectedFill } from "../../src/bingo/wins.ts";
import type { BingoWinKind } from "../../src/bingo/types.ts";
import { markedCard } from "../fixtures/bingo/synthetic.ts";

/**
 * `detectWins` runs pure 4×4 grid geometry over a `MarkedCard`. A square counts
 * as marked iff `markedByPosition !== null`; the free cell is pre-marked with
 * `FREE_SENTINEL` (D-06), so any line/diagonal/corners set through it needs only
 * its OTHER squares marked. The fixture's default free cell sits at
 * `config.bingo.freeIndex` (5), which lies on the main diagonal [0,5,10,15].
 */

const kinds = (indicesToMark: number[]): BingoWinKind[] =>
  detectWins(markedCard(indicesToMark)).map((win) => win.kind);

describe("detectWins — 4×4 line/corners/X/blackout geometry (D-06/D-26)", () => {
  it("reports a line for any fully-marked row", () => {
    const wins = detectWins(markedCard([0, 1, 2, 3])); // top row
    expect(wins).toHaveLength(1);
    expect(wins[0].kind).toBe("line");
    expect(wins[0].indices).toEqual([0, 1, 2, 3]);
  });

  it("reports a line for any fully-marked column", () => {
    const wins = detectWins(markedCard([2, 6, 10, 14])); // col index 2
    expect(wins).toHaveLength(1);
    expect(wins[0].kind).toBe("line");
    expect(wins[0].indices).toEqual([2, 6, 10, 14]);
  });

  it("counts the free cell through a diagonal — only the other 3 squares needed (D-06)", () => {
    // Main diagonal [0,5,10,15]; 5 is the pre-marked free cell.
    const wins = detectWins(markedCard([0, 10, 15]));
    const line = wins.find((w) => w.kind === "line");
    expect(line).toBeDefined();
    expect(line?.indices).toEqual([0, 5, 10, 15]);
    // Nothing else completes.
    expect(wins.filter((w) => w.kind === "line")).toHaveLength(1);
  });

  it("reports an x only when BOTH diagonals are complete", () => {
    // Main diag needs 0,10,15 (5 free); anti diag [3,6,9,12] needs all four.
    const both = kinds([0, 10, 15, 3, 6, 9, 12]);
    expect(both).toContain("x");
    // Two diagonal lines precede the x.
    expect(both.filter((k) => k === "line")).toHaveLength(2);
  });

  it("reports corners for the four corner indices (0,3,12,15)", () => {
    const wins = detectWins(markedCard([0, 3, 12, 15]));
    expect(wins.map((w) => w.kind)).toEqual(["corners"]);
    expect(wins[0].indices).toEqual([0, 3, 12, 15]);
  });

  it("reports blackout when all 16 squares are marked", () => {
    const allButFree = Array.from({ length: 16 }, (_u, i) => i).filter((i) => i !== 5);
    const wins = detectWins(markedCard(allButFree));
    const winKinds = wins.map((w) => w.kind);
    expect(winKinds).toContain("blackout");
    // Deterministic order: every line precedes corners; corners < x < blackout (last).
    expect(winKinds[winKinds.length - 1]).toBe("blackout");
    const firstNonLine = winKinds.findIndex((k) => k !== "line");
    expect(winKinds.slice(0, firstNonLine).every((k) => k === "line")).toBe(true);
    expect(winKinds.indexOf("corners")).toBeLessThan(winKinds.indexOf("x"));
    expect(winKinds.indexOf("x")).toBeLessThan(winKinds.indexOf("blackout"));
  });

  it("returns no win for a free-cell-only board", () => {
    expect(detectWins(markedCard([]))).toEqual([]);
  });

  it("returns no win for a partial, non-winning board", () => {
    expect(detectWins(markedCard([0, 1]))).toEqual([]);
  });
});

describe("expectedFill — marked fraction of the 16 cells", () => {
  it("returns markedCount / 16 (free cell included)", () => {
    // Top row (4) + the free cell = 5 of 16.
    expect(expectedFill(markedCard([0, 1, 2, 3]))).toBeCloseTo(5 / 16, 10);
    // Free cell only.
    expect(expectedFill(markedCard([]))).toBeCloseTo(1 / 16, 10);
  });
});
