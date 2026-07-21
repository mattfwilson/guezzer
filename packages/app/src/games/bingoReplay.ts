/**
 * BINGO-07 replay adapter (plan 15-03) — the single pure app→core bridge that
 * re-derives a frozen bingo card's final board over the persisted setlist trail.
 * Marks are NEVER stored (D-23): every read re-derives, so re-opening a past
 * show yields a byte-identical board to what the user saw live. This same
 * adapter is the shared derivation for replay AND (Phase 16) live marking /
 * catch-up preview, so `live == replay == catch-up` holds by construction.
 *
 * TWO load-bearing correctness points (15-RESEARCH Pitfalls 1+2):
 *  (1) 0-based CONTIGUOUS reindex — `TrackedEntry.position` is 1-based and gapped
 *      (deleteEntry leaves holes, db.ts); `mark.ts` hard-codes opener = index 0,
 *      so we sort a COPY by stored position and assign fresh 0..N-1 indices.
 *  (2) FROZEN `row.caughtSnapshot` — the `neverCaught` predicate reads it, so a
 *      later show's catch can never retroactively un-mark a replayed square.
 *
 * Only the minimal `{songId, position, isPlaceholder}` subset is handed to the
 * core fold (D-22) — the raw app row never crosses the boundary.
 */
import {
  buildBingoContext,
  deriveMarks,
  detectWins,
  type ArchiveArtifact,
  type BingoCard,
  type BingoContext,
  type DexAlbumsArtifact,
  type MarkedCard,
  type MarkTrailEntry,
  type RarityIndex,
  type TransitionMatrix,
  type Win,
} from "@guezzer/core";
import type { BingoCardRow, TrackedEntry } from "../db/db.ts";

/**
 * The replay result: the re-derived board, its detected wins, and a
 * reindexed-position → songName map for the D-06 "Lit by {song}" caption
 * (`MarkedSquare.markedByPosition` indexes into it). Built from the SAME 0-based
 * reindex the fold consumed, so the caption is always the song that lit the cell.
 */
export interface ReplayResult {
  marked: MarkedCard;
  wins: Win[];
  songNameByPosition: Map<number, string>;
}

/**
 * Correctness point (1): sort a COPY of the app entries by the stored 1-based
 * gapped `position`, then assign fresh CONTIGUOUS 0..N-1 indices — the reindex
 * `mark.ts` relies on for `opener` (index 0). The same reindex builds the
 * position → songName map, so the caption always resolves to the song that lit
 * the cell. Factored here so `replayCard` (frozen snapshot) and `deriveLiveBoard`
 * (live snapshot) share ONE reindex — `live == replay == catch-up` by construction.
 * Only the minimal `{songId, position, isPlaceholder}` subset crosses to core (D-22).
 */
function adaptTrail(entries: readonly TrackedEntry[]): {
  trail: MarkTrailEntry[];
  songNameByPosition: Map<number, string>;
} {
  const sorted = [...entries].sort((a, b) => a.position - b.position);
  const trail: MarkTrailEntry[] = sorted.map((e, index) => ({
    songId: e.songId,
    position: index,
    isPlaceholder: e.isPlaceholder,
  }));
  const songNameByPosition = new Map<number, string>(
    sorted.map((e, index) => [index, e.songName]),
  );
  return { trail, songNameByPosition };
}

/**
 * `replayCard(row, entries, matrix, archive, rarity, albums) -> ReplayResult`.
 * Reconstructs the pure `BingoCard` from `row.card`, builds the shipped-artifact
 * context, adapts the trail with the two correctness points, and folds → marks +
 * wins. Pure over its inputs — no I/O, no Dexie writes, no wall-clock.
 */
export function replayCard(
  row: BingoCardRow,
  entries: readonly TrackedEntry[],
  matrix: TransitionMatrix,
  archive: ArchiveArtifact,
  rarity: RarityIndex,
  albums: DexAlbumsArtifact,
): ReplayResult {
  const { trail, songNameByPosition } = adaptTrail(entries);

  const ctx = buildBingoContext(matrix, archive, rarity, albums);
  // (2) FROZEN caught-set — never the live dex (drives `neverCaught`, D-12).
  const caughtSnapshot = new Set(row.caughtSnapshot);
  const marked = deriveMarks(row.card, trail, ctx, caughtSnapshot);
  const wins = detectWins(marked);

  return { marked, wins, songNameByPosition };
}

/**
 * `deriveLiveBoard(card, liveEntries, ctx, liveCaughtSnapshot) -> ReplayResult`.
 * The LIVE sibling of `replayCard` (Phase 16, BINGO-04): re-derives the board over
 * the LIVE (unlocked, still-growing) trail with the LIVE caught-set, using the
 * SAME 0-based opener reindex (`adaptTrail`) so the live board is byte-identical to
 * the eventual replay of the same trail. It takes a PRE-BUILT `ctx` (callers pass
 * `getBingoContext().ctx`, memoized once — never rebuilt per render, RESEARCH
 * Pitfall 2) and the caller's live caught-snapshot (NON-frozen — the growing dex,
 * NOT `row.caughtSnapshot`; freezing it here would be RESEARCH Pitfall 1). Pure
 * over its inputs — no I/O, no Dexie writes, no wall-clock.
 */
export function deriveLiveBoard(
  card: BingoCard,
  liveEntries: readonly TrackedEntry[],
  ctx: BingoContext,
  liveCaughtSnapshot: ReadonlySet<number>,
): ReplayResult {
  const { trail, songNameByPosition } = adaptTrail(liveEntries);
  const marked = deriveMarks(card, trail, ctx, liveCaughtSnapshot);
  const wins = detectWins(marked);

  return { marked, wins, songNameByPosition };
}
