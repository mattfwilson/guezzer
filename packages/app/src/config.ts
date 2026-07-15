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
    /** Smallest (oldest) comet-trail node circle diameter in px — the hit area stays ≥44px regardless (SHOW-08). */
    TRAIL_NODE_MIN_DIAMETER: 24,
    /** Largest (most-recent) comet-trail node circle diameter in px — nodes diminish from this toward MIN by age (SHOW-08). */
    TRAIL_NODE_MAX_DIAMETER: 40,
  },

  /**
   * Phase-5 live-sync tunables (05-UI-SPEC §Config surface). Single-config-file
   * ethos (CLAUDE.md) — no scattered magic numbers.
   */
  live: {
    /**
     * Minimum poll cadence in ms — the HARD floor for hitting the volunteer-run
     * `latest` endpoint. Never poll below this (SYNC-01: ≤1 request / 60s).
     */
    POLL_INTERVAL_MS: 60000,
    /** Adaptive-backoff ceiling in ms when the show is idle (D-06, optional). */
    POLL_MAX_INTERVAL_MS: 300000,
    /** Max un-logged editor suggestions shown in the strip at once (D-02). */
    SUGGESTION_COUNT: 2,
  },

  /** Phase-5 UI geometry (05-UI-SPEC §Config surface). */
  ui: {
    /** Fixed SuggestionStrip slot height in px so the orbit never re-lays-out (SHOW-02 preservation). */
    SUGGESTION_STRIP_HEIGHT: 56,
    /** SyncDot glyph diameter in px (online = filled, offline = hollow ring). */
    SYNC_DOT_DIAMETER: 8,
    /** Phase-6 D-20: collapsed Show-Mode FAB diameter in px (≥44px hit floor cleared). */
    FAB_DIAMETER: 56,
    /** Phase-6 D-20: min height in px of each expanded speed-dial action row (≥44px hit floor cleared). */
    FAB_ACTION_HEIGHT: 48,
  },

  /** Phase-5 data-safety tunables (05-UI-SPEC §Config surface). */
  dataSafety: {
    /** Export envelope `schemaVersion` stamped by serializeExport / checked on import (D-09/D-12). */
    SCHEMA_VERSION: 1,
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
      /** Phase-6 D-20: accessible label for the collapsed Show-Mode FAB speed-dial. */
      fabLabel: "Show actions",
      /** Weak-fan softening hint (D-10). */
      weakFanHeading: "Low confidence",
      weakFanBody: "Wide-open moment — the model isn't sure.",
      /** Persistent tally zero-state (SHOW-09). */
      tallyZeroState: "0/0 · —",
      /** Edit an existing trail entry — re-pick the song via search (D-15). */
      editCta: "Edit",
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

    /**
     * Phase-5 live-sync copy (05-UI-SPEC §Copywriting Contract) — verbatim. The
     * throughline is "second set of eyes, never a clobber": suggestions are
     * advisory. No component hardcodes these — they READ these keys.
     */
    live: {
      /** Suggestion eyebrow — the editor-provenance label, muted (D-01/D-02). */
      suggestionEyebrow: "kglw editor",
      /** One-time subtle adopt/dismiss hint above the SuggestionStrip. */
      suggestionAdoptHint: "Tap Add to log it · swipe or tap ✕ to dismiss",
      /** Fill-??? hint eyebrow, muted (D-04). */
      fillPlaceholderEyebrow: "Fill in ???",
      /** Fill-??? body — never auto-applied; reuses the rename path (D-04). */
      fillPlaceholderBody: (songName: string): string =>
        `Editor logged ${songName} here — tap to fill it in.`,
      /** SyncDot offline reassurance line, shown once per drop, auto-dismissing (D-08). */
      offlineReassurance:
        "Offline — tracking still works. It'll resync when signal returns.",
    },

    /**
     * Phase-5 Settings / data-safety copy (05-UI-SPEC §Copywriting Contract) —
     * verbatim. Data safety is reassuring, not alarming: "the export is the real
     * backstop". No component hardcodes these — they READ these keys.
     */
    settings: {
      /** AppMenu entry label + gear icon route to #/settings (D-14). */
      menuLabel: "Settings",
      /** The single Backup & data section heading. */
      sectionHeading: "Backup & data",
      /** Primary phase CTA (accent). */
      exportCta: "Export backup",
      /** Import CTA (neutral). */
      importCta: "Import backup",
      exportDescription:
        "Save all your shows, setlists, and dex to a file. Losing your phone won't lose your dex.",
      importDescription:
        "Merge a backup file. Your existing data is never overwritten.",
      /** Export success confirmation (Settings + auto-download), muted, non-blocking. */
      exportSuccess: "Backup saved.",
      exportSuccessDetail: "Check your downloads.",
      /** Import success (D-10/D-11): heading + a counts template. */
      importSuccessHeading: "Backup merged.",
      importSuccessBody: (shows: number, songs: number): string =>
        `${shows} shows and ${songs} songs added. Nothing was removed.`,
      /** Import error — corrupt/unrecognized file rejected before any DB write (D-12). */
      importErrorHeading: "That's not a Guezzer backup.",
      importErrorBody:
        "Nothing changed. Pick a valid export file and try again.",
      /** Storage-protection readout (D-13). */
      storageProtected: "Storage is protected on this device.",
      storageNotProtected: "Your device may clear Guezzer's data.",
      storageNotProtectedBody:
        "Export a backup now and again to keep your dex safe.",
      /** End-Show auto-backup confirmation (D-13) — a single confirmation, not a per-show nag. */
      endShowBackupConfirmation: "Backup saved to your downloads.",
    },
  },
} as const;
