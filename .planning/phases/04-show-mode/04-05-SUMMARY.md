---
phase: 04-show-mode
plan: 05
subsystem: show-mode-miss-paths
tags: [react, actionbar, searchsheet, fuse.js, opener-seed, miss-path, live-loop]

# Dependency graph
requires:
  - phase: 04-show-mode
    plan: 04
    provides: useShowSession (currentSongId null-safe, shownFanSongIds, fan) + ShowView lifecycle root + the pre-opener orbit slot
  - phase: 04-show-mode
    plan: 02
    provides: core makeCatalogSearcher/toCatalog/SearchResult over the 264-node catalog (fuse.js)
  - phase: 04-show-mode
    plan: 03
    provides: OrbitStage render layer + matrix loader (loadMatrix → matrix.nodes)
  - phase: 04-show-mode
    plan: 01
    provides: logSong write helper (placeholder-miss shape) + config.show + config.copy.show
provides:
  - ActionBar — persistent two-row D-13 bottom bar (primary Search + ??? live; secondary Set break/Encore/Undo scaffolded for 04-06)
  - SearchSheet — fuzzy catalog search over the core searchCatalog engine; opener-seed + mid-show miss + no-match ??? offer
  - ShowView wiring — Search opens the sheet; both Search-select and ??? log a MISS that recenters via useLiveQuery; the slice-1 tap→log→persist→restore loop is now fully user-demonstrable
affects: [04-06-actionbar-secondary-row, 04-06-comet-trail, phase-05-live-sync-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App consumes the core search engine directly: SearchSheet memoizes makeCatalogSearcher(toCatalog(matrix.nodes)) once — search is never re-implemented app-side (CLAUDE.md core/UI separation, SHOW-04)"
    - "Miss paths are hardcoded outcome:'miss' (never classifyOutcome): a search/??? log is a miss by definition regardless of the shown fan (D-06/D-08)"
    - "Opener-seed reuses the miss path: from the pre-opener empty shown-fan, a real songId select is an honest miss AND flips currentSongId non-null, so the first fan renders with zero hook changes"
    - "ActionBar is an in-flow flex-column block (not position:fixed) so it stacks above the app-level BottomTabBar without overlap; safe-area inset retained per the D-13 contract"
    - "kglw-origin song names render as React text only in result rows — never dangerouslySetInnerHTML (T-04-12)"

key-files:
  created:
    - packages/app/src/show/ActionBar.tsx
    - packages/app/src/show/SearchSheet.tsx
  modified:
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/config.ts

key-decisions:
  - "ActionBar rendered in-flow (shrink-0 block in the ShowView flex column), not position:fixed as the plan's prose loosely described — a literal fixed bottom-0 would overlap the app's fixed BottomTabBar (Show/Explore/Dex). In-flow matches the 04-04 'ActionBar slot in the column' seam and stacks cleanly above the nav; env(safe-area-inset-bottom) is retained per the D-13 contract/acceptance."
  - "Added config.copy.show.searchCta ('Search') so the ActionBar Search label stays config-sourced — CLAUDE.md/UI-SPEC forbid hardcoding Show-Mode strings (Rule 2 missing-copy)."
  - "SearchSheet builds its catalog from loadMatrix().ok ? matrix.nodes : [] (guarded), memoized — the fuse index builds once, not per keystroke; matrix is guaranteed loaded since ShowView gates the whole orbit on matrixOk."
  - "Both miss paths log outcome:'miss' explicitly (not via classifyOutcome): per D-06/D-08 and the db.ts contract a search/??? log is always a miss; the ??? entry is isPlaceholder:true, the search entry isPlaceholder:false."

requirements-completed: [SHOW-04, SHOW-05]

# Metrics
duration: 6min
completed: 2026-07-09
---

# Phase 4 Plan 05: Miss Paths & Live-Loop Close (ActionBar + SearchSheet) Summary

**The persistent two-row D-13 ActionBar (primary Search + ??? live, secondary row scaffolded) and the SearchSheet wired to the core `searchCatalog` fuse.js engine — Search doubles as the opener-seeding affordance (pre-opener select = honest miss that flips `currentSongId` non-null and renders the first fan), both miss paths log with zero confirmation friction and recenter via `useLiveQuery`, and no-match offers `???` inline — closing the slice-1 tap→log→persist→restore loop end-to-end; typecheck-clean, 56 app tests + 4 core searchCatalog tests green.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-07-09
- **Tasks:** 2
- **Files:** 4 (2 created, 2 modified)

## Accomplishments

- **Task 1 — `ActionBar` (D-13 two-row) + ??? instant-miss:** built `ActionBar.tsx` mirroring the `BottomTabBar` idiom — `env(safe-area-inset-bottom)`, `min-h-11 min-w-11` tap floor, lucide `Search`/`CircleHelp` icons at Label typography, inherited `bg-elevated`/`border-hairline`/`text-text-*` tokens (never accent — gold stays reserved for Start Show). Primary row Search + ??? live; secondary row Set break/Encore/Undo rendered as disabled placeholders so the two-row layout is final (handlers land in 04-06). Wired ??? → `logSong(sessionId, { songId:null, songName:"???", outcome:"miss", shownFanSongIds, isPlaceholder:true, loggedAt })` with **no confirm** (D-14); the write-through recenters via `useLiveQuery`. Mounted in ShowView so the bar shows in BOTH the pre-opener "Tap the opener" state and the active-fan state (the opener is always enterable).
- **Task 2 — `SearchSheet` over core `searchCatalog`:** built `SearchSheet.tsx` (AppMenu overlay idiom) with a `text-base` (16px, no iOS form-zoom) autofocus field, memoizing `makeCatalogSearcher(toCatalog(matrix.nodes))` **once** — the search engine lives in core (SHOW-04), never re-implemented app-side. Result rows are ≥44px and render the kglw song name as **React text only** (T-04-12). Selecting a row calls `onSelect` → `logSong` with `outcome:"miss"` and closes immediately (no confirm — as fast as a hit tap). This is ALSO the opener-seed: from the pre-opener empty `shownFanSongIds`, the opening song is correctly an honest miss (nothing predicted it, D-08) AND becomes the new `currentSongId`, so `useShowSession` renders the first prediction fan — **closing the slice-1 live loop**. No-match surfaces the copy.show no-match line + an inline "Log as ???" reusing the ??? handler.

## Task Commits

1. **Task 1 — ActionBar (D-13 two-row) + ??? instant-miss log** — `13bab6d` (feat)
2. **Task 2 — SearchSheet over core searchCatalog (opener-seed + miss log)** — `2818f84` (feat)

_Plan metadata (SUMMARY/STATE/ROADMAP/REQUIREMENTS) committed separately._

## Deviations from Plan

### Reconciliation with the Phase 3 shell (not a scope change)

**1. [Rule 1 — layout correctness] ActionBar rendered in-flow, not `position: fixed`**
- **Found during:** Task 1.
- **Issue:** The plan's prose said "mirroring BottomTabBar: fixed bottom." A literal `fixed bottom-0` ActionBar would overlap the app-level `BottomTabBar` (Show/Explore/Dex), which the `AppShell` already renders fixed at `bottom-0`.
- **Fix:** Rendered ActionBar as an in-flow `shrink-0` block at the bottom of the ShowView flex column — it stacks directly above the fixed nav (`<main>`'s `pb-16` reserves the nav's height) with no overlap. This matches the 04-04 "ActionBar slot in the column" seam. `env(safe-area-inset-bottom)` is retained per the D-13 contract and the acceptance source-assertion.
- **Files:** `packages/app/src/show/ActionBar.tsx`, `packages/app/src/show/ShowView.tsx`
- **Commit:** `13bab6d`

**2. [Rule 2 — missing copy] Added `config.copy.show.searchCta`**
- **Found during:** Task 1.
- **Issue:** The D-13 mockup shows a `[🔍 Search]` label, but `config.copy.show` had only `searchPlaceholder` — no Search button label. CLAUDE.md/UI-SPEC forbid hardcoding Show-Mode strings in components.
- **Fix:** Added `searchCta: "Search"` to `config.copy.show`; ActionBar reads it.
- **Files:** `packages/app/src/config.ts`
- **Commit:** `13bab6d`

**3. `logSong` called without `setNumber` (inherited 04-04 reconciliation)**
- The frozen 04-01 `logSong` signature omits `setNumber` (the show row stamps `currentSetNumber` itself). The plan's illustrative ??? call included `setNumber:currentSetNumber`; following the real contract (as 04-04 already did) avoids a `tsc` error and preserves snapshot semantics. Not a functional deviation.

Otherwise the plan executed as written. No Rule 3–4 auto-fixes were required.

## Known Stubs

- **ActionBar secondary row (Set break / Encore / Undo)** — rendered as `disabled` placeholder buttons in `ActionBar.tsx`. **Intentional** per the plan (present now so the D-13 two-row layout is final; handlers are wired in **04-06**). Not a gap in this plan's goal (SHOW-04/SHOW-05, the miss paths + opener seed, are fully live).

## Issues Encountered

- None outstanding. During Task 1 an intermediate edit briefly wrote a nonsense `isPlaceholder` expression into the ??? handler; caught and corrected to `isPlaceholder: true` before any typecheck/commit. No functional impact.

## Threat Model Coverage

- **T-04-11 (DoS via search input):** mitigated — the query goes only to the bounded core `searchCatalog` (264 items, no user-regex, no network); the fuse searcher is memoized (built once, not per keystroke).
- **T-04-12 (XSS via result rows):** mitigated — kglw song names render as React text (`{result.songName}`); never `dangerouslySetInnerHTML`.

No new security surface introduced (Phase 4 is fully offline; no network, no new dependencies).

## Manual Verification Deferred (per VALIDATION, config human_verify_mode: end-of-phase)

On device — the full slice-1 loop is now demonstrable end-to-end: Start Show → "Tap the opener" → Search → select the opener → the first fan renders → tap a predicted orb → it recenters with a fresh fan (SHOW-03) → force-quit + relaunch restores the exact session (SHOW-11). Also: tap ??? → an instant "???" miss node + recenter with no dialog; a no-match search shows the ??? offer; Search feels as fast as a hit (SHOW-04/SHOW-05). Carried to the phase's end-of-phase human-verify gate.

## Next Phase Readiness

- **04-06 (ActionBar secondary row + CometTrail):** the disabled Set break/Encore/Undo buttons are in place with the final layout; wiring `markSetBreak`/`markEncore`/`undoLast` (04-01) into their handlers is the remaining work. The `???` placeholder entries this plan writes are renamable from the trail (D-15) once the CometTrail lands.
- Full suite green: **56 app tests / 9 files** + **4 core searchCatalog tests**, `tsc -p packages/app --noEmit` clean.

## Self-Check: PASSED

- FOUND: packages/app/src/show/ActionBar.tsx
- FOUND: packages/app/src/show/SearchSheet.tsx
- FOUND: packages/app/src/show/ShowView.tsx (ActionBar + SearchSheet mounted)
- FOUND: packages/app/src/config.ts (copy.show.searchCta)
- FOUND commit: 13bab6d (feat), 2818f84 (feat)

---
*Phase: 04-show-mode*
*Completed: 2026-07-09*
