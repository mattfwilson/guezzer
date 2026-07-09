/**
 * SHOW-04 catalog fuzzy search: a pure, DOM-free fuzzy matcher over the
 * catalog, so the miss path ("misses as fast as hits") is Node-testable and
 * swappable (CLAUDE.md: wrap fuse.js behind a core function so it can be
 * traded for uFuzzy/MiniSearch if match quality disappoints). This module is
 * pure: it holds no state beyond the Fuse index the caller memoizes, touches
 * no file/network, and — like the rest of core — imports zero React/DOM
 * symbols. fuse.js has no DOM/browser dependency, so it keeps core's
 * "lib": ["ES2023"]/no-React purity intact.
 *
 * The catalog is the 264 TransitionMatrix nodes (each carries `songId` +
 * `songName`); there is no separate catalog source. Tuning knobs
 * (threshold/distance) live in config.search (RESEARCH A1 — tunable/swappable,
 * no scattered magic numbers per CLAUDE.md).
 */
import Fuse from "fuse.js";
import { config } from "../config.ts";
import type { MatrixNode } from "../domain/types.ts";

/** The minimal, searchable projection of a catalog song. */
export interface CatalogEntry {
  songId: number;
  songName: string;
}

/** One ranked search hit. `score` is fuse.js's 0 (perfect) .. 1 (worst). */
export interface SearchResult {
  songId: number;
  songName: string;
  score: number;
}

/**
 * Project matrix nodes down to the two fields the search needs. Lossless for
 * `songId`/`songName`; every other MatrixNode field is intentionally dropped
 * so the search index stays small and the UI never over-reads.
 */
export function toCatalog(nodes: MatrixNode[]): CatalogEntry[] {
  return nodes.map((node) => ({ songId: node.songId, songName: node.songName }));
}

/**
 * Build the Fuse index once (the caller memoizes the returned searcher) and
 * query it many times. An empty or whitespace-only query short-circuits to
 * `[]` — never a whole-catalog dump, which would flood the one-thumb miss
 * sheet. `ignoreLocation` makes a match anywhere in the song name count
 * equally; `includeScore` surfaces fuse.js's rank so the UI can order hits.
 */
export function makeCatalogSearcher(
  catalog: CatalogEntry[],
): (query: string) => SearchResult[] {
  const fuse = new Fuse(catalog, {
    keys: ["songName"],
    threshold: config.search.threshold,
    distance: config.search.distance,
    ignoreLocation: true,
    includeScore: true,
  });

  return (query: string): SearchResult[] =>
    query.trim() === ""
      ? []
      : fuse.search(query).map((result) => ({
          songId: result.item.songId,
          songName: result.item.songName,
          score: result.score ?? 1,
        }));
}
