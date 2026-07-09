/**
 * D-07/D-08/D-09/D-10: pure derivation of the frozen `TransitionMatrix`
 * artifact from an already-normalized corpus. Zero I/O — performs no
 * network/disk access, reads only what the caller passes in. Mirrors
 * `ingest/census.ts`'s "pure module, one top-level fn, Map-keyed
 * accumulation, explicit sort comparators" shape.
 */
import { config } from "../config.ts";
import type { TuningFamily } from "../ingest/tuning-tags.ts";
import type {
  AsOfBound,
  MatrixEdge,
  MatrixNode,
  NormalizedCorpus,
  NormalizedShow,
  TransitionMatrix,
} from "../domain/types.ts";
import { decayedWeight } from "./decay.ts";

/** Round weightedCount to a fixed precision before serialization — float-summation-order determinism (RESEARCH Pitfall 2). */
const WEIGHTED_COUNT_PRECISION = 1e9;

function roundWeighted(value: number): number {
  return Math.round(value * WEIGHTED_COUNT_PRECISION) / WEIGHTED_COUNT_PRECISION;
}

/**
 * D-09 refined by 02-RESEARCH.md M5: an exclusive `(date, showOrder)` tuple
 * bound, never `date <= cutoff` alone — same-date shows exist and a
 * date-only cutoff would leak a same-date-but-later show (Pitfall 3).
 * `asOf.inclusive` controls whether the show AT the bound's own
 * `(date, showOrder)` itself passes.
 */
function passesAsOf(show: NormalizedShow, asOf: AsOfBound): boolean {
  if (show.date < asOf.date) return true;
  if (show.date > asOf.date) return false;
  return asOf.inclusive ? show.showOrder <= asOf.showOrder : show.showOrder < asOf.showOrder;
}

interface EdgeAccumulator {
  from: number;
  to: number;
  count: number;
  weightedCount: number;
  segueCount: number;
  firstDate: string;
  lastDate: string;
}

interface NodeAccumulator {
  songId: number;
  songName: string;
  playCount: number;
  eraPlayCount: number;
}

export interface BuildMatrixOptions {
  /** songId -> TuningFamily lookup (data/tuning-tags.json), taken as a parameter to keep buildMatrix pure/I/O-free. Missing songs default to "other". */
  tuningFamilyBySongId?: ReadonlyMap<number, TuningFamily>;
  /** ISO timestamp override for the artifact header — exposed for deterministic tests/CLI reproduction, mirrors ingest/normalize.ts's NormalizeOptions.generatedAt. */
  generatedAt?: string;
}

/**
 * `buildMatrix(corpus, asOf, cfg) -> TransitionMatrix` (D-08). Algorithm:
 * (1) filter shows to the exclusive `(date, showOrder)` as-of bound; (2)
 * within EACH set, walk position-adjacent performance pairs ONLY — never
 * across sets or into/out of the encore (D-07); (3) skip any pair touching
 * a placeholder or sentinel song id; (4) per surviving edge accumulate
 * `count`, `weightedCount` (recency-decayed, D-10), `segueCount` (on A's
 * OUT-transition — Pitfall 1), `firstDate`/`lastDate`. Nodes carry
 * `playCount` (all shows within the as-of bound) and `eraPlayCount`
 * (plays within the trailing `cfg.eraWindowShows` shows before the
 * cutoff — MODL-07's operational "current era", baked in at build time so
 * the predictor's era-prior signal stays a pure, leak-safe read).
 */
export function buildMatrix(
  corpus: NormalizedCorpus,
  asOf: AsOfBound,
  cfg: typeof config = config,
  options: BuildMatrixOptions = {},
): TransitionMatrix {
  const sentinelIds = cfg.sentinelSongIds as readonly number[];
  const tuningFamilyBySongId = options.tuningFamilyBySongId ?? new Map<number, TuningFamily>();

  // Fixed (date, showOrder) iteration order (Pitfall 2 determinism) — filter
  // to the as-of bound first, then sort explicitly rather than relying on
  // corpus.shows' pre-sorted order as a hidden contract.
  const shows = corpus.shows
    .filter((show) => passesAsOf(show, asOf))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.showOrder - b.showOrder));

  // Trailing era window (RESEARCH M8): the last cfg.eraWindowShows shows (by
  // the same fixed order) before the cutoff define "current era" for
  // eraPlayCount. Leak-safe: only shows already inside the as-of bound.
  const eraShowIds = new Set(
    shows.slice(Math.max(0, shows.length - cfg.eraWindowShows)).map((show) => show.showId),
  );

  const edges = new Map<string, EdgeAccumulator>();
  const nodes = new Map<number, NodeAccumulator>();

  for (const show of shows) {
    for (const set of show.sets) {
      const performances = set.performances;

      // Node accounting: every non-sentinel, non-placeholder performance
      // counts toward playCount/eraPlayCount, independent of edge emission.
      for (const performance of performances) {
        if (performance.isPlaceholder || sentinelIds.includes(performance.songId)) continue;
        let node = nodes.get(performance.songId);
        if (!node) {
          node = {
            songId: performance.songId,
            songName: performance.songName,
            playCount: 0,
            eraPlayCount: 0,
          };
          nodes.set(performance.songId, node);
        }
        node.playCount += 1;
        if (eraShowIds.has(show.showId)) node.eraPlayCount += 1;
      }

      // Within-set edge emission ONLY (D-07 boundary exclusion) — never
      // across sets, never into/out of the encore.
      for (let i = 0; i < performances.length - 1; i++) {
        const a = performances[i];
        const b = performances[i + 1];
        if (a.isPlaceholder || b.isPlaceholder) continue; // never bridge Unknown
        if (sentinelIds.includes(a.songId) || sentinelIds.includes(b.songId)) continue;

        const key = `${a.songId}->${b.songId}`;
        let edge = edges.get(key);
        if (!edge) {
          edge = {
            from: a.songId,
            to: b.songId,
            count: 0,
            weightedCount: 0,
            segueCount: 0,
            firstDate: show.date,
            lastDate: show.date,
          };
          edges.set(key, edge);
        }
        edge.count += 1;
        edge.weightedCount += decayedWeight(show.date, asOf.date, cfg.decayHalfLifeDays);
        // A's OUT-transition is the segue signal for A->B (Pitfall 1) —
        // never B's in-transition.
        if (a.transitionKind === "segue") edge.segueCount += 1;
        if (show.date < edge.firstDate) edge.firstDate = show.date;
        if (show.date > edge.lastDate) edge.lastDate = show.date;
      }
    }
  }

  const matrixNodes: MatrixNode[] = [...nodes.values()]
    .map(
      (node): MatrixNode => ({
        songId: node.songId,
        songName: node.songName,
        playCount: node.playCount,
        eraPlayCount: node.eraPlayCount,
        tuningFamily: tuningFamilyBySongId.get(node.songId) ?? "other",
      }),
    )
    .sort((a, b) => a.songId - b.songId);

  const matrixEdges: MatrixEdge[] = [...edges.values()]
    .map(
      (edge): MatrixEdge => ({
        from: edge.from,
        to: edge.to,
        count: edge.count,
        weightedCount: roundWeighted(edge.weightedCount),
        segueCount: edge.segueCount,
        firstDate: edge.firstDate,
        lastDate: edge.lastDate,
      }),
    )
    .sort((a, b) => (a.from !== b.from ? a.from - b.from : a.to - b.to));

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    asOfDate: asOf.date,
    showCount: shows.length,
    nodeCount: matrixNodes.length,
    edgeCount: matrixEdges.length,
    nodes: matrixNodes,
    edges: matrixEdges,
  };
}
