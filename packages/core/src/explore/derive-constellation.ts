/**
 * EXPL-01: pure derivation of the force-directed constellation `{nodes, links}`
 * from the frozen `TransitionMatrix` — the SAME artifact the predictor consumes
 * (one pipeline, CLAUDE.md). Zero I/O: performs no network/disk access, reads
 * only what the caller passes in. No React/DOM/browser dependency — the renderer
 * (`react-force-graph-2d`) lives app-side; this only reshapes trusted data.
 *
 * Mirrors `model/matrix.ts`'s "pure module, explicit sort comparators, no magic
 * numbers" shape. Node objects carry the library's default `id` accessor; link
 * objects carry the default `source`/`target` accessors PLUS mutation-safe
 * `fromId`/`toId` copies (RESEARCH Pitfall 1): the simulation replaces
 * `link.source`/`link.target` with live node-object references after the first
 * tick, so focus-dim adjacency lookups must read `fromId`/`toId`, never the
 * mutated `source`/`target`.
 */
import { config } from "../config.ts";
import type { TransitionMatrix } from "../domain/types.ts";
import type { TuningFamily } from "../ingest/tuning-tags.ts";

/** One constellation node — `id` is the library's default node accessor (EXPL-01). */
export interface ConstellationNode {
  id: number;
  name: string;
  playCount: number;
  tuningFamily: TuningFamily;
  /**
   * Synthetic depth 0..1, 1 = nearest camera. `z = √playCount / √maxPlayCount`
   * (guarded to 0 when maxPlayCount === 0 — never NaN). Drives the app-side
   * spherical depth-scaling (radius/opacity/color-fade) AND the occlusion draw
   * order: the returned `nodes` array is sorted FAR→NEAR (ascending z) so the
   * renderer — which paints in `graphData.nodes` array order — draws the nearest
   * node LAST, on top. See `deriveConstellation`.
   */
  z: number;
}

/**
 * One directed constellation link. `source`/`target` are the library's default
 * accessors (mutated to node refs post-tick); `fromId`/`toId` are the immutable
 * songId copies for adjacency/focus-dim; `count`/`segueCount` drive edge width
 * and the slider threshold.
 */
export interface ConstellationLink {
  source: number;
  target: number;
  count: number;
  segueCount: number;
  fromId: number;
  toId: number;
}

/** The `graphData` shape `<ForceGraph2D>` consumes. */
export interface ConstellationData {
  nodes: ConstellationNode[];
  links: ConstellationLink[];
}

/**
 * Reshape a `TransitionMatrix` into `{nodes, links}`. Each node carries a
 * synthetic depth `z = √playCount / √maxPlayCount` ∈ [0,1] (1 = nearest), and the
 * `nodes` array is sorted FAR→NEAR — ascending `z`, then ascending `songId` as a
 * deterministic tie-break (fixture-stable, stable initial simulation seeding).
 *
 * Far→near ordering is load-bearing for OCCLUSION: `react-force-graph-2d` paints
 * in `graphData.nodes` array order (its paint loop is
 * `state.graphData.nodes.filter(getVisibility).forEach(...)`, verified in
 * `force-graph` source — `.filter` preserves order, `.forEach` iterates it), so
 * the nearest node is drawn LAST and overpaints the far nodes behind it. Sorting
 * once here keeps depth ordering in the single pure pipeline (CLAUDE.md); all
 * VISUAL depth shaping stays app-side in `config.explore`. The `cfg` param mirrors
 * the core pure-fn idiom and keeps the door open for config-driven derivation
 * without a signature change.
 */
export function deriveConstellation(
  matrix: TransitionMatrix,
  _cfg: typeof config = config,
): ConstellationData {
  // Depth normalization needs only data (largest playCount) — no tunable constant,
  // so `config.explore` (core) and the configMirror are untouched. Guard maxPlay===0
  // (empty/degenerate corpus) so z is 0, never NaN (spike bug #1 class).
  const maxPlayCount = matrix.nodes.reduce((m, n) => (n.playCount > m ? n.playCount : m), 0);
  const sqrtMax = Math.sqrt(maxPlayCount);

  const nodes: ConstellationNode[] = matrix.nodes
    .map((n) => ({
      id: n.songId,
      name: n.songName,
      playCount: n.playCount,
      tuningFamily: n.tuningFamily,
      z: sqrtMax === 0 ? 0 : Math.sqrt(n.playCount) / sqrtMax,
    }))
    // Far→near: ascending z (nearest painted last for occlusion), songId tie-break.
    .sort((a, b) => a.z - b.z || a.id - b.id);

  const links: ConstellationLink[] = matrix.edges.map((e) => ({
    source: e.from,
    target: e.to,
    count: e.count,
    segueCount: e.segueCount,
    fromId: e.from,
    toId: e.to,
  }));

  return { nodes, links };
}

/**
 * D-08 edge-count threshold predicate: keep only links with `count >= threshold`.
 * Operates on LINKS only — the node population is deliberately untouched (the
 * caller keeps its node array), so hiding all of a node's edges leaves it as a
 * free-floating star. This is the render-pass filter behind the edge slider;
 * `EDGE_COUNT_THRESHOLD_DEFAULT = 2` removes every misleading one-play edge.
 */
export function edgesAtThreshold(
  links: readonly ConstellationLink[],
  threshold: number,
): ConstellationLink[] {
  return links.filter((l) => l.count >= threshold);
}

/**
 * EXPL-04/EXPL-06 degree-aware sparsifier: keep each source song's K highest-count
 * OUT edges, returning the UNION across all sources. A pure render-pass helper —
 * like `edgesAtThreshold`, it filters LINKS only and never touches the node
 * population (per EXPL-04/EXPL-06: no graphData rebuild, no d3 reheat; frozen
 * fx/fy survive). Operates strictly on the immutable `fromId`/`toId` copies, never
 * the post-tick-mutated `source`/`target` (RESEARCH Pitfall 1).
 *
 * Where the global `count >= threshold` gate draws a hairball (the power-law hubs
 * fan out 100+ edges), this caps every node's out-degree to K. Default K=2 draws
 * ~332 of 2,987 corpus edges (−68% vs the 1,041 at count≥2) — a legible sky.
 *
 * Membership rule (documented): a link is kept iff it is in its OWN source node's
 * top-K OUT set. A consequence: a reciprocal pair A→B and B→A both generally
 * survive, since each is a top edge from its own source — exactly the case the
 * canvas then bows apart with `linkCurvature`. Tie-break is deterministic (count
 * desc, then toId asc), never input-order dependent, mirroring the file's
 * sort-comparator idiom.
 */
export function topKEdgesPerNode(
  links: readonly ConstellationLink[],
  k: number,
): ConstellationLink[] {
  const bySource = new Map<number, ConstellationLink[]>();
  for (const l of links) {
    const bucket = bySource.get(l.fromId);
    if (bucket) bucket.push(l);
    else bySource.set(l.fromId, [l]);
  }

  const kept: ConstellationLink[] = [];
  for (const bucket of bySource.values()) {
    bucket.sort((a, b) => b.count - a.count || a.toId - b.toId);
    for (const l of bucket.slice(0, k)) kept.push(l);
  }
  return kept;
}
