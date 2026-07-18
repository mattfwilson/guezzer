/**
 * EXPL-03 / EXPL-04 (D-09): the collapsed Explore filter FAB. Copies the Show-Mode
 * `FabMenu` fixed-anchor + glyph-rotate idiom, with the three deliberate
 * divergences the UI-SPEC calls out (07-PATTERNS §FAB):
 *
 *   - `SlidersHorizontal` glyph, NOT `Plus` — this collapses filters, not actions.
 *   - NO scrim. The graph must stay VISIBLE and LIVE while sliding (D-09) — a
 *     Show-Mode-style full-viewport scrim would hide the very sky the filters
 *     shape. Tapping the FAB toggles; tapping the canvas collapses the panel
 *     (handled by ExploreView, which owns `open` so a canvas tap can close it
 *     without a scrim to catch the tap).
 *   - The bottom offset OMITS the `SUGGESTION_STRIP_HEIGHT` term — the suggestion
 *     strip is Show-Mode-only chrome and never renders at `#/explore`.
 *
 * 56px circle, `bg-elevated border-hairline` — deliberately NOT accent (gold is
 * reserved for the active toggle half + focus ring, Phase-6 precedent). The panel
 * (`ExploreFilterPanel`) opens upward above the button when `open`. This is a
 * controlled component: `open`/`onOpenChange` live in ExploreView.
 */
import { SlidersHorizontal } from "lucide-react";
import { config } from "../config.ts";
import { ExploreFilterPanel, type ExploreView } from "./ExploreFilterPanel.tsx";
import { useVisibleViewportHeight } from "./useVisibleViewportHeight.ts";

/**
 * The FAB's resting distance from the viewport bottom in px, matching the numeric
 * terms of `bottomOffset` below (BottomTabBar 64px + 8px gap). `env(safe-area-
 * inset-bottom)` is NOT resolvable in JS, so the lift math omits it — the inset is
 * a small constant and the `FAB_SHEET_GAP_PX` cushion absorbs the rounding.
 */
const RESTING_BOTTOM_PX = 64 + 8;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

interface ExploreFilterFabProps {
  /** Panel expanded? Owned by ExploreView so a canvas tap can collapse it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ExploreView;
  onViewChange: (view: ExploreView) => void;
  topK: number;
  onTopKChange: (topK: number) => void;
  /** Dex overlay on? (DEX-05/D-10, ON by default). Forwarded to the panel switch. */
  dexOverlay: boolean;
  onDexOverlayChange: (on: boolean) => void;
  /**
   * A11Y-02 / D-03: a constellation node is focused, so the NodeSheet peek is up.
   * Lift the FAB above the sheet's top edge (z.focusedFab) so both stay usable
   * with no occlusion; false → rest at the bottom-right (z.fab).
   */
  lifted: boolean;
}

export function ExploreFilterFab({
  open,
  onOpenChange,
  view,
  onViewChange,
  topK,
  onTopKChange,
  dexOverlay,
  onDexOverlayChange,
  lifted,
}: ExploreFilterFabProps) {
  // Clear the app BottomTabBar (h-16 = 64px) + a small gap + the home-indicator
  // inset. NO SUGGESTION_STRIP_HEIGHT term (Show-Mode-only chrome). The tab bar /
  // gap / inset are layout offsets, not model tunables.
  const bottomOffset = "calc(env(safe-area-inset-bottom) + 64px + 8px)";
  const rightOffset = "calc(env(safe-area-inset-right) + 16px)";

  // A11Y-02 lift (D-03, Pattern 5): raise the FAB so it clears the NodeSheet's
  // PEEK top edge by FAB_SHEET_GAP_PX. Peek is read from the SAME shared visible-
  // viewport source the sheet uses (Pitfall 3) — never window.innerHeight — so the
  // FAB and the sheet never disagree on where the top edge is.
  const vh = useVisibleViewportHeight();
  const peekHeightPx = vh * config.explore.SHEET_PEEK_FRACTION;
  const liftPx = lifted
    ? Math.max(0, peekHeightPx - RESTING_BOTTOM_PX + config.ui.FAB_SHEET_GAP_PX)
    : 0;

  // Reduced-motion gate (Pitfall 6): instant, matching ConstellationCanvas:323's
  // matchMedia read and the app-wide motion-safe idiom.
  const reduced = prefersReducedMotion();

  return (
    // NO scrim sibling (unlike FabMenu) — the graph stays live while sliding (D-09).
    <div
      className="fixed flex flex-col items-end gap-2"
      style={{
        bottom: bottomOffset,
        right: rightOffset,
        transform: `translateY(${-liftPx}px)`,
        transition: reduced
          ? "none"
          : `transform ${config.explore.FOCUS_CAMERA_DURATION_MS}ms`,
        zIndex: lifted ? config.ui.z.focusedFab : config.ui.z.fab,
      }}
    >
      {open && (
        <ExploreFilterPanel
          view={view}
          onViewChange={onViewChange}
          topK={topK}
          onTopKChange={onTopKChange}
          dexOverlay={dexOverlay}
          onDexOverlayChange={onDexOverlayChange}
        />
      )}

      <button
        type="button"
        aria-label={config.copy.explore.filterFabAria}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        style={{
          width: config.ui.FAB_DIAMETER,
          height: config.ui.FAB_DIAMETER,
        }}
        className="flex min-h-11 min-w-11 items-center justify-center self-end rounded-full border border-hairline bg-elevated text-text-primary touch-manipulation focus-visible:outline-2 focus-visible:outline-accent"
      >
        <SlidersHorizontal
          size={24}
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          className="motion-safe:transition-transform motion-safe:duration-200"
        />
      </button>
    </div>
  );
}
