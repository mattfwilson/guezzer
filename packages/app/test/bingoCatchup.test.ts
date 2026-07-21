import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ArchiveArtifact,
  BingoCard,
  BingoSquareDef,
  DexAlbumsArtifact,
  RarityIndex,
  TransitionMatrix,
} from "@guezzer/core";
import { config } from "../src/config.ts";
import {
  adoptSuggestion,
  db,
  logSong,
  startShow,
  type BingoCardRow,
} from "../src/db/db.ts";
import { replayCard } from "../src/games/bingoReplay.ts";

/**
 * BINGO-06 catch-up ACCEPTANCE GATE (plan 15-04, Task 1). Catch-up NEVER touches
 * a square directly — it GROWS the persisted trail via the SAME shipped commit
 * paths a live tap uses (`adoptSuggestion` for a feed row, `logSong` for a manual
 * search), and `deriveMarks` (via the shared `replayCard` adapter) re-lights the
 * qualifying squares as a PURE CONSEQUENCE (D-03/D-04/D-23). This pins the three
 * load-bearing invariants of the catch-up contract, using ONLY already-shipped
 * functions (there is no new domain code — the fold is proven by composition, so
 * `live == replay == catch-up`):
 *
 *  1. N `adoptSuggestion` calls grow `db.trackedEntries` for the session by
 *     exactly N.
 *  2. Re-deriving the board (`replayCard`) over the grown trail marks EXACTLY the
 *     squares those N songs qualify for and NO others (consume-once holds).
 *  3. A catch-up add carries `shownFanSongIds: []` → classified as a MISS
 *     (`classifyOutcome`), keeping the hit/miss denominator honest (RESEARCH A2).
 *  4. A manual `logSong` miss for a searched song lights its square identically
 *     (same trail-write path) and completes the line.
 *
 * Isolation: `fake-indexeddb/auto` (setup.ts) is a fresh in-memory IDB per file;
 * each test drives the real singleton `db` so it exercises the shipped helpers.
 */

// The free cell's pre-mark sentinel (core types.ts:74, FREE_SENTINEL = -1) + the
// core `config.bingo.freeIndex` (packages/core/src/config.ts). Neither is exported
// from the barrel, so both are pinned locally so a drift is caught here.
const FREE_SENTINEL = -1;
const FREE_INDEX = 5;

// Minimal artifacts — `buildBingoContext` only reads .nodes/.shows/rarity/.albums,
// and plain `kind:"song"` squares match by songId alone (no context needed).
const matrix = { schemaVersion: 1, nodes: [] } as unknown as TransitionMatrix;
const archive = { schemaVersion: 1, shows: [] } as unknown as ArchiveArtifact;
const albums = { schemaVersion: 1, albums: [] } as unknown as DexAlbumsArtifact;
const rarity = new Map() as unknown as RarityIndex;

/** A 16-square card; the top row is four song squares, free center, rest filler. */
function buildCard(): BingoCard {
  const squares = Array.from({ length: 16 }, (_unused, index): BingoSquareDef => {
    if (index === FREE_INDEX) return { kind: "free" };
    // Top row (0..3) are the four qualifying song squares the catch-up lights.
    if (index === 0) return { kind: "song", songId: 201, label: "S201" };
    if (index === 1) return { kind: "song", songId: 202, label: "S202" };
    if (index === 2) return { kind: "song", songId: 203, label: "S203" };
    if (index === 3) return { kind: "song", songId: 204, label: "S204" };
    // Fillers whose ids never collide with a trail entry → stay unmarked.
    return { kind: "song", songId: 900 + index, label: `Filler ${index}` };
  });
  return {
    schemaVersion: 1,
    seed: "catchup-seed",
    vibe: "balanced",
    corpusVersion: "test-corpus",
    freeIndex: FREE_INDEX,
    squares,
  };
}

function lockedRow(sessionId: string): BingoCardRow {
  return {
    cardId: sessionId,
    sessionId,
    card: buildCard(),
    caughtSnapshot: [], // no neverCaught squares on this card → irrelevant here
    lockedAt: 1,
    showDate: "2026-07-14",
    venueName: null,
    city: null,
  };
}

async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
  await db.open();
}

function trail(sessionId: string) {
  return db.trackedEntries.where("sessionId").equals(sessionId).sortBy("position");
}

describe("Gizz-Bingo catch-up: trail-grow re-lights the qualifying squares (BINGO-06)", () => {
  beforeEach(resetDb);
  afterEach(async () => {
    db.close();
    await Dexie.delete(config.DB_NAME);
  });

  it("N adoptSuggestion feed rows grow the trail by N and re-light exactly those squares as misses", async () => {
    const { sessionId } = await startShow();
    const row = lockedRow(sessionId);

    // Partial trail: the opener (song 201) is already tracked → square 0 is lit.
    await logSong(sessionId, {
      songId: 201,
      songName: "S201",
      outcome: "hit",
      shownFanSongIds: [201],
      isPlaceholder: false,
      loggedAt: Date.now(),
    });

    const before = await trail(sessionId);
    expect(before).toHaveLength(1);

    // Board before catch-up: only square 0 (opener) is lit.
    const preBoard = replayCard(row, before, matrix, archive, rarity, albums);
    expect(preBoard.marked.squares[0].markedByPosition).not.toBeNull();
    expect(preBoard.marked.squares[1].markedByPosition).toBeNull();
    expect(preBoard.marked.squares[2].markedByPosition).toBeNull();
    expect(preBoard.marked.squares[3].markedByPosition).toBeNull();
    expect(preBoard.wins).toHaveLength(0);

    // Catch-up: adopt the two feed rows the tracker missed (202, 203). Each carries
    // shownFanSongIds:[] (no on-screen fan predicted a backfill) → classifyOutcome
    // MISS — the honest denominator (D-03, RESEARCH A2). This is exactly the
    // ShowView.handleAdopt path, one adoptSuggestion call per checked row.
    const feedRows = [
      { songId: 202, songName: "S202" },
      { songId: 203, songName: "S203" },
    ];
    for (const feedRow of feedRows) {
      await adoptSuggestion(sessionId, { ...feedRow, shownFanSongIds: [] });
    }

    // (1) The trail grew by exactly N (=2).
    const afterAdopt = await trail(sessionId);
    expect(afterAdopt).toHaveLength(before.length + feedRows.length);

    // (3) Each catch-up add is stored as a MISS — no phantom hit in the tally.
    const adopted202 = afterAdopt.find((e) => e.songId === 202);
    const adopted203 = afterAdopt.find((e) => e.songId === 203);
    expect(adopted202?.outcome).toBe("miss");
    expect(adopted203?.outcome).toBe("miss");
    expect(adopted202?.source).toBe("editor");

    // (2) Re-deriving the board over the grown trail lights EXACTLY squares 0..2
    // and no others (consume-once): the two adds re-lit squares 1 and 2, square 3
    // is still dark, and every filler cell (indices 4,6..15) stays unmarked.
    const midBoard = replayCard(row, afterAdopt, matrix, archive, rarity, albums);
    expect(midBoard.marked.squares[0].markedByPosition).not.toBeNull();
    expect(midBoard.marked.squares[1].markedByPosition).not.toBeNull();
    expect(midBoard.marked.squares[2].markedByPosition).not.toBeNull();
    expect(midBoard.marked.squares[3].markedByPosition).toBeNull();
    expect(midBoard.marked.squares[FREE_INDEX].markedByPosition).toBe(FREE_SENTINEL);
    for (const i of [4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
      expect(midBoard.marked.squares[i].markedByPosition).toBeNull();
    }
    // Top row incomplete (square 3 dark) → no line win yet.
    expect(midBoard.wins).toHaveLength(0);

    // (4) A MANUAL search-and-log of the last missed song (204) lights its square
    // identically — same trail-write path (ShowView.handleSearchSelect: a miss,
    // shownFanSongIds:[]). This completes the top row → the single line win.
    await logSong(sessionId, {
      songId: 204,
      songName: "S204",
      outcome: "miss",
      shownFanSongIds: [],
      isPlaceholder: false,
      loggedAt: Date.now(),
    });

    const afterManual = await trail(sessionId);
    expect(afterManual).toHaveLength(afterAdopt.length + 1);
    const manual204 = afterManual.find((e) => e.songId === 204);
    expect(manual204?.outcome).toBe("miss");

    const finalBoard = replayCard(row, afterManual, matrix, archive, rarity, albums);
    expect(finalBoard.marked.squares[3].markedByPosition).not.toBeNull();
    // The catch-up-completed top row is the single line win (live == catch-up).
    expect(finalBoard.wins).toHaveLength(1);
    expect(finalBoard.wins[0].kind).toBe("line");
    expect(finalBoard.wins[0].indices).toEqual([0, 1, 2, 3]);
  });
});
