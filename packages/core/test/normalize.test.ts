import { describe, expect, it } from "vitest";
import rr1010 from "../../../data/samples/rr1010.json" with { type: "json" };
import showyear2013 from "../../../data/samples/showyear2013.json" with { type: "json" };
import { normalizeCorpus, parseFootnotesGuarded } from "../src/ingest/normalize.ts";

// Era-spanning real-show fixtures (phase success criterion 5) — see
// packages/core/test/fixtures/*.meta.json for source file, show_id, and why
// each was chosen.
import fixture2012LooseTerminal from "./fixtures/2012-loose-terminal.json" with { type: "json" };
import fixture2013LiveSession from "./fixtures/2013-live-session.json" with { type: "json" };
import fixture2013Encore from "./fixtures/2013-encore.json" with { type: "json" };
import fixture2013UnknownSentinel from "./fixtures/2013-unknown-sentinel.json" with { type: "json" };
import fixture2022Rr1010Multiset from "./fixtures/2022-rr1010-multiset.json" with { type: "json" };
import fixture2017Segues from "./fixtures/2017-segues.json" with { type: "json" };
import fixture2025Sandwich from "./fixtures/2025-sandwich.json" with { type: "json" };
import fixture2025SegueChain from "./fixtures/2025-segue-chain.json" with { type: "json" };

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

  it("Test 9 (D-01): shownotes is carried from the POSITION-1 row even when raw input rows are out of position order", () => {
    // Rows deliberately in NON-position order (position 2 first) with
    // differing shownotes — the carry must read the position-sorted first
    // row, not raw input order (D-01: position-1 wins).
    const rows = [
      makeRow({ show_id: 999010, showdate: "2020-03-01", position: 2, setnumber: "1", shownotes: "pos-2 notes" }),
      makeRow({ show_id: 999010, showdate: "2020-03-01", position: 1, setnumber: "1", shownotes: "pos-1 notes" }),
    ];

    const { corpus } = normalizeCorpus(rows);
    expect(corpus.shows.length).toBe(1);
    expect(corpus.shows[0].shownotes).toBe("pos-1 notes");
  });

  it("Test 10 (D-01): within-show shownotes disagreement is recorded in stats, never throws, and position-1 still wins", () => {
    const rows = [
      makeRow({ show_id: 999011, showdate: "2020-03-02", position: 1, setnumber: "1", shownotes: "A" }),
      makeRow({ show_id: 999011, showdate: "2020-03-02", position: 2, setnumber: "1", shownotes: "B" }),
    ];

    let result: ReturnType<typeof normalizeCorpus> | undefined;
    expect(() => {
      result = normalizeCorpus(rows);
    }).not.toThrow();

    expect(result!.corpus.shows[0].shownotes).toBe("A");
    const entry = result!.stats.showsWithShownotesDisagreement.find((e) => e.showId === 999011);
    expect(entry).toBeDefined();
    expect(entry!.showDate).toBe("2020-03-02");
  });

  it("Test 11 (D-01): a show whose rows all share one shownotes value is NOT recorded as a disagreement", () => {
    const rows = [
      makeRow({ show_id: 999012, showdate: "2020-03-03", position: 1, setnumber: "1", shownotes: "same" }),
      makeRow({ show_id: 999012, showdate: "2020-03-03", position: 2, setnumber: "1", shownotes: "same" }),
    ];

    const { stats } = normalizeCorpus(rows);
    expect(stats.showsWithShownotesDisagreement.some((e) => e.showId === 999012)).toBe(false);
  });

  it("Test 12 (D-02): an empty shownotes string is carried verbatim as \"\", never coerced to null/undefined", () => {
    const rows = [
      makeRow({ show_id: 999013, showdate: "2020-03-04", position: 1, setnumber: "1", shownotes: "" }),
    ];

    const { corpus } = normalizeCorpus(rows);
    expect(corpus.shows[0].shownotes).toBe("");
  });
});

describe("normalizeCorpus — era-spanning fixtures (phase success criterion 5)", () => {
  it("Fixture A (2012-loose-terminal): a real 2012 show whose final row has transition_id 1 normalizes with no phantom breaks or truncation", () => {
    const { corpus } = normalizeCorpus(fixture2012LooseTerminal);
    expect(corpus.shows.length).toBe(1);
    const show = corpus.shows[0];
    expect(show.sets.length).toBe(1);
    expect(show.sets[0].setNumber).toBe("1");
    expect(show.sets[0].performances.length).toBe(12);
    const last = show.sets[0].performances.at(-1)!;
    expect(last.position).toBe(12);
    expect(last.transitionId).toBe(1);
    expect(last.transitionKind).toBe("none");
  });

  it("Fixture B (2013-live-session): the PBS Studios show is excluded by the allowlist with stats recording it (D-16)", () => {
    const { corpus, stats } = normalizeCorpus(fixture2013LiveSession);
    expect(corpus.shows.length).toBe(0);
    expect(stats.showsExcludedBySettype.length).toBe(1);
    expect(stats.showsExcludedBySettype[0].settype).toBe("Live Session");
    expect(stats.showsExcludedBySettype[0].showId).toBe(1678641097);
  });

  it("Fixture C (2013-encore): a show with setnumber \"e\" yields a final SetSection with setNumber \"e\" after the numbered sets", () => {
    const { corpus } = normalizeCorpus(fixture2013Encore);
    expect(corpus.shows.length).toBe(1);
    const show = corpus.shows[0];
    expect(show.sets.map((s) => s.setNumber)).toEqual(["1", "e"]);
    expect(show.sets[0].performances.length).toBe(8);
    const encoreSet = show.sets.at(-1)!;
    expect(encoreSet.setNumber).toBe("e");
    expect(encoreSet.performances.map((p) => p.position)).toEqual([9, 10]);
  });

  it("Fixture D (2013-unknown-sentinel): song_id 1 row -> isPlaceholder true, excluded from songCount", () => {
    const { corpus } = normalizeCorpus(fixture2013UnknownSentinel);
    expect(corpus.shows.length).toBe(1);
    const firstPerformance = corpus.shows[0].sets[0].performances[0];
    expect(firstPerformance.songId).toBe(1);
    expect(firstPerformance.slug).toBe("_custom_");
    expect(firstPerformance.isPlaceholder).toBe(true);

    const distinctSongIds = new Set<number>();
    for (const set of corpus.shows[0].sets) {
      for (const p of set.performances) {
        if (!p.isPlaceholder) distinctSongIds.add(p.songId);
      }
    }
    expect(distinctSongIds.has(1)).toBe(false);
    expect(corpus.songCount).toBe(distinctSongIds.size);
  });

  it("Fixture E (2022-rr1010-multiset): 2 sets split exactly at position 13/14; transition_id 4 on the set-1 closer maps to \"terminal\" and is NOT used for the split", () => {
    const { corpus } = normalizeCorpus(fixture2022Rr1010Multiset);
    expect(corpus.shows.length).toBe(1);
    const show = corpus.shows[0];
    expect(show.sets.map((s) => s.setNumber)).toEqual(["1", "2"]);
    expect(show.sets[0].performances.length).toBe(13);
    expect(show.sets[1].performances.length).toBe(14);

    const closer = show.sets[0].performances.at(-1)!;
    expect(closer.position).toBe(13);
    expect(closer.transitionId).toBe(4);
    expect(closer.transitionKind).toBe("terminal");
    expect(show.sets[1].performances[0].position).toBe(14);
  });

  it("Fixture E (2022-rr1010-multiset) (D-02): shownotes is carried byte-for-byte from the position-1 raw row onto NormalizedShow", () => {
    const { corpus } = normalizeCorpus(fixture2022Rr1010Multiset);
    // Assert against the fixture's OWN position-1 raw value (raw -> domain
    // exact equality), never a re-typed literal — proves zero transformation
    // (no trim, no HTML strip, \r\n preserved) end to end.
    const pos1RawRow = (fixture2022Rr1010Multiset as Array<Record<string, unknown>>).find(
      (row) => row.position === 1,
    );
    expect(pos1RawRow).toBeDefined();
    expect(corpus.shows[0].shownotes).toBe(pos1RawRow!.shownotes);
  });

  it("Fixture F (2017-segues): a mid-era (2017) show with >= 2 segues normalizes clean", () => {
    const { corpus } = normalizeCorpus(fixture2017Segues);
    expect(corpus.shows.length).toBe(1);
    const performances = corpus.shows[0].sets[0].performances;
    expect(performances.length).toBe(8);
    const segueCount = performances.filter((p) => p.transitionKind === "segue").length;
    expect(segueCount).toBeGreaterThanOrEqual(2);
    expect(performances.find((p) => p.position === 1)?.transitionKind).toBe("segue");
    expect(performances.find((p) => p.position === 3)?.transitionKind).toBe("segue");
  });

  it("Fixture G (2025-sandwich): the real 2025-12-13 Motor Spirit > Gila Monster > Motor Spirit sequence yields TWO distinct Performance entries for the sandwiched song, no reprise linking (D-14)", () => {
    const { corpus } = normalizeCorpus(fixture2025Sandwich);
    expect(corpus.shows.length).toBe(1);
    const performances = corpus.shows[0].sets[0].performances;

    const motorSpiritOccurrences = performances.filter((p) => p.songId === 324);
    expect(motorSpiritOccurrences.length).toBe(2);
    expect(motorSpiritOccurrences.map((p) => p.position)).toEqual([19, 21]);

    const gilaMonster = performances.find((p) => p.position === 20);
    expect(gilaMonster?.songId).toBe(251);

    // No reprise-linkage fields anywhere on Performance — every occurrence
    // is an ordinary positional entry (D-14: isreprise is never read).
    for (const p of motorSpiritOccurrences) {
      expect(Object.keys(p)).not.toContain("repriseOf");
      expect(Object.keys(p)).not.toContain("isReprise");
    }

    // Duplicate songId detectable within the show (what MODL-10 needs).
    const songIdCounts = new Map<number, number>();
    for (const p of performances) {
      songIdCounts.set(p.songId, (songIdCounts.get(p.songId) ?? 0) + 1);
    }
    expect(songIdCounts.get(324)).toBe(2);
  });

  it("Fixture H (2025-segue-chain): consecutive transition_id 2/3 rows all map to transitionKind \"segue\" in position order", () => {
    const { corpus } = normalizeCorpus(fixture2025SegueChain);
    expect(corpus.shows.length).toBe(1);
    const performances = corpus.shows[0].sets[0].performances;

    const chain = performances.filter((p) => p.position >= 11 && p.position <= 13);
    expect(chain.map((p) => p.position)).toEqual([11, 12, 13]);
    for (const p of chain) {
      expect(p.transitionKind).toBe("segue");
    }
  });
});
