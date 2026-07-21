/**
 * The ONE shared 4×4 Gizz-Bingo board (Phase 16, BINGO-04). Extracted verbatim
 * from RecapView's inline 4×4 render (`RecapView.tsx:344-381`) so replay, the
 * live GamesView board, and the peek-strip thumbnail all render byte-identically
 * from a SINGLE component — they can never visually diverge (RESEARCH
 * Anti-Pattern). Marks are NEVER stored: the board is a pure function of its
 * `(marked, wins, songNameByPosition)` props, every one of which the caller
 * re-derives via the shared `bingoReplay` adapter (D-23).
 *
 * ONE component, TWO disclosure behaviors via `captionMode`:
 *  - `'persistent'` (replay/RecapView, Phase-15 D-06): the always-on "lit by
 *    {song}" caption under each marked non-free square — the extracted inline
 *    render, unchanged.
 *  - `'tapReveal'` (live board, D-16): a CLEAN stamp with NO persistent caption;
 *    tapping a marked square toggles a transient "lit by {song}" reveal (info
 *    retrievable later, uncluttered 4×4). The reveal is internal transient state,
 *    independent of `onSquareTap`.
 *
 * Squares are focusable toggle `<button>`s (D-24) with `aria-pressed` = marked
 * and an accessible label — NO ARIA live regions. Colors are DATA-SEMANTIC, not
 * accent chrome (marked `#22C55E`, unmarked `#17171F`/`#2A2A34`); the accent
 * `#f2c14e` is reserved for the focus ring + the single one-away glow. The
 * word/glyph always renders (WCAG 1.4.1) — color is never the sole carrier. All
 * kglw-derived names render as escaped React text (T-06-21).
 */
import { useState } from "react";
import type { MarkedCard, Win } from "@guezzer/core";
import { config } from "../config.ts";

/** Data-semantic board hexes (RecapView B3 principle) — copied verbatim from the extracted render. */
const MARKED_BG = "#22C55E";
const MARKED_FG = "#0C0C10";
const UNMARKED_BG = "#17171F";
const UNMARKED_FG = "#F5F5F7";
const UNMARKED_BORDER = "#2A2A34";

export interface BingoBoardProps {
  /** The pure marking fold output (never stored — re-derived every render, D-23). */
  marked: MarkedCard;
  /** Detected wins over `marked`; winning squares carry `data-win` for later celebration wiring. */
  wins: Win[];
  /** Reindexed trail-position → songName for the "lit by {song}" caption (D-06). */
  songNameByPosition: Map<number, string>;
  /**
   * Caption disclosure: `'persistent'` renders the always-on lit-by caption
   * (replay, D-06); `'tapReveal'` renders a clean stamp, surfacing the lit-by
   * song only on tap of a marked square (live board, D-16).
   */
  captionMode: "persistent" | "tapReveal";
  /**
   * EXTERNAL tap handler for the draft/build board (Plan 03 wires it to the swap
   * sheet). Orthogonal to the tapReveal disclosure — fired for EVERY square tap
   * with the square index, regardless of `captionMode`.
   */
  onSquareTap?: (index: number) => void;
  /** The single closest near-miss square index — wears the accent one-away glow ring (D-14). */
  oneAwayIndex?: number | null;
  /** Shrinks the label + min-height for the in-flow peek-strip thumbnail (D-21). */
  thumbnail?: boolean;
}

/** Accessible per-square label — marked/unmarked + the lit-by song when known (no ARIA live region). */
function squareAriaLabel(label: string, isMarked: boolean, litName: string | null): string {
  if (!isMarked) return `${label}, unmarked`;
  if (litName != null && litName !== "") return `${label}, marked, lit by ${litName}`;
  return `${label}, marked`;
}

export function BingoBoard({
  marked,
  wins,
  songNameByPosition,
  captionMode,
  onSquareTap,
  oneAwayIndex,
  thumbnail = false,
}: BingoBoardProps) {
  const copy = config.copy.recap;
  // tapReveal transient state (D-16): which marked square is currently revealing
  // its lit-by song. Never persisted — a pure UI disclosure toggle, absent in
  // persistent mode.
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);

  // Winning square indices — a non-visual `data-win` marker for later celebration
  // diffing (Plan 05). Does NOT alter the rendered board (keeps RecapView byte-identical).
  const winningIndices = new Set<number>();
  for (const win of wins) for (const idx of win.indices) winningIndices.add(idx);

  return (
    <div className="grid grid-cols-4 gap-2">
      {marked.squares.map((square) => {
        const isMarked = square.markedByPosition !== null;
        const isFree = square.def.kind === "free";
        const label = square.def.kind === "free" ? copy.bingoFreeLabel : square.def.label;
        const litName =
          isMarked && !isFree
            ? songNameByPosition.get(square.markedByPosition as number) ?? null
            : null;
        const isOneAway = oneAwayIndex != null && oneAwayIndex === square.index;
        // Caption visibility: always-on in persistent mode; tap-gated in tapReveal
        // mode; never in the tiny thumbnail. `litName` gates presence either way.
        const showCaption =
          !thumbnail &&
          litName != null &&
          litName !== "" &&
          (captionMode === "persistent" || revealedIndex === square.index);

        return (
          <button
            key={square.index}
            type="button"
            aria-pressed={isMarked}
            aria-label={squareAriaLabel(label, isMarked, litName)}
            data-square-index={square.index}
            data-win={winningIndices.has(square.index) ? "true" : undefined}
            data-oneaway={isOneAway ? "true" : undefined}
            onClick={() => {
              // tapReveal disclosure is internal + independent of onSquareTap:
              // toggle the transient reveal for a marked non-free square only.
              if (captionMode === "tapReveal" && isMarked && !isFree) {
                setRevealedIndex((prev) => (prev === square.index ? null : square.index));
              }
              onSquareTap?.(square.index);
            }}
            className={`flex ${
              thumbnail ? "min-h-11" : "min-h-[80px]"
            } flex-col items-center justify-center gap-1 rounded-md p-2 text-center touch-manipulation${
              isOneAway ? " bingo-oneaway-glow" : ""
            }`}
            style={
              isMarked
                ? { backgroundColor: MARKED_BG, color: MARKED_FG, border: "none" }
                : {
                    backgroundColor: UNMARKED_BG,
                    color: UNMARKED_FG,
                    border: `1px solid ${UNMARKED_BORDER}`,
                  }
            }
          >
            <span
              className={`line-clamp-2 ${
                thumbnail ? "text-[10px]" : "text-[12px]"
              } font-semibold leading-tight`}
            >
              {label}
            </span>
            {showCaption && (
              <span
                className="line-clamp-1 text-[10px] leading-tight"
                style={{ color: MARKED_FG, opacity: 0.72 }}
              >
                {copy.bingoLitBy(litName as string)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
