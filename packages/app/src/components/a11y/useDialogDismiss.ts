/**
 * Phase-8 A11Y-01: Escape-to-dismiss for a dialog/sheet via the shared LIFO
 * `dialogStack` (RESEARCH.md §Pattern 2). While `active`, this hook keeps `onClose`
 * on top of the stack; the single shared `document` keydown listener fires only the
 * topmost callback on Escape, so one Escape closes exactly one (topmost) dialog.
 *
 * Lifecycle idiom mirrors the local add/remove-listener shape at NodeSheet.tsx:84-88.
 * The net-new part is the LIFO discipline (owned by dialogStack), not the effect.
 */
import { useEffect, useRef } from "react";
import { pushDialog, removeDialog } from "./dialogStack.ts";

/**
 * 22-REVIEW WR-02 — the STACK POSITION MUST NOT DEPEND ON `onClose`'s IDENTITY.
 *
 * `pushDialog` appends to the top of a LIFO, so an effect keyed on `[active,
 * onClose]` re-orders the stack on any render that produces a new callback
 * identity: the cleanup pops the old closure and the re-run pushes the new one
 * back on TOP, silently changing which surface Escape dismisses. Almost every
 * consumer passes an inline arrow (`onClose={() => setOpenShow(null)}` from
 * `DexView`, and all nineteen `<Sheet>` call sites), and `DexView` re-renders on
 * every `useDexStats` live-query tick.
 *
 * That reordering used to be masked by tree order -- the surfaces that can stack
 * happen to be siblings in one component, so a re-push landed back where it
 * started. That is coincidence, not a property: one re-render of only the LOWER
 * surface's parent inverts the stack, and the next Escape closes the wrong dialog.
 *
 * Holding the callback in a ref and registering a STABLE handler makes the effect
 * depend on `active` alone, so a registration is pushed exactly once per active
 * window regardless of how often the consumer re-renders. It also removes the
 * need for consumers to remember `useCallback` (`ChromeToggle` documents doing
 * exactly that as a workaround for the old deps array).
 *
 * The ref is written during render rather than in an effect on purpose: the
 * handler must call the LATEST `onClose`, and a commit-phase write would leave a
 * one-render-stale closure reachable by an Escape dispatched in between.
 */
export function useDialogDismiss(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const handler = () => onCloseRef.current();
    pushDialog(handler);
    return () => removeDialog(handler);
  }, [active]);
}
