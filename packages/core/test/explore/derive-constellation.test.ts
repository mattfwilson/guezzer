import { describe, expect, it } from "vitest";
import type { MatrixEdge, MatrixNode, TransitionMatrix } from "../../src/domain/types.ts";
import {
  deriveConstellation,
  edgesAtThreshold,
  topKEdgesPerNode,
} from "../../src/explore/derive-constellation.ts";

/** Inert matrix-node factory — only the constellation-relevant fields matter. */
function node(
  songId: number,
  songName: string,
  playCount = 0,
  tuningFamily: MatrixNode["tuningFamily"] = "standard",
): MatrixNode {
  return { songId, songName, playCount, eraPlayCount: 0, tuningFamily };
}

/** Inert matrix-edge factory. */
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

describe("deriveConstellation (EXPL-01)", () => {
  // 3 nodes given out of songId order to prove the deterministic sort.
  const fixture = matrix(
    [node(30, "Rattlesnake", 200, "microtonal"), node(10, "Robot Stop", 100), node(20, "Gamma Knife", 50)],
    [edge(10, 20, 5, 1), edge(20, 30, 1)],
  );

  it("maps nodes to library default-key shape sorted FAR→NEAR (ascending z, then id) with synthetic z", () => {
    const { nodes } = deriveConstellation(fixture);
    // Far→near draw order for occlusion: Gamma Knife (z-min) first, Rattlesnake (z=1) last.
    // Robot Stop z=√100/√200≈0.707 sits between Gamma Knife (0.5) and Rattlesnake (1).
    expect(nodes.map((n) => n.id)).toEqual([20, 10, 30]);
    // z = √playCount / √maxPlayCount, 1 = nearest (max playCount).
    expect(nodes[0]).toEqual({
      id: 20,
      name: "Gamma Knife",
      playCount: 50,
      tuningFamily: "standard",
      z: Math.sqrt(50) / Math.sqrt(200),
    });
    expect(nodes[1].z).toBe(Math.sqrt(100) / Math.sqrt(200));
    expect(nodes[2]).toEqual({
      id: 30,
      name: "Rattlesnake",
      playCount: 200,
      tuningFamily: "microtonal",
      z: 1,
    });
    // The exact z values requested by the plan.
    expect(nodes[0].z).toBe(0.5); // Gamma Knife: √50/√200 = √0.25 = 0.5
    expect(nodes[2].z).toBe(1); // Rattlesnake is the max-play node → nearest
  });

  it("maxPlayCount===0 guard: every node z===0, no NaN, deterministic songId order", () => {
    // Degenerate/empty corpus — all playCount 0. No divide-by-zero, no NaN (spike bug class).
    const zeroFixture = matrix(
      [node(30, "C-song", 0), node(10, "A-song", 0), node(20, "B-song", 0)],
      [],
    );
    const { nodes } = deriveConstellation(zeroFixture);
    expect(nodes.map((n) => n.id)).toEqual([10, 20, 30]); // z all equal → songId tie-break
    for (const n of nodes) {
      expect(n.z).toBe(0);
      expect(Number.isNaN(n.z)).toBe(false);
    }
  });

  it("emits links with source/target default accessors AND mutation-safe fromId/toId (Pitfall 1)", () => {
    const { links } = deriveConstellation(fixture);
    const l = links[0];
    expect(l.source).toBe(10);
    expect(l.target).toBe(20);
    expect(l.count).toBe(5);
    expect(l.segueCount).toBe(1);
    // fromId/toId equal the ORIGINAL songIds and are SEPARATE fields — they must
    // survive the library replacing source/target with node object refs post-tick.
    expect(l.fromId).toBe(10);
    expect(l.toId).toBe(20);
  });

  it("threshold x=2 removes count===1 links while the node population is untouched (D-08)", () => {
    const data = deriveConstellation(fixture);
    const kept = edgesAtThreshold(data.links, 2);
    expect(kept).toHaveLength(1); // the count===5 link survives; the count===1 link is dropped
    expect(kept[0].count).toBe(5);
    expect(data.nodes).toHaveLength(3); // nodes never churn with the slider
  });

  it("threshold x=1 restores the full truth", () => {
    const data = deriveConstellation(fixture);
    expect(edgesAtThreshold(data.links, 1)).toHaveLength(2);
  });
});

describe("topKEdgesPerNode (declutter — degree-aware sparsifier)", () => {
  /** Shorthand: build a matrix from raw edges over a padded node set, derive its links. */
  function links(edges: MatrixEdge[]) {
    // Collect every songId the edges touch so deriveConstellation has matching nodes
    // (node identity is irrelevant to the sparsifier, which reads fromId/toId/count).
    const ids = new Set<number>();
    for (const e of edges) {
      ids.add(e.from);
      ids.add(e.to);
    }
    const nodes = [...ids].map((id) => node(id, `song-${id}`));
    return deriveConstellation(matrix(nodes, edges)).links;
  }

  /** Stable "fromId->toId" identity used across assertions. */
  const key = (l: { fromId: number; toId: number }) => `${l.fromId}->${l.toId}`;

  it("hub cap: a source with >K out-edges keeps EXACTLY its K highest-count edges", () => {
    // Source 10 has 4 out-edges; k=2 keeps the two highest counts (50, 40 → to 40, 30).
    const kept = topKEdgesPerNode(
      links([edge(10, 20, 10), edge(10, 30, 40), edge(10, 40, 50), edge(10, 50, 20)]),
      2,
    );
    expect(kept).toHaveLength(2);
    expect(kept.map(key).sort()).toEqual(["10->30", "10->40"]);
  });

  it("leaf keep-all: a source with <K out-edges keeps all of them (no crash, no padding)", () => {
    const kept = topKEdgesPerNode(links([edge(10, 20, 5), edge(10, 30, 3)]), 5);
    expect(kept).toHaveLength(2);
    expect(kept.map(key).sort()).toEqual(["10->20", "10->30"]);
  });

  it("deterministic tie-break: equal counts, k=1 → the lower-toId edge wins", () => {
    const kept = topKEdgesPerNode(links([edge(10, 30, 5), edge(10, 20, 5)]), 1);
    expect(kept).toHaveLength(1);
    expect(key(kept[0])).toBe("10->20");
  });

  it("k=1: each source contributes at most one edge", () => {
    const kept = topKEdgesPerNode(
      links([edge(10, 20, 5), edge(10, 30, 3), edge(40, 50, 7), edge(40, 60, 2)]),
      1,
    );
    expect(kept).toHaveLength(2);
    expect(kept.map(key).sort()).toEqual(["10->20", "40->50"]);
  });

  it("k >= max out-degree: every link survives (union equals input)", () => {
    const all = links([edge(10, 20, 5), edge(10, 30, 3), edge(20, 30, 1)]);
    const kept = topKEdgesPerNode(all, 10);
    expect(kept).toHaveLength(all.length);
    expect(kept.map(key).sort()).toEqual(all.map(key).sort());
  });

  it("reciprocal pair both survive: A->B and B->A, k=1 → both kept (each its own source's top)", () => {
    const kept = topKEdgesPerNode(links([edge(10, 20, 5), edge(20, 10, 3)]), 1);
    expect(kept).toHaveLength(2);
    expect(kept.map(key).sort()).toEqual(["10->20", "20->10"]);
  });
});
