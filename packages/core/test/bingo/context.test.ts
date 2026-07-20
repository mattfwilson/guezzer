import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { buildBingoContext } from "../../src/bingo/context.ts";
import {
  ALBUM_URL,
  SONG_ALBUM,
  SONG_BUSTOUT,
  SONG_MICROTONAL,
  SONG_PLAIN,
} from "../fixtures/bingo/synthetic.ts";

/**
 * `buildBingoContext` resolves the four already-shipped artifacts (matrix,
 * archive, rarity index, dex-albums) into fast lookup Maps with ZERO new
 * pipeline (D-25 / RESEARCH Pattern 4). The inputs here are minimal structural
 * subsets — the builder only reads `matrix.nodes`, the RarityIndex `corpusGap`,
 * and `albums[].tracks[].songId`, plus `cfg.bingo.jamVehicleSongIds`.
 */

// Local ids used only inside this test.
const SONG_JAMISH = 60; // a plain (non-microtonal) node id
const SONG_MICRO_2 = 25; // a second microtonal node id

// Minimal structural inputs (declared inline — the builder never imports the
// nominal artifact types either, D-22 core purity).
const matrix = {
  // Deliberately UNsorted by songId so a sorted emit is observable.
  nodes: [
    { songId: SONG_JAMISH, eraPlayCount: 3, tuningFamily: "cs-standard" },
    { songId: SONG_MICROTONAL, eraPlayCount: 2, tuningFamily: "microtonal" },
    { songId: SONG_ALBUM, eraPlayCount: 4, tuningFamily: "standard" },
    { songId: SONG_PLAIN, eraPlayCount: 8, tuningFamily: "standard" },
  ],
};

const rarity = new Map<number, { corpusGap: number }>(
  (
    [
      [SONG_PLAIN, 0],
      [SONG_MICROTONAL, 3],
      [SONG_ALBUM, 5],
      [SONG_BUSTOUT, 80],
    ] as Array<[number, number]>
  ).map(([songId, corpusGap]) => [songId, { corpusGap }]),
);

const albums = {
  albums: [
    {
      albumUrl: ALBUM_URL,
      tracks: [
        { songId: SONG_ALBUM },
        { songId: null }, // debut candidate — no matrix node, must be skipped
      ],
    },
  ],
};

// Unused by the five lookups, present for shipped-artifact-quartet parity.
const archive = { shows: [] as unknown[] };

describe("buildBingoContext — resolve shipped artifacts into lookup Maps (D-25)", () => {
  it("maps every microtonal matrix node into microtonalSongIds", () => {
    const withTwoMicro = {
      nodes: [
        ...matrix.nodes,
        { songId: SONG_MICRO_2, eraPlayCount: 1, tuningFamily: "microtonal" },
      ],
    };
    const ctx = buildBingoContext(withTwoMicro, archive, rarity, albums);
    expect(ctx.microtonalSongIds.has(SONG_MICROTONAL)).toBe(true);
    expect(ctx.microtonalSongIds.has(SONG_MICRO_2)).toBe(true);
    // Non-microtonal nodes never leak in.
    expect(ctx.microtonalSongIds.has(SONG_PLAIN)).toBe(false);
    expect(ctx.microtonalSongIds.has(SONG_ALBUM)).toBe(false);
    expect(ctx.microtonalSongIds.size).toBe(2);
  });

  it("mirrors SongRarity.corpusGap per songId and maps album_url → track songId Set", () => {
    const ctx = buildBingoContext(matrix, archive, rarity, albums);
    expect(ctx.corpusGap.get(SONG_PLAIN)).toBe(0);
    expect(ctx.corpusGap.get(SONG_ALBUM)).toBe(5);
    expect(ctx.corpusGap.get(SONG_BUSTOUT)).toBe(80);

    const albumMembers = ctx.albumSongIds.get(ALBUM_URL);
    expect(albumMembers).toBeDefined();
    expect([...(albumMembers ?? [])]).toEqual([SONG_ALBUM]); // null track dropped
  });

  it("builds jamVehicleSongIds from cfg (locked roster flows through; overridable)", () => {
    // Default config now ships the Plan-06 D-20 locked roster (9 jam vehicles);
    // buildBingoContext copies it straight into the lookup Set.
    const locked = buildBingoContext(matrix, archive, rarity, albums);
    expect(locked.jamVehicleSongIds.size).toBe(config.bingo.jamVehicleSongIds.length);
    for (const songId of config.bingo.jamVehicleSongIds) {
      expect(locked.jamVehicleSongIds.has(songId)).toBe(true);
    }

    // An explicit roster override flows straight through (e.g. an empty roster
    // must not crash — degrades to zero jam-vehicle squares).
    const empty = {
      ...config,
      bingo: { ...config.bingo, jamVehicleSongIds: [] as number[] },
    } as unknown as typeof config;
    expect(buildBingoContext(matrix, archive, rarity, albums, empty).jamVehicleSongIds.size).toBe(0);

    // A populated override roster flows straight through.
    const cfgWithRoster = {
      ...config,
      bingo: { ...config.bingo, jamVehicleSongIds: [SONG_JAMISH, SONG_MICROTONAL] },
    } as unknown as typeof config;
    const withRoster = buildBingoContext(matrix, archive, rarity, albums, cfgWithRoster);
    expect(withRoster.jamVehicleSongIds.has(SONG_JAMISH)).toBe(true);
    expect(withRoster.jamVehicleSongIds.has(SONG_MICROTONAL)).toBe(true);
    expect(withRoster.jamVehicleSongIds.size).toBe(2);
  });

  it("carries eraPlayCount into eraPlayRate keyed by songId, emitted sorted by songId (T-14-03)", () => {
    const ctx = buildBingoContext(matrix, archive, rarity, albums);
    expect(ctx.eraPlayRate.get(SONG_PLAIN)).toBe(8);
    expect(ctx.eraPlayRate.get(SONG_MICROTONAL)).toBe(2);
    expect(ctx.eraPlayRate.get(SONG_JAMISH)).toBe(3);

    // Stable-key sorted emit despite unsorted input nodes (Pitfall 4).
    expect([...ctx.eraPlayRate.keys()]).toEqual(
      [SONG_PLAIN, SONG_MICROTONAL, SONG_ALBUM, SONG_JAMISH].sort((a, b) => a - b),
    );
    // corpusGap emit is likewise ascending.
    const gapKeys = [...ctx.corpusGap.keys()];
    expect(gapKeys).toEqual([...gapKeys].sort((a, b) => a - b));
  });
});
