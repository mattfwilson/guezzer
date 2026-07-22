import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BingoCard } from "@guezzer/core";
import { config } from "../src/config.ts";
import {
  db,
  getMeta,
  importSnapshot,
  snapshot,
  type BingoCardRow,
  type DbSnapshot,
} from "../src/db/db.ts";

/**
 * Verifies the additive Dexie version(5) migration + the `bingoCards`
 * export/import threading (Plan 15-02 Task 2). A populated v4 DB upgrades in
 * place to version(5) preserving every v1-v4 table (D-14 / SC-4, T-15-04); the
 * new `bingoCards` table rides the snapshot and imports via a stable-`cardId`
 * `bulkPut` union-only upsert (D-13, T-15-05).
 *
 * Isolation: `fake-indexeddb/auto` (setup.ts) — a fresh in-memory IDB per file.
 */

async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
}

function makeCard(seed = "seed-1"): BingoCard {
  const squares = Array.from({ length: 16 }, (_, i) =>
    i === 12
      ? ({ kind: "free" } as const)
      : ({ kind: "song", songId: i + 1, label: `Song ${i + 1}` } as const),
  );
  return {
    schemaVersion: 1,
    seed,
    vibe: "balanced",
    corpusVersion: "test-corpus",
    freeIndex: 12,
    squares,
  };
}

function makeRow(cardId: string, seed: string): BingoCardRow {
  return {
    cardId,
    sessionId: cardId,
    card: makeCard(seed),
    caughtSnapshot: [],
    lockedAt: null,
    showDate: "2026-08-15",
    venueName: null,
    city: null,
  };
}

describe("db version(5) additive migration (D-14 / SC-4)", () => {
  beforeEach(resetDb);
  afterEach(resetDb);

  it("upgrades a populated v4 DB to version(5) preserving all prior tables; bingoCards is present and empty", async () => {
    // Seed a version(4)-shape database (Phase 6 archiveShows, no bingoCards).
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
    oldDb.close();

    // Reopen through the real schema → the additive version(5) bingoCards table
    // and version(6) GizzMap tables are both applied; the DB opens at the max
    // version (6).
    await db.open();
    expect(db.verno).toBe(6);

    // The new table exists and is empty.
    expect(await db.bingoCards.count()).toBe(0);

    // Every v1-v4 table retains its rows.
    expect(await getMeta("persistStatus")).toBe("persisted");
    expect(await db.attendedShows.get(999)).toEqual({
      show_id: 999,
      showDate: "2026-01-01",
    });
    expect(await db.archiveShows.get(1782000000)).toBeDefined();
    expect((await db.trackedShows.get("s1"))?.currentSetNumber).toBe("2");
    const entry = await db.trackedEntries.where("sessionId").equals("s1").first();
    expect(entry?.songName).toBe("Rattlesnake");
  });
});

describe("db version(5) bingoCards export/import threading (D-13)", () => {
  beforeEach(async () => {
    await resetDb();
    await db.open();
  });
  afterEach(resetDb);

  it("snapshot() includes bingoCards as an array", async () => {
    await db.bingoCards.put(makeRow("card-a", "seed-a"));
    const snap = await snapshot();
    expect(Array.isArray(snap.bingoCards)).toBe(true);
    expect(snap.bingoCards).toHaveLength(1);
    expect(snap.bingoCards[0].cardId).toBe("card-a");
  });

  it("importSnapshot upserts bingoCards union-only: a local card absent from the snapshot is NOT deleted, a same-cardId row is overwritten", async () => {
    // Local rows: card-local (only local) + card-shared (draft).
    await db.bingoCards.put(makeRow("card-local", "local-seed"));
    await db.bingoCards.put(makeRow("card-shared", "old-seed"));

    // Import a snapshot that carries ONLY card-shared (with a new seed) — it
    // must overwrite card-shared but never delete the absent card-local.
    const incomingShared = makeRow("card-shared", "new-seed");
    const snap: DbSnapshot = {
      owner: null,
      meta: [],
      attendedShows: [],
      archiveShows: [],
      trackedShows: [],
      trackedEntries: [],
      bingoCards: [incomingShared],
    };
    await importSnapshot(snap);

    // Union-only: card-local survives (bulkPut, not clear+rewrite).
    expect(await db.bingoCards.count()).toBe(2);
    expect((await db.bingoCards.get("card-local"))?.card.seed).toBe("local-seed");
    // Same-cardId row overwritten by the incoming snapshot.
    expect((await db.bingoCards.get("card-shared"))?.card.seed).toBe("new-seed");
  });
});
