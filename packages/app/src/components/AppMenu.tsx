import { Settings, X } from "lucide-react";
import { config } from "../config";
import { useInstallState } from "../pwa/install/useInstallState";
import { navigate } from "../routing/useHashRoute";
import { IosInstallInstructions } from "./IosInstallInstructions";
import { VersionStamp } from "./VersionStamp";

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Menu/about sheet housing the permanent Install entry (D-03: the
 * always-available fallback after banner dismissal) and a version-stamp
 * slot (wired in Plan 03). Secondary surface, rows >= 44px per UI-SPEC.
 */
export function AppMenu({ open, onClose }: AppMenuProps) {
  const { canInstall, promptInstall, isIos } = useInstallState();

  if (!open) return null;

  const handleInstallClick = () => {
    if (canInstall) {
      void promptInstall();
      onClose();
    }
    // iOS: the illustrated steps are rendered inline below (D-04). For
    // anything ambiguous (not installable, not iOS) the fallback copy below
    // covers it — the row intentionally stays a no-op tap in that case.
  };

  // D-14: the always-available Settings entry point — no 4th bottom tab. The
  // hash route is the only route-selection surface (validated allow-list).
  const handleSettingsClick = () => {
    navigate("settings");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-20 flex flex-col justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[20px] font-semibold leading-tight text-text-primary">
            Guezzer
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center text-text-muted"
          >
            <X size={22} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleInstallClick}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-[14px] font-semibold text-surface"
        >
          {config.copy.installCta}
        </button>

        {/* D-14: Settings entry (gear icon) → #/settings. Neutral row styling
            (min-h-11), never accent — the one gold CTA stays Export in-view. */}
        <button
          type="button"
          onClick={handleSettingsClick}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary"
        >
          <Settings size={20} />
          {config.copy.settings.menuLabel}
        </button>

        {isIos && (
          <div className="mt-3 border-t border-hairline pt-3">
            <IosInstallInstructions />
          </div>
        )}

        {!canInstall && !isIos && (
          <p className="mt-3 text-[14px] leading-normal text-text-muted">
            {config.copy.installUnavailable}
          </p>
        )}

        <div className="mt-3 border-t border-hairline pt-3">
          <VersionStamp />
        </div>
      </div>
    </div>
  );
}
