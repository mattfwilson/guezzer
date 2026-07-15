import { describe, expect, it } from "vitest";
import type { ArchiveShow } from "../../src/dex/archive-types.ts";
import {
  groupShowsByYear,
  makeArchiveSearcher,
  type ArchiveSearchHit,
} from "../../src/dex/search-archive.ts";

/** Small factory for a synthetic archive show with inert set structure. */
function show(over: Partial<ArchiveShow> & Pick<ArchiveShow, "id" | "date" | "venue" | "city">): ArchiveShow {
  return {
    state: null,
    country: "USA",
    sets: [{ n: "1", songs: [10, 20] }],
    ...over,
  };
}

/** ~8-show synthetic archive spanning three years and distinct venues/cities. */
const ARCHIVE: ArchiveShow[] = [
  show({ id: 1, date: "2022-10-07", venue: "Red Rocks Amphitheatre", city: "Morrison" }),
  show({ id: 2, date: "2022-10-08", venue: "Red Rocks Amphitheatre", city: "Morrison" }),
  show({ id: 3, date: "2022-06-01", venue: "The Fillmore", city: "San Francisco" }),
  show({ id: 4, date: "2023-03-15", venue: "Brooklyn Steel", city: "Brooklyn" }),
  show({ id: 5, date: "2023-09-20", venue: "The Caverns", city: "Pelham" }),
  show({ id: 6, date: "2024-02-11", venue: "Hollywood Bowl", city: "Los Angeles" }),
  show({ id: 7, date: "2024-08-30", venue: "Chicago Theatre", city: "Chicago" }),
  show({ id: 8, date: "2024-08-31", venue: "Chicago Theatre", city: "Chicago" }),
];

describe("makeArchiveSearcher — fuzzy show search (D-10)", () => {
  const search = makeArchiveSearcher(ARCHIVE);

  it("matches by venue, case-insensitively", () => {
    const ids = search("red rocks").map((h: ArchiveSearchHit) => h.show.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    // A distant venue should not surface.
    expect(ids).not.toContain(6);
  });

  it("matches by city", () => {
    const ids = search("brooklyn").map((h) => h.show.id);
    expect(ids).toContain(4);
  });

  it("matches by a date fragment (year-month substring tolerance)", () => {
    const ids = search("2022-10").map((h) => h.show.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    // June 2022 should not match a "2022-10" query.
    expect(ids).not.toContain(3);
  });

  it("returns [] on an empty query (never a whole-archive dump)", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });

  it("carries the full ArchiveShow plus a score on each hit", () => {
    const hits = search("Chicago Theatre");
    expect(hits.length).toBeGreaterThan(0);
    const hit = hits[0];
    expect(hit.show).toHaveProperty("sets");
    expect(hit.show).toHaveProperty("country");
    expect(hit).toHaveProperty("score");
  });
});

describe("groupShowsByYear — plain year browse (newest-first, not fuse)", () => {
  it("groups by year, newest year first and newest show first within a year", () => {
    const groups = groupShowsByYear(ARCHIVE);

    expect(groups.map((g) => g.year)).toEqual([2024, 2023, 2022]);

    const y2024 = groups.find((g) => g.year === 2024);
    expect(y2024?.shows.map((s) => s.id)).toEqual([8, 7, 6]);

    const y2022 = groups.find((g) => g.year === 2022);
    expect(y2022?.shows.map((s) => s.id)).toEqual([2, 1, 3]);
  });

  it("does not mutate the input array order", () => {
    const input = [...ARCHIVE];
    const firstBefore = input[0].id;
    groupShowsByYear(input);
    expect(input[0].id).toBe(firstBefore);
  });
});
