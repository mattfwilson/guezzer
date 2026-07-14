import { describe, expect, it } from "vitest";
import latestSample from "../../../data/samples/latest.sample.json" with { type: "json" };
import type { LatestSetlistRow } from "../src/ingest/latest-types.ts";
import {
  diffLatestAgainstTrail,
  resolvePlaceholders,
  type TrailEntryInput,
} from "../src/live/suggest.ts";

/** Build a real-shape KGLW latest row (all present keys) with overrides. */
function row(overrides: Partial<LatestSetlistRow>): LatestSetlistRow {
  return {
    ...(latestSample.data[0] as unknown as LatestSetlistRow),
    artist_id: 1,
    ...overrides,
  };
}

function entry(overrides: Partial<TrailEntryInput>): TrailEntryInput {
  return { position: 1, songId: null, isPlaceholder: false, ...overrides };
}

describe("diffLatestAgainstTrail (SYNC-02 / D-02)", () => {
  const latest = [
    row({ song_id: 100, songname: "A", position: 1 }),
    row({ song_id: 200, songname: "B", position: 2 }),
    row({ song_id: 300, songname: "C", position: 3 }),
  ];

  it("returns the next un-logged songs when A is already logged, never A", () => {
    const trail = [entry({ position: 1, songId: 100 })];
    const result = diffLatestAgainstTrail(latest, trail);

    expect(result.map((s) => s.songId)).toEqual([200, 300]);
    expect(result.map((s) => s.songId)).not.toContain(100);
  });

  it("returns at most suggestionCount (default 2) rows, ordered by position", () => {
    const result = diffLatestAgainstTrail(latest, []);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.position)).toEqual([1, 2]);
    expect(result.map((s) => s.songId)).toEqual([100, 200]);
  });

  it("honors a custom suggestionCount", () => {
    const result = diffLatestAgainstTrail(latest, [], 3);
    expect(result.map((s) => s.songId)).toEqual([100, 200, 300]);
  });

  it("a dismissed (excluded) song frees its slot — the next editor song slides in (D-01, UAT Test 2)", () => {
    // Dismissing A must surface C in the freed slot, not shrink the strip.
    const result = diffLatestAgainstTrail(latest, [], 2, new Set([100]));
    expect(result.map((s) => s.songId)).toEqual([200, 300]);
  });

  it("dismissing every visible suggestion surfaces the remaining queue, never an empty strip with songs left", () => {
    // The pre-fix defect: excluding after truncation left [] here.
    const result = diffLatestAgainstTrail(latest, [], 2, new Set([100, 200]));
    expect(result.map((s) => s.songId)).toEqual([300]);
  });

  it("exclusions and trail dedupe compose", () => {
    const trail = [entry({ position: 1, songId: 100 })];
    const result = diffLatestAgainstTrail(latest, trail, 2, new Set([200]));
    expect(result.map((s) => s.songId)).toEqual([300]);
  });

  it("orders by position even when latest rows arrive out of order", () => {
    const shuffled = [
      row({ song_id: 300, position: 3 }),
      row({ song_id: 100, position: 1 }),
      row({ song_id: 200, position: 2 }),
    ];
    const result = diffLatestAgainstTrail(shuffled, [], 3);
    expect(result.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("a song already in the trail never appears as a suggestion (D-02 non-contradiction)", () => {
    const trail = [entry({ position: 2, songId: 200 })];
    const result = diffLatestAgainstTrail(latest, trail, 3);
    expect(result.map((s) => s.songId)).toEqual([100, 300]);
    expect(result.map((s) => s.songId)).not.toContain(200);
  });

  it("ignores null and placeholder trail entries when deduping", () => {
    const trail = [
      entry({ position: 1, songId: null, isPlaceholder: true }),
      entry({ position: 2, songId: null }),
    ];
    const result = diffLatestAgainstTrail(latest, trail, 3);
    // Nothing logged with a real id → all three offered.
    expect(result.map((s) => s.songId)).toEqual([100, 200, 300]);
  });

  it("returns [] when the trail's logged song_ids cover all latest rows", () => {
    const trail = [
      entry({ position: 1, songId: 100 }),
      entry({ position: 2, songId: 200 }),
      entry({ position: 3, songId: 300 }),
    ];
    expect(diffLatestAgainstTrail(latest, trail, 3)).toEqual([]);
  });

  it("maps song name and setnumber onto the Suggestion", () => {
    const [first] = diffLatestAgainstTrail(
      [row({ song_id: 100, songname: "Rattlesnake", position: 1, setnumber: "2" })],
      [],
    );
    expect(first).toMatchObject({
      songId: 100,
      songName: "Rattlesnake",
      position: 1,
      setnumber: "2",
    });
  });
});

describe("resolvePlaceholders (D-04)", () => {
  const latest = [
    row({ song_id: 100, songname: "A", position: 1 }),
    row({ song_id: 200, songname: "B", position: 2 }),
  ];

  it("returns a FillHint only for an isPlaceholder entry aligned with a latest song", () => {
    const trail = [
      entry({ position: 1, songId: null, isPlaceholder: true }),
      entry({ position: 2, songId: 200, isPlaceholder: false }),
    ];
    const hints = resolvePlaceholders(latest, trail);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      position: 1,
      songId: 100,
      songName: "A",
      entryPosition: 1,
    });
  });

  it("returns [] when no placeholder positions align with a latest song", () => {
    const trail = [entry({ position: 9, songId: null, isPlaceholder: true })];
    expect(resolvePlaceholders(latest, trail)).toEqual([]);
  });

  it("never returns a hint for an already-named (non-placeholder) entry", () => {
    const trail = [entry({ position: 1, songId: 55, isPlaceholder: false })];
    expect(resolvePlaceholders(latest, trail)).toEqual([]);
  });

  it("resolves multiple aligned placeholders", () => {
    const trail = [
      entry({ position: 1, songId: null, isPlaceholder: true }),
      entry({ position: 2, songId: null, isPlaceholder: true }),
    ];
    const hints = resolvePlaceholders(latest, trail);
    expect(hints.map((h) => h.songId)).toEqual([100, 200]);
  });
});
