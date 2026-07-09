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

  /**
   * Show Mode tunables (04-UI-SPEC §Config surface). Single-config-file ethos
   * (CLAUDE.md) — no scattered magic numbers. Defaults are Claude's-discretion
   * starting points; D-10/D-12 are explicitly config-tunable.
   */
  show: {
    /** Adaptive fan lower bound — always ≥5 orbs (D-12). */
    ORB_COUNT_MIN: 5,
    /** Adaptive fan upper bound — up to 8 orbs (D-12). */
    ORB_COUNT_MAX: 8,
    /** Drop orbs below this absolute score before enforcing ORB_COUNT_MIN (D-12). */
    ORB_DROP_SCORE: 0.02,
    /** Top-orb score below which the whole fan softens visually (D-10 / SHOW-08 / EVAL-04). */
    WEAK_FAN_THRESHOLD: 0.15,
    /** Visual minimum orb diameter in px; hit area stays ≥44px regardless (SHOW-02). */
    ORB_MIN_DIAMETER: 56,
    /** Visual maximum orb diameter in px — the top-score orb; scales down to ORB_MIN_DIAMETER by rank (SHOW-01). */
    ORB_MAX_DIAMETER: 88,
    /** Outer radial inset in px keeping orbs clear of notches/safe-area edges (SHOW-02, no orb under an inset). */
    RING_INSET_PX: 24,
    /** Inner-radius ratio (fraction of the outer radius) that clears the centre node before the nearest orb (SHOW-01). */
    ORB_INNER_RADIUS_RATIO: 0.42,
    /** Number of recent trail nodes shown diminishing before compression (SHOW-08). */
    TRAIL_VISIBLE_RECENT: 4,
    /** Set length that triggers the "+N" trail compression chip (SHOW-08). */
    TRAIL_COMPRESS_AT: 30,
  },

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

    /**
     * Show Mode copy (04-UI-SPEC §Copywriting Contract) — verbatim. No
     * component under packages/app/src may hardcode a Show-Mode string; they
     * READ these keys.
     */
    show: {
      /** Pre-show launcher (D-01/D-02). */
      startCta: "Start Show",
      preShowHeading: "Ready when you are",
      preShowBody:
        "Tap Start Show when the first song kicks in. Everything logs offline — no signal needed.",
      /** Finalize control (D-04). */
      endCta: "End Show",
      /** Center node prompt before the opener is seeded. */
      centerPrompt: "Tap the opener",
      /** Fuzzy search sheet (SHOW-04). */
      searchCta: "Search",
      searchPlaceholder: "Search the catalog",
      searchNoMatchHeading: "No match.",
      searchNoMatchBody: "Log it as ??? and rename it later.",
      /** Unknown-song control (D-14). */
      unknownCta: "???",
      unknownSublabel: "Unknown",
      /** Set-structure controls (SHOW-06). */
      setBreakCta: "Set break",
      encoreCta: "Encore",
      /** Undo control (SHOW-07/D-15). */
      undoCta: "Undo",
      /** Weak-fan softening hint (D-10). */
      weakFanHeading: "Low confidence",
      weakFanBody: "Wide-open moment — the model isn't sure.",
      /** Persistent tally zero-state (SHOW-09). */
      tallyZeroState: "0/0 · —",
      /** Rename-??? sheet (D-15). */
      renameHeading: "Name this song",
      renameSkip: "Skip",
      /** Delete-a-trail-node confirm (D-15). */
      deleteHeading: "Delete this song?",
      deleteBody: "This removes it from the setlist and recomputes the tally.",
      deleteConfirm: "Delete",
      deleteCancel: "Cancel",
      /** End-show confirm (D-04). */
      endHeading: "End show?",
      endBody: "You won't be able to add more songs after this.",
      endConfirm: "End show",
      endCancel: "Keep tracking",
      /** Wake-lock unsupported fallback (SHOW-12). */
      wakeLockFallback:
        "Keep your screen on manually — auto screen-wake isn't supported on this device.",
      /** Matrix artifact load failure (full-stage state). */
      modelLoadFailureHeading: "Couldn't load the prediction model.",
      modelLoadFailureBody: "Reopen Guezzer to try again.",
    },
  },
} as const;
