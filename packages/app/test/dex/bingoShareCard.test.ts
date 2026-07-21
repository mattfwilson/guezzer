import { describe, expect, it } from "vitest";
import { buildBingoShareCard, type MarkedCard, type Win } from "@guezzer/core";

/**
 * BINGO-08 (D-22): the pure `buildBingoShareCard` assembler projects a marked
 * board + detected wins + show identity into the canvas-ready `"bingo"`-scoped
 * `ShareCardData`. It is a TROPHY, not a spreadsheet — the projection carries the
 * 16 board stamps, the deduped win kinds, and the date/venue, but NEVER any
 * per-square "lit by {song}" detail (that stays the in-app replay payoff).
 *
 * Local `MarkedCard` builder — the free cell (index `freeIndex`) is pre-marked
 * with the FREE_SENTINEL value (-1) exactly as the core marking fold emits it
 * (D-06), so it counts as marked with no trail position. Non-free marked indices
 * record their own board index; every other cell stays unmarked
 * (`markedByPosition === null`).
 */
function makeMarked(markedIndices: number[], freeIndex = 5): MarkedCard {
  const marked = new Set(markedIndices);
  const squares: MarkedCard["squares"] = [];
  let markedCount = 0;
  for (let index = 0; index < 16; index++) {
    if (index === freeIndex) {
      squares.push({ def: { kind: "free" }, index, markedByPosition: -1 });
      markedCount += 1;
    } else {
      const markedByPosition = marked.has(index) ? index : null;
      squares.push({
        def: { kind: "song", songId: 100 + index, label: `Square ${index}` },
        index,
        markedByPosition,
      });
      if (markedByPosition !== null) markedCount += 1;
    }
  }
  return { squares, markedCount };
}

const show = { date: "2026-08-01", venue: "Red Rocks" };

describe("buildBingoShareCard — pure bingo brag-card assembly (BINGO-08, D-22)", () => {
  it("projects 16 row-major squares with the free center flagged + marked", () => {
    const card = buildBingoShareCard(makeMarked([0, 1, 2]), [], show);
    expect(card.scope).toBe("bingo");
    expect(card.squares).toHaveLength(16);
    // The pre-marked free center (index 5) is flagged AND counts as marked.
    expect(card.squares[5].isFree).toBe(true);
    expect(card.squares[5].marked).toBe(true);
    // A song cell is never flagged free.
    expect(card.squares[0].isFree).toBe(false);
  });

  it("marks a square true and carries NO per-square song detail (trophy, not spreadsheet)", () => {
    const card = buildBingoShareCard(makeMarked([3]), [], show);
    const cell = card.squares[3];
    expect(cell.marked).toBe(true);
    expect(cell.label).toBe("Square 3");
    // Only the three canvas-ready fields — no songId / "lit by" leak (D-22).
    expect(Object.keys(cell).sort()).toEqual(["isFree", "label", "marked"]);
  });

  it("leaves an untouched square unmarked", () => {
    const card = buildBingoShareCard(makeMarked([3]), [], show);
    expect(card.squares[4].marked).toBe(false);
  });

  it("dedupes repeated win kinds, preserving detection order", () => {
    const wins: Win[] = [
      { kind: "line", indices: [0, 1, 2, 3] },
      { kind: "line", indices: [4, 5, 6, 7] },
      { kind: "corners", indices: [0, 3, 12, 15] },
    ];
    const card = buildBingoShareCard(makeMarked([0, 1, 2, 3]), wins, show);
    expect(card.wins).toEqual(["line", "corners"]);
  });

  it("passes the show date + venue through untouched", () => {
    const card = buildBingoShareCard(makeMarked([]), [], show);
    expect(card.show).toEqual({ date: "2026-08-01", venue: "Red Rocks" });
  });

  it("yields a valid card for a zero-win board (empty wins, null venue)", () => {
    const card = buildBingoShareCard(makeMarked([]), [], { date: "2026-08-02", venue: null });
    expect(card.wins).toEqual([]);
    expect(card.squares).toHaveLength(16);
    expect(card.show.venue).toBeNull();
  });
});
