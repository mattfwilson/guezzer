import { isIosSafari, isStandalone } from "./platform";

/**
 * Module-level singleton for install state (D-33, D-36, NAV-06).
 *
 * `beforeinstallprompt` is a ONE-SHOT event that Chromium fires early, once.
 * The shipped `useInstallState()` captured it in a per-hook-instance
 * `useRef`/`useState`, which means a consumer mounted AFTER the event fired
 * never sees it — the exact reason NAV-06 (the relocated Settings install
 * section, plan 22-06) was dead on Android. It also meant `AppMenu` and
 * `InstallBanner` each registered their own listener with their own deferred
 * ref and each called `isStandalone()` independently, so the two surfaces
 * could disagree about `canInstall` / `isInstalled`.
 *
 * This module hoists the capture to module scope: ONE listener, ONE stashed
 * event, ONE evaluation of the platform reads, and one cached snapshot every
 * consumer reads through `useSyncExternalStore`. Modelled shape-for-shape on
 * `pwa/bottomOverlayInset.ts` (module state + `Set<listener>` + a cached
 * `snapshot` recomputed only inside `notify()` + `getServerSnapshot` +
 * a test-only reset hatch).
 *
 * CAPTURE TIMING IS SAFE. This module is imported transitively during initial
 * bundle evaluation (`App.tsx` → `AppMenu`/`InstallBanner` → `useInstallState`
 * → here), i.e. before `createRoot().render()`. `beforeinstallprompt` fires
 * only after the manifest and service worker have been evaluated — strictly
 * later. The one-shot event therefore cannot be missed. If any consumer is
 * ever converted to a lazy import, add an explicit side-effect import of this
 * module in `main.tsx` to keep that ordering true.
 */

/**
 * The (non-standard, Chromium-only) `beforeinstallprompt` event shape.
 * Not in lib.dom.d.ts — declared locally rather than pulling a types
 * package for two methods.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** The boolean triple every install surface reads. */
export interface InstallSnapshot {
  /** Android/Chromium: a captured `beforeinstallprompt` event is ready to fire. */
  canInstall: boolean;
  /** Best-effort detected iOS Safari (Pitfall 3) — drives the manual path. */
  isIos: boolean;
  /** Already running installed (standalone). */
  isInstalled: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/**
 * D-36: both platform reads are evaluated ONCE, here, at module load. A page
 * cannot transition into standalone mode — installing opens a NEW instance —
 * so re-evaluating buys nothing; what matters is that every gated surface
 * reads the SAME value. The `typeof window === "undefined"` guard means an
 * import-time evaluation can never throw (T-22-07: this module is imported
 * transitively by `App.tsx`, so an import-time throw would brick the bundle).
 *
 * `installed` is a mutable `let`, not a `const`, because the `appinstalled`
 * listener below flips it. `ios` is a `let` only so
 * `__resetInstallStoreForTests({ isIos })` can pin it for a test — nothing in
 * production reassigns it, and `notify()` must rebuild the snapshot from
 * these two variables or a pinned override would be silently dropped by the
 * next notification.
 */
let installed = typeof window === "undefined" ? false : isStandalone();
let ios = typeof window === "undefined" ? false : isIosSafari();

/**
 * ⚠ CACHED snapshot object — recreated ONLY inside `notify()`.
 *
 * React 19.2.7 detects an uncached object `getSnapshot` and reports "The
 * result of getSnapshot should be cached to avoid an infinite loop"
 * (Pitfall 9). Never build this object inside `getInstallSnapshot()`. Both
 * shipped stores in this codebase already model the fix.
 */
let snapshot: InstallSnapshot = {
  canInstall: false,
  isIos: ios,
  isInstalled: installed,
};

/**
 * Frozen module-level constant. The app has no SSR, so this is defensive —
 * but React 19 warns "Missing getServerSnapshot, which is required for
 * server-rendered content" without one, and both existing stores provide it.
 */
const SERVER_SNAPSHOT: InstallSnapshot = Object.freeze({
  canInstall: false,
  isIos: false,
  isInstalled: false,
});

function notify(): void {
  snapshot = {
    canInstall: deferred != null,
    isIos: ios,
    isInstalled: installed,
  };
  for (const listener of listeners) listener();
}

/** `useSyncExternalStore` subscribe half — same shape as bottomOverlayInset's. */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallSnapshot(): InstallSnapshot {
  return snapshot;
}

export function getInstallServerSnapshot(): InstallSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * Fires the stashed `beforeinstallprompt` event. Silent no-op when nothing is
 * captured (never-throw house style — `wakeLock.ts`, `persist.ts`).
 *
 * ⚠ `prompt()` IS GESTURE-BOUND — do NOT insert any `await` ahead of it. The
 * first `await` in this function body must remain `await d.prompt()`. Adding
 * anything awaited before it (an analytics call, a Dexie read, a `notify()`
 * round-trip) breaks the user-gesture chain on Chromium and the prompt
 * silently never appears — a failure indistinguishable from the very bug
 * D-33 is fixing (T-22-23).
 *
 * The trailing `notify()` IS the D-33 fix: every subscriber loses
 * `canInstall` together, instead of only the one that fired the prompt.
 */
export async function promptInstall(): Promise<void> {
  const d = deferred;
  if (!d) return;
  await d.prompt();
  await d.userChoice;
  deferred = null;
  notify();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });

  /**
   * `appinstalled` does NOT contradict D-36. D-36 says `isStandalone()` need
   * not be re-evaluated, because the CURRENT page never *becomes* standalone
   * (an install opens a new instance). `appinstalled` is a different,
   * explicitly-fired event that tells the current page an install completed.
   * Honouring it is what makes NAV-05's "hidden once the app is installed"
   * true within the session that performed the install — with no reload and
   * no remount, which is what the plan-22-09 Android device test observes.
   */
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/**
 * Test-only escape hatch to reset module state between test cases/files.
 *
 * `overrides` additionally pins the two platform reads: because the real
 * reads are frozen at module load (D-36), a test that needs `isIos: true` or
 * `isInstalled: true` has no other way to get there short of
 * `vi.resetModules()` gymnastics across two files.
 */
export function __resetInstallStoreForTests(overrides?: {
  isIos?: boolean;
  isInstalled?: boolean;
}): void {
  deferred = null;
  listeners.clear();
  installed =
    overrides?.isInstalled ??
    (typeof window === "undefined" ? false : isStandalone());
  ios =
    overrides?.isIos ?? (typeof window === "undefined" ? false : isIosSafari());
  snapshot = { canInstall: false, isIos: ios, isInstalled: installed };
}
