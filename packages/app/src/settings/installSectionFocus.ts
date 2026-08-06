/**
 * The D-35 deep-link signal: "the user asked for the Settings install section".
 *
 * `AppMenu`'s single neutral "Add to Home Screen" row calls
 * `requestInstallSectionFocus()` and then `navigate("settings")`; `SettingsView`
 * subscribes here and, on every new request, scrolls its `#install` section into
 * view and moves focus to its heading.
 *
 * ## Why this is a COUNTER store, not a consumable boolean (22-RESEARCH Pitfall 10)
 *
 * The obvious shape — a module-level `let requested = false` plus a mount-time
 * effect in `SettingsView` that consumes it — silently does nothing in the case
 * that matters most: **the user is already on `#/settings`**. `navigate()`
 * assigns `location.hash`, and assigning the SAME hash fires no `hashchange`,
 * so `useHashRoute`'s `useSyncExternalStore` never notifies, `SettingsView`
 * never re-renders and never remounts, and the mount-time effect never runs
 * again. The row would look broken exactly once per session, at random.
 *
 * Holding a monotonically incrementing request counter and subscribing to it
 * fixes that: a second request is a NEW value, so React re-renders `SettingsView`
 * and its effect (keyed on the counter) re-fires whether or not the route
 * changed. It is the same `useSyncExternalStore` module shape as
 * `pwa/bottomOverlayInset.ts` and `pwa/install/installStore.ts` — and because
 * the snapshot is a plain **number**, not an object, React 19's
 * "result of getSnapshot should be cached" footgun (Pitfall 9) cannot apply
 * here at all.
 */

const listeners = new Set<() => void>();
let requestCount = 0;

/**
 * Signals that the Settings install section should be scrolled to and focused.
 * Call this BEFORE `navigate("settings")` so the subscriber sees one render
 * carrying both the new route and the new counter.
 */
export function requestInstallSectionFocus(): void {
  requestCount += 1;
  for (const listener of listeners) listener();
}

/** `useSyncExternalStore` subscribe half — returns the unsubscribe function. */
export function subscribeInstallSectionFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current request count. `0` means "never requested" — the initial state. */
export function getInstallSectionFocusSnapshot(): number {
  return requestCount;
}

/**
 * Server snapshot. The app has no SSR, so this is defensive — but React 19
 * warns "Missing getServerSnapshot" without one, and both shipped stores in
 * this codebase provide it.
 */
export function getInstallSectionFocusServerSnapshot(): number {
  return 0;
}

/** Test-only escape hatch to reset module state between test cases/files. */
export function __resetInstallSectionFocusForTests(): void {
  requestCount = 0;
  listeners.clear();
}
