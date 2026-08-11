import { Settings, Smartphone, X } from "lucide-react";
import { config } from "../config";
import { useInstallState } from "../pwa/install/useInstallState";
import { navigate } from "../routing/useHashRoute";
import { requestInstallSectionFocus } from "../settings/installSectionFocus";
import { Sheet } from "./Sheet";
import { VersionStamp } from "./VersionStamp";

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Menu/about sheet: a short list of neutral navigation rows plus a
 * version-stamp slot (wired in Plan 03). Secondary surface, rows >= 44px per
 * UI-SPEC.
 *
 * ## Phase-22 NAV-05: this surface no longer installs anything
 *
 * It used to hold THREE install affordances at once — a gold "Install Gizz
 * With Friends" button, the inline illustrated iOS steps, and a fallback
 * paragraph for everything else — which is most of a screen of install UI in a
 * menu. All three moved into ONE platform-adaptive section at the bottom of
 * Settings (`settings/InstallSection.tsx`, D-32); what remains here is a single
 * neutral row that NAVIGATES there.
 *
 * Retiring the accent fill matters and is not incidental tidying: this app
 * spends at most ONE accent CTA per surface, that CTA is Export over in
 * Settings, and every other row in this menu is neutral. A gold button here was
 * the loudest thing on a surface whose job is to get out of the way.
 */
export function AppMenu({ open, onClose }: AppMenuProps) {
  // D-34: the SAME gate `InstallSection` uses, read from the same singleton
  // store — the row and the section it links to can never disagree about
  // whether the app is already installed.
  const { isInstalled } = useInstallState();

  // D-35: signal FIRST, then navigate. `navigate()` assigns `location.hash`,
  // and assigning the same hash fires no `hashchange` — the counter store is
  // what makes the row work for a user already sitting on #/settings.
  const handleInstallClick = () => {
    requestInstallSectionFocus();
    navigate("settings");
    onClose();
  };

  // D-14: the always-available Settings entry point — no 4th bottom tab. The
  // hash route is the only route-selection surface (validated allow-list).
  const handleSettingsClick = () => {
    navigate("settings");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} modal variant="bottom-sheet" ariaLabel="Menu">
      <div className="flex items-center justify-between">
        <span className="text-[20px] font-semibold leading-tight text-text-primary">
          {config.copy.appName}
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

      {/* NAV-05 / D-34: ONE row, and it names its DESTINATION rather than an
          action — tapping it navigates, it does not install. Hidden entirely
          once installed, by the same gate that hides the section it links to. */}
      {!isInstalled && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary"
        >
          <Smartphone size={20} />
          {config.copy.install.menuRow}
        </button>
      )}

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

      <div className="mt-3 border-t border-hairline pt-3">
        <VersionStamp />
      </div>
    </Sheet>
  );
}
