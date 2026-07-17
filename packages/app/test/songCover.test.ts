import { describe, expect, it } from "vitest";
import type { DexAlbumsArtifact } from "@guezzer/core";
import { buildSongCoverSlugMap } from "../src/dex/song-cover.ts";

/**
 * Pure-derivation unit test (CLAUDE.md testing convention: small fixture with
 * known expected outputs). `buildSongCoverSlugMap` turns a DexAlbumsArtifact into
 * a songId -> album-cover-slug map; the fixture IS the input (no mocks). Only
 * songs INSIDE `albums[].tracks` with a non-null songId get an entry — bucket
 * songs (Covers/Miscellaneous) carry no card album, so they map to no art.
 */
const fixture: DexAlbumsArtifact = {
  schemaVersion: 1,
  albums: [
    {
      albumUrl: "/albums/nonagon-infinity",
      title: "Nonagon Infinity",
      releaseDate: "2016-04-29",
      tracks: [
        { songId: 42, slug: "robot-stop", title: "Robot Stop", position: 1, inMatrix: true },
        { songId: null, slug: "gamma-knife", title: "Gamma Knife", position: 2, inMatrix: false },
      ],
    },
    {
      albumUrl: "/albums/flying-microtonal-banana",
      title: "Flying Microtonal Banana",
      releaseDate: "2017-02-24",
      tracks: [
        { songId: 7, slug: "rattlesnake", title: "Rattlesnake", position: 1, inMatrix: true },
      ],
    },
  ],
  buckets: {
    covers: [
      { songId: 99, slug: "cover-song", title: "Cover Song", position: 1, inMatrix: false },
    ],
    miscellaneous: [
      { songId: 100, slug: "misc-song", title: "Misc Song", position: 1, inMatrix: false },
    ],
  },
};

describe("buildSongCoverSlugMap", () => {
  const map = buildSongCoverSlugMap(fixture);

  it("maps an album track's songId to its album cover slug (albumUrl last segment)", () => {
    expect(map.get(42)).toBe("nonagon-infinity");
    expect(map.get(7)).toBe("flying-microtonal-banana");
  });

  it("skips tracks whose songId is null (no null key in the map)", () => {
    expect([...map.keys()].every((k) => k !== null)).toBe(true);
    // 42 + 7 only; the null-songId gamma-knife track contributes no entry.
    expect(map.size).toBe(2);
  });

  it("does NOT map bucket songs (covers / miscellaneous carry no card album)", () => {
    expect(map.has(99)).toBe(false);
    expect(map.has(100)).toBe(false);
  });

  it("returns no entry for a songId absent from every album", () => {
    expect(map.has(12345)).toBe(false);
    expect(map.get(12345)).toBeUndefined();
  });
});
