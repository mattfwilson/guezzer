import { useEffect, useRef, useState } from "react";
import { isIosSafari, isStandalone } from "./platform";

/**
 * The (non-standard, Chromium-only) `beforeinstallprompt` event shape.
 * Not in lib.dom.d.ts — declared locally rather than pulling a types
 * package for two methods.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

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
 * Install-onboarding state hook (D-03/D-04/D-05, PWA-01). Captures the
 * Android `beforeinstallprompt` event, exposes a unified state object the
 * banner and menu consume. See 03-RESEARCH.md §"Install detection + Android
 * prompt capture".
 */
export function useInstallState(): InstallState {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  // Session-only — deliberately useState, never persisted. Phase-6 D-22 moved the
  // durable "don't nag every reload" throttle into InstallBanner's once-per-build
  // meta gate (installBannerSeenVersion); this stays session-scoped on top of it.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const promptInstall = async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferredRef.current = null;
    setCanInstall(false);
  };

  const dismiss = () => setDismissed(true);

  return {
    canInstall,
    promptInstall,
    isIos: isIosSafari(),
    isInstalled: isStandalone(),
    dismissed,
    dismiss,
  };
}
