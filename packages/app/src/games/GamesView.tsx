/**
 * `#/games` root (plan 15-03, D-01/D-02) — the GizzGames tab: the replay-only
 * home for Gizz Bingo. Two parts:
 *  - a "Deal a card — Coming soon" teaser whose affordance is visibly DISABLED
 *    (the Phase-16 deal entry point will land here); it must read as forthcoming,
 *    never broken or errored.
 *  - a live list of past shows that have a bingo card (each replayable via its
 *    RecapView, already reachable from Dex history this phase).
 *
 * Read-only. The empty state (no cards yet) is INTENTIONAL, not broken (D-02):
 * the teaser + a friendly empty-list message always render — never a bare blank
 * screen or an error. Dexie is the single source of truth via `useLiveQuery`.
 *
 * All kglw-derived strings (venue / city) render as escaped React text only
 * (T-06-21) — never `dangerouslySetInnerHTML`. Rendered inside AppShell's
 * `<main>`, BELOW the header that already owns the notch inset, so a plain top
 * pad (matching SettingsView) is used — re-applying `env(safe-area-inset-top)`
 * here would double it on notched iPhones (the documented doubled-inset bug).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { config } from "../config.ts";
import { db, type BingoCardRow } from "../db/db.ts";

/** Denormalized card identity → a "{venue} · {city}" subline (both nullable). */
function cardSubline(card: BingoCardRow): string {
  const parts = [card.showDate, card.city].filter((p): p is string => !!p);
  return parts.join(" · ");
}

export function GamesView() {
  const copy = config.copy.games;
  // Dexie is the single source of truth — a newly-locked card appears live.
  const cards = useLiveQuery(() => db.bingoCards.toArray());
  const hasCards = cards != null && cards.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-8 pb-16">
      <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
        {copy.sectionHeading}
      </h1>

      {/* Deal teaser — the Phase-16 entry point, disabled + forthcoming (D-02). */}
      <div className="flex flex-col gap-2 rounded-md border border-hairline bg-elevated p-6">
        <p className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.teaserTitle}
        </p>
        <p className="text-base leading-normal text-text-muted">{copy.teaserBody}</p>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline bg-surface px-4 text-[14px] font-semibold text-text-muted opacity-60"
        >
          {copy.teaserAffordance}
        </button>
      </div>

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
