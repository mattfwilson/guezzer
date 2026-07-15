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

    /**
     * Phase-6 D-21 orb-label fit (fitOrbLabel). Names wrap + scale-to-fit down to
     * a floor before ellipsis so full song titles stay readable inside an orb;
     * base sizes stay the existing role sizes (14px orb Label / 20px center
     * Heading). SHOW-02 hit targets are untouched — this only affects text.
     */
    /** Max wrapped lines for a prediction-orb label before shrinking (D-21). */
    ORB_LABEL_MAX_LINES: 2,
    /** Font-size floor in px for a prediction-orb label before ellipsis (D-21). */
    ORB_LABEL_MIN_FONT_PX: 11,
    /** Max wrapped lines for the larger center-node label (D-21). */
    ORB_LABEL_MAX_LINES_CENTER: 3,
    /** Font-size floor in px for the center-node label before ellipsis (D-21). */
    ORB_LABEL_MIN_FONT_PX_CENTER: 14,
    /** Nominal center-pill text-width budget in px fed to fitOrbLabel (the pill is
     *  max-w-[70%] of the stage and receives no px size; this is the wrap heuristic). */
    ORB_LABEL_CENTER_WIDTH_PX: 220,
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
    /**
     * Export envelope `schemaVersion` stamped by serializeExport / checked on
     * import (D-09/D-12). Bumped 1 → 2 in plan 06-07: the v2 envelope adds the
     * `owner` identity fork key + the `archiveShows` fallback setlist cache.
     * v1 backups migrate forward losslessly via core MIGRATIONS[1].
     */
    SCHEMA_VERSION: 2,
  },

  /**
   * Phase-6 dex UI geometry (06-UI-SPEC §Config surface). Rarity thresholds are
   * CORE config (pure derivation, EVAL-05) — only display dimensions live here.
   */
  dex: {
    /** Album-cover display size in px; the committed WebP assets are 2× (160px). */
    ALBUM_ART_DISPLAY_PX: 80,

    /**
     * Plan 06-08: how long the "+{n} songs caught" retro-mark flash lingers in
     * the ArchiveBrowser before fading (ms). Purely cosmetic feedback — the
     * counts recompute instantly via useLiveQuery regardless.
     */
    MARK_FLASH_MS: 1600,

    /**
     * D-17 (plan 06-07): max length of the Settings owner-name input, applied as
     * a `maxLength` attribute. MIRRORS `config.dex.OWNER_NAME_MAX_LENGTH` in
     * @guezzer/core (which is not re-exported from the core barrel) — the core
     * schema hard-clamps the same value, so the two MUST stay equal (40).
     */
    OWNER_NAME_MAX_LENGTH: 40,
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

      /**
       * Owner-identity field (D-17, plan 06-07). Your name is stamped on every
       * export so a friend importing your backup gets the compare view (06-10),
       * never a silent merge into their own dex. Reassuring, not required.
       */
      ownerNameHeading: "Your name",
      ownerNameDescription:
        "Stamped on your backups so friends' dexes stay separate from yours.",
      ownerNamePlaceholder: "Add your name",
    },

    /**
     * Phase-6 Pokédex copy (06-UI-SPEC §Copywriting Contract) — verbatim. The
     * throughline is "your collection, honestly counted": game feel on top, real
     * corpus statistics underneath, never fake precision (STAT-04). No component
     * under packages/app/src/dex may hardcode a dex string — they READ these keys.
     */
    dex: {
      /** Completion-headline caption under the `{caught}/{total} · {pct}%` Display number. */
      caughtCaption: "caught",
      /** Rarest-catch subline (STAT — game framing), song name is kglw-derived (React text). */
      rarestCatchLabel: (song: string): string => `Rarest catch: ${song}`,
      /** Attended-show count subline. */
      showsAttended: (n: number): string => `${n} shows attended`,
      /** Segment-control labels (component state, not a route). */
      segmentAlbums: "Albums",
      segmentShows: "Shows",
      /** Catch-all bucket card names (D-04), pinned last in the shelf. */
      bucketMiscellaneous: "Miscellaneous",
      bucketCovers: "Covers",
      /** Empty-dex state (the Mark CTA joins in plan 06-08). */
      emptyHeading: "No catches yet",
      emptyBody: "Track a show live, or mark the shows you've already been to.",
      /** Shows-segment empty state (the list lands in plan 06-09). */
      showsEmptyHeading: "No shows yet",
      showsEmptyBody: "Your tracked and marked shows land here.",
      /** Album-detail back control. */
      albumBack: "Back",
      /**
       * Rarity-tier words (D-15, §B3). The tier WORD always renders — color is
       * reinforcement only (color-blind safety, WCAG 1.4.1). Keyed by RarityTier.
       */
      tierLabels: {
        common: "Common",
        uncommon: "Uncommon",
        rare: "Rare",
        legendary: "Legendary",
      },
      /** Debut-candidate pill (STAT-04, D-08) — replaces any tier/percentage for zero-history songs. */
      debutBadge: "Debut candidate",
      /**
       * Caught song-row subline (STAT-03) — personal-gap phrasing. `mon` is a
       * pre-formatted "Mon YYYY" string; `gap` is your shows since last sighting.
       */
      songSeenCaught: (sightings: number, mon: string, gap: number): string =>
        `Seen ${sightings}× · last ${mon} · ${gap} of your shows ago`,
      /** Caught song-row subline at gap 0 (seen at your most recent show). */
      songSeenLastShow: (sightings: number): string => `Seen ${sightings}× · last show`,
      /** Unseen-but-has-live-history subline — honest corpus stat, no personal fake. */
      songPlayedAllTime: (playCount: number): string => `Played ${playCount}× all-time`,
      /** Debut-candidate detail line (STAT-04) — the anti-fake-precision copy. */
      debutDetail: "Never played live — no odds to fake.",
      /** WhyDetail corpus-stat line (STAT-01) — play count · last played · corpus gap. */
      whyCorpusStat: (playCount: number, mon: string, gap: number): string =>
        `Played ${playCount}× · last ${mon} · gap ${gap}`,
    },

    /**
     * Phase-6 retro-mark ArchiveBrowser copy (06-UI-SPEC §Copywriting Contract,
     * Layout 2) — verbatim. "Mark attended shows" is both the entry CTA (Shows
     * segment header + dex empty state) and the full-screen browser title. All
     * kglw-derived venue/city/song strings render as React text only (T-06-18).
     */
    archive: {
      /** Entry CTA (Shows segment header + dex empty-state) AND the browser title. */
      cta: "Mark attended shows",
      /** Full-screen browser title (same string as the CTA — D-09). */
      title: "Mark attended shows",
      /** Search field placeholder (fuzzy date/venue/city). */
      searchPlaceholder: "Search by date, venue, or city",
      /** Close-browser control accessible label. */
      close: "Close",
      /** One-tap-mark inline flash (D-11) — n = the show's setlist size. */
      songsCaught: (n: number): string => `+${n} songs caught`,
      /** No search results (offline or a query past the bundled corpus). */
      noMatchHeading: "No shows match.",
      noMatchBody: (corpusDate: string): string =>
        `The bundled archive covers through ${corpusDate}.`,
      /** Online fallback offer row (D-09) — user-initiated, session-cached, never retried. */
      fallbackSearch: "Search kglw.net for newer shows",
      /** Loading label while the polite live search runs. */
      fallbackSearching: "Searching kglw.net…",
      /** Offline: the fallback row is replaced by this muted note. */
      offlineNote: "Newer shows need a connection.",
      /** Online-search soft failure / no newer shows found (D-09). */
      failureHeading: "Can't reach kglw.net.",
      failureBody: "Showing the bundled archive only — try again with signal.",
      /** Unmark confirm dialog (D-12) — the phase's only destructive control (#EF4444). */
      unmarkHeading: "Unmark this show?",
      unmarkBody: "Its songs come off your dex counts.",
      unmarkConfirm: "Unmark",
      unmarkCancel: "Cancel",
    },
  },
} as const;
