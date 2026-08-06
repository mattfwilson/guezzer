import { useEffect, useState } from "react";
import { config } from "../config";
import { useInstallState } from "../pwa/install/useInstallState";
import {
  useBottomOverlayHeightRegistration,
  useBottomOverlayOffset,
} from "../pwa/bottomOverlayInset";
import { getMeta, setMeta } from "../db/db";
import { IosInstallInstructions } from "./IosInstallInstructions";

/**
 * Dismissible install invitation, branched by platform (D-03/D-04/D-05,
 * PWA-01). Renders nothing when already installed or dismissed for this
 * session. The Install button is the ONLY accent element here (UI-SPEC
 * §Color, accent reserved list #2) — "Not now" stays muted.
 *
 * Bug fix (debug session: start-show-not-clickable) — this is a fixed
 * overlay stacked above the BottomTabBar; it composes its bottom offset from
 * the FOUND-02 owner (`--gz-chrome-reserve`, `src/layout/bottomSpace.ts`).
 * Its real rendered height (especially the iOS multi-step instructions
 * branch) can exceed AppShell's static reservation, so it registers its own
 * measured height via `useBottomOverlayHeightRegistration` — AppShell adds
 * that on top of its base reservation so this banner never covers/intercepts
 * taps on page content underneath it again.
 *
 * Phase-6 D-22 (once-per-version gate) — SUPERSEDES the Phase-3 D-05 session-only
 * dismissal as the primary throttle: the banner now shows at most once per app
 * build. It is gated on a persisted `meta` flag keyed on the build stamp
 * (`__APP_VERSION__+__GIT_SHA__`); once a build has shown the banner, reloads on
 * the SAME build never re-show it. A new build (new stamp) re-shows it once. The
 * session-only dismissal still hides it immediately within a session (layered on
 * top). The permanent AppMenu "Install" entry remains the always-on fallback.
 * Meta read/write is never-throw (T-06-06): a flag failure only re-shows a
 * harmless banner — it must never break the banner render.
 */
/** Meta flag key: the build stamp the InstallBanner was last shown on (D-22). */
export const INSTALL_BANNER_SEEN_VERSION = "installBannerSeenVersion";

export function InstallBanner() {
  const { canInstall, promptInstall, isIos, isInstalled, dismissed, dismiss } =
    useInstallState();

  // D-22: the current build stamp, read at render so test global stubs apply.
  const buildStamp = `${__APP_VERSION__}+${__GIT_SHA__}`;

  // null = undecided (meta not yet read → render nothing so it never flashes
  // then hides); false = this build's stamp not yet seen (eligible to show);
  // true = already seen on this build (never show).
  const [seenThisVersion, setSeenThisVersion] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const seen = await getMeta<string>(INSTALL_BANNER_SEEN_VERSION);
        if (!cancelled) setSeenThisVersion(seen === buildStamp);
      } catch {
        // Never-throw (T-06-06): treat a failed read as not-seen so install
        // stays reachable; the worst case is a harmless re-show.
        if (!cancelled) setSeenThisVersion(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildStamp]);

  const visible = !isInstalled && !dismissed && seenThisVersion === false;
  const ref = useBottomOverlayHeightRegistration("installBanner", visible);
  // CR-01: this banner is BOTTOM-MOST in `config.ui.BOTTOM_OVERLAY_ORDER`, so
  // this offset is 0 today — read from the store anyway rather than hard-coded,
  // so re-ordering the config is the only edit a future change needs.
  const bottomOffset = useBottomOverlayOffset("installBanner");

  // On first actual show for this build, persist the stamp so reloads on the
  // same build never re-show it (D-22). Never-throw (T-06-06).
  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        await setMeta(INSTALL_BANNER_SEEN_VERSION, buildStamp);
      } catch {
        // A failed write only means the banner may re-show next launch — safe.
      }
    })();
  }, [visible, buildStamp]);

  if (!visible) return null;

  const { headline, body, dismiss: dismissLabel } = config.copy.installBanner;
  const showAndroidCta = canInstall && !isIos;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={headline}
      className="fixed inset-x-0 border-t border-hairline bg-elevated px-4 py-4 motion-safe:transition-all motion-safe:duration-200"
      style={{
        zIndex: config.ui.z.toast,
        // D-09 / FOUND-02: this used to be a Tailwind bottom utility hard-coding
        // the tab bar's NOMINAL height, measured from the viewport (a `fixed` box
        // ignores body padding). The bar's real height is that nominal value PLUS
        // the home-indicator inset, so on an installed instance this banner
        // overlapped the top of the bar by exactly one inset. The chrome reserve
        // already carries the inset, so the overlap is gone.
        //
        // The self `paddingBottom` deleted from here (a raw safe-area bottom read)
        // was the compensation for sitting one inset too low — it pushed content
        // up clear of the bar. Against the reserve it is double-counting: it would
        // open ~34px of dead space INSIDE the banner on an installed instance, and
        // inflate the height this component registers with the overlay store by
        // that same inset.
        //
        // CR-01: the offset is ADDITIVE to the chrome reserve, never a
        // replacement — this banner still follows the chrome collapse for free.
        bottom: `calc(var(--gz-chrome-reserve) + ${bottomOffset}px)`,
      }}
    >
      {isIos ? (
        <IosInstallInstructions />
      ) : (
        <>
          <h2 className="text-[20px] font-semibold leading-tight text-text-primary">
            {headline}
          </h2>
          <p className="mt-1 text-base leading-normal text-text-muted">
            {showAndroidCta ? body : config.copy.installUnavailable}
          </p>
        </>
      )}

      <div className="mt-3 flex items-center gap-3">
        {showAndroidCta && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="min-h-11 flex-1 rounded-md bg-accent px-4 text-[14px] font-semibold text-surface"
          >
            {config.copy.installCta}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className={`min-h-11 min-w-11 px-4 text-[14px] font-semibold text-text-muted ${
            showAndroidCta ? "" : "ml-auto"
          }`}
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
