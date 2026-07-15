import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
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
    // @ts-expect-error deliberately corrupt the songId to a float
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
