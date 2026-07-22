import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BingoCard } from "@guezzer/core";
import {
  adoptSuggestion,
  db,
  logSong,
  markShowAttended,
  saveDraftCard,
  snapshot,
  startShow,
} from "../src/db/db.ts";
import { claimLegacyDexOnce } from "../src/auth/claimDex.ts";
import {
  clearIdentityRecord,
  writeIdentityRecord,
} from "../src/auth/identityRecord.ts";

/**
 * AUTH-05 write-half (Plan 18-07 Task 3, D-08/D-09/D-11 — THE BLOCKER FIX). Every
 * create path stamps the signed-in identity's userId via Dexie creating/updating
 * hooks in db.ts, with NO change to any write-helper signature. This proves the
 * regression the seeded-userId isolation tests miss: rows created through the
 * REAL helpers (not direct stamped inserts) carry the current identity, so the
 * signed-in user's OWN post-claim shows/entries/attended-marks/bingo appear in
 * their scoped reads and backups — and the load-bearing `.put`-replace paths
 * (`markShowAttended` re-mark, `saveDraftCard` reshuffle) re-stamp on overwrite
 * rather than self-erasing the owner's row. Runs under jsdom + fake-indexeddb.
 */

const USER_A = "user-A";
const USER_B = "user-B";

/** A valid pure core card (16 squares, one free at index 12). */
function makeCard(seed: string): BingoCard {
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

async function clearAll() {
  await db.meta.clear();
  await db.attendedShows.clear();
  await db.archiveShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
  await db.bingoCards.clear();
}

beforeEach(async () => {
  await clearAll();
  clearIdentityRecord();
});
afterEach(async () => {
  await clearAll();
  clearIdentityRecord();
});

describe("AUTH-05 write-half: create paths stamp the signed-in userId (D-08/D-09)", () => {
  it("CREATING: markShowAttended / startShow / logSong stamp user-A and appear in snapshot('user-A')", async () => {
    writeIdentityRecord({ userId: USER_A, displayName: "A" });

    const show = await startShow(); // trackedShows.add
    expect((await db.trackedShows.get(show.sessionId))?.userId).toBe(USER_A);

    await logSong(show.sessionId, {
      songId: 1,
      songName: "Rattlesnake",
      outcome: "hit",
      shownFanSongIds: [1],
      isPlaceholder: false,
      loggedAt: 10,
    }); // trackedEntries.add
    const entry = await db.trackedEntries
      .where("sessionId")
      .equals(show.sessionId)
      .first();
    expect(entry?.userId).toBe(USER_A);

    await markShowAttended({ show_id: 555, showDate: "2026-08-01" }); // attendedShows.put
    expect((await db.attendedShows.get(555))?.userId).toBe(USER_A);

    // The signed-in user's own activity is in their scoped backup.
    const snap = await snapshot(USER_A);
    expect(snap.attendedShows.some((r) => r.show_id === 555)).toBe(true);
    expect(snap.trackedShows.some((s) => s.sessionId === show.sessionId)).toBe(true);
    expect(snap.trackedEntries.some((e) => e.songId === 1)).toBe(true);
  });

  it("CREATING (all-tables sample): saveDraftCard (create) and adoptSuggestion stamp user-A", async () => {
    writeIdentityRecord({ userId: USER_A, displayName: "A" });

    // A fresh bingo card create → bingoCards.put stamps user-A.
    await saveDraftCard({
      sessionId: "card-sess",
      card: makeCard("seed-1"),
      showDate: "2026-08-01",
      venueName: null,
      city: null,
    });
    expect((await db.bingoCards.get("card-sess"))?.userId).toBe(USER_A);

    // adoptSuggestion → trackedEntries.add stamps user-A (needs an active show).
    const show = await startShow();
    await adoptSuggestion(show.sessionId, {
      songId: 42,
      songName: "The River",
      shownFanSongIds: [42],
    });
    const adopted = await db.trackedEntries
      .where("sessionId")
      .equals(show.sessionId)
      .first();
    expect(adopted?.userId).toBe(USER_A);
    expect(adopted?.source).toBe("editor");
  });

  it("UPDATING re-stamp: markShowAttended re-mark does NOT drop userId on the .put overwrite", async () => {
    writeIdentityRecord({ userId: USER_A, displayName: "A" });

    await markShowAttended({ show_id: 777, showDate: "2026-08-02" });
    expect((await db.attendedShows.get(777))?.userId).toBe(USER_A);

    // A second .put whose literal omits userId (an idempotent re-mark) must NOT
    // self-erase the field — the updating hook re-stamps it.
    await markShowAttended({ show_id: 777, showDate: "2026-08-02" });
    expect((await db.attendedShows.get(777))?.userId).toBe(USER_A);
  });

  it("UPDATING re-stamp: saveDraftCard reshuffle keeps userId AND stays in snapshot('user-A')", async () => {
    writeIdentityRecord({ userId: USER_A, displayName: "A" });

    await saveDraftCard({
      sessionId: "resh",
      card: makeCard("seed-1"),
      showDate: "2026-08-01",
      venueName: null,
      city: null,
    });
    // A reshuffle = a second .put on the same cardId whose literal omits userId.
    await saveDraftCard({
      sessionId: "resh",
      card: makeCard("seed-2"),
      showDate: "2026-08-01",
      venueName: null,
      city: null,
    });

    const card = await db.bingoCards.get("resh");
    expect(card?.userId).toBe(USER_A);
    expect(card?.card.seed).toBe("seed-2"); // the reshuffle landed
    const snap = await snapshot(USER_A);
    expect(snap.bingoCards.some((c) => c.cardId === "resh")).toBe(true);
  });

  it("isolation: identity B never sees A's freshly-created or re-stamped rows", async () => {
    // A creates rows across all five namespaced tables.
    writeIdentityRecord({ userId: USER_A, displayName: "A" });
    const show = await startShow();
    await logSong(show.sessionId, {
      songId: 1,
      songName: "Rattlesnake",
      outcome: "hit",
      shownFanSongIds: [1],
      isPlaceholder: false,
      loggedAt: 10,
    });
    await markShowAttended({ show_id: 555, showDate: "2026-08-01" });
    await markShowAttended({ show_id: 555, showDate: "2026-08-01" }); // re-mark
    await saveDraftCard({
      sessionId: show.sessionId,
      card: makeCard("seed-1"),
      showDate: "2026-08-01",
      venueName: null,
      city: null,
    });

    // Switch to identity B — B's scoped reads and export are EMPTY.
    writeIdentityRecord({ userId: USER_B, displayName: "B" });
    expect(await db.attendedShows.where("userId").equals(USER_B).toArray()).toHaveLength(0);
    expect(await db.trackedShows.where("userId").equals(USER_B).toArray()).toHaveLength(0);
    expect(await db.trackedEntries.where("userId").equals(USER_B).toArray()).toHaveLength(0);
    expect(await db.bingoCards.where("userId").equals(USER_B).toArray()).toHaveLength(0);

    const snapB = await snapshot(USER_B);
    expect(snapB.attendedShows).toHaveLength(0);
    expect(snapB.trackedShows).toHaveLength(0);
    expect(snapB.trackedEntries).toHaveLength(0);
    expect(snapB.bingoCards).toHaveLength(0);
  });

  it("claim-regression: a row created with NO identity stays undefined, then claimLegacyDexOnce stamps it exactly once", async () => {
    // No identity present — the hook must NOT invent a userId (legacy pre-claim).
    clearIdentityRecord();
    await markShowAttended({ show_id: 888, showDate: "2026-08-03" });
    expect((await db.attendedShows.get(888))?.userId).toBeUndefined();

    // The one-time claim stamps the untagged legacy row.
    await claimLegacyDexOnce(USER_A);
    expect((await db.attendedShows.get(888))?.userId).toBe(USER_A);

    // Exactly once: a second claim with a different userId is a no-op.
    await claimLegacyDexOnce(USER_B);
    expect((await db.attendedShows.get(888))?.userId).toBe(USER_A);
  });
});
