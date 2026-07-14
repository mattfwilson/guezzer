import { config } from "../config";
import { useRegisterSW } from "../pwa/useRegisterSW";
import { useBottomOverlayHeightRegistration } from "../pwa/bottomOverlayInset";

/**
 * Non-blocking, dismissible toast for a waiting service worker (D-06,
 * PWA-02). Renders nothing until `needRefresh` is true. Refresh
 * (`updateServiceWorker(true)`, skipWaiting + reload) is the ONLY thing that
 * ever swaps the running version — Later just dismisses, keeping the
 * current version running indefinitely. The app stays fully usable if the
 * toast is ignored entirely.
 *
 * Bug fix (debug session: start-show-not-clickable) — same `fixed bottom-16`
 * overlay class as InstallBanner; registers its own measured height so
 * AppShell can reserve enough space and this toast never covers/intercepts
 * taps on page content underneath it.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const ref = useBottomOverlayHeightRegistration("updateToast", needRefresh);

  if (!needRefresh) return null;

  const { text, cta, dismiss } = config.copy.updateToast;

  return (
    <div
      ref={ref}
      role="status"
      className="fixed inset-x-0 bottom-16 z-10 flex items-center justify-between gap-3 border-t border-hairline bg-elevated px-4 py-4 motion-safe:transition-all motion-safe:duration-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <p className="text-base leading-normal text-text-primary">{text}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="min-h-11 px-3 text-[14px] font-semibold text-text-muted"
        >
          {dismiss}
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-11 rounded-md bg-accent px-4 text-[14px] font-semibold text-surface"
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
