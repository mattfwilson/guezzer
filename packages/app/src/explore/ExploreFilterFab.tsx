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

interface ExploreFilterFabProps {
  /** Panel expanded? Owned by ExploreView so a canvas tap can collapse it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ExploreView;
  onViewChange: (view: ExploreView) => void;
  edgeThreshold: number;
  onEdgeThresholdChange: (threshold: number) => void;
}

export function ExploreFilterFab({
  open,
  onOpenChange,
  view,
  onViewChange,
  edgeThreshold,
  onEdgeThresholdChange,
}: ExploreFilterFabProps) {
  // Clear the app BottomTabBar (h-16 = 64px) + a small gap + the home-indicator
  // inset. NO SUGGESTION_STRIP_HEIGHT term (Show-Mode-only chrome). The tab bar /
  // gap / inset are layout offsets, not model tunables.
  const bottomOffset = "calc(env(safe-area-inset-bottom) + 64px + 8px)";
  const rightOffset = "calc(env(safe-area-inset-right) + 16px)";

  return (
    // NO scrim sibling (unlike FabMenu) — the graph stays live while sliding (D-09).
    <div
      className="fixed z-30 flex flex-col items-end gap-2"
      style={{ bottom: bottomOffset, right: rightOffset }}
    >
      {open && (
        <ExploreFilterPanel
          view={view}
          onViewChange={onViewChange}
          edgeThreshold={edgeThreshold}
          onEdgeThresholdChange={onEdgeThresholdChange}
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
