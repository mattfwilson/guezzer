import { config } from "../config";
import { IosShareGlyph } from "./IosShareGlyph";

/**
 * Illustrated manual install steps shown only to detected iOS Safari
 * (D-04) — iOS never fires `beforeinstallprompt`, so this is the only
 * install path iOS users have. Secondary surface, body text >= 16px per
 * UI-SPEC §Typography.
 */
export function IosInstallInstructions() {
  const { heading, steps } = config.copy.iosInstall;

  return (
    <div>
      <h2 className="text-[20px] font-semibold leading-tight text-text-primary">
        {heading}
      </h2>
      <ol className="mt-2 flex flex-col gap-2">
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
