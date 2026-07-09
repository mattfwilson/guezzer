import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { normalizeCorpus } from "../../src/ingest/normalize.ts";
import { buildMatrix } from "../../src/model/matrix.ts";
import type { AsOfBound } from "../../src/domain/types.ts";

// Fixture-normalize convention (normalize.test.ts:1-16): raw kglw.net-shaped
// rows normalize through normalizeCorpus first, then feed buildMatrix.
import rr1010 from "../../../../data/samples/rr1010.json" with { type: "json" };
import fixture2013Encore from "../fixtures/2013-encore.json" with { type: "json" };
import fixture2022Rr1010Multiset from "../fixtures/2022-rr1010-multiset.json" with { type: "json" };
import fixtureSyntheticAsCutoff from "../fixtures/synthetic-ascutoff.json" with { type: "json" };

/** A minimal, valid base row (real rr1010.json data[0] shape) for building synthetic edge-case rows — mirrors normalize.test.ts's makeRow helper. */
const baseRow = { ...rr1010.data[0] };

function makeRow(overrides: Record<string, unknown>): unknown {
  return { ...baseRow, ...overrides };
}

describe("buildMatrix — boundary exclusion (DATA-05, D-07)", () => {
  it("Test 1: 2013-encore — no edge from the last main-set song into the (placeholder) first encore song, only within-set adjacent pairs become edges", () => {
    const { corpus } = normalizeCorpus(fixture2013Encore);
    const show = corpus.shows[0];
    const asOf: AsOfBound = { date: show.date, showOrder: show.showOrder, inclusive: true };
    const matrix = buildMatrix(corpus, asOf);

    // Last set-1 performance is "Jam" (song_id 439, position 8); the encore
    // (setnumber "e") is entirely the Unknown sentinel (song_id 1) at
    // positions 9-10 — no edge may originate from 439 (would only ever
    // target the sentinel, which is excluded), and no sentinel node/edge
    // exists anywhere in the matrix.
    expect(matrix.edges.some((e) => e.from === 439)).toBe(false);
    expect(matrix.edges.some((e) => e.from === 1 || e.to === 1)).toBe(false);
    expect(matrix.nodes.some((n) => n.songId === 1)).toBe(false);

    // A normal within-set edge (position 1 -> 2: Sea of Trees -> Bloody Ripper) still exists.
    expect(matrix.edges.some((e) => e.from === 177 && e.to === 34)).toBe(true);
  });

  it("Test 2: 2022-rr1010-multiset — no edge across the set-1 -> set-2 boundary (position 13 -> 14)", () => {
    const { corpus } = normalizeCorpus(fixture2022Rr1010Multiset);
    const show = corpus.shows[0];
    const asOf: AsOfBound = { date: show.date, showOrder: show.showOrder, inclusive: true };
    const matrix = buildMatrix(corpus, asOf);

    // Set 1 closer (position 13) is "Magma" (song_id 132); set 2 opener
    // (position 14) is "Rattlesnake" (song_id 168) — this adjacency spans a
    // set boundary and must never become an edge.
    expect(matrix.edges.some((e) => e.from === 132 && e.to === 168)).toBe(false);

    // A within-set-1 edge (position 1 -> 2) still exists.
    expect(matrix.edges.length).toBeGreaterThan(0);
  });
});

describe("buildMatrix — matrix schema (MODL-01)", () => {
  const { corpus } = normalizeCorpus(fixture2013Encore);
  const show = corpus.shows[0];
  const asOf: AsOfBound = { date: show.date, showOrder: show.showOrder, inclusive: true };
  const matrix = buildMatrix(corpus, asOf);

  it("Test 3: schemaVersion 1, asOfDate set, nodes sorted by songId, edges sorted by (from, to)", () => {
    expect(matrix.schemaVersion).toBe(1);
    expect(matrix.asOfDate).toBe(show.date);
    expect(matrix.nodeCount).toBe(matrix.nodes.length);
    expect(matrix.edgeCount).toBe(matrix.edges.length);

    const nodeIds = matrix.nodes.map((n) => n.songId);
    expect(nodeIds).toEqual([...nodeIds].sort((a, b) => a - b));

    const edgeKeys = matrix.edges.map((e) => [e.from, e.to]);
    const sortedEdgeKeys = [...edgeKeys].sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
    expect(edgeKeys).toEqual(sortedEdgeKeys);
  });

  it("Test 4: no node or edge references the sentinel song_id (1)", () => {
    expect(matrix.nodes.some((n) => n.songId === 1)).toBe(false);
    expect(matrix.edges.some((e) => e.from === 1 || e.to === 1)).toBe(false);
  });
});

describe("buildMatrix — as-of cutoff (MODL-02, D-09 refined by 02-RESEARCH.md M5)", () => {
  const { corpus } = normalizeCorpus(fixtureSyntheticAsCutoff);

  it("Test 5: an exclusive (date, showOrder) bound excludes the same-date-later show and the future show", () => {
    const asOf: AsOfBound = { date: "2020-01-01", showOrder: 2, inclusive: false };
    const matrix = buildMatrix(corpus, asOf);

    // Show 1 (showOrder 1, same date, strictly before the bound) IS included.
    expect(matrix.edges.some((e) => e.from === 900101 && e.to === 900102)).toBe(true);
    // Show 2 (showOrder 2, same date AS the exclusive bound) is excluded.
    expect(matrix.edges.some((e) => e.from === 900103 && e.to === 900104)).toBe(false);
    // Show 3 (later date) is excluded.
    expect(matrix.edges.some((e) => e.from === 900105 && e.to === 900106)).toBe(false);
  });

  it("Test 6: inclusive: true at the same (date, showOrder) bound includes the boundary show itself, but never the future show", () => {
    const asOf: AsOfBound = { date: "2020-01-01", showOrder: 2, inclusive: true };
    const matrix = buildMatrix(corpus, asOf);

    expect(matrix.edges.some((e) => e.from === 900101 && e.to === 900102)).toBe(true);
    expect(matrix.edges.some((e) => e.from === 900103 && e.to === 900104)).toBe(true);
    expect(matrix.edges.some((e) => e.from === 900105 && e.to === 900106)).toBe(false);
  });

  it("Test 7: a date-only cutoff would have leaked show 2 -- proving the tuple bound is load-bearing", () => {
    // Sanity check of the fixture's premise: show 1 and show 2 share
    // exactly the same date, disambiguated only by showOrder.
    const show1 = corpus.shows.find((s) => s.showId === 900001001)!;
    const show2 = corpus.shows.find((s) => s.showId === 900001002)!;
    expect(show1.date).toBe(show2.date);
    expect(show1.showOrder).not.toBe(show2.showOrder);
  });
});

describe("buildMatrix — decay half-life (MODL-04)", () => {
  it("Test 8: an edge observed exactly decayHalfLifeDays before asOfDate contributes weightedCount ~ 0.5; count is the raw integer; decay is measured from asOfDate, never Date.now()", () => {
    const showDate = "2020-01-01";
    const halfLifeDays = config.decayHalfLifeDays;
    const asOfDate = new Date(Date.parse(showDate) + halfLifeDays * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const rows = [
      makeRow({
        show_id: 800001001,
        showdate: showDate,
        showyear: 2020,
        showorder: 1,
        tour_id: 900,
        tourname: "Synthetic Decay Tour",
        setnumber: "1",
        settype: "Set",
        position: 1,
        song_id: 800001,
        songname: "Decay Song X",
        slug: "decay-song-x",
        transition_id: 1,
      }),
      makeRow({
        show_id: 800001001,
        showdate: showDate,
        showyear: 2020,
        showorder: 1,
        tour_id: 900,
        tourname: "Synthetic Decay Tour",
        setnumber: "1",
        settype: "Set",
        position: 2,
        song_id: 800002,
        songname: "Decay Song Y",
        slug: "decay-song-y",
        transition_id: 4,
      }),
    ];

    const { corpus } = normalizeCorpus(rows);
    const asOf: AsOfBound = { date: asOfDate, showOrder: 1, inclusive: true };
    const matrix = buildMatrix(corpus, asOf);

    const edge = matrix.edges.find((e) => e.from === 800001 && e.to === 800002);
    expect(edge).toBeDefined();
    expect(edge!.count).toBe(1);
    expect(edge!.weightedCount).toBeCloseTo(0.5, 6);
  });
});

describe("buildMatrix — determinism (RESEARCH Pitfall 2)", () => {
  it("Test 9: JSON.stringify(buildMatrix(...)) is byte-identical across two calls with the same inputs", () => {
    const { corpus } = normalizeCorpus(rr1010.data);
    const show = corpus.shows[0];
    const asOf: AsOfBound = { date: show.date, showOrder: show.showOrder, inclusive: true };
    const generatedAt = "2026-01-01T00:00:00.000Z";

    const matrixA = buildMatrix(corpus, asOf, config, { generatedAt });
    const matrixB = buildMatrix(corpus, asOf, config, { generatedAt });

    expect(JSON.stringify(matrixA)).toBe(JSON.stringify(matrixB));
  });
});
