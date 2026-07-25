import { config } from "../config.ts";

/**
 * THE single bottom-offset source for the Show-Mode FAB speed-dial AND the centered
 * "Low confidence" weak-fan hint that aligns vertically with it. Both surfaces call
 * this one function so the two can never drift apart — that alignment is the whole
 * reason the function exists.
 *
 * FOUND-02 — the offset now COMPOSES from `--gz-fab-offset`, the bottom-space owner's
 * variable (`src/layout/bottomSpace.ts`), instead of re-deriving the tab-bar/safe-area
 * arithmetic in a fourth notation. `--gz-fab-offset` is
 * `calc(var(--gz-chrome-reserve) + FAB_CLEARANCE_PX)`, and `--gz-chrome-reserve` is
 * `calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))`, so both branches below are
 * NUMERICALLY IDENTICAL to what shipped before Phase 21 — only the notation moved.
 *
 * D-05 — THE PARAMETER IS THE RESERVED-SLOT SIGNAL, NOT THE RENDERED-ROW SIGNAL.
 * `stripSlotReserved` is the same flag that drives `<SuggestionStrip reserveSpace>`
 * (i.e. "the opener is seeded"), NOT "a suggestion row is on screen right now". A tap
 * target must never move on its own: keyed to rendered rows, the FAB jumped the instant
 * a remote editor suggestion arrived — mid-show, under a reaching thumb, in the dark.
 * Keyed to the reserved slot it transitions at most once per show, at the opener.
 *
 * THE PHASE-10 `a60d5e2` LIFT IS RE-EXPRESSED, NOT UNDONE. That commit lifted the FAB
 * above the reserved strip so it never overlaps a row's +/X buttons, and that clearance
 * still holds: the reserved slot height (`config.ui.SUGGESTION_STRIP_HEIGHT`, 112px —
 * corrected up from 56px in the VALID-02 rehearsal) is always ≥ the height of whatever
 * rows render inside it, so lifting by the SLOT clears every rendered row too. A future
 * reader should not rediscover this as a regression: only the trigger changed.
 */
export function showBottomFabOffset(stripSlotReserved: boolean): string {
  return stripSlotReserved
    ? `calc(var(--gz-fab-offset) + ${config.ui.SUGGESTION_STRIP_HEIGHT}px)`
    : "var(--gz-fab-offset)";
}
