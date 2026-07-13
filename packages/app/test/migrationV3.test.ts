import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  adoptSuggestion,
  bindShow,
  db,
  getMeta,
  importSnapshot,
  startShow,
  type DbSnapshot,
  type TrackedShow,
} from "../src/db/db.ts";
import { classifyOutcome } from "../src/show/scoring.ts";

/**
 * Verifies the additive Dexie version(3) migration (Plan 05-03 Task 1):
 * v1/v2 data survives untouched, `source` backfills to "manual", the new
 * trackedShows binding columns default to null, and the three Phase-5 write
 * helpers (adoptSuggestion / bindShow / importSnapshot) behave per contract —
 * including the atomic rollback of a partial import (D-12/Pitfall 5).
 *
 * Isolation: `fake-indexeddb/auto` (setup.ts) is a fresh in-memory IDB per test
 * file. Each test deletes the DB and drives the real singleton `db` so the
 * assertions exercise the version(3) block in src/db/db.ts, not a copy.
 */

async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
}

describe("db version(3) additive migration", () => {
  beforeEach(resetDb);
  afterEach(resetDb);

  it("backfills source:'manual', preserves v1/v2 data, and defaults binding columns to null", async () => {
    // Seed a version(2)-shape database (no `source`, no binding columns).
    const oldDb = new Dexie(config.DB_NAME);
    oldDb
      .version(1)
      .stores({ meta: "&key", attendedShows: "&show_id, showDate" });
    oldDb.version(2).stores({
      trackedShows: "&sessionId, status, date",
      trackedEntries: "++id, sessionId, [sessionId+position]",
    });
    await oldDb.open();
    await oldDb.table("meta").put({ key: "persistStatus", value: "persisted" });
    await oldDb
      .table("attendedShows")
      .put({ show_id: 999, showDate: "2026-01-01" });
    await oldDb.table("trackedShows").add({
      sessionId: "s1",
      date: "2026-01-01",
      status: "finalized",
      currentSetNumber: "2",
      startedAt: 111,
      showId: null,
    });
    await oldDb.table("trackedEntries").add({
      sessionId: "s1",
      position: 1,
      songId: 10,
      songName: "Rattlesnake",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [10],
      isPlaceholder: false,
      loggedAt: 222,
    });
    oldDb.close();

    // Reopen through the real version(3) schema → the upgrade callback runs.
    await db.open();
    expect(db.verno).toBe(3);

    // Backfill: the pre-existing source-less entry now reads "manual".
    const entry = await db.trackedEntries.where("sessionId").equals("s1").first();
    expect(entry?.source).toBe("manual");
    // v2 entry values survive untouched.
    expect(entry?.songName).toBe("Rattlesnake");
    expect(entry?.outcome).toBe("hit");
    expect(entry?.setNumber).toBe("1");

    // v2 trackedShow survives; new binding columns default to null.
    const show = await db.trackedShows.get("s1");
    expect(show?.currentSetNumber).toBe("2");
    expect(show?.status).toBe("finalized");
    expect(show?.venueId).toBeNull();
    expect(show?.venueName).toBeNull();
    expect(show?.city).toBeNull();

    // v1 tables survive.
    expect(await getMeta("persistStatus")).toBe("persisted");
    expect(await db.attendedShows.get(999)).toEqual({
      show_id: 999,
      showDate: "2026-01-01",
    });
  });
});

describe("db version(3) write helpers", () => {
  beforeEach(async () => {
    await resetDb();
    await db.open(); // fresh, empty version(3) database
  });
  afterEach(resetDb);

  it("adoptSuggestion stamps source:'editor' and a hit outcome when the song is in the fan", async () => {
    const show = await startShow();
    const shownFan = [10, 20, 30];

    const id = await adoptSuggestion(show.sessionId, {
      songId: 20,
      songName: "Robot Stop",
      shownFanSongIds: shownFan,
    });

    const entry = await db.trackedEntries.get(id);
    expect(entry?.source).toBe("editor");
    expect(entry?.isPlaceholder).toBe(false);
    expect(entry?.outcome).toBe(classifyOutcome(20, shownFan));
    expect(entry?.outcome).toBe("hit");
    expect(entry?.position).toBe(1);
    expect(entry?.setNumber).toBe("1");
    expect(entry?.songName).toBe("Robot Stop");
  });

  it("adoptSuggestion classifies a miss when the song is not in the fan", async () => {
    const show = await startShow();

    const id = await adoptSuggestion(show.sessionId, {
      songId: 99,
      songName: "Deep-cut surprise",
      shownFanSongIds: [10, 20, 30],
    });

    const entry = await db.trackedEntries.get(id);
    expect(entry?.outcome).toBe("miss");
    expect(entry?.source).toBe("editor");
  });

  it("bindShow writes the binding columns and leaves status/date/set untouched", async () => {
    const show = await startShow();

    await bindShow(show.sessionId, {
      showId: 1234567890,
      venueId: 42,
      venueName: "Red Rocks Amphitheatre",
      city: "Morrison, CO",
    });

    const bound = await db.trackedShows.get(show.sessionId);
    expect(bound?.showId).toBe(1234567890);
    expect(bound?.venueId).toBe(42);
    expect(bound?.venueName).toBe("Red Rocks Amphitheatre");
    expect(bound?.city).toBe("Morrison, CO");
    // Untouched by the bind.
    expect(bound?.status).toBe("active");
    expect(bound?.date).toBe(show.date);
    expect(bound?.currentSetNumber).toBe("1");
  });

  it("importSnapshot commits all four tables in one transaction", async () => {
    await importSnapshot({
      meta: [{ key: "persistStatus", value: "best-effort" }],
      attendedShows: [{ show_id: 111, showDate: "2026-02-02" }],
      trackedShows: [
        {
          sessionId: "imp",
          date: "2026-02-02",
          status: "finalized",
          currentSetNumber: "e",
          startedAt: 5,
          showId: null,
          venueId: null,
          venueName: null,
          city: null,
        },
      ],
      trackedEntries: [
        {
          sessionId: "imp",
          position: 1,
          songId: 7,
          songName: "Gaia",
          setNumber: "1",
          outcome: "miss",
          shownFanSongIds: [],
          isPlaceholder: false,
          source: "manual",
          loggedAt: 6,
        },
      ],
    });

    expect(await getMeta("persistStatus")).toBe("best-effort");
    expect(await db.attendedShows.get(111)).toBeTruthy();
    expect(await db.trackedShows.get("imp")).toBeTruthy();
    const entries = await db.trackedEntries
      .where("sessionId")
      .equals("imp")
      .toArray();
    expect(entries).toHaveLength(1);
  });

  it("importSnapshot rolls the whole import back when a write throws mid-transaction", async () => {
    // A malformed snapshot: trackedEntries is not an array, so its bulkPut throws
    // AFTER the meta bulkPut has already been applied within the same
    // transaction. The atomic-write contract requires the meta write to roll back.
    const badSnapshot = {
      meta: [{ key: "fromBadImport", value: "should-not-persist" }],
      attendedShows: [],
      trackedShows: [],
      trackedEntries: null,
    } as unknown as DbSnapshot;

    await expect(importSnapshot(badSnapshot)).rejects.toBeTruthy();

    // Nothing from the failed import survived — atomic rollback (T-05-09).
    expect(await getMeta("fromBadImport")).toBeUndefined();
    expect(await db.meta.count()).toBe(0);
  });

  it("importSnapshot rolls back even when an invalid row lands mid-transaction", async () => {
    // A trackedShows row missing its inbound &sessionId primary key: meta and
    // attendedShows are written first, then this bulkPut rejects, aborting the tx.
    const badSnapshot = {
      meta: [{ key: "fromInvalidRow", value: "should-not-persist" }],
      attendedShows: [{ show_id: 222, showDate: "2026-03-03" }],
      trackedShows: [
        {
          date: "2026-03-03",
          status: "finalized",
          currentSetNumber: "1",
          startedAt: 1,
          showId: null,
          venueId: null,
          venueName: null,
          city: null,
        } as unknown as TrackedShow,
      ],
      trackedEntries: [],
    } satisfies DbSnapshot;

    await expect(importSnapshot(badSnapshot)).rejects.toBeTruthy();

    expect(await getMeta("fromInvalidRow")).toBeUndefined();
    expect(await db.attendedShows.get(222)).toBeUndefined();
    expect(await db.trackedShows.count()).toBe(0);
  });
});
