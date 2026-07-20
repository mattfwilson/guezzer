import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { deriveMarks, type MarkTrailEntry } from "../../src/bingo/mark.ts";
import { FREE_SENTINEL, type BingoCard, type BingoSquareDef, type MarkedCard } from "../../src/bingo/types.ts";
import {
  ALBUM_URL,
  SONG_ALBUM,
  SONG_BUSTOUT,
  SONG_MICROTONAL,
  SONG_NEVER_CAUGHT,
  SONG_PLAIN,
  bingoCard,
  bingoContext,
  caught,
} from "../fixtures/bingo/synthetic.ts";

/**
 * Success Criteria 1 & 2 for BINGO-03: `deriveMarks` is a pure consume-once
 * fold with a TOTAL tie-break. These tests pin (1) live == replay == catch-up
 * (T-14-05 phase exit criterion), (2) structural consume-once — one song = one
 * mark, 15 songs never exceed 15 + free (T-14-06 / D-11), (3) the D-08/D-09/D-10
 * specificity ordering, and (4) the skip-placeholder / rename-relights policy.
 *
 * Local card builders live here (do NOT modify synthetic.ts, owned by Plan 02).
 */

/**
 * Build a 16-square card by placing explicit defs at specific board indices;
 * every other non-free cell is a filler song square whose id (900+i) collides
 * with nothing in the known catalog (10..60) or the default `bingoCard`
 * squares (100+i), so filler cells never accidentally match a trail entry.
 */
function buildCard(
  overrides: Record<number, BingoSquareDef>,
  freeIndex: number = config.bingo.freeIndex,
): BingoCard {
  const squares = Array.from({ length: 16 }, (_unused, index): BingoSquareDef =>
    index === freeIndex
      ? { kind: "free" }
      : (overrides[index] ?? { kind: "song", songId: 900 + index, label: `Filler ${index}` }),
  );
  return bingoCard({ squares, freeIndex });
}

/** The per-index marking positions — the byte-identity vector the property test compares. */
function marks(card: MarkedCard): Array<number | null> {
  return card.squares.map((square) => square.markedByPosition);
}

function entry(over: Partial<MarkTrailEntry> & { songId: number | null; position: number }): MarkTrailEntry {
  return { isPlaceholder: false, ...over };
}

describe("deriveMarks — consume-once fold (BINGO-03)", () => {
  describe("live == replay == catch-up (T-14-05 phase exit criterion)", () => {
    it("produces byte-identical marks across full-order, shuffled-replay, and incremental catch-up", () => {
      const ctx = bingoContext();
      // caught = everything except the never-caught song, so `neverCaught` only
      // fires for SONG_NEVER_CAUGHT (a realistic mid-collection dex).
      const snapshot = caught([SONG_PLAIN, SONG_MICROTONAL, SONG_ALBUM, SONG_BUSTOUT]);
      const card = buildCard({
        0: { kind: "event", event: "opener", label: "Opener" },
        1: { kind: "song", songId: SONG_PLAIN, label: "Plain" },
        2: { kind: "song", songId: SONG_MICROTONAL, label: "Micro" },
        3: { kind: "event", event: "microtonal", label: "Microtonal" },
        4: { kind: "album", albumUrl: ALBUM_URL, label: "Album" },
        6: { kind: "song", songId: SONG_ALBUM, label: "AlbumSong" },
        7: { kind: "event", event: "bustOut", label: "Bust-out" },
        8: { kind: "event", event: "neverCaught", label: "Never-caught" },
      });
      const trail: MarkTrailEntry[] = [
        entry({ songId: SONG_PLAIN, position: 0 }),
        entry({ songId: SONG_MICROTONAL, position: 1 }),
        entry({ songId: SONG_ALBUM, position: 2 }),
        entry({ songId: SONG_BUSTOUT, position: 3 }),
        entry({ songId: SONG_NEVER_CAUGHT, position: 4 }),
        entry({ songId: SONG_PLAIN, position: 5 }), // reprise — must not double-mark
      ];

      // (a) catch-up: the whole trail applied at once.
      const fullOrder = deriveMarks(card, trail, ctx, snapshot);

      // (b) replay: the same entries shuffled — deriveMarks re-sorts by position,
      // so the result must be identical regardless of arrival order.
      const shuffled = [trail[4], trail[0], trail[5], trail[2], trail[1], trail[3]];
      const replay = deriveMarks(card, shuffled, ctx, snapshot);

      // (c) live-incremental: apply entries one at a time, re-deriving from the
      // growing prefix; the final board is what a live device would hold.
      const growing: MarkTrailEntry[] = [];
      let incremental = deriveMarks(card, growing, ctx, snapshot);
      const history: Array<Array<number | null>> = [marks(incremental)];
      for (const next of trail) {
        growing.push(next);
        incremental = deriveMarks(card, growing, ctx, snapshot);
        history.push(marks(incremental));
      }

      expect(marks(replay)).toEqual(marks(fullOrder));
      expect(marks(incremental)).toEqual(marks(fullOrder));
      expect(replay.markedCount).toBe(fullOrder.markedCount);
      expect(incremental.markedCount).toBe(fullOrder.markedCount);

      // Monotonic: an incremental step never un-lights a previously-lit square.
      for (let step = 1; step < history.length; step++) {
        const prev = history[step - 1];
        const curr = history[step];
        for (let i = 0; i < 16; i++) {
          if (prev[i] !== null) expect(curr[i]).toBe(prev[i]);
        }
      }
    });
  });

  describe("consume-once: one song lights exactly one square (D-11 / T-14-06)", () => {
    it("marks only the most-specific (song) square when a song qualifies for 3 squares", () => {
      // SONG_ALBUM qualifies for a song square, an album square, AND (via the
      // context override) a microtonal event square — three matches, one mark.
      const ctx = bingoContext({ microtonalSongIds: new Set<number>([SONG_MICROTONAL, SONG_ALBUM]) });
      const card = buildCard({
        0: { kind: "song", songId: SONG_ALBUM, label: "AlbumSong" },
        1: { kind: "album", albumUrl: ALBUM_URL, label: "Album" },
        2: { kind: "event", event: "microtonal", label: "Microtonal" },
      });
      const result = deriveMarks(card, [entry({ songId: SONG_ALBUM, position: 3 })], ctx, caught());

      // Exactly one non-free mark (index 0, the song square, rank 0) + free.
      expect(result.squares[0].markedByPosition).toBe(3);
      expect(result.squares[1].markedByPosition).toBeNull();
      expect(result.squares[2].markedByPosition).toBeNull();
      expect(result.markedCount).toBe(2); // song square + pre-marked free
      expect(result.squares[config.bingo.freeIndex].markedByPosition).toBe(FREE_SENTINEL);
    });

    it("never exceeds 15 fillable marks + free for a 15-song trail (with reprises)", () => {
      const ctx = bingoContext();
      const card = bingoCard(); // 15 distinct song squares (id 100+index) + free
      const targets = card.squares.flatMap((sq, index) =>
        sq.kind === "song" ? [{ songId: sq.songId, index }] : [],
      );
      const trail: MarkTrailEntry[] = targets.map((t, position) => entry({ songId: t.songId, position }));
      // Append reprises of the first three songs — each must find its square
      // already consumed and add nothing.
      trail.push(entry({ songId: targets[0].songId, position: 100 }));
      trail.push(entry({ songId: targets[1].songId, position: 101 }));
      trail.push(entry({ songId: targets[2].songId, position: 102 }));

      const result = deriveMarks(card, trail, ctx, caught());

      expect(result.markedCount).toBe(16); // 15 song squares + free
      expect(result.markedCount).toBeLessThanOrEqual(16);
    });
  });

  describe("specificity tie-break (D-08/D-09/D-10)", () => {
    it("lights never-caught over bust-out for a song that is both (D-09)", () => {
      const ctx = bingoContext(); // SONG_BUSTOUT has a large corpusGap → bust-out
      const card = buildCard({
        0: { kind: "event", event: "bustOut", label: "Bust-out" },
        1: { kind: "event", event: "neverCaught", label: "Never-caught" },
      });
      // Empty dex → SONG_BUSTOUT is also never-caught.
      const result = deriveMarks(card, [entry({ songId: SONG_BUSTOUT, position: 2 })], ctx, caught());

      expect(result.squares[1].markedByPosition).toBe(2); // never-caught (rank 1) wins
      expect(result.squares[0].markedByPosition).toBeNull(); // bust-out (rank 2) loses
      expect(result.markedCount).toBe(2);
    });

    it("breaks an equal-rank tie by lowest board index (D-10)", () => {
      const ctx = bingoContext();
      const card = buildCard({
        0: { kind: "event", event: "microtonal", label: "Microtonal A" },
        2: { kind: "event", event: "microtonal", label: "Microtonal B" },
      });
      const result = deriveMarks(card, [entry({ songId: SONG_MICROTONAL, position: 4 })], ctx, caught());

      expect(result.squares[0].markedByPosition).toBe(4); // lowest index wins
      expect(result.squares[2].markedByPosition).toBeNull();
      expect(result.markedCount).toBe(2);
    });
  });

  describe("placeholder skip + rename relights (v1 policy A2)", () => {
    it("marks nothing for a null/placeholder entry, then lights the square on rename — never un-lighting", () => {
      const ctx = bingoContext();
      const card = buildCard({
        0: { kind: "song", songId: SONG_PLAIN, label: "Plain" },
        1: { kind: "event", event: "opener", label: "Opener" },
      });

      // Placeholder at position 0: skipped entirely — even the positional opener
      // square stays dark (conservative v1 policy).
      const placeholderTrail: MarkTrailEntry[] = [{ songId: null, position: 0, isPlaceholder: true }];
      const before = deriveMarks(card, placeholderTrail, ctx, caught());
      expect(before.squares[0].markedByPosition).toBeNull();
      expect(before.squares[1].markedByPosition).toBeNull();
      expect(before.markedCount).toBe(1); // only the free cell

      // Rename the same slot to a real song and re-derive: the song square lights.
      const renamedTrail: MarkTrailEntry[] = [entry({ songId: SONG_PLAIN, position: 0 })];
      const after = deriveMarks(card, renamedTrail, ctx, caught());
      expect(after.squares[0].markedByPosition).toBe(0); // song square (rank 0) lit
      expect(after.markedCount).toBe(2);

      // Re-derivation only ADDS marks — every square lit before stays lit.
      for (let i = 0; i < 16; i++) {
        if (before.squares[i].markedByPosition !== null) {
          expect(after.squares[i].markedByPosition).toBe(before.squares[i].markedByPosition);
        }
      }
    });
  });
});
