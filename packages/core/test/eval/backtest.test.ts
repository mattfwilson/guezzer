import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { normalizeCorpus } from "../../src/ingest/normalize.ts";
import { buildMatrix } from "../../src/model/matrix.ts";
import { findHoldoutShows } from "../../src/eval/holdout.ts";
import { runBacktest } from "../../src/eval/backtest.ts";

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

// --- Plan 02-04 Task 2: runBacktest walk-forward metrics ---
//
// Every eval transition in synthetic-multitour is designed to be a
// dominant/pinned top-1 winner: the legacy tour (tourId 999) gives every
// chain song an EXCLUSIVE single training successor (t1 = 1.0, the
// dominant 0.6-weighted backoff tier), and Y->Z additionally clears the
// D-04 hard-segue gate (3/3 segue rate, >= minSupport 3) and is forced to
// the near-1.0 pin ceiling regardless of the ordinary pipeline. See
// synthetic-multitour.meta.json for the full margin argument. These
// figures are cross-checked against the actual deterministic
// implementation (not asserted blindly) -- verified via `npx vitest run`.

describe("runBacktest — backtest metrics (EVAL-01, D-13)", () => {
  it("Test 3: overall.top1/top5/top10 match the hand-computed hit rates, and evalTransitionCount matches the number of eligible within-set transitions in the holdout", () => {
    const result = runBacktest(corpus);

    expect(result.schemaVersion).toBe(1);
    expect(result.generatedAt).toBe(corpus.generatedAt);
    expect(result.holdoutTourId).toBe(7);
    expect(result.holdoutTourName).toBe("Synthetic Holdout Tour");
    expect(result.holdoutShowCount).toBe(3);

    // 5 eligible eval transitions: H1 (P->Q, Q->R), H2 (W->X; T->placeholder
    // excluded), H3 (Y->Z hard segue, Z->AA). The single-song set (U alone,
    // H1 Set2) contributes 0 pairs structurally.
    expect(result.evalTransitionCount).toBe(5);

    expect(result.overall).toEqual({ n: 5, top1: 5, top5: 5, top10: 5 });
  });
});

describe("runBacktest — hard-segue / free-choice split (D-13)", () => {
  it("Test 4: eval transitions are partitioned by whether the ACTUAL transition was notated (A.transitionKind === 'segue'); hardSegue.n + freeChoice.n === overall.n, each split has its own top-k", () => {
    const result = runBacktest(corpus);

    // Only Y->Z (H3) has A.transitionKind === "segue" -- the other 4
    // (P->Q, Q->R, W->X, Z->AA) are free-choice.
    expect(result.hardSegue).toEqual({ n: 1, top1: 1, top5: 1, top10: 1 });
    expect(result.freeChoice).toEqual({ n: 4, top1: 4, top5: 4, top10: 4 });
    expect(result.hardSegue.n + result.freeChoice.n).toBe(result.overall.n);
  });
});

describe("runBacktest — eval-target exclusions (M7)", () => {
  it("Test 5: transitions where B.isPlaceholder, set-openers, and single-song sets contribute 0 eval transitions", () => {
    const result = runBacktest(corpus);

    // Raw adjacent-pair count across the holdout tour BEFORE the
    // placeholder exclusion: H1 Set1 [P,Q,R] -> 2 pairs, H1 Set2 [U] -> 0
    // pairs (single-song set, already excluded structurally), H2 Set1
    // [T,Unknown] -> 1 pair (T->placeholder), H2 Set2 [W,X] -> 1 pair, H3
    // Set1 [Y,Z,AA] -> 2 pairs. Raw total = 2+0+1+1+2 = 6. The T->placeholder
    // pair must be excluded (B is the sentinel), leaving 5 -- proving the
    // exclusion actually fires rather than the fixture simply lacking one.
    expect(result.evalTransitionCount).toBe(5);

    // Set-openers (P in H1 Set1, T in H2 Set1, Y in H3 Set1) are never
    // themselves an eval TARGET -- structurally impossible since only
    // adjacent pairs are walked. Single-song set U (H1 Set2) contributes 0
    // pairs. Both already folded into the n=5 total above; this test
    // documents the exclusion categories explicitly required by the plan.
    expect(result.overall.n).toBe(5);
  });
});

// --- Plan 02-05 Task 1: leave-one-signal-out ablation (EVAL-02, D-14) ---
//
// The synthetic-multitour fixture is deliberately over-determined (see the
// meta.json "why" field's margin argument): every eval transition's correct
// answer has either an EXCLUSIVE t1=1.0 training successor or the
// consistency-gated hard-segue pin, so the full model already sits at the
// 100% top-1/5/10 ceiling (Test 3 above). This makes the ablation deltas
// hand-computable WITHOUT re-deriving the full interpolated-blend
// arithmetic: no variant can possibly score BETTER than 100%, so
// `deltaVsFull` must be `<= 0` for every signal on every k -- a structural
// fact independent of the exact backoff weights. Cross-checked against the
// real deterministic implementation (a throwaway Node script, not
// committed) before being baked into the test, which additionally confirms
// every single signal's ablation delta is exactly 0 here (the dominance
// margin the fixture was designed around, per meta.json, survives every
// one-signal-off variant -- decay/tuning/albumEra weight renormalization
// keeps t1 dominant; hardSegue's pin turns out to be redundant with the
// underlying exclusive t1 for Y->Z specifically).
describe("runBacktest — leave-one-signal-out ablation (EVAL-02, D-14)", () => {
  it("Test 7: ablation has one AblationEntry per toggleable signal, each with its own splits and a deltaVsFull", () => {
    const result = runBacktest(corpus);

    const expectedSignals = ["decay", "rotation", "alreadyPlayed", "eraPrior", "hardSegue", "tuning", "albumEra"];
    expect(result.ablation.length).toBe(expectedSignals.length);
    expect(result.ablation.map((e) => e.signal).sort()).toEqual([...expectedSignals].sort());

    for (const entry of result.ablation) {
      expect(entry.overall.n).toBe(result.evalTransitionCount);
      expect(entry.hardSegue.n + entry.freeChoice.n).toBe(entry.overall.n);
      expect(entry.deltaVsFull).toHaveProperty("top1");
      expect(entry.deltaVsFull).toHaveProperty("top5");
      expect(entry.deltaVsFull).toHaveProperty("top10");
    }
  });

  it("Test 8: deltaVsFull sign/shape -- no variant can exceed the full model's 100% ceiling on this fixture, so every delta is <= 0, and every signal's delta is exactly 0 (the dominance margin survives every one-signal-off variant, hand-cross-checked)", () => {
    const result = runBacktest(corpus);

    for (const entry of result.ablation) {
      expect(entry.deltaVsFull.top1).toBeLessThanOrEqual(0);
      expect(entry.deltaVsFull.top5).toBeLessThanOrEqual(0);
      expect(entry.deltaVsFull.top10).toBeLessThanOrEqual(0);
      // Hand-computed + implementation-cross-checked exact values (see
      // describe-block comment above): every signal's ablation is a no-op
      // on this over-determined fixture.
      expect(entry.deltaVsFull).toEqual({ top1: 0, top5: 0, top10: 0 });
    }
  });

  it("Test 9: the signal-off variant is produced by flipping exactly one SignalToggles flag through the shared predict() path -- a backoff-tier ablation (tuning/albumEra) still yields a valid, fully-populated split rather than crashing or degenerating to an empty/NaN result", () => {
    const result = runBacktest(corpus);

    const tuningEntry = result.ablation.find((e) => e.signal === "tuning");
    const albumEraEntry = result.ablation.find((e) => e.signal === "albumEra");
    expect(tuningEntry).toBeDefined();
    expect(albumEraEntry).toBeDefined();

    // Re-normalization keeps baseFactor a valid convex blend -- top-k counts
    // stay finite integers bounded by n, never NaN/undefined from a
    // divide-by-zero on the dropped tier.
    for (const entry of [tuningEntry!, albumEraEntry!]) {
      expect(Number.isFinite(entry.overall.top1)).toBe(true);
      expect(entry.overall.top1).toBeGreaterThanOrEqual(0);
      expect(entry.overall.top1).toBeLessThanOrEqual(entry.overall.n);
    }
  });
});

describe("runBacktest — ablation is report-only, no gate (D-14)", () => {
  it("Test 10: runBacktest never throws and never returns a pass/fail flag based on the numbers -- the returned object carries only reporting fields", () => {
    expect(() => runBacktest(corpus)).not.toThrow();

    const result = runBacktest(corpus);
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(
      [
        "schemaVersion",
        "generatedAt",
        "holdoutTourId",
        "holdoutTourName",
        "holdoutShowCount",
        "evalTransitionCount",
        "overall",
        "hardSegue",
        "freeChoice",
        "ablation",
      ].sort(),
    );
    // No "passed"/"ok"/"gate"/"threshold" field anywhere on the result or
    // any ablation entry -- D-14: the owner reads the numbers, Phase 2 never
    // auto-decides.
    expect(result).not.toHaveProperty("passed");
    expect(result).not.toHaveProperty("gate");
    for (const entry of result.ablation) {
      expect(Object.keys(entry).sort()).toEqual(
        ["signal", "overall", "hardSegue", "freeChoice", "deltaVsFull"].sort(),
      );
    }
  });
});

describe("runBacktest — no leakage (M5)", () => {
  it("Test 6: for the first held-out show, the as-of matrix contains only strictly-prior shows -- a transition unique to the holdout show's own occurrence is not 'learned' from itself", () => {
    const holdout = findHoldoutShows(corpus);
    const firstShow = [...holdout].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.showOrder - b.showOrder))[0];
    expect(firstShow.date).toBe("2024-06-01");

    // The SAME exclusive (date, showOrder) bound runBacktest's walk-forward
    // loop uses for the first held-out show (D-12/M5).
    const asOf = { date: firstShow.date, showOrder: firstShow.showOrder, inclusive: false };
    const matrix = buildMatrix(corpus, asOf);

    // P->Q (songId 801->802) is observed in BOTH the legacy tour (OLD-Show1,
    // strictly prior) AND the held-out show itself (H1). If H1's own
    // occurrence leaked into its own training matrix, count would be 2.
    const edgePQ = matrix.edges.find((e) => e.from === 801 && e.to === 802);
    expect(edgePQ).toBeDefined();
    expect(edgePQ!.count).toBe(1);
    expect(edgePQ!.firstDate).toBe("2024-05-18");
    expect(edgePQ!.lastDate).toBe("2024-05-18");

    // Cross-check via the full backtest: the resulting overall hit counts
    // are consistent with this leak-free matrix (already asserted in Test
    // 3/4 above) -- this test isolates the specific leakage mechanism.
  });
});
