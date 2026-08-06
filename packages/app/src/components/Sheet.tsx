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
 * This plan (22-01) ships ENTER ONLY. There is deliberately no `exit` variant, so
 * close behaviour is byte-identical to today's immediate removal — which is what
 * makes this commit safe to ship WITHOUT plan 22-02's close-start teardown (D-17:
 * the exit variants and the D-19 teardown land together, atomically, or not at all).
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
import { useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  useFocusTrap(contentRef, { active: open && modal, initialFocusRef });
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
 * `AnimatePresence` sees ONE child (this component) and, once plan 22-02 adds the
 * `exit` variants, will wait for BOTH inner motion components before unmounting:
 * one presence, two parallel timelines, one unmount.
 */
function SheetSurface({
  contentRef,
  onClose,
  ariaLabel,
  variant,
  modal,
  backdrop,
  children,
}: SheetSurfaceProps) {
  // `useReducedMotion()` is typed `boolean | null` — normalise before branching.
  const reduce = useReducedMotion() ?? false;

  // D-25: the duration and easing are READ FROM CONFIG, never written as a literal.
  // `motion` takes seconds; the config value stays in ms (the unit every other
  // timing constant in config.ts uses), so the `/ 1000` happens here at the consumer.
  const transition = {
    duration: config.ui.motion.SHEET_DURATION_MS / 1000,
    ease: config.ui.motion.SHEET_EASE_ENTER,
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
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 } };
  const slide = { initial: { y: "100%" }, animate: { y: 0 } };
  const cardMotion = variant === "fullscreen" || reduce ? fade : slide;

  return (
    <>
      {variant === "bottom-sheet" && backdrop && (
        <motion.div
          key="sheet-scrim"
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: config.ui.z.sheetScrim }}
          // Decorative dimmer with no name and no content. Safe to hide from AT
          // ONLY because it is now a SIBLING of the dialog — as the card's former
          // parent it would have hidden the dialog with it.
          aria-hidden="true"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition}
        />
      )}
      <motion.div
        {...dialogProps}
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
        }}
        {...cardMotion}
        transition={transition}
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
