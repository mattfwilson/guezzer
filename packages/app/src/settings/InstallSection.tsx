/**
 * NAV-05 / D-32: THE add-to-home-screen affordance, relocated out of the
 * top-right menu and into the bottom of Settings as ONE platform-adaptive
 * section owning ONE heading.
 *
 * Before this, `AppMenu` held two install affordances at once — a gold
 * "Install Gizz With Friends" button AND the inline illustrated iOS steps — on
 * a surface that should hold a single neutral row. The menu now keeps one
 * neutral row that deep-links here (`installSectionFocus.ts`); this section is
 * where the install actually happens.
 *
 * D-34: the section and that menu row share ONE gate — `!isInstalled` from
 * `useInstallState()` — so they can never disagree. Installed users see
 * neither. Returning `null` here is a GATE, not an empty state: there is
 * deliberately no "already installed ✓" row to congratulate anyone with.
 *
 * The section introduces NO new visual treatment. It reuses the Settings
 * heading size, the muted body size and the neutral-button class string from
 * the Import block directly above it, so it reads as the same app.
 *
 * Security (T-22-17): every string is a fixed `config.copy.install.*` constant
 * rendered as escaped React text. Nothing here is derived from a Dexie row, an
 * imported file or a peer payload, and `dangerouslySetInnerHTML` is never used.
 */
import { Smartphone } from "lucide-react";
import type { RefObject } from "react";
import { IosInstallInstructions } from "../components/IosInstallInstructions.tsx";
import { config } from "../config.ts";
import { useInstallState } from "../pwa/install/useInstallState.ts";

interface InstallSectionProps {
  /**
   * Owned by `SettingsView`, which performs the D-35 deep-link focus move.
   * Attached to the `<h2>`, which carries `tabIndex={-1}` so it is
   * programmatically focusable without joining the tab sequence.
   */
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function InstallSection({ headingRef }: InstallSectionProps) {
  const copy = config.copy.install;
  const { canInstall, promptInstall, isIos, isInstalled } = useInstallState();

  // D-34's shared gate. `installStore` also listens for `appinstalled`, so an
  // in-session install makes this (and the menu row) disappear with no reload.
  if (isInstalled) return null;

  return (
    <section id="install" className="flex flex-col gap-2">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[20px] font-semibold leading-tight text-text-primary"
      >
        {copy.sectionHeading}
      </h2>
      <p className="text-base leading-normal text-text-muted">
        {copy.sectionBody}
      </p>

      {canInstall ? (
        /* Android/Chromium. NEUTRAL, never accent: Settings already spends its
           one accent CTA on Export, and a second gold button on the same
           surface would leave the screen with two competing primary actions.
           Class string is the Import block's, verbatim.

           The glyph is `Smartphone`, NOT `Download` — `Download` is already the
           Export CTA icon in THIS view, and two Download icons meaning
           different things on one screen is a legibility bug.

           ⚠ `promptInstall()` is called DIRECTLY from the click handler with
           nothing awaited ahead of it. `prompt()` is gesture-bound on Chromium;
           any preceding `await` breaks the user-gesture chain and the prompt
           silently never appears (T-22-23). */
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
        >
          <Smartphone size={18} />
          {copy.androidCta}
        </button>
      ) : isIos ? (
        /* iOS never fires `beforeinstallprompt`, so the illustrated manual
           steps are the only install path. `showHeading={false}` because THIS
           section owns the single heading (D-32); the prop defaults to true so
           `InstallBanner`, which has no heading of its own, stays untouched. */
        <IosInstallInstructions showHeading={false} />
      ) : (
        <p className="text-base leading-normal text-text-muted">
          {copy.unavailable}
        </p>
      )}
    </section>
  );
}
