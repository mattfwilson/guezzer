import { describe, expect, it } from "vitest";
import type { ArchiveArtifact } from "../../src/dex/archive-types.ts";
import { buildRarityIndex } from "../../src/dex/rarity.ts";
import { deriveDex } from "../../src/dex/derive-dex.ts";
import {
  archiveShow,
  attendedShow,
  dexSnapshot,
  syntheticAlbums,
  syntheticArchive,
  trackedEntry,
  trackedShow,
} from "../fixtures/dex/synthetic.ts";

/**
 * Base archive — catalog {10,20,30,40,50,60} (6 songs, the completion
 * denominator). Setlists:
 *   show 100 (2020-01-01): 10,20,30
 *   show 200 (2020-02-01): 10,40 | e:50
 *   show 300 (2020-03-01): 20,60
 * playCounts → 10:2 20:2 30:1 40:1 50:1 60:1 over 3 shows.
 */
function baseArchive(): ArchiveArtifact {
  return syntheticArchive([
    archiveShow({ id: 100, date: "2020-01-01", sets: [{ n: "1", songs: [10, 20, 30] }] }),
    archiveShow({
      id: 200,
      date: "2020-02-01",
      sets: [
        { n: "1", songs: [10, 40] },
        { n: "e", songs: [50] },
      ],
    }),
    archiveShow({ id: 300, date: "2020-03-01", sets: [{ n: "1", songs: [20, 60] }] }),
  ]);
}

const archive = baseArchive();
const rarity = buildRarityIndex(archive);
const albums = syntheticAlbums();

function run(snapshot: Parameters<typeof deriveDex>[0]) {
  return deriveDex(snapshot, archive, albums, rarity);
}

describe("deriveDex — single derivation entry point (DEX-03/04, STAT-03/04)", () => {
  it("credits a retro-marked show its FULL archive setlist (D-11)", () => {
    const stats = run(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));

    expect(stats.showCount).toBe(1);
    expect(stats.completion).toEqual({ caught: 3, total: 6, pct: 50 });
    expect([...stats.perSong.keys()].sort((a, b) => a - b)).toEqual([10, 20, 30]);
    expect(stats.neverSeen).toEqual([40, 50, 60]);
    expect(stats.perSong.get(10)?.sightings).toBe(1);
  });

  it("credits a tracked-only show its non-placeholder entries, ignoring '???'", () => {
    const stats = run(
      dexSnapshot({
        trackedShows: [trackedShow({ sessionId: "s1", date: "2020-05-01" })],
        trackedEntries: [
          trackedEntry({ sessionId: "s1", songId: 10, position: 1 }),
          trackedEntry({ sessionId: "s1", songId: 20, position: 2 }),
          trackedEntry({ sessionId: "s1", songId: null, songName: "???", isPlaceholder: true, outcome: "miss", position: 3 }),
        ],
      }),
    );

    expect(stats.showCount).toBe(1);
    expect(stats.completion.caught).toBe(2);
    expect([...stats.perSong.keys()].sort((a, b) => a - b)).toEqual([10, 20]);
    expect(stats.neverSeen).toEqual([30, 40, 50, 60]);
  });

  it("dedupes a night tracked AND retro-marked (same show_id) — ONE attendance, UNION sightings (A7)", () => {
    const stats = run(
      dexSnapshot({
        attendedShows: [attendedShow({ show_id: 200, showDate: "2020-02-01" })],
        trackedShows: [trackedShow({ sessionId: "s2", date: "2020-02-01", showId: 200 })],
        // tracked a song (30) NOT in show 200's archive setlist → proves union.
        trackedEntries: [trackedEntry({ sessionId: "s2", songId: 30, songName: "Song 30", position: 1 })],
      }),
    );

    expect(stats.showCount).toBe(1); // deduped by show_id
    // union of archive {10,40,50} and tracked {30}
    expect([...stats.perSong.keys()].sort((a, b) => a - b)).toEqual([10, 30, 40, 50]);
    expect(stats.completion.caught).toBe(4);
  });

  // SAFE-04 / D-01 INTENTIONAL INVERSION (was "dedupes two unbound tracked
  // nights on the same date — ONE attendance"). Two DISTINCT unbound tracked
  // nights on the same date are a genuine doubleheader and must derive
  // showCount === 2 — the dex must never silently lose a caught show. A
  // plan-checker MUST NOT restore the old showCount === 1 collapse assertion.
  it("keeps two unbound same-date tracked nights as TWO attendances (D-01 showCount === 2)", () => {
    const stats = run(
      dexSnapshot({
        trackedShows: [
          trackedShow({ sessionId: "s3", date: "2020-07-01", showId: null }),
          trackedShow({ sessionId: "s4", date: "2020-07-01", showId: null }),
        ],
        trackedEntries: [
          trackedEntry({ sessionId: "s3", songId: 10, position: 1 }),
          trackedEntry({ sessionId: "s4", songId: 20, position: 1 }),
        ],
      }),
    );

    // Two distinct unbound sessions → two attendance groups.
    expect(stats.showCount).toBe(2);
    // D-03 join-safety: each unbound night still resolves its OWN tracked
    // sightings (drawn from trackedEntries, never dropped by the split) — song
    // 10 seen once on s3's night, song 20 once on s4's night.
    expect([...stats.perSong.keys()].sort((a, b) => a - b)).toEqual([10, 20]);
    expect(stats.perSong.get(10)?.sightings).toBe(1);
    expect(stats.perSong.get(20)?.sightings).toBe(1);
  });

  it("computes personalGap as your deduped shows strictly after the last sighting (STAT-03)", () => {
    const stats = run(
      dexSnapshot({
        attendedShows: [
          attendedShow({ show_id: 100, showDate: "2020-01-01" }), // {10,20,30}
          attendedShow({ show_id: 300, showDate: "2020-03-01" }), // {20,60}
        ],
        trackedShows: [trackedShow({ sessionId: "s5", date: "2020-05-01", showId: null })],
        trackedEntries: [trackedEntry({ sessionId: "s5", songId: 40, position: 1 })],
      }),
    );

    // 3 deduped shows in date order: g0=100, g1=300, g2=(2020-05-01)
    expect(stats.showCount).toBe(3);
    expect(stats.perSong.get(10)?.personalGap).toBe(2); // last seen g0
    expect(stats.perSong.get(20)?.personalGap).toBe(1); // last seen g1
    expect(stats.perSong.get(20)?.sightings).toBe(2); // g0 + g1
    expect(stats.perSong.get(60)?.personalGap).toBe(1); // last seen g1
    expect(stats.perSong.get(40)?.personalGap).toBe(0); // last seen g2 (most recent)
    expect(stats.perSong.get(10)?.lastSeenDate).toBe("2020-01-01");
  });

  it("yields zero counts + full neverSeen on an empty snapshot (no NaN, no divide-by-zero)", () => {
    const stats = run(dexSnapshot());

    expect(stats.showCount).toBe(0);
    expect(stats.completion).toEqual({ caught: 0, total: 6, pct: 0 });
    expect(stats.neverSeen).toEqual([10, 20, 30, 40, 50, 60]);
    expect(stats.perSong.size).toBe(0);
    expect(stats.rarestCatch).toBeNull();
  });

  it("excludes sentinel song ids from sightings", () => {
    const stats = run(
      dexSnapshot({
        trackedShows: [trackedShow({ sessionId: "s6", date: "2020-08-01" })],
        trackedEntries: [
          trackedEntry({ sessionId: "s6", songId: 1, songName: "Unknown", position: 1 }),
          trackedEntry({ sessionId: "s6", songId: 10, position: 2 }),
        ],
      }),
    );

    expect(stats.perSong.has(1)).toBe(false);
    expect(stats.completion.caught).toBe(1);
  });

  it("keeps debut candidates out of the denominator, neverSeen, and per-album totals (STAT-04)", () => {
    const stats = run(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));

    // Album alpha has tracks 10, 20 (inMatrix) + one debut candidate (inMatrix:false).
    expect(stats.completion.total).toBe(6); // catalog only, no debut candidate
    expect(stats.neverSeen).not.toContain(null);
    const alpha = stats.perAlbum.get("/albums/alpha");
    expect(alpha).toEqual({ caught: 2, total: 2 }); // both 10,20 caught; debut uncounted
  });

  it("picks rarestCatch as the caught song with the lowest corpus play rate", () => {
    const stats = run(dexSnapshot({ attendedShows: [attendedShow({ show_id: 100, showDate: "2020-01-01" })] }));
    // caught {10,20,30}; playCounts 2,2,1 → 30 is rarest.
    expect(stats.rarestCatch?.songId).toBe(30);
    expect(stats.rarestCatch?.tier).toBeTypeOf("string");
  });

  it("resolves a post-corpus attended show from the snapshot archiveShows cache (Pitfall 5)", () => {
    const stats = run(
      dexSnapshot({
        attendedShows: [attendedShow({ show_id: 999, showDate: "2025-12-20" })],
        archiveShows: [
          {
            show_id: 999,
            date: "2025-12-20",
            sets: [
              {
                n: "1",
                songs: [
                  { songId: 10, songName: "Song 10" },
                  { songId: 60, songName: "Song 60" },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(stats.showCount).toBe(1);
    expect([...stats.perSong.keys()].sort((a, b) => a - b)).toEqual([10, 60]);
  });
});
