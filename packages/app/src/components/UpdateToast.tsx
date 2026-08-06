import { config } from "../config";
import { useRegisterSW } from "../pwa/useRegisterSW";
import {
  useBottomOverlayHeightRegistration,
  useBottomOverlayOffset,
} from "../pwa/bottomOverlayInset";

/**
 * Non-blocking, dismissible toast for a waiting service worker (D-06,
 * PWA-02). Renders nothing until `needRefresh` is true. Refresh
 * (`updateServiceWorker(true)`, skipWaiting + reload) is the ONLY thing that
 * ever swaps the running version — Later just dismisses, keeping the
 * current version running indefinitely. The app stays fully usable if the
 * toast is ignored entirely.
 *
 * Bug fix (debug session: start-show-not-clickable) — same fixed overlay
 * geometry as InstallBanner, composed from the FOUND-02 owner's
 * `--gz-chrome-reserve`; registers its own measured height so AppShell can
 * reserve enough space and this toast never covers/intercepts taps on page
 * content underneath it.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const ref = useBottomOverlayHeightRegistration("updateToast", needRefresh);
  // CR-01: sits directly above the persistent InstallBanner and beneath every
  // transient toast, so the safety surface is never suppressed and never covered.
  const bottomOffset = useBottomOverlayOffset("updateToast");

  if (!needRefresh) return null;

  const { text, cta, dismiss } = config.copy.updateToast;

  return (
    <div
      ref={ref}
      role="status"
      className="fixed inset-x-0 flex items-center justify-between gap-3 border-t border-hairline bg-elevated px-4 py-4 motion-safe:transition-all motion-safe:duration-200"
      style={{
        zIndex: config.ui.z.toast,
        // D-09 / FOUND-02: this was a Tailwind bottom utility hard-coding the tab
        // bar's NOMINAL height, measured from the viewport (a `fixed` box ignores
        // body padding), against a bar whose real height is that value plus the
        // home-indicator inset — so this toast overlapped the top of the bar by
        // one inset on an installed instance.
        //
        // The `paddingBottom` deleted from here (a raw safe-area bottom read)
        // existed only to compensate for that: it lifted the toast's content clear
        // of the bar. Against the chrome reserve it is double-counting — ~34px of
        // dead space inside the toast, plus one inset of over-reserve in the
        // overlay-height store that measures this element.
        //
        // CR-01: the offset is ADDITIVE to the chrome reserve, never a
        // replacement — this toast still follows the chrome collapse for free.
        bottom: `calc(var(--gz-chrome-reserve) + ${bottomOffset}px)`,
      }}
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
