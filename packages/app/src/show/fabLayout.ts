import { config } from "../config.ts";

/**
 * Shared bottom offset (CSS `calc` string) for the Show-Mode FAB speed-dial AND
 * the centered "Low confidence" weak-fan hint that aligns vertically with it.
 * Resting: 16px above the app BottomTabBar (h-16 = 64px) atop the safe-area inset;
 * when the SuggestionStrip is showing rows, lifted by its fixed height so both the
 * FAB and the hint clear those rows. Single source so the two never drift apart.
 */
export function showBottomFabOffset(stripHasContent: boolean): string {
  return stripHasContent
    ? `calc(env(safe-area-inset-bottom) + 64px + ${config.ui.SUGGESTION_STRIP_HEIGHT}px + 16px)`
    : "calc(env(safe-area-inset-bottom) + 64px + 16px)";
}
