/**
 * Phase-8 A11Y-01 (D-01): the ONE shared sheet/modal primitive the 6 true modals
 * migrate onto (plans 02/03) — it absorbs the `rounded-t-2xl border-t
 * border-hairline bg-elevated` + safe-area shell copied inline into every sheet
 * today, and wires the net-new a11y layer (focus trap + inert + Escape + restore)
 * in ONE place (RESEARCH.md §Pattern 3).
 *
 * Key mechanics:
 * - Portals to `document.body` via `createPortal`, so an open sheet's DOM lands
 *   OUTSIDE `#app-content` and stays interactive while the background is `inert`.
 * - `useFocusTrap(contentRef, { active: open && modal })` — initial focus + Tab-wrap
 *   + ref-counted `inert` + focus-restore. Only MODAL sheets trap/inert; a non-modal
 *   sheet still gets Escape + focus-restore but leaves the background interactive
 *   and renders no scrim. That non-modal path (`modal={false}` / `backdrop={false}`)
 *   has ZERO live consumers today (D-31): `NodeSheet` is hand-rolled and never used
 *   these props. The capability is kept because Phase 23's overlays may want it, but
 *   it is currently UNEXERCISED — do not read it as verified behaviour.
 * - `useDialogDismiss(open, onClose)` — Escape via the shared LIFO stack (topmost only).
 * - `children` pass through untouched — no HTML injection, never
 *   `dangerouslySetInnerHTML` (T-08-01).
 *
 * ## Phase-22 SHEET-01: the portal → AnimatePresence → SheetSurface restructure
 *
 * `AnimatePresence` CANNOT wrap a `createPortal` call. framer-motion's
 * `onlyElements()` filters children through React's `isValidElement`, which accepts
 * only `Symbol.for("react.transitional.element")`; a portal is
 * `Symbol.for("react.portal")`, so a portal child is silently dropped and
 * `AnimatePresence` renders nothing, with NO warning. The portal is therefore the
 * OUTER layer and everything presence-dependent lives in `SheetSurface` below.
 *
 * The shipped `if (!open) return null` guard (V7 / T-08-04) is gone; its two
 * properties survive in the emptiness expression `{open && <SheetSurface …/>}` —
 * a closed sheet renders `false`, `onlyElements` filters it, ZERO DOM nodes are
 * created, nothing is appended to `document.body`, and nothing throws. The
 * SSR/jsdom `typeof document === "undefined"` guard stays exactly where it was.
 *
 * ## Phase-22 SHEET-02: the close-START contract (D-19), and how to back it out
 *
 * ONE timing rule for the whole surface: **a sheet leaves the accessibility tree and
 * stops being a pointer target at the START of its exit, and leaves the DOM only at
 * the END.** In the same tick `onClose` is requested: the background `inert` is
 * released and focus returns to the trigger (`useFocusTrap`'s teardown, which fires
 * then because its `active` is a function of `open`), the exiting card gets
 * `aria-hidden`, and card and scrim both stop being pointer targets. Only
 * `AnimatePresence`'s DOM removal waits for the ~200ms animation.
 *
 * **Backing it out (D-17/D-18).** The `exit` variants, the presence-derived `closing`
 * bundle, the scrim's presence-derived `onClick` and
 * `packages/app/test/sheet.closeStart.test.tsx` all landed in ONE commit, so a single
 * `git revert` restores the sanctioned enter-only ship: close behaviour reverts to
 * immediate removal, and no orphaned test is left asserting an exit window that no
 * longer exists. There is deliberately NO runtime kill-switch and NO feature flag —
 * a flag ships both code paths, both need testing, and the un-animated path rots
 * unexercised until the night it matters. The full revert procedure (including the
 * three exit-window `describe` blocks that live in OTHER files) is plan 22-09's
 * revert procedure 1.
 *
 * ## Four things recorded so the next reader finds the reason instead of a "fix"
 *
 * (a) D-16 — the five HAND-ROLLED sheets (`SearchSheet`, `AlbumDetail`,
 *     `ArchiveBrowser`, `SetlistView`, `NodeSheet`) stay static. `SearchSheet` —
 *     the one-thumb in-the-dark surface used most at a show — will visibly NOT
 *     animate while everything else does. That is a named, accepted seam. Do not
 *     "fix" it by copying this animation into five more files.
 *
 * (b) Pitfall 1 — nine of the nineteen `<Sheet>` element openings hard-code
 *     `open` and are removed by their PARENT, so they get an enter animation but
 *     no exit and no close-start window: `CompareView` (×2), `DexView`,
 *     `FriendDetail` (×2), `PinSheet` (×2), `TrailNodeSheet`, `WhyDetail`. Plan
 *     22-04 converts `DexView` only (the D-21 fullscreen exemplar); the rest are a
 *     documented seam, not an oversight.
 *
 * (c) D-28 / D-29 non-goals. Stacked-sheet scrims are left EXACTLY as they ship:
 *     two open sheets paint two scrims and the background reads darker, and
 *     suppressing the nested one would need open-sheet counting inside the
 *     primitive. There is also NO swipe-down-to-dismiss — the primitive
 *     deliberately owns no drag geometry, and Phase 23's INSHOW-03 rules it out
 *     by name.
 *
 * (d) Forward-looking constraint (probe P6, Phase-21 D-28). While a sheet
 *     animates, `motion` writes a `transform` onto the card, which makes the card
 *     the containing block for any `position: fixed` DESCENDANT for the ~200ms
 *     window. A grep found no `position: fixed` descendant in any current
 *     `<Sheet>` consumer, so present exposure is ZERO — but a future consumer must
 *     not introduce one.
 *
 * The primitive deliberately owns NO scroll internals, drag geometry, or content
 * layout — those stay in each sheet so it never over-abstracts.
 */
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { config } from "../config.ts";
import { useDialogDismiss } from "./a11y/useDialogDismiss.ts";
import { useFocusTrap } from "./a11y/useFocusTrap.ts";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the `role="dialog"` container (kglw-derived → React text). */
  ariaLabel: string;
  /** `bottom-sheet` (default) = the absorbed shell; `fullscreen` = CompareView-style overlay. */
  variant?: "bottom-sheet" | "fullscreen";
  /**
   * Default true. `false` = non-modal variant: no trap, no inert, no scrim.
   * Currently UNEXERCISED — no surface in the app passes it (D-31).
   */
  modal?: boolean;
  /** Default = modal. Renders the tap-to-close backdrop scrim (bottom-sheet only). */
  backdrop?: boolean;
  /** Element to focus on open instead of the first focusable (e.g. the Settings name input). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function Sheet({
  open,
  onClose,
  ariaLabel,
  variant = "bottom-sheet",
  modal = true,
  backdrop = modal,
  initialFocusRef,
  children,
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // INVARIANT (§Pattern 3): `active` is a function of `open`, NEVER of presence.
  // Both hooks are correct as functions of `open` precisely BECAUSE `Sheet` is not
  // the element `AnimatePresence` freezes — `SheetSurface` is. Their cleanup
  // therefore fires in the same commit `open` flips, which is what plan 22-02's
  // close-start teardown (D-19 items 1 and 2) is built on. Do not move them down
  // into `SheetSurface`.
  const { focusInitialTarget } = useFocusTrap(contentRef, {
    active: open && modal,
    initialFocusRef,
  });
  useDialogDismiss(open, onClose);

  if (typeof document === "undefined") return null;

  return createPortal(
    // `initial` is deliberately LEFT AT ITS DEFAULT. `initial={false}` resolves to
    // `false` on the first render, which silently kills the enter animation for the
    // nine `<Sheet>` instances that mount already-open while leaving the ten
    // prop-driven ones animating — a failure that looks random.
    //
    // `mode` is deliberately UNSET (default `"sync"`). `mode="popLayout"` wraps the
    // child in `PopChild`, which applies `position: absolute` plus a measured
    // width/height and destroys a `position: fixed` full-viewport scrim's geometry;
    // `mode="wait"` renders only exiting children until they finish, delaying re-open.
    <AnimatePresence>
      {/* V7 / T-08-04 lives HERE now: a closed sheet renders `false`, `onlyElements`
          filters it, so zero DOM nodes are created and nothing ever throws. */}
      {open && (
        <SheetSurface
          key="sheet"
          contentRef={contentRef}
          focusInitialTarget={focusInitialTarget}
          onClose={onClose}
          ariaLabel={ariaLabel}
          variant={variant}
          modal={modal}
          backdrop={backdrop}
        >
          {children}
        </SheetSurface>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface SheetSurfaceProps {
  contentRef: RefObject<HTMLDivElement | null>;
  /** D-27: focuses `initialFocusRef` at enter-END. Stable identity (see the hook). */
  focusInitialTarget: () => void;
  onClose: () => void;
  ariaLabel: string;
  variant: "bottom-sheet" | "fullscreen";
  modal: boolean;
  backdrop: boolean;
  children: ReactNode;
}

/**
 * Everything `AnimatePresence` must be able to freeze lives here, as ONE child.
 *
 * OQ2 — the scrim and the card are SIBLINGS in a fragment, not nested. Three
 * reasons, in order of weight:
 *   1. Nesting would FADE THE CARD. `opacity` applies to the whole subtree, so a
 *      scrim parent animating `opacity: 0 → 1` drags the card's rendered opacity
 *      with it. 22-UI-SPEC §Per-variant motion is explicit that the bottom-sheet
 *      card translates with its OPACITY UNCHANGED — nesting cannot satisfy that.
 *   2. `pointer-events: none` becomes a structural property of two siblings rather
 *      than an inheritance rule a `pointer-events-auto` class can silently defeat.
 *   3. It is the shape probed live in this repo (P1), so the whole close-start
 *      contract of plan 22-02 is already known to hold against it.
 *
 * `AnimatePresence` sees ONE child (this component) and waits for BOTH inner motion
 * components to finish their `exit` before unmounting: one presence, two parallel
 * timelines, one unmount.
 */
function SheetSurface({
  contentRef,
  focusInitialTarget,
  onClose,
  ariaLabel,
  variant,
  modal,
  backdrop,
  children,
}: SheetSurfaceProps) {
  // ⚠ §Pitfall 14 — THE reason this component exists. An exiting `AnimatePresence`
  // child renders from a FROZEN React element: anything computed in `Sheet`'s render
  // from `open` is baked in at `open === true` and stays that way for the entire exit
  // window. `useIsPresent()` reads a CONTEXT value that `PresenceChild` re-creates
  // when presence flips, so it is the one signal that actually changes on exit.
  // EVERY presence-dependent value below must derive from this, never from `open`.
  const isPresent = useIsPresent();

  // `useReducedMotion()` is typed `boolean | null` — normalise before branching.
  const reduce = useReducedMotion() ?? false;

  // ── D-27: the `initialFocusRef` focus move, deferred to enter-END ───────────
  //
  // WHY it is deferred at all: `SettingsView`'s name input and `PinSheet`'s label
  // input open the iOS keyboard, and focusing a TRANSLATING element races two layout
  // changes on the platform where this app's viewport math has already misfired
  // twice. Accepted cost: ~200ms before the user can type. `useFocusTrap` still moves
  // focus to the first focusable at enter-START, so nobody is ever stranded outside
  // the trap mid-animation.
  //
  // WHY a fallback timer and not `onAnimationComplete` alone (T-22-21): if the
  // animation is interrupted, cancelled, or never scheduled — a backgrounded tab, a
  // future `MotionConfig skipAnimations` — the completion callback may never fire and
  // the input would never be focused, stranding the user in a text-entry sheet they
  // cannot type into. Focusing an already-focused element is a no-op, so a
  // double-fire is harmless; a never-fire is not. Whichever path wins clears the
  // other.
  const isPresentRef = useRef(isPresent);
  isPresentRef.current = isPresent;
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearFocusFallback = useCallback(() => {
    if (fallbackRef.current !== null) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);
  useEffect(() => {
    fallbackRef.current = setTimeout(() => {
      fallbackRef.current = null;
      if (isPresentRef.current) focusInitialTarget();
    }, config.ui.motion.SHEET_DURATION_MS);
    return clearFocusFallback;
  }, [focusInitialTarget, clearFocusFallback]);

  // Pitfall 12: `onAnimationComplete` fires for the EXIT too — `motion-dom` notifies
  // "AnimationComplete" for any definition. The guard MUST be `isPresent`, never
  // `open`: an `if (open)` guard is itself frozen on the exiting element (§Pitfall 14)
  // and would yank focus back into a sheet that is already gone.
  const onCardAnimationComplete = () => {
    clearFocusFallback();
    if (isPresent) focusInitialTarget();
  };

  // D-25: the duration and easing are READ FROM CONFIG, never written as a literal.
  // `motion` takes seconds; the config value stays in ms (the unit every other
  // timing constant in config.ts uses), so the `/ 1000` happens here at the consumer.
  //
  // The EASE flips with presence — decelerate into place on the way in, accelerate
  // away on the way out. The DURATION does not: card and scrim run in parallel on one
  // duration, never staged. A scrim that lagged the card would leave a painted scrim
  // after the sheet is gone, which would turn `pointer-events: none` on the first exit
  // frame from a structural property into a subtle, easily-regressed rule.
  const transition = {
    duration: config.ui.motion.SHEET_DURATION_MS / 1000,
    ease: isPresent
      ? config.ui.motion.SHEET_EASE_ENTER
      : config.ui.motion.SHEET_EASE_EXIT,
  };

  // ── D-19 items 3 and 4, the close-START teardown that is NOT `useFocusTrap`'s ──
  //
  // ⚠ NEVER derive these from `open`. On the exiting element that expression is
  // frozen at `open === true` and both attributes silently never appear (§Pitfall 14)
  // — VoiceOver reads a sheet that is on its way out and a tap in the exit window is
  // swallowed by a ghost. `isPresent` is the only signal that actually flips, and it
  // SELF-CORRECTS on re-open (D-22 interrupt-and-reverse): there is no imperative
  // attribute left behind to undo, because nothing was ever imperatively set.
  const closing = {
    "aria-hidden": isPresent ? undefined : (true as const),
    style: { pointerEvents: isPresent ? undefined : ("none" as const) },
  };

  const dialogProps = {
    ref: contentRef,
    role: "dialog" as const,
    "aria-modal": modal,
    "aria-label": ariaLabel,
    tabIndex: -1,
  };

  // 22-UI-SPEC §Per-variant motion, exactly:
  //  • bottom-sheet card, motion allowed → TRANSLATE ONLY. The card's opacity is
  //    never animated: the scrim owns the opacity channel, and animating both would
  //    dim the card through its own scrim.
  //  • bottom-sheet card, reduced motion → drop the translate, keep the opacity
  //    cross-fade (the shipped `WaveToast` reduced path — WCAG "motion" means
  //    movement, and a cross-fade is the correct reading of "without motion").
  //  • fullscreen, BOTH motion modes → opacity only (D-26): a full-bleed overlay
  //    sliding a whole viewport height reads as a page transition, not a sheet.
  //    Live consumers: CompareView (×2), DexView, FriendDetail (×2).
  //
  // `y` is the PERCENTAGE "100%", never a pixel value: sheet height is
  // content-driven and varies per surface, and a percentage transform resolves
  // against the element's own box, so the primitive never has to measure content.
  //
  // The `exit` half is the mirror of the enter in every case, so the card leaves the
  // way it arrived. Interruption needs NO special case (D-22): `AnimatePresence`
  // reverses from the current position, and every close-start value above derives
  // from `useIsPresent()`, so re-opening mid-exit restores a fully interactive sheet
  // with no stale attribute to clean up.
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
  const slide = {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
  };
  const cardMotion = variant === "fullscreen" || reduce ? fade : slide;

  return (
    <>
      {variant === "bottom-sheet" && backdrop && (
        <motion.div
          key="sheet-scrim"
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: config.ui.z.sheetScrim, ...closing.style }}
          // Decorative dimmer with no name and no content. Safe to hide from AT
          // ONLY because it is now a SIBLING of the dialog — as the card's former
          // parent it would have hidden the dialog with it. Already unconditionally
          // hidden, so it takes only the `style` half of `closing`.
          aria-hidden="true"
          // Pitfall 4b — TWO mechanisms, ONE contract. The inline
          // `pointer-events: none` above is what makes the exiting scrim
          // untappable in a real browser. Dropping the handler is what makes that
          // PROVABLE in jsdom: `fireEvent.click` in `@testing-library/dom`
          // dispatches directly and IGNORES `pointer-events` (only `user-event`
          // enforces it, and it is deliberately not installed). Without this line
          // a tap during the ~200ms exit would re-enter `onClose` on a sheet that
          // is already leaving.
          onClick={isPresent ? onClose : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        />
      )}
      <motion.div
        {...dialogProps}
        {...closing}
        key="sheet-card"
        className={
          variant === "fullscreen"
            ? "fixed inset-0 overflow-y-auto bg-surface"
            : "fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
        }
        style={{
          zIndex: config.ui.z.sheet,
          // D-07: sheet bottom padding is deliberately NOT tab-bar-relative — a sheet
          // COVERS the tab bar rather than sitting above it, so it composes from
          // `--gz-safe-bottom`, never `--gz-chrome-reserve`.
          // The value is inherited from `document.documentElement` (where plan 21-07
          // writes the ladder), which is why it still resolves inside this
          // `createPortal(…, document.body)` subtree.
          paddingBottom:
            variant === "fullscreen" ? undefined : "var(--gz-sheet-pad-bottom)",
          // Pitfall 4c: `pointer-events: none` on an ancestor does NOT override a
          // descendant that sets `auto`, and these two are siblings anyway — the
          // card needs its own copy, not the scrim's.
          ...closing.style,
        }}
        {...cardMotion}
        transition={transition}
        onAnimationComplete={onCardAnimationComplete}
      >
        {/* The card no longer carries `pointer-events-auto` or an `onClick`
            stopPropagation. Both existed only because the scrim used to be this
            card's PARENT: the class re-enabled taps under a `pointer-events-none`
            wrapper, and the stopPropagation kept a tap inside the card from
            bubbling into the scrim's close handler. As siblings, neither can
            happen — nothing above the card is `pointer-events-none`, and a card
            tap has no path to the scrim. */}
        {children}
      </motion.div>
    </>
  );
}
