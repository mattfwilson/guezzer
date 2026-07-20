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
import type { RarityTier } from "@guezzer/core";

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
    /** Adaptive fan upper bound (owner 2026-07-17: capped at 5 so the fan stays a
     *  clean, non-overlapping pentagon around the centre — MIN==MAX ⇒ always 5). */
    ORB_COUNT_MAX: 5,
    /** Drop orbs below this absolute score before enforcing ORB_COUNT_MIN (D-12). */
    ORB_DROP_SCORE: 0.02,
    /** Top-orb score below which the whole fan softens visually (D-10 / SHOW-08 / EVAL-04). */
    WEAK_FAN_THRESHOLD: 0.15,
    /** Visual minimum orb diameter in px; hit area stays ≥44px regardless (SHOW-02). */
    ORB_MIN_DIAMETER: 56,
    /** Visual maximum (uniform) prediction-orb diameter in px — the ring solver
     *  grows orbs toward this to fill the stage; bigger = more legible (owner
     *  2026-07-17, SHOW-01). */
    ORB_MAX_DIAMETER: 112,
    /** Outer radial inset in px keeping orbs clear of notches/safe-area edges (SHOW-02, no orb under an inset). */
    RING_INSET_PX: 24,
    /** Current-song CENTER node diameter in px — a fixed circle (owner 2026-07-17);
     *  also the clearance the ring solver leaves so no prediction orb overlaps it. */
    ORB_CENTER_DIAMETER: 116,
    /** Pre-opener "Search for the opener" CTA prompt circle diameter in px — LARGER
     *  than ORB_CENTER_DIAMETER so the primary call-to-action reads as prominent and
     *  the prompt text has breathing room. Separate from ORB_CENTER_DIAMETER, which
     *  the playing-song orb, collapse-glide scale, and label-fit all depend on. */
    ORB_PROMPT_DIAMETER: 150,
    /** Minimum gap in px between adjacent prediction orbs and between an orb and the
     *  centre node — the ring solver guarantees this, so orbs never overlap (SHOW-02). */
    ORB_RING_GAP_PX: 10,
    /** Floor / fallback count of recent trail nodes (SHOW-08). The trail now fills
     *  the measured strip width — MORE nodes on a wide desktop, fewer on mobile —
     *  but never fewer than this, and this is the count used before the width is
     *  measured (SSR / unit tests with no layout). */
    TRAIL_VISIBLE_RECENT: 4,
    /** Fixed comet-trail node slot width in px — uniform so the connector baseline
     *  hits every dot centre exactly and the fit-to-width count is deterministic. */
    TRAIL_NODE_SLOT_WIDTH: 56,
    /** Horizontal gap in px between trail nodes (mirrors the `gap-2` on the row). */
    TRAIL_NODE_GAP_PX: 8,
    /** Set length that triggers the "+N" trail compression chip (SHOW-08). */
    TRAIL_COMPRESS_AT: 30,
    /** Smallest (oldest) comet-trail node dot diameter in px — solid-filled; the hit area stays ≥44px via the wrapper button regardless (SHOW-08). */
    TRAIL_NODE_MIN_DIAMETER: 12,
    /** Largest (most-recent) comet-trail node dot diameter in px — solid-filled; nodes diminish from this toward MIN by age (SHOW-08). */
    TRAIL_NODE_MAX_DIAMETER: 20,

    /**
     * Phase-6 D-21 orb-label fit (fitOrbLabel). Names wrap + scale-to-fit down to
     * a floor before ellipsis so full song titles stay readable inside an orb;
     * base sizes stay the existing role sizes (14px orb Label / 20px center
     * Heading). SHOW-02 hit targets are untouched — this only affects text.
     */
    /** Base (largest) prediction-orb label font in px — smaller than before so the
     *  bigger orbs read with breathing room, wrapping/shrinking only as needed (owner 2026-07-17). */
    ORB_LABEL_BASE_FONT_PX: 13,
    /** Max wrapped lines for a prediction-orb label before shrinking (D-21). Raised
     *  4→5 in POLISH-01 gap-closure (plan 08-08): under the stricter CIRCLE-AWARE fit
     *  the outer lines hold fewer chars (narrow chords), so a 5th line lets the
     *  longest names still fit without ellipsis across the swept diameter [56..112]
     *  (locked by orbLabelFit.catalog.test.ts; confirmed on-device via #/dev/orb-fit). */
    ORB_LABEL_MAX_LINES: 5,
    /** Font-size floor in px for a prediction-orb label before ellipsis (D-21).
     *  POLISH-01 gap-closure (plan 08-08): lowered 10→7 for the CIRCLE-AWARE fit.
     *  7px @ weight 600 is only ever reached by the longest names at the ABSOLUTE
     *  smallest orbs (~1% of the swept [56..112] range; ~78% of the catalog renders
     *  at the full 13px base) — the honest floor that keeps every real name fully
     *  rendered (no ellipsis) inside its circular fill rather than truncating. The
     *  heuristic never returns a smaller font before the (unreachable for real
     *  names) ellipsis safety net fires. */
    ORB_LABEL_MIN_FONT_PX: 7,
    /** Base (largest) center-node label font in px. */
    ORB_LABEL_BASE_FONT_PX_CENTER: 18,
    /** Max wrapped lines for the larger center-node label (D-21). Raised 3→4 in
     *  POLISH-01 (plan 08-06): the 44-char outlier
     *  `(You Gotta) Fight for Your Right (To Party!)` needs a 4th line to render
     *  fully (no ellipsis) inside the 92px center inner width at the 12px floor. */
    ORB_LABEL_MAX_LINES_CENTER: 4,
    /** Font-size floor in px for the center-node label before ellipsis (D-21). Kept
     *  at 12px (the larger center node reaches zero-ellipsis for every real name at
     *  this floor once MAX_LINES_CENTER is 4 — no lower floor needed). */
    ORB_LABEL_MIN_FONT_PX_CENTER: 12,

    /**
     * POLISH-01 gap-closure (plan 08-08) — CIRCLE-AWARE fit geometry. These three
     * drive the GEOMETRY of the circular fit (chord-per-line + total-height budget),
     * not chrome: `fitOrbLabel`/`labelFitsCircle` model the orb as a CIRCLE, so each
     * wrapped line's usable width is the circle chord at that line's vertical offset
     * (chord = 2·√(r²−y²)) and the stacked name lines + the reserved percent line must
     * fit the circle's vertical extent. Single-config ethos (CLAUDE.md) — no magic
     * numbers in orbLabelFit.ts or the callers. Confirmed on-device via #/dev/orb-fit.
     */
    /** Line-box height as a multiple of the font px (the vertical space each wrapped
     *  line occupies in the fit model, i.e. a tight `leading` proxy). TUNABLE: a
     *  tighter box lets more lines stack inside the circle's vertical extent. Tuned
     *  1.15→1.0 in 08-08 so the longest names clear the circular height budget at the
     *  smallest orbs without dropping to an illegible floor. */
    ORB_LABEL_LINE_HEIGHT_FACTOR: 1.0,
    /** Reserved vertical px for the always-present prediction-orb percent line
     *  (`text-[14px]` below the name). The fitter subtracts this from the circle's
     *  vertical budget so the name never collides with the percent (center node
     *  passes 0 — it has no percent line). Tuned to 12 in 08-08 — the honest reserve
     *  that clears the geometric catalog sweep; on-device confirmation via #/dev/orb-fit. */
    ORB_LABEL_PERCENT_LINE_PX: 12,
    /** The prediction-orb face-button `px-1` padding (4px) subtracted PER SIDE from
     *  the orb diameter before fitting, so the label fits the CONTENT circle — mirrors
     *  CenterNode's inline 12px padding subtraction (the drift this closes: the orb
     *  previously passed its raw diameter, over-granting width). */
    ORB_LABEL_FACE_PADDING_PX: 4,

    /**
     * Phase-8 POLISH: prediction-orb info gesture. Long-pressing an orb opens its
     * "why" sheet (replacing the old visible (i) dot, which is now sr-only for AT);
     * a quick tap still logs the orb (SHOW-03). Tuned so a deliberate-but-slow log
     * tap doesn't accidentally trip the info sheet.
     */
    /** Hold duration in ms before an orb press opens the info sheet instead of logging. */
    ORB_LONG_PRESS_MS: 500,
    /** Pointer travel in px that cancels a pending long-press (treat as a scroll/drag, not a hold). */
    ORB_LONG_PRESS_MOVE_PX: 10,

    /** Pre-opener SearchSheet auto-populates this many recency-weighted openers
     *  (QUICK-260718-1no). App-only tunable — the ranking itself is a pure core
     *  derivation (deriveTopOpeners); no core-config mirror. */
    OPENER_SUGGESTION_COUNT: 5,

    /**
     * Phase-8 POLISH: LiveGizz page ambient background — a randomized bundled
     * album cover, blurred + dark-dimmed behind the page body so it reads as
     * texture, never foreground (single-config ethos; no magic numbers in the
     * component). Body content (orbit, buttons, header, text) must stay legible.
     */
    background: {
      /** Gaussian blur radius in px applied to the cover backdrop (heavy = ambient wash). */
      BLUR_PX: 5,
      /** Dark scrim opacity (0–1) over the cover, using --color-surface, so body stays legible. */
      DIM_OPACITY: 0.75,
      /** Crossfade duration in ms when the background swaps to a newly-selected song's album cover. */
      CROSSFADE_MS: 600,
      /** Interval in ms between random-cover crossfades in the PRE-selection ambient
       *  state (before any next song is picked); cycling stops once a song is selected,
       *  and is suppressed entirely under prefers-reduced-motion or with <2 covers. */
      PRESHOW_CYCLE_MS: 5000,
    },

    /**
     * Phase-8 POLISH: orbit choreography (owner 2026-07-17, "cinematic & sequenced").
     * Prediction orbs fan out from behind the centre on a new current song; each
     * orb floats subtly in place; tapping one glides it to the centre while the
     * rest dissolve, THEN the next fan spreads. Durations in ms (converted to the
     * seconds `motion` wants at the call site). All honor prefers-reduced-motion.
     */
    orbitAnim: {
      /** Fan-out duration in ms — orbs spread from the centre to their ring seats. */
      FAN_OUT_MS: 620,
      /** Per-rank stagger in ms so the fan opens sequentially (rank 0 first). */
      FAN_OUT_STAGGER_MS: 70,
      /** Collapse duration in ms — selected orb glides to centre, others dissolve,
       *  AND the outgoing centre song shrinks/fades out to make room; the next fan
       *  is held until this elapses (sequential, owner choice). */
      COLLAPSE_MS: 560,
      /** Scale/fade-in duration in ms for the new centre song after a collapse. */
      CENTER_IN_MS: 320,
      /** Peak translate in px of an orb's subtle idle in-place float. */
      FLOAT_PX: 6,
      /** Idle-float loop period in ms (per-orb phase is offset so they don't sync). */
      FLOAT_PERIOD_MS: 4200,
    },
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
    /**
     * Fixed SuggestionStrip slot height in px so the orbit never re-lays-out
     * (SHOW-02 preservation). MUST hold `live.SUGGESTION_COUNT` rows without
     * clipping: each StripRow is `min-h-11` (44px), so 2 rows need ~88px — the
     * old 56px (sized for 1 row) clipped the 2nd suggestion against the tab bar
     * (VALID-02 device dry-run, D-09). 112px = 2 rows with calm vertical
     * breathing room; rarer suggestion+fill-hint overflow scrolls inside the
     * slot (`overflow-y-auto`) rather than clipping, so the fixed height — and
     * the no-relayout invariant — is preserved.
     */
    SUGGESTION_STRIP_HEIGHT: 112,
    /** SyncDot glyph diameter in px (online = filled, offline = hollow ring). */
    SYNC_DOT_DIAMETER: 8,
    /** Phase-6 D-20: collapsed Show-Mode FAB diameter in px (≥44px hit floor cleared). */
    FAB_DIAMETER: 56,
    /** Phase-6 D-20: min height in px of each expanded speed-dial action row (≥44px hit floor cleared). */
    FAB_ACTION_HEIGHT: 48,

    /**
     * Phase-8 D-04: named z-index stacking tiers — the single source of truth
     * for every layered `fixed` overlay (CLAUDE.md single-config-file rule; no
     * scattered `z-NN` literals). Applied via inline `style={{ zIndex:
     * config.ui.z.X }}` on each overlay, NOT a Tailwind `z-[…]` class (Tailwind
     * v4 resolves arbitrary values at author-time from static strings, so a
     * JS-config value must go through inline style to keep config.ts the one
     * source). INVARIANT: every FAB tier sits STRICTLY below `sheet`; `focusedFab`
     * is the ONE deliberate exception (D-03: the FilterFab lifts above the
     * non-modal NodeSheet when a constellation node is focused).
     */
    z: {
      /** In-flow raised content (e.g. the ShowView column). */
      content: 10,
      /**
       * Opaque full-screen PAGES rendered in-tree (e.g. RecapView) — above
       * content, but BELOW every modal/scrim tier. A full-screen opaque page
       * is NOT a scrim-backed modal, so it must never occupy the `sheet` tier:
       * if it did, a portaled `<Sheet>` opened from it (ShareCardSheet) would
       * land its scrim (`sheetScrim`) behind the opaque page, killing the
       * backdrop dim + tap-to-dismiss (WR-01 regression guard: page < sheetScrim).
       */
      page: 15,
      /** Transient bottom notifications — UpdateToast + InstallBanner. */
      toast: 20,
      /**
       * FabMenu full-viewport scrim: above content, BELOW the `fab` tier it
       * dims. It only needs to sit over the orbit stage — never over the FAB
       * toggle or its own action rows — so it MUST stay strictly below `fab`,
       * otherwise the scrim paints on top of the speed-dial actions and eats
       * every tap (CR-01 regression guard: fabScrim < fab).
       */
      fabScrim: 25,
      /** Resting FABs + FabMenu action rows (strictly above `fabScrim`). */
      fab: 30,
      /** Modal sheet/dialog backdrops. */
      sheetScrim: 40,
      /** Sheet/dialog content (all modals + the non-modal NodeSheet). */
      sheet: 50,
      /** D-03 exception: FilterFab lifted ABOVE the NodeSheet when a node is focused. */
      focusedFab: 60,
    },
    /** Phase-8 D-03: gap in px between the lifted FilterFab and the sheet's top edge. */
    FAB_SHEET_GAP_PX: 12,
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
    /**
     * Deferred object-URL revoke delay in ms (SAFE-02, D-06). The
     * triggerDownload helper frees the anchor's object URL only after this
     * delay, never on the click tick — a same-tick `revokeObjectURL` silently
     * aborts the download on iOS Safari (backup JSON + share-card PNG). Long
     * enough for iOS Safari to begin the download before the URL is freed.
     * Config-tunable; 1000–10000 ms is the safe band, verified on-device
     * during SAFE-02 UAT. App-only browser-timing value — no core mirror.
     */
    OBJECT_URL_REVOKE_DELAY_MS: 5000,
  },

  /**
   * Phase-6 share-card geometry (06-UI-SPEC §Layout 5 / §Config surface). The
   * PNG brag card is a fixed 1080×1350 (4:5) canvas drawn on #0C0C10 from the
   * pure-core ShareCardData. Only dimensions live here; the card's copy is in
   * config.copy.share.
   */
  share: {
    /** Share-card canvas width in px (4:5 portrait, SHAR-02/D-18). */
    CARD_WIDTH: 1080,
    /** Share-card canvas height in px (4:5 portrait, SHAR-02/D-18). */
    CARD_HEIGHT: 1350,
    /**
     * Fixed brand gold for the share-card wordmark ("Guezzer"), permanently
     * decoupled from the legendary tier hue. Legendary is now orange
     * (`config.dex.tierColors.legendary` = #FB923C); the wordmark keeps this
     * gold regardless so the brand mark never inherits a tier recolor.
     */
    wordmarkGold: "#F2C14E",
  },

  /**
   * Phase-6 dex UI geometry (06-UI-SPEC §Config surface). Rarity thresholds are
   * CORE config (pure derivation, EVAL-05) — only display dimensions live here.
   */
  dex: {
    /** Album-cover display size in px; the committed WebP assets are 2× (160px). */
    ALBUM_ART_DISPLAY_PX: 80,

    /**
     * THE single tier-color source of truth (06-UI-SPEC §B3). Both the
     * TierBadge pill (text + 40%-opacity border) and the share card (rarest-catch
     * tier + tier-breakdown segments) index this map — there is no second local
     * `TIER_COLOR` map anywhere. It lives in `dex` because rarity is a dex
     * concept, but the share card consumes it too (rarity is shared data
     * semantics, not chrome). Color is reinforcement only — the tier WORD always
     * renders regardless (WCAG 1.4.1). The `Record<RarityTier | "debut", string>`
     * annotation makes a missing/extra tier a compile error.
     *
     * NOTE: the share-card wordmark is deliberately NOT in this map — it uses the
     * fixed `config.share.wordmarkGold`, decoupled from `legendary` (now orange).
     */
    tierColors: {
      /** Neutral gray — debut is a state, not a rarity (renders a DOTTED border). */
      debut: "#A1A1AA",
      /** Soft white — unremarkable by design. */
      common: "#E4E4E7",
      /** Emerald — deliberately distinct from the reserved caught-green #22C55E. */
      uncommon: "#34D399",
      /** Blue — reuses the old uncommon blue, now free. */
      rare: "#60A5FA",
      /** Purple — distinct from tuning C#-violet #B98CF2 (they never co-occur). */
      epic: "#A855F7",
      /** Orange — reuses the hue epic briefly held, now free. */
      legendary: "#FB923C",
    } satisfies Record<RarityTier | "debut", string>,

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

  /**
   * Phase-7 Explore constellation RENDER constants (07-UI-SPEC §Config surface).
   * Label/zoom + settle-freeze values were validated on the owner's iPhone 16 Pro
   * in the plan 07-03 device spike (2026-07-16) and carry a [VERIFIED] marker; the
   * spike also surfaced that d3's tight force defaults clump ~264 nodes, so the
   * CHARGE_STRENGTH / LINK_DISTANCE spacing levers were added and tuned there. The
   * pure-derivation constants (rotation window, edge threshold, bars top-N) live
   * in @guezzer/core config; only canvas/render geometry lives here. Single
   * source per CLAUDE.md — no Explore component hardcodes any of these.
   */
  explore: {
    /** [ASSUMED] World-unit min node radius; radius = MIN + sqrt(playCount) clamped to MAX. */
    NODE_RADIUS_MIN: 4,
    /** [ASSUMED] World-unit max node radius (the biggest-playCount star). */
    NODE_RADIUS_MAX: 14,
    /** [ASSUMED] Screen-space pointer-area floor in px (÷ globalScale → world) — 44px tap equivalence regardless of visual radius (SHOW-02 orb-floor analog). */
    NODE_HIT_MIN_RADIUS_PX: 22,
    /** [VERIFIED: device spike 2026-07-16] globalScale at which all zoom-gated labels fade in (D-15) — confirmed comfortable on device. */
    LABEL_ZOOM_THRESHOLD: 1.5,
    /** [VERIFIED: device spike 2026-07-16] globalScale at which sighting-count numbers draw inside rings (D-11) — confirmed on device. */
    COUNT_ZOOM_THRESHOLD: 2.5,
    /** [VERIFIED: device spike 2026-07-16] Biggest nodes (by play count) labeled at rest (D-15) — top-8 confirmed legible, not crowding, at 375px. */
    LABEL_AT_REST_TOP_K: 8,
    /** [ASSUMED] Canvas label ellipsis point in chars — the focused node is exempt (renders its full name). */
    LABEL_MAX_CHARS: 18,
    /** [ASSUMED] Dex-dim (unseen silhouette) node fill opacity when overlay ON (§B4). */
    DEX_DIM_OPACITY: 0.35,
    /** [ASSUMED] Focus-dim opacity for everything outside the focused node's neighborhood (§B4/EXPL-05). */
    FOCUS_DIM_OPACITY: 0.12,
    /** [ASSUMED] Bars bottom-sheet partial peek height as a fraction of the viewport (D-14). */
    SHEET_PEEK_FRACTION: 0.4,
    /** [VERIFIED: device spike 2026-07-16] d3AlphaDecay — settle-and-freeze confirmed smooth (motion stops & freezes) on device. */
    ALPHA_DECAY: 0.035,
    /** [VERIFIED: device spike 2026-07-16] d3VelocityDecay — settle-and-freeze confirmed smooth on device. */
    VELOCITY_DECAY: 0.45,
    /** [VERIFIED: device spike 2026-07-16] cooldownTicks before onEngineStop freezes every node's fx/fy — settle completes on device. */
    COOLDOWN_TICKS: 200,
    /**
     * [owner-set 2026-07-17, doubled from the device-tuned -400] d3 many-body
     * charge strength (negative = repulsion). d3's default (~-30) clumps ~264
     * nodes into an unreadable ball; this stronger repulsion spreads the sky so
     * edges/connections are legible. Doubled from the 2026-07-16 device-verified
     * -400 for a wider spread — NO LONGER the device-tuned figure.
     */
    CHARGE_STRENGTH: -800,
    /**
     * [owner-set 2026-07-17, doubled from the device-tuned 90] d3 link (edge)
     * target distance in world units. d3's default (~30) pulls connected nodes
     * tight; a longer rest length gives each transition edge room to read. Doubled
     * from the 2026-07-16 device-verified 90 for a wider spread — NO LONGER the
     * device-tuned figure.
     */
    LINK_DISTANCE: 180,
    /**
     * [ASSUMED] Link bow magnitude (react-force-graph-2d `linkCurvature`). Bows
     * reciprocal A→B / B→A pairs to opposite sides (deterministic sign by
     * endpoint-id order) so they no longer overlap on one straight line;
     * non-reciprocal edges share the same gentle curve (acceptable). A render-only
     * constant, so it lives app-side with no core mirror — consistent with the
     * NODE_RADIUS_* / CHARGE_STRENGTH render constants. 0.15–0.25 is the sensible
     * band; tune on device later.
     */
    LINK_CURVATURE: 0.2,
    /**
     * [device spike 2026-07-16] px padding around the connected main grouping when
     * the constellation auto-frames on settle (zoomToFit). The frame targets nodes
     * that carry at least one edge, so free-floating stars (common once the edge
     * slider hides weak edges in a later slice) never drag the zoom out.
     */
    ZOOM_TO_FIT_PADDING_PX: 60,
    /** [device spike 2026-07-16] ms ease for the on-load zoom-to-fit camera move (0 = instant). */
    ZOOM_TO_FIT_DURATION_MS: 600,
    /**
     * [ASSUMED] Target zoom (globalScale) the camera eases to when a node is
     * focused (EXPL-05/D-13). Chosen ≥ LABEL_ZOOM_THRESHOLD so the focused
     * neighborhood reads at a comfortable magnification (labels are force-drawn
     * regardless, §Typography canvas rules).
     */
    FOCUS_ZOOM_K: 2,
    /**
     * [ASSUMED] Vertical rest position of the focused node as a fraction from the
     * top of the viewport (D-13). 0.3 places it in the middle of the upper 60% so
     * the 40%-peek NodeSheet (SHEET_PEEK_FRACTION) never covers it.
     */
    FOCUS_TARGET_TOP_FRACTION: 0.3,
    /** [ASSUMED] ms ease for the focus pan/zoom camera move (0 under prefers-reduced-motion). */
    FOCUS_CAMERA_DURATION_MS: 400,
    /**
     * [ASSUMED] UX-04: screen-px a focused node must fall PAST the viewport edge
     * before a container resize pans it back into view. Inflating the on-screen test
     * box by this margin avoids re-centering a node that is merely grazing the edge
     * (a still-visible focus is left alone — the camera belongs to the user).
     * Device-tune: raise if edge-grazing focus nodes feel jumpy on address-bar
     * collapse / orientation; lower if a barely-clipped focus should still recenter.
     */
    FOCUS_OFFSCREEN_MARGIN_PX: 24,
    /**
     * [ASSUMED] Bars shown before the "Show all N" expander in NodeSheet (D-04).
     * MIRRORS `config.explore.BARS_TOP_N` in @guezzer/core (not re-exported from
     * the core barrel — same mirror pattern as `dex.OWNER_NAME_MAX_LENGTH`); the
     * two MUST stay equal (10).
     */
    BARS_TOP_N: 10,

    /**
     * D-05/D-06 rotation window (last-N-shows → the opening-default sky). MIRRORS
     * `config.explore.ROTATION_WINDOW_SHOWS` in @guezzer/core (not re-exported
     * from the barrel — same mirror pattern as `BARS_TOP_N`); the two MUST stay
     * equal (5). Passed into `rotationSongIds(archive, N)` and `rotationHelper(N)`.
     * Config-only — there is deliberately NO second UI slider for N (D-12).
     */
    ROTATION_WINDOW_SHOWS: 5,

    /**
     * D-07 top-K-per-node declutter default ("Top N per song"). MIRRORS
     * `config.explore.TOP_K_PER_NODE_DEFAULT` in @guezzer/core; the two MUST stay
     * equal (2). K=2 draws each song's 2 highest-count OUT edges (−68% vs the old
     * count≥2 hairball) while keeping the node population intact (D-08 free-floating
     * stars); a focused node still reveals its FULL neighborhood past this gate.
     */
    TOP_K_PER_NODE_DEFAULT: 2,

    /**
     * D-07 top-K lower bound. MIRRORS `config.explore.TOP_K_PER_NODE_MIN` in
     * @guezzer/core; the two MUST stay equal (1). K=1 draws only each song's single
     * strongest successor — the sparsest sky.
     */
    TOP_K_PER_NODE_MIN: 1,

    /**
     * D-07 top-K upper bound. MIRRORS `config.explore.TOP_K_PER_NODE_MAX` in
     * @guezzer/core; the two MUST stay equal (5) — deeper K re-hairballs the hubs,
     * so the slider caps at 5.
     */
    TOP_K_PER_NODE_MAX: 5,

    /**
     * Quick task 260717-ual: 2D depth for the GizzVerse constellation (Tier-1
     * spherical shading + synthetic-z depth-scaling). All [ASSUMED] — tune on
     * device (single-config ethos; NO magic numbers in ConstellationCanvas). The
     * synthetic `z ∈ [0,1]` (1 = nearest) is derived in pure core
     * (`deriveConstellation`); these constants shape how much of the near/far
     * contrast reads. Every effect is baked into the canvas draw pass — NONE is a
     * continuous/per-frame animation (EXPL-06 low-power; the canvas repaints only
     * on interaction via force-graph's autoPauseRedraw).
     */
    depth: {
      /** [ASSUMED] Visual radius multiplier for the NEAREST node (z=1) — bigger = advances. */
      DEPTH_RADIUS_NEAR: 1.25,
      /** [ASSUMED] Visual radius multiplier for the FARTHEST node (z=0) — smaller = recedes. */
      DEPTH_RADIUS_FAR: 0.7,
      /** [ASSUMED] Depth opacity (globalAlpha factor) for the nearest node (z=1). */
      DEPTH_OPACITY_NEAR: 1.0,
      /** [ASSUMED] Depth opacity factor for the farthest node (z=0) — dimmer, still legible. */
      DEPTH_OPACITY_FAR: 0.6,
      /** [ASSUMED] Max color-fade toward the surface (#0C0C10) for the farthest node — near stays saturated. */
      DEPTH_FADE_MAX: 0.55,
      /**
       * [ASSUMED] Hard floor on combined node alpha (D-D). Depth alpha multiplies
       * the existing min(focus,dex) dim; this clamp keeps a far + focus-dimmed node
       * from vanishing entirely (the spike's naked-multiply risk).
       */
      DEPTH_ALPHA_FLOOR: 0.1,
      /** [ASSUMED] Spherical-shading highlight center offset as a fraction of r (upper-left light). */
      GRAD_HIGHLIGHT_OFFSET: 0.35,
      /** [ASSUMED] How far the highlight stop lightens the base toward white (0..1). */
      GRAD_HIGHLIGHT_LIGHTEN: 0.5,
      /** [ASSUMED] How far the rim shadow stop darkens the base toward black (0..1). */
      GRAD_SHADOW_DARKEN: 0.45,
      /** [ASSUMED] Depth edge-width multiplier when both endpoints are NEAR (avg z=1). */
      DEPTH_EDGE_WIDTH_NEAR: 1.15,
      /** [ASSUMED] Depth edge-width multiplier when both endpoints are FAR (avg z=0). */
      DEPTH_EDGE_WIDTH_FAR: 0.75,
      /** [ASSUMED] Depth edge-opacity multiplier for NEAR edges (avg z=1) — advance. */
      DEPTH_EDGE_OPACITY_NEAR: 1.0,
      /** [ASSUMED] Depth edge-opacity multiplier for FAR edges (avg z=0) — recede. */
      DEPTH_EDGE_OPACITY_FAR: 0.55,
    },

    /**
     * Quick task 260717-sjg: GizzVerse (Explore) ambient galaxy backdrop — a
     * PURELY decorative CSS radial-gradient nebula rendered on a DOM layer BEHIND
     * the <ForceGraph2D> canvas (ExploreBackground.tsx). The canvas is made
     * transparent so this shows through; the wrapper's bg-surface (#0C0C10) stays
     * the opaque base, so the focus-dim (0.12) / Dex-dim (0.35) overlays still read
     * against #0C0C10 where there are no blooms. It must read as ambient deep-space
     * depth and NEVER compete with tuning-color node fills, the 20%-alpha muted
     * edges, or those dim overlays — hence the deliberately LOW bloom opacities.
     * Motion is transform-only (translate + gentle scale, GPU-composited) and gated
     * behind prefers-reduced-motion (STATIC by default) — it never touches/reheats
     * the d3 sim (EXPL-06 settle-and-freeze) and runs ZERO per-frame JS. Every value
     * is [ASSUMED] — tune on device (single-config ethos: no magic numbers in the
     * component or CSS). No external assets — CSS gradients only (offline-safe).
     */
    background: {
      /**
       * [ASSUMED] Off-center nebula blooms, each a soft radial-gradient wash. Kept
       * LOW opacity (0.10–0.22 subtle band) so a 0.12 focus-dimmed node still reads
       * over it. Palette per the todo: a violet, an indigo, and a teal bloom.
       *   - `color`     : bloom hue (#RRGGBB); the gradient fades color→transparent.
       *   - `opacity`   : peak (center) opacity of the bloom (0–1, LOW).
       *   - `sizeVmin`  : bloom diameter as a viewport-min (vmin) percentage.
       *   - `x`/`y`     : normalized 0–1 viewport fractions of the bloom CENTER.
       *   - `driftXPct` / `driftYPct` : peak drift offset (% of the bloom's own box)
       *                   at the mid-point of the loop — very small, ambient.
       *   - `driftMs`   : that bloom's drift-loop period in ms (tens of seconds).
       *   - `delayMs`   : animation-delay (negative = pre-seeded phase) so the blooms
       *                   never drift in sync (mirrors the orb-float --float-delay idiom).
       */
      blooms: [
        { color: "#6D28D9", opacity: 0.18, sizeVmin: 95, x: 0.24, y: 0.26, driftXPct: 13, driftYPct: -10, driftMs: 42000, delayMs: 0 }, // violet
        { color: "#4338CA", opacity: 0.15, sizeVmin: 115, x: 0.78, y: 0.34, driftXPct: -15, driftYPct: 12, driftMs: 52000, delayMs: -13000 }, // indigo
        { color: "#0D9488", opacity: 0.11, sizeVmin: 85, x: 0.55, y: 0.82, driftXPct: 11, driftYPct: 14, driftMs: 60000, delayMs: -30000 }, // teal
      ],
      /** [ASSUMED] Gaussian blur radius in px on each bloom for a soft-edged wash. */
      BLUR_PX: 64,
      /** [ASSUMED] Peak scale of each bloom's gentle "breathing" pulse (transform-only, folded into the drift keyframe). */
      PULSE_SCALE: 1.12,
      /** [ASSUMED] Bloom opacity at the breathe mid-point (0–1) — each bloom fades toward this and back so the nebula pulses "alive"; 1 = no breathe. Folded into the drift keyframe (compositor-only). */
      PULSE_OPACITY: 0.68,
      /** [ASSUMED] Faint static star-speck layer opacity (0–1) — overall multiplier on the generated dots, NO external images (offline-safe); this layer is NOT animated. */
      SPECK_OPACITY: 0.55,
      /** [ASSUMED] Number of star specks generated (random positions, non-tiled) across the viewport. */
      SPECK_COUNT: 90,
      /** [ASSUMED] Per-speck brightness (alpha) is randomized in [MIN, MAX] so the field twinkles in intensity, not uniform white. */
      SPECK_BRIGHTNESS_MIN: 0.18,
      SPECK_BRIGHTNESS_MAX: 1,
      /** [ASSUMED] Per-speck diameter randomized in [MIN, MAX] px for size variety. */
      SPECK_SIZE_MIN_PX: 0.7,
      SPECK_SIZE_MAX_PX: 1.9,

      /**
       * Quick task 260717-ual: motion parallax. On pan/zoom the nebula follows the
       * graph transform by a DAMPED fraction so the sky moves slower than the
       * constellation, reading as a distant backdrop. Applied as a GPU compositor
       * transform on the nebula layer, driven by `<ForceGraph2D onZoom>` ONLY —
       * interaction-driven, no continuous per-frame loop, no d3 reheat, frozen fx/fy
       * survive (EXPL-06). Static under prefers-reduced-motion. Both [ASSUMED].
       */
      /** [ASSUMED] Fraction of the graph PAN (translate) the sky follows (0 = fixed sky, 1 = locked to graph). Low = subtle, distant. */
      PARALLAX_TRANSLATE_DAMP: 0.15,
      /** [ASSUMED] Fraction of the graph ZOOM the sky scales with, applied as `1 + (k-1)*damp`. Low = the sky barely zooms. */
      PARALLAX_ZOOM_DAMP: 0.05,
      /** [ASSUMED] Max nebula parallax translate in px (clamp on |x|,|y|). Bounds the
       *  shift so it can never exceed the overscan below — the star-field edge stays
       *  off-screen. MUST be < PARALLAX_OVERSCAN_PX. */
      PARALLAX_MAX_TRANSLATE_PX: 40,
      /** [ASSUMED] Constant px the nebula layer extends BEYOND the viewport on every
       *  side (negative inset). Sized > PARALLAX_MAX_TRANSLATE_PX so translating the
       *  sky (or a <1 zoom, clamped out) never drags the layer's rectangular edge into
       *  view (fixes the parallax edge-reveal). */
      PARALLAX_OVERSCAN_PX: 56,
    },
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
      /** Center node prompt before the opener is seeded — tap to open Search. */
      centerPrompt: "Search for the opener",
      /** Fuzzy search sheet (SHOW-04). */
      searchCta: "Search",
      searchPlaceholder: "Search the catalog",
      /** Heading over the pre-opener recency-weighted opener suggestions (QUICK-260718-1no). */
      openerSuggestionsHeading: "Popular openers",
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
      /**
       * LIVE-03 (D-06) schema-drift tap-for-detail. Renders the novel API key
       * NAMES only — NEVER editor values (T-11-04-01 / SCHEMA §12). Reassuring,
       * not alarming: an additive field is a shrug, not an outage.
       */
      schemaDriftDetail: (keys: string[]): string =>
        keys.length > 0
          ? `Syncing — the setlist API added ${keys.length > 1 ? "fields" : "a field"} (${keys.join(", ")}). Logging still works.`
          : "Syncing — the setlist API shape changed. Logging still works.",
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

      /**
       * Cross-night rotation reset (PRED-03, plan 11-05). During a run of
       * consecutive nights, songs played earlier in the run are gently
       * down-weighted in tonight's predictions. Tapping this before a SEPARATE
       * weekend (where the band may replay) clears that history so nothing is
       * suppressed. A two-tap confirm affordance guards it — no data is deleted.
       */
      rotationResetHeading: "Start a fresh run",
      rotationResetDescription:
        "Stops songs from earlier nights being down-weighted. Tap before a separate weekend where the band might replay them. Nothing is deleted.",
      rotationResetCta: "Start a fresh run",
      rotationResetConfirmCta: "Confirm — start fresh",
      rotationResetCancelCta: "Cancel",
      rotationResetDone: "Fresh run started. Earlier nights won't be down-weighted.",
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
       * Set-structure labels (SHOW-06 vocabulary "1"/"2"/"e"). Shared by the
       * retro-setlist history view (SetlistView, HIST-01) and the recap's
       * set-grouped setlist so the two never disagree on a set name.
       */
      setLabels: {
        "1": "Set 1",
        "2": "Set 2",
        e: "Encore",
      },
      /** Show-history row song-count subline (D-16). */
      showsSongCount: (n: number): string => `${n} songs`,
      /** Show-history tracked-row tally chip — hits/total (D-16). */
      showsTallyChip: (hits: number, total: number): string => `${hits}/${total}`,
      /**
       * Rarity-tier words (D-15, §B3). The tier WORD always renders — color is
       * reinforcement only (color-blind safety, WCAG 1.4.1). Keyed by RarityTier.
       */
      tierLabels: {
        common: "Common",
        uncommon: "Uncommon",
        rare: "Rare",
        epic: "Epic",
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

    /**
     * Phase-6 post-show recap copy (06-UI-SPEC §Copywriting Contract, Layout 3) —
     * verbatim. The recap ONLY renders the pure core `RecapStats`; these strings
     * are the presentation layer over that derivation (SHOW-14, D-13/D-14/D-15).
     * kglw-derived song/venue names render as React text only (T-06-21).
     */
    recap: {
      /** Auto-shown heading. */
      heading: "Show recap",
      /** Subline `{date} · {venue}` (venue nullable → date-only fallback). */
      subline: (date: string, venue: string | null): string =>
        venue ? `${date} · ${venue}` : date,
      /** Hero tally `{hits}/{total} · {pct}%` (Display, tabular-nums); pct null → "—". */
      heroTally: (hits: number, total: number, pct: number | null): string =>
        `${hits}/${total} · ${pct == null ? "—" : `${pct}%`}`,
      /** Hero caption under the tally. */
      heroCaption: "calls hit",
      /** Manual-vs-editor source split (D-14) — consumes the Phase-5 source tags. */
      sourceSplit: (manualHits: number, manualTotal: number, editorHits: number): string =>
        `Your calls: ${manualHits}/${manualTotal} · Editor assists: ${editorHits}`,
      /** Show rarity score line (STAT-02, D-15) — avg corpus gap of the night. */
      showRarity: (score: number): string => `Show rarity: ${score}`,
      /** Tier-chip count suffix — the tier word renders via TierBadge alongside. */
      tierCount: (count: number): string => `× ${count}`,
      /** Rarest-catch-of-the-night line (STAT-02); song name is kglw-derived (React text). */
      rarestOfNight: (song: string): string => `Rarest catch of the night: ${song}`,
      /** New-catches row (D-14) — omitted entirely at zero (no "+0"). */
      newCatches: (n: number): string => `+${n} new catches`,
      /** Footer neutral CTA — returns to Show/Dex (Share card joins in 06-11). */
      done: "Done",
    },

    /**
     * Phase-6 friend-compare copy (06-UI-SPEC §Copywriting Contract, Layout 4) —
     * verbatim. The throughline is "a friend's file is a read-only trophy case":
     * the persistent banner reaffirms nothing was merged (D-17). The friend's
     * name is untrusted (kglw-adjacent) and renders as escaped React text only,
     * length-clamped by the schema's 40-char cap (T-06-26). No CompareView
     * component hardcodes a string — they READ these keys.
     */
    compare: {
      /** Persistent read-only banner — always visible atop the compare view. */
      banner: (name: string): string =>
        `Viewing ${name}'s dex — nothing was added to yours.`,
      /** Your stat column heading. */
      columnYou: "You",
      /** The friend's stat column heading (their stamped name). */
      columnThem: (name: string): string => name,
      /** Per-column stat row labels (side-by-side, tabular-nums). */
      statCompletion: "Completion",
      statCaught: "Caught",
      statShows: "Shows",
      /** Diff-section headings — n = the list length. */
      onlyThemHeading: (name: string, n: number): string =>
        `Only ${name} has caught (${n})`,
      onlyYouHeading: (n: number): string => `Only you have caught (${n})`,
      /** Shared-catches section heading (both have caught). */
      sharedHeading: (n: number): string => `You both caught (${n})`,
      /** Close control (returns to Settings). */
      close: "Close",
      /** Import-fork surface copy (Settings) — the friend-file announcement. */
      friendOpening: (name: string): string =>
        `This is ${name}'s dex — opening compare view.`,
      /** Unowned-file prompt (friend files pre-date the owner field; never guess). */
      namePrompt: "Whose dex is this?",
      /** Name-prompt text-input placeholder. */
      namePromptPlaceholder: "Enter a name",
      /** Name-prompt confirm — opens the compare view with the entered name. */
      namePromptConfirm: "Open compare",
      /** Name-prompt "it's my own backup" escape → routes to the merge path. */
      namePromptMine: "It's mine — merge it",
    },

    /**
     * Phase-6 share-card copy (06-UI-SPEC §Copywriting Contract, Layout 5) —
     * verbatim. The card itself is drawn on the canvas; these strings drive the
     * CTA, the preview sheet, and the success/failure states. Share/render
     * failures surface calm copy and never touch app state (T-06-27). The
     * kglw-derived song/venue names drawn onto the card come from ShareCardData
     * (assembled in core) — the app draw layer only renders them.
     */
    share: {
      /** Primary phase CTA (accent) — DexHeader + RecapView footer (Share2 icon). */
      cta: "Share card",
      /** Preview-sheet accessible label / heading. */
      sheetLabel: "Share card",
      /** Web-Share-unsupported download-fallback confirmation (CircleCheck, muted). */
      savedToDownloads: "Card saved to your downloads.",
      /** Render/build failure heading — calm, non-blocking. */
      failureHeading: "Couldn't build the card.",
      /** Render failure body — reassures the dex is untouched (T-06-27). */
      failureBody: "Try again — your dex is unaffected.",
      /** Close-preview control accessible label. */
      close: "Close",
      /**
       * Card face labels drawn onto the canvas (system-font stack, contract
       * colors only). Tier WORDS reuse config.copy.dex.tierLabels — no duplication.
       */
      card: {
        wordmark: "Guezzer",
        caught: (caught: number, total: number): string => `${caught}/${total} caught`,
        shows: (n: number): string => (n === 1 ? "1 show" : `${n} shows`),
        rarestLabel: "Rarest catch",
        latestLabel: "Latest show",
        /** Per-show card caption under the songs-caught hero COUNT (plan 10-02). */
        songsCaughtLabel: "songs caught",
        /** Per-show card footer label above the show's own date · venue (plan 10-02). */
        showLabel: "This show",
      },
    },

    /**
     * Phase-7 Explore copy (07-UI-SPEC §Copywriting Contract) — verbatim. The
     * throughline is "honest numbers, your sky": raw history with real counts
     * and dates (D-01/D-02), never model-flavored pseudo-probabilities outside
     * a show context. N is NEVER hardcoded — callers pass
     * `config.explore.ROTATION_WINDOW_SHOWS` (core) into `rotationHelper`, and
     * the bars collapse label interpolates `config.explore.BARS_TOP_N`. No
     * component under packages/app/src/explore may hardcode a Phase-7 string —
     * they READ these keys. kglw-derived song names render as escaped React
     * text / canvas fillText only (never HTML injection).
     */
    explore: {
      /** Filter FAB accessible label (the FAB is deliberately not an accent CTA — D-09). */
      filterFabAria: "Explore filters",
      /** Filter panel — segmented view toggle (Rotation default, D-03/D-12). */
      toggleRotation: "Rotation",
      toggleFull: "Full catalog",
      /** Filter panel — rotation helper. N interpolated from config.explore.ROTATION_WINDOW_SHOWS (never hardcoded). */
      rotationHelper: (n: number): string => `Songs from the last ${n} shows.`,
      /** Filter panel — top-K-per-node declutter slider label; {x} is the live tabular-nums value readout beside the thumb. */
      edgeSliderLabel: (x: number): string => `Top ${x} per song`,
      /** Filter panel — dex-overlay switch (ON default, D-10). */
      overlaySwitch: "My dex overlay",
      /** Sheet header subline — all-time play count (Label, muted, tabular-nums). */
      sheetSubline: (playCount: number): string => `Played ${playCount}× all-time`,
      /**
       * Bar "why" line (D-02) — straight off the edge record, zero new
       * derivation. Appends the hard-segue clause ONLY when segueCount > 0.
       */
      barWhy: (count: number, total: number, lastDate: string, segueCount: number): string =>
        `Played ${count} of ${total} times after this song · last ${lastDate}` +
        (segueCount > 0 ? ` · ${segueCount} hard segues` : ""),
      /** Bars expander (D-04) — reveals the long tail. {n} = full outgoing count. */
      barsExpander: (n: number): string => `Show all ${n}`,
      /** Bars collapse — {n} interpolated from config.explore.BARS_TOP_N (never hardcoded). */
      barsCollapse: (n: number): string => `Show top ${n}`,
      /** Sheet — no-outgoing-edges state (honest zero, not an error; node stays a free-floating star per D-08). */
      noOutgoingHeading: "No next songs on record",
      noOutgoingBody: (song: string): string =>
        `Nothing has followed ${song} within a set — yet.`,
      /** Sheet — muted one-line note under the bars (D-03): filters are visual-only. */
      filtersNote: "Complete history — filters only shape the map.",
      /** Empty state — rotation view yields zero nodes (corpus edge case). */
      rotationEmptyHeading: "Nothing in rotation",
      rotationEmptyBody: "No shows in the archive yet — switch to Full catalog.",
      /** Error state — matrix load failure (mirrors the Phase-4 model-load pattern; blocks only this view). */
      errorHeading: "Couldn't load the constellation.",
      errorBody: "Reopen Guezzer to try again.",
    },
  },
} as const;
