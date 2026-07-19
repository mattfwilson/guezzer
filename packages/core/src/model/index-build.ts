/**
 * D-08: build an in-memory `from -> edges` index (plus a `songId ->
 * MatrixNode` lookup) over a frozen `TransitionMatrix`'s edge list, so the
 * predictor (Phase 4) has O(1) successor access instead of a linear scan.
 * Mirrors `ingest/tuning-tags.ts`'s `deriveCatalogFromCorpus` "walk once,
 * Map-keyed index" pattern. Pure, no I/O.
 */
import type { MatrixEdge, MatrixNode, TransitionMatrix } from "../domain/types.ts";

export interface MatrixIndex {
  edgesFrom: Map<number, MatrixEdge[]>;
  nodeById: Map<number, MatrixNode>;
  /**
   * PRED-02: total shows in the corpus the matrix was built from
   * (`matrix.showCount`, matrix.ts:186 `showCount: shows.length`). Threaded
   * through so `eraPrior` can compute a dimensionally-correct per-show career
   * rate (`node.playCount / showCount`) instead of the catalog-marginal
   * `basePlayRate`. Copied straight off the matrix header — no rebuild.
   */
  showCount: number;
}

export function buildMatrixIndex(matrix: TransitionMatrix): MatrixIndex {
  const nodeById = new Map<number, MatrixNode>();
  for (const node of matrix.nodes) {
    nodeById.set(node.songId, node);
  }

  const edgesFrom = new Map<number, MatrixEdge[]>();
  for (const edge of matrix.edges) {
    const existing = edgesFrom.get(edge.from);
    if (existing) {
      existing.push(edge);
    } else {
      edgesFrom.set(edge.from, [edge]);
    }
  }

  return { edgesFrom, nodeById, showCount: matrix.showCount };
}
