import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { BottomTabBar } from "./BottomTabBar";
import { IdentityAvatar } from "../auth/IdentityAvatar.tsx";
import { config } from "../config.ts";
import { useBottomSpaceVars } from "../layout/bottomSpace.ts";
import {
  useChromeToggleMounted,
  useChromeVisible,
} from "../layout/chromeVisibility.ts";

/**
 * Phase-22 CHROME-01/04 — the app shell is consumer #1 of the shared chrome-hide
 * mechanism in `layout/chromeVisibility.ts` (D-12). The control that DRIVES it is
 * deliberately NOT rendered here (D-03): chrome-hide on the other four tabs is a
 * capability CHROME-01 does not ask for, and each would then need its own
 * escapability and a11y verification. The view opts in; the shared module owns the
 * state; Phase 23's `ShowView` has a different trigger entirely (auto-hide while
 * tracking, no button).
 *
 * TWO RIDERS THAT NEED NO CODE, recorded so nobody "implements" them later:
 *   - D-14: an open `NodeSheet` is `fixed bottom-0` composing from
 *     `--gz-chrome-reserve`, so collapsing that reserve settles it down into the
 *     freed space for free. It is non-modal, so nothing about focus or Escape
 *     changes. This is the Phase-21 D-16 seam doing exactly what it was built for.
 *   - D-15: a toast firing while chrome is hidden simply renders at the collapsed
 *     position, because every toast composes from the same variable. Chrome is NOT
 *     forced back — that would yank the user out of a state they deliberately
 *     entered, triggered by an event they did not cause, and one of those events is
 *     the update-available prompt, which must never surprise-swap the app mid-show.
 *
 * THE NAMED, ACCEPTED COST of the one-commit rule (22-RESEARCH §Pattern 4): on SHOW,
 * the box expands at frame 0 while the chrome is still off-screen, so for ~200ms a
 * thin band at the top/bottom reads as empty. Restoring the flow at animation END
 * instead would be a SECOND resize and would violate CHROME-05. Take the band.
 */

export function AppShell({
  children,
  onMenuClick,
  scroll = true,
}: {
  children: ReactNode;
  onMenuClick?: () => void;
  /**
   * RESEARCH Pitfall 5 seam: the orbit stage must NOT scroll/rubber-band
   * (SHOW-13). `#/show` passes `scroll={false}` so `<main>` becomes a
   * non-scrolling full-height flex column and the OrbitStage (a `flex-1`
   * child) fills it without overflow. Other routes keep the scrolling `<main>`.
   */
  scroll?: boolean;
}) {
  // Bug fix (debug session: start-show-not-clickable) — this hook writes the
  // `--gz-*` bottom-space ladder (layout/bottomSpace.ts, the FOUND-02 single
  // owner) onto document.documentElement. <main> reserves `--gz-content-reserve`
  // on scrolling routes, and that composition already folds in whatever height
  // any OTHER fixed-bottom overlay (InstallBanner, UpdateToast) is really
  // rendering at right now, so <main>'s content is never covered/untappable
  // underneath one of those overlays. See pwa/bottomOverlayInset.ts — that
  // module still does the measuring; useBottomSpaceVars() now consumes it in
  // this component's place.
  //
  // Phase-22 D-12/CHROME-01: the Phase-21 D-16 `chromeVisible` seam is now a REAL
  // input, read from the shared store in layout/chromeVisibility.ts. ONE read, ONE
  // commit — the `setProperty` calls below land in the same React commit as every
  // other part of the collapse, which is what makes CHROME-05's "exactly one resize"
  // true by construction rather than by debouncing.
  const chromeVisible = useChromeVisible();
  const toggleMounted = useChromeToggleMounted();
  useBottomSpaceVars(chromeVisible);

  // D-07: reduced motion means INSTANT for chrome — no animation phase at all, not
  // a shortened one. This is deliberately DIFFERENT from the sheet rule (D-24), where
  // sheets keep an opacity cross-fade under reduced motion. One phase, two surfaces,
  // two justified answers; recorded here so neither is later "unified" by mistake.
  const reduce = useReducedMotion() ?? false;
  const chromeTransition = {
    duration: reduce ? 0 : config.ui.motion.CHROME_DURATION_MS / 1000,
    ease: chromeVisible
      ? config.ui.motion.CHROME_EASE_SHOW
      : config.ui.motion.CHROME_EASE_HIDE,
  };

  // Bug fix (debug session: start-show-not-clickable) — height is `h-full`
  // ONLY, never `min-h-screen`. The `html/body/#root { height:100% }` chain
  // (styles.css) grounds `h-full` to the real VISIBLE viewport (the bottom
  // safe-area inset is now reserved by `--gz-content-reserve` /
  // `--gz-chrome-reserve` on <main>, not by body padding — Phase-21 FOUND-01
  // deleted that body-level declaration). `min-h-screen` (=100vh) is the iOS
  // trap: on mobile Safari 100vh is the LARGE viewport (toolbars hidden), so it
  // forced this column taller than the visible screen — vertically-centered
  // content (PreShowLauncher's Start Show button) then centered against a box
  // extending below the fold, landing it low, under the fixed InstallBanner,
  // which intercepted the tap. Desktop was unaffected (100vh == visible there).
  return (
    <div className="flex h-full flex-col bg-surface text-text-primary">
      {/* CHROME-04. Four things happen to this element in ONE commit when the store
          flips, and every one of them is driven by the single synchronous
          `chromeVisible` read above — never deferred to a passive effect or a second
          rAF, which would split the box change across two frames and make CHROME-05
          false on device while still passing in jsdom.

          `inert` is the REACT 19 JSX BOOLEAN PROP, not the imperative `setRootInert`
          helper: React renders it as a real `inert=""` attribute, and probe P8
          confirmed jsdom implements no `inert`, so the JSX prop is the only form that
          is attribute-assertable in a test. It deliberately does NOT join
          `components/a11y/inertRoot.ts`'s ref count — that helper targets
          `#app-content` by id and ref-counts SHEET stacking; two different lifetimes
          sharing one counter is exactly how a Pitfall-5 underflow happens. Since
          `#app-content` is an ancestor of this header, an open modal sheet already
          inerts the whole shell and this prop is a harmless no-op — inertness is
          inherited and a descendant cannot un-set it.

          D-08's operative rule (hidden chrome leaves the a11y tree at animation
          START) is honoured by `inert` + `aria-hidden` + `pointer-events: none`
          landing in the SAME commit as the reserve collapse. D-08's "unmount at end"
          clause is deliberately NOT implemented — see the note on AnimatePresence
          below; the chrome stays mounted and inert instead. Staying mounted also
          avoids remounting BottomTabBar (and re-subscribing useHashRoute) on every
          toggle.

          THE CHROME IS DELIBERATELY NOT AN `AnimatePresence` CHILD, so §Pitfall 14's
          frozen-props hazard does not apply to any value here — every prop below
          re-renders normally on a store change. A future edit that wrapped this
          header in `AnimatePresence` would silently freeze `inert` and `position` at
          their VISIBLE-state values for the whole 200ms exit, which is the exact
          regression D-08 exists to prevent. Do not add it.

          TRANSFORM ONLY. Never animate `height`, `display` or `margin` — each is a
          layout property, and every animated frame would deliver a `ResizeObserver`
          callback into ConstellationCanvas, which is precisely what CHROME-05
          forbids (T-22-14). */}
      <motion.header
        inert={!chromeVisible}
        aria-hidden={chromeVisible ? undefined : true}
        className="flex items-center justify-between border-b border-hairline bg-elevated px-4 py-3"
        style={{
          zIndex: config.ui.z.chrome,
          // OQ3: out of flow via `position: absolute`, not a collapsing wrapper —
          // one element, no new wrapper node, and the `inert`/`aria-hidden` props
          // live on the same element CHROME-04 asserts against. `absolute` over
          // `fixed` avoids the Phase-21 D-28 transform-ancestor trap; this root
          // column is unpositioned and the document itself never scrolls (`<main>`
          // owns the scrolling), so `top: 0` is stable. Out of flow FROM FRAME 0 is
          // what hands the constellation the header's height immediately.
          ...(chromeVisible
            ? { position: "relative" as const }
            : {
                position: "absolute" as const,
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: "none" as const,
              }),
          paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        }}
        animate={{ y: chromeVisible ? 0 : "-100%" }}
        transition={chromeTransition}
      >
        <span className="text-[20px] font-semibold leading-tight">
          Gizz With Friends
        </span>
        {/* Identity + menu chrome. IdentityAvatar self-sources the current
            identity (renders nothing signed out) — no prop threading.

            The right-hand pad reserves horizontal room for the chrome toggle while
            one is mounted, so the fixed toggle never overlaps the Menu button. It is
            driven from the shared store rather than by a view reaching into AppShell,
            and rather than by adding an AppShell header SLOT — a slot's contents
            would vanish together with the header, which is fatal for CHROME-03's
            always-reachable exit control. */}
        <div
          data-testid="app-header-controls"
          className="flex items-center gap-1"
          style={{
            paddingRight: toggleMounted
              ? config.ui.chrome.CHROME_TOGGLE_SLOT_PX
              : undefined,
          }}
        >
          <IdentityAvatar />
          <button
            type="button"
            aria-label="Menu"
            onClick={onMenuClick}
            className="flex min-h-11 min-w-11 items-center justify-center text-text-muted"
          >
            <Menu size={22} />
          </button>
        </div>
      </motion.header>

      <main
        className={
          scroll
            ? "flex-1 overflow-y-auto"
            : "flex min-h-0 flex-1 flex-col overflow-hidden"
        }
        style={{
          // Scrolling routes RESERVE space for the transient fixed-bottom overlays
          // (InstallBanner/UpdateToast) so their content is never covered/untappable.
          // Non-scrolling routes (the orbit stage, the constellation) instead let
          // those overlays FLOAT over the bottom edge — reserving the inset here would
          // permanently squish a `flex-1` full-height stage every time a transient
          // banner appears. Only the static tab-bar height is reserved for them.
          // D-02: this divergence is deliberate and preserved. The two values are no
          // longer two hand-written strings but the owner's two NAMED compositions —
          // `--gz-content-reserve` (chrome + the measured overlay inset) and
          // `--gz-chrome-reserve` (chrome alone). See layout/bottomSpace.ts; they must
          // not be collapsed into one value.
          // PHASE-22: this expression is UNCHANGED. Both compositions now follow the
          // chrome collapse automatically, because the D-16 seam feeding them is a
          // real input — which is exactly what that seam was built for.
          paddingBottom: scroll
            ? "var(--gz-content-reserve)"
            : "var(--gz-chrome-reserve)",

          // D-13 — THE TOP SAFE-AREA INSET STAYS; the constellation does NOT run
          // under the notch. Today `env(safe-area-inset-top)` is reserved by exactly
          // one thing: the header's own `paddingTop` above. The instant the header
          // leaves the flow, nothing reserves it, `<main>` starts at viewport y=0 and
          // the stage runs under the status bar — invisible on a desktop, where the
          // inset is 0 (T-22-24).
          //
          // This is a BARE `env()` READ, the app's shipped per-surface top-inset
          // idiom (~10 such reads in src/), NOT a second `calc(env(...) + N)`
          // expression — D-13's rule is about not inventing a second FORMULA that can
          // drift from the shipped one. It is also out of scope of the Phase-21
          // FOUND-02 source guard, which pattern-matches only on
          // `env(safe-area-inset-bottom)`; top/left/right are explicitly exempt.
          //
          // It lands in the SAME commit as the reserve collapse and the flow change,
          // so CHROME-05's one-resize claim still holds.
          //
          // FOLLOW-ON TODO (deliberately NOT this phase's work): hoist
          // `env(safe-area-inset-top)` into a `--gz-safe-top` on `:root`, mirroring
          // `--gz-safe-bottom`. Better long-term shape, but it touches ten surfaces
          // including five device-verified sheets and can change where the header's
          // `bg-elevated` starts painting.
          paddingTop: chromeVisible ? undefined : "env(safe-area-inset-top)",
        }}
      >
        {children}
      </main>

      <BottomTabBar />
    </div>
  );
}
