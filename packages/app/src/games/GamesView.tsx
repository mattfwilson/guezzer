/**
 * `#/games` root — the GizzGames tab. Phase-16 (BINGO-01/02/04) turns the
 * Phase-15 "Deal — coming soon" teaser into the real build + live-marking
 * surface. A small state machine drives the top region off the active session's
 * bingo card:
 *   - no draft card for the active session → `<DealScreen>` (three vibe buttons
 *     that ARE the deal, D-01);
 *   - an UNLOCKED draft card → the draft `<BingoBoard>` with a persistent
 *     `<FillMeter>` above it and a tap-to-swap `<SwapSheet>` (build agency,
 *     BINGO-02); the vibe label flips to "Custom" on deviation (D-04);
 *   - a LOCKED + active card → the live `<BingoBoard captionMode="tapReveal">`
 *     derived over the live trail (`deriveLiveBoard`) — each mark a clean stamp,
 *     tap a marked square to reveal which song lit it (D-16), NO swap.
 * Below the machine, the replayable-card list + honest empty state are unchanged.
 *
 * Marks are NEVER stored (D-23): the board is re-derived every render via the
 * shared `deriveLiveBoard` adapter, so `live == replay == catch-up`. Dexie is the
 * single source of truth via `useLiveQuery`. All kglw-derived strings render as
 * escaped React text only (T-16-04).
 */
import { useState, type ReactElement } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { deal, estimateFill, type BingoCard } from "@guezzer/core";
import { BingoBoard } from "../components/BingoBoard.tsx";
import { config } from "../config.ts";
import { db, saveDraftCard, type BingoCardRow } from "../db/db.ts";
import { useDexStats } from "../dex/useDexStats.ts";
import { randomUUID } from "../uuid.ts";
import { dexSnapshot, getBingoContext } from "./bingoContext.ts";
import { deriveLiveBoard } from "./bingoReplay.ts";
import { getBingoNameMaps, isCardCustom, resolveCardLabels } from "./bingoLabels.ts";
import { DealScreen } from "./DealScreen.tsx";
import { FillMeter } from "./FillMeter.tsx";
import { SwapSheet } from "./SwapSheet.tsx";

/** Denormalized card identity → a "{venue} · {city}" subline (both nullable). */
function cardSubline(card: BingoCardRow): string {
  const parts = [card.showDate, card.city].filter((p): p is string => !!p);
  return parts.join(" · ");
}

export function GamesView() {
  const copy = config.copy.games;
  const bingoCopy = config.copy.games.bingo;

  // Dexie is the single source of truth — a newly-dealt/locked card appears live.
  const cards = useLiveQuery(() => db.bingoCards.toArray());
  const activeShow = useLiveQuery(() =>
    db.trackedShows.where("status").equals("active").first(),
  );
  const trackedEntries = useLiveQuery(() => db.trackedEntries.toArray());
  const stats = useDexStats();

  const ctxResult = getBingoContext();
  const nameMaps = getBingoNameMaps();

  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  const hasCards = cards != null && cards.length > 0;

  // The active session's draft/live card (if any) — the state-machine input.
  const activeCard =
    activeShow != null && cards != null
      ? cards.find((c) => c.sessionId === activeShow.sessionId)
      : undefined;
  const boardReady = ctxResult != null && stats.dex != null;

  const snapshot = stats.dex != null ? dexSnapshot(stats.dex) : new Set<number>();

  const openSwap = (index: number): void => {
    // The free center is never swappable (it has no candidate identity).
    if (activeCard != null && activeCard.card.squares[index]?.kind !== "free") {
      setSwapIndex(index);
    }
  };

  const handleApplySwap = (nextCard: BingoCard): void => {
    if (activeShow == null) return;
    void saveDraftCard({
      sessionId: activeShow.sessionId,
      card: nextCard,
      showDate: activeShow.date,
      venueName: activeShow.venueName,
      city: activeShow.city,
    }).then(() => setSwapIndex(null));
  };

  const handleReshuffle = (): void => {
    if (activeShow == null || activeCard == null || ctxResult == null) return;
    const seed = randomUUID();
    const nextCard = resolveCardLabels(
      deal(seed, activeCard.card.vibe, ctxResult.ctx, snapshot, ctxResult.corpusVersion),
      nameMaps,
    );
    void saveDraftCard({
      sessionId: activeShow.sessionId,
      card: nextCard,
      showDate: activeShow.date,
      venueName: activeShow.venueName,
      city: activeShow.city,
    }).then(() => setSwapIndex(null));
  };

  // Build the draft/live board region only when the card + context are ready.
  let editor: ReactElement | null = null;
  if (activeCard != null && boardReady && ctxResult != null) {
    const ctx = ctxResult.ctx;
    const unlocked = activeCard.lockedAt == null;
    const sessionEntries =
      activeShow != null
        ? (trackedEntries ?? []).filter((e) => e.sessionId === activeShow.sessionId)
        : [];

    // Draft = all-unmarked (empty trail); live = the growing session trail.
    const board = deriveLiveBoard(
      activeCard.card,
      unlocked ? [] : sessionEntries,
      ctx,
      snapshot,
    );
    const custom = isCardCustom(activeCard.card, ctx, snapshot);
    const vibeLabel = custom
      ? bingoCopy.customVibeLabel
      : bingoCopy.vibeLabels[activeCard.card.vibe];

    editor = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-elevated px-3 py-1 text-[14px] font-semibold text-text-primary">
            {vibeLabel}
          </span>
          {!unlocked && (
            <span className="text-[14px] leading-tight text-text-muted">
              {bingoCopy.lockedExplainer}
            </span>
          )}
        </div>

        {/* Persistent difficulty meter above the draft board (D-10/D-11/D-12). */}
        {unlocked && <FillMeter estimate={estimateFill(activeCard.card, ctx, snapshot)} />}

        {/* Draft board taps → swap sheet; locked live board is clean-stamp tap-reveal. */}
        <BingoBoard
          marked={board.marked}
          wins={board.wins}
          songNameByPosition={board.songNameByPosition}
          captionMode="tapReveal"
          onSquareTap={unlocked ? openSwap : undefined}
        />

        {unlocked && swapIndex != null && (
          <SwapSheet
            open
            onClose={() => setSwapIndex(null)}
            card={activeCard.card}
            squareIndex={swapIndex}
            ctx={ctx}
            nameMaps={nameMaps}
            isCustom={custom}
            onApplySwap={handleApplySwap}
            onReshuffle={handleReshuffle}
          />
        )}
      </div>
    );
  } else if (activeCard == null) {
    // No draft card for the active session → the deal screen (D-01).
    editor = <DealScreen />;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-8 pb-16">
      <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
        {copy.sectionHeading}
      </h1>

      {editor}

      {/* Replay list, or the honest empty state (D-02) — never blank, never error. */}
      {hasCards ? (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <li key={card.cardId}>
              <div className="flex min-h-11 flex-col justify-center rounded-md border border-hairline bg-elevated px-4 py-3">
                <span className="min-w-0 truncate text-base font-semibold text-text-primary">
                  {card.venueName ?? card.showDate}
                </span>
                {cardSubline(card) && (
                  <span className="min-w-0 truncate text-[14px] leading-tight text-text-muted">
                    {cardSubline(card)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-[20px] font-semibold leading-tight text-text-primary">
            {copy.emptyHeading}
          </p>
          <p className="text-base leading-normal text-text-muted">{copy.emptyBody}</p>
        </div>
      )}
    </div>
  );
}
