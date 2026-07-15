import { describe, expect, it } from "vitest";
import type { ArchiveArtifact } from "../../src/dex/archive-types.ts";
import { buildRarityIndex } from "../../src/dex/rarity.ts";
import { deriveRecap } from "../../src/dex/recap.ts";
import {
  archiveShow,
  attendedShow,
  dexSnapshot,
  syntheticAlbums,
  syntheticArchive,
  trackedEntry,
  trackedShow,
  type FixtureTrackedEntry,
} from "../fixtures/dex/synthetic.ts";

/**
 * Recap archive — catalog {10,20,30,40,50,60}. show 100 setlist {10,20,30,40}
 * is the "prior attendance" the new-catch detector diffs against.
 */
function recapArchive(): ArchiveArtifact {
  return syntheticArchive([
    archiveShow({ id: 100, date: "2020-01-01", sets: [{ n: "1", songs: [10, 20, 30, 40] }] }),
    archiveShow({ id: 200, date: "2020-02-01", sets: [{ n: "1", songs: [50, 60] }] }),
  ]);
}

const archive = recapArchive();
const rarity = buildRarityIndex(archive);
const albums = syntheticAlbums();

/** The 6-entry night: 2 sets + encore, 1 placeholder, mixed manual/editor. */
function nightEntries(): FixtureTrackedEntry[] {
  return [
    trackedEntry({ sessionId: "night", songId: 10, songName: "Song 10", setNumber: "1", outcome: "hit", source: "manual", position: 1 }),
    trackedEntry({ sessionId: "night", songId: 20, songName: "Song 20", setNumber: "1", outcome: "miss", source: "editor", position: 2 }),
    trackedEntry({ sessionId: "night", songId: null, songName: "???", setNumber: "1", outcome: "miss", source: "manual", isPlaceholder: true, position: 3 }),
    trackedEntry({ sessionId: "night", songId: 30, songName: "Song 30", setNumber: "2", outcome: "hit", source: "manual", position: 4 }),
    trackedEntry({ sessionId: "night", songId: 40, songName: "Song 40", setNumber: "2", outcome: "hit", source: "editor", position: 5 }),
    trackedEntry({ sessionId: "night", songId: 50, songName: "Song 50", setNumber: "e", outcome: "hit", source: "manual", position: 6 }),
  ];
}

function nightSnapshot() {
  return dexSnapshot({
    attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })],
    trackedShows: [trackedShow({ sessionId: "night", date: "2020-09-01", showId: null })],
    trackedEntries: nightEntries(),
  });
}

describe("deriveRecap — the night's scorecard (SHOW-14, STAT-02, D-14)", () => {
  const recap = deriveRecap("night", nightSnapshot(), archive, albums, rarity);

  it("pins the hit/miss tally (deriveTally semantics: every entry counts)", () => {
    expect(recap.tally).toEqual({ hits: 4, total: 6, pct: 67 });
  });

  it("decomposes the manual-vs-editor source split (Phase-5 tags)", () => {
    expect(recap.sourceSplit).toEqual({ manualHits: 3, manualTotal: 4, editorHits: 1 });
  });

  it("flags first-ever songs as new catches (+N), excluding placeholders", () => {
    // Songs 10,20,30,40 were seen at prior show 100; only 50 is first-ever.
    expect(recap.newCatches).toEqual({ count: 1, songIds: [50] });
  });

  it("scores the night's rarity + rarest-of-night over non-placeholder songs", () => {
    // corpusGaps: 10,20,30,40 → 1 each; 50 → 0. avg = 0.8.
    expect(recap.rarity.score).toBe(0.8);
    expect(recap.rarity.rarestOfNight?.songId).toBe(10);
    expect(recap.rarity.rarestOfNight?.tier).toBeTypeOf("string");
  });

  it("groups the setlist by set in position order, keeping the placeholder row", () => {
    expect(recap.setlist.map((s) => s.n)).toEqual(["1", "2", "e"]);

    const set1 = recap.setlist[0];
    expect(set1.rows.map((r) => r.songName)).toEqual(["Song 10", "Song 20", "???"]);
    expect(set1.rows[2].isPlaceholder).toBe(true);
    expect(set1.rows[2].songId).toBeNull();
    expect(set1.rows[2].tier).toBeNull();

    const encore = recap.setlist[2];
    expect(encore.n).toBe("e");
    expect(encore.rows[0].songId).toBe(50);
    expect(encore.rows[0].outcome).toBe("hit");
  });

  it("returns empty newCatches when every song was seen at a prior show", () => {
    const snapshot = dexSnapshot({
      attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })], // {10,20,30,40}
      trackedShows: [trackedShow({ sessionId: "n2", date: "2020-10-01", showId: null })],
      trackedEntries: [
        trackedEntry({ sessionId: "n2", songId: 10, songName: "Song 10", setNumber: "1", outcome: "hit", position: 1 }),
        trackedEntry({ sessionId: "n2", songId: 20, songName: "Song 20", setNumber: "1", outcome: "miss", position: 2 }),
      ],
    });
    const r = deriveRecap("n2", snapshot, archive, albums, rarity);
    expect(r.newCatches).toEqual({ count: 0, songIds: [] });
  });

  it("tally matches a hand-run of the deriveTally rules", () => {
    const entries = nightEntries();
    const expectedTotal = entries.length;
    const expectedHits = entries.filter((e) => e.outcome === "hit").length;
    const expectedPct = Math.round((100 * expectedHits) / expectedTotal);
    expect(recap.tally).toEqual({ hits: expectedHits, total: expectedTotal, pct: expectedPct });
  });
});
