import { useState, useSyncExternalStore } from "react";
import {
  getInstallServerSnapshot,
  getInstallSnapshot,
  promptInstall,
  subscribeInstall,
} from "./installStore";

export interface InstallState {
  /** Android/Chromium: a captured `beforeinstallprompt` event is ready to fire. */
  canInstall: boolean;
  /** Fires the stashed `beforeinstallprompt` event (no-op if none captured). */
  promptInstall: () => Promise<void>;
  /** Best-effort detected iOS Safari (Pitfall 3) — drives the illustrated manual path. */
  isIos: boolean;
  /** Already running installed (standalone) — banner must render nothing. */
  isInstalled: boolean;
  /** Session-only "Not now" state (D-05). Intentionally NOT persisted — it only
   *  hides the banner within the current session. NOTE (Phase-6 D-22 supersession):
   *  the PRIMARY re-show throttle is no longer "re-show every launch until
   *  installed" — InstallBanner now gates on a persisted once-per-BUILD-version
   *  meta flag (`installBannerSeenVersion`), so a reload on the same build no
   *  longer re-shows the banner. This session dismissal layers on top of that
   *  gate; the permanent AppMenu "Install" entry stays the always-on fallback. */
  dismissed: boolean;
  dismiss: () => void;
}

/**
 * Install-onboarding state hook (D-03/D-04/D-05, PWA-01). The public
 * `InstallState` shape is unchanged; only its backing moved.
 *
 * `canInstall` / `isIos` / `isInstalled` now come from the module-level
 * singleton in `./installStore` (D-33/D-36) rather than from per-hook-instance
 * state. That hoist fixes three things:
 *
 *  1. **A late-mounted consumer missing the one-shot event (NAV-06).**
 *     `beforeinstallprompt` fires once, early. The old component-local capture
 *     lived in this hook's `useRef`/`useState`, so anything mounted after the
 *     event fired — the Settings install section (plan 22-06) in particular —
 *     never saw it and NAV-06 was dead on Android.
 *  2. **Two consumers disagreeing.** `AppMenu` and `InstallBanner` each
 *     registered their OWN `beforeinstallprompt` listener with their own
 *     deferred ref, and each called `isStandalone()` independently, so they
 *     could report different `canInstall` / `isInstalled`. Now there is one
 *     listener, one stashed event and one evaluation of the platform reads.
 *  3. **(New) An in-session install now propagates.** The store listens for
 *     `appinstalled`, so completing an install flips `isInstalled` for every
 *     consumer at once, with no reload.
 *
 * See 03-RESEARCH.md §"Install detection + Android prompt capture" and
 * 22-RESEARCH.md §Pattern 7.
 */
export function useInstallState(): InstallState {
  const { canInstall, isIos, isInstalled } = useSyncExternalStore(
    subscribeInstall,
    getInstallSnapshot,
    getInstallServerSnapshot,
  );

  // Session-only — deliberately useState, never persisted, and deliberately
  // NOT hoisted into the store: only InstallBanner reads these two, and D-37
  // leaves the banner untouched. Phase-6 D-22 moved the durable "don't nag
  // every reload" throttle into InstallBanner's once-per-build meta gate
  // (installBannerSeenVersion); this stays session-scoped on top of it.
  const [dismissed, setDismissed] = useState(false);
  const dismiss = () => setDismissed(true);

  return {
    canInstall,
    // Passed through, not re-wrapped: a fresh closure per render would churn
    // the reference, and any wrapper risks someone later inserting an `await`
    // ahead of the gesture-bound `prompt()` call (T-22-23).
    promptInstall,
    isIos,
    isInstalled,
    dismissed,
    dismiss,
  };
}
