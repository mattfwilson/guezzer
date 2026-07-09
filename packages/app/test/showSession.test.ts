import { beforeEach, describe, expect, it } from "vitest";
import {
  db,
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
