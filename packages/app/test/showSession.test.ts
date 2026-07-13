import { beforeEach, describe, expect, it } from "vitest";
import {
  db,
  deleteEntry,
  endShow,
  getActiveShow,
  logSong,
  markEncore,
  markSetBreak,
  renameEntry,
  startShow,
  undoLast,
  type TrackedEntry,
} from "../src/db/db.ts";
import { classifyOutcome } from "../src/show/scoring.ts";

/**
 * Helper: a minimal hit entry for a real catalog song. logSong stamps
 * position + setNumber (snapshot of the show's currentSetNumber), so the
 * caller only supplies the song identity + outcome + the shown fan.
 */
function hit(
  songId: number,
  songName: string,
  shownFanSongIds: number[] = [songId],
): Omit<TrackedEntry, "id" | "sessionId" | "position" | "setNumber"> {
  return {
    songId,
    songName,
    outcome: "hit",
    shownFanSongIds,
    isPlaceholder: false,
    loggedAt: Date.now(),
  };
}

describe("showSession: Dexie version(2) tracked-show lifecycle", () => {
  beforeEach(async () => {
    await db.trackedEntries.clear();
    await db.trackedShows.clear();
  });

  it("attendance: startShow writes a date-keyed active row (provisional DEX-01)", async () => {
    const show = await startShow();

    const stored = await db.trackedShows.get(show.sessionId);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe("active");
    expect(stored?.currentSetNumber).toBe("1");
    expect(stored?.showId).toBeNull();
    // date is an ISO YYYY-MM-DD stamp (D-01)
    expect(stored?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("write-through: logSong persists immediately with no explicit flush (SHOW-11)", async () => {
    const { sessionId } = await startShow();

    await logSong(sessionId, hit(101, "Rattlesnake"));

    const count = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .count();
    expect(count).toBe(1);

    const [entry] = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    expect(entry.songName).toBe("Rattlesnake");
    expect(entry.position).toBe(1);
    expect(entry.outcome).toBe("hit");
  });

  it("write-through: contiguous positions increment across logs", async () => {
    const { sessionId } = await startShow();

    await logSong(sessionId, hit(101, "Rattlesnake"));
    await logSong(sessionId, hit(102, "Honey"));
    await logSong(sessionId, hit(103, "Robot Stop"));

    const positions = (
      await db.trackedEntries.where("sessionId").equals(sessionId).sortBy("position")
    ).map((e) => e.position);
    expect(positions).toEqual([1, 2, 3]);
  });

  it("write-through: next position is derived from max position, not count — survives a mid-trail delete (CR-01)", async () => {
    // Regression for CR-01: logSong must derive the next position from the
    // CURRENT maximum position, never the row count. Deleting a non-last entry
    // (D-15) leaves a gap, so a count-based position would collide with an
    // existing one — corrupting ordering and the derived current song.
    const { sessionId } = await startShow();
    await logSong(sessionId, hit(101, "Rattlesnake")); // pos 1
    await logSong(sessionId, hit(102, "Honey")); // pos 2
    await logSong(sessionId, hit(103, "Robot Stop")); // pos 3
    await logSong(sessionId, hit(104, "The River")); // pos 4
    await logSong(sessionId, hit(105, "Nonagon")); // pos 5

    // Delete a NON-last entry (position 2). Remaining positions: [1,3,4,5].
    const before = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    const second = before.find((e) => e.position === 2);
    await deleteEntry(second?.id as number);

    // The next log must NOT reuse position 5 (count is now 4). It must be 6.
    await logSong(sessionId, hit(106, "Sense")); // must be pos 6, not 5

    const entries = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    const positions = entries.map((e) => e.position);

    // Positions are strictly increasing and unique (no collision).
    expect(positions).toEqual([1, 3, 4, 5, 6]);
    expect(new Set(positions).size).toBe(positions.length);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }

    // The derived "current song" (last real entry, useShowSession idiom) is the
    // TRUE last-logged song, not a mis-ordered collision.
    const currentSong = entries.filter((e) => e.songId != null).at(-1);
    expect(currentSong?.songName).toBe("Sense");
    expect(currentSong?.position).toBe(6);
  });

  it("restore: getActiveShow resumes exactly the one active show", async () => {
    const { sessionId } = await startShow();
    await logSong(sessionId, hit(101, "Rattlesnake"));

    const active = await getActiveShow();
    expect(active?.sessionId).toBe(sessionId);
    expect(active?.status).toBe("active");
  });

  it("restore: single-active invariant — startShow refuses while one is active (D-03)", async () => {
    await startShow();

    await expect(startShow()).rejects.toThrow();
  });

  it("restore: after endShow a new show can start (End Show required first, D-04)", async () => {
    const first = await startShow();
    await endShow(first.sessionId);

    const finalized = await db.trackedShows.get(first.sessionId);
    expect(finalized?.status).toBe("finalized");

    // Now a fresh show is allowed
    const second = await startShow();
    expect(second.sessionId).not.toBe(first.sessionId);
    const active = await getActiveShow();
    expect(active?.sessionId).toBe(second.sessionId);
  });

  it("set-structure: markSetBreak snapshots '2', markEncore snapshots 'e', grouping round-trips (SHOW-06)", async () => {
    const { sessionId } = await startShow();

    await logSong(sessionId, hit(101, "Rattlesnake")); // set 1
    await markSetBreak(sessionId);
    await logSong(sessionId, hit(102, "Honey")); // set 2
    await markEncore(sessionId);
    await logSong(sessionId, hit(103, "The River")); // encore

    const active = await getActiveShow();
    expect(active?.currentSetNumber).toBe("e");

    const entries = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    expect(entries.map((e) => e.setNumber)).toEqual(["1", "2", "e"]);

    // grouping by setNumber round-trips the kglw.net encoding
    const bySet = new Map<string, string[]>();
    for (const e of entries) {
      const g = bySet.get(e.setNumber) ?? [];
      g.push(e.songName);
      bySet.set(e.setNumber, g);
    }
    expect(bySet.get("1")).toEqual(["Rattlesnake"]);
    expect(bySet.get("2")).toEqual(["Honey"]);
    expect(bySet.get("e")).toEqual(["The River"]);
  });

  it("set-structure: markSetBreak/markEncore do NOT change status (D-04)", async () => {
    const { sessionId } = await startShow();
    await markSetBreak(sessionId);
    await markEncore(sessionId);

    const active = await getActiveShow();
    expect(active?.status).toBe("active");
  });

  it("set-structure: the ActionBar Set break→Encore flow snapshots setNumber onto later logs and never ends the show (04-06 wiring, D-04)", async () => {
    // Mirrors ShowView.handleSetBreak/handleEncore: the secondary-row taps only
    // shift the show's snapshotted set number — the very next logSong stamps it,
    // and the show stays active throughout (no auto-end, D-04).
    const { sessionId } = await startShow();

    await logSong(sessionId, hit(101, "Rattlesnake")); // set 1
    await markSetBreak(sessionId); // ActionBar Set break tap
    await logSong(sessionId, hit(102, "Honey")); // now snapshots "2"
    await markEncore(sessionId); // ActionBar Encore tap
    await logSong(sessionId, hit(103, "The River")); // now snapshots "e"

    const afterActions = await getActiveShow();
    expect(afterActions?.status).toBe("active"); // neither tap ended the show

    const entries = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    // An entry logged AFTER each action carries the expected set number.
    expect(entries.map((e) => e.setNumber)).toEqual(["1", "2", "e"]);
    const encoreEntry = entries.at(-1);
    expect(encoreEntry?.setNumber).toBe("e");
  });

  it("undo: removes the max-position entry in one call (SHOW-07/D-15)", async () => {
    const { sessionId } = await startShow();
    await logSong(sessionId, hit(101, "Rattlesnake"));
    await logSong(sessionId, hit(102, "Honey"));
    await logSong(sessionId, hit(103, "Robot Stop"));

    await undoLast(sessionId);

    const remaining = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    expect(remaining.map((e) => e.songName)).toEqual(["Rattlesnake", "Honey"]);
  });

  it("undo: the ActionBar Undo flow removes ONLY the most recent entry and leaves the show active (04-06 wiring, D-15)", async () => {
    // Mirrors ShowView.handleUndo: a single undoLast tap pops the newest entry
    // (the common "oops") — earlier entries and the show itself are untouched,
    // so the derived tally recomputes off the shortened trail.
    const { sessionId } = await startShow();
    await logSong(sessionId, hit(101, "Rattlesnake"));
    await logSong(sessionId, hit(102, "Honey"));

    await undoLast(sessionId); // ActionBar Undo tap — no dialog

    const remaining = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    expect(remaining.map((e) => e.songName)).toEqual(["Rattlesnake"]);
    expect(remaining.map((e) => e.position)).toEqual([1]);

    const active = await getActiveShow();
    expect(active?.status).toBe("active"); // undo never ends the show
  });

  it("restore: end-to-end resume rebuilds the exact active session from the same DB path (SHOW-11)", async () => {
    // Seed an active show + a trail, then simulate force-quit → relaunch by
    // re-querying via the SAME path useShowSession uses (getActiveShow →
    // entries by sessionId sorted by position). Exact resume, no loss (D-03).
    const { sessionId, date } = await startShow();
    await logSong(sessionId, hit(101, "Rattlesnake"));
    await logSong(sessionId, hit(102, "Honey", [102]));

    const active = await getActiveShow();
    expect(active?.sessionId).toBe(sessionId);
    expect(active?.date).toBe(date);
    expect(active?.status).toBe("active");

    const entries = active
      ? await db.trackedEntries
          .where("sessionId")
          .equals(active.sessionId)
          .sortBy("position")
      : [];
    expect(entries.map((e) => e.songName)).toEqual(["Rattlesnake", "Honey"]);
    expect(entries.map((e) => e.position)).toEqual([1, 2]);
  });

  it("write-through: a tapped orb logs outcome 'hit' at the next position (SHOW-03/D-06)", async () => {
    // Simulate ShowView.handleTapOrb: with a seeded current song and a shown
    // fan, tapping an orb in the fan classifies as a hit and write-throughs at
    // the next contiguous position (the recenter the live query then reflects).
    const { sessionId } = await startShow();
    await logSong(sessionId, hit(101, "Rattlesnake")); // the seeded current song

    const shownFanSongIds = [102, 103, 104, 105, 106];
    const tappedId = 103;
    const outcome = classifyOutcome(tappedId, shownFanSongIds);
    expect(outcome).toBe("hit");

    await logSong(sessionId, {
      songId: tappedId,
      songName: "Honey",
      outcome,
      shownFanSongIds,
      isPlaceholder: false,
      loggedAt: Date.now(),
    });

    const entries = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    expect(entries).toHaveLength(2);
    expect(entries[1].position).toBe(2);
    expect(entries[1].songId).toBe(tappedId);
    expect(entries[1].outcome).toBe("hit");
  });

  it("rename: patches a '???' placeholder to a real song (D-14/D-15)", async () => {
    const { sessionId } = await startShow();
    await logSong(sessionId, {
      songId: null,
      songName: "???",
      outcome: "miss",
      shownFanSongIds: [],
      isPlaceholder: true,
      loggedAt: Date.now(),
    });

    const [placeholder] = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    expect(placeholder.isPlaceholder).toBe(true);

    await renameEntry(placeholder.id as number, 205, "Work This Time");

    const renamed = await db.trackedEntries.get(placeholder.id as number);
    expect(renamed?.songId).toBe(205);
    expect(renamed?.songName).toBe("Work This Time");
    expect(renamed?.isPlaceholder).toBe(false);
  });
});
