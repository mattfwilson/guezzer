import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { normalizeCorpus } from "../../src/ingest/normalize.ts";
import { buildMatrix } from "../../src/model/matrix.ts";
import { buildMatrixIndex, type MatrixIndex } from "../../src/model/index-build.ts";
import { decayedWeight } from "../../src/model/decay.ts";
import {
  alreadyPlayedFactor,
  baseFactor,
  basePlayRate,
  defaultSignalToggles,
  eraPrior,
  predict,
  rotationSuppression,
  scoreCandidate,
  transitionProb,
  tuningAffinity,
  type ScoringConfig,
} from "../../src/model/predict.ts";
import type { AsOfBound, ShowContext, SignalToggles } from "../../src/domain/types.ts";

// Fixture-normalize convention (normalize.test.ts:1-16 / matrix.test.ts:7-19):
// raw kglw.net-shaped rows normalize through normalizeCorpus first.
import rr1010 from "../../../../data/samples/rr1010.json" with { type: "json" };

/** A minimal, valid base row (matrix.test.ts's makeRow helper, same convention) for building synthetic rows. */
const baseRow = { ...rr1010.data[0] };

function makeRow(overrides: Record<string, unknown>): unknown {
  return { ...baseRow, ...overrides };
}

// --- Synthetic 3-show scoring corpus (Wave-0 predict scaffold) ---
// A (700001) segues into B (700002) in show 1, then transitions into C
// (700003) in show 2. E (700005) transitions into B in show 3, giving B a
// second, independent predecessor for the tuning-affinity test. D (700004)
// is a plausible catalog song that A NEVER transitions into anywhere — the
// "backoff floor" target.
const SONG_A = 700001;
const SONG_B = 700002;
const SONG_C = 700003;
const SONG_D = 700004;
const SONG_E = 700005;

const SHOW_1_DATE = "2024-01-01";
const SHOW_2_DATE = "2024-06-01";
const SHOW_3_DATE = "2024-03-01";

const syntheticRows = [
  // Show 1: A -segue-> B -> D (closer). D never follows A anywhere.
  makeRow({
    show_id: 910001001,
    showdate: SHOW_1_DATE,
    showyear: 2024,
    showorder: 1,
    tour_id: 910,
    tourname: "Synthetic Predict Tour",
    setnumber: "1",
    settype: "Set",
    position: 1,
    song_id: SONG_A,
    songname: "Synth A",
    slug: "synth-a",
    transition_id: 2, // segue A -> B
  }),
  makeRow({
    show_id: 910001001,
    showdate: SHOW_1_DATE,
    showyear: 2024,
    showorder: 1,
    tour_id: 910,
    tourname: "Synthetic Predict Tour",
    setnumber: "1",
    settype: "Set",
    position: 2,
    song_id: SONG_B,
    songname: "Synth B",
    slug: "synth-b",
    transition_id: 1,
  }),
  makeRow({
    show_id: 910001001,
    showdate: SHOW_1_DATE,
    showyear: 2024,
    showorder: 1,
    tour_id: 910,
    tourname: "Synthetic Predict Tour",
    setnumber: "1",
    settype: "Set",
    position: 3,
    song_id: SONG_D,
    songname: "Synth D",
    slug: "synth-d",
    transition_id: 6,
  }),
  // Show 2: A -> C (closer).
  makeRow({
    show_id: 910001002,
    showdate: SHOW_2_DATE,
    showyear: 2024,
    showorder: 1,
    tour_id: 910,
    tourname: "Synthetic Predict Tour",
    setnumber: "1",
    settype: "Set",
    position: 1,
    song_id: SONG_A,
    songname: "Synth A",
    slug: "synth-a",
    transition_id: 1,
  }),
  makeRow({
    show_id: 910001002,
    showdate: SHOW_2_DATE,
    showyear: 2024,
    showorder: 1,
    tour_id: 910,
    tourname: "Synthetic Predict Tour",
    setnumber: "1",
    settype: "Set",
    position: 2,
    song_id: SONG_C,
    songname: "Synth C",
    slug: "synth-c",
    transition_id: 6,
  }),
  // Show 3: E -> B (closer). Gives B a second predecessor for tuning tests.
  makeRow({
    show_id: 910001003,
    showdate: SHOW_3_DATE,
    showyear: 2024,
    showorder: 1,
    tour_id: 910,
    tourname: "Synthetic Predict Tour",
    setnumber: "1",
    settype: "Set",
    position: 1,
    song_id: SONG_E,
    songname: "Synth E",
    slug: "synth-e",
    transition_id: 1,
  }),
  makeRow({
    show_id: 910001003,
    showdate: SHOW_3_DATE,
    showyear: 2024,
    showorder: 1,
    tour_id: 910,
    tourname: "Synthetic Predict Tour",
    setnumber: "1",
    settype: "Set",
    position: 2,
    song_id: SONG_B,
    songname: "Synth B",
    slug: "synth-b",
    transition_id: 6,
  }),
];

const AS_OF: AsOfBound = { date: SHOW_2_DATE, showOrder: 1, inclusive: true };

function buildSyntheticMatrix() {
  const { corpus } = normalizeCorpus(syntheticRows);
  return buildMatrix(corpus, AS_OF, config, { generatedAt: "2026-01-01T00:00:00.000Z" });
}

describe("predict — transitionProb (MODL-03)", () => {
  it("Test 1: transitionProb(A,B) equals weightedCount(A->B) / sum_x weightedCount(A->x), and sums to ~1 over A's observed successors", () => {
    const matrix = buildSyntheticMatrix();
    const index = buildMatrixIndex(matrix);

    const weightAB = decayedWeight(SHOW_1_DATE, AS_OF.date, config.decayHalfLifeDays);
    const weightAC = decayedWeight(SHOW_2_DATE, AS_OF.date, config.decayHalfLifeDays); // == 1 (same date as asOf)
    const expectedTotal = weightAB + weightAC;

    const probAB = transitionProb(SONG_A, SONG_B, index, config, defaultSignalToggles);
    const probAC = transitionProb(SONG_A, SONG_C, index, config, defaultSignalToggles);

    expect(probAB).toBeCloseTo(weightAB / expectedTotal, 6);
    expect(probAC).toBeCloseTo(weightAC / expectedTotal, 6);
    // A's only two observed successors are B and C -- their transitionProb
    // mass alone must sum to ~1 (Pitfall 4).
    expect(probAB + probAC).toBeCloseTo(1, 6);
  });
});

describe("predict — backoff floor (MODL-08)", () => {
  it("Test 2: baseFactor(A, D) is strictly > 0 even though D is never observed as a successor of A anywhere in the corpus", () => {
    const matrix = buildSyntheticMatrix();
    const index = buildMatrixIndex(matrix);

    // Sanity check the fixture's premise: no A->D edge exists.
    expect(matrix.edges.some((e) => e.from === SONG_A && e.to === SONG_D)).toBe(false);

    const value = baseFactor(SONG_A, SONG_D, index, config, defaultSignalToggles);
    expect(value).toBeGreaterThan(0);
  });
});

describe("predict — tuning backoff only (MODL-09, D-03)", () => {
  it("Test 3: tuningAffinity contributes to baseFactor (zeroing w2 in a config clone changes baseFactor for a pair with cross-family tuning mass)", () => {
    const { corpus } = normalizeCorpus(syntheticRows);
    // A and E share tuning family "cs-standard"; both transition into B, so
    // tuningAffinity(A, B) pools mass beyond A's own transitionProb(A, B)
    // (E->B contributes too) -- a genuinely distinct pairwise signal.
    const tuningFamilyBySongId = new Map<number, "standard" | "cs-standard" | "microtonal" | "other">([
      [SONG_A, "cs-standard"],
      [SONG_E, "cs-standard"],
      [SONG_B, "standard"],
      [SONG_C, "standard"],
      [SONG_D, "standard"],
    ]);
    const matrix = buildMatrix(corpus, AS_OF, config, {
      tuningFamilyBySongId,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const index = buildMatrixIndex(matrix);

    expect(tuningAffinity(SONG_A, SONG_B, index, defaultSignalToggles)).toBeGreaterThan(0);

    const withTuning = baseFactor(SONG_A, SONG_B, index, config, defaultSignalToggles);

    const cfgNoTuning: ScoringConfig = {
      ...config,
      backoffWeights: { ...config.backoffWeights, w2: 0 },
    };
    const withoutTuning = baseFactor(SONG_A, SONG_B, index, cfgNoTuning, defaultSignalToggles);

    expect(withTuning).not.toBeCloseTo(withoutTuning, 6);
  });
});

describe("predict — tier normalization (Pitfall 4)", () => {
  it("Test 4: transitionProb, tuningAffinity, and basePlayRate each sum to ~1.0 over the full candidate universe C when summed from A", () => {
    const matrix = buildSyntheticMatrix();
    const index = buildMatrixIndex(matrix);
    const candidateIds = matrix.nodes.map((n) => n.songId);

    const sumTransition = candidateIds.reduce(
      (sum, id) => sum + transitionProb(SONG_A, id, index, config, defaultSignalToggles),
      0,
    );
    const sumTuning = candidateIds.reduce(
      (sum, id) => sum + tuningAffinity(SONG_A, id, index, defaultSignalToggles),
      0,
    );
    const sumBasePlayRate = candidateIds.reduce((sum, id) => sum + basePlayRate(id, index), 0);

    expect(sumTransition).toBeCloseTo(1, 6);
    expect(sumTuning).toBeCloseTo(1, 6);
    expect(sumBasePlayRate).toBeCloseTo(1, 6);
  });
});

describe("predict — ranked prediction (MODL-03 end-to-end)", () => {
  it("Test 5: predict returns >= min(candidateListSize, |C|) candidates sorted by score desc, with an observed successor of A ranked above the unobserved D", () => {
    const matrix = buildSyntheticMatrix();
    const context: ShowContext = { currentSongId: SONG_A, trail: [], recentShowSongSets: [] };
    const candidates = predict(matrix, context);

    const expectedCount = Math.min(config.candidateListSize, matrix.nodes.length);
    expect(candidates.length).toBe(expectedCount);

    // Sorted by score desc.
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score);
    }

    const rankOf = (songId: number) => candidates.findIndex((c) => c.songId === songId);
    const bestObservedRank = Math.min(rankOf(SONG_B), rankOf(SONG_C));
    expect(bestObservedRank).toBeLessThan(rankOf(SONG_D));
  });
});

describe("predict — deterministic ranking (Pitfall 2)", () => {
  it("Test 6: repeated calls to predict produce byte-identical output; equal scores tie-break by playCount desc then songId asc", () => {
    const matrix = buildSyntheticMatrix();
    const context: ShowContext = { currentSongId: SONG_A, trail: [], recentShowSongSets: [] };

    const first = predict(matrix, context);
    const second = predict(matrix, context);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));

    // Every candidate not B/C has zero transitionProb/tuningAffinity mass
    // from A and shares the same albumEraAffinity fallback -- their score
    // ordering among themselves must come down to playCount desc, songId asc.
    const indexed = buildMatrixIndex(matrix);
    const untouched = first.filter((c) => c.songId !== SONG_B && c.songId !== SONG_C);
    for (let i = 1; i < untouched.length; i++) {
      const prev = untouched[i - 1];
      const cur = untouched[i];
      if (prev.score === cur.score) {
        const prevPlay = indexed.nodeById.get(prev.songId)?.playCount ?? 0;
        const curPlay = indexed.nodeById.get(cur.songId)?.playCount ?? 0;
        expect(prevPlay >= curPlay).toBe(true);
        if (prevPlay === curPlay) expect(prev.songId).toBeLessThan(cur.songId);
      }
    }
  });
});

describe("predict — candidate breakdown (D-06)", () => {
  it("Test 7: every returned PredictionCandidate has a populated factors object and a non-empty reason string", () => {
    const matrix = buildSyntheticMatrix();
    const context: ShowContext = { currentSongId: SONG_A, trail: [], recentShowSongSets: [] };
    const candidates = predict(matrix, context);

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.factors.transitionProb).toBeGreaterThanOrEqual(0);
      expect(candidate.factors.decay).toBeGreaterThan(0);
      expect(candidate.factors.rotation).toBe(1); // empty recentShowSongSets -> no suppression
      expect(candidate.factors.alreadyPlayed).toBe(1); // empty trail -> not already played
      expect(candidate.factors.eraPrior).toBeGreaterThanOrEqual(config.eraPriorFloor);
      expect(candidate.factors.eraPrior).toBeLessThanOrEqual(config.eraPriorCeil);
      expect(["transition", "tuning", "albumEra", "basePlayRate"]).toContain(candidate.factors.backoffTier);
      expect(candidate.factors.hardSegueFlag).toBe(false); // stub this task (Task 2 fills hardSegueOverride)
      expect(candidate.reason.length).toBeGreaterThan(0);
    }

    // The observed A->B edge (segue) must produce a concrete count-backed
    // reason, not a backoff label.
    const bCandidate = candidates.find((c) => c.songId === SONG_B)!;
    expect(bCandidate.reason).toMatch(/^seen \d+× since \d{4}$/);

    // D-03: no top-level tuning multiplier field exists anywhere in the
    // per-candidate breakdown -- tuning only ever enters via the baseFactor
    // blend (see the "tuning backoff only" describe block above).
    const direct = scoreCandidate(SONG_A, SONG_B, buildMatrixIndex(matrix), config, defaultSignalToggles, context);
    expect(Object.keys(direct.factors).sort()).toEqual(
      ["alreadyPlayed", "backoffTier", "decay", "eraPrior", "hardSegueFlag", "rotation", "transitionProb"].sort(),
    );
  });
});

// --- Plan 02-03 Task 1: real rotation/alreadyPlayed/eraPrior bodies + decay-toggle confirmation (MODL-04/06/07/10) ---

describe("predict — already played (D-05/MODL-10)", () => {
  it("Test 8: a trail member is multiplied by cfg.alreadyPlayedFactor, strictly > 0, applied once per candidate regardless of repeat occurrences", () => {
    const matrix = buildSyntheticMatrix();
    // SONG_B appears twice in the trail (a sandwich/reprise so far this
    // show) -- the boolean membership check must still apply the factor
    // exactly once, not compound it.
    const ctx: ShowContext = { currentSongId: SONG_A, trail: [SONG_B, SONG_D, SONG_B], recentShowSongSets: [] };

    const factor = alreadyPlayedFactor(SONG_B, ctx, config);
    expect(factor).toBeCloseTo(config.alreadyPlayedFactor, 6);
    expect(factor).toBeGreaterThan(0); // near-zero, never hard-zero (D-05)

    // A candidate never in the trail is untouched.
    expect(alreadyPlayedFactor(SONG_C, ctx, config)).toBe(1);

    // End-to-end: scoreCandidate's alreadyPlayed factor reflects the same value.
    const index = buildMatrixIndex(matrix);
    const scored = scoreCandidate(SONG_A, SONG_B, index, config, defaultSignalToggles, ctx);
    expect(scored.factors.alreadyPlayed).toBeCloseTo(config.alreadyPlayedFactor, 6);
  });
});

describe("predict — rotation suppression (MODL-06)", () => {
  it("Test 9: a candidate played in all of the last rotationWindowShows recent shows is multiplied by rotationPenaltyPerShow^n; a candidate in none of them is untouched; never a hard zero", () => {
    const ctx: ShowContext = {
      currentSongId: SONG_A,
      trail: [],
      // 3 recent prior-tour shows (distinct from the in-progress trail, M3),
      // each containing SONG_B.
      recentShowSongSets: [
        [SONG_B, SONG_D],
        [SONG_B, SONG_C],
        [SONG_B],
      ],
    };

    const suppressedB = rotationSuppression(SONG_B, ctx, config);
    expect(suppressedB).toBeCloseTo(Math.pow(config.rotationPenaltyPerShow, 3), 6);
    expect(suppressedB).toBeGreaterThan(0); // approaches exclusion, never hits 0

    const untouchedE = rotationSuppression(SONG_E, ctx, config);
    expect(untouchedE).toBe(1);

    // Only within the trailing rotationWindowShows window -- a show outside
    // the window doesn't count.
    const ctxOneRecent: ShowContext = { currentSongId: SONG_A, trail: [], recentShowSongSets: [[SONG_B]] };
    expect(rotationSuppression(SONG_B, ctxOneRecent, config)).toBeCloseTo(config.rotationPenaltyPerShow, 6);
  });
});

describe("predict — era prior (MODL-07)", () => {
  it("Test 10: eraPrior is a relative multiplier centered near 1 -- a currently-hot song scores > 1, a song with zero recent-era plays scores < 1 but >= eraPriorFloor, and the result is clamped to [floor, ceil]", () => {
    // Hand-built MatrixIndex (eraPrior is a pure fn of index + cfg, no I/O
    // needed) -- keeps the era-window arithmetic exact and independent of
    // buildMatrix's `typeof config` literal-typed parameter.
    const SONG_HOT = 800001;
    const SONG_RETIRED = 800002;
    const SONG_SUPERHOT = 800003;
    const index: MatrixIndex = {
      edgesFrom: new Map(),
      nodeById: new Map([
        [SONG_HOT, { songId: SONG_HOT, songName: "Hot", playCount: 10, eraPlayCount: 1, tuningFamily: "other" }],
        [SONG_RETIRED, { songId: SONG_RETIRED, songName: "Retired", playCount: 10, eraPlayCount: 0, tuningFamily: "other" }],
        [SONG_SUPERHOT, { songId: SONG_SUPERHOT, songName: "Superhot", playCount: 100, eraPlayCount: 50, tuningFamily: "other" }],
      ]),
    };
    const cfgNarrowEra: ScoringConfig = { ...config, eraWindowShows: 1 };

    // eraRate(HOT) = 1/1 = 1.0 > allTimeRate = basePlayRate(HOT) = 10/120 ~ 0.083 -> ratio > 1.
    const hotFactor = eraPrior(SONG_HOT, index, cfgNarrowEra);
    expect(hotFactor).toBeGreaterThan(1);
    expect(hotFactor).toBeLessThanOrEqual(cfgNarrowEra.eraPriorCeil);

    // eraPlayCount === 0 -- a "retired" (this-era) song -- scores < 1 but stays >= floor.
    const retiredFactor = eraPrior(SONG_RETIRED, index, cfgNarrowEra);
    expect(retiredFactor).toBeLessThan(1);
    expect(retiredFactor).toBeGreaterThanOrEqual(cfgNarrowEra.eraPriorFloor);

    // Clamp ceiling is load-bearing: with smoothing disabled, the raw ratio
    // for the superhot song (eraRate 50/1=50 vs allTimeRate ~0.83) blows
    // well past eraPriorCeil, so the returned value must be the ceiling
    // itself, not the unclamped ratio.
    const cfgNoSmoothing: ScoringConfig = { ...cfgNarrowEra, eraPriorSmoothingK: 0 };
    const clampedFactor = eraPrior(SONG_SUPERHOT, index, cfgNoSmoothing);
    expect(clampedFactor).toBe(cfgNoSmoothing.eraPriorCeil);

    // Unknown song id degrades to the neutral 1.0, never NaN/undefined.
    expect(eraPrior(999999, index, cfgNarrowEra)).toBe(1);
  });
});

describe("predict — decay toggle (MODL-04)", () => {
  it("Test 11: toggles.decay=false uses raw count (equal for A's two single-instance successors); toggles.decay=true differentiates by recency", () => {
    const matrix = buildSyntheticMatrix();
    const index = buildMatrixIndex(matrix);
    const noDecay: SignalToggles = { ...defaultSignalToggles, decay: false };

    const probAB_noDecay = transitionProb(SONG_A, SONG_B, index, config, noDecay);
    const probAC_noDecay = transitionProb(SONG_A, SONG_C, index, config, noDecay);
    // Both A->B and A->C are single raw instances (count=1 each) -- with
    // decay off they must be exactly equal (0.5 each of A's 2 exits).
    expect(probAB_noDecay).toBeCloseTo(0.5, 6);
    expect(probAC_noDecay).toBeCloseTo(0.5, 6);

    const probAB_decay = transitionProb(SONG_A, SONG_B, index, config, defaultSignalToggles);
    const probAC_decay = transitionProb(SONG_A, SONG_C, index, config, defaultSignalToggles);
    // SHOW_1 (A->B) is older than SHOW_2 (A->C, same date as AS_OF) -- decay
    // must break the tie the raw counts couldn't.
    expect(probAB_decay).not.toBeCloseTo(probAC_decay, 6);
  });
});
