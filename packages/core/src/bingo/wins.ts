/**
 * D-06 / D-26: pure 4×4 win-detection geometry over a `MarkedCard`. A square is
 * "marked" iff `markedByPosition !== null` — which is already true for the
 * pre-marked free center (it carries the `FREE_SENTINEL` position), so every
 * line, diagonal, and corners set that passes through the free cell needs only
 * its OTHER squares marked. Win kinds are exactly the closed
 * `BingoWinKind` vocabulary: `line` (any full row / column / diagonal),
 * `corners`, `x` (both diagonals), `blackout` (all 16).
 *
 * Pure core: reads only the marked flags off the card — no config, no I/O, no
 * wall-clock or entropy. Board layout is row-major (rows 0-3, 4-7, 8-11, 12-15).
 * Wins are emitted in a fixed, deterministic order (rows top-to-bottom, columns
 * left-to-right, the two diagonals, then corners, then x, then blackout) so the
 * calibration report (Plan 05) is byte-reproducible.
 */
import type { MarkedCard, Win } from "./types.ts";

// Row-major 4×4 geometry. Every constant is a board-index tuple.
const ROWS: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
];
const COLS: readonly (readonly number[])[] = [
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
];
const DIAG_MAIN: readonly number[] = [0, 5, 10, 15];
const DIAG_ANTI: readonly number[] = [3, 6, 9, 12];
const CORNERS: readonly number[] = [0, 3, 12, 15];
const ALL_INDICES: readonly number[] = Array.from({ length: 16 }, (_unused, i) => i);

// Union of the two diagonals, ascending — the `x` win's indices.
const X_INDICES: readonly number[] = [
  ...new Set<number>([...DIAG_MAIN, ...DIAG_ANTI]),
].sort((a, b) => a - b);

/**
 * `detectWins(marked) -> Win[]`. Resolves the marked board indices once
 * (indexing by each square's own `index`, not its array slot, so array order is
 * irrelevant), then tests each geometry set. The free cell counts automatically
 * because its `markedByPosition` is the `FREE_SENTINEL` (non-null). Returns
 * every satisfied win in deterministic order; an empty array when none holds
 * (a free-cell-only board never completes a line).
 */
export function detectWins(marked: MarkedCard): Win[] {
  const markedIndices = new Set<number>();
  for (const square of marked.squares) {
    if (square.markedByPosition !== null) markedIndices.add(square.index);
  }
  const isFull = (indices: readonly number[]): boolean =>
    indices.every((index) => markedIndices.has(index));

  const wins: Win[] = [];

  // Lines: rows (top-to-bottom), columns (left-to-right), then both diagonals.
  for (const row of ROWS) {
    if (isFull(row)) wins.push({ kind: "line", indices: [...row] });
  }
  for (const col of COLS) {
    if (isFull(col)) wins.push({ kind: "line", indices: [...col] });
  }
  const mainDone = isFull(DIAG_MAIN);
  const antiDone = isFull(DIAG_ANTI);
  if (mainDone) wins.push({ kind: "line", indices: [...DIAG_MAIN] });
  if (antiDone) wins.push({ kind: "line", indices: [...DIAG_ANTI] });

  // Corners, then X (both diagonals), then blackout.
  if (isFull(CORNERS)) wins.push({ kind: "corners", indices: [...CORNERS] });
  if (mainDone && antiDone) wins.push({ kind: "x", indices: [...X_INDICES] });
  if (isFull(ALL_INDICES)) wins.push({ kind: "blackout", indices: [...ALL_INDICES] });

  return wins;
}

/**
 * `expectedFill(marked) -> number`. The fraction of the 16 board cells that are
 * marked (free cell included). Feeds the Plan-05 calibration report and a
 * future difficulty meter.
 */
export function expectedFill(marked: MarkedCard): number {
  return marked.markedCount / 16;
}
