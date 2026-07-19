/**
 * Screen Wake Lock helper (SHOW-12) — holds the display awake during an active
 * show so the orbit never dims mid-set. Mirrors pwa/persist.ts's browser-API
 * idiom exactly: feature-detect, wrap every API call in try/catch, and NEVER
 * throw (silent-on-failure, D-09-style) — a failed lock must degrade to a calm
 * fallback notice, never brick the tracking loop (T-04-16, ASVS V7).
 *
 * HIGHEST-RISK caveat (04-RESEARCH §Pitfall 1, WebKit bug 254545): on installed
 * iOS/iPadOS PWAs before iOS 18.4, `"wakeLock" in navigator` is `true` and
 * `request("screen")` may resolve, but the lock does NOT actually hold — the
 * screen still dims/sleeps. Presence is therefore NOT proof: after `request()`
 * we VERIFY the returned sentinel is live (did not immediately fire `release`),
 * and treat an already-released sentinel, a rejection, or a missing API as
 * "unsupported here" → the caller shows WakeLockNotice once per show.
 *
 * iOS also releases the lock whenever the app is backgrounded, so a module-level
 * `visibilitychange` listener reacquires on return-to-visible while a show is
 * active — SILENTLY, no copy (04-UI-SPEC: only the *unsupported* case messages).
 */

/** The live sentinel while held, or null when released / never acquired. */
let sentinel: WakeLockSentinel | null = null;
/** True between acquire and release — gates the visibilitychange reacquire. */
let showActive = false;
/** The caller's once-per-show fallback, reused by the silent reacquire path. */
let onUnsupportedCb: (() => void) | null = null;
/** Bind the visibilitychange listener exactly once (idempotent). */
let listenerBound = false;

/**
 * Acquire the screen wake lock for the active show. Idempotent-ish: marks the
 * show active, (re)registers the reacquire listener, and attempts the lock.
 * `onUnsupported` fires when the API is absent, rejects, OR returns a
 * false-positive sentinel that is already released (Pitfall 1). Never throws.
 */
export async function acquireWakeLock(
  onUnsupported: () => void,
): Promise<void> {
  onUnsupportedCb = onUnsupported;
  showActive = true;
  bindVisibilityReacquire();

  // Feature-detect — but do NOT trust presence alone (Pitfall 1).
  if (!("wakeLock" in navigator)) {
    onUnsupported();
    return;
  }

  try {
    const next = await navigator.wakeLock.request("screen");

    // D-02: End Show may have fired while this request("screen") was still in
    // flight. `releaseWakeLock()` already no-op'd on the null sentinel, so if we
    // now stored `next` nothing would ever release it — the lock would leak until
    // the app is backgrounded (UX-02). If the show is no longer active, release
    // `next` best-effort and return WITHOUT storing the sentinel and WITHOUT
    // calling onUnsupported: End Show is normal teardown, not an unsupported
    // device, so surfacing the fallback notice here would be wrong (Pitfall 2).
    // The reacquire listener cannot fight this — it is gated on `showActive`
    // (:99), which is already false.
    //
    // Accepted residual (A5): a rapid End-Show→Start-Show where an OLD acquire is
    // still in flight can still orphan a lock — the boolean `showActive` cannot
    // distinguish "show 1" from "show 2". This is a consciously ACCEPTED LOW
    // residual (tiny window, self-clears on next background); closing it would
    // need a monotonic epoch token, deliberately out of scope for D-02.
    if (!showActive) {
      try {
        await next.release();
      } catch {
        // Swallow — releasing is best-effort and must never surface an error.
      }
      return;
    }

    // Verify the lock actually HELD: an installed-PWA false-positive resolves a
    // sentinel that is already released. Treat it as unsupported (Pitfall 1).
    if (next.released) {
      onUnsupported();
      return;
    }

    next.addEventListener("release", () => {
      if (sentinel === next) sentinel = null;
    });
    sentinel = next;
  } catch {
    // NotAllowedError / installed-PWA failure — silent fallback, never throw.
    onUnsupported();
  }
}

/**
 * Release the wake lock and stop reacquiring (End Show / leaving the view).
 * Best-effort — swallows any release rejection so the "never throws" contract
 * holds even mid-teardown.
 */
export async function releaseWakeLock(): Promise<void> {
  showActive = false;
  const held = sentinel;
  sentinel = null;
  if (!held) return;
  try {
    await held.release();
  } catch {
    // Swallow — releasing is best-effort and must never surface an error.
  }
}

/**
 * Register the module-level reacquire listener once. On return-to-visible while
 * a show is active and no lock is currently held (iOS drops it on background),
 * silently reacquire with the caller's fallback. No copy on this path.
 */
function bindVisibilityReacquire(): void {
  if (listenerBound) return;
  if (typeof document === "undefined") return;
  listenerBound = true;
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      sentinel === null &&
      showActive &&
      onUnsupportedCb
    ) {
      void acquireWakeLock(onUnsupportedCb);
    }
  });
}
