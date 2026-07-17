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
  // Tie-inclusive playCount bands (config.dex.RARITY_BANDS), evaluated low→high
  // with `common` as the implicit tail:
  //   legendary  playCount === 1
  //   epic       playCount 2–3
  //   rare       playCount 4–8
  //   uncommon   playCount 9–23
  //   common     playCount 24+
  // One song per tier + every boundary, over totalShows = 24 (so 24-plays common
  // is reachable). firstNArchive gives corpusGap = totalShows - plays.
  const MAIN_SPECS = [
    { songId: 10, plays: 1 }, // legendary (exactly one play)
    { songId: 20, plays: 3 }, // epic (upper boundary 3)
    { songId: 30, plays: 4 }, // rare (lower boundary 4)
    { songId: 40, plays: 8 }, // rare (upper boundary 8)
    { songId: 50, plays: 9 }, // uncommon (lower boundary 9)
    { songId: 60, plays: 23 }, // uncommon (upper boundary 23)
    { songId: 70, plays: 24 }, // common (lower boundary 24)
  ];

  it("pins the hand-computed tier table (every tier represented)", () => {
    const index = buildRarityIndex(firstNArchive(MAIN_SPECS, 24, { withSentinel: true }));
    const tierOf = (id: number) => index.get(id)?.tier;

    expect(tierOf(10)).toBe("legendary");
    expect(tierOf(20)).toBe("epic");
    expect(tierOf(30)).toBe("rare");
    expect(tierOf(40)).toBe("rare");
    expect(tierOf(50)).toBe("uncommon");
    expect(tierOf(60)).toBe("uncommon");
    expect(tierOf(70)).toBe("common");
  });

  it("pins the band boundaries: 1→legendary, 3→epic vs 4→rare, 23→uncommon vs 24→common", () => {
    const index = buildRarityIndex(
      firstNArchive(
        [
          { songId: 201, plays: 1 }, // legendary
          { songId: 203, plays: 3 }, // epic (band closes at 3)
          { songId: 204, plays: 4 }, // rare (band opens at 4)
          { songId: 223, plays: 23 }, // uncommon (band closes at 23)
          { songId: 224, plays: 24 }, // common (band opens at 24)
        ],
        24,
      ),
    );
    const tierOf = (id: number) => index.get(id)?.tier;
    expect(tierOf(201)).toBe("legendary");
    expect(tierOf(203)).toBe("epic");
    expect(tierOf(204)).toBe("rare");
    expect(tierOf(223)).toBe("uncommon");
    expect(tierOf(224)).toBe("common");
  });

  it("is tie-inclusive: two different songIds with the same playCount share a tier", () => {
    // Two distinct songs, each played exactly once → BOTH legendary. Proves there
    // is no songId tie-break splitting equally-rare songs across tiers.
    const index = buildRarityIndex(
      firstNArchive(
        [
          { songId: 111, plays: 1 },
          { songId: 222, plays: 1 },
        ],
        24,
      ),
    );
    expect(index.get(111)?.tier).toBe("legendary");
    expect(index.get(222)?.tier).toBe("legendary");
  });

  it("makes a single-play song legendary (the retired min-plays cap no longer demotes it)", () => {
    // Formerly RARITY_MIN_PLAYS capped a tiny-sample song at rare; that cap is
    // gone by design — a played-once-ever song is the ultimate catch.
    const index = buildRarityIndex(
      firstNArchive(
        [
          { songId: 1010, plays: 1 },
          { songId: 1020, plays: 5 },
          { songId: 1030, plays: 8 },
        ],
        8,
      ),
    );
    expect(index.get(1010)?.playCount).toBe(1);
    expect(index.get(1010)?.tier).toBe("legendary"); // NOT capped to rare anymore
    // A song last played in show 5 of 8 has corpusGap 3.
    expect(index.get(1020)?.corpusGap).toBe(3);
  });

  it("computes playCount, lastPlayedDate, and corpusGap exactly", () => {
    const index = buildRarityIndex(firstNArchive(MAIN_SPECS, 24));

    const song20 = index.get(20);
    expect(song20?.playCount).toBe(3);
    expect(song20?.lastPlayedDate).toBe("2020-01-03"); // last of the first 3 shows
    expect(song20?.corpusGap).toBe(21); // 24 - 3 shows after its last play

    const song70 = index.get(70);
    expect(song70?.playCount).toBe(24);
    expect(song70?.lastPlayedDate).toBe("2020-01-24");
    expect(song70?.corpusGap).toBe(0); // played in the newest show
  });

  it("excludes sentinel song ids from the index entirely", () => {
    const index = buildRarityIndex(firstNArchive(MAIN_SPECS, 24, { withSentinel: true }));
    expect(index.has(1)).toBe(false);
  });

  it("is deterministic (pure — no Date.now / I/O)", () => {
    const archive = firstNArchive(MAIN_SPECS, 24);
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
