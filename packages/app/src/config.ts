/**
 * Single source of truth for every app-side constant and copy string
 * (CLAUDE.md: "All model constants ... in a single config file — no
 * scattered magic numbers"). This mirrors packages/core/src/config.ts for
 * the app tier.
 *
 * No other file under packages/app/src should hardcode a copy string, an
 * interval/timeout literal, or the IndexedDB database name. Later plans
 * (02: install onboarding, 03: update prompt/version stamp, 04:
 * persistence) READ these keys — they do not re-add them.
 */
export const config = {
  /** D-08: Dexie/IndexedDB database name. */
  DB_NAME: "guezzer",

  /** D-06/A4: periodic waiting-service-worker check interval (not tied to show state in Phase 3). */
  UPDATE_CHECK_MS: 60 * 60 * 1000,

  /**
   * D-07: version stamp format note — rendered as
   * `v{pkgVersion} · {shortSha} · built {YYYY-MM-DD}` using the build-time
   * `__APP_VERSION__` / `__GIT_SHA__` / `__BUILD_DATE__` globals declared in
   * vite-env.d.ts. Not a template string here since the values are
   * build-time constants, not config data.
   */
  versionStampFormat: "v{version} · {sha} · built {date}",

  /** UI-SPEC §Copywriting Contract. */
  copy: {
    installBanner: {
      headline: "Install Guezzer",
      body: "Add it to your home screen so it works offline at the show.",
      dismiss: "Not now",
    },
    installCta: "Install Guezzer",
    installUnavailable:
      "Guezzer can't auto-install here — add it from your browser menu instead.",
    iosInstall: {
      heading: "Add Guezzer to your Home Screen",
      steps: [
        "Tap the Share button",
        "Choose Add to Home Screen",
        "Tap Add",
      ] as const,
    },
    updateToast: {
      text: "New version available — Refresh",
      cta: "Refresh",
      dismiss: "Later",
    },
    placeholders: {
      show: {
        heading: "Show Mode",
        body: "The live prediction loop lands in Phase 4.",
      },
      explore: {
        heading: "Explore",
        body: "The song constellation lands in Phase 7.",
      },
      dex: {
        heading: "Your Pokédex",
        body: "Your caught-live collection lands in Phase 6.",
      },
    },
  },
} as const;
