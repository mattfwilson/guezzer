import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { normalizeCorpus } from "../../src/ingest/normalize.ts";
import { buildMatrix } from "../../src/model/matrix.ts";
import { findHoldoutShows } from "../../src/eval/holdout.ts";

// Fixture-normalize convention (normalize.test.ts:1-16 / predict.test.ts:1-30):
// raw kglw.net-shaped rows normalize through normalizeCorpus first. See
// synthetic-multitour.meta.json for the full fixture design + hand-computed
// expected values (holdout tour, evalTransitionCount, hard-segue/free-choice
// split, top-k hit rates).
import syntheticMultitour from "../fixtures/synthetic-multitour.json" with { type: "json" };

const { corpus } = normalizeCorpus(syntheticMultitour);

describe("findHoldoutShows — holdout identification (D-12)", () => {
  it("Test 1: returns exactly the shows of the chronologically-latest tour, NOT the max-tourId tour", () => {
    // Sanity-check the fixture's premise: tourId 999 (the legacy tour) is
    // numerically the MAX tourId in the corpus, but it is chronologically
    // the EARLIEST tour (2024-05-18..20). tourId 7 (the holdout tour) is
    // chronologically LATEST (2024-06-01..03) despite its lower id -- a
    // max(tourId) bug would incorrectly pick tourId 999.
    const tourIds = new Set(corpus.shows.map((s) => s.tourId));
    expect(tourIds).toEqual(new Set([999, 7]));
    expect(Math.max(...tourIds)).toBe(999);

    const holdout = findHoldoutShows(corpus);

    expect(holdout.length).toBe(3);
    for (const show of holdout) {
      expect(show.tourId).toBe(7);
    }
    expect(holdout.map((s) => s.date).sort()).toEqual(["2024-06-01", "2024-06-02", "2024-06-03"]);

    // The rejected max-tourId tour must be entirely absent from the result.
    expect(holdout.some((s) => s.tourId === 999)).toBe(false);
  });
});

describe("findHoldoutShows — sentinel guard (T-02-09)", () => {
  it("Test 2: throws a loud error when the latest show's tourId is the tourIdSentinel (a one-off, no complete-tour holdout)", () => {
    // A single one-off show (tourId === config.tourIdSentinel) with no
    // other tour in the corpus -- there is no complete tour to hold out.
    const oneOffRows = [
      {
        uniqueid: "1",
        show_id: 1,
        showdate: "2024-01-01",
        showtime: null,
        showtitle: "",
        artist: "King Gizzard & the Lizard Wizard",
        song_id: 801,
        songname: "Synth P",
        artist_id: 1,
        permalink: "one-off.html",
        settype: "Set",
        setnumber: "1",
        position: 1,
        tracktime: null,
        transition_id: 1,
        transition: ", ",
        footnote: "",
        footnotes: null,
        isjamchart: 0,
        jamchart_notes: null,
        venue_id: 1,
        shownotes: "",
        showyear: 2024,
        showorder: 1,
        opener: "",
        tour_id: config.tourIdSentinel,
        tourname: "Not Part of a Tour",
        soundcheck: "",
        isverified: 1,
        slug: "synth-p",
        isoriginal: 1,
        original_artist: "",
        venuename: "Synthetic Venue",
        city: "Synthetic City",
        state: null,
        country: "Synthetica",
        timezone: null,
        isreprise: 0,
        isjam: 0,
        css_class: "",
        isrecommended: 0,
      },
    ];
    const { corpus: oneOffCorpus } = normalizeCorpus(oneOffRows);

    expect(() => findHoldoutShows(oneOffCorpus)).toThrow(/tourIdSentinel|Not Part of a Tour|one-off/i);
  });
});
