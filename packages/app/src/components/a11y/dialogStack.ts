/**
 * Phase-8 A11Y-01: a module-level LIFO stack of dialog dismiss callbacks with a
 * single shared `document` keydown listener (RESEARCH.md §Pattern 2).
 *
 * The app stacks dialogs (TrailNodeSheet swaps to SearchSheet; Settings shows the
 * "Whose dex?" prompt then CompareView). If every dialog attached its OWN
 * `document` keydown listener, one Escape would fire all of them and collapse the
 * whole stack (Pitfall 2). Instead: one listener, one LIFO — Escape invokes ONLY
 * the topmost dismiss callback, with `stopPropagation` so nothing behind it reacts.
 *
 * NO analog in the app (no module-level event store existed) — written per
 * RESEARCH §Pattern 2. `useDialogDismiss` is the React binding over this.
 */

const stack: Array<() => void> = [];
let installed = false;

function onKey(e: KeyboardEvent): void {
  if (e.key !== "Escape" || stack.length === 0) return;
  e.stopPropagation();
  stack[stack.length - 1]!(); // topmost only
}

function ensureInstalled(): void {
  if (installed || typeof document === "undefined") return;
  document.addEventListener("keydown", onKey);
  installed = true;
}

/** Push a dismiss callback onto the top of the stack (idempotently installs the listener). */
export function pushDialog(onClose: () => void): void {
  ensureInstalled();
  stack.push(onClose);
}

/** Remove a dismiss callback from the stack (by identity). No-op if absent. */
export function removeDialog(onClose: () => void): void {
  const i = stack.indexOf(onClose);
  if (i >= 0) stack.splice(i, 1);
}
