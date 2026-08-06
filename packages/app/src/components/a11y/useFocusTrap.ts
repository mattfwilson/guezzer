/**
 * Phase-8 A11Y-01: the full focus lifecycle for a modal (RESEARCH.md §Pattern 1).
 *
 * On open (when `active`): capture `document.activeElement` (the trigger), mark the
 * background `inert` (ref-counted, composes with stacked modals), and move focus
 * inside the dialog — to the first focusable, else the container itself (which needs
 * `tabIndex={-1}`). A Tab / Shift+Tab keydown on the container wraps focus so it
 * never escapes to the (now inert) background — belt-and-suspenders on top of
 * `inert`, which already blocks the AT virtual cursor.
 *
 * On cleanup: remove the listener, decrement `inert`, and restore focus to the
 * captured trigger (D-01). The cleanup ALWAYS runs on unmount, so a keyboard/AT user
 * is never stranded (T-08-02) and the background is never left permanently inert
 * (T-08-03). When `active` is false the hook does nothing — no inert, no trap — which
 * is the non-modal NodeSheet path (D-02).
 *
 * NO analog in the app (nothing reads `document.activeElement`, sets `inert`, or
 * handles `Tab`) — reproduced from RESEARCH §Pattern 1.
 *
 * ## Phase-22 SHEET-02 — three changes, all of them a RE-TIMING, not a rewrite
 *
 * ⚠ **THE INVARIANT TO PRESERVE: `active` is a function of `open`, NEVER of "is this
 * still in the DOM".** React runs an effect's destroy whenever a dep changes, not
 * only on unmount, and `Sheet` passes `active: open && modal`. So the instant `open`
 * flips false this hook releases `inert` and restores focus — *while the sheet node
 * is still mounted and animating out*. That is close-START, and it is the whole
 * foundation of the D-19 timing contract. Making this hook presence-driven
 * (`useIsPresent()`) would defer the teardown to close-END and silently defeat it.
 * Confirmed empirically by probe P1 (22-RESEARCH §Pattern 3).
 *
 * 1. **`useLayoutEffect`, not `useEffect`** — the destroy now runs synchronously in
 *    the commit's mutation phase rather than after paint, so `inert` is released and
 *    the focus restore is *attempted* before `aria-hidden="true"` lands on the
 *    exiting card (Pitfall 4a: otherwise there is a frame where `aria-hidden` covers
 *    `document.activeElement`, the classic axe `aria-hidden-focus` violation).
 *    ⚠ The focus half cannot be *guaranteed* from the layout phase — `react-dom`
 *    re-applies its own pre-commit focus snapshot afterwards. See the long note on
 *    the second, passive effect below; that pair is what makes the restore stick.
 * 2. **A per-instance `releasedRef` makes the release idempotent** (Pitfall 5).
 *    `setRootInert(false)` decrements a SHARED count and guards underflow only at
 *    zero. With two sheets open the count is 2; a double release for one instance
 *    drops it 2 → 0 and the background becomes interactive underneath a still-open
 *    modal. The guard is invisible to a single-sheet test — `sheet.a11y.test.tsx`
 *    covers it by closing the BOTTOM sheet of an open stack.
 * 3. **`initialFocusRef` is no longer focused on activate (D-27).** Activation always
 *    focuses the first focusable (or the container), so focus is inside the trap from
 *    frame 0 and a keyboard/VoiceOver user is never parked on a now-`inert` trigger
 *    for the ~200ms enter. The explicit target is focused by the returned
 *    `focusInitialTarget()`, which `Sheet` calls at enter-END. It is idempotent, is a
 *    no-op when no `initialFocusRef` was supplied, and is referentially STABLE so it
 *    can be passed into a `motion` callback prop without churning identity.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { setRootInert } from "./inertRoot.ts";

const FOCUSABLE =
  "a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled])," +
  'select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface FocusTrapHandle {
  /**
   * D-27: focus the `initialFocusRef` target. Call at enter-END (from the card's
   * `onAnimationComplete`, guarded on presence — Pitfall 12). No-op when no
   * `initialFocusRef` was supplied or the ref is not yet attached; safe to call
   * more than once (focusing an already-focused element does nothing).
   */
  focusInitialTarget: () => void;
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  {
    active,
    initialFocusRef,
  }: {
    active: boolean;
    initialFocusRef?: RefObject<HTMLElement | null>;
  },
): FocusTrapHandle {
  const restoreTo = useRef<HTMLElement | null>(null);
  // Pitfall 5: one release per activation, no matter how many times the destroy
  // path is reached. Starts `true` so a destroy that never activated is a no-op.
  const releasedRef = useRef(true);
  // Ref-backed so `focusInitialTarget` can be `useCallback([])`-stable while still
  // seeing the latest ref object — a `motion` callback prop must not churn identity.
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;

  /**
   * D-19 item 2 / D-01. Idempotent by construction: focusing an already-focused
   * element is a no-op, and a trigger that has since left the document is skipped
   * (focusing a detached node would silently move focus to `<body>`).
   */
  const restoreFocus = useCallback(() => {
    const trigger = restoreTo.current;
    if (!trigger || !trigger.isConnected) return;
    if (document.activeElement === trigger) return;
    trigger.focus?.();
  }, []);

  useLayoutEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    releasedRef.current = false;
    setRootInert(true); // ref-counted — correct for stacked modals

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // D-27: first focusable → the container itself. `initialFocusRef` is
    // DELIBERATELY NOT read here — it is focused at enter-END via
    // `focusInitialTarget()`. Focus still lands inside the trap from frame 0.
    (focusables()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeyDown);

    // D-19 items 1 and 2. This runs the instant `active` flips false — i.e. at
    // close-START, with the sheet still in the DOM animating out — and again on
    // unmount. `releasedRef` makes the second one a no-op (Pitfall 5).
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      if (releasedRef.current) return; // already released — never double-decrement
      releasedRef.current = true;
      setRootInert(false); // ref-counted decrement
      restoreFocus(); // best-effort, as early as possible — see the note below
    };
    // `initialFocusRef` is no longer a dep: activation does not read it (D-27), so a
    // caller passing a fresh ref object must not tear down and rebuild the trap.
  }, [active, ref, restoreFocus]);

  // ── The focus restore needs the LAST word, and the layout phase is not it ────
  //
  // MEASURED, not assumed (this repo, React 19.2.7): `react-dom` captures
  // `document.activeElement` in `prepareForCommit` BEFORE the mutation phase and
  // re-applies it in `restoreSelection` at the END of `flushMutationEffects` —
  // i.e. AFTER every layout-effect destroy has run. On a sheet close the captured
  // element is whatever was focused INSIDE the sheet, so React re-focuses the
  // sheet's own control and silently undoes the layout-phase restore above. With
  // an `exit` variant the exiting card is still in the DOM, so React's
  // `isInDocument` check passes and the override always fires.
  //
  // A PASSIVE effect destroy runs after that, so it gets the last word. This is
  // also the timing the shipped Phase-8 hook had (it was a plain `useEffect`) and
  // that VoiceOver verified, so nothing regresses. The layout destroy above still
  // performs the restore first, which is what Pitfall 4a asks for whenever React
  // does NOT override (a hard unmount detaches the captured element, and
  // `restoreSelection` then skips it) — the two together mean focus is off the
  // exiting subtree as early as possible and is *guaranteed* by the end of the
  // commit, never merely attempted.
  useEffect(() => {
    if (!active) return;
    return restoreFocus;
  }, [active, restoreFocus]);

  const focusInitialTarget = useCallback(() => {
    initialFocusRefRef.current?.current?.focus?.();
  }, []);

  return { focusInitialTarget };
}
