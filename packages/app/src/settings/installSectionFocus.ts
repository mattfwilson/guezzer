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
 *
 * ## Why the request must also be ACKNOWLEDGED (22-REVIEW CR-01)
 *
 * A counter alone is not enough, because `SettingsView` is CONDITIONALLY MOUNTED
 * (`App.tsx`: `route === "settings" ? <SettingsView /> : …`). Leaving `#/settings`
 * unmounts it and returning remounts it, and React runs a mount effect regardless
 * of deps — so a bare monotonic counter that stayed at `1` made EVERY later visit
 * to Settings scroll to and focus the install heading, which is exactly what the
 * "do not steal focus on a plain visit" comment in `SettingsView` promised not to
 * do.
 *
 * The fix is a REQUEST/HANDLED pair. The snapshot is the DIFFERENCE, so `0` means
 * "nothing pending" in both the never-requested and the already-handled case, and
 * a remount reads `0` rather than a stale `1`. It is still a plain number, so
 * Pitfall 9 stays unreachable.
 *
 * A `useRef(installFocusRequest)` seed in the view would NOT work: the cross-route
 * deep link bumps the counter BEFORE the view mounts, so the ref would initialise
 * already-handled and the deep link would silently do nothing. The consumable
 * state has to live here, where both orderings see the same value.
 */

const listeners = new Set<() => void>();
let requestCount = 0;
let handledCount = 0;

/**
 * Signals that the Settings install section should be scrolled to and focused.
 * Call this BEFORE `navigate("settings")` so the subscriber sees one render
 * carrying both the new route and the new counter.
 */
export function requestInstallSectionFocus(): void {
  requestCount += 1;
  for (const listener of listeners) listener();
}

/**
 * Called by the subscriber once it has actually performed the focus move, so the
 * request stops being pending. Idempotent: acknowledging with nothing pending is
 * a silent no-op and notifies nobody (never-throw house style, and it keeps the
 * effect → acknowledge → notify → effect round trip bounded at one extra render).
 */
export function acknowledgeInstallSectionFocus(): void {
  if (handledCount === requestCount) return;
  handledCount = requestCount;
  for (const listener of listeners) listener();
}

/** `useSyncExternalStore` subscribe half — returns the unsubscribe function. */
export function subscribeInstallSectionFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Number of UNHANDLED requests. `0` means "nothing pending" — which covers both
 * "never requested" (the initial state) and "already acted on", so a remount of
 * the subscriber never re-fires a request that was consumed on an earlier visit.
 */
export function getInstallSectionFocusSnapshot(): number {
  return requestCount - handledCount;
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
  handledCount = 0;
  listeners.clear();
}
