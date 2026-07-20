import { describe, expect, it } from "vitest";
import latestSample from "../../../data/samples/latest.sample.json" with { type: "json" };
import type { LatestSetlistRow } from "../src/ingest/latest-types.ts";
import {
  diffLatestAgainstTrail,
  guardLatestRows,
  resolvePlaceholders,
  type TonightGuardInput,
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

describe("guardLatestRows — tonight/show guard (LIVE-01)", () => {
  it("bound show: keeps only rows whose show_id matches guard.showId, drops the rest (D-09)", () => {
    const rows = [
      row({ song_id: 100, show_id: 555, position: 1 }),
      row({ song_id: 200, show_id: 999, position: 2 }), // previous-night cached row
      row({ song_id: 300, show_id: 555, position: 3 }),
    ];
    const guard: TonightGuardInput = { showId: 555, date: "2026-08-14" };
    const kept = guardLatestRows(rows, guard);
    expect(kept.map((r) => r.song_id)).toEqual([100, 300]);
    expect(kept.every((r) => r.show_id === 555)).toBe(true);
  });

  it("bound show: a previous-night row (different show_id) is dropped even if its date matches", () => {
    const rows = [
      row({ song_id: 100, show_id: 555, showdate: "2026-08-14", position: 1 }),
      row({ song_id: 200, show_id: 888, showdate: "2026-08-14", position: 2 }),
    ];
    const kept = guardLatestRows(rows, { showId: 555, date: "2026-08-14" });
    expect(kept.map((r) => r.song_id)).toEqual([100]);
  });

  it("unbound show: keeps only rows whose showdate equals the show's OWN date, drops the rest", () => {
    const rows = [
      row({ song_id: 100, showdate: "2026-08-14", position: 1 }),
      row({ song_id: 200, showdate: "2026-08-13", position: 2 }), // yesterday's cached latest
      row({ song_id: 300, showdate: "2026-08-14", position: 3 }),
    ];
    const guard: TonightGuardInput = { showId: null, date: "2026-08-14" };
    const kept = guardLatestRows(rows, guard);
    expect(kept.map((r) => r.song_id)).toEqual([100, 300]);
  });

  it("past-midnight: a row whose showdate is the show's own date is retained (never wall-clock, D-10)", () => {
    // Wall-clock "today" has rolled to the 15th, but the show's stored date is
    // the 14th — the guard keys off the show's OWN date, so the row survives.
    const rows = [row({ song_id: 100, showdate: "2026-08-14", position: 1 })];
    const kept = guardLatestRows(rows, { showId: null, date: "2026-08-14" });
    expect(kept.map((r) => r.song_id)).toEqual([100]);
  });

  it("empty input → empty output, no throw", () => {
    expect(guardLatestRows([], { showId: 1, date: "2026-08-14" })).toEqual([]);
    expect(guardLatestRows([], { showId: null, date: "2026-08-14" })).toEqual([]);
  });

  it("does not sort — preserves input order of the kept rows", () => {
    const rows = [
      row({ song_id: 300, show_id: 555, position: 3 }),
      row({ song_id: 100, show_id: 555, position: 1 }),
      row({ song_id: 200, show_id: 555, position: 2 }),
    ];
    const kept = guardLatestRows(rows, { showId: 555, date: "2026-08-14" });
    expect(kept.map((r) => r.song_id)).toEqual([300, 100, 200]);
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

  // --- UX-03: position-gap / skipped-song / count-mismatch regression ---
  // Trail TrackedEntry.position is monotonic max+1 and GAPS on skipped/deleted
  // entries (db.ts), while editor LatestSetlistRow.position is contiguous 1,2,3.
  // The pre-fix raw `row.position === entry.position` matcher confidently names
  // an off-by-N song after the first divergence. These lock the interval-count-
  // match contract: correct bracketed hint, or nothing — never a wrong song.

  it("deleted mid-trail entry (trail positions 1,3,4): the placeholder resolves to the bracketed B, never the off-by-N same-position C (UX-03)", () => {
    const editor = [
      row({ song_id: 100, songname: "A", position: 1 }),
      row({ song_id: 200, songname: "B", position: 2 }),
      row({ song_id: 300, songname: "C", position: 3 }),
    ];
    // A logged @1, a placeholder @3 (the entry at position 2 was deleted), C
    // logged @4. Raw same-position matching names C (300) — the off-by-N bug.
    const trail = [
      entry({ position: 1, songId: 100, isPlaceholder: false }),
      entry({ position: 3, songId: null, isPlaceholder: true }),
      entry({ position: 4, songId: 300, isPlaceholder: false }),
    ];
    const hints = resolvePlaceholders(editor, trail);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      position: 2,
      songId: 200,
      songName: "B",
      entryPosition: 3,
    });
    expect(hints.map((h) => h.songId)).not.toContain(300);
  });

  it("skipped song: A(logged) ??(placeholder) C(logged) over editor A,B,C resolves the placeholder to B, not C (UX-03)", () => {
    const editor = [
      row({ song_id: 100, songname: "A", position: 1 }),
      row({ song_id: 200, songname: "B", position: 2 }),
      row({ song_id: 300, songname: "C", position: 3 }),
    ];
    // Positions gapped by earlier deletes: the placeholder sits at 4, past every
    // editor position — the raw matcher finds nothing; the bracket names B.
    const trail = [
      entry({ position: 1, songId: 100, isPlaceholder: false }),
      entry({ position: 4, songId: null, isPlaceholder: true }),
      entry({ position: 5, songId: 300, isPlaceholder: false }),
    ];
    const hints = resolvePlaceholders(editor, trail);
    expect(hints.map((h) => h.songId)).toEqual([200]);
    expect(hints.map((h) => h.songId)).not.toContain(300);
    expect(hints[0]).toMatchObject({ position: 2, songName: "B", entryPosition: 4 });
  });

  it("count mismatch: two editor rows bracket a single placeholder → SUPPRESS, no coin-flip (UX-03)", () => {
    const editor = [
      row({ song_id: 100, songname: "A", position: 1 }),
      row({ song_id: 200, songname: "B", position: 2 }),
      row({ song_id: 300, songname: "C", position: 3 }),
      row({ song_id: 400, songname: "D", position: 4 }),
    ];
    // One placeholder between anchors A and D, but the editor has TWO rows (B,C)
    // in that interval — ambiguous, so emit nothing rather than guess.
    const trail = [
      entry({ position: 1, songId: 100, isPlaceholder: false }),
      entry({ position: 3, songId: null, isPlaceholder: true }),
      entry({ position: 4, songId: 400, isPlaceholder: false }),
    ];
    expect(resolvePlaceholders(editor, trail)).toEqual([]);
  });

  it("a logged trail song absent from the editor suppresses (safe fallback) (UX-03)", () => {
    const editor = [
      row({ song_id: 100, songname: "A", position: 1 }),
      row({ song_id: 200, songname: "B", position: 2 }),
    ];
    // Z (999) is not in the editor at all → the interval can't be anchored.
    const trail = [
      entry({ position: 1, songId: 100, isPlaceholder: false }),
      entry({ position: 2, songId: null, isPlaceholder: true }),
      entry({ position: 3, songId: 999, isPlaceholder: false }),
    ];
    expect(resolvePlaceholders(editor, trail)).toEqual([]);
  });

  it("an out-of-order anchor (logged songs not an increasing editor subsequence) suppresses (UX-03)", () => {
    const editor = [
      row({ song_id: 100, songname: "A", position: 1 }),
      row({ song_id: 200, songname: "B", position: 2 }),
      row({ song_id: 300, songname: "C", position: 3 }),
    ];
    // The trail logs C before A — anchors map to editor indices [2, 0], which is
    // not strictly increasing → suppress rather than mis-bracket.
    const trail = [
      entry({ position: 1, songId: 300, isPlaceholder: false }),
      entry({ position: 2, songId: null, isPlaceholder: true }),
      entry({ position: 3, songId: 100, isPlaceholder: false }),
    ];
    expect(resolvePlaceholders(editor, trail)).toEqual([]);
  });

  it("a trailing placeholder with more tail editor rows than placeholders suppresses (UX-03)", () => {
    const editor = [
      row({ song_id: 100, songname: "A", position: 1 }),
      row({ song_id: 200, songname: "B", position: 2 }),
      row({ song_id: 300, songname: "C", position: 3 }),
    ];
    // One trailing placeholder after anchor A, but two editor rows (B,C) remain.
    const trail = [
      entry({ position: 1, songId: 100, isPlaceholder: false }),
      entry({ position: 2, songId: null, isPlaceholder: true }),
    ];
    expect(resolvePlaceholders(editor, trail)).toEqual([]);
  });

  it("regression: a contiguous gap-free [??, ??] over editor A,B still resolves to [100, 200]", () => {
    const editor = [
      row({ song_id: 100, songname: "A", position: 1 }),
      row({ song_id: 200, songname: "B", position: 2 }),
    ];
    const trail = [
      entry({ position: 1, songId: null, isPlaceholder: true }),
      entry({ position: 2, songId: null, isPlaceholder: true }),
    ];
    const hints = resolvePlaceholders(editor, trail);
    expect(hints.map((h) => h.songId)).toEqual([100, 200]);
    expect(hints.map((h) => h.entryPosition)).toEqual([1, 2]);
  });
});
