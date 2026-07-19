import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { normalizeCorpus } from "../../src/ingest/normalize.ts";
import { buildMatrix } from "../../src/model/matrix.ts";
import { buildMatrixIndex } from "../../src/model/index-build.ts";
import { decayedWeight } from "../../src/model/decay.ts";
import {
  alreadyPlayedFactor,
  applyOverride,
  baseFactor,
  basePlayRate,
  defaultSignalToggles,
  eraPrior,
  hardSegueOverride,
  predict,
  rotationSuppression,
  scoreCandidate,
  transitionProb,
  tuningAffinity,
  type ScoringConfig,
} from "../../src/model/predict.ts";
import type {
  AsOfBound,
  MatrixNode,
  ShowContext,
  SignalToggles,
  TransitionMatrix,
} from "../../src/domain/types.ts";

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

    const expectedCount = Math.min(config.candidateListSize, matrix.nodes.length - 1);
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
      // Neither observed A-edge (A->B segueRate 0.5, A->C not a segue) clears
      // the consistency gate (threshold 0.7, minSupport 3) -- boosted, never pinned.
      expect(candidate.factors.hardSegueFlag).toBe(false);
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

// --- Plan 11-01 (PRED-02) Wave-0 RED gate: production-scale era-prior ---
// The prior Test 10 hand-built a 3-node MatrixIndex whose Σ playCount = 120,
// which made basePlayRate() accidentally commensurate with the per-window
// eraRate and let the eraPriorFloor fire. At real catalog scale
// (Σ playCount ~14,000 across ~260 nodes) the k=1 additive smoothing in
// eraPrior() pins every ratio near 1.0 and the floor becomes unreachable —
// the unit mismatch RESEARCH Pitfall 1 / PRED-02 documents. This rewritten,
// production-scale fixture makes that dead floor TESTABLE: on the current
// (buggy) eraPrior arithmetic the retired-song assertion below FAILS (RED),
// and plan 11-03 (the PRED-02 fix) flips it green. Do NOT weaken this test
// or touch predict.ts/config.ts to make it pass here.
const ERA_RETIRED = 800002; // this-era retired: eraPlayCount 0, modest career playCount
const ERA_HOT = 800001; // currently-hot: high eraPlayCount near eraWindowShows

/**
 * A representative production-scale TransitionMatrix (~260 nodes,
 * Σ playCount ~14,000, corpus-realistic showCount) built to exercise
 * eraPrior() at the same scale as the shipped artifact. Includes one RETIRED
 * node (eraPlayCount 0, career playCount ~50) and one HOT node (eraPlayCount
 * near eraWindowShows, high career playCount). Edges are irrelevant to
 * eraPrior (it reads only nodeById + config), so the edge list is empty. The
 * index is built via buildMatrixIndex(matrix) — never a hand-built literal —
 * so this test stays forward-compatible with the showCount field plan 11-03
 * threads into MatrixIndex.
 */
function buildProductionScaleEraMatrix(): TransitionMatrix {
  const nodes: MatrixNode[] = [
    // Retired: played ~50 times over its career, ZERO plays this era.
    { songId: ERA_RETIRED, songName: "Retired Deep Cut", playCount: 50, eraPlayCount: 0, tuningFamily: "other" },
    // Hot: heavily played career AND near-saturated in the current era window.
    { songId: ERA_HOT, songName: "Current Rotation Staple", playCount: 300, eraPlayCount: 38, tuningFamily: "other" },
  ];

  // ~258 filler catalog nodes: a spread of career playCounts (10..99, avg ~54)
  // so Σ playCount lands near 14,000 — the scale at which k=1 smoothing pins
  // the ratio near 1.0. eraPlayCount on fillers does not affect the two tested
  // nodes (eraPrior's denominator is eraWindowShows, not total era play).
  for (let i = 0; i < 258; i++) {
    const songId = 810000 + i;
    nodes.push({
      songId,
      songName: `Catalog Song ${i}`,
      playCount: 10 + (i % 90),
      eraPlayCount: i % 5,
      tuningFamily: "other",
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    asOfDate: "2026-01-01",
    showCount: 241, // corpus-realistic (matrix.ts:186)
    nodeCount: nodes.length,
    edgeCount: 0,
    nodes,
    edges: [],
  };
}

describe("predict — era prior at production scale (MODL-07 / PRED-02 RED gate)", () => {
  it("Test 10: a zero-era-play retired song reaches ~eraPriorFloor and a currently-hot song scores > 1 at real catalog scale (RED on current eraPrior — flipped green by plan 11-03)", () => {
    const matrix = buildProductionScaleEraMatrix();
    const index = buildMatrixIndex(matrix);

    // Sanity: this fixture really is production scale (Σ playCount ~14k), the
    // condition under which the current eraPrior masks the floor.
    const totalPlay = matrix.nodes.reduce((sum, n) => sum + n.playCount, 0);
    expect(totalPlay).toBeGreaterThan(12000);

    // Bounds are read from scoringConfig by name — never bare literals — so
    // this assertion tracks config, not a hardcoded 0.3/2.0.
    const cfg: ScoringConfig = config;
    const epsilon = 1e-6;

    // RETIRED song (eraPlayCount 0) MUST decay to ~eraPriorFloor. On the
    // current buggy arithmetic — ratio = (0 + k) / (playCount/Σ + k) with
    // Σ ~14,000 and k=1 — this evaluates to ~0.996, NOT ~0.3, so THIS
    // assertion is the accepted RED deliverable of the Wave-0 gate.
    const retiredFactor = eraPrior(ERA_RETIRED, index, cfg);
    expect(retiredFactor).toBeLessThanOrEqual(cfg.eraPriorFloor + epsilon);

    // HOT song (eraPlayCount near eraWindowShows) stays a genuine boost > 1
    // (this assertion already passes on current code; kept so 11-03 must
    // preserve the hot end while fixing the floor).
    const hotFactor = eraPrior(ERA_HOT, index, cfg);
    expect(hotFactor).toBeGreaterThan(1);
    expect(hotFactor).toBeLessThanOrEqual(cfg.eraPriorCeil);

    // Unknown song id degrades to the neutral 1.0, never NaN/undefined.
    expect(eraPrior(999999, index, cfg)).toBe(1);
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

// --- Plan 02-03 Task 2: consistency-gated hard-segue override (D-04/MODL-05) ---

const SONG_P = 700010; // consistent hard-segue source (P -segue-> Q, 4/4)
const SONG_Q = 700011;
const SONG_R = 700012; // one-off/insufficient-support segue source (R -segue-> S, 1/1)
const SONG_S = 700013;
const SONG_O = 700014; // direction-test: O -none-> P2 -segue-> P3
const SONG_P2 = 700015;
const SONG_P3 = 700016;

/** P -segue-> Q, 4 independent shows, every instance notated as a segue -- clears both the consistency-rate and min-support gate (4/4 >= 0.70, 4 >= 3). */
function buildPinnedSegueMatrix() {
  const rows = [1, 2, 3, 4].map((n) => [
    makeRow({
      show_id: 920000000 + n * 10 + 1,
      showdate: `2024-0${n}-01`,
      showyear: 2024,
      showorder: 1,
      tour_id: 920,
      tourname: "Synthetic Segue Tour",
      setnumber: "1",
      settype: "Set",
      position: 1,
      song_id: SONG_P,
      songname: "Synth P",
      slug: "synth-p",
      transition_id: 2, // segue P -> Q
    }),
    makeRow({
      show_id: 920000000 + n * 10 + 1,
      showdate: `2024-0${n}-01`,
      showyear: 2024,
      showorder: 1,
      tour_id: 920,
      tourname: "Synthetic Segue Tour",
      setnumber: "1",
      settype: "Set",
      position: 2,
      song_id: SONG_Q,
      songname: "Synth Q",
      slug: "synth-q",
      transition_id: 6,
    }),
  ]).flat();
  const { corpus } = normalizeCorpus(rows);
  const asOf: AsOfBound = { date: "2024-04-01", showOrder: 1, inclusive: true };
  return buildMatrix(corpus, asOf, config, { generatedAt: "2026-01-01T00:00:00.000Z" });
}

/** R -segue-> S, a single show/instance -- 100% consistent but fails min-support (1 < hardSegueMinSupport=3), so the gate must reject it despite the perfect rate (RESEARCH M4: "prevents a single 1/1 from pinning false certainty"). */
function buildOneOffSegueMatrix() {
  const rows = [
    makeRow({
      show_id: 930001001,
      showdate: "2024-02-01",
      showyear: 2024,
      showorder: 1,
      tour_id: 930,
      tourname: "Synthetic One-off Segue Tour",
      setnumber: "1",
      settype: "Set",
      position: 1,
      song_id: SONG_R,
      songname: "Synth R",
      slug: "synth-r",
      transition_id: 2, // segue R -> S
    }),
    makeRow({
      show_id: 930001001,
      showdate: "2024-02-01",
      showyear: 2024,
      showorder: 1,
      tour_id: 930,
      tourname: "Synthetic One-off Segue Tour",
      setnumber: "1",
      settype: "Set",
      position: 2,
      song_id: SONG_S,
      songname: "Synth S",
      slug: "synth-s",
      transition_id: 6,
    }),
  ];
  const { corpus } = normalizeCorpus(rows);
  const asOf: AsOfBound = { date: "2024-03-01", showOrder: 1, inclusive: true };
  return buildMatrix(corpus, asOf, config, { generatedAt: "2026-01-01T00:00:00.000Z" });
}

/** O -none-> P2 -segue-> P3: the segue notation lives on P2's row (its OUT-transition into P3), never on O's edge into P2 -- proves segue direction keys on A's transitionKind, never B's (RESEARCH Pitfall 1). */
function buildDirectionSegueMatrix() {
  const rows = [
    makeRow({
      show_id: 940001001,
      showdate: "2024-02-01",
      showyear: 2024,
      showorder: 1,
      tour_id: 940,
      tourname: "Synthetic Direction Tour",
      setnumber: "1",
      settype: "Set",
      position: 1,
      song_id: SONG_O,
      songname: "Synth O",
      slug: "synth-o",
      transition_id: 1, // O -> P2 is NOT a segue
    }),
    makeRow({
      show_id: 940001001,
      showdate: "2024-02-01",
      showyear: 2024,
      showorder: 1,
      tour_id: 940,
      tourname: "Synthetic Direction Tour",
      setnumber: "1",
      settype: "Set",
      position: 2,
      song_id: SONG_P2,
      songname: "Synth P2",
      slug: "synth-p2",
      transition_id: 2, // P2 -> P3 IS a segue (P2's own out-transition)
    }),
    makeRow({
      show_id: 940001001,
      showdate: "2024-02-01",
      showyear: 2024,
      showorder: 1,
      tour_id: 940,
      tourname: "Synthetic Direction Tour",
      setnumber: "1",
      settype: "Set",
      position: 3,
      song_id: SONG_P3,
      songname: "Synth P3",
      slug: "synth-p3",
      transition_id: 6,
    }),
  ];
  const { corpus } = normalizeCorpus(rows);
  const asOf: AsOfBound = { date: "2024-03-01", showOrder: 1, inclusive: true };
  return buildMatrix(corpus, asOf, config, { generatedAt: "2026-01-01T00:00:00.000Z" });
}

const NO_CONTEXT = (currentSongId: number): ShowContext => ({ currentSongId, trail: [], recentShowSongSets: [] });

describe("predict — hard segue override (D-04/MODL-05)", () => {
  it("Test 12: a consistent, sufficiently-supported segue (4/4 >= threshold, exits >= minSupport) pins the score to hardSegueOverrideCeiling and sets hardSegueFlag", () => {
    const matrix = buildPinnedSegueMatrix();
    const index = buildMatrixIndex(matrix);

    const override = hardSegueOverride(SONG_P, SONG_Q, index, config);
    expect(override).toEqual({ kind: "pin", value: config.hardSegueOverrideCeiling });

    const scored = scoreCandidate(SONG_P, SONG_Q, index, config, defaultSignalToggles, NO_CONTEXT(SONG_P));
    expect(scored.score).toBeCloseTo(config.hardSegueOverrideCeiling, 6);
    expect(scored.factors.hardSegueFlag).toBe(true);
  });
});

describe("predict — inconsistent segue boost (D-04)", () => {
  it("Test 13: a one-off segue (1/1, below minSupport) is NOT pinned -- instead boosted by hardSegueBoost, and hardSegueFlag stays false", () => {
    const matrix = buildOneOffSegueMatrix();
    const index = buildMatrixIndex(matrix);

    const override = hardSegueOverride(SONG_R, SONG_S, index, config);
    expect(override).toEqual({ kind: "boost", value: config.hardSegueBoost });

    const baseScore = baseFactor(SONG_R, SONG_S, index, config, defaultSignalToggles);
    const scored = scoreCandidate(SONG_R, SONG_S, index, config, defaultSignalToggles, NO_CONTEXT(SONG_R));
    // The boost multiplies the base score (not a fixed assignment like
    // `pin`) -- verify against the actual formula, including the shared
    // ceiling cap that keeps even a saturating boost from claiming literal
    // 100% (applyOverride's job, not a separate code path here).
    const multiplied = baseScore * scored.factors.rotation * scored.factors.alreadyPlayed * scored.factors.eraPrior;
    expect(scored.score).toBeCloseTo(applyOverride(multiplied, override, config), 6);
    // Structurally distinct from `pin`: reached by multiplication + cap,
    // never a forced ceiling assignment -- the flag is the load-bearing
    // distinction, not the raw score (a large boost can coincidentally
    // saturate the same cap).
    expect(scored.factors.hardSegueFlag).toBe(false);
    expect(scored.score).toBeLessThan(1); // never literally 100%, even when the boost saturates the shared ceiling
  });
});

describe("predict — segue direction (RESEARCH Pitfall 1)", () => {
  it("Test 14: the override keys on A's transitionKind (the edge's FROM side), never B's -- O->P2 (P2's segue notation describes its own out-transition) is not a segue, but P2->P3 is", () => {
    const matrix = buildDirectionSegueMatrix();
    const index = buildMatrixIndex(matrix);

    const edgeOtoP2 = matrix.edges.find((e) => e.from === SONG_O && e.to === SONG_P2);
    expect(edgeOtoP2?.segueCount).toBe(0);
    expect(hardSegueOverride(SONG_O, SONG_P2, index, config)).toBeNull();

    const edgeP2toP3 = matrix.edges.find((e) => e.from === SONG_P2 && e.to === SONG_P3);
    expect(edgeP2toP3?.segueCount).toBe(1);
    expect(hardSegueOverride(SONG_P2, SONG_P3, index, config)).not.toBeNull();
  });
});

describe("predict — no false 100% (D-04)", () => {
  it("Test 15: a free-choice (non-segue) candidate never reaches score 1.0; only a gated hard segue reaches the (sub-1.0) override ceiling", () => {
    const matrix = buildSyntheticMatrix();
    const context: ShowContext = { currentSongId: SONG_A, trail: [], recentShowSongSets: [] };
    const candidates = predict(matrix, context);
    for (const c of candidates) {
      expect(c.score).toBeLessThan(1);
    }

    // The dedicated pinned fixture proves the *only* way to approach 1.0 is
    // the 0.97 ceiling -- never literally 1.0.
    const pinnedIndex = buildMatrixIndex(buildPinnedSegueMatrix());
    const pinnedCandidate = scoreCandidate(SONG_P, SONG_Q, pinnedIndex, config, defaultSignalToggles, NO_CONTEXT(SONG_P));
    expect(pinnedCandidate.score).toBeCloseTo(config.hardSegueOverrideCeiling, 6);
    expect(pinnedCandidate.score).toBeLessThan(1);
    expect(config.hardSegueOverrideCeiling).toBeLessThan(1);
  });
});

describe("predict — segue reason string (D-06)", () => {
  it("Test 16: a gated candidate's reason reads 'notated segue N/M times since YYYY' using the stored segueCount/totalExits/firstDate", () => {
    const matrix = buildPinnedSegueMatrix();
    const index = buildMatrixIndex(matrix);

    const scored = scoreCandidate(SONG_P, SONG_Q, index, config, defaultSignalToggles, NO_CONTEXT(SONG_P));
    expect(scored.reason).toBe("notated segue 4/4 times since 2024");
    expect(scored.reason).toMatch(/^notated segue \d+\/\d+ times since \d{4}$/);
  });
});

describe("predict — self-exclusion (code review CR-01)", () => {
  it("Test 17: the currently-playing song never appears in its own candidate list, on the real corpus or the synthetic fixture", () => {
    const matrix = buildSyntheticMatrix();
    const context: ShowContext = { currentSongId: SONG_A, trail: [], recentShowSongSets: [] };
    const candidates = predict(matrix, context);

    expect(candidates.some((c) => c.songId === SONG_A)).toBe(false);
  });
});
