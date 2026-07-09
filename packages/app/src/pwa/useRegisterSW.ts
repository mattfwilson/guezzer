import { useRegisterSW as useRegisterSWBase } from "virtual:pwa-register/react";
import { config } from "../config";

/**
 * Thin wrapper over vite-plugin-pwa's `useRegisterSW` hook
 * (`virtual:pwa-register/react` — RESEARCH §"Update flow", D-06).
 *
 * Adds a periodic, online-guarded check for a waiting service worker
 * (`config.UPDATE_CHECK_MS`, hourly) so a long-open session eventually
 * notices a new deploy. This check is NOT tied to any show state — Phase 4
 * may later suppress it during an active show, but that's explicitly out of
 * scope here.
 *
 * The `updateServiceWorker(true)` function returned by this hook
 * (skipWaiting + reload) is the ONLY code path that ever swaps the running
 * version — callers must invoke it exclusively behind an explicit user tap
 * (see UpdateToast), never automatically.
 */
export function useRegisterSW() {
  return useRegisterSWBase({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, config.UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      // No sensitive data in this app to leak (T-03-10: accept/mitigate via
      // console-only logging, no telemetry endpoint).
      console.error("SW registration failed", error);
    },
  });
}
