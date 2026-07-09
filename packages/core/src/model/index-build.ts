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

  return { edgesFrom, nodeById };
}
