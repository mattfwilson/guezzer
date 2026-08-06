/**
 * Phase-22 CHROME-01/03 — THE control that drives the shared chrome-hide
 * mechanism (`layout/chromeVisibility.ts`, D-12). Plan 22-05 shipped the
 * mechanism with NO way to enter the hidden state; this component is the first
 * and only entry point, which is why every way OUT ships in the same commit.
 *
 * ## D-01 — a dedicated button, NOT a canvas gesture
 *
 * `ExploreView` already spends a single canvas tap on node focus + chain-hop AND
 * on collapsing the filter panel (`filterOpen` lives in `ExploreView` precisely so
 * a canvas tap can collapse it without a scrim). A third meaning for the same
 * gesture is a mis-fire waiting to happen while panning the constellation in the
 * dark. Nothing about `filterOpen` / `focusId` / canvas-tap semantics changes.
 *
 * ## D-02 — why TOP-RIGHT, clear of both existing bottom surfaces
 *
 * The bottom of GizzVerse is already spoken for twice over: `ExploreFilterFab`
 * rests bottom-right, and a focused `NodeSheet` peeks ~40% up from the bottom
 * edge (which is exactly why `ConstellationCanvas` centres the focused node in the
 * upper 60%). A bottom-anchored toggle would be buried under `NodeSheet` at the
 * precise moment the user is deepest in the view and most wants the bars back.
 * Top-right is the one region both surfaces leave alone, and `AppShell` reserves
 * horizontal room for it in the header's control cluster while a toggle is
 * registered, so it never overlaps the Menu button.
 *
 * ## CHROME-03 — ALWAYS RENDERED, in BOTH states, at the SAME viewport pixel
 *
 * This component is never conditionally rendered, never `visibility: hidden`,
 * never moved and never re-parented between states. Only the glyph and the
 * accessible name change. That is CHROME-03's "always rendered, always visible"
 * and D-01's "the same pixel in both states" — a user who taps once and does not
 * recognise the new glyph still finds the control exactly where their thumb left
 * it. Three independent outs mitigate T-22-12 (a stranded user in an installed
 * PWA, where force-quit is the only escape and at a show also costs the wake
 * lock): this control, first-in-tab-order while hidden (DOM order in
 * `ExploreView`, no positive `tabIndex` anywhere), and Escape via the shared LIFO
 * dismiss stack. Two more come free from the mechanism: nothing is persisted, so a
 * reload restores the chrome, and unregistering on unmount forces it back (D-11).
 *
 * ## Style notes, each copied rather than invented
 *
 *   - The neutral-control class string is `ExploreFilterFab`'s, minus `self-end`:
 *     same view, same layer family, same "neutral, never accent" rationale (gold
 *     is reserved for the active toggle half + focus ring, Phase-6 precedent).
 *   - Solid `bg-elevated`, NEVER `backdrop-blur` — partly legibility over a live
 *     constellation, partly because Phase-21 D-28 forbids a
 *     `filter`/`backdrop-filter`/`transform` ancestor for a `fixed` element.
 *   - `top` is copied VERBATIM from `AppShell.tsx`'s header padding — the app's one
 *     top-inset expression. D-13 forbids inventing a second one that can drift.
 *   - `right` is the shipped per-surface right-inset idiom from `ExploreFilterFab`.
 *   - `zIndex` is an INLINE style reading `config.ui.z.fab` (30), never a Tailwind
 *     `z-*` class. `fab` sits above the `chrome` tier (14), so the sliding chrome
 *     can never paint over the user's escape control (T-22-25); plan 22-01 added a
 *     named `chrome < fab` guard to `layerOrder.test.tsx` that pins the ordering.
 *   - NO bottom-space literal appears anywhere in this file. The only numbers here
 *     are the two inside the top/right inset `calc()` strings, both copied verbatim
 *     from shipped code. `ExploreFilterFab.tsx` is the single allowlisted bare
 *     tab-bar-height mirror in `test/bottomSpace.test.ts`; a sibling in this
 *     directory carrying one would fail that allowlist case.
 *
 * ## D-05 — the accessible name carries the state; no `aria-pressed`
 *
 * The label always names what the NEXT tap will do ("Hide bars" / "Show bars"),
 * matching the app's shipped `aria-label="Menu"` / `"Close menu"` idiom.
 * `aria-pressed` is the more correct toggle semantic in the abstract, but the app
 * has no existing consumer of it and the one control that must never confuse
 * anyone in the dark is the wrong place to introduce a new idiom. No
 * `aria-expanded` either — nothing here expands.
 *
 * ## D-04 — Escape restores; the OS back gesture is deliberately left alone
 *
 * Hijacking back means pushing a history entry, and this app has hash-only
 * navigation with no router; a spurious entry would make backing out of the app
 * unpredictable mid-show. Phase 23's INSHOW-02 builds that mechanism once,
 * deliberately. The dismiss hook is active ONLY while the chrome is hidden, so in
 * the normal state this control contributes nothing to the LIFO stack and one
 * Escape still closes exactly one thing (T-22-26).
 *
 * ## D-06 — no discovery affordance
 *
 * No hint, no once-per-build flag, no dismissal state. The glyph carries it and
 * the cost of missing it is zero: the app behaves exactly as it does today. The
 * app already carries one onboarding nag whose gating logic took two rounds to
 * settle; a second is not worth it for a purely additive convenience.
 */
import { useCallback, useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { config } from "../config.ts";
import { useDialogDismiss } from "../components/a11y/useDialogDismiss.ts";
import {
  registerChromeToggle,
  setChromeVisible,
  useChromeVisible,
} from "../layout/chromeVisibility.ts";

export function ChromeToggle() {
  const chromeVisible = useChromeVisible();

  // D-11 / T-22-12 second half: mounting reserves the header's toggle slot;
  // unmounting releases it AND forces the chrome back to visible unconditionally.
  // That is the persistence-free implementation of "the hidden state resets on
  // leaving GizzVerse" — no storage, no view-level cleanup code. The returned
  // unregister is idempotent, so React 19 StrictMode's double-invoked effects
  // cannot drive the mount count negative.
  useEffect(() => {
    const unregister = registerChromeToggle();
    return unregister;
  }, []);

  // Stable identity, kept as belt-and-braces rather than as a requirement:
  // `useDialogDismiss` now holds `onClose` in a ref and deps on `[active]` alone
  // (22-REVIEW WR-02), so a fresh closure here would no longer pop and re-push
  // this callback to the top of the shared LIFO on every render.
  const showChrome = useCallback(() => setChromeVisible(true), []);
  useDialogDismiss(!chromeVisible, showChrome);

  // `Maximize2` while visible (tap = hide the bars, the universal
  // expand-your-viewing-area affordance) and its exact inverse `Minimize2` while
  // hidden, so the control reads as ONE toggle rather than two buttons.
  const Glyph = chromeVisible ? Maximize2 : Minimize2;

  return (
    <button
      type="button"
      aria-label={
        chromeVisible
          ? config.copy.explore.chromeHide
          : config.copy.explore.chromeShow
      }
      onClick={() => setChromeVisible(!chromeVisible)}
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top) + 12px)",
        right: "calc(env(safe-area-inset-right) + 16px)",
        width: config.ui.chrome.CHROME_TOGGLE_SIZE_PX,
        height: config.ui.chrome.CHROME_TOGGLE_SIZE_PX,
        zIndex: config.ui.z.fab,
      }}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-hairline bg-elevated text-text-primary touch-manipulation focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Glyph size={24} aria-hidden />
    </button>
  );
}
