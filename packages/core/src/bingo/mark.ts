/**
 * BINGO-03 (D-07/D-08/D-09/D-10/D-11/D-23): the load-bearing pure marking fold.
 * `deriveMarks(card, trail, ctx, caughtSnapshot, cfg) -> MarkedCard` is a
 * deterministic consume-once greedy walk over the play-ordered trail — each
 * logged song lights its single most-specific still-UNMARKED square by the
 * total tie-break order (specificityRank, then lowest board index), the free
 * cell is pre-marked (D-06), and null/placeholder entries are skipped (v1
 * policy A2). Because it is one pure function of the position-sorted trail,
 * `live == replay == catch-up` holds by construction (T-14-05).
 *
 * Zero I/O, no Dexie/DOM types, no wall-clock or entropy reads, no app row
 * type imported (D-22) — mirrors `dex/derive-dex.ts`'s module discipline
 * exactly (config injected with a default, ascending-order walk, explicit
 * stable comparators). The specificity literals are NEVER inlined: the
 * tie-break rank is always read from `cfg.bingo.specificityRank`.
 */
import { config } from "../config.ts";
import type { BingoContext } from "./context.ts";
import {
  FREE_SENTINEL,
  type BingoCard,
  type BingoSquareDef,
  type MarkedCard,
  type MarkedSquare,
} from "./types.ts";

/**
 * The minimal structural trail contract the fold reads (D-22): never an app
 * setlist row type — the app adapts its rows to this `{songId, position,
 * isPlaceholder}` subset (Phase 16). A placeholder / not-yet-identified miss
 * carries a `null` songId.
 */
export interface MarkTrailEntry {
  readonly songId: number | null;
  readonly position: number;
  readonly isPlaceholder: boolean;
}

/**
 * Map a resolved square def to its `cfg.bingo.specificityRank` key: a `song`
 * def → "song", an `album` def → "album", an `event` def → its event name
 * (opener/microtonal/marathonJam/bustOut/neverCaught). The `free` cell has no
 * rank — it is pre-marked and never enters the qualifying pool, so it is
 * unreachable here.
 */
function kindKey(def: BingoSquareDef): keyof typeof config.bingo.specificityRank {
  switch (def.kind) {
    case "song":
      return "song";
    case "album":
      return "album";
    case "event":
      return def.event;
    case "free":
      // Unreachable: the free cell is pre-marked and never qualifies.
      throw new Error("kindKey: the free cell has no specificity rank");
  }
}

/**
 * The per-square predicate (RESEARCH §"squareMatches predicates"): does a song
 * played at `position` satisfy this square? Pure over songId + position + ctx +
 * caughtSnapshot. `songId` is a non-null number here (null entries are skipped
 * upstream). The `free` cell never reaches this — it is pre-marked.
 */
function squareMatches(
  def: BingoSquareDef,
  songId: number,
  position: number,
  ctx: BingoContext,
  caughtSnapshot: ReadonlySet<number>,
  cfg: typeof config,
): boolean {
  switch (def.kind) {
    case "free":
      return false;
    case "song":
      return songId === def.songId;
    case "album":
      return ctx.albumSongIds.get(def.albumUrl)?.has(songId) ?? false;
    case "event":
      switch (def.event) {
        case "opener":
          return position === 0; // D-22: opener = play-order index 0
        case "microtonal":
          return ctx.microtonalSongIds.has(songId);
        case "marathonJam":
          return ctx.jamVehicleSongIds.has(songId);
        case "bustOut":
          return (ctx.corpusGap.get(songId) ?? 0) >= cfg.bingo.bustOutGapShows;
        case "neverCaught":
          // D-12: frozen snapshot — a song caught for the first time tonight is
          // NOT in the snapshot, so it still matches (by design, T-14-07).
          return !caughtSnapshot.has(songId);
      }
  }
}

/**
 * `deriveMarks(card, trail, ctx, caughtSnapshot, cfg) -> MarkedCard`. The pure
 * consume-once greedy fold:
 *  (D-06) pre-mark the free cell with `FREE_SENTINEL`;
 *  walk the trail in ASCENDING play position (stable);
 *  skip `isPlaceholder` / null-songId entries entirely (v1 policy A2);
 *  each surviving entry marks its single best still-unmarked qualifying square,
 *  chosen by `argmin (cfg.bingo.specificityRank[kind], boardIndex)` — a TOTAL
 *  order, so ties are impossible and `live == replay == catch-up` (T-14-05);
 *  a marked square leaves the pool, so one song lights ≤1 square and one square
 *  is lit by ≤1 entry (structural consume-once, D-11 / T-14-06).
 */
export function deriveMarks(
  card: BingoCard,
  trail: ReadonlyArray<MarkTrailEntry>,
  ctx: BingoContext,
  caughtSnapshot: ReadonlySet<number>,
  cfg: typeof config = config,
): MarkedCard {
  // Working board: every square unmarked, carrying its frozen def + board index.
  const marked: MarkedSquare[] = card.squares.map((def, index) => ({
    def,
    index,
    markedByPosition: null,
  }));

  // D-06: the free cell is marked from the start, with no trail position owning it.
  marked[card.freeIndex].markedByPosition = FREE_SENTINEL;

  // (1) stable ascending walk by play position — the single derivation order
  // that makes live == replay == catch-up hold by construction.
  const ordered = [...trail].sort((a, b) => a.position - b.position);

  for (const entry of ordered) {
    // (2) skip placeholder / not-yet-identified entries entirely (A2 v1 policy);
    // a later rename to a real song re-derives and lights the square for free.
    if (entry.isPlaceholder || entry.songId == null) continue;
    const songId = entry.songId;

    // (3) argmin over still-unmarked qualifying squares of
    // (specificityRank[kind], boardIndex) — total order, no ambiguity (D-08→D-10).
    let winner: MarkedSquare | null = null;
    let winnerRank = Infinity;
    for (const square of marked) {
      if (square.markedByPosition !== null) continue; // already consumed
      if (!squareMatches(square.def, songId, entry.position, ctx, caughtSnapshot, cfg)) {
        continue;
      }
      const rank = cfg.bingo.specificityRank[kindKey(square.def)];
      // Lower rank wins; ties break by lowest board index. `marked` is walked in
      // ascending index, so a strict `<` on rank keeps the first (lowest-index)
      // square within a tier — no separate index comparison needed.
      if (rank < winnerRank) {
        winner = square;
        winnerRank = rank;
      }
    }

    // Consume BOTH the song and the winning square (D-11); no qualifier → nothing.
    if (winner !== null) winner.markedByPosition = entry.position;
  }

  // markedCount includes the pre-marked free cell (any non-null markedByPosition).
  let markedCount = 0;
  for (const square of marked) {
    if (square.markedByPosition !== null) markedCount += 1;
  }

  return { squares: marked, markedCount };
}
