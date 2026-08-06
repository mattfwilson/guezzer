import { config } from "../config";
import { IosShareGlyph } from "./IosShareGlyph";

/**
 * Illustrated manual install steps shown only to detected iOS Safari
 * (D-04) — iOS never fires `beforeinstallprompt`, so this is the only
 * install path iOS users have. Secondary surface, body text >= 16px per
 * UI-SPEC §Typography.
 *
 * ## Phase-22 D-32 — `showHeading`, and why it is a prop rather than a deletion
 *
 * This component rendered its own `<h2>` because both of its consumers were
 * surfaces with no heading of their own. Plan 22-06 gives it a THIRD context —
 * `settings/InstallSection.tsx` — which owns the single heading for the whole
 * install affordance, so a second `<h2>` inside that one `#install` section
 * would be a duplicate.
 *
 * The heading could NOT simply be deleted: `InstallBanner` renders this
 * component as the ENTIRE body of its iOS branch, and D-37 keeps that banner
 * byte-unmodified. Removing the `<h2>` outright would leave the iOS install
 * banner as a bare numbered list with no statement of what is being added or
 * why — the banner is what walks a new user to the relocated Settings section,
 * so degrading it would undercut the very requirement (NAV-05) this change
 * serves. `showHeading` therefore DEFAULTS TO TRUE, which is exactly the
 * shipped behaviour for the untouched banner, and `InstallSection` is the one
 * caller that opts out.
 */
interface IosInstallInstructionsProps {
  /**
   * Render this component's own `<h2>`. Leave unset (true) for a host with no
   * heading of its own — `InstallBanner`. Pass `false` from a host that already
   * owns the heading — `InstallSection` (D-32).
   */
  showHeading?: boolean;
}

export function IosInstallInstructions({
  showHeading = true,
}: IosInstallInstructionsProps) {
  const { heading, steps } = config.copy.iosInstall;

  return (
    <div>
      {showHeading && (
        <h2 className="text-[20px] font-semibold leading-tight text-text-primary">
          {heading}
        </h2>
      )}
      {/* `mt-2` only under the heading it separates: in `InstallSection` the
          parent flex column already supplies the gap. */}
      <ol className={`${showHeading ? "mt-2 " : ""}flex flex-col gap-2`}>
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span className="flex min-h-6 min-w-6 items-center justify-center rounded-full bg-surface text-[14px] font-semibold text-text-primary">
              {index + 1}
            </span>
            <span className="flex items-center gap-1.5 text-base leading-normal text-text-muted">
              {step}
              {index === 0 && <IosShareGlyph size={18} />}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
