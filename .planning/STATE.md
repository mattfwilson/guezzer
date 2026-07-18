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
Last activity: 2026-07-18 — Completed quick task 260717-ual: added a 2D depth stack to the GizzVerse constellation (spherical shading, playCount depth-scaling incl. the grayscale path, far→near occlusion, depth-weighted edges, onZoom nebula parallax) — spike-validated first

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

> **Tab naming (as of 2026-07-17, quick task 260716-wwj / commit `ba775f0`):** the visible bottom-tab labels are now **LiveGizz** (was Show), **GizzVerse** (was Explore), **GizzDex** (was Dex). Display labels only — routes (`show`/`explore`/`dex`), file paths (`src/show`/`src/explore`/`src/dex`), and component/type names are UNCHANGED, so code identifiers in the todos below still apply verbatim.

- [ui] **GizzVerse** (Explore) constellation: animate directional flow along edges (react-force-graph `linkDirectionalParticles`) so it's clear which song leads to which — `.planning/todos/pending/2026-07-17-gizzverse-animate-directional-flow-particles-along-constella.md`. Owner idea 2026-07-17; **flag: conflicts with settle-and-freeze battery design (EXPL-06)** — recommend focus-only particles + honor prefers-reduced-motion.
- [ui] **GizzVerse** (Explore) constellation legibility (RESEARCH): find a better way to render dense clusters — understandable now but super busy where many nodes interconnect — `.planning/todos/pending/2026-07-17-research-decluttering-dense-constellation-areas-in-gizzverse.md`. Owner request 2026-07-17. Force spacing (`CHARGE_STRENGTH -800`/`LINK_DISTANCE 180`) + edge slider already maxed; research **edge bundling, degree-aware local edge thinning (top-K per hub), focus-first progressive disclosure, clustered/community layout**. Keep single-pipeline + settle-and-freeze (EXPL-06); deliver a recommendation before building.
- [ui] **GizzVerse** (Explore) aesthetic: subtle animated "galaxy"/universe backdrop behind the nodes, built from gradients — ambient depth without distracting from nodes/functionality — `.planning/todos/pending/2026-07-17-animated-galaxy-gradient-backdrop-behind-gizzverse-nodes.md`. Owner idea 2026-07-17. MVP = CSS gradient layer behind the `ForceGraph2D` canvas (`ConstellationCanvas.tsx`/`ExploreView.tsx`); **must honor prefers-reduced-motion (static fallback), stay cheap (EXPL-06 battery), be pointer-events-none/aria-hidden, offline-safe, tunables in config.explore**. Option 2 = canvas `onRenderFramePre` for a pan/zoom-locked sky.
- [ui] Bottom sheets app-wide — animate up/down smoothly on open/close (scrim cross-fade, honor prefers-reduced-motion) AND make every sheet the top-most surface so no FAB/banner ever paints over an open sheet — `.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`. Owner request 2026-07-17. **Absorbs the retired Explore-FAB-over-menu bug** (`ExploreFilterFab` `z-30` vs `AppMenu` `z-20`) as one instance. Recommend a centralized z-index tier scale in config (no scattered magic numbers) + a shared BottomSheet animation (motion is already a dep); audit ALL `z-*` usages so the fix doesn't move the collision.
- [ui] Format full calendar dates app-wide as "Mon D, YYYY" (e.g. `Jan 2, 2026`) via one shared UTC-safe helper mirroring `formatMonYear.ts` — convert raw-ISO renders in ShowView header, ShowsList, SetlistView, ArchiveBrowser, RecapView subline, shareCard PNG — `.planning/todos/pending/2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md`. Owner idea 2026-07-17; **use `timeZone:"UTC"` to avoid off-by-one-day**; leave coarse Mon-Year (last-seen/year headers) unless owner wants otherwise.
- [ui] Rebrand tabs: Dex→GizzDex, Explore→GizzVerse, Show→LiveGizz (`BottomTabBar.tsx:5-7`) — **layer-1 (visible labels) DONE (260716-wwj / `ba775f0`)**; only optional layer-2 (internal code-identifier consistency) remains, deferred — `.planning/todos/pending/2026-07-17-rebrand-tabs-dex-to-gizzdex-explore-to-gizzverse-show-to-liv.md`. **Do NOT blind-rename route strings or persisted Dexie/storage keys** (breaks nav + orphans saved data) — decouple display name from route/storage key.

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
| 260717-glx (fast) | Enriched the GizzVerse galaxy backdrop: replaced the 6-dot 260px **tiled** speck field with a **randomized non-tiled star field** (`SPECK_COUNT` 90 dots at random positions, per-speck **brightness** [`SPECK_BRIGHTNESS_MIN/MAX`] + size [`SPECK_SIZE_MIN/MAX_PX`] variance) generated once per mount via `useMemo` (fresh sky each visit, no re-render jump); made the nebula feel **alive** — widened bloom drift ~2.5× (`driftXPct/YPct`), bumped `PULSE_SCALE` 1.07→1.12, and added an opacity **breathe** (`PULSE_OPACITY` 0.68, new keyframe channel). All tunables in `config.explore.background`; motion still transform/opacity-only + gated on `prefers-reduced-motion: no-preference` (EXPL-06 intact). App tsc clean, 232 tests green | 2026-07-18 | 391b81c | — (gsd-fast) |
| 260717-sjg | Added a subtle animated **galaxy nebula backdrop** behind the GizzVerse constellation (todo MVP = CSS/DOM layer, not canvas). New `packages/app/src/explore/ExploreBackground.tsx` — aria-hidden + pointer-events-none + absolute-inset-0, 3 low-opacity radial-gradient blooms (violet/indigo/teal) + a static star-speck field, zero state/effects/per-frame JS, offline-safe (no assets). Rendered as first child of the `bg-surface` wrapper behind `<ForceGraph2D>`, whose `backgroundColor` flipped `#0c0c10`→transparent `rgba(0,0,0,0)` so the nebula shows through (wrapper keeps the opaque base — no white-flash). `styles.css` `@keyframes explore-bg-bloom` (transform-only drift) gated ONLY inside `@media (prefers-reduced-motion: no-preference)` — static by default, EXPL-06 untouched. All tunables in `config.explore.background` (`[ASSUMED]`). No core changes. App tsc clean, 232 tests green. **Owner follow-up: on-device confirm subtlety + focus-dim/Dex-dim legibility over the blooms; Option 2 (pan/zoom-locked canvas sky) documented as future escalation** | 2026-07-18 | 08abf39 | [260717-sjg-animated-galaxy-gradient-backdrop-behind](./quick/260717-sjg-animated-galaxy-gradient-backdrop-behind/) |

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
| research/ui-model | Reconcile orb % (prediction confidence) vs rarity color (global frequency) — legendary orb can out-% a common one. Mechanics + option space parked, no change decided. See [260717-p4s-FOLLOWUP-orb-percent-vs-rarity.md](./quick/260717-p4s-map-rarity-colors-to-prediction-orbs-and/260717-p4s-FOLLOWUP-orb-percent-vs-rarity.md) | parked | 2026-07-17 | TBD |
| todo/pwa | InstallBanner should show once per version, not every reload | pending | 2026-07-17 | POLISH-02 (Phase 8) |
| integration/warning | WARNING-1 own-backup restore fork — **FIXED** in quick 260716-vw2 (not deferred) | resolved | 2026-07-17 | PWA-05 polishes it (Phase 9) |

## Session Continuity

Last session: 2026-07-17T02:57:40.986Z
Stopped at: v1.1 roadmap created — 9 requirements mapped to Phases 8–10; ROADMAP.md, REQUIREMENTS.md traceability, and STATE.md counters updated
Resume file: .planning/ROADMAP.md

## Operator Next Steps

- Plan the first v1.1 phase with `/gsd-plan-phase 8`
