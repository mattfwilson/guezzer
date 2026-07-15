import { describe, expect, it } from "vitest";
import type { ArchiveArtifact, ArchiveShow } from "../../src/dex/archive-types.ts";
import { buildRarityIndex, showRarityScore } from "../../src/dex/rarity.ts";
import { archiveShow, syntheticArchive } from "../fixtures/dex/synthetic.ts";

/**
 * Build an archive where each spec song appears in the FIRST `plays` shows of a
 * `totalShows`-long chronological run. That makes every derived quantity
 * hand-computable:
 *   - playCount   = plays
 *   - lastIndex   = plays - 1  → lastPlayedDate = date of show[plays-1]
 *   - corpusGap   = totalShows - plays
 */
function firstNArchive(
  specs: Array<{ songId: number; plays: number }>,
  totalShows: number,
  opts: { withSentinel?: boolean } = {},
): ArchiveArtifact {
  const shows: ArchiveShow[] = [];
  for (let i = 0; i < totalShows; i++) {
    const songs = specs.filter((s) => s.plays > i).map((s) => s.songId);
    if (opts.withSentinel && i === 0) songs.push(1); // sentinel id must be excluded
    shows.push(
      archiveShow({
        id: 1000 + i,
        date: `2020-01-${String(i + 1).padStart(2, "0")}`,
        sets: [{ n: "1", songs }],
      }),
    );
  }
  return syntheticArchive(shows);
}

describe("buildRarityIndex — corpus-honest tiers/gap/play-count (D-15, STAT-01)", () => {
  // 10 played songs over 20 shows, play counts strictly increasing so ranks are
  // unambiguous. Quantiles {legendary:0.05, rare:0.2, uncommon:0.5} over M=10:
  //   legendary  rank < 0.5  → rank 0        (1 song)
  //   rare       rank < 2.0  → rank 1        (1 song)
  //   uncommon   rank < 5.0  → ranks 2,3,4   (3 songs)
  //   common     rank >= 5   → ranks 5..9    (5 songs)
  const MAIN_SPECS = [
    { songId: 10, plays: 3 }, // rank 0 → legendary (playCount 3 ≥ min-plays)
    { songId: 20, plays: 5 }, // rank 1 → rare
    { songId: 30, plays: 7 }, // rank 2 → uncommon
    { songId: 40, plays: 9 }, // rank 3 → uncommon
    { songId: 50, plays: 11 }, // rank 4 → uncommon
    { songId: 60, plays: 13 }, // rank 5 → common
    { songId: 70, plays: 15 }, // rank 6 → common
    { songId: 80, plays: 17 }, // rank 7 → common
    { songId: 90, plays: 19 }, // rank 8 → common
    { songId: 100, plays: 20 }, // rank 9 → common
  ];

  it("pins the hand-computed tier table (every tier represented)", () => {
    const index = buildRarityIndex(firstNArchive(MAIN_SPECS, 20, { withSentinel: true }));
    const tierOf = (id: number) => index.get(id)?.tier;

    expect(tierOf(10)).toBe("legendary");
    expect(tierOf(20)).toBe("rare");
    expect(tierOf(30)).toBe("uncommon");
    expect(tierOf(40)).toBe("uncommon");
    expect(tierOf(50)).toBe("uncommon");
    expect(tierOf(60)).toBe("common");
    expect(tierOf(70)).toBe("common");
    expect(tierOf(80)).toBe("common");
    expect(tierOf(90)).toBe("common");
    expect(tierOf(100)).toBe("common");
  });

  it("computes playCount, lastPlayedDate, and corpusGap exactly", () => {
    const index = buildRarityIndex(firstNArchive(MAIN_SPECS, 20));

    const song10 = index.get(10);
    expect(song10?.playCount).toBe(3);
    expect(song10?.lastPlayedDate).toBe("2020-01-03"); // last of the first 3 shows
    expect(song10?.corpusGap).toBe(17); // 20 - 3 shows after its last play

    const song100 = index.get(100);
    expect(song100?.playCount).toBe(20);
    expect(song100?.lastPlayedDate).toBe("2020-01-20");
    expect(song100?.corpusGap).toBe(0); // played in the newest show
  });

  it("excludes sentinel song ids from the index entirely", () => {
    const index = buildRarityIndex(firstNArchive(MAIN_SPECS, 20, { withSentinel: true }));
    expect(index.has(1)).toBe(false);
  });

  it("caps a tiny-sample bottom-quantile song at rare (RARITY_MIN_PLAYS, Pitfall 12)", () => {
    // 3 songs / 8 shows. Rank 0 (song 1010, playCount 2) would be legendary by
    // quantile but is capped to rare because 2 < RARITY_MIN_PLAYS (3).
    const index = buildRarityIndex(
      firstNArchive(
        [
          { songId: 1010, plays: 2 },
          { songId: 1020, plays: 5 },
          { songId: 1030, plays: 8 },
        ],
        8,
      ),
    );
    expect(index.get(1010)?.playCount).toBe(2);
    expect(index.get(1010)?.tier).toBe("rare"); // capped, not legendary
    // A song last played in show 5 of 8 has corpusGap 3.
    expect(index.get(1020)?.corpusGap).toBe(3);
  });

  it("is deterministic (pure — no Date.now / I/O)", () => {
    const archive = firstNArchive(MAIN_SPECS, 20);
    expect(buildRarityIndex(archive)).toEqual(buildRarityIndex(archive));
  });
});

describe("showRarityScore — average corpus gap of a night (STAT-02)", () => {
  it("averages corpusGap across the given songs, ignoring unknown ids, to one decimal", () => {
    const index = buildRarityIndex(firstNArchive(
      [
        { songId: 10, plays: 3 }, // corpusGap 17
        { songId: 20, plays: 5 },
        { songId: 30, plays: 7 },
        { songId: 40, plays: 9 },
        { songId: 50, plays: 11 },
        { songId: 60, plays: 13 },
        { songId: 70, plays: 15 },
        { songId: 80, plays: 17 },
        { songId: 90, plays: 19 },
        { songId: 100, plays: 20 }, // corpusGap 0
      ],
      20,
    ));
    // (17 + 0) / 2 = 8.5; id 999 is absent from the index → ignored.
    expect(showRarityScore([10, 100, 999], index)).toBe(8.5);
  });

  it("returns 0 when no given id is in the index", () => {
    const index = buildRarityIndex(firstNArchive([{ songId: 10, plays: 3 }], 5));
    expect(showRarityScore([999, 888], index)).toBe(0);
  });
});
