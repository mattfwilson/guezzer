/**
 * The Show-Mode speed-dial FAB (Phase-6 D-20) — SUPERSEDES `ActionBar.tsx`
 * (Phase-4 D-13..D-15 in-flow layout is deliberately replaced here, not
 * restored). All five actions collapse into one 56px bottom-right FAB so the
 * orbit stage absorbs the reclaimed vertical height (owner chose max orbit
 * space, accepting the extra tap on ???/Undo, 2026-07-14).
 *
 * Contract (the old ActionBar callback bag + onCatchUp/onEndShow so ShowView
 * barely changes): onSearch/onUnknown/onSetBreak/onEncore/onUndo/onCatchUp.
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
 * edge (plus the safe-area inset) and, vertically, the bottom-space owner's
 * `--gz-fab-offset` via the shared `showBottomFabOffset` (FOUND-02). When the
 * SuggestionStrip's slot is RESERVED (`stripSlotReserved` — i.e. the opener is
 * seeded), the FAB LIFTS by that slot's fixed height so it sits fully above any
 * rows the strip renders and never overlaps a row's +/X buttons (owner
 * 2026-07-18, revising the earlier 2026-07-17 symmetric-inset-that-tolerates-
 * overlap call).
 *
 * D-05: the lift is keyed to the RESERVED SLOT, not to whether rows are visible
 * right now. Keyed to visible content (as it shipped through Phase 10) a remote
 * editor suggestion arriving mid-show moved the FAB under a reaching thumb; a tap
 * target must never move on its own. Keyed to the reserved slot the FAB
 * transitions at most once per show, at the opener. The `a60d5e2` clearance is
 * re-expressed, not undone — the reserved slot is always ≥ the rendered rows it
 * holds. The motion-safe transition glides that one reposition. Never accent —
 * gold is reserved for Start Show / focus ring (UI-SPEC §Color).
 *
 * Phase-21 FOUND-03 / D-20/D-27 — PORTALED to `document.body`. This is the worst
 * symptom of the nesting defect, because it lands in the LIVE-LOGGING LOOP.
 * `ShowView.withBackground` gives the show column `position: relative` +
 * `zIndex: config.ui.z.content`, which creates a stacking context, so the scrim's
 * `fabScrim: 25` and the speed-dial's `fab: 30` were both composited at effective
 * level 10 and lost to the `toast: 20` siblings of `<AppShell>`. A toast could
 * therefore paint over the open speed-dial and EAT a tap mid-show — a lost song,
 * with no error to notice (21-HUMAN-UAT §7, T-21-30). No tier is renumbered: the
 * numbers were never wrong, the nesting was.
 */
import { CircleHelp, CircleStop, ListChecks, Minus, Plus, Search, Star, Undo2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { config } from "../config.ts";
import { showBottomFabOffset } from "./fabLayout.ts";

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
  /** Open the BINGO-06 catch-up confirm-list (bulk-backfill the missed feed songs). */
  onCatchUp: () => void;
  /** Open the End Show finalize confirm (D-04) — the LAST FAB item; the dialog
   *  still gates the actual finalize, so functionality is unchanged from the old
   *  header button. */
  onEndShow: () => void;
  /**
   * True when the SuggestionStrip's fixed slot is RESERVED — the same
   * opener-seeded signal passed to `<SuggestionStrip reserveSpace>`. Lifts the FAB
   * by that slot's height so it never overlaps a strip row's +/X buttons. D-05:
   * deliberately NOT the "rows are on screen right now" signal, so a remotely
   * timed suggestion can never move a live-logging tap target mid-show; the slot
   * is always ≥ the rows it holds, so the clearance is unchanged.
   */
  stripSlotReserved: boolean;
}

export function FabMenu({
  onSearch,
  onUnknown,
  onSetBreak,
  onEncore,
  onUndo,
  onCatchUp,
  onEndShow,
  stripSlotReserved,
}: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const copy = config.copy.show;

  // Rendered top→bottom. Encore (top) … Undo per the UI-SPEC hottest-nearest
  // order; End Show is appended as the LAST (bottom-most) item per owner request.
  // End Show still opens the EndShowDialog confirm, so its bottom placement can't
  // accidentally finalize the show.
  const actions = [
    { key: "catchUp", label: config.copy.catchUp.cta, Icon: ListChecks, onClick: onCatchUp },
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

  // Bottom offset comes from the ONE source (`fabLayout.ts`), which composes the
  // owner's `--gz-fab-offset` (FOUND-02) — this file derives no tab-bar or
  // safe-area arithmetic of its own. When the strip's slot is RESERVED, that
  // source adds the slot's fixed height so the FAB clears any row rendered inside
  // it; pre-opener (slot collapsed) it returns the resting offset. D-05: the
  // trigger is the reserved slot, never the transient presence of rows.
  const bottomOffset = showBottomFabOffset(stripSlotReserved);
  const rightOffset = "calc(env(safe-area-inset-right) + 16px)";

  // Phase-21 FOUND-03 / D-20/D-27 — SSR-and-jsdom guard, copied from `Sheet.tsx`.
  if (typeof document === "undefined") return null;

  // Portaling the FAB is a LAYERING fix, not a positioning one. Both roots are
  // already `position: fixed` and therefore anchored to the VIEWPORT, not to any
  // ancestor box, so their offsets resolve identically outside `#app-content` —
  // including `var(--gz-fab-offset)` (plan 21-08), because plan 21-07 writes the
  // bottom-space ladder onto `document.documentElement` and `document.body`
  // inherits from it. Nothing about the geometry changes; only which stacking
  // context the two boxes composite in.
  //
  // Both roots travel together in ONE portal so the scrim stays immediately below
  // the speed-dial in DOM order and their `fabScrim: 25 < fab: 30` relationship is
  // re-established at the top level rather than inside ShowView's `content: 10`.
  return createPortal(
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
        data-strip-slot-reserved={stripSlotReserved ? "true" : "false"}
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
    </>,
    document.body,
  );
}
