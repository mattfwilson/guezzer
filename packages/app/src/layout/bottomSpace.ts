import { useLayoutEffect } from "react";
import { config } from "../config.ts";
import { useBottomOverlayInset } from "../pwa/bottomOverlayInset.ts";

/**
 * THE single owner of the app's bottom-space arithmetic (Phase-21 FOUND-02).
 *
 * The numbers live in `config.ui.bottomSpace`. The composition lives HERE. Every
 * consumer — `<main>`, the tab bar, the FAB, the toasts, the sheets — reads a
 * `var(--gz-*)` and computes nothing of its own. FOUND-02's wording is literally
 * "a search for the tab-bar height returns exactly one owner"; before Phase 21 the
 * same arithmetic existed in four notations across nine files that disagreed by one
 * safe-area inset, which IS the FOUND-01 dead gap.
 *
 * WHY THE LADDER GOES ON `document.documentElement` AND NOT `#root` (21-RESEARCH
 * Pitfall 1): `Sheet.tsx` renders through `createPortal` to `document.body`, and
 * plans 21-11/21-12 portal five more surfaces out of the ShowView stacking context.
 * A custom property set on `#root` is invisible to every portaled node — including
 * `--gz-sheet-pad-bottom`, which exists SPECIFICALLY for sheets. `documentElement`
 * is the only ancestor every surface shares. Do not "tidy" this to `#root` later.
 *
 * WHY `env()` IS NOT WRITTEN FROM HERE: `--gz-safe-bottom` is declared in CSS
 * (`styles.css :root`), never via `setProperty`. See that block for the reasoning —
 * a JS round-trip of `env()` is unverified in Safari and its failure mode is
 * invisible on a desktop, where the inset is `0`.
 *
 * A side effect worth naming: composing from `var(--gz-safe-bottom)` removes all
 * eight `calc(env(...) + …)` expressions from the codebase. Hoisting `env()` into a
 * custom property and calc-ing the variable instead is itself the standard workaround
 * for Safari's historical trouble with `env()` nested inside `calc()`.
 */

/**
 * The six property names this module writes from JS, in composition order.
 *
 * `--gz-safe-bottom` is deliberately ABSENT: it is CSS-authored (see above), so it
 * is read by these compositions but never set by them.
 */
export const BOTTOM_SPACE_VAR_NAMES = [
  "--gz-tab-bar-h",
  "--gz-overlay-inset",
  "--gz-chrome-reserve",
  "--gz-content-reserve",
  "--gz-sheet-pad-bottom",
  "--gz-fab-offset",
] as const;

/**
 * Composes the whole ladder from `config.ui.bottomSpace`. Pure, DOM-free and
 * unit-testable — it returns name/value pairs and touches nothing.
 *
 * D-02 — THE TWO NAMED COMPOSITIONS. These are not redundant and must never be
 * "simplified" into one value:
 *   - `--gz-chrome-reserve` is the TAB BAR ONLY (its height plus the home-indicator
 *     inset). Every `fixed`/`absolute` bottom-anchored surface composes from this.
 *   - `--gz-content-reserve` additionally folds in the measured height of whatever
 *     transient fixed-bottom overlay (InstallBanner, UpdateToast) is on screen right
 *     now, and is for SCROLLING `<main>` ONLY. Reserving the overlay inset on a
 *     NON-scrolling route would permanently squish a `flex-1` full-height stage (the
 *     orbit, the constellation) every time a transient banner appeared.
 *
 * D-16 — THE CHROME-COLLAPSE SEAM. `chromeVisible` exists so Phase 22 can hide the
 * bottom chrome by flipping THIS ONE SOURCE, with every consumer following
 * automatically, instead of revisiting nine call sites in a second layout state.
 * Phase 21 ships it PINNED `true`: no caller passes `false`, there is no toggle and
 * there is no behavior change. It is a seam, not a feature.
 *
 * @param overlayInsetPx measured total height of the fixed-bottom overlays on screen
 * @param chromeVisible D-16 seam — pinned `true` for all of Phase 21
 */
export function bottomSpaceVarEntries(
  overlayInsetPx: number,
  chromeVisible = true,
): ReadonlyArray<readonly [string, string]> {
  const { TAB_BAR_HEIGHT_REM, FAB_CLEARANCE_PX, SHEET_PAD_BOTTOM_PX } =
    config.ui.bottomSpace;

  return [
    ["--gz-tab-bar-h", `${TAB_BAR_HEIGHT_REM}rem`],
    ["--gz-overlay-inset", `${overlayInsetPx}px`],
    [
      "--gz-chrome-reserve",
      chromeVisible
        ? "calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))"
        : "var(--gz-safe-bottom)",
    ],
    [
      "--gz-content-reserve",
      "calc(var(--gz-chrome-reserve) + var(--gz-overlay-inset))",
    ],
    [
      "--gz-sheet-pad-bottom",
      `calc(var(--gz-safe-bottom) + ${SHEET_PAD_BOTTOM_PX}px)`,
    ],
    [
      "--gz-fab-offset",
      `calc(var(--gz-chrome-reserve) + ${FAB_CLEARANCE_PX}px)`,
    ],
  ];
}

/**
 * Writes the composed ladder onto `root`. Callers pass `document.documentElement` —
 * see the module doc for why nothing else works once surfaces portal to
 * `document.body`.
 */
export function applyBottomSpaceVars(
  root: HTMLElement,
  overlayInsetPx: number,
  chromeVisible = true,
): void {
  for (const [name, value] of bottomSpaceVarEntries(
    overlayInsetPx,
    chromeVisible,
  )) {
    root.style.setProperty(name, value);
  }
}

/**
 * Installs the ladder on `document.documentElement` and keeps `--gz-overlay-inset`
 * in step with the real measured overlay height.
 *
 * A LAYOUT effect, never a passive one: the values must land BEFORE the first paint of
 * the same commit that renders the tab bar and the toasts, or every bottom-anchored
 * surface flashes at an unresolved reserve on mount.
 *
 * Call it once, from the app shell.
 */
export function useBottomSpaceVars(): void {
  const overlayInset = useBottomOverlayInset();

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    applyBottomSpaceVars(document.documentElement, overlayInset);
  }, [overlayInset]);
}
