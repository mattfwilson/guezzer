import { beforeEach, describe, expect, it } from "vitest";
import {
  bindShowFromLatest,
  diffLatestAgainstTrail,
  guardLatestRows,
  resolvePlaceholders,
  type LatestSetlistRow,
} from "@guezzer/core";
import {
  adoptSuggestion,
  bindShow,
  db,
  logSong,
  startShow,
  type TrackedEntry,
} from "../src/db/db.ts";

/**
 * The live-sync adopt/bind write path wired into ShowView (plan 05-04 Task 3).
 * Exercises the exact integration the UI depends on against the real Dexie
 * helpers (fake-indexeddb) + the pure core diff/bind decision fns:
 *   - adoptSuggestion persists source:"editor" with the honest hit/miss the
 *     shown fan implies (T-05-10) — an editor-adopted entry is indistinguishable
 *     in the tally math from a manual one.
 *   - an adopted song drops out of the derived suggestions (deduped, D-02).
 *   - the D-07 auto-bind guard binds only an unbound show on a date match.
 */

/** Minimal latest-row fixture — only the fields the diff/binder consume. */
function latestRow(overrides: Partial<LatestSetlistRow>): LatestSetlistRow {
  return {
    show_id: 555,
    showdate: "2026-07-13",
    song_id: 101,
    songname: "Rattlesnake",
    artist_id: 1,
    position: 1,
    setnumber: "1",
    settype: "set",
    venue_id: 42,
    venuename: "Red Rocks",
    city: "Morrison",
    ...overrides,
  } as LatestSetlistRow;
}

function trail(sessionId: string): Promise<TrackedEntry[]> {
  return db.trackedEntries.where("sessionId").equals(sessionId).sortBy("position");
}

describe("live-sync adopt + bind wiring (SYNC-02 / D-02 / D-07)", () => {
  beforeEach(async () => {
    await db.trackedEntries.clear();
    await db.trackedShows.clear();
  });

  it("adopt: persists source:'editor' with a hit when the song was in the shown fan (T-05-10)", async () => {
    const { sessionId } = await startShow();
    // Seed an opener so there is a current song + a shown fan on screen.
    await logSong(sessionId, {
      songId: 100,
      songName: "Robot Stop",
      outcome: "miss",
      shownFanSongIds: [],
      isPlaceholder: false,
      loggedAt: Date.now(),
    });

    const shownFanSongIds = [101, 102, 103, 104, 105];
    await adoptSuggestion(sessionId, {
      songId: 101,
      songName: "Rattlesnake",
      shownFanSongIds,
    });

    const entries = await trail(sessionId);
    const adopted = entries.at(-1);
    expect(adopted?.source).toBe("editor");
    expect(adopted?.songId).toBe(101);
    expect(adopted?.songName).toBe("Rattlesnake");
    // 101 IS in the shown fan → an honest hit (same rule as a manual log).
    expect(adopted?.outcome).toBe("hit");
    expect(adopted?.isPlaceholder).toBe(false);
    // Positioned monotonically after the opener.
    expect(adopted?.position).toBe(2);
  });

  it("adopt: persists a miss when the song was NOT in the shown fan (honest tally)", async () => {
    const { sessionId } = await startShow();
    await adoptSuggestion(sessionId, {
      songId: 909,
      songName: "The River",
      shownFanSongIds: [101, 102], // 909 absent → miss
    });

    const adopted = (await trail(sessionId)).at(-1);
    expect(adopted?.source).toBe("editor");
    expect(adopted?.outcome).toBe("miss");
  });

  it("adopt: an adopted song drops out of the derived suggestions (deduped, D-02)", async () => {
    const { sessionId } = await startShow();

    const latestRows = [
      latestRow({ song_id: 101, songname: "Rattlesnake", position: 1 }),
      latestRow({ song_id: 102, songname: "Honey", position: 2 }),
    ];

    // Before adopting: 101 is the next un-logged editor song.
    const before = diffLatestAgainstTrail(latestRows, await trail(sessionId), 2);
    expect(before.map((s) => s.songId)).toContain(101);

    await adoptSuggestion(sessionId, {
      songId: 101,
      songName: "Rattlesnake",
      shownFanSongIds: [101],
    });

    // After adopting: 101 is logged → the diff no longer suggests it (D-02).
    const after = diffLatestAgainstTrail(latestRows, await trail(sessionId), 2);
    expect(after.map((s) => s.songId)).not.toContain(101);
    expect(after.map((s) => s.songId)).toContain(102);
  });

  it("guard: a previous-night cached latest row cannot leak into tonight's suggestions or fill-hints (LIVE-01)", async () => {
    const { sessionId } = await startShow();
    const showDate = "2026-07-14";
    // Tonight's editor row (matches the show's OWN date) + a stale row still
    // cached from a previous show under a different show_id/showdate (the D-09
    // night-2-of-a-run leak this guard exists to stop).
    const tonightRow = latestRow({
      show_id: 555,
      showdate: showDate,
      song_id: 101,
      songname: "Rattlesnake",
      position: 1,
    });
    const staleRow = latestRow({
      show_id: 554,
      showdate: "2026-07-13",
      song_id: 999,
      songname: "Yesterday's Closer",
      position: 2,
    });

    // ShowView's single ingress guard: unbound show (showId null) → keep only
    // rows on the show's own date, applied ONCE before every consumer.
    const guarded = guardLatestRows([tonightRow, staleRow], {
      showId: null,
      date: showDate,
    });
    expect(guarded.map((r) => r.song_id)).toEqual([101]);

    // Suggestions derive from the guarded rows → the stale song is never offered.
    const suggestions = diffLatestAgainstTrail(guarded, await trail(sessionId), 5);
    expect(suggestions.map((s) => s.songId)).toContain(101);
    expect(suggestions.map((s) => s.songId)).not.toContain(999);

    // Fill-hints read the SAME guarded rows → no stale position-2 hint either.
    const hints = resolvePlaceholders(guarded, await trail(sessionId));
    expect(hints.map((h) => h.songId)).not.toContain(999);
  });

  it("bind: auto-binds an unbound show only when latest's date matches (D-07)", async () => {
    const show = await startShow();
    expect(show.showId).toBeNull(); // provisional

    const todaysLatest = [latestRow({ showdate: show.date })];
    const binding = bindShowFromLatest(todaysLatest, show, show.date);
    expect(binding).not.toBeNull();

    if (binding) await bindShow(show.sessionId, binding);
    const bound = await db.trackedShows.get(show.sessionId);
    expect(bound?.showId).toBe(555);
    expect(bound?.venueId).toBe(42);
    expect(bound?.venueName).toBe("Red Rocks");
    expect(bound?.city).toBe("Morrison");
    // Binding is silent/non-destructive — status/date untouched.
    expect(bound?.status).toBe("active");
    expect(bound?.date).toBe(show.date);
  });

  it("bind: NEVER binds on a date mismatch or an already-bound show (D-07 guard)", async () => {
    const show = await startShow();

    // Date mismatch (wrong-show guard — a prior night still cached, SCHEMA §9).
    expect(
      bindShowFromLatest([latestRow({ showdate: "1999-01-01" })], show, show.date),
    ).toBeNull();

    // Already bound → never overwrite.
    const alreadyBound = { showId: 777 };
    expect(
      bindShowFromLatest([latestRow({ showdate: show.date })], alreadyBound, show.date),
    ).toBeNull();

    // Empty latest → nothing to bind to.
    expect(bindShowFromLatest([], show, show.date)).toBeNull();
  });
});
