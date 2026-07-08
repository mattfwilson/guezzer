import { describe, expect, it } from "vitest";
import rr1010 from "../../../data/samples/rr1010.json" with { type: "json" };
import showyear2013 from "../../../data/samples/showyear2013.json" with { type: "json" };
import { runCensus } from "../src/ingest/census.ts";

function samplesMap(): Map<string, unknown[]> {
  return new Map([
    ["rr1010.json", rr1010.data],
    ["showyear2013.json", showyear2013.data],
  ]);
}

describe("runCensus — full-corpus evidence over the two committed samples", () => {
  const census = runCensus(samplesMap());

  it("Test 1: settype distinct values are exactly Set/One Set/Live Session, Live Session showCount 2 with PBS-show example IDs", () => {
    const settypeValues = census.fields.settype;
    expect(settypeValues.map((v) => v.value).sort()).toEqual(["Live Session", "One Set", "Set"]);

    const liveSession = settypeValues.find((v) => v.value === "Live Session");
    expect(liveSession).toBeDefined();
    expect(liveSession!.showCount).toBe(2);
    const exampleShowIds = liveSession!.exampleShows.map((s) => s.showId);
    expect(exampleShowIds).toEqual(expect.arrayContaining([1678641097, 1678642793]));
  });

  it("Test 2: transition_id distinct values include 4 (rowCount 1, from rr1010); every value carries rowCount + up to 3 exampleShows with showId + showdate", () => {
    const transitionIdValues = census.fields.transition_id;
    const tid4 = transitionIdValues.find((v) => v.value === 4);
    expect(tid4).toBeDefined();
    expect(tid4!.rowCount).toBe(1);
    expect(tid4!.exampleShows.length).toBeGreaterThan(0);
    expect(tid4!.exampleShows[0]).toEqual({ showId: 1678309429, showdate: "2022-10-10" });

    for (const value of transitionIdValues) {
      expect(typeof value.rowCount).toBe("number");
      expect(value.exampleShows.length).toBeLessThanOrEqual(3);
      for (const example of value.exampleShows) {
        expect(typeof example.showId).toBe("number");
        expect(typeof example.showdate).toBe("string");
      }
    }
  });

  it("Test 3: derived lastRowTransitionByYear for 2013 reports 14 shows ending with transition_id 1 (terminal unreliability evidence)", () => {
    expect(census.derived.lastRowTransitionByYear[2013][1]).toBe(14);
    expect(census.derived.lastRowTransitionByYear[2013][5]).toBe(9);
    expect(census.derived.lastRowTransitionByYear[2013][6]).toBe(3);
  });

  it("Test 4: derived segueFrequencyByYear is 4/149 for 2013 and 10/27 for 2022 (rr1010 only)", () => {
    // NOTE: RESEARCH.md's approximate "9 in 27" for the 2022 sample undercounts by
    // one — direct verification against the committed rr1010.json (transition_id
    // 2 or 3) finds 10 segue rows (positions 1,4,5,7,9,15,16,21,22,23). The census
    // is the source of truth over the real data, not the research approximation.
    expect(census.derived.segueFrequencyByYear[2013].segueRows).toBe(4);
    expect(census.derived.segueFrequencyByYear[2013].totalRows).toBe(149);
    expect(census.derived.segueFrequencyByYear[2022].segueRows).toBe(10);
    expect(census.derived.segueFrequencyByYear[2022].totalRows).toBe(27);
  });

  it("Test 5: sideProjectRows are 0 in the samples (all rows are artist_id 1) and contiguityViolations is empty", () => {
    const totalSideProjectRows = Object.values(census.derived.sideProjectRowsByYear).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(totalSideProjectRows).toBe(0);
    expect(census.derived.contiguityViolations).toEqual([]);
  });

  it("additionally: zero footnote parse failures and at least one tease candidate in the samples", () => {
    expect(census.derived.footnoteParseFailures).toEqual([]);
    expect(census.derived.teaseCandidates.length).toBeGreaterThan(0);
  });

  it("additionally: distinct KGLW song count, shows per year, and covers count are populated", () => {
    expect(census.derived.distinctKglwSongCount).toBeGreaterThan(0);
    expect(census.derived.showsPerYear[2013]).toBe(26);
    expect(census.derived.showsPerYear[2022]).toBe(1);
    expect(census.derived.coversCount).toBeGreaterThan(0);
  });
});
