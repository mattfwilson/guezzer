import type { MatrixNode } from "../domain/types.ts";

export interface CatalogEntry {
  songId: number;
  songName: string;
}

export interface SearchResult {
  songId: number;
  songName: string;
  score: number;
}

export function toCatalog(_nodes: MatrixNode[]): CatalogEntry[] {
  return [];
}

export function makeCatalogSearcher(_catalog: CatalogEntry[]) {
  return (_query: string): SearchResult[] => [];
}
