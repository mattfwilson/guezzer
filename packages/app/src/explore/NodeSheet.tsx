/**
 * The ranked-bars bottom sheet (EXPL-02, D-14). Opens on node focus at a 40%
 * viewport PEEK (`config.explore.SHEET_PEEK_FRACTION`) so the focused node and
 * its lit neighborhood stay visible above it; drag the grab handle up for the
 * full list, swipe it down to dismiss (which clears focus in ExploreView).
 *
 * It copies the TrailNodeSheet shell idiom — `role="dialog"`, `rounded-t-2xl
 * border-t border-hairline bg-elevated`, `env(safe-area-inset-*)` padding,
 * `stopPropagation` — but is a PARTIAL, NON-modal sheet with NO scrim: the
 * constellation must stay visible and interactive above it (a scrim would hide
 * the very neighborhood the sheet is describing). The peek/drag geometry is the
 * one genuinely-new piece; everything else is the inherited sheet language.
 *
 * Content (D-01..D-04): header (focused song name + all-time play count) → top-N
 * `RankedBar`s → a "Show all {N}" / "Show top {N}" expander for the one-off long
 * tail → the muted D-03 note that the bars are the COMPLETE history, independent
 * of the map's filters. A zero-outgoing node shows the honest "No next songs on
 * record" state (D-08), never an error. Song names render as React text only
 * (T-07-05).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { OutgoingBar, TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import { useDialogDismiss } from "../components/a11y/useDialogDismiss.ts";
import { RankedBar } from "./RankedBar.tsx";
import { useVisibleViewportHeight } from "./useVisibleViewportHeight.ts";

/** One bar with its target song already resolved (name + tuning family). */
export interface SheetBar {
  bar: OutgoingBar;
  targetName: string;
  targetTuningFamily: TuningFamily;
  /**
   * Dex-overlay caught state (07-06/B2): `true`/`false` when the overlay is
   * active (green Check / hollow circle), `undefined` when it's OFF so the row
   * shows no leading indicator — the panel mirrors the sky's current semantics.
   */
  caught?: boolean;
}

interface NodeSheetProps {
  /** Focused song name (Heading, kglw-derived → React text only). */
  songName: string;
  /** Focused song all-time play count → the muted subline. */
  playCount: number;
  /** Outgoing denominator (sum of counts) for each bar's "why" line. */
  total: number;
  /** The FULL resolved outgoing history, pre-sorted (D-03 — filter-independent). */
  bars: SheetBar[];
  /** Chain-hop (D-16): a bar tap makes its target the new focus. */
  onSelect: (songId: number) => void;
  /** Swipe-down / dismiss → clears focus in ExploreView. */
  onClose: () => void;
}

/** px strip left above the sheet at full height so the sky stays partly visible. */
const FULL_TOP_GAP_PX = 48;
/** Released below this fraction of the peek height → dismiss (swipe-down). */
const SHEET_DISMISS_FRACTION = 0.6;
/** ms height ease for snap transitions (disabled while dragging / reduced-motion). */
const SNAP_MS = 200;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function NodeSheet({
  songName,
  playCount,
  total,
  bars,
  onSelect,
  onClose,
}: NodeSheetProps) {
  const copy = config.copy.explore;
  const topN = config.explore.BARS_TOP_N;
  const reduced = prefersReducedMotion();

  // Escape-to-dismiss via the shared LIFO dialogStack (D-02) — NO bespoke
  // `document` keydown listener. NodeSheet is only mounted while focused, so it's
  // always the active dialog while rendered.
  useDialogDismiss(true, onClose);

  // Focus-restore ONLY (D-02): capture the trigger on mount, restore on unmount.
  // Deliberately NO focus-trap / inert / scrim — the graph + FilterFab must stay
  // reachable above this NON-modal window (T-08-10). The graph is what the bars
  // describe; trapping focus here would strand the keyboard/AT user off it.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    return () => restoreFocusRef.current?.focus?.();
  }, []);

  // The ONE shared visible-viewport height (Pitfall 3): NodeSheet peek, the FAB
  // lift, and the camera reframe all read this, never `window.innerHeight` (which
  // is the iOS LARGE viewport and ignores the keyboard/toolbar).
  const vh = useVisibleViewportHeight();

  const peekH = Math.round(vh * config.explore.SHEET_PEEK_FRACTION);
  const fullH = Math.max(peekH, vh - FULL_TOP_GAP_PX);

  const [height, setHeight] = useState(peekH);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  // Re-snap to peek if a rotation/resize shrinks the viewport under the current
  // height (keeps the sheet from overhanging the new full height).
  useEffect(() => {
    setHeight((h) => Math.min(h, fullH));
  }, [fullH]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, startH: height };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY; // drag up = grow
    setHeight(Math.min(fullH, Math.max(0, drag.current.startH + dy)));
  };
  const endDrag = () => {
    if (!drag.current) return;
    const released = height;
    drag.current = null;
    setDragging(false);
    if (released < peekH * SHEET_DISMISS_FRACTION) {
      onClose();
      return;
    }
    // Snap to whichever of peek / full is nearer.
    setHeight(released > (peekH + fullH) / 2 ? fullH : peekH);
  };

  const shownBars = expanded ? bars : bars.slice(0, topN);
  const hasTail = bars.length > topN;

  return (
    <div
      role="dialog"
      aria-modal={false}
      aria-label={songName}
      className="fixed inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-hairline bg-elevated"
      style={{
        zIndex: config.ui.z.sheet,
        height,
        transition: dragging || reduced ? "none" : `height ${SNAP_MS}ms ease`,
        paddingBottom: "env(safe-area-inset-bottom)",
        touchAction: "none",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag surface: grab handle + header. Owns the peek/drag/dismiss gesture. */}
      <header
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="mx-auto mt-2 mb-3 h-1 w-10 rounded-full bg-hairline" />
        <h2 className="truncate text-[20px] font-semibold leading-tight text-text-primary">
          {songName}
        </h2>
        <p className="mt-1 text-[14px] font-semibold leading-tight tabular-nums text-text-muted">
          {copy.sheetSubline(playCount)}
        </p>
      </header>

      {total === 0 ? (
        // Honest-zero (D-08) — a free-floating star with no next songs, not an error.
        <div className="px-4 pt-2">
          <p className="text-[20px] font-semibold leading-tight text-text-primary">
            {copy.noOutgoingHeading}
          </p>
          <p className="mt-2 text-base leading-normal text-text-muted">
            {copy.noOutgoingBody(songName)}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ touchAction: "pan-y" }}>
          {shownBars.map((b) => (
            <RankedBar
              key={b.bar.songId}
              bar={b.bar}
              total={total}
              targetName={b.targetName}
              targetTuningFamily={b.targetTuningFamily}
              caught={b.caught}
              onSelect={onSelect}
            />
          ))}

          {hasTail && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex min-h-11 w-full items-center justify-center gap-1 px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              {expanded ? copy.barsCollapse(topN) : copy.barsExpander(bars.length)}
              <ChevronDown
                size={16}
                aria-hidden
                className={expanded ? "rotate-180" : ""}
              />
            </button>
          )}

          {/* D-03: the bars are the whole truth; filters only shape the map. */}
          <p className="px-4 py-3 text-[14px] font-semibold leading-tight text-text-muted">
            {copy.filtersNote}
          </p>
        </div>
      )}
    </div>
  );
}
