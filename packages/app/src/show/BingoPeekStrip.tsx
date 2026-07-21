/**
 * The in-flow LiveGizz bingo peek strip (Phase 16, BINGO-04, D-21). A `bg-elevated`
 * card that lives in the show column (NEVER fixed, never over the FAB/orbit — the
 * setlist log is sacred), rendering a compact `<BingoBoard thumbnail>` of the live
 * board plus the SINGLE closest one-away banner. Tapping it routes to the full
 * board in GizzGames (`#/games`).
 *
 * Marks are NEVER stored (D-23): the board is re-derived from `deriveLiveBoard`
 * over the live (still-growing) trail + the card's FROZEN `caughtSnapshot` (frozen
 * at Start Show, D-08) on every render, so it re-lights on every `logSong` as a
 * pure consequence of `session.entries` changing — and a song caught for the first
 * time tonight lights its `neverCaught` square instead of being masked by the
 * growing live dex (CR-01: live == replay == catch-up). The `nearMiss` one-away detector picks the single closest target and
 * glows exactly that one needed square (D-14) — a line ("🔥 One away…") or the
 * blackout crown ("👑 ONE SQUARE FROM BLACKOUT", D-15); null → no banner.
 *
 * TAP-TARGET / A11Y shape: the strip is ONE keyboard-operable control
 * (`role="link"` + `tabIndex` + Enter/Space) with a min-h-11 tap zone. The
 * `<BingoBoard>` thumbnail is `aria-hidden` + `pointer-events-none` — decorative
 * here (its live tap-to-reveal belongs to the full GamesView board), which also
 * avoids nesting the board's per-square `<button>`s inside an interactive control.
 * The one-away ring is a STATIC accent outline by default and only pulses under
 * `prefers-reduced-motion: no-preference` (handled in styles.css `.bingo-oneaway-glow`).
 * All kglw-derived labels render as escaped React text (T-16-06).
 */
import { useMemo } from "react";
import { nearMiss, type BingoCard } from "@guezzer/core";
import { config } from "../config.ts";
import { navigate } from "../routing/useHashRoute.ts";
import { BingoBoard } from "../components/BingoBoard.tsx";
import { deriveLiveBoard } from "../games/bingoReplay.ts";
import { getBingoContext } from "../games/bingoContext.ts";
import type { TrackedEntry } from "../db/db.ts";

export interface BingoPeekStripProps {
  /** The session's locked card (Task 2 mounts the strip only for a locked/active card). */
  card: BingoCard;
  /** The caught-set FROZEN at Start Show (D-08) — the marking baseline, so tonight's
   *  first catches light instead of reading as already-caught (CR-01). */
  caughtSnapshot: readonly number[];
  /** The live setlist trail — the strip re-derives on every change (logSong). */
  entries: readonly TrackedEntry[];
}

export function BingoPeekStrip({ card, caughtSnapshot, entries }: BingoPeekStripProps) {
  const copy = config.copy.games.bingo;
  // The memoized marking context (built once). The caught-set is the card's FROZEN
  // caughtSnapshot (NOT the growing live dex) so the strip agrees with the
  // celebration driver + replay on the sacred LiveGizz screen (CR-01).
  const ctxResult = getBingoContext();

  // Re-derive the live board + its single closest one-away target. Pure over the
  // trail + frozen snapshot; recomputed only when they (or the card) change. Marks
  // are never stored (D-23).
  const derived = useMemo(() => {
    if (!ctxResult) return null;
    const caught = new Set(caughtSnapshot);
    const board = deriveLiveBoard(card, entries, ctxResult.ctx, caught);
    const miss = nearMiss(board.marked, card, ctxResult.ctx, caught);
    return { board, miss };
  }, [ctxResult, card, entries, caughtSnapshot]);

  // Loading shell (ctx/dex not ready) → render nothing rather than a broken strip.
  if (!derived) return null;
  const { board, miss } = derived;

  // The single closest one-away banner (D-13/D-14/D-15): blackout crowns a line.
  const banner =
    miss == null
      ? null
      : miss.kind === "blackout"
        ? copy.blackoutOneAwayCallout
        : copy.lineOneAwayBanner(miss.bucket);

  const goToBoard = () => navigate("games");

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label="Open your bingo board"
      onClick={goToBoard}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToBoard();
        }
      }}
      className="mx-3 mb-2 flex min-h-11 shrink-0 cursor-pointer flex-col gap-2 rounded-md border border-hairline bg-elevated p-3"
    >
      {/* Decorative thumbnail — aria-hidden + pointer-events-none so the whole
          strip is one clean tap target (the board's live tap-to-reveal lives on
          the full GamesView board, not here). */}
      <div aria-hidden className="pointer-events-none">
        <BingoBoard
          marked={board.marked}
          wins={board.wins}
          songNameByPosition={board.songNameByPosition}
          captionMode="tapReveal"
          oneAwayIndex={miss?.neededSquareIndex ?? null}
          thumbnail
        />
      </div>

      {banner && (
        <p className="text-center text-[14px] font-semibold leading-tight text-accent">
          {banner}
        </p>
      )}
    </div>
  );
}
