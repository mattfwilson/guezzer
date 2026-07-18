/**
 * Phase-8 A11Y-01: the full focus lifecycle for a modal (RESEARCH.md §Pattern 1).
 *
 * On open (when `active`): capture `document.activeElement` (the trigger), mark the
 * background `inert` (ref-counted, composes with stacked modals), and move focus
 * inside the dialog — to `initialFocusRef` if given, else the first focusable, else
 * the container itself (which needs `tabIndex={-1}`). A Tab / Shift+Tab keydown on
 * the container wraps focus so it never escapes to the (now inert) background —
 * belt-and-suspenders on top of `inert`, which already blocks the AT virtual cursor.
 *
 * On cleanup: remove the listener, decrement `inert`, and restore focus to the
 * captured trigger (D-01). The cleanup ALWAYS runs on unmount, so a keyboard/AT user
 * is never stranded (T-08-02) and the background is never left permanently inert
 * (T-08-03). When `active` is false the hook does nothing — no inert, no trap — which
 * is the non-modal NodeSheet path (D-02).
 *
 * NO analog in the app (nothing reads `document.activeElement`, sets `inert`, or
 * handles `Tab`) — reproduced from RESEARCH §Pattern 1.
 */
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { setRootInert } from "./inertRoot.ts";

const FOCUSABLE =
  "a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled])," +
  'select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  {
    active,
    initialFocusRef,
  }: {
    active: boolean;
    initialFocusRef?: RefObject<HTMLElement | null>;
  },
): void {
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    setRootInert(true); // ref-counted — correct for stacked modals

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Initial focus: explicit ref → first focusable → the container itself.
    (initialFocusRef?.current ?? focusables()[0] ?? container).focus();

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

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      setRootInert(false); // ref-counted decrement
      restoreTo.current?.focus?.(); // restore focus to the trigger (D-01)
    };
  }, [active, ref, initialFocusRef]);
}
