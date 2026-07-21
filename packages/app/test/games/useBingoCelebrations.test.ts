import { describe, expect, it } from "vitest";
import type { MarkedCard, MarkedSquare, Win } from "@guezzer/core";
import {
  initialCelebrationMemo,
  nextCelebrations,
} from "../../src/games/useBingoCelebrations.ts";

/**
 * BINGO-05 celebration driver (plan 16-05, Task 2). `nextCelebrations` is the
 * PURE transition reducer the App-level hook wraps: given the previous per-session
 * memo, the current derived `MarkedCard`, and the current `detectWins` result, it
 * returns the celebrations to fire ON THIS 0→1 EDGE plus the next memo.
 *
 * The load-bearing correctness (16-RESEARCH Pitfall 3): celebrations fire on the
 * TRANSITION, never on presence — re-invoking with the SAME board/wins fires
 * nothing (idempotent), and the ≤2-supernova/show budget (first line + blackout
 * ONLY) is enforced via `memo.supernovasFired`, so a liveQuery re-render never
 * replays a big moment.
 */

const FREE_SENTINEL = -1; // core types.ts:74 — not exported from the barrel; pinned here.
const FREE_INDEX = 5;

/** Build a `MarkedCard` from `[index, trailPosition]` marks; the free cell is pre-marked. */
function board(marks: Array<[number, number]>): MarkedCard {
  const byIndex = new Map(marks);
  const squares: MarkedSquare[] = Array.from({ length: 16 }, (_unused, index) => ({
    def: { kind: "song", songId: index, label: `S${index}` },
    index,
    markedByPosition:
      index === FREE_INDEX ? FREE_SENTINEL : (byIndex.get(index) ?? null),
  }));
  const markedCount = squares.filter((s) => s.markedByPosition !== null).length;
  return { squares, markedCount };
}

const line = (indices: number[]): Win => ({ kind: "line", indices });
const corners = (): Win => ({ kind: "corners", indices: [0, 3, 12, 15] });
const xWin = (): Win => ({ kind: "x", indices: [0, 3, 5, 6, 9, 10, 12, 15] });
const blackout = (): Win => ({
  kind: "blackout",
  indices: Array.from({ length: 16 }, (_u, i) => i),
});

const topRow = board([
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
]);

describe("nextCelebrations — pure celebration transition reducer (BINGO-05)", () => {
  it("fires exactly one supernova on the first line and records it in the budget", () => {
    const { events, memo } = nextCelebrations(
      initialCelebrationMemo(),
      topRow,
      [line([0, 1, 2, 3])],
    );
    const supernovas = events.filter((e) => e.tier === "supernova");
    expect(supernovas).toEqual([{ tier: "supernova", kind: "firstLine" }]);
    expect(memo.supernovasFired.has("firstLine")).toBe(true);
    // No badge for the very first line (that IS the supernova, not a subsequent line).
    expect(events.some((e) => e.tier === "badge")).toBe(false);
  });

  it("is idempotent — re-invoking with the SAME board and wins fires nothing", () => {
    const first = nextCelebrations(initialCelebrationMemo(), topRow, [
      line([0, 1, 2, 3]),
    ]);
    const again = nextCelebrations(first.memo, topRow, [line([0, 1, 2, 3])]);
    expect(again.events).toHaveLength(0);
  });

  it("fires a badge (not a supernova) on a subsequent line", () => {
    const first = nextCelebrations(initialCelebrationMemo(), topRow, [
      line([0, 1, 2, 3]),
    ]);
    // Complete the left column too — a SECOND line.
    const twoLines = board([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [8, 5],
      [12, 6],
    ]);
    const second = nextCelebrations(first.memo, twoLines, [
      line([0, 1, 2, 3]),
      line([0, 4, 8, 12]),
    ]);
    expect(second.events.filter((e) => e.tier === "supernova")).toHaveLength(0);
    expect(second.events).toContainEqual({ tier: "badge", kind: "anotherLine" });
  });

  it("fires a four-corners badge on its 0→1 transition", () => {
    const cornersBoard = board([
      [0, 0],
      [3, 1],
      [12, 2],
      [15, 3],
    ]);
    const { events } = nextCelebrations(
      initialCelebrationMemo(),
      cornersBoard,
      [corners()],
    );
    expect(events).toContainEqual({ tier: "badge", kind: "fourCorners" });
    expect(events.some((e) => e.tier === "supernova")).toBe(false);
  });

  it("fires an X badge on its 0→1 transition", () => {
    const xBoard = board([
      [0, 0],
      [3, 1],
      [6, 2],
      [9, 3],
      [10, 4],
      [12, 5],
      [15, 6],
    ]);
    const { events } = nextCelebrations(initialCelebrationMemo(), xBoard, [
      xWin(),
    ]);
    expect(events).toContainEqual({ tier: "badge", kind: "x" });
  });

  it("fires a supernova on blackout", () => {
    const full = board(
      Array.from({ length: 16 }, (_u, i) => [i, i] as [number, number]),
    );
    const { events, memo } = nextCelebrations(
      initialCelebrationMemo(),
      full,
      [blackout()],
    );
    expect(events).toContainEqual({ tier: "supernova", kind: "blackout" });
    expect(memo.supernovasFired.has("blackout")).toBe(true);
  });

  it("fires a mark event for a newly-lit square, once per transition", () => {
    const one = board([[2, 7]]);
    const first = nextCelebrations(initialCelebrationMemo(), one, []);
    expect(first.events).toContainEqual({ tier: "mark", index: 2, position: 7 });
    // Same board again → no re-fire.
    const again = nextCelebrations(first.memo, one, []);
    expect(again.events.some((e) => e.tier === "mark")).toBe(false);
  });

  it("caps supernovas at TWO across a session (first line + blackout only)", () => {
    let memo = initialCelebrationMemo();
    const a = nextCelebrations(memo, topRow, [line([0, 1, 2, 3])]);
    memo = a.memo;
    const full = board(
      Array.from({ length: 16 }, (_u, i) => [i, i] as [number, number]),
    );
    const b = nextCelebrations(memo, full, [
      line([0, 1, 2, 3]),
      line([0, 4, 8, 12]),
      blackout(),
    ]);
    memo = b.memo;
    const supernovas = [...a.events, ...b.events].filter(
      (e) => e.tier === "supernova",
    );
    expect(supernovas).toHaveLength(2);
    // A further re-report of both wins fires no third supernova.
    const c = nextCelebrations(memo, full, [
      line([0, 1, 2, 3]),
      line([0, 4, 8, 12]),
      blackout(),
    ]);
    expect(c.events.filter((e) => e.tier === "supernova")).toHaveLength(0);
    expect(memo.supernovasFired.size).toBe(2);
  });
});
