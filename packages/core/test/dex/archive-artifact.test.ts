import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import type { NormalizedCorpus, NormalizedShow } from "../../src/domain/types.ts";
import { deriveArchive } from "../../src/dex/archive.ts";
import {
  archiveArtifact,
  archiveSetSchema,
  dexAlbumsArtifact,
} from "../../src/dex/archive-types.ts";
// Barrel re-export check (index.ts must surface the Phase-6 dex block).
import {
  archiveArtifact as barrelArchiveArtifact,
  dexAlbumsArtifact as barrelDexAlbumsArtifact,
  type ArchiveArtifact,
  type DexAlbumsArtifact,
} from "../../src/index.ts";

/**
 * A minimal-but-valid archive artifact fixture matching the RESEARCH measured
 * shape. Used across the strictObject accept/reject assertions.
 */
function minimalArchive(): ArchiveArtifact {
  return {
    schemaVersion: 1,
    latestShowDate: "2025-12-13",
    songs: { "23": "Ants & Bats", "127": "Life Is Cool" },
    shows: [
      {
        id: 1678162923,
        date: "2010-10-29",
        venue: "Kaleide Theatre",
        city: "Naarm (Melbourne)",
        state: "VIC",
        country: "Australia",
        sets: [{ n: "1", songs: [23, 127] }],
      },
    ],
  };
}

function minimalDexAlbums(): DexAlbumsArtifact {
  return {
    schemaVersion: 1,
    albums: [
      {
        albumUrl: "/albums/12-bar-bruise",
        title: "12 Bar Bruise",
        releaseDate: "2012-09-07",
        tracks: [
          { songId: 42, slug: "12-bar-bruise", title: "12 Bar Bruise", position: 1, inMatrix: true },
        ],
      },
    ],
    buckets: {
      covers: [{ songId: 99, slug: "moby-dick", title: "Moby Dick", position: 1, inMatrix: true }],
      miscellaneous: [
        { songId: 100, slug: "jam", title: "Jam", position: 1, inMatrix: true },
      ],
    },
  };
}

describe("config.dex block (D-15 / UI-SPEC defaults)", () => {
  it("Test 1: RARITY_QUANTILES pins legendary/rare/uncommon cut-points", () => {
    expect(config.dex.RARITY_QUANTILES.legendary).toBe(0.05);
    expect(config.dex.RARITY_QUANTILES.rare).toBe(0.2);
    expect(config.dex.RARITY_QUANTILES.uncommon).toBe(0.5);
  });

  it("Test 2: RARITY_MIN_PLAYS guards tiny-sample fake Legendary (Pitfall 12)", () => {
    expect(config.dex.RARITY_MIN_PLAYS).toBe(3);
  });

  it("Test 3: artifact paths are config-resident", () => {
    expect(config.dex.archiveArtifactPath).toBe("data/normalized/archive.json");
    expect(config.dex.dexAlbumsArtifactPath).toBe("data/normalized/dex-albums.json");
  });

  it("Test 4: cardAlbumUrls is the D-04 studio-discography allowlist (20-35 entries)", () => {
    expect(config.dex.cardAlbumUrls.length).toBeGreaterThanOrEqual(20);
    expect(config.dex.cardAlbumUrls.length).toBeLessThanOrEqual(35);
    // Pitfall 3 / Open Question 4: the real Fishing For Fishies, never the -video dupe.
    expect(config.dex.cardAlbumUrls).toContain("/albums/fishing-for-fishies");
    expect(config.dex.cardAlbumUrls).not.toContain("/albums/fishing-for-fishies-video");
  });
});

describe("archiveArtifact schema (zod strictObject)", () => {
  it("Test 5: round-trips a minimal valid fixture", () => {
    const parsed = archiveArtifact.parse(minimalArchive());
    expect(parsed.shows.length).toBe(1);
    expect(parsed.latestShowDate).toBe("2025-12-13");
  });

  it("Test 6: rejects an object with an extra top-level key (strictObject)", () => {
    const bad = { ...minimalArchive(), rogue: true };
    expect(() => archiveArtifact.parse(bad)).toThrow();
  });

  it("Test 7: archiveSetSchema rejects n:'3' (enum-pinned set vocabulary)", () => {
    expect(() => archiveSetSchema.parse({ n: "3", songs: [1] })).toThrow();
    expect(archiveSetSchema.parse({ n: "e", songs: [1] }).n).toBe("e");
  });
});

describe("dexAlbumsArtifact schema (zod strictObject)", () => {
  it("Test 8: round-trips a minimal valid fixture", () => {
    const parsed = dexAlbumsArtifact.parse(minimalDexAlbums());
    expect(parsed.albums.length).toBe(1);
    expect(parsed.buckets.covers.length).toBe(1);
  });

  it("Test 9: rejects a track row with a non-integer songId", () => {
    const bad = minimalDexAlbums();
    // A non-integer songId is a valid `number` at the TS level but zod's
    // `.int()` rejects it at the runtime trust boundary.
    bad.albums[0].tracks[0].songId = 1.5;
    expect(() => dexAlbumsArtifact.parse(bad)).toThrow();
  });
});

describe("index.ts barrel re-exports (Phase-6 dex block)", () => {
  it("Test 10: archiveArtifact and dexAlbumsArtifact are re-exported from the barrel", () => {
    expect(barrelArchiveArtifact).toBe(archiveArtifact);
    expect(barrelDexAlbumsArtifact).toBe(dexAlbumsArtifact);
  });
});

/** Resolve a repo-root-relative data file independent of the test runner cwd. */
function repoFile(rel: string): string {
  return fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
}

/** A synthetic show with minimal-but-valid performances (only the fields deriveArchive reads matter). */
function makeShow(
  showId: number,
  date: string,
  showOrder: number,
  sets: Array<{ n: "1" | "2" | "e"; perfs: Array<{ songId: number; songName: string; placeholder?: boolean }> }>,
): NormalizedShow {
  return {
    showId,
    date,
    showOrder,
    year: Number(date.slice(0, 4)),
    venue: { venueId: 1, name: `Venue ${showId}`, city: "Town", state: null, country: "Australia" },
    tourId: 2,
    tourName: "Tour",
    sets: sets.map((s) => ({
      setNumber: s.n,
      performances: s.perfs.map((p, i) => ({
        songId: p.songId,
        songName: p.songName,
        slug: p.songName.toLowerCase().replace(/\s+/g, "-"),
        position: i + 1,
        transitionKind: "none" as const,
        transitionId: 1,
        isCover: false,
        originalArtist: null,
        isPlaceholder: p.placeholder ?? false,
        footnotesParsed: null,
        footnotesRaw: null,
        footnote: "",
      })),
    })),
  };
}

function makeCorpus(shows: NormalizedShow[]): NormalizedCorpus {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-08T21:48:06.479Z",
    latestShowDate: shows.reduce((m, s) => (s.date > m ? s.date : m), ""),
    showCount: shows.length,
    songCount: 0,
    shows,
  };
}

describe("deriveArchive (synthetic corpus fixtures)", () => {
  const corpus = makeCorpus([
    makeShow(1001, "2010-10-29", 1, [
      { n: "1", perfs: [{ songId: 23, songName: "Ants & Bats" }, { songId: 1, songName: "Unknown", placeholder: true }] },
      { n: "e", perfs: [{ songId: 127, songName: "Life Is Cool" }] },
    ]),
    makeShow(1002, "2025-12-13", 1, [
      { n: "1", perfs: [{ songId: 127, songName: "Life Is Cool" }, { songId: 42, songName: "Robot Stop" }] },
    ]),
  ]);
  const archive = deriveArchive(corpus);

  it("Test 11: shows are sorted newest-first", () => {
    expect(archive.shows.map((s) => s.date)).toEqual(["2025-12-13", "2010-10-29"]);
  });

  it("Test 12: latestShowDate is the maximum show date", () => {
    expect(archive.latestShowDate).toBe("2025-12-13");
  });

  it("Test 13: set structure and in-set song order are preserved", () => {
    const oldShow = archive.shows.find((s) => s.id === 1001);
    expect(oldShow?.sets.map((set) => set.n)).toEqual(["1", "e"]);
    expect(oldShow?.sets[0].songs).toEqual([23]); // placeholder/sentinel dropped from set 1
    expect(oldShow?.sets[1].songs).toEqual([127]);
  });

  it("Test 14: the sentinel/placeholder song is excluded from the songs map", () => {
    expect(archive.songs["1"]).toBeUndefined();
    expect(archive.songs["23"]).toBe("Ants & Bats");
    expect(archive.songs["127"]).toBe("Life Is Cool");
    expect(archive.songs["42"]).toBe("Robot Stop");
  });

  it("Test 15: the output validates through archiveArtifact.parse", () => {
    expect(() => archiveArtifact.parse(archive)).not.toThrow();
  });
});

describe("committed archive.json artifact", () => {
  it("Test 16: parses through archiveArtifact, has 738 shows, matches corpus latestShowDate, under 250 KB", async () => {
    const rawText = await readFile(repoFile("data/normalized/archive.json"), "utf8");
    const parsed = archiveArtifact.parse(JSON.parse(rawText));
    expect(parsed.shows.length).toBe(738);

    const corpusText = await readFile(repoFile("data/normalized/corpus.json"), "utf8");
    const corpus = JSON.parse(corpusText) as NormalizedCorpus;
    expect(parsed.latestShowDate).toBe(corpus.latestShowDate);

    expect(Buffer.byteLength(rawText, "utf8")).toBeLessThanOrEqual(250 * 1024);
  });
});
