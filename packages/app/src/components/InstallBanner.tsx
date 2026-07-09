import { config } from "../config";
import { useInstallState } from "../pwa/install/useInstallState";
import { IosInstallInstructions } from "./IosInstallInstructions";

/**
 * Dismissible install invitation, branched by platform (D-03/D-04/D-05,
 * PWA-01). Renders nothing when already installed or dismissed for this
 * session. The Install button is the ONLY accent element here (UI-SPEC
 * §Color, accent reserved list #2) — "Not now" stays muted.
 */
export function InstallBanner() {
  const { canInstall, promptInstall, isIos, isInstalled, dismissed, dismiss } =
    useInstallState();

  if (isInstalled || dismissed) return null;

  const { headline, body, dismiss: dismissLabel } = config.copy.installBanner;
  const showAndroidCta = canInstall && !isIos;

  return (
    <div
      role="region"
      aria-label={headline}
      className="fixed inset-x-0 bottom-16 z-10 border-t border-hairline bg-elevated px-4 py-4 motion-safe:transition-all motion-safe:duration-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
