import { useSyncExternalStore } from "react";

/**
 * Phase-22 D-12 — THE shared chrome-visibility mechanism.
 *
 * "Chrome" here means app chrome ONLY: the `AppShell` header and the
 * `BottomTabBar` (D-10). The `ExploreFilterFab` deliberately stays visible —
 * the edge slider and top-K declutter matter most in immersive mode, and this
 * is the only definition that means the same thing for Phase 23's live-show
 * consumer.
 *
 * MECHANISM, NOT CONTROL. This module owns the STATE; it renders nothing and
 * knows about no view. `AppShell` is consumer #1 (it collapses the bottom-space
 * ladder, takes the header out of flow and inerts both chrome surfaces).
 * The user-facing control that DRIVES it lands separately, in plan 22-07,
 * because control and mechanism must be separable: Phase 23's consumer has a
 * different trigger entirely (auto-hide while tracking, no button — D-03).
 *
 * SHAPE: copied verbatim from `pwa/bottomOverlayInset.ts` (idiom I-1) —
 * module state + `Set<listener>` + CACHED scalar snapshots recomputed only in
 * `notify()` + `getServerSnapshot` + a test-reset escape hatch.
 *
 * TWO SCALAR HOOKS, NEVER ONE OBJECT SNAPSHOT. `bottomOverlayInset` returns a
 * number for exactly this reason and has never tripped React 19's
 * uncached-`getSnapshot` infinite loop. An object snapshot would allocate a new
 * identity on every read, which is that footgun.
 *
 * NO STORAGE API OF ANY KIND — no Web Storage (session or local), no IDB, no
 * Dexie `meta` row, no storage key. (Those API names are deliberately spelled
 * around rather than out, so the file itself answers a plain-text search for
 * them with zero hits.) That is what makes CHROME-03's
 * "a cold boot never starts hidden" true BY CONSTRUCTION rather than by a rule
 * someone must maintain: a fresh module evaluation *is* the visible state
 * (D-11). Do not add persistence here — escapability stops being unconditional
 * the moment a hidden state can survive a reload. In an installed PWA there is
 * no address bar and no back button, so a stranded user's only escape would be
 * a force-quit, which at a show also costs the wake lock (T-22-12).
 */

const listeners = new Set<() => void>();

/** Live state. `visible` starts true — see the no-storage note above. */
let visible = true;
let toggleCount = 0;

/**
 * CACHED snapshots. Recomputed ONLY in `notify()`, never inside a `getSnapshot`
 * function — the two `getX` reads below must be pure and referentially stable.
 */
let visibleSnapshot = true;
let toggleMountedSnapshot = false;

function notify(): void {
  visibleSnapshot = visible;
  toggleMountedSnapshot = toggleCount > 0;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVisibleSnapshot(): boolean {
  return visibleSnapshot;
}

function getServerVisibleSnapshot(): boolean {
  return true;
}

function getToggleMountedSnapshot(): boolean {
  return toggleMountedSnapshot;
}

function getServerToggleMountedSnapshot(): boolean {
  return false;
}

/**
 * Whether the app chrome is currently shown. `AppShell` reads this ONCE and
 * drives every part of the collapse from that single synchronous value, which
 * is what makes CHROME-05's "exactly one resize" true by construction rather
 * than by debouncing.
 */
export function useChromeVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    getVisibleSnapshot,
    getServerVisibleSnapshot,
  );
}

/**
 * Whether a chrome toggle control is currently mounted. `AppShell` uses this to
 * reserve horizontal room for it in the header's control cluster, so the fixed
 * toggle never overlaps the Menu button — driven from the store rather than
 * from a view reaching into `AppShell`, and rather than an `AppShell` header
 * slot (a slot's contents would vanish WITH the header, which is fatal for
 * CHROME-03's always-reachable exit control).
 */
export function useChromeToggleMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    getToggleMountedSnapshot,
    getServerToggleMountedSnapshot,
  );
}

/**
 * Shows / hides the app chrome. Early-returns when unchanged — the same
 * notify-loop discipline as `setBottomOverlayHeight`'s
 * `if (heights.get(id) === rounded) return;`.
 *
 * ⚠ UNENFORCED PRECONDITION (22-REVIEW WR-04, deferred to Phase 23 by
 * 22-VERIFICATION.md): calling this with `false` while `toggleCount === 0` would
 * enter a state with no visible escape control, no Escape handler (both live in
 * `ChromeToggle`) and no reset on route change (the unregister that forces
 * `visible = true` only runs when a count that was >= 1 drops to 0). In an
 * installed PWA that is force-quit territory — the T-22-12 failure this whole
 * module is shaped around.
 *
 * It is NOT reachable today: `ChromeToggle` is the sole caller, it is the sole
 * entry into the hidden state, and it registers on mount before any click can
 * reach this setter. So escapability holds by CO-LOCATION, not by construction.
 *
 * A `if (next === false && toggleCount === 0) return;` guard is deliberately NOT
 * added here, because it would contradict D-12 above: this module owns the state
 * and knows about no view, and Phase 23's consumer is specified as "auto-hide
 * while tracking, NO BUTTON (D-03)" — a guard would force that button-less
 * consumer to register a control it does not have. Phase 23 owns the structural
 * fix, together with the requirement that says what its escape route is. Whatever
 * that turns out to be, this setter is where it belongs.
 */
export function setChromeVisible(next: boolean): void {
  if (visible === next) return;
  visible = next;
  notify();
}

/**
 * Registers a mounted chrome toggle; returns its unregister.
 *
 * D-11 — "hidden state resets on leaving GizzVerse" is implemented HERE, with
 * no storage and no view-level cleanup code: the toggle unmounts with its view,
 * so when the mount count returns to 0 the chrome is forced back to VISIBLE
 * unconditionally. Switching tabs (or unmounting the view for any other reason)
 * therefore always restores the chrome. This is also the second half of
 * T-22-12's mitigation — no route change can leave a user in a chrome-hidden
 * state whose only control has just unmounted.
 *
 * The returned unregister is idempotent: calling it twice cannot drive the
 * count negative (the Pitfall-5 underflow shape that a shared ref count hits).
 */
export function registerChromeToggle(): () => void {
  toggleCount += 1;
  notify();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    toggleCount = Math.max(0, toggleCount - 1);
    if (toggleCount === 0) visible = true;
    notify();
  };
}

/**
 * Test-only escape hatch to reset module state between test cases/files.
 *
 * ⚠ 22-REVIEW WR-09 — DO NOT RE-ADD `listeners.clear()`. React's
 * `useSyncExternalStore` holds no reference to this set beyond the unsubscribe
 * closure it was handed, so clearing it while components are still mounted left
 * those components PERMANENTLY DEAF to the store, with no error and no warning
 * (their later unsubscribe then deleted from an already-empty set — a silent
 * no-op). Every shipped call site happened to run `cleanup()` first, so nothing
 * was broken; but that ordering was load-bearing and undocumented, and the more
 * natural `beforeEach(__resetChromeVisibilityForTests)` placement would have
 * produced tests that render, mutate the store and observe nothing, failing for a
 * reason with no connection to the assertion.
 *
 * The state reset is what tests actually need. Fanning out through `notify()`
 * rather than assigning the cached snapshots directly means a subscriber that IS
 * still mounted re-reads the reset values instead of holding a stale snapshot —
 * so the hatch is now safe in any order, not merely in the shipped one.
 */
export function __resetChromeVisibilityForTests(): void {
  visible = true;
  toggleCount = 0;
  notify();
}
