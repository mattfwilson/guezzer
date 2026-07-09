/**
 * The persistent Show-Mode action bar (04-UI-SPEC §Layout region 4, D-13). Two
 * rows per the user-endorsed mockup:
 *
 *   [🔍 Search] [??? Unknown]        ← primary row (04-05)
 *   [Set break] [Encore] [↶ Undo]    ← secondary row (wired here, 04-06)
 *
 * Mirrors the BottomTabBar idiom (fixed-bar tokens, `env(safe-area-inset-bottom)`,
 * ≥44px tap floor via `min-h-11 min-w-11`, lucide icons at the Label typography).
 * It is an IN-FLOW block at the bottom of the ShowView flex column — NOT
 * `position: fixed` — so it sits directly above the app-level BottomTabBar
 * (Show/Explore/Dex) without overlapping it; the safe-area inset is retained
 * defensively per the D-13 contract. Search + ??? are NEVER accent (gold is
 * reserved for Start Show / focus ring, 04-UI-SPEC §Color).
 *
 * The bar is rendered in BOTH the pre-opener "Tap the opener" state and the
 * active-fan state, so the opener is always enterable via Search. Both primary
 * controls are the fastest-must-be miss paths: ??? logs an instant placeholder
 * miss with NO confirm (D-14); Search opens the fuzzy sheet (SHOW-04).
 */
import { CircleHelp, Search, SkipForward, Star, Undo2 } from "lucide-react";
import { config } from "../config.ts";

interface ActionBarProps {
  /** Open the fuzzy SearchSheet (SHOW-04 / opener-seed). */
  onSearch: () => void;
  /** Log an instant "???" placeholder miss + recenter, no confirm (D-14/SHOW-05). */
  onUnknown: () => void;
  /** Mark a set break → subsequent entries snapshot "2"; never ends the show (D-04/SHOW-06). */
  onSetBreak: () => void;
  /** Mark the encore → subsequent entries snapshot "e"; never ends the show (D-04/SHOW-06). */
  onEncore: () => void;
  /** Remove the most recent entry in one tap, NO confirm (D-15/SHOW-07). */
  onUndo: () => void;
}

export function ActionBar({
  onSearch,
  onUnknown,
  onSetBreak,
  onEncore,
  onUndo,
}: ActionBarProps) {
  const copy = config.copy.show;

  // Secondary-row controls, now live (04-06). Set break/Encore only shift the
  // snapshotted set number (never end the show, D-04); Undo removes the most
  // recent entry with no dialog (the common "oops", D-15). None are accent —
  // gold stays reserved for Start Show / focus ring (04-UI-SPEC §Color).
  const secondary = [
    { key: "setBreak", label: copy.setBreakCta, Icon: SkipForward, onClick: onSetBreak },
    { key: "encore", label: copy.encoreCta, Icon: Star, onClick: onEncore },
    { key: "undo", label: copy.undoCta, Icon: Undo2, onClick: onUndo },
  ] as const;

  return (
    <nav
      aria-label="Show controls"
      className="shrink-0 select-none border-t border-hairline bg-elevated px-4 pt-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Primary row — the fastest miss paths (D-13/D-14/SHOW-04). */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="flex min-h-11 min-w-11 flex-1 items-center justify-center gap-2 rounded-md border border-hairline py-2 text-text-primary touch-manipulation"
        >
          <Search size={22} />
          <span className="text-[14px] font-semibold leading-tight">
            {copy.searchCta}
          </span>
        </button>

        <button
          type="button"
          onClick={onUnknown}
          className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center rounded-md border border-hairline py-1 text-text-primary touch-manipulation"
        >
          <span className="flex items-center gap-2">
            <CircleHelp size={22} />
            <span className="text-[14px] font-semibold leading-tight">
              {copy.unknownCta}
            </span>
          </span>
          <span className="text-[14px] leading-tight text-text-muted">
            {copy.unknownSublabel}
          </span>
        </button>
      </div>

      {/* Secondary row — set structure + one-tap undo (D-13/SHOW-06/SHOW-07).
          Set break/Encore only move the snapshotted set number (never end the
          show, D-04); Undo removes the most recent entry with no dialog (D-15). */}
      <div className="mt-2 flex gap-2">
        {secondary.map(({ key, label, Icon, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className="flex min-h-11 min-w-11 flex-1 items-center justify-center gap-2 rounded-md border border-hairline py-2 text-text-primary touch-manipulation"
          >
            <Icon size={18} />
            <span className="text-[14px] font-semibold leading-tight">
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
