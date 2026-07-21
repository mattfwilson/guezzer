import { describe, expect, it } from "vitest";
import type {
  ArchiveArtifact,
  BingoCard,
  BingoSquareDef,
  DexAlbumsArtifact,
  RarityIndex,
  TransitionMatrix,
} from "@guezzer/core";
import { replayCard } from "../src/games/bingoReplay.ts";
import type { BingoCardRow, TrackedEntry } from "../src/db/db.ts";

/**
 * BINGO-07 replay adapter (plan 15-03, Task 1). `replayCard` is the pure
 * app→core adapter that re-derives a frozen card's final board over the
 * persisted trail. It carries the TWO load-bearing correctness points
 * (15-RESEARCH Pitfalls 1+2):
 *
 *  1. 0-based CONTIGUOUS reindex — `TrackedEntry.position` is 1-based and gapped
 *     (deleteEntry leaves holes); `mark.ts` hard-codes opener = position 0, so
 *     passing raw positions would leave the opener square dark.
 *  2. FROZEN `row.caughtSnapshot` drives `neverCaught` — never the live dex, so a
 *     later show's catch can never retroactively un-mark a replayed square.
 *
 * Fixture idiom mirrors packages/core/test/bingo/mark.test.ts: a card built by
 * placing explicit defs at board indices (every other non-free cell is a filler
 * song square whose id never collides with a trail entry).
 */

// The free cell's pre-mark sentinel (core types.ts:74, FREE_SENTINEL = -1). Not
// exported from the barrel; pinned locally so a drift is caught here.
const FREE_SENTINEL = -1;
// Core config.bingo.freeIndex (packages/core/src/config.ts) — the bingo config
// lives in core, not the app, so it is pinned here for the fixture card.
const FREE_INDEX = 5;

/** Minimal artifacts — buildBingoContext only reads .nodes/.shows/rarity/.albums. */
const matrix = { schemaVersion: 1, nodes: [] } as unknown as TransitionMatrix;
const archive = { schemaVersion: 1, shows: [] } as unknown as ArchiveArtifact;
const albums = { schemaVersion: 1, albums: [] } as unknown as DexAlbumsArtifact;
const rarity = new Map() as unknown as RarityIndex;

/** Build a 16-square card; filler cells are song squares id 900+i (never collide). */
function buildCard(overrides: Record<number, BingoSquareDef>): BingoCard {
  const squares = Array.from({ length: 16 }, (_unused, index): BingoSquareDef =>
    index === FREE_INDEX
      ? { kind: "free" }
      : (overrides[index] ?? { kind: "song", songId: 900 + index, label: `Filler ${index}` }),
  );
  return {
    schemaVersion: 1,
    seed: "test-seed",
    vibe: "balanced",
    corpusVersion: "test-corpus",
    freeIndex: FREE_INDEX,
    squares,
  };
}

function row(card: BingoCard, caughtSnapshot: number[] = []): BingoCardRow {
  return {
    cardId: "s1",
    sessionId: "s1",
    card,
    caughtSnapshot,
    lockedAt: 1,
    showDate: "2026-07-14",
    venueName: null,
    city: null,
  };
}

function entry(over: Partial<TrackedEntry> & { position: number; songId: number | null }): TrackedEntry {
  return {
    sessionId: "s1",
    songName: over.songId == null ? "???" : `Song ${over.songId}`,
    setNumber: "1",
    outcome: "hit",
    shownFanSongIds: [],
    isPlaceholder: false,
    source: "manual",
    loggedAt: 1,
    ...over,
  };
}

describe("replayCard — pure app→core replay adapter (BINGO-07)", () => {
  it("fires the opener square via the 0-based reindex over gapped 1-based positions", () => {
    // Top row 0..3: opener + three song squares. The trail's stored positions are
    // gapped (10/20/30/40) — only the reindex to 0..3 lights the opener (index 0).
    const card = buildCard({
      0: { kind: "event", event: "opener", label: "Opener" },
      1: { kind: "song", songId: 101, label: "S1" },
      2: { kind: "song", songId: 102, label: "S2" },
      3: { kind: "song", songId: 103, label: "S3" },
    });
    // 777 has no song square → the opener is its most-specific match at position 0.
    const entries: TrackedEntry[] = [
      entry({ position: 10, songId: 777 }),
      entry({ position: 20, songId: 101 }),
      entry({ position: 30, songId: 102 }),
      entry({ position: 40, songId: 103 }),
    ];

    const { marked, wins } = replayCard(row(card), entries, matrix, archive, rarity, albums);

    // Opener fires on the FIRST real entry (reindexed to position 0). Raw 1-based
    // positions (min 10) would never satisfy `position === 0` → this would be null.
    expect(marked.squares[0].markedByPosition).toBe(0);
    expect(marked.squares[1].markedByPosition).toBe(1);
    expect(marked.squares[2].markedByPosition).toBe(2);
    expect(marked.squares[3].markedByPosition).toBe(3);

    // Free center is pre-marked with the FREE_SENTINEL, no trail position owning it.
    expect(marked.squares[FREE_INDEX].markedByPosition).toBe(FREE_SENTINEL);

    // The completed top row is the single line win.
    expect(wins).toHaveLength(1);
    expect(wins[0].kind).toBe("line");
    expect(wins[0].indices).toEqual([0, 1, 2, 3]);
  });

  it("marks a neverCaught square using the FROZEN caughtSnapshot (song absent from it)", () => {
    const card = buildCard({ 8: { kind: "event", event: "neverCaught", label: "Never caught" } });
    const entries: TrackedEntry[] = [entry({ position: 7, songId: 555 })];

    // 555 is NOT in the frozen snapshot → neverCaught fires (reindexed position 0).
    const { marked } = replayCard(row(card, []), entries, matrix, archive, rarity, albums);
    expect(marked.squares[8].markedByPosition).toBe(0);
  });

  it("leaves the neverCaught square dark when the FROZEN snapshot already contains the song", () => {
    const card = buildCard({ 8: { kind: "event", event: "neverCaught", label: "Never caught" } });
    const entries: TrackedEntry[] = [entry({ position: 7, songId: 555 })];

    // 555 IS in the frozen snapshot → replay reads the FROZEN set, so it stays dark
    // even though a live/later dex might now contain it.
    const { marked } = replayCard(row(card, [555]), entries, matrix, archive, rarity, albums);
    expect(marked.squares[8].markedByPosition).toBeNull();
    // Free center is still pre-marked.
    expect(marked.squares[FREE_INDEX].markedByPosition).toBe(FREE_SENTINEL);
  });

  it("skips placeholder / null-songId entries and detects no line for an incomplete board", () => {
    const card = buildCard({
      0: { kind: "event", event: "opener", label: "Opener" },
      1: { kind: "song", songId: 101, label: "S1" },
    });
    const entries: TrackedEntry[] = [
      entry({ position: 3, songId: null, isPlaceholder: true }), // reindex 0 — skipped
      entry({ position: 9, songId: 101 }), // reindex 1
    ];

    const { marked, wins } = replayCard(row(card), entries, matrix, archive, rarity, albums);

    // The placeholder occupies reindex position 0 but is skipped, so the opener
    // square is NOT lit by it (proves placeholders never mark).
    expect(marked.squares[0].markedByPosition).toBeNull();
    // The real song still lights its square at reindex position 1.
    expect(marked.squares[1].markedByPosition).toBe(1);
    // No complete line → no wins.
    expect(wins).toHaveLength(0);
  });

  it("exposes a reindexed position → songName map for the D-06 'Lit by' caption", () => {
    const card = buildCard({ 1: { kind: "song", songId: 101, label: "S1" } });
    const entries: TrackedEntry[] = [
      entry({ position: 40, songId: 101, songName: "Rattlesnake" }),
      entry({ position: 10, songId: 999, songName: "Robot Stop" }),
    ];

    const { marked, songNameByPosition } = replayCard(
      row(card),
      entries,
      matrix,
      archive,
      rarity,
      albums,
    );

    // sorted-by-position reindex: 999 (pos 10) → 0, 101 (pos 40) → 1.
    expect(songNameByPosition.get(0)).toBe("Robot Stop");
    expect(songNameByPosition.get(1)).toBe("Rattlesnake");
    // The song square records reindex position 1 → resolves to "Rattlesnake".
    const litPos = marked.squares[1].markedByPosition;
    expect(litPos).toBe(1);
    expect(songNameByPosition.get(litPos as number)).toBe("Rattlesnake");
  });
});
