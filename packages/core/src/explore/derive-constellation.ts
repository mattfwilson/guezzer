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
 * Reshape a `TransitionMatrix` into `{nodes, links}`. Nodes are sorted by
 * `songId` ascending for deterministic output (fixture-stable, stable initial
 * simulation seeding). The `cfg` param mirrors the core pure-fn idiom and keeps
 * the door open for config-driven derivation without a signature change.
 */
export function deriveConstellation(
  matrix: TransitionMatrix,
  _cfg: typeof config = config,
): ConstellationData {
  const nodes: ConstellationNode[] = matrix.nodes
    .map((n) => ({
      id: n.songId,
      name: n.songName,
      playCount: n.playCount,
      tuningFamily: n.tuningFamily,
    }))
    .sort((a, b) => a.id - b.id);

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
