import { describe, expect, it } from "vitest";
import type { MatrixNode } from "../src/domain/types.ts";
import {
  makeCatalogSearcher,
  toCatalog,
  type CatalogEntry,
} from "../src/search/search-catalog.ts";

/**
 * Small fixture catalog with known expected outputs (mirrors
 * tuning-tags.test.ts's fixture-with-known-output idiom). Only `songId` and
 * `songName` matter to searchCatalog; the other MatrixNode fields are filled
 * with inert values so the fixture type-checks as a real node.
 */
function node(songId: number, songName: string): MatrixNode {
  return { songId, songName, playCount: 0, eraPlayCount: 0, tuningFamily: "standard" };
}

const nodes: MatrixNode[] = [
  node(1, "Rattlesnake"),
  node(2, "Robot Stop"),
  node(3, "The River"),
  node(4, "Crumbling Castle"),
  node(5, "Hot Water"),
];

describe("searchCatalog", () => {
  it("Test 1: ranks an exact song name first", () => {
    const search = makeCatalogSearcher(toCatalog(nodes));
    const results = search("Rattlesnake");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].songName).toBe("Rattlesnake");
    expect(results[0].songId).toBe(1);
  });

  it("Test 2: tolerates a one-character typo and still returns the intended song", () => {
    const search = makeCatalogSearcher(toCatalog(nodes));
    const results = search("Ratlesnake");
    expect(results.some((r) => r.songName === "Rattlesnake")).toBe(true);
  });

  it("Test 3: returns [] for an empty or whitespace-only query (never the full catalog)", () => {
    const search = makeCatalogSearcher(toCatalog(nodes));
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });

  it("Test 4: toCatalog projects MatrixNode[] to { songId, songName }[] losslessly", () => {
    expect(toCatalog(nodes)).toEqual<CatalogEntry[]>([
      { songId: 1, songName: "Rattlesnake" },
      { songId: 2, songName: "Robot Stop" },
      { songId: 3, songName: "The River" },
      { songId: 4, songName: "Crumbling Castle" },
      { songId: 5, songName: "Hot Water" },
    ]);
  });
});
