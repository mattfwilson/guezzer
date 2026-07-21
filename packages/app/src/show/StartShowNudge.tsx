/**
 * The Start-Show "Deal a bingo card for tonight?" nudge (Phase 16, BINGO-04,
 * D-08/D-09). Fires ONCE at Start Show when the just-started session has NO bingo
 * card — a dismissible bottom-sheet prompt that gives Gizz Bingo discoverability
 * without ever silently dealing a card behind the user's back.
 *
 * Two actions (D-09):
 *  - [Deal] → routes to GizzGames (`#/games`) to deal a card for the now-active
 *    session (the caller wires the route + closes the nudge).
 *  - [Not now] → dismisses for THIS show only. Dismissal is pure per-session UI
 *    state owned by the caller (ShowView) — there is NO persisted "don't ask
 *    again" meta key, so the nudge re-fires on the next card-less Start Show.
 *
 * Reuses the shared modal <Sheet> (Escape / focus-trap / focus-restore in one
 * place, A11Y-01). All copy is static config text — no untrusted-string surface.
 */
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";

export interface StartShowNudgeProps {
  /** Whether the nudge is shown (caller sets this at a card-less Start Show). */
  open: boolean;
  /** [Deal] — the caller routes to #/games and closes the nudge (D-09). */
  onDeal: () => void;
  /** [Not now] — dismiss for THIS show only (per-session, no persistence, D-09). */
  onDismiss: () => void;
}

export function StartShowNudge({ open, onDeal, onDismiss }: StartShowNudgeProps) {
  const copy = config.copy.games.bingo;

  return (
    <Sheet
      open={open}
      onClose={onDismiss}
      modal
      variant="bottom-sheet"
      ariaLabel={copy.startShowNudgeHeading}
    >
      <p className="text-[20px] font-semibold leading-tight text-text-primary">
        {copy.startShowNudgeHeading}
      </p>

      {/* [Deal] — the accent affordance; routes to GizzGames (D-09). */}
      <button
        type="button"
        onClick={onDeal}
        className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-[14px] font-semibold text-surface touch-manipulation"
      >
        {copy.startShowNudgeDeal}
      </button>

      {/* [Not now] — per-session dismiss only; no persisted suppression (D-09). */}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
      >
        {copy.startShowNudgeNotNow}
      </button>
    </Sheet>
  );
}
