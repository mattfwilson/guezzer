/**
 * Phase-8 A11Y-01: ref-counted `inert` toggle on the app-content root.
 *
 * A single boolean toggle would clear `inert` too early when modals stack
 * (RESEARCH Pitfall 4): closing the top modal must NOT re-enable the background
 * while a second modal is still open. So we count opens/closes and only flip the
 * native `inert` boolean on `#app-content` across the 0↔1 boundary.
 *
 * `inert` is React 19's native boolean prop / DOM property — it removes the whole
 * subtree from the tab order, pointer events, AND the AT accessibility tree, which
 * is exactly what `aria-modal` alone does NOT do. The app portals every open sheet
 * to `document.body` (outside `#app-content`), so the sheet stays interactive while
 * everything behind it goes inert.
 *
 * NO analog in the app — written per RESEARCH.md (Pitfall 4). Guards a missing
 * element (SSR / tests without the wrapper) instead of throwing.
 */

const APP_CONTENT_ID = "app-content";

let inertCount = 0;

/**
 * Ref-counted toggle. `setRootInert(true)` increments; the first increment sets
 * `inert` on `#app-content`. `setRootInert(false)` decrements; only the decrement
 * that returns the count to 0 clears `inert`. Two stacked modals therefore require
 * two `false` calls before the background becomes interactive again.
 */
export function setRootInert(on: boolean): void {
  if (on) {
    inertCount += 1;
    if (inertCount === 1) applyInert(true);
  } else {
    if (inertCount === 0) return; // never underflow
    inertCount -= 1;
    if (inertCount === 0) applyInert(false);
  }
}

function applyInert(value: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.getElementById(APP_CONTENT_ID);
  if (!root) return; // no target (missing wrapper) — no-op, never throw
  root.inert = value;
}
