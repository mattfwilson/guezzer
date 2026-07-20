import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import { deal } from "../../src/bingo/generate.ts";
import { bingoCardSchema, type BingoVibe } from "../../src/bingo/types.ts";
import { bingoContext, caught, SONG_NEVER_CAUGHT } from "../fixtures/bingo/synthetic.ts";

/**
 * `deal` is the D-21 pure seeded card generator (Success Criteria 3). These
 * groups pin the three load-bearing invariants: same-seed reproducibility,
 * never-blank completeness, and v1-catalog coverage (segue excluded, D-24).
 *
 * The context/caught fixtures are the RESOLVED lookups `buildBingoContext`
 * emits — the generator takes them as inputs, it never re-resolves artifacts.
 */

const VIBES: BingoVibe[] = ["chill", "balanced", "glory"];
const SEEDS = ["s", "alpha", "42", "king-gizzard", "night-2"];
const CORPUS = "cv-2026";

describe("deal — same-seed reproducibility (D-21)", () => {
  it("returns a deep-equal card for identical inputs", () => {
    const ctx = bingoContext();
    const dex = caught([SONG_NEVER_CAUGHT + 999]); // arbitrary non-empty snapshot
    const a = deal("s", "balanced", ctx, dex, CORPUS);
    const b = deal("s", "balanced", ctx, dex, CORPUS);
    expect(a).toEqual(b);
  });

  it("returns a DIFFERENT card for a different seed", () => {
    const ctx = bingoContext();
    const dex = caught();
    const a = deal("seed-one", "balanced", ctx, dex, CORPUS);
    const b = deal("seed-two", "balanced", ctx, dex, CORPUS);
    expect(a).not.toEqual(b);
  });

  it("returns a DIFFERENT card for a different vibe (same seed)", () => {
    const ctx = bingoContext();
    const dex = caught();
    const a = deal("s", "chill", ctx, dex, CORPUS);
    const b = deal("s", "glory", ctx, dex, CORPUS);
    expect(a).not.toEqual(b);
  });
});

describe("deal — never-blank completeness (T-14 / D-06)", () => {
  it("always yields 16 squares, exactly one free at freeIndex, no holes", () => {
    const ctx = bingoContext();
    const dex = caught();
    for (const vibe of VIBES) {
      for (const seed of SEEDS) {
        const card = deal(seed, vibe, ctx, dex, CORPUS);

        expect(card.squares).toHaveLength(16);
        // No hole / undefined entry anywhere on the board.
        for (let i = 0; i < 16; i++) {
          expect(card.squares[i]).toBeDefined();
        }
        // Exactly one free cell, and it sits at freeIndex.
        const freeIndices = card.squares.flatMap((sq, i) => (sq.kind === "free" ? [i] : []));
        expect(freeIndices).toEqual([config.bingo.freeIndex]);
        expect(card.freeIndex).toBe(config.bingo.freeIndex);

        // A dealt card always passes the strict schema (T-14-09).
        expect(() => bingoCardSchema.parse(card)).not.toThrow();
      }
    }
  });

  it("stays complete when the jam/album rosters are empty (T-14-04 resilience)", () => {
    // eraPlayRate present but every roster-driven pool empty.
    const ctx = bingoContext({
      jamVehicleSongIds: new Set<number>(),
      albumSongIds: new Map(),
    });
    for (const vibe of VIBES) {
      const card = deal("empty-roster", vibe, ctx, caught(), CORPUS);
      expect(card.squares).toHaveLength(16);
      expect(card.squares.every((sq) => sq !== undefined)).toBe(true);
    }
  });

  it("stays complete even when the eraPlayRate catalog is also empty", () => {
    const ctx = bingoContext({
      eraPlayRate: new Map(),
      albumSongIds: new Map(),
      jamVehicleSongIds: new Set<number>(),
    });
    const card = deal("bone-dry", "balanced", ctx, caught(), CORPUS);
    expect(card.squares).toHaveLength(16);
    expect(card.squares.every((sq) => sq !== undefined)).toBe(true);
    expect(() => bingoCardSchema.parse(card)).not.toThrow();
  });
});

describe("deal — v1 catalog coverage (D-24: no segue)", () => {
  const V1_KINDS = new Set(["free", "song", "album", "event"]);
  const V1_EVENTS = new Set(["opener", "microtonal", "marathonJam", "bustOut", "neverCaught"]);

  it("never emits a segue event and only ever emits v1 catalog kinds", () => {
    const ctx = bingoContext();
    const dex = caught();
    const producedEvents = new Set<string>();

    for (const vibe of VIBES) {
      for (const seed of SEEDS) {
        const card = deal(seed, vibe, ctx, dex, CORPUS);
        for (const sq of card.squares) {
          expect(V1_KINDS.has(sq.kind)).toBe(true);
          if (sq.kind === "event") {
            producedEvents.add(sq.event);
            expect(V1_EVENTS.has(sq.event)).toBe(true);
          }
        }
      }
    }

    // Segue is structurally impossible — it is not in the BingoEvent union nor
    // ever produced across the whole sample.
    expect(producedEvents.has("segue")).toBe(false);
    // The sample actually exercises event squares (guards against a vacuous pass).
    expect(producedEvents.size).toBeGreaterThan(0);
  });
});
