import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { claimLegacyDexOnce } from "../src/auth/claimDex.ts";
import { db, getMeta } from "../src/db/db.ts";

/**
 * Verifies the additive Dexie version(7) migration + the first-login legacy-dex
 * claim (Plan 18-02). A populated version(6)-shape DB upgrades in place to
 * version(7), preserving every v1-v6 table (D-11 / SC-4 substrate): adding the
 * new `userId` index to existing tables re-indexes structurally with NO data
 * transform, so a pre-existing row reads back with `userId === undefined` until
 * the app-side claim stamps it (Pitfall 2 — the userId is unknown at DB-open).
 *
 * Isolation: `fake-indexeddb/auto` (setup.ts) — a fresh in-memory IDB per file.
 */

async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
}

/**
 * Seed a version(6)-shape database (all pre-18 tables, no `userId` index) with
 * one row in each of the five domain tables, then close it. The real schema is
 * reopened by the caller to exercise the version(7) upgrade in place.
 */
async function seedV6Db(): Promise<void> {
  const oldDb = new Dexie(config.DB_NAME);
  oldDb.version(1).stores({ meta: "&key", attendedShows: "&show_id, showDate" });
  oldDb.version(2).stores({
    trackedShows: "&sessionId, status, date",
    trackedEntries: "++id, sessionId, [sessionId+position]",
  });
  oldDb.version(3).stores({
    trackedShows: "&sessionId, status, date, showId",
    trackedEntries: "++id, sessionId, [sessionId+position], source",
  });
  oldDb.version(4).stores({ archiveShows: "&show_id" });
  oldDb.version(5).stores({ bingoCards: "&cardId, sessionId" });
  oldDb.version(6).stores({
    friendBeacons: "&memberId",
    mapPins: "&pinId, synced",
  });
  await oldDb.open();
  await oldDb.table("meta").put({ key: "persistStatus", value: "persisted" });
  await oldDb.table("attendedShows").put({ show_id: 999, showDate: "2026-01-01" });
  await oldDb.table("archiveShows").put({
    show_id: 1782000000,
    date: "2026-07-13",
    venueName: "Red Rocks",
    city: "Morrison",
    sets: [{ n: "1", songs: [{ songId: 42, songName: "Rattlesnake" }] }],
  });
  await oldDb.table("trackedShows").add({
    sessionId: "s1",
    date: "2026-01-01",
    status: "finalized",
    currentSetNumber: "2",
    startedAt: 111,
    showId: null,
    venueId: null,
    venueName: null,
    city: null,
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
    source: "manual",
    loggedAt: 222,
  });
  await oldDb.table("bingoCards").put({
    cardId: "s1",
    sessionId: "s1",
    card: {
      schemaVersion: 1,
      seed: "seed-1",
      vibe: "balanced",
      corpusVersion: "test-corpus",
      freeIndex: 12,
      squares: [],
    },
    caughtSnapshot: [],
    lockedAt: null,
    showDate: "2026-01-01",
    venueName: null,
    city: null,
  });
  oldDb.close();
}

describe("db version(7) additive namespacing (D-11 / SC-4)", () => {
  beforeEach(resetDb);
  afterEach(resetDb);

  it("upgrades a populated v6 DB to version(7) preserving every prior table", async () => {
    await seedV6Db();

    // Reopen through the real schema → the additive version(7) userId-index
    // block is applied; the DB opens at the max version (7).
    await db.open();
    expect(db.verno).toBe(7);

    // Every v1-v6 domain row survives the re-index (no destructive rewrite).
    expect(await getMeta("persistStatus")).toBe("persisted");
    expect(await db.attendedShows.get(999)).toEqual({
      show_id: 999,
      showDate: "2026-01-01",
    });
    expect(await db.archiveShows.get(1782000000)).toBeDefined();
    expect((await db.trackedShows.get("s1"))?.currentSetNumber).toBe("2");
    const entry = await db.trackedEntries.where("sessionId").equals("s1").first();
    expect(entry?.songName).toBe("Rattlesnake");
    expect(await db.bingoCards.get("s1")).toBeDefined();
  });

  it("reads a pre-existing row back with userId === undefined (unclaimed until the app-side stamp, Pitfall 2)", async () => {
    await seedV6Db();
    await db.open();

    const show = await db.trackedShows.get("s1");
    expect(show?.userId).toBeUndefined();
    const attended = await db.attendedShows.get(999);
    expect(attended?.userId).toBeUndefined();
  });
});

describe("claimLegacyDexOnce — meta-gated exactly-once legacy-row stamp (AUTH-05 / D-08)", () => {
  beforeEach(resetDb);
  afterEach(resetDb);

  it("stamps every untagged row across the 5 domain tables and sets the dexClaimedBy gate", async () => {
    await seedV6Db();
    await db.open();

    await claimLegacyDexOnce("user-A");

    expect((await db.attendedShows.get(999))?.userId).toBe("user-A");
    expect((await db.archiveShows.get(1782000000))?.userId).toBe("user-A");
    expect((await db.trackedShows.get("s1"))?.userId).toBe("user-A");
    const entry = await db.trackedEntries.where("sessionId").equals("s1").first();
    expect(entry?.userId).toBe("user-A");
    expect((await db.bingoCards.get("s1"))?.userId).toBe("user-A");

    expect(await getMeta("dexClaimedBy")).toBe("user-A");
  });

  it("a second claim with a different userId is a no-op — the first signer keeps the rows", async () => {
    await seedV6Db();
    await db.open();

    await claimLegacyDexOnce("user-A");
    await claimLegacyDexOnce("user-B");

    // The dexClaimedBy gate short-circuits the second claim: rows keep user-A.
    expect((await db.attendedShows.get(999))?.userId).toBe("user-A");
    expect((await db.trackedShows.get("s1"))?.userId).toBe("user-A");
    expect(await getMeta("dexClaimedBy")).toBe("user-A");
  });

  it("does not re-stamp a row that already carries a userId", async () => {
    await seedV6Db();
    await db.open();
    // A pre-tagged row (e.g. written by a future signed-in user) must survive
    // the claim untouched — the claim only fills undefined userIds.
    await db.attendedShows.put({
      show_id: 1000,
      showDate: "2026-02-02",
      userId: "user-Z",
    });

    await claimLegacyDexOnce("user-A");

    expect((await db.attendedShows.get(1000))?.userId).toBe("user-Z");
    expect((await db.attendedShows.get(999))?.userId).toBe("user-A");
  });
});
