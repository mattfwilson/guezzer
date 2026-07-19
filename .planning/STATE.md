---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Pre-Show Hardening
status: executing
stopped_at: Completed 11-04-PLAN.md
last_updated: "2026-07-19T21:12:00Z"
last_activity: 2026-07-19 -- Completed Phase 11 plan 04 (live app wiring: PollResult + guardLatestRows + amber SyncDot)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-19 after v1.1 milestone close)

**Core value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.
**Current focus:** Phase 11 — live-sync-prediction-correctness

## Current Position

Phase: 11 (live-sync-prediction-correctness) — EXECUTING
Plan: 5 of 5 (11-04 complete)
Status: Ready to execute (Wave 3 — 11-05 unblocked: needs 11-03 ✓ + 11-04 ✓)
Last activity: 2026-07-19 -- Completed Phase 11 plan 04 (live app wiring: PollResult + guardLatestRows + amber SyncDot)

## Performance Metrics

**Velocity:**

- Total plans completed: 80
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 5 | - | - |
| 04 | 7 | - | - |
| 05 | 6 | - | - |
| 06 | 12 | - | - |
| 08 | 8 | - | - |
| 09 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 04 P01 | 5 | 2 tasks | 5 files |
| Phase 04 P02 | 8min | 1 tasks | 5 files |
| Phase 04 P03 | 10min | 3 tasks | 15 files |
| Phase 04 P04 | 8min | 2 tasks | 6 files |
| Phase 04 P05 | 6min | 2 tasks | 4 files |
| Phase 04 P06 | 12min | 3 tasks | 12 files |
| Phase 04 P07 | ~10min | 2 tasks (+1 deferred device checkpoint) | 9 files |
| Phase 06 P01 | 17min | 3 tasks | 13 files |
| Phase 06 P02 | 8min | 3 tasks | 14 files |
| Phase 06 P03 | 11min | 3 tasks | 8 files |
| Phase 06 P04 | 13min | 2 tasks | 38 files |
| Phase 06 P05 | 6min | 1 tasks | 8 files |
| Phase 06 P6 | 12min | 2 tasks | 13 files |
| Phase 06 P07 | 12min | 3 tasks | 14 files |
| Phase 06 P08 | 13min | 3 tasks | 10 files |
| Phase 06 P09 | 7min | 3 tasks | 10 files |
| Phase 06 P10 | 7min | 2 tasks | 9 files |
| Phase 06 P11 | ~9min | 2 tasks | 10 files |
| Phase 08 P08 | 40 min | 3 tasks | 7 files |
| Phase 10 P01 | ~24min | 3 tasks | 10 files |
| Phase 10 P02 | ~2h (owner-run) | 2 tasks (1 checkpoint) | 11 files |
| Phase 11 P01 | ~10min | 1 tasks | 1 files |
| Phase 11 P02 | ~9min | 3 tasks | 7 files |
| Phase 11 P03 | ~12min | 2 tasks | 6 files |
| Phase 11 P04 | ~7min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap (v1.2): 22 requirements mapped to 6 phases (11–16), 100% coverage. **Bugs before Bingo** — Phase 11 Live-Sync & Prediction Correctness (LIVE-01/02/03 + PRED-01/02/03, Tier-1 residency-failure cluster, FIRST) → Phase 12 Data Safety & Integrity (SAFE-01..04) → Phase 13 Interface & Explore Polish (UX-01..04, lowest severity). Gizz Bingo decomposed into 3 phases behind TWO hard gates (GATE 1 = Phase 11 live-sync correctness; GATE 2 = Monte-Carlo fill-rate calibration writing locked constants to config.ts): Phase 14 pure-core marking/generation (BINGO-03) → Phase 15 persistence/lock/replay (BINGO-06/07) → Phase 16 build/live-marking/celebrations (BINGO-01/02/04/05/08). Segue excluded from the auto-mark catalog (TrackedEntry is song-level, no transitionKind).
- Roadmap (v1.1): 9 hardening requirements grouped into 3 phases by theme — Phase 8 (UI polish + a11y, frontend), Phase 9 (data integrity + restore UX, core/data), Phase 10 (human/device pre-show validation). VALID-01/VALID-02 are human/device checkpoints, isolated in the final verification phase which depends on 8 and 9.
- Roadmap: 🎯 (show-#1) requirements confined to Phases 1–5; Phases 6–7 may ship after show #1 without data loss (attendance auto-mark in Phase 4, export in Phase 5)
- Roadmap: DATA-05 (set-boundary exclusion) mapped to Phase 2 with the matrix builder, not Phase 1 ingestion — the exclusion decision lives where edges are emitted
- Roadmap: EVAL-04 (honest confidence framing) mapped to Phase 4 — it is a Show Mode UI behavior conditioned on Phase 2's backtest output
- Research: as-of-date must be a matrix-construction parameter from day one (Phase 2); set-structure capture and two-source trail design front-loaded into Phase 4 — all three are unretrofittable
- [Phase ?]: Phase 4: logSong snapshots setNumber from the show's currentSetNumber (not caller-supplied) for true set-structure snapshot semantics (SHOW-06)
- [Phase ?]: Phase 4: the trackedShows row itself IS the provisional dex-attendance record (D-02/DEX-01) — no separate table; showId reconciliation deferred to Phase 5/6
- [Phase ?]: Phase 4: SHOW-04 catalog search is a pure core fuse.js wrapper (searchCatalog) over MatrixNode[]; empty query returns [], threshold/distance in config.search
- [Phase ?]: Phase 4: added core package.json exports so the app can import @guezzer/core (first app->core import)
- [Phase ?]: Phase 4: OrbitCandidate = PredictionCandidate + tuningFamily so the render layer never re-touches the matrix; tuning color keyed off the exact core union (not the display label)
- [Phase ?]: Phase 4: matrix bundle-imported via @matrix Vite alias + ambient declare module; schemaVersion===1 guard returns a handled error sentinel, never an unguarded crash
- [Phase ?]: Phase 4: useShowSession is the app's first useLiveQuery — Dexie is the single source of truth (no useState mirror of trail/tally); predictFan gated on currentSongId !== null so null never reaches the frozen core ShowContext
- [Phase ?]: Phase 4: resolved the OrbitStage/AppShell no-scroll seam (Pitfall 5) via an AppShell scroll prop — #/show passes scroll=false for a non-scrolling full-height flex column
- [Phase 04]: ActionBar rendered in-flow (not fixed) to stack above the app BottomTabBar without overlap (04-05)
- [Phase ?]: 04-06: D-15 destructive split — one-tap Undo (no dialog) vs confirm-gated deleteEntry in TrailNodeSheet
- [Phase ?]: 04-06: CometTrail/TallyReadout are dumb components fed useShowSession live entries/tally; recompute after any edit
- [Phase 04]: 04-07: wakeLock.ts mirrors persist.ts (feature-detect + try/catch + never-throw) and VERIFIES the sentinel is actually held — an immediate release/rejection is treated as unsupported (defeats iOS <18.4 installed-PWA false-positive, Pitfall 1) → calm once-per-show WakeLockNotice, silent visibilitychange reacquire
- [Phase 04]: 04-07: gesture suppression is declarative CSS on the stage/action-bar scope (touch-action/overscroll-behavior/user-select, html/body overscroll-behavior-y none) — no preventDefault JS; relies on the 04-04 non-scrolling AppShell seam
- [Phase 04]: 04-07: End Show is a confirm-gated destructive commit (EndShowDialog → endShow → finalized/read-only, D-04); weak-fan softening needed no new code (already live in OrbitStage from 04-03, EVAL-04)
- [Phase 04]: 04-07: on-device SHOW-12/SHOW-13 verification (6 steps) deferred by user approval 2026-07-13 to the end-of-phase device human-verify gate — NOT skipped
- [Phase ?]: 06-02: FabMenu speed-dial supersedes the Phase-4 ActionBar layout (D-13..D-15) — recorded, not restored; same five-callback contract kept (D-20)
- [Phase ?]: 06-02: fitOrbLabel is a pure wrap/scale/ellipsis helper (orbitLayout idiom); added config.show.ORB_LABEL_CENTER_WIDTH_PX so the diameter-less center pill can use it (D-21)
- [Phase ?]: 06-02: InstallBanner gated once-per-build via a persisted installBannerSeenVersion meta stamp; session dismissal layers on top (D-22, supersedes D-05)
- [Phase 06]: 06-03: deriveDex is the single dex derivation entry point — completion/sightings/personalGap/rarest/perAlbum all pure-derived from raw attendance; unmark is free (D-05/D-11/D-12)
- [Phase 06]: 06-03: DexSnapshotInput is a structural subset of ExportSnapshot (enums widened to string) so friend files feed the same derivation (06-10)
- [Phase 06]: 06-04: album covers fetched once at build time via MusicBrainz plus Cover Art Archive plus sharp (D-03 discretion); 29 studio cards resolved, ~195 KB total WebP, provenance manifest and 25 KB/350 KB budget-guard test
- [Phase ?]: 06-05: @archive/@dexAlbums app loaders mirror the @matrix idiom (Vite alias + ambient declare + guarded memoized schemaVersion sentinel, never throw); coverUrlFor is glob-driven with null-to-initials placeholder
- [Phase ?]: 06-05: useDexStats = useLiveQuery(3 attendance tables) + useMemo(deriveDex) with a loading-safe {ready,error,dex,rarity,archive,albums} shape — Dexie is the single source of truth, no stored counts, unmark is free (DEX-03)
- [Phase 06]: 06-06: dex views are dumb components over useDexStats — a mark/unmark re-derives the whole shelf/rows live (D-12); album drill-in is component view-state within #/dex, never a new hash route
- [Phase 06]: 06-06: TierBadge is the ONLY place the two new rarity hues (#60A5FA/#E879F9) appear — data semantics never chrome (B3); tier word always renders for color-blind safety
- [Phase ?]: 06-07: envelope v2 uses zod .default(null)/.default([]) so v1 backups parse while the inferred output type stays required; owner is a device-local fork key (kept local on merge, never written to meta on import); archiveShows commits via bulkPut upsert
- [Phase ?]: 06-08: retro-mark slice — makeArchiveSearcher (offline fuse.js) + fetchRecentShows (tolerant pollLatest-tier online fallback; assert-trip is a soft empty) + ArchiveBrowser one-tap mark/confirm-unmark; dual-source marked-state (retro unmarkable, tracked rows not — Pitfall 6); post-corpus debut names sourced from the fetch record first
- [Phase 06]: 06-09: RecapView renders pure core RecapStats (zero component stat math); the End Show recap seam renders BEFORE ShowView's !session.active early return (RESEARCH Pattern 6) so the payoff is never swallowed
- [Phase 06]: 06-09: ShowsList buildShowRows reuses the deriveDex/merge group-key rule (bound→show_id, unbound→date) so history-list dedupe matches the dex derivation; a tracked+marked night renders once, as tracked (D-16)
- [Phase 06]: 06-10: compareDexes is the structural INVERSE of parseAndMergeImport — same songId identity, songId-only tier-sorted diff lists, never merges/writes (name-free core)
- [Phase 06]: 06-10: D-17 fork is structural not behavioral — classifyImport validates + forks on envelope.owner BEFORE parseAndMergeImport/importSnapshot are reachable; pickAndImport kept verbatim and called only for the "mine" kind
- [Phase 06]: 06-10: CompareView runs deriveDex a SECOND time over the friend envelope (v2 ⊇ DexSnapshotInput) and diffs — zero DB writes proven by two independent before/after table deep-equals
- [Phase 06]: 06-11: buildShareStats(dex, archive) is pure — latest-show date = max(perSong.lastSeenDate), venue resolved from archive by date; no attendance re-read needed (deriveDex exposes no timeline)
- [Phase 06]: 06-11: ShareCardSheet self-sources the live dex via useDexStats (no dex/archive props) so DexHeader + RecapView both open the same whole-dex brag card; File pre-built on sheet-open, share tap has no async before navigator.share (Pitfall 7)
- [Phase 08]: Orb-label fit is now circle-aware (per-line chord + height budget); kept CHAR_WIDTH_FACTOR 0.55, tuned LINE_HEIGHT_FACTOR 1.0 / PERCENT_LINE_PX 12 / MAX_LINES 5 / MIN_FONT_PX 7 (08-08) — Rectangular fit over-granted width and ignored height, spilling small orbs on iPhone (POLISH-01); geometric sweep [56..112] now guards it
- [Phase 10]: 10-02 (VALID-02): full show loop passed a real-device (iPhone) rehearsal on the vite production build (owner declined the tunnel — tests 2–5 on iPhone, 6–7 on desktop localhost secure-context fallback, 8 Android waived D-06). Two D-09 loop-breaking blockers found+fixed inline (SuggestionStrip slot 56→112px + overflow, `b0213c0`; FAB lifted above the reserved strip, `a60d5e2`). Owner-directed scope expansion: per-show recap Share card (core `buildRecapShareStats` off `deriveRecap`, six-tier rarity box, share-icon chrome — `3c09839`) replacing the lifetime-GizzDex card that mismatched the recap (resolves the final-show-share-card todo). Deferred non-blocking gap: iPhone-specific offline (iOS SW eviction) + import (iOS file picker) legs to confirm before show #1. Recorded in 10-HUMAN-UAT.md (status: resolved).
- [Phase 10]: 10-01 (VALID-01): read-only tuning-review CLI reuses ingest helpers (findMatchedAlbumTitles/defaultFamilyForAlbum made export-only), never touches the write path. Owner D-03 verdict: 9 Infest the Rats' Nest tracks (94/133/152/157/160/180/200/239/240) re-tagged standard→cs-standard (first non-empty cs-standard family); 12 canonical spot-checks + 36 no-album-default hand-tags confirmed as-is. Backtest top-k ZERO regression (tuning is a weak signal, ablation Δ≈0) — recorded in 10-HUMAN-UAT.md test #1 (pass)
- [Phase 11]: 11-01: replaced the masking 3-node era-prior fixture with a production-scale (~260-node, Σ playCount ~14k) matrix; the retired-song eraPriorFloor is proven unreachable on current code (returns ~0.996), RED until 11-03
- [Phase 11]: 11-03: PRED-02 eraPrior unit fix — allTimeRate is now career plays-per-show (`node.playCount / index.showCount`, new `MatrixIndex.showCount` off the matrix header, no rebuild) instead of the catalog-marginal `basePlayRate`; `eraPriorSmoothingK` rescaled 1→0.08 (per-show scale). Retired-song floor is now reachable — the 11-01 production-scale RED test flips GREEN. PRED-01/03: new pure DOM-free `currentRunShowSets(finalized, currentDate, cfg, resetBoundaryDate?)` groups prior finalized shows into the current run by calendar-day gap (`config.runGapDays: 2`), excludes shows ≥ reset boundary and ≥ currentDate, returns the `recentShowSongSets` window `rotationSuppression` (unchanged) is starved of. App wiring is 11-05. Deviation (Rule 1): fixed the 11-01 fixture HOT node career playCount 300→120 — 300/241≈1.24 plays/show was dimensionally impossible and made the corrected per-show ratio rightly <1; retired node + all thresholds untouched. Flag for backtest/human-verify gate: eraPriorSmoothingK=0.08, runGapDays=2. Full core suite 326 green.
- [Phase 11]: 11-04: app-tier completion of LIVE-01/LIVE-03. `useLatestPoll` callback WIDENED to `(result: PollResult) => void` (chosen over a second `onDrift` callback — one stable ref, drift coupled to its rows). `SyncDot` gained a third amber `#F59E0B` `schemaDrift` state — the ONLY interactive SyncDot state: a non-modal tap-for-detail inline popover rendering novel key NAMES only (never editor values), distinct aria-label, negative-margin tap target (no header shift). `ShowView` computes `guardedRows = guardLatestRows(latestRows, {showId,date})` ONCE at ingress and feeds it to diff/resolve/bind — single-filter, no consumer sees raw rows (a cached previous-night payload can no longer leak into night-2 suggestions). `?mockLatest=drift` injects `mock_novel_field` to exercise the amber path on-device. Full app suite 287 green, full repo 613 green — the 11-02 pollLatest signature ripple is fully resolved. DRIFT_AMBER=#F59E0B for device UAT.
- [Phase 11]: 11-02: three pure-core live-path fixes (LIVE-01/02/03). guardLatestRows is a once-at-ingress filter (bound→show_id, unbound→show's OWN date, never wall-clock so past-midnight sets survive). latestSetlistRow switched to `.catchall(z.unknown())` so an additive API key keeps the row usable; KNOWN_LATEST_KEYS derived from the schema's `.shape` (single source of truth) feeds a names-only detectNovelKeys. pollLatest now returns `PollResult { rows, schemaDrift, novelKeys? }` — drift aggregated into a Set and logged once/poll, never-throw soft-fail preserved. artist_id!==1 confirmed as the SOLE single-ingress filter, locked by a mixed-artist regression test. 11-04 must consume PollResult (useLatestPoll/mockLatest/app tests) and wire guardLatestRows once upstream of diff/resolve.

### Pending Todos

> **Tab naming (as of 2026-07-17, quick task 260716-wwj / commit `ba775f0`):** the visible bottom-tab labels are now **LiveGizz** (was Show), **GizzVerse** (was Explore), **GizzDex** (was Dex). Display labels only — routes (`show`/`explore`/`dex`), file paths (`src/show`/`src/explore`/`src/dex`), and component/type names are UNCHANGED, so code identifiers in the todos below still apply verbatim.

- [ui] **GizzVerse** (Explore) constellation: animate directional flow along edges (react-force-graph `linkDirectionalParticles`) so it's clear which song leads to which — `.planning/todos/pending/2026-07-17-gizzverse-animate-directional-flow-particles-along-constella.md`. Owner idea 2026-07-17; **flag: conflicts with settle-and-freeze battery design (EXPL-06)** — recommend focus-only particles + honor prefers-reduced-motion.
- [ui] **GizzVerse** (Explore) constellation legibility (RESEARCH): find a better way to render dense clusters — understandable now but super busy where many nodes interconnect — `.planning/todos/pending/2026-07-17-research-decluttering-dense-constellation-areas-in-gizzverse.md`. Owner request 2026-07-17. Force spacing (`CHARGE_STRENGTH -800`/`LINK_DISTANCE 180`) + edge slider already maxed; research **edge bundling, degree-aware local edge thinning (top-K per hub), focus-first progressive disclosure, clustered/community layout**. Keep single-pipeline + settle-and-freeze (EXPL-06); deliver a recommendation before building.
- [ui] **GizzVerse** (Explore) aesthetic: subtle animated "galaxy"/universe backdrop behind the nodes, built from gradients — ambient depth without distracting from nodes/functionality — `.planning/todos/pending/2026-07-17-animated-galaxy-gradient-backdrop-behind-gizzverse-nodes.md`. Owner idea 2026-07-17. MVP = CSS gradient layer behind the `ForceGraph2D` canvas (`ConstellationCanvas.tsx`/`ExploreView.tsx`); **must honor prefers-reduced-motion (static fallback), stay cheap (EXPL-06 battery), be pointer-events-none/aria-hidden, offline-safe, tunables in config.explore**. Option 2 = canvas `onRenderFramePre` for a pan/zoom-locked sky.
- [ui] Bottom sheets app-wide — animate up/down smoothly on open/close (scrim cross-fade, honor prefers-reduced-motion) AND make every sheet the top-most surface so no FAB/banner ever paints over an open sheet — `.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`. Owner request 2026-07-17. **Absorbs the retired Explore-FAB-over-menu bug** (`ExploreFilterFab` `z-30` vs `AppMenu` `z-20`) as one instance. Recommend a centralized z-index tier scale in config (no scattered magic numbers) + a shared BottomSheet animation (motion is already a dep); audit ALL `z-*` usages so the fix doesn't move the collision.
- [ui] Format full calendar dates app-wide as "Mon D, YYYY" (e.g. `Jan 2, 2026`) via one shared UTC-safe helper mirroring `formatMonYear.ts` — convert raw-ISO renders in ShowView header, ShowsList, SetlistView, ArchiveBrowser, RecapView subline, shareCard PNG — `.planning/todos/pending/2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md`. Owner idea 2026-07-17; **use `timeZone:"UTC"` to avoid off-by-one-day**; leave coarse Mon-Year (last-seen/year headers) unless owner wants otherwise.
- [ui] Rebrand tabs: Dex→GizzDex, Explore→GizzVerse, Show→LiveGizz (`BottomTabBar.tsx:5-7`) — **layer-1 (visible labels) DONE (260716-wwj / `ba775f0`)**; only optional layer-2 (internal code-identifier consistency) remains, deferred — `.planning/todos/pending/2026-07-17-rebrand-tabs-dex-to-gizzdex-explore-to-gizzverse-show-to-liv.md`. **Do NOT blind-rename route strings or persisted Dexie/storage keys** (breaks nav + orphans saved data) — decouple display name from route/storage key.
- [ui] ~~Final-show recap Share card shows **all-time GizzDex totals, not that night's show**~~ — **RESOLVED 2026-07-18** in Phase 10-02 (owner-directed inline fix during the VALID-02 device rehearsal, commit `3c09839`): new per-show recap Share card via core `buildRecapShareStats` off `deriveRecap` (six-tier rarity box, share-icon chrome; DexHeader all-time path preserved). `.planning/todos/pending/2026-07-18-final-show-share-card-uses-gizzdex-totals.md`.

**Bug fixes from 2026-07-19 research/bug-hunt session** (capture only — not yet built; each file carries full context + fix approach; run via /gsd-quick). Top 3 flagged pre-show (Aug 14):

- [bug] **HIGH, pre-show** — Wrong-show editor suggestions: no date guard + stale latestRows on night 2 of a run — `2026-07-19-fix-wrong-show-editor-suggestions-stale-latest-rows.md`
- [bug] **MED, pre-show** — End-Show auto-backup races finalize write; backup can capture show as "active" — `2026-07-19-fix-end-show-backup-race-with-finalize.md`
- [bug] **MED, pre-show** — Rotation suppression dead in live use (empty `recentFinalizedShowSongSets`) — `2026-07-19-wire-rotation-suppression-into-live-predictions.md`
- [bug] MED — eraPrior compares incommensurate rates; retired-song floor unreachable — `2026-07-19-fix-era-prior-unit-mismatch-dead-floor.md`
- [bug] MED — Same-date doubleheader shows collapsed in merge + dex derivation (+ midnight date-mismatch edge) — `2026-07-19-fix-same-date-doubleheader-collapse.md`
- [bug] MED — Live sync dies silently if kglw.net adds an API field (strict zod on live path) — `2026-07-19-guard-live-sync-against-strict-schema-drift.md`
- [bug] VERIFY — latest.json returns any tracked artist (Stu DJ set observed); audit artist filter on poll path — `2026-07-19-verify-artist-filter-on-latest-poll.md`
- [bug] MED-LOW — Top safe-area inset applied twice on notched iPhones (installed PWA) — `2026-07-19-fix-doubled-top-safe-area-inset.md`
- [bug] LOW-MED — "Backup saved" line renders before any backup exists (End Show dialog) — `2026-07-19-fix-premature-backup-saved-message.md`
- [bug] LOW-MED — Constellation camera snaps to zoom-to-fit on any container resize — `2026-07-19-stop-constellation-camera-snap-on-resize.md`
- [bug] LOW — Fill-hint position matching goes off-by-N after missed/deleted songs — `2026-07-19-fix-fill-hint-off-by-n-position-matching.md`
- [bug] LOW — Wake-lock acquire/release race leaves screen locked awake post-show — `2026-07-19-fix-wake-lock-acquire-release-race.md`
- [bug] LOW — Same-tick revokeObjectURL can silently abort downloads on iOS (backup + share card) — `2026-07-19-defer-revoke-object-url-on-downloads.md`

**Feature ideas from 2026-07-19 research session** (capture only — not yet built; each file carries full concept, evidence, and architecture mapping). Casual-friendly focus: bingo, Gizzle, primer, dossiers; recommended pre-show order: Residency Mode → Bingo/League → Gizzle:

- [feature] Residency Mode — no-repeat run awareness + songs-remaining pool + show-type flags — `2026-07-19-feature-residency-mode-no-repeat-run-awareness.md`
- [feature] Guezz League — pregame 5-pick prediction game, rarity-weighted, live scoring — `2026-07-19-feature-guezz-league-setlist-prediction-game.md`
- [feature] Gizz Bingo — auto-marking live bingo cards (casual +1 anchor) — `2026-07-19-feature-gizz-bingo-live-auto-marking-cards.md`
- [feature] Gizzle — daily clue-based song-guessing puzzle, date-seeded, offline — `2026-07-19-feature-gizzle-daily-song-guessing-puzzle.md`
- [feature] Couch Mode — read-only follow-from-home via existing latest.json poll — `2026-07-19-feature-couch-mode-follow-from-home.md`
- [feature] My Stats & Want List — rarest catches + most-common-not-caught — `2026-07-19-feature-my-stats-want-list.md`
- [feature] Shiny catches — special-version variant tiers (debuts/bustouts/20-min jams) — `2026-07-19-feature-shiny-catches-variant-tiers.md`
- [feature] Badge system with visible unearned badges (album completion, lanes, levels) — `2026-07-19-feature-badge-system-visible-gaps.md`
- [feature] Song Dossiers + unlockable Gizzverse lore codex — `2026-07-19-feature-song-dossiers-gizzverse-lore-codex.md`
- [feature] Know-Before-You-Go primer + predicted-setlist playlist — `2026-07-19-feature-know-before-you-go-primer-playlist.md`

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260713-w1c | SyncDot online state → hit-green (owner override of 05-UI-SPEC B3) | 2026-07-14 | c99ea42 | [260713-w1c-make-the-syncdot-render-green-22c55e-whe](./quick/260713-w1c-make-the-syncdot-render-green-22c55e-whe/) |
| 260713-wjd | ?mockLatest=1 UAT harness for the suggestion strip (found+fixed dismissal slot bug) | 2026-07-14 | (multiple) | [260713-wjd-add-mocklatest-1-url-flag-that-feeds-the](./quick/260713-wjd-add-mocklatest-1-url-flag-that-feeds-the/) |
| 260716-vw2 | Fix WARNING-1: own-backup restore misroutes to friend-compare on evicted DB (milestone audit) | 2026-07-17 | fcbfbdc | [260716-vw2-fix-warning-1-own-backup-restore-misrout](./quick/260716-vw2-fix-warning-1-own-backup-restore-misrout/) |
| 260716-wwj | Rebrand bottom-tab display labels: Dex→GizzDex, Explore→GizzVerse, Show→LiveGizz (labels only, routes/storage untouched) | 2026-07-17 | ba775f0 | [260716-wwj-rebrand-tab-display-names-dex-gizzdex-ex](./quick/260716-wwj-rebrand-tab-display-names-dex-gizzdex-ex/) |
| 260717-02n | LiveGizz page ambient background: blurred + dimmed randomized album cover (replaces flat color, body stays legible, offline) — resolves the blur-bg todo | 2026-07-17 | da50134 | [260717-02n-livegizz-page-blurred-dimmed-randomized-](./quick/260717-02n-livegizz-page-blurred-dimmed-randomized-/) |
| 260717-0s3 | GizzDex Albums always shows the full grayed shelf at zero catches (§B4 dimming); Mark-attended CTA now Shows-only — resolves the grayed-grid todo | 2026-07-17 | 48c45e1 | [260717-0s3-gizzdex-albums-always-show-the-full-albu](./quick/260717-0s3-gizzdex-albums-always-show-the-full-albu/) |
| 260717-0x9 | GizzDex header Share CTA → icon button top-right by the %; Albums/Shows toggle selected state brightened to full accent gold — resolves the header/toggle todo | 2026-07-17 | ed96dd8 | [260717-0x9-gizzdex-header-share-cta-icon-button-top](./quick/260717-0x9-gizzdex-header-share-cta-icon-button-top/) |
| 260717-1k3 | LiveGizz tracking screen: centered "Search for the opener" orb (tappable→Search), removed the blank strip bar (SHOW-02 preserved), End Show moved into the FAB as the last item — resolves the 4-tweak todo | 2026-07-17 | 8049e0a | [260717-1k3-livegizz-tracking-screen-center-opener-o](./quick/260717-1k3-livegizz-tracking-screen-center-opener-o/) |
| 260717-gvm | LiveGizz background crossfades to the selected next song's album cover (driven off `session.currentSongId`, covers orb-tap + search-select); art-less picks hold the current cover, pre-opener keeps the random ambient, reduced-motion swaps instantly, offline-safe | 2026-07-17 | e6f4cb0 | [260717-gvm-show-page-crossfade-blurred-background-t](./quick/260717-gvm-show-page-crossfade-blurred-background-t/) |
| 260717-ij8 | Pre-selection LiveGizz background cycles through DIFFERENT random album covers every 5s (`config.show.background.PRESHOW_CYCLE_MS`), reusing ShowBackground's crossfade; gated on no-song-selected + `!useReducedMotion()` + ≥2 covers, interval cleaned up the instant a song is picked | 2026-07-17 | f767a6d | [260717-ij8-pre-show-livegizz-background-cycles-rand](./quick/260717-ij8-pre-show-livegizz-background-cycles-rand/) |
| 260717-k1v | GizzDex shelf now responsive: DexView body + hold-frames widen `max-w-md sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl`; AlbumGrid `grid-cols-2` → `grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]` (still exactly 2 cols ≤414px, adds columns on wider screens). Tailwind-only, no functionality change; covers stay 80px. Drill-in overlays (AlbumDetail/ArchiveBrowser) left full-width as possible follow-up | 2026-07-17 | afd9caf | [260717-k1v-make-gizzdex-layout-responsive-widen-alb](./quick/260717-k1v-make-gizzdex-layout-responsive-widen-alb/) |
| 260717-hdr (fast) | Fix header-bar vertical centering: AppShell navbar + SearchSheet + ArchiveBrowser used bare `paddingTop:env(safe-area-inset-top)` which replaced the `py-3` top padding → 0 top / 12px bottom on desktop. Changed to `calc(env(safe-area-inset-top) + 12px)`, matching the 4 already-correct headers. Tailwind-only | 2026-07-17 | fe1d74b | — (gsd-fast) |
| 260717-cta (fast) | Pre-opener "Search for the opener" center orb → prominent pulsing CTA: solid `bg-accent text-surface` fill (was dashed outline), `.orb-breathe` pulse (motion-safe), sized from new `config.show.ORB_PROMPT_DIAMETER = 150` (separate from 116px `ORB_CENTER_DIAMETER`) + `p-4`. **Note: adds a new accent-fill use — intentional owner-requested primary-CTA treatment** | 2026-07-17 | a667d1e | — (gsd-fast) |
| 260717-flush (fast) | Body content now flush with the bottom tab bar (removed ~5px dead gap): BottomTabBar given a fixed `4rem` button-area height (safe-area gutter added below, border-box); AppShell `<main>` reservation made safe-area-aware `calc(4rem + env(safe-area-inset-bottom) + overlay)`. Flush on desktop + notched iOS; bottomOverlayInset.test green | 2026-07-17 | fd22b44 | — (gsd-fast) |
| 260717-kxs | Two orbit-view fixes: (1) vertically center the orbit GROUP — `orbitGroupOffset` in OrbitStage derives a `translateY` centering the center-orb+fan bounding box on cy (fixes the pentagon's top-heavy bbox / lopsided empty band below); orbitLayout.ts untouched, collapse-glide preserved, offset 0 pre-opener. (2) Comet-trail dots + FullSetlistSheet rings now colored by `tuningColor(family)` (matrix-resolved) to match the main orbs instead of hit-green/miss-red; ???/off-matrix → muted #A1A1AA. Main-view weak-fan dimming unchanged | 2026-07-17 | 16d4613 | [260717-kxs-center-the-orbit-group-vertically-recolo](./quick/260717-kxs-center-the-orbit-group-vertically-recolo/) |

| 260717-spread (fast) | Doubled the GizzVerse constellation spread per owner request: `config.explore.CHARGE_STRENGTH` -400→-800, `LINK_DISTANCE` 90→180. Overrides the 2026-07-16 device-tuned values (comments updated to reflect they're no longer device-verified) | 2026-07-17 | 6be13ca | — (gsd-fast) |
| 260717-n6a | Added **Epic** rarity tier + switched rarity from play-rate quantiles to **tie-inclusive playCount bands** (`config.dex.RARITY_BANDS`: legendary=1×, epic=2–3×, rare=4–8×, uncommon=9–23×, common=24×+). Retired `RARITY_QUANTILES` + `RARITY_MIN_PLAYS` (1-play songs are now Legendary — the old cap made Legendary structurally empty). Rippled Epic through all exhaustive consumers (compare.ts rank, share-stats/RecapView TIER_ORDER, tierLabels, both TIER_COLOR maps @ `#FB923C`). Real-corpus tally 32/29/32/62/109=264 verified; 498 tests green. **Deferred: the two `TIER_COLOR` maps stay duplicated — folds into the pending recolor todo** | 2026-07-17 | 4cd2f31 | [260717-n6a-add-epic-rarity-tier-switch-rarity-from-](./quick/260717-n6a-add-epic-rarity-tier-switch-rarity-from-/) |
| 260717-onl | Recolored the rarity tier chips + **consolidated** both duplicate `TIER_COLOR` maps into one source `config.dex.tierColors` (imported by `TierBadge.tsx` + `shareCard.ts`). New scheme: debut gray **dotted** outline, common `#E4E4E7` soft-white, uncommon `#34D399` emerald (distinct from caught-green `#22C55E`), rare `#60A5FA` blue, epic `#A855F7` purple, legendary `#FB923C` orange. **Wordmark decoupled** to fixed `config.share.wordmarkGold` `#F2C14E` (no longer follows legendary→orange). Resolves + closes the recolor todo. App typecheck clean, 16 tests green | 2026-07-17 | 6408d46 | [260717-onl-recolor-rarity-tier-chips-consolidate-ti](./quick/260717-onl-recolor-rarity-tier-chips-consolidate-ti/) |
| 260717-p4s | Mapped the 5 rarity-tier colors onto LiveGizz **prediction orbs** (fan + center current-song orb + ripples) and the **chronological** comet-trail dots / full-setlist rings — switched from tuning-family to rarity color so rarity reads at a glance; ???/off-matrix → neutral debut gray. **Componentized** rarity styling into one UI primitive `packages/app/src/dex/rarityStyle.ts` (`rarityColor` / `rarityTierForSong` / `RARITY_ORB_TEXT_COLOR`) — now the ONLY app expression indexing `config.dex.tierColors`; refactored `TierBadge.tsx` + `shareCard.ts` onto it (byte-identical colors) so GizzDex/recap/compare/setlist chips + share card + orbs all share one source. Near-black on-orb text (`#0C0C10`) verified ≥4.5:1 on all 6 hues. Explore/GizzVerse constellation left tuning-colored (distinct language). 502 tests green, app tsc clean | 2026-07-17 | 8618da4 | [260717-p4s-map-rarity-colors-to-prediction-orbs-and](./quick/260717-p4s-map-rarity-colors-to-prediction-orbs-and/) |
| 260717-ry0 | Declutter GizzVerse constellation via **degree-aware top-K-per-node** edge sparsification (research-backed: 1041 edges @ old global `count≥2` → 332 @ top-2, hubs max-degree 107 capped locally). New pure-core `topKEdgesPerNode(links, k)` beside `edgesAtThreshold` (+6 fixtures: hub-cap, leaf-keep-all, tie-break, k=1, k≥maxdeg, reciprocal-both-survive). Edge slider re-semantic'd **"Top N per song"** (range 1–5, default 2); core config renamed `EDGE_COUNT_THRESHOLD_*`→`TOP_K_PER_NODE_*`, app mirror + `configMirror.test` in sync; prop `edgeThreshold`→`topK` through ExploreView/Fab/Panel. Canvas: memoized kept-link `Set` (survival depends on siblings), **focus-exempt** predicate reveals a focused node's FULL neighborhood, native `linkCurvature` (`LINK_CURVATURE 0.2`) bows the ~292 reciprocal pairs apart. Pure render-pass — no graphData rebuild/reheat, frozen fx/fy preserved (EXPL-06). 276 core + 232 app tests green, both tsc clean | 2026-07-18 | 0aaf097 | [260717-ry0-declutter-the-gizzverse-constellation-wi](./quick/260717-ry0-declutter-the-gizzverse-constellation-wi/) |
| 260717-ual | Added a **2D depth stack** to the GizzVerse constellation (kept react-force-graph-2d, no three.js), spike-validated first ([spike 001](./spikes/001-constellation-depth-shading/)). Core: synthetic `z = √play/√maxPlay` on `ConstellationNode` + **far→near occlusion sort** in `deriveConstellation` (verified force-graph paints in array order). App: new pure `explore/depthColor.ts` (`parseColor`/`mixColor`/`fadeToward`/`sphereGradient` — handles BOTH `#hex` and `rgb()`, spike bug #1) drives a **spherical-shaded** draw pass (highlight→base→shadow orbs), **depth-scaling** of radius+opacity+fade-toward-#0C0C10 that ALSO shades the grayscale/unseen path (spike finding #2; depth alpha folds in via gentle multiply + `DEPTH_ALPHA_FLOOR` so far+dimmed nodes never vanish), and **depth-weighted edges**. **Nebula parallax**: `ExploreBackground` takes a damped `parallax` transform driven by the canvas `onZoom` — interaction-driven GPU compositor transform, reduced-motion-gated, respects `autoPauseRedraw`/EXPL-06. 22px tap floor kept on the UNSCALED radius. All tunables in new `config.explore.depth` + `background.PARALLAX_*` (`[ASSUMED]`); no core-config/mirror churn. 11 core + 10 depthColor + 242 app tests green, both tsc clean. **Owner follow-up: on-device eyeball of the ball look / occlusion / depth-edge subtlety / parallax feel on iPhone** | 2026-07-18 | 8658b39 | [260717-ual-add-2d-depth-to-the-gizzverse-constellat](./quick/260717-ual-add-2d-depth-to-the-gizzverse-constellat/) |
| 260717-pxf (fast) | Fixed the GizzVerse nebula **parallax revealing the star-field's rectangular edge** on shift: gave the layer constant px **overscan** (`config.explore.background.PARALLAX_OVERSCAN_PX` 56 → negative inset on every side, replacing `inset-0`) and **clamped** the transform (`PARALLAX_MAX_TRANSLATE_PX` 40 on \|x\|,\|y\|; scale `Math.max(1, k)` so zoom-out never shrinks below the viewport). Overscan > clamp ⇒ a shift can never drag the edge on-screen; applied always so first pan doesn't pop composition. Reduced-motion-gated + EXPL-06-safe unchanged. App tsc clean | 2026-07-18 | df66496 | — (gsd-fast) |
| 260717-glx (fast) | Enriched the GizzVerse galaxy backdrop: replaced the 6-dot 260px **tiled** speck field with a **randomized non-tiled star field** (`SPECK_COUNT` 90 dots at random positions, per-speck **brightness** [`SPECK_BRIGHTNESS_MIN/MAX`] + size [`SPECK_SIZE_MIN/MAX_PX`] variance) generated once per mount via `useMemo` (fresh sky each visit, no re-render jump); made the nebula feel **alive** — widened bloom drift ~2.5× (`driftXPct/YPct`), bumped `PULSE_SCALE` 1.07→1.12, and added an opacity **breathe** (`PULSE_OPACITY` 0.68, new keyframe channel). All tunables in `config.explore.background`; motion still transform/opacity-only + gated on `prefers-reduced-motion: no-preference` (EXPL-06 intact). App tsc clean, 232 tests green | 2026-07-18 | 391b81c | — (gsd-fast) |
| 260717-sjg | Added a subtle animated **galaxy nebula backdrop** behind the GizzVerse constellation (todo MVP = CSS/DOM layer, not canvas). New `packages/app/src/explore/ExploreBackground.tsx` — aria-hidden + pointer-events-none + absolute-inset-0, 3 low-opacity radial-gradient blooms (violet/indigo/teal) + a static star-speck field, zero state/effects/per-frame JS, offline-safe (no assets). Rendered as first child of the `bg-surface` wrapper behind `<ForceGraph2D>`, whose `backgroundColor` flipped `#0c0c10`→transparent `rgba(0,0,0,0)` so the nebula shows through (wrapper keeps the opaque base — no white-flash). `styles.css` `@keyframes explore-bg-bloom` (transform-only drift) gated ONLY inside `@media (prefers-reduced-motion: no-preference)` — static by default, EXPL-06 untouched. All tunables in `config.explore.background` (`[ASSUMED]`). No core changes. App tsc clean, 232 tests green. **Owner follow-up: on-device confirm subtlety + focus-dim/Dex-dim legibility over the blooms; Option 2 (pan/zoom-locked canvas sky) documented as future escalation** | 2026-07-18 | 08abf39 | [260717-sjg-animated-galaxy-gradient-backdrop-behind](./quick/260717-sjg-animated-galaxy-gradient-backdrop-behind/) |
| 260718-1no | Pre-opener **"Search for the opener" now auto-populates** the SearchSheet with the **top-5 recency-weighted popular show openers** (before the user types). New pure-core `deriveTopOpeners(shows, songs, {asOfDate, halfLifeDays, limit})` in `packages/core/src/dex/openers.ts` (+ 8-test fixture): opener = first songId of each show's Set 1 (`n:"1"`), ranked by summed `decayedWeight(showDate, asOfDate, halfLifeDays)` (reuses the matrix's D-10 recency decay), anchored on `archive.latestShowDate` (pure — no Date.now), deterministic tie-break (score desc → count desc → songId asc). App: memoized `getOpenerSuggestions()` wrapper (`show/openerSuggestions.ts`) over `loadArchive()`; `SearchSheet` gains an `openerSuggestions?` prop + empty-query render branch (heading `config.copy.show.openerSuggestionsHeading`, rows reuse existing `handleSelect` → same `onSelect→handleSearchSelect→logSong` path); `ShowView` passes it ONLY pre-opener (`session.currentSongId === null`) so mid-show empty search stays blank. Count in `config.show.OPENER_SUGGESTION_COUNT = 5`, halfLife from core config (no mirror). Real top-5: Phantom Island / The Dripping Tap / Mars For the Rich / Gaia / Theia. Both tsc clean, 527 tests green | 2026-07-18 | 3421b20 | [260718-1no-auto-populate-opener-search-with-top-5-r](./quick/260718-1no-auto-populate-opener-search-with-top-5-r/) |
| 260718-12j | GizzVerse constellation song-name labels now always paint **on top of** the edge/path lines and other orbs. react-force-graph-2d draws nodes one-at-a-time (fill+label per node), so a label could be overpainted by a later node's orb or sit under edge lines. Moved the "5. Label" block out of `nodeCanvasObject` into a `drawNodeLabel(node, ctx, globalScale)` helper called from `onRenderFramePost` — which runs AFTER all links/arrows/nodes in the same world transform. Helper replicates the node pass's exact per-node state (re-added `!isNodeVisible` guard since `onRenderFramePost` loses the `nodeVisibility` filter, null x/y skip, depth-scaled radius, combined `max(DEPTH_ALPHA_FLOOR, min(focusAlpha,dexAlpha)*depthAlpha)`, identical zoom/top-K/focus-forced `showLabel` gate + font/color/ellipsize/fillText). Rings, count pills, dex overlay, focus/camera/settle-freeze all untouched. Pure render-layering change — no graphData rebuild, no d3 reheat, no fx/fy change. App tsc clean | 2026-07-18 | ce6ef27 | [260718-12j-constellation-labels-render-on-top-of-ed](./quick/260718-12j-constellation-labels-render-on-top-of-ed/) |
| 260718-dex (fast) | Doubled the GizzDex completion headline font size (`{caught}/{total} · {pct}%` top-of-page stat in `DexHeader.tsx`): `text-[28px]` → `text-[56px]`. Tailwind-only, no logic change. App tsc clean | 2026-07-18 | 63db837 | — (gsd-fast) |

### Blockers/Concerns

- [Phase 1] Open schema items to instrument during full corpus ingest: multi-set `setnumber` representation, `transition_id: 4` meaning, tease notation location, silent filter-ignore gotcha
- [Phase 4] iOS PWA lifecycle spike — RESOLVED 2026-07-13. All six on-device SHOW-12/SHOW-13 checks (wake-lock hold + silent reacquire + gesture suppression + weak-fan softening + force-quit restore + End Show finalize) PASSED on iPhone 16 Pro, iOS 26.3.1. See 04-HUMAN-UAT.md (status: resolved) and 04-VERIFICATION.md (status: passed). Residual non-blocking gap: the iOS <18.4 wake-lock false-positive fallback path was not exercised (test device is 26.3.1); logic is unit-covered — close out opportunistically if a pre-18.4 device becomes available.
- [Phase 7] Canvas label rendering quality at ~250 nodes on small screens — RESOLVED 2026-07-16 (plan 07-03 device spike on iPhone 16 Pro). Top-8 at-rest labels legible, 1.5/2.5 zoom thresholds and settle-freeze confirmed; the deeper cause (d3-force defaults clumping ~264 nodes) was found and fixed via device-tuned CHARGE_STRENGTH/LINK_DISTANCE + on-load zoomToFit auto-framing + enableNodeDrag=false for clean pinch. See 07-03-SUMMARY.md.

## Deferred Items

Items acknowledged and deferred at **v1.1 milestone close on 2026-07-19** (owner-approved [A] Acknowledge-all). The pre-close audit flagged 16 open artifacts; all are benign — completed-but-unmarked, superseded, or intentionally deferred to v2. None blocking. The 3 genuine v2 UI todos carry into the next milestone.

| Category | Item | Status |
|----------|------|--------|
| debug | knowledge-base | not-a-defect (resolved-sessions index, false alarm — same as v1.0 close) |
| verification | Phase 01: 01-VERIFICATION.md (human_needed) | superseded — the DATA-04 tuning spot-check was resolved by VALID-01 (Phase 10) |
| quick_task | 260717-gvm (LiveGizz crossfade background) | complete (SUMMARY on file; no parseable completion marker) |
| quick_task | 260717-ij8 (pre-show background cycle) | complete (SUMMARY on file) |
| quick_task | 260717-k1v (GizzDex responsive layout) | complete (SUMMARY on file) |
| quick_task | 260717-kxs (orbit centering + recolor) | complete (SUMMARY on file) |
| quick_task | 260717-n6a (Epic rarity tier) | complete (SUMMARY on file) |
| quick_task | 260717-onl (recolor rarity chips) | complete (SUMMARY on file) |
| quick_task | 260717-p4s (rarity colors on orbs) | complete (SUMMARY on file) |
| quick_task | 260717-sjg (galaxy backdrop) | complete (SUMMARY on file) |
| quick_task | 260718-12j (constellation labels on top) | complete (SUMMARY on file) |
| quick_task | 260718-1no (auto-populate opener search) | complete (SUMMARY on file) |
| todo/ui | 2026-07-17-gizzverse-animate-directional-flow-particles | pending — genuine v2 UI idea (conflicts with settle-and-freeze; carry to v2) |
| todo/ui | 2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top | pending — genuine v2 UI idea (carry to v2) |
| todo/ui | 2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide | pending — genuine v2 UI idea (carry to v2) |
| todo/ui | 2026-07-18-final-show-share-card-uses-gizzdex-totals | resolved 2026-07-18 in Phase 10-02 (per-show recap share card, `3c09839`) — stale flag |

---

Items acknowledged and deferred at v1.0 milestone close on 2026-07-17 (owner-approved). The four non-blocking items below were scoped into v1.1 (Phases 8–10) and are now resolved:

| Category | Item | Status | Deferred At | v1.1 Mapping |
|----------|------|--------|-------------|--------------|
| debug | knowledge-base (resolved-sessions index, not an open session — false alarm) | not-a-defect | 2026-07-17 | — |
| verification | Phase 01 tuning-tag spot-check (DATA-04 human_needed; ~10-song sanity pass) | human_needed | 2026-07-17 | VALID-01 (Phase 10) |
| todo/ui | orb song-name text truncated/oversized (esp. center orb) | resolved 2026-07-18 (Phase 8, circle-aware fit + on-device retest pass) | 2026-07-17 | POLISH-01 (Phase 8) |
| todo/ui | collapse Show-Mode actions into FAB menu | resolved | 2026-07-18 | POLISH-02 (Phase 8) |
| research/ui-model | Reconcile orb % (prediction confidence) vs rarity color (global frequency) — legendary orb can out-% a common one. Mechanics + option space parked, no change decided. See [260717-p4s-FOLLOWUP-orb-percent-vs-rarity.md](./quick/260717-p4s-map-rarity-colors-to-prediction-orbs-and/260717-p4s-FOLLOWUP-orb-percent-vs-rarity.md) | parked | 2026-07-17 | TBD |
| todo/pwa | InstallBanner should show once per version, not every reload | resolved | 2026-07-18 | POLISH-02 (Phase 8) |
| integration/warning | WARNING-1 own-backup restore fork — **FIXED** in quick 260716-vw2 (not deferred) | resolved | 2026-07-17 | PWA-05 polishes it (Phase 9) |

## Session Continuity

Last session: 2026-07-19T21:12:00Z
Stopped at: Completed 11-04-PLAN.md (Wave 3 — 11-05 unblocked: needs 11-03 ✓ + 11-04 ✓)
Resume file: .planning/phases/11-live-sync-prediction-correctness/11-CONTEXT.md

## Operator Next Steps

- v1.1 milestone complete, archived, and tagged (`v1.1`). Both v1.0 and v1.1 shipped; the app is show-ready for the first show (late Aug/Sep 2026).
- No milestone in progress. To start the next one: `/clear` then `/gsd-new-milestone` (v2 backlog in PROJECT.md ## Next Milestone — set-position signal, album-genre experiment, Explore era-slider, shared setlists, + 3 carried UI todos).
- Push the tag when ready: `git push origin v1.1` (asked at close; push separately if declined).
