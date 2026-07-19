/**
 * The Show-Mode speed-dial FAB (Phase-6 D-20) — SUPERSEDES `ActionBar.tsx`
 * (Phase-4 D-13..D-15 in-flow layout is deliberately replaced here, not
 * restored). All five actions collapse into one 56px bottom-right FAB so the
 * orbit stage absorbs the reclaimed vertical height (owner chose max orbit
 * space, accepting the extra tap on ???/Undo, 2026-07-14).
 *
 * Contract (identical callback bag to the old ActionBar so ShowView barely
 * changes): onSearch/onUnknown/onSetBreak/onEncore/onUndo.
 *
 * Anatomy:
 *   - Collapsed default: only the FAB renders — NO action buttons are in the
 *     accessibility tree (T-06-04: a stray tap can't hit an action).
 *   - Tap the FAB → a full-viewport scrim (blocks + collapses orbit taps) plus
 *     five action rows opening upward. Nearest-thumb order bottom→top is
 *     Undo, ???, Search, Set break, Encore (so top→bottom render is the
 *     reverse). The Plus glyph rotates 45° to read as a close affordance.
 *   - Tapping the scrim or the FAB again collapses WITHOUT firing any action.
 *   - Tapping any action row auto-collapses THEN fires exactly its callback
 *     once (auto-collapse-then-act).
 *
 * Fixed-position anchor (unlike the in-flow ActionBar): 16px in from the right
 * edge (plus the safe-area inset) and 16px above the app BottomTabBar when no
 * SuggestionStrip is reserved. When the strip slot IS reserved (`stripReserved`,
 * mid-show once the opener is seeded, or whenever an advisory row is present),
 * the FAB LIFTS by the strip's fixed height so it sits fully above the strip and
 * never overlaps a row's +/X buttons (owner 2026-07-18, revising the earlier
 * 2026-07-17 symmetric-inset-that-tolerates-overlap call). The lift is a single
 * stable step keyed to the strip's own fixed reservation (SHOW-02) — the strip
 * height is constant, so the FAB glides up once at opener-seed and stays put, no
 * per-suggestion jumping. Never accent — gold is reserved for Start Show / focus
 * ring (UI-SPEC §Color).
 */
import { CircleHelp, CircleStop, Minus, Plus, Search, Star, Undo2 } from "lucide-react";
import { useState } from "react";
import { config } from "../config.ts";

interface FabMenuProps {
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
  /** Open the End Show finalize confirm (D-04) — the LAST FAB item; the dialog
   *  still gates the actual finalize, so functionality is unchanged from the old
   *  header button. */
  onEndShow: () => void;
  /**
   * True when the SuggestionStrip slot is reserved below the orbit (opener seeded
   * or an advisory row present). Lifts the FAB by the strip's fixed height so it
   * never overlaps a strip row's +/X buttons (owner 2026-07-18). Constant strip
   * height ⇒ a single stable lift, no per-suggestion jumping.
   */
  stripReserved: boolean;
}

export function FabMenu({
  onSearch,
  onUnknown,
  onSetBreak,
  onEncore,
  onUndo,
  onEndShow,
  stripReserved,
}: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const copy = config.copy.show;

  // Rendered top→bottom. Encore (top) … Undo per the UI-SPEC hottest-nearest
  // order; End Show is appended as the LAST (bottom-most) item per owner request.
  // End Show still opens the EndShowDialog confirm, so its bottom placement can't
  // accidentally finalize the show.
  const actions = [
    { key: "encore", label: copy.encoreCta, Icon: Star, onClick: onEncore },
    { key: "setBreak", label: copy.setBreakCta, Icon: Minus, onClick: onSetBreak },
    { key: "search", label: copy.searchCta, Icon: Search, onClick: onSearch },
    { key: "unknown", label: copy.unknownCta, Icon: CircleHelp, onClick: onUnknown },
    { key: "undo", label: copy.undoCta, Icon: Undo2, onClick: onUndo },
    { key: "endShow", label: copy.endCta, Icon: CircleStop, onClick: onEndShow },
  ] as const;

  // Auto-collapse-then-act: close first so one tap = one action, then run the
  // inherited Phase-4 behavior exactly once.
  const runAction = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  // Bottom offset = 16px above the app BottomTabBar (h-16 = 64px), atop the
  // safe-area inset. When the SuggestionStrip slot is reserved, ADD its fixed
  // height so the FAB clears the strip entirely (owner 2026-07-18) instead of
  // overlapping a row's +/X buttons. The strip height is constant, so this is a
  // single stable lift, not a per-suggestion shuffle.
  const bottomOffset = stripReserved
    ? `calc(env(safe-area-inset-bottom) + 64px + ${config.ui.SUGGESTION_STRIP_HEIGHT}px + 16px)`
    : "calc(env(safe-area-inset-bottom) + 64px + 16px)";
  const rightOffset = "calc(env(safe-area-inset-right) + 16px)";

  return (
    <>
      {/* Full-viewport scrim UNDER the open menu: blocks orbit taps and collapses
          on tap (T-06-04). Only present while open. */}
      {open && (
        <div
          data-testid="fab-scrim"
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fab-menu fixed inset-0"
          style={{
            zIndex: config.ui.z.fabScrim,
            backgroundColor: "rgba(12, 12, 16, 0.6)",
          }}
        />
      )}

      <div
        className="fab-menu fixed flex flex-col items-end gap-2 motion-safe:transition-[bottom] motion-safe:duration-300 motion-safe:ease-out"
        data-strip-reserved={stripReserved ? "true" : "false"}
        style={{ zIndex: config.ui.z.fab, bottom: bottomOffset, right: rightOffset }}
      >
        {open && (
          <div className="flex flex-col items-end gap-2">
            {actions.map(({ key, label, Icon, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={() => runAction(onClick)}
                style={{ minHeight: config.ui.FAB_ACTION_HEIGHT }}
                className="flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-hairline bg-elevated px-4 text-text-primary touch-manipulation"
              >
                <Icon size={20} />
                <span className="text-[14px] font-semibold leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          aria-label={copy.fabLabel}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            width: config.ui.FAB_DIAMETER,
            height: config.ui.FAB_DIAMETER,
          }}
          className="flex min-h-11 min-w-11 items-center justify-center self-end rounded-full border border-hairline bg-elevated text-text-primary touch-manipulation"
        >
          <Plus
            size={24}
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
            className="motion-safe:transition-transform motion-safe:duration-200"
          />
        </button>
      </div>
    </>
  );
}
