import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BingoCard } from "@guezzer/core";
import { config } from "../src/config.ts";
import {
  db,
  endShow,
  lockCard,
  saveDraftCard,
  startShow,
} from "../src/db/db.ts";

/**
 * Verifies the Gizz-Bingo persistence write helpers (Plan 15-02 Task 1): the
 * additive `bingoCards` table (version(5)), the `saveDraftCard`/`lockCard`
 * helpers, and the app-side reshuffle-rejection invariant (SC-1/D-10). The lock
 * mechanism is Start-Show-agnostic (D-08/D-09) — this file fixture-tests the
 * machinery so it fires for real once Phase 16 wires the deal/Start-Show
 * trigger.
 *
 * Isolation: `fake-indexeddb/auto` (setup.ts) is a fresh in-memory IDB per test
 * file. Each test deletes the DB and drives the real singleton `db` so the
 * assertions exercise the version(5) block in src/db/db.ts, not a copy.
 */

async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
}

/** A structurally-valid 16-square card (one free center) for the write path. */
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

describe("bingo write helpers (saveDraftCard / lockCard)", () => {
  beforeEach(async () => {
    await resetDb();
    await db.open(); // fresh, empty version(5) database
  });
  afterEach(resetDb);

  it("saveDraftCard writes an unlocked draft (lockedAt null, caughtSnapshot [])", async () => {
    const show = await startShow();
    await saveDraftCard({
      sessionId: show.sessionId,
      card: makeCard(),
      showDate: show.date,
      venueName: null,
      city: null,
    });

    const row = await db.bingoCards.get(show.sessionId);
    expect(row).toBeDefined();
    expect(row?.cardId).toBe(show.sessionId);
    expect(row?.sessionId).toBe(show.sessionId);
    expect(row?.lockedAt).toBeNull();
    expect(row?.caughtSnapshot).toEqual([]);
    expect(row?.card.seed).toBe("seed-1");
  });

  it("a second saveDraftCard for the same session overwrites the same row in place (cardId = sessionId, D-12)", async () => {
    const show = await startShow();
    await saveDraftCard({
      sessionId: show.sessionId,
      card: makeCard("seed-1"),
      showDate: show.date,
      venueName: null,
      city: null,
    });
    await saveDraftCard({
      sessionId: show.sessionId,
      card: makeCard("seed-2"),
      showDate: show.date,
      venueName: null,
      city: null,
    });

    // One row, not an orphan pair — the seed lives IN the row and reshuffles.
    expect(await db.bingoCards.count()).toBe(1);
    const row = await db.bingoCards.get(show.sessionId);
    expect(row?.card.seed).toBe("seed-2");
  });

  it("lockCard stamps lockedAt and freezes caughtSnapshot; a second lockCard is a no-op (idempotent, D-10)", async () => {
    const show = await startShow();
    await saveDraftCard({
      sessionId: show.sessionId,
      card: makeCard(),
      showDate: show.date,
      venueName: null,
      city: null,
    });

    await lockCard(show.sessionId, [1, 2, 3]);
    const locked = await db.bingoCards.get(show.sessionId);
    expect(typeof locked?.lockedAt).toBe("number");
    expect(locked?.caughtSnapshot).toEqual([1, 2, 3]);
    const firstLockedAt = locked!.lockedAt;

    // A second lock must not re-stamp or re-freeze.
    await lockCard(show.sessionId, [9, 9, 9]);
    const again = await db.bingoCards.get(show.sessionId);
    expect(again?.lockedAt).toBe(firstLockedAt);
    expect(again?.caughtSnapshot).toEqual([1, 2, 3]);
  });

  it("lockCard on a session with no card row is a no-op (does not throw)", async () => {
    const show = await startShow();
    await expect(lockCard(show.sessionId, [1, 2, 3])).resolves.toBeUndefined();
    expect(await db.bingoCards.count()).toBe(0);
  });

  it("saveDraftCard throws when the target session is finalized", async () => {
    const show = await startShow();
    await endShow(show.sessionId);

    await expect(
      saveDraftCard({
        sessionId: show.sessionId,
        card: makeCard(),
        showDate: show.date,
        venueName: null,
        city: null,
      }),
    ).rejects.toBeTruthy();
    expect(await db.bingoCards.count()).toBe(0);
  });

  it("saveDraftCard throws when the existing card is already locked (reshuffle rejected, SC-1/D-10)", async () => {
    const show = await startShow();
    await saveDraftCard({
      sessionId: show.sessionId,
      card: makeCard("seed-1"),
      showDate: show.date,
      venueName: null,
      city: null,
    });
    await lockCard(show.sessionId, [1]);

    await expect(
      saveDraftCard({
        sessionId: show.sessionId,
        card: makeCard("seed-2"),
        showDate: show.date,
        venueName: null,
        city: null,
      }),
    ).rejects.toBeTruthy();

    // The locked card is unchanged — the reshuffle wrote nothing.
    const row = await db.bingoCards.get(show.sessionId);
    expect(row?.card.seed).toBe("seed-1");
    expect(row?.lockedAt).not.toBeNull();
  });
});
