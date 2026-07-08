import { describe, expect, it } from "vitest";
import rr1010 from "../../../data/samples/rr1010.json" with { type: "json" };
import showyear2013 from "../../../data/samples/showyear2013.json" with { type: "json" };
import { normalizeCorpus, parseFootnotesGuarded } from "../src/ingest/normalize.ts";

/** A minimal, valid base row (real rr1010.json data[0] shape) for building synthetic edge-case rows. */
const baseRow = { ...rr1010.data[0] };

function makeRow(overrides: Record<string, unknown>): unknown {
  return { ...baseRow, ...overrides };
}

describe("normalizeCorpus — rr1010 (Red Rocks 2022-10-10, marathon, multi-set)", () => {
  const { corpus } = normalizeCorpus(rr1010.data);

  it("Test 1: yields 1 show with sets [1, 2] in order, 27 performances total, positions ascending within sets, set 1 ending at position 13", () => {
    expect(corpus.shows.length).toBe(1);
    const show = corpus.shows[0];
    expect(show.showId).toBe(1678309429);
    expect(show.sets.map((s) => s.setNumber)).toEqual(["1", "2"]);

    const totalPerformances = show.sets.reduce((sum, s) => sum + s.performances.length, 0);
    expect(totalPerformances).toBe(27);

    for (const set of show.sets) {
      const positions = set.performances.map((p) => p.position);
      const sorted = [...positions].sort((a, b) => a - b);
      expect(positions).toEqual(sorted);
    }

    const set1 = show.sets[0];
    expect(set1.performances.at(-1)?.position).toBe(13);
  });

  it("Test 3: transition_id maps to TransitionKind correctly, and structure never derives from transition_id", () => {
    const show = corpus.shows[0];
    const set1 = show.sets[0];

    // position 1: "Mars For the Rich", transition_id 2 -> "segue"
    const pos1 = set1.performances.find((p) => p.position === 1);
    expect(pos1?.songName).toBe("Mars For the Rich");
    expect(pos1?.transitionId).toBe(2);
    expect(pos1?.transitionKind).toBe("segue");

    // position 13: "Magma", transition_id 4 (last of set 1) -> "terminal"
    const pos13 = set1.performances.find((p) => p.position === 13);
    expect(pos13?.songName).toBe("Magma");
    expect(pos13?.transitionId).toBe(4);
    expect(pos13?.transitionKind).toBe("terminal");

    // set split at 13/14 must come from setnumber alone, not transition_id
    expect(set1.performances.some((p) => p.position === 14)).toBe(false);
    expect(show.sets[1].performances[0].position).toBe(14);
  });
});

describe("normalizeCorpus — showyear2013 (full year 2013, 26 distinct shows)", () => {
  const { corpus, stats } = normalizeCorpus(showyear2013.data);

  it("Test 2: yields 24 shows — the 2 Live Session (PBS Studios) shows are excluded, counted in stats", () => {
    expect(corpus.showCount).toBe(24);
    expect(corpus.shows.length).toBe(24);
    expect(stats.showsExcludedBySettype.length).toBe(2);
    for (const excluded of stats.showsExcludedBySettype) {
      expect(excluded.settype).toBe("Live Session");
    }
  });

  it("Test 4: the Unknown sentinel row becomes a Performance with isPlaceholder true, still occupying its position, and excluded from the distinct-song count", () => {
    // show_id 1678640961, 2013-01-24, position 1 is the Unknown sentinel (song_id 1, slug _custom_)
    const show = corpus.shows.find((s) => s.showId === 1678640961);
    expect(show).toBeDefined();
    const sentinelPerformance = show!.sets
      .flatMap((s) => s.performances)
      .find((p) => p.position === 1);
    expect(sentinelPerformance?.songId).toBe(1);
    expect(sentinelPerformance?.slug).toBe("_custom_");
    expect(sentinelPerformance?.isPlaceholder).toBe(true);

    // sentinel songId must never appear in the corpus-wide distinct song count derivation:
    // verify by reconstructing the distinct non-placeholder song id set across all included shows
    const distinctSongIds = new Set<number>();
    for (const s of corpus.shows) {
      for (const set of s.sets) {
        for (const p of set.performances) {
          if (!p.isPlaceholder) distinctSongIds.add(p.songId);
        }
      }
    }
    expect(distinctSongIds.has(1)).toBe(false);
    expect(corpus.songCount).toBe(distinctSongIds.size);
  });

  it("Test 5: a 2013 cover row (isoriginal: 0, original_artist populated) gets isCover true and originalArtist populated", () => {
    const allPerformances = corpus.shows.flatMap((s) => s.sets.flatMap((set) => set.performances));
    const coverPerformance = allPerformances.find((p) => p.songName === "I Gotta Rock 'n' Roll");
    expect(coverPerformance).toBeDefined();
    expect(coverPerformance?.isCover).toBe(true);
    expect(coverPerformance?.originalArtist).toBe("The Reatards");
  });

  it("Test 6: footnotes JSON parses to string[]; malformed footnotes is kept verbatim and never throws", () => {
    const allRawPerformances = corpus.shows.flatMap((s) =>
      s.sets.flatMap((set) => set.performances),
    );
    const withFootnote = allRawPerformances.find(
      (p) => p.footnote === "first confirmed performance",
    );
    expect(withFootnote?.footnotesParsed).toEqual(["first confirmed performance"]);
    expect(withFootnote?.footnotesRaw).toBeNull();

    // malformed footnotes string, tested directly against the guarded parser (Pitfall 5)
    const malformed = parseFootnotesGuarded('["broken');
    expect(malformed.footnotesParsed).toBeNull();
    expect(malformed.footnotesRaw).toBe('["broken');

    expect(() => parseFootnotesGuarded('["broken')).not.toThrow();

    // null footnotes -> both fields null
    const nullCase = parseFootnotesGuarded(null);
    expect(nullCase.footnotesParsed).toBeNull();
    expect(nullCase.footnotesRaw).toBeNull();
  });
});

describe("normalizeCorpus — synthetic edge cases", () => {
  it("Test 7: a position gap (1, 2, 4) throws an Error naming the show_id and showdate", () => {
    const rows = [
      makeRow({ show_id: 999001, showdate: "2020-01-01", position: 1, setnumber: "1" }),
      makeRow({ show_id: 999001, showdate: "2020-01-01", position: 2, setnumber: "1" }),
      makeRow({ show_id: 999001, showdate: "2020-01-01", position: 4, setnumber: "1" }),
    ];

    let thrown: Error | undefined;
    try {
      normalizeCorpus(rows);
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown!.message).toContain("999001");
    expect(thrown!.message).toContain("2020-01-01");
  });

  it("Test 8: rows with artist_id !== 1 are excluded and counted in returned stats", () => {
    const rows = [
      makeRow({ show_id: 999002, showdate: "2020-02-02", position: 1, artist_id: 1 }),
      makeRow({ show_id: 999003, showdate: "2020-02-03", position: 1, artist_id: 4 }), // Stu Mackenzie solo
    ];

    const { corpus, stats } = normalizeCorpus(rows);
    expect(corpus.shows.some((s) => s.showId === 999003)).toBe(false);
    expect(corpus.shows.some((s) => s.showId === 999002)).toBe(true);
    expect(stats.nonKglwRowsExcluded).toBe(1);
  });
});
