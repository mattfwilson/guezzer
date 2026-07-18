/**
 * Phase-8 A11Y-01: Escape-to-dismiss for a dialog/sheet via the shared LIFO
 * `dialogStack` (RESEARCH.md §Pattern 2). While `active`, this hook keeps `onClose`
 * on top of the stack; the single shared `document` keydown listener fires only the
 * topmost callback on Escape, so one Escape closes exactly one (topmost) dialog.
 *
 * Lifecycle idiom mirrors the local add/remove-listener shape at NodeSheet.tsx:84-88.
 * The net-new part is the LIFO discipline (owned by dialogStack), not the effect.
 */
import { useEffect } from "react";
import { pushDialog, removeDialog } from "./dialogStack.ts";

export function useDialogDismiss(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    pushDialog(onClose);
    return () => removeDialog(onClose);
  }, [active, onClose]);
}
