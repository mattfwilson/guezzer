---
phase: 06-pok-dex-history-stats
plan: 09
subsystem: app-recap-history
tags: [recap, show-history, setlist, pokedex, react, dexie, tdd, show-14, stat-02, hist-01]

# Dependency graph
requires:
  - phase: 06-pok-dex-history-stats
    plan: 03
    provides: "deriveRecap / RecapStats (tally, source split, new catches, rarity, set-structured setlist) — RecapView renders it; buildRarityIndex tiers"
  - phase: 06-pok-dex-history-stats
    plan: 08
    provides: "archiveShows join + dual-source marked-state + row idiom; ArchiveBrowser reachable from Shows segment"
  - phase: 06-pok-dex-history-stats
    plan: 06
    provides: "DexView surface + segment control + album drill-in state; TierBadge; getRarityIndex; loaders"
  - phase: 04-show-mode
    provides: "ShowView !session.active early return (Pattern 6 seam); EndShowDialog handleConfirm; CometTrail hit/miss ring hexes"
provides:
  - "RecapView — the post-show payoff screen rendering pure core RecapStats (hero tally, source split, rarity block, +N new, ringed setlist, Done)"
  - "ShowsList + buildShowRows — attended shows newest-first, tracked+retro unified/deduped, tally chip on tracked (D-16)"
  - "SetlistView — retro-marked show's plain set-structured setlist (Set 1/2/Encore), archive-then-cache source (HIST-01)"
  - "EndShowDialog.onEnded seam + ShowView recapSessionId — End Show auto-opens the recap before the pre-show early return (D-13)"
affects: [06-11 recap Share-card CTA slots into the recap footer + DexHeader]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RecapView renders pure core RecapStats — zero stat arithmetic in the component (tier-chip counting is display aggregation, not tally/percentage)"
    - "buildShowRows reuses the deriveDex/merge group-key rule (bound→show_id, unbound→date) so the history list dedupe matches the dex derivation exactly"
    - "Dexie-single-source: ShowsList/RecapView/SetlistView useLiveQuery + useMemo derive; no stored rows, drill-in is component state (no new hash route)"
    - "Load-bearing early-return order (Pattern 6): recapSessionId check precedes ShowView's !session.active return so the payoff screen is not swallowed"
    - "TDD RED→GREEN per task: failing test committed, then implementation"

key-files:
  created:
    - packages/app/src/dex/RecapView.tsx
    - packages/app/src/dex/ShowsList.tsx
    - packages/app/src/dex/SetlistView.tsx
    - packages/app/test/recapView.test.tsx
    - packages/app/test/showsList.test.tsx
  modified:
    - packages/app/src/config.ts
    - packages/app/src/dex/DexView.tsx
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/show/EndShowDialog.tsx
    - packages/app/test/dexView.test.tsx

key-decisions:
  - "RecapView + SetlistView do their own useLiveQuery (matching the useDexStats/useShowSession idiom) while DexView owns the openShow drill-in routing state — keeps DexView lean and each view self-contained/testable"
  - "buildShowRows is an exported pure fn (app-side join of db shapes + archive) mirroring the core-derivation ethos; the Shows list is derived, never stored"
  - "config.copy.dex.setLabels is shared by RecapView and SetlistView (added in the RecapView commit since it lands first) so the two set-structure surfaces never disagree on a set name"
  - "Tier chips ×count computed in RecapView by aggregating core-supplied per-row tiers (deriveRecap exposes score + rarestOfNight, not per-tier counts) — a display grouping, not stat math"

requirements-completed: [SHOW-14, STAT-02, HIST-01]

# Metrics
duration: 7min
completed: 2026-07-15
---

# Phase 6 Plan 09: Recap & Show History Summary

**The night's scorecard and the collection's memory: `RecapView` (auto-shown the instant End Show finalizes, and reachable forever from history) renders the pure core `RecapStats` — hero tally, Your-calls-vs-Editor-assists source split, rarity block (score + tier chips ×count + rarest of the night), +N new catches (omitted at zero), and the set-structured setlist with Phase-4 hit/miss rings + TierBadges; `ShowsList` lists every attended show newest-first (tracked + retro unified and deduped by the deriveDex group-key rule, tally chip on tracked); `SetlistView` gives retro-marked shows a plain set-structured setlist (Set 1/2/Encore). The End Show → recap seam renders before ShowView's `!session.active` early return (RESEARCH Pattern 6) so the payoff is never swallowed. TDD RED→GREEN per task.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 3 (each TDD: failing test → implementation)
- **Files:** 10 (5 created, 5 modified)
- **Tests:** 440 passing full repo (+13 over the 06-08 baseline: 8 recapView incl. the seam test, 5 showsList); both `tsc --noEmit` clean

## Accomplishments

### Task 1 — ShowsList + SetlistView in the Dex Shows segment (D-16, HIST-01)
- `ShowsList` + pure `buildShowRows`: merges finalized tracked shows and retro-marked (attended) shows into one newest-first list, deduped by the SAME group-key rule as `deriveDex`/`merge` (bound → `id:{showId}`, unbound → `date:{date}`), with a tracked+marked night rendering once, as tracked. Tracked rows carry a hit/miss tally chip and open the recap; retro rows show `{date} · {venue}` + `{songCount} songs` and open the setlist. Its own `useLiveQuery` reads + empty-state.
- `SetlistView`: full-screen AlbumDetail-idiom drill-in — header `{date} · {venue}`, set-grouped rows labeled Set 1 / Set 2 / Encore in order, plain ring-less rows (retro shows carry no outcome data) + a rarity `TierBadge` when the corpus has one. Source = bundled archive by `show_id` first, `archiveShows` cache row for post-corpus marks (Pitfall 5).
- `DexView`: `openShow` component-state drill-in (tracked → `RecapView`, retro → `SetlistView`) — no new hash route; the Shows segment now renders `ShowsList` in place of the static empty state.

### Task 2 — RecapView, the payoff screen (SHOW-14, STAT-02, D-14/D-15)
- `RecapView({ sessionId, onClose })`: `useLiveQuery` the four attendance tables + guarded loaders + module-memoized rarity, then a memoized `deriveRecap(...)` — the component contains ZERO tally/percentage arithmetic; it groups, labels, and formats only. Renders in UI-SPEC section order: heading + `{date} · {venue}` → Display hero tally + "calls hit" → source split → rarity block (score + tier chips ×count + rarest-of-night with TierBadge) → +N new catches with `Sparkles` (row OMITTED at zero) → set-grouped setlist with inherited `#22C55E`/`#EF4444` rings + TierBadges → neutral Done CTA (Share card joins 06-11).
- `config.copy.recap` block + shared `config.copy.dex.setLabels` / show-row copy — all recap strings config-sourced ("calls hit" appears only in config.ts).

### Task 3 — End Show → recap seam (D-13, RESEARCH Pattern 6)
- `EndShowDialog.onEnded(sessionId)` fires on confirm AFTER `endShow` + `exportBackup` (order + fire-and-forget semantics untouched; existing endShowDialog tests stay green).
- `ShowView` sets `recapSessionId` from `onEnded` and renders `<RecapView>` BEFORE the `!session.active` early return — the load-bearing order: `endShow` finalizes synchronously, so the pre-show early return fires instantly and would otherwise swallow the recap. Done clears the state → the pre-show launcher returns; the recap stays reachable from Dex history forever (pure re-derivation over persisted trackedEntries).

## Verification

- `npx vitest run --project @guezzer/app test/showsList.test.tsx` — 5/5.
- `npx vitest run --project @guezzer/app test/recapView.test.tsx test/endShowDialog.test.tsx` — 11/11 (7 recap render + 1 seam + 3 endShowDialog).
- `npx vitest run` (full repo) — 440/440 green (56 files).
- `npx tsc --noEmit` — clean for `packages/app` and `packages/core`.
- grep: `RecapView.tsx` imports `deriveRecap` and has no local tally/percentage arithmetic; "calls hit" exists only in `config.ts`; no `dangerouslySetInnerHTML`/`innerHTML` in the new views (matches are mitigation comments only); ShowsList/SetlistView render names/venues as React text.
- **Deferred device human-check** (per `human_verify_mode: end-of-phase`): end a real tracked show → the recap appears immediately after the backup download, still in the venue flow. Tracked to the end-of-phase device gate.

## Deviations from Plan

### Auto-fixed / test-fixups (during GREEN)

**1. [Rule 1 — Test precision] dexView.test.tsx segment-toggle test updated**
- **Found during:** Task 1 GREEN. The existing toggle test marked a fixture show and asserted the Shows segment showed the "No shows yet" empty heading. With the Shows list now implemented (the plan's explicit goal — "replaced by the list when rows exist"), a marked show renders a `show-row`, not the empty state.
- **Fix:** Assert the `show-row` appears (and album cards leave the DOM) after switching to Shows — the correct, plan-intended behavior. No logic change.
- **Commit:** `140558d`.

### Structural sequencing (not scope changes)

- **RecapView (Task 2) built and committed before Task 1's DexView wiring.** DexView's tracked-row branch imports `RecapView`; the plan explicitly sanctioned "build Task 2 first within the plan" to avoid a stub. Commit order: Task 2 RED/GREEN → Task 1 RED/GREEN → Task 3 RED/GREEN. Each commit compiles and its tests pass.
- **`config.copy.dex.setLabels` + show-row copy added in the RecapView (Task 2) config edit** rather than Task 1's, since RecapView lands first and both the recap and SetlistView consume the shared set labels. No duplication.

## Known Stubs

None. Every new symbol is wired: RecapView is mounted from both DexView (tracked history rows) and ShowView (the End Show seam); ShowsList/SetlistView are mounted from DexView; `onEnded` is wired ShowView→EndShowDialog. The recap footer's Share-card CTA is a deliberate, documented deferral to 06-11 (no dead button this plan), not a stub.

## Threat Flags

None beyond the plan's registered surface. The two trust-boundary mitigations hold: all recap/history/setlist strings (venue + song names from archive/tracked/cache data) render as React text only (T-06-21 — no `dangerouslySetInnerHTML`); the recap derives entirely from persisted trackedEntries so a missed auto-open (crash) re-derives the identical scorecard from history (T-06-22); the source-order acceptance + the seam test pin the Pattern-6 recap-before-early-return fix (T-06-23); no new dependencies (T-06-SC).

## TDD Gate Compliance

Each task followed RED (a committed failing `test(...)`) → GREEN (`feat(...)`):
- Task 2 (RecapView): `7afc8e3` → `5d1fd4b`
- Task 1 (ShowsList/SetlistView): `f28580d` → `140558d`
- Task 3 (recap seam): `e855ef1` → `fedca81`

## Self-Check: PASSED

All 5 claimed created files exist on disk; all 6 task commits present in git history. Full repo suite 440/440; both package typechecks clean.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*
