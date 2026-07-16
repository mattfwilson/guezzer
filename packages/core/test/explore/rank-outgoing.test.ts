import { describe, expect, it } from "vitest";
import type { MatrixEdge, MatrixNode, TransitionMatrix } from "../../src/domain/types.ts";
import { rankOutgoing } from "../../src/explore/rank-outgoing.ts";

function node(songId: number, songName: string): MatrixNode {
  return { songId, songName, playCount: 0, eraPlayCount: 0, tuningFamily: "standard" };
}

function edge(
  from: number,
  to: number,
  count: number,
  segueCount = 0,
  lastDate = "2020-06-01",
): MatrixEdge {
  return { from, to, count, weightedCount: count, segueCount, firstDate: "2010-01-01", lastDate };
}

function matrix(nodes: MatrixNode[], edges: MatrixEdge[]): TransitionMatrix {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-16T00:00:00.000Z",
    asOfDate: "2025-12-13",
    showCount: 3,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };
}

describe("rankOutgoing (EXPL-02)", () => {
  // Song 10 has three outgoing edges (12/8/1); song 99 is an unrelated
  // incoming-only edge that MUST be ignored (reads e.from, never e.to).
  const fixture = matrix(
    [node(10, "Robot Stop"), node(20, "Gamma Knife"), node(30, "Rattlesnake"), node(40, "People-Vultures")],
    [
      edge(10, 20, 8, 0, "2024-01-01"),
      edge(10, 30, 12, 3, "2025-12-13"),
      edge(10, 40, 1, 0, "2019-05-05"),
      edge(99, 10, 50), // incoming to 10 — never counted as outgoing
    ],
  );

  it("returns the complete outgoing history sorted desc by count with correct total + pct", () => {
    const { total, bars } = rankOutgoing(fixture, 10);
    expect(total).toBe(21); // 12 + 8 + 1, incoming 50 excluded
    expect(bars).toHaveLength(3);
    expect(bars.map((b) => b.count)).toEqual([12, 8, 1]); // sorted desc
    expect(bars[0]).toEqual({ songId: 30, count: 12, pct: 12 / 21, lastDate: "2025-12-13", segueCount: 3 });
    expect(bars[2]).toEqual({ songId: 40, count: 1, pct: 1 / 21, lastDate: "2019-05-05", segueCount: 0 });
  });

  it("reads the FULL matrix edge list, never a pre-filtered link set (D-03)", () => {
    // Even the count===1 tail edge (which the default graph slider hides) is present.
    const { bars } = rankOutgoing(fixture, 10);
    expect(bars.some((b) => b.songId === 40 && b.count === 1)).toBe(true);
  });

  it("zero-outgoing node → honest { total: 0, bars: [] } (D-08 free-floating star)", () => {
    const { total, bars } = rankOutgoing(fixture, 40);
    expect(total).toBe(0);
    expect(bars).toEqual([]);
  });
});
