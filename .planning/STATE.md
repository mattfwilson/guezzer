---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Polish & Pre-Show Hardening
status: planning
last_updated: "2026-07-17T03:19:53.864Z"
last_activity: 2026-07-17
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-17 after v1.0 milestone)

**Core value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.
**Current focus:** v1.1 Polish & Pre-Show Hardening roadmapped (Phases 8–10) — ready to plan Phase 8 (`/gsd-plan-phase 8`)

## Current Position

Phase: Not started — v1.1 roadmap defined (Phases 8–10)
Plan: —
Status: Roadmap complete; awaiting phase planning
Last activity: 2026-07-17 — Milestone v1.1 roadmapped (9 requirements → Phases 8–10)

## Performance Metrics

**Velocity:**

- Total plans completed: 70
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 5 | - | - |
| 04 | 7 | - | - |
| 05 | 6 | - | - |
| 06 | 12 | - | - |

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

### Pending Todos

- [ui] Fix truncated/oversized song-name text inside prediction orbs (esp. center current-song orb) — `.planning/todos/pending/2026-07-11-orb-song-name-text-truncated-and-oversized.md`. Non-blocking UI-polish; found on-device during Phase 04 device gate. **→ v1.1 POLISH-01 (Phase 8).**
- [ui/pwa] InstallBanner should show once per app version, not on every reload — `.planning/todos/pending/2026-07-14-install-banner-reappears-every-reload.md`. Non-blocking; owner-reported during Phase 05 UAT Test 3 setup. **→ v1.1 POLISH-02 (Phase 8).**
- [ui] Consolidate Show-Mode actions (Search/Unknown/Set break/Encore/Undo) into a collapsed-by-default bottom-right FAB menu to free vertical space for the orbit — `.planning/todos/pending/2026-07-14-collapse-show-actions-into-fab-menu.md`. Owner idea 2026-07-14; note the zero-tap ???/Undo trade-off flagged inside. **→ v1.1 POLISH-02 (Phase 8, verify-and-resolve).**
- [ui] Blur + dim a randomized album cover as the Show screen background (replace flat color) while keeping body buttons/text legible — `.planning/todos/pending/2026-07-17-blur-a-random-album-cover-as-the-show-screen-background.md`. Owner idea 2026-07-17; visual-polish for Show Mode, must stay offline + accessible.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260713-w1c | SyncDot online state → hit-green (owner override of 05-UI-SPEC B3) | 2026-07-14 | c99ea42 | [260713-w1c-make-the-syncdot-render-green-22c55e-whe](./quick/260713-w1c-make-the-syncdot-render-green-22c55e-whe/) |
| 260713-wjd | ?mockLatest=1 UAT harness for the suggestion strip (found+fixed dismissal slot bug) | 2026-07-14 | (multiple) | [260713-wjd-add-mocklatest-1-url-flag-that-feeds-the](./quick/260713-wjd-add-mocklatest-1-url-flag-that-feeds-the/) |
| 260716-vw2 | Fix WARNING-1: own-backup restore misroutes to friend-compare on evicted DB (milestone audit) | 2026-07-17 | fcbfbdc | [260716-vw2-fix-warning-1-own-backup-restore-misrout](./quick/260716-vw2-fix-warning-1-own-backup-restore-misrout/) |

### Blockers/Concerns

- [Phase 1] Open schema items to instrument during full corpus ingest: multi-set `setnumber` representation, `transition_id: 4` meaning, tease notation location, silent filter-ignore gotcha
- [Phase 4] iOS PWA lifecycle spike — RESOLVED 2026-07-13. All six on-device SHOW-12/SHOW-13 checks (wake-lock hold + silent reacquire + gesture suppression + weak-fan softening + force-quit restore + End Show finalize) PASSED on iPhone 16 Pro, iOS 26.3.1. See 04-HUMAN-UAT.md (status: resolved) and 04-VERIFICATION.md (status: passed). Residual non-blocking gap: the iOS <18.4 wake-lock false-positive fallback path was not exercised (test device is 26.3.1); logic is unit-covered — close out opportunistically if a pre-18.4 device becomes available.
- [Phase 7] Canvas label rendering quality at ~250 nodes on small screens — RESOLVED 2026-07-16 (plan 07-03 device spike on iPhone 16 Pro). Top-8 at-rest labels legible, 1.5/2.5 zoom thresholds and settle-freeze confirmed; the deeper cause (d3-force defaults clumping ~264 nodes) was found and fixed via device-tuned CHARGE_STRENGTH/LINK_DISTANCE + on-load zoomToFit auto-framing + enableNodeDrag=false for clean pinch. See 07-03-SUMMARY.md.

## Deferred Items

Items acknowledged and deferred at v1.0 milestone close on 2026-07-17 (owner-approved). The four non-blocking items below are now scoped into v1.1 (Phases 8–10):

| Category | Item | Status | Deferred At | v1.1 Mapping |
|----------|------|--------|-------------|--------------|
| debug | knowledge-base (resolved-sessions index, not an open session — false alarm) | not-a-defect | 2026-07-17 | — |
| verification | Phase 01 tuning-tag spot-check (DATA-04 human_needed; ~10-song sanity pass) | human_needed | 2026-07-17 | VALID-01 (Phase 10) |
| todo/ui | orb song-name text truncated/oversized (esp. center orb) | pending | 2026-07-17 | POLISH-01 (Phase 8) |
| todo/ui | collapse Show-Mode actions into FAB menu | pending | 2026-07-17 | POLISH-02 (Phase 8) |
| todo/pwa | InstallBanner should show once per version, not every reload | pending | 2026-07-17 | POLISH-02 (Phase 8) |
| integration/warning | WARNING-1 own-backup restore fork — **FIXED** in quick 260716-vw2 (not deferred) | resolved | 2026-07-17 | PWA-05 polishes it (Phase 9) |

## Session Continuity

Last session: 2026-07-17T02:57:40.986Z
Stopped at: v1.1 roadmap created — 9 requirements mapped to Phases 8–10; ROADMAP.md, REQUIREMENTS.md traceability, and STATE.md counters updated
Resume file: .planning/ROADMAP.md

## Operator Next Steps

- Plan the first v1.1 phase with `/gsd-plan-phase 8`
