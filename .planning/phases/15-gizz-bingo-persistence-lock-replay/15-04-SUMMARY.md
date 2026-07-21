---
phase: 15-gizz-bingo-persistence-lock-replay
plan: 04
subsystem: app-ui
tags: [gizz-bingo, catch-up, bingo-06, showview, fab, live-sync]

# Dependency graph
requires:
  - phase: 15-gizz-bingo-persistence-lock-replay
    plan: 03
    provides: "replayCard app->core replay adapter (reused unchanged to prove the catch-up fold)"
  - phase: 15-gizz-bingo-persistence-lock-replay
    plan: 02
    provides: "config.copy.catchUp.* copy block (read-only); bingoCards table + BingoCardRow"
provides:
  - "CatchUpSheet: pre-checked confirm-list of tracker-missed feed songs + manual search (adoptSuggestion + logSong only)"
  - "ShowView 'Catch me up' wiring: catchUpOpen state + uncapped diffLatestAgainstTrail candidate derivation"
  - "FabMenu onCatchUp action (top item) — the catch-up entry point on the active show surface"
affects: [16-gizz-bingo-build-live-marking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Catch-up NEVER touches a bingo square: it grows the trail via the shipped adoptSuggestion/logSong paths and deriveMarks re-lights squares as a pure consequence (live == replay == catch-up)"
    - "Uncapped diffLatestAgainstTrail(guardedRows, entries, guardedRows.length) yields the full tracker-missed set (deduped by song_id) — the pre-checked confirm-list source"
    - "Catch-up backfill carries shownFanSongIds:[] -> classifyOutcome MISS, keeping the hit/miss denominator honest (no phantom hits)"

key-files:
  created:
    - "packages/app/src/games/CatchUpSheet.tsx"
    - "packages/app/test/bingoCatchup.test.ts"
    - "packages/app/test/catchUpSheet.test.tsx"
  modified:
    - "packages/app/src/show/ShowView.tsx"
    - "packages/app/src/show/FabMenu.tsx"
    - "packages/app/test/fabMenu.test.tsx"

key-decisions:
  - "'Catch me up' lives as the TOP FabMenu item (Claude's RESEARCH Open-Q3 discretion) — the FAB is the established Show-Mode action hub; placing it top keeps it out of the hot thumb zone (Undo/??? stay nearest) while keeping the trail-write path identical to live"
  - "catch-up candidate list = uncapped diffLatestAgainstTrail (count = guardedRows.length) so ALL missed feed songs surface in the confirm-list, not just the SuggestionStrip's next 1-2"
  - "feedError is wired to !online — offline shows the feed-error copy but STILL offers manual search (never a dead end); candidates>0 always renders the confirm-list, else feedError copy, else all-caught-up"

requirements-completed: [BINGO-06]

# Metrics
duration: ~10min
completed: 2026-07-20
---

# Phase 15 Plan 04: Gizz-Bingo Catch-Up Summary

**Delivered BINGO-06 catch-up entirely in the app tier: a shared `CatchUpSheet` bottom-sheet that presents a PRE-CHECKED confirm-list of the `latest`-feed songs the tracker missed (glance-and-correct, never a silent bulk auto-adopt — D-03) and commits each still-checked row via the shipped `adoptSuggestion` path plus a manual fuse.js search → `logSong` miss (D-04). Catch-up never touches a bingo square — it grows the persisted trail and `deriveMarks` (via the shared 15-03 `replayCard` adapter) re-lights exactly the qualifying squares as a pure consequence, so `live == replay == catch-up` holds and the hit/miss denominator stays honest (every backfill carries `shownFanSongIds:[]` → a MISS). Wired as the top "Catch me up" FabMenu item on the active show. Both tsc clean; full suite 716 green.**

## Performance
- **Duration:** ~10 min
- **Tasks:** 2 (Task 1 acceptance gate; Task 2 UI + wiring)
- **Files:** 3 created, 3 modified
- **Tests:** 716 passing across both projects (was 711 after 15-03; +5: 1 catch-up fold + 4 CatchUpSheet render; fabMenu.test updated in place)

## Accomplishments
- **Catch-up acceptance gate (Task 1)** — `bingoCatchup.test.ts` pins the whole BINGO-06 contract with a locked card + partial trail: N `adoptSuggestion` feed rows grow `db.trackedEntries` by exactly N; re-deriving the board with `replayCard` over the grown trail marks EXACTLY the qualifying squares and no others (consume-once, every filler cell stays dark); each catch-up add is stored `outcome:"miss"` (`shownFanSongIds:[]`); and a manual `logSong` miss lights its square identically, completing the top-row line win. Proves `live == replay == catch-up` by composition over shipped functions.
- **CatchUpSheet (Task 2)** — a shared `Sheet` bottom-sheet (reuses the app's portal/inert/Escape primitive so it layers above the FAB/InstallBanner). Renders the tracker-missed candidate list PRE-CHECKED, each row a ≥44px checkbox the user can untick; "Add {n}" (`config.copy.catchUp.addN`) loops the checked rows calling `adoptSuggestion(sessionId, { songId, songName, shownFanSongIds: [] })` once per row. A "Search to add a song" affordance opens the shipped `SearchSheet` → `logSong` miss (mirrors `handleSearchSelect`), and is ALWAYS offered — the nothing-to-add state shows "You're all caught up…" and the feed-unavailable state shows the feed-error copy, both still exposing manual search (never a dead end). All copy from `config.copy.catchUp`; kglw-derived names render as escaped React text only.
- **ShowView wiring (Task 2)** — `catchUpOpen` state + a `catchUpCandidates` memo built from `diffLatestAgainstTrail(guardedRows, session.entries, guardedRows.length)` (uncapped — the full missed set, deduped by song_id) mapped to `{ songId, songName }`. The `CatchUpSheet` renders alongside the other sheets with `feedError={!online}`; the "Catch me up" entry point is a new top `FabMenu` item (`onCatchUp`).

## Task Commits
1. **Task 1: catch-up acceptance gate** — `23ad5a1` (test)
2. **Task 2: CatchUpSheet + ShowView/FabMenu wiring** — `aae38ea` (feat)

## Files Created/Modified
- `packages/app/src/games/CatchUpSheet.tsx` *(new)* — the shared catch-up confirm-list + manual-search surface.
- `packages/app/test/bingoCatchup.test.ts` *(new)* — the BINGO-06 trail-grow / re-light acceptance gate.
- `packages/app/test/catchUpSheet.test.tsx` *(new)* — the pre-checked confirm-list render contract (4 cases).
- `packages/app/src/show/ShowView.tsx` — `catchUpOpen` state, `catchUpCandidates` memo, CatchUpSheet render, FabMenu `onCatchUp`.
- `packages/app/src/show/FabMenu.tsx` — new top "Catch me up" action (`onCatchUp` prop, `ListChecks` icon).
- `packages/app/test/fabMenu.test.tsx` — `onCatchUp` handler + catch-up label threaded through the existing assertions.

## Decisions Made
- **"Catch me up" is the top FabMenu item** (RESEARCH Open-Q3 discretion). The FAB is the established Show-Mode action hub (Search / ??? / Set break / Encore / Undo / End Show), so catch-up belongs there; top placement keeps it clear of the hot thumb zone (Undo/??? nearest) and the trail-write path is byte-identical to a live adopt.
- **Uncapped candidate diff** — catch-up needs the FULL tracker-missed set, so `diffLatestAgainstTrail` is called with `count = guardedRows.length` (a safe upper bound; the diff dedupes by song_id) rather than the SuggestionStrip's 1-2 cap.
- **`feedError = !online`** — offline shows the feed-error copy but still offers manual search; the render logic is: candidates present → confirm-list; else feedError → feed-error copy; else → all-caught-up. Manual search is unconditional.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FabMenu contract + test updated for the new action**
- **Found during:** Task 2 (the plan directs adding a "Catch me up" FabMenu item).
- **Issue:** Adding the required `onCatchUp` prop to `FabMenu` broke `fabMenu.test.tsx` (missing prop → tsc error; the "expands to N rows" / per-action cases enumerate the action set).
- **Fix:** Added `onCatchUp` + a `catchUp` action (top item, `ListChecks` icon, `config.copy.catchUp.cta` label); threaded `onCatchUp` through the test's handler bag, label list, and per-action cases.
- **Files modified:** packages/app/src/show/FabMenu.tsx, packages/app/test/fabMenu.test.tsx
- **Commit:** `aae38ea`

### Note on Task 1 TDD framing
Task 1 is tagged `tdd="true"`, but its `<action>` creates a pure ACCEPTANCE/characterization test — the catch-up fold is composed entirely from already-shipped functions (`adoptSuggestion`, `logSong`, `replayCard`), so there is no new production module to drive RED→GREEN. The test is green on first run BY DESIGN (it proves existing composition, `live == replay == catch-up`), which is the correct and honest state for a "prove the shipped paths compose" gate — not a skipped RED.

## Known Stubs
None. `CatchUpSheet` is wired to the live guarded `latest` feed (via ShowView's `catchUpCandidates`) and commits through the real `adoptSuggestion`/`logSong` Dexie helpers. The candidate list is empty only when the tracker has already logged everything the feed shows (the honest all-caught-up state) or the device is offline (the feed-error state) — both intentional, both still offering the manual search path.

## Threat Flags
None new. The plan's three threats are mitigated as planned: T-15-10 (mis-scraped feed) — the confirm-list is pre-checked but human-corrected ("Untick anything wrong"), never a silent bulk auto-adopt, and rows are the already date/artist-guarded `guardedRows`; T-15-11 (XSS) — all feed song names render as escaped React text (no `dangerouslySetInnerHTML`); T-15-12 (dishonest tally) — every catch-up add carries `shownFanSongIds:[]` → classified as a MISS, pinned by `bingoCatchup.test.ts`.

## Verification
- `npx vitest run packages/app/test/bingoCatchup.test.ts` → **1 passed**.
- `npx vitest run packages/app/test/catchUpSheet.test.tsx` → **4 passed**.
- `npx vitest run packages/app/test/fabMenu.test.tsx` → green (updated for `onCatchUp`).
- `npx vitest run` (both projects) → **716 passed / 90 files**.
- `npx tsc --noEmit -p packages/app` → **clean (exit 0)**.
- `npx tsc --noEmit -p packages/core` → **clean (exit 0)**.

## Next Phase Readiness
- Catch-up is fully wired and non-destructive. Phase 16 (live marking + celebrations) shares the same `adoptSuggestion`/`logSong` → `deriveMarks`/`replayCard` derivation, so `live == replay == catch-up` continues to hold as live marking lands.
- No blockers.

## Self-Check: PASSED
- FOUND: packages/app/src/games/CatchUpSheet.tsx
- FOUND: packages/app/test/bingoCatchup.test.ts
- FOUND: packages/app/test/catchUpSheet.test.tsx
- FOUND commits: 23ad5a1, aae38ea
