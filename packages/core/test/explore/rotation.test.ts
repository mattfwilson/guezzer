import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { archiveArtifact, type ArchiveArtifact, type ArchiveShow } from "../../src/dex/archive-types.ts";
import { rotationSongIds } from "../../src/explore/rotation.ts";

/** Resolve a repo-root-relative data file independent of the test runner cwd. */
function repoFile(rel: string): string {
  return fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
}

/** One-set archived show factory — only date + songs matter to the rotation filter. */
function show(id: number, date: string, songs: number[]): ArchiveShow {
  return {
    id,
    date,
    venue: "Venue",
    city: "City",
    state: null,
    country: "AU",
    sets: [{ n: "1", songs }],
  };
}

function archive(shows: ArchiveShow[]): ArchiveArtifact {
  return {
    schemaVersion: 1,
    latestShowDate: "2025-03-01",
    songs: {},
    shows,
  };
}

describe("rotationSongIds (EXPL-03)", () => {
  // Six shows given OUT of date order — proves the function sorts by date
  // descending before slicing, never trusts array order (Pitfall 5).
  const fixture = archive([
    show(1, "2025-01-01", [1, 2]), // older
    show(2, "2025-03-01", [3, 4]), // newest
    show(3, "2025-02-15", [5, 6]), // 3rd newest
    show(4, "2024-12-01", [7]), // older
    show(5, "2025-02-20", [6, 8]), // 2nd newest (shares song 6 with show 3)
    show(6, "2024-06-01", [9]), // oldest
  ]);

  it("returns exactly the distinct songs of the last N shows BY DATE (not array order)", () => {
    const ids = rotationSongIds(fixture, 3);
    // Newest 3 by date: 2025-03-01 [3,4], 2025-02-20 [6,8], 2025-02-15 [5,6] → {3,4,5,6,8}
    expect([...ids].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 8]);
    // Songs only in older shows must NOT leak in.
    expect(ids.has(1)).toBe(false);
    expect(ids.has(7)).toBe(false);
    expect(ids.has(9)).toBe(false);
  });

  it("returns an empty Set for a zero window or an empty archive (no throw)", () => {
    expect(rotationSongIds(fixture, 0).size).toBe(0);
    expect(rotationSongIds(archive([]), 5).size).toBe(0);
  });

  it("real corpus: N=5 → 56 distinct songs (guards the D-06 data-driven default)", async () => {
    const raw = JSON.parse(await readFile(repoFile("data/normalized/archive.json"), "utf8"));
    const real = archiveArtifact.parse(raw);
    expect(rotationSongIds(real, 5).size).toBe(56);
  });
});
