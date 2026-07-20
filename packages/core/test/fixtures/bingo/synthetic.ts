/**
 * Shared synthetic fixtures for the Phase-14 gizz-bingo suite (context / marking
 * fold / generator / wins). Override-spread factory idiom copied from
 * test/fixtures/dex/synthetic.ts: every factory takes a `Partial<...>` override
 * so a test states only the fields it cares about.
 *
 * Hand-authored so expected marks and wins are known by construction. The small
 * known catalog spans one song of every predicate the marking fold cares about —
 * a plain song, a microtonal song, an album-member song, a bust-out-gap song, a
 * never-caught song, and a marathon-jam-vehicle song. Consumed read-only by the
 * downstream Plans 03 (`deriveMarks`) and 04 (`deal`).
 *
 * The `BingoContext` value produced here is the RESOLVED lookup bundle
 * `buildBingoContext` emits — downstream tests take it as an input, they do not
 * re-resolve artifacts.
 */
import { config } from "../../../src/config.ts";
import type { BingoContext } from "../../../src/bingo/context.ts";
import {
  FREE_SENTINEL,
  type BingoCard,
  type BingoSquareDef,
  type MarkedCard,
  type MarkedSquare,
} from "../../../src/bingo/types.ts";

// ── Known catalog ──────────────────────────────────────────────────────────
// One song per marking predicate so a downstream expected mark is known by
// construction. Exported so tests reference the ids by name, not magic numbers.

/** A plain song — no special predicate holds. */
export const SONG_PLAIN = 10;
/** A microtonal-tuned song (`tuningFamily === "microtonal"`). */
export const SONG_MICROTONAL = 20;
/** A studio-album-member song (member of `ALBUM_URL`). */
export const SONG_ALBUM = 30;
/** A bust-out song: its `corpusGap` clears `cfg.bingo.bustOutGapShows`. */
export const SONG_BUSTOUT = 40;
/** A never-caught song — absent from every caught snapshot by default. */
export const SONG_NEVER_CAUGHT = 50;
/** A marathon-jam-vehicle song (member of `cfg.bingo.jamVehicleSongIds`). */
export const SONG_JAM_VEHICLE = 60;

/** The one album whose membership the fixtures wire up. */
export const ALBUM_URL = "/albums/alpha";

// ── BingoContext (resolved lookup bundle) ──────────────────────────────────

/**
 * The resolved `BingoContext` the fold/generator consume. Defaults wire each
 * known-catalog song to exactly the predicate its name advertises. Override any
 * lookup to sharpen a single behavior under test.
 */
export function bingoContext(over: Partial<BingoContext> = {}): BingoContext {
  return {
    microtonalSongIds: new Set<number>([SONG_MICROTONAL]),
    corpusGap: new Map<number, number>([
      [SONG_PLAIN, 0],
      [SONG_MICROTONAL, 3],
      [SONG_ALBUM, 5],
      [SONG_BUSTOUT, config.bingo.bustOutGapShows + 30],
      [SONG_NEVER_CAUGHT, 12],
      [SONG_JAM_VEHICLE, 7],
    ]),
    albumSongIds: new Map<string, ReadonlySet<number>>([
      [ALBUM_URL, new Set<number>([SONG_ALBUM])],
    ]),
    jamVehicleSongIds: new Set<number>([SONG_JAM_VEHICLE]),
    eraPlayRate: new Map<number, number>([
      [SONG_PLAIN, 8],
      [SONG_MICROTONAL, 2],
      [SONG_ALBUM, 4],
      [SONG_BUSTOUT, 0],
      [SONG_NEVER_CAUGHT, 1],
      [SONG_JAM_VEHICLE, 3],
    ]),
    ...over,
  };
}

// ── Trail entries ──────────────────────────────────────────────────────────

/**
 * A trail entry as the marking fold reads it — the minimal `{songId, position,
 * isPlaceholder}` structural subset (never an app row type, D-22). A
 * placeholder miss carries a `null` songId.
 */
export interface FixtureTrailEntry {
  songId: number | null;
  position: number;
  isPlaceholder: boolean;
}

export function trailEntry(over: Partial<FixtureTrailEntry> = {}): FixtureTrailEntry {
  return {
    songId: SONG_PLAIN,
    position: 0,
    isPlaceholder: false,
    ...over,
  };
}

// ── Caught snapshot ────────────────────────────────────────────────────────

/** The frozen caught-song snapshot the never-caught predicate reads against. */
export function caught(ids: Iterable<number> = []): Set<number> {
  return new Set<number>(ids);
}

// ── BingoCard (unmarked, serializable) ─────────────────────────────────────

/**
 * A serializable `BingoCard`. Defaults lay out 16 row-major squares with the
 * free cell at `cfg.bingo.freeIndex`; every other cell is a distinct `song`
 * square so downstream marking has 15 targetable positions.
 */
export function bingoCard(over: Partial<BingoCard> = {}): BingoCard {
  const freeIndex = over.freeIndex ?? config.bingo.freeIndex;
  const squares: BingoSquareDef[] =
    over.squares ??
    Array.from({ length: 16 }, (_unused, index): BingoSquareDef =>
      index === freeIndex
        ? { kind: "free" }
        : { kind: "song", songId: 100 + index, label: `Square ${index}` },
    );
  return {
    schemaVersion: 1,
    seed: "seed-1",
    vibe: "balanced",
    corpusVersion: "test-corpus",
    freeIndex,
    squares,
    ...over,
  };
}

// ── MarkedCard (post-fold, for win-detection tests) ────────────────────────

/**
 * Build a `MarkedCard` directly from the set of marked board indices — the free
 * cell at `freeIndex` is ALWAYS pre-marked with `FREE_SENTINEL` (D-06), so it
 * counts toward every line/diagonal/corners/blackout without a trail position.
 * Non-free marked indices record their own index as the marking position; all
 * other cells stay unmarked (`markedByPosition === null`).
 */
export function markedCard(
  markedIndices: Iterable<number> = [],
  opts: { freeIndex?: number } = {},
): MarkedCard {
  const freeIndex = opts.freeIndex ?? config.bingo.freeIndex;
  const marked = new Set<number>(markedIndices);
  const squares: MarkedSquare[] = [];
  let markedCount = 0;
  for (let index = 0; index < 16; index++) {
    let def: BingoSquareDef;
    let markedByPosition: number | null;
    if (index === freeIndex) {
      def = { kind: "free" };
      markedByPosition = FREE_SENTINEL;
    } else {
      def = { kind: "song", songId: 100 + index, label: `Square ${index}` };
      markedByPosition = marked.has(index) ? index : null;
    }
    if (markedByPosition !== null) markedCount += 1;
    squares.push({ def, index, markedByPosition });
  }
  return { squares, markedCount };
}
