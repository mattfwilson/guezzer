---
phase: 16-gizz-bingo-build-live-marking-celebrations
plan: 06
subsystem: ui
tags: [bingo, share-card, canvas, web-share, react, core-projection]

# Dependency graph
requires:
  - phase: 16-01
    provides: BingoShareCard "bingo"-scoped ShareCardData union member + ShareCardSheet second-render-target seam
  - phase: 16-02
    provides: BingoBoard replay rendering + the RecapView bingo section the share trigger attaches to
  - phase: 16-03
    provides: GamesView replay list + replayCard/deriveLiveBoard adapters
provides:
  - buildBingoShareCard pure core assembler (MarkedCard + wins + show → BingoShareCard trophy)
  - drawShareCard bingo branch — 4×4 board + win badges + date/venue on the galaxy canvas + wordmark
  - RecapView bingo-trophy share auto-offered at the win (own ShareCardSheet)
  - GamesView per-replay-row re-share (re-derives the frozen board via replayCard)
affects: [share, bingo, recap, games]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third ShareCardData scope ('bingo') as a second render target on the SHIPPED share-card canvas/File/sheet — not a new pipeline"
    - "Pure core projection idiom extended (buildBingoShareCard mirrors buildShareStats/buildRecapShareStats): all shape math in core, the app draw layer only draws"
    - "Trophy-not-spreadsheet (D-22): the share projection carries board stamps + deduped wins + date/venue, never per-square 'lit by' detail"

key-files:
  created:
    - packages/app/test/dex/bingoShareCard.test.ts
  modified:
    - packages/core/src/dex/share-stats.ts
    - packages/core/src/index.ts
    - packages/app/src/dex/shareCard.ts
    - packages/app/src/dex/RecapView.tsx
    - packages/app/src/games/GamesView.tsx

key-decisions:
  - "Free-cell label left empty by core; the app draw layer paints the free WORD from config.copy.recap.bingoFreeLabel via the isFree flag — keeps bingo copy out of pure core"
  - "Win badges render glyph (★) + WORD (never color alone, WCAG 1.4.1); greedy row-wrapping so a full four-win board never overruns the card edge"
  - "RecapView uses a SECOND independent ShareCardSheet for the bingo trophy (distinct target from the per-show recap card) rather than swapping the recap sheet's data"
  - "GamesView re-share re-derives the FROZEN board via replayCard (D-23: marks never stored) so the shared image always matches what the user saw live"

patterns-established:
  - "buildBingoShareCard: pure app→core projection with no I/O — sorts a copy of marked.squares by board index for guaranteed row-major, dedupes win kinds in detection order"

requirements-completed: [BINGO-08]

# Metrics
duration: 12min
completed: 2026-07-21
---

# Phase 16 Plan 06: Gizz-Bingo Shareable Trophy Summary

**buildBingoShareCard pure assembler + a drawShareCard bingo branch that paints the final 4×4 board, win badges, and date/venue on the shipped galaxy share canvas, auto-offered in the recap at the win and re-shareable from every GizzGames replay row.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-21T08:40Z
- **Completed:** 2026-07-21T08:49Z
- **Tasks:** 3 (Task 1 via TDD RED→GREEN)
- **Files modified:** 5 source + 1 test created

## Accomplishments
- `buildBingoShareCard(marked, wins, show)` — pure core projection into the `"bingo"`-scoped `ShareCardData` (16 row-major `{label,marked,isFree}` stamps, deduped win kinds, show date/venue), trophy-only (no per-square song detail, D-22)
- Replaced the Wave-1 exhaustiveness stub in `drawShareCard` with the real bingo branch: 4×4 board (marked `#22C55E` / unmarked `#17171F`+`#2A2A34`, distinct free center), win-badge row (glyph + word, row-wrapped) or the honest no-win line, and the date · venue footer — all on the galaxy bg + wordmark
- RecapView auto-offers the trophy share at the win via a second `ShareCardSheet`; GamesView adds a per-replay-row share affordance that re-derives the frozen board and re-shares it
- File is pre-built on sheet-open in both entry points (Pitfall 7 — no async before `navigator.share`)

## Task Commits

1. **Task 1 (RED): failing test for buildBingoShareCard** - `1016bc5` (test)
2. **Task 1 (GREEN): implement buildBingoShareCard pure assembler** - `e734d93` (feat)
3. **Task 2: paint bingo trophy in drawShareCard** - `6007e73` (feat)
4. **Task 3: wire bingo share entry points (recap + replay re-share)** - `5dcdab7` (feat)

_Note: shared metadata (STATE.md/ROADMAP.md) is owned by the orchestrator, not this worktree agent._

## Files Created/Modified
- `packages/core/src/dex/share-stats.ts` - Added `buildBingoShareCard` pure projection
- `packages/core/src/index.ts` - Barrel-exported `buildBingoShareCard` + `BingoShareCard` type
- `packages/app/src/dex/shareCard.ts` - Bingo branch `drawBingoShareCard` + roundRect/label-wrap/win-badge helpers; bingo File name
- `packages/app/src/dex/RecapView.tsx` - Bingo-trophy share data memo + auto-offered share button + second `ShareCardSheet`
- `packages/app/src/games/GamesView.tsx` - Per-replay-row re-share (loaders + `replayCard` → `buildBingoShareCard` → `ShareCardSheet`)
- `packages/app/test/dex/bingoShareCard.test.ts` - 6 assertions on the pure assembly (16 squares, free flagged, trophy-only, win dedup, zero-win valid, show pass-through)

## Decisions Made
- Core emits an empty label for the free cell and flags `isFree`; the app draw layer paints the free WORD from existing `config.copy.recap.bingoFreeLabel`, keeping bingo copy out of pure core (no new config key, no configMirror churn).
- Win badges render `★ {word}` so meaning never depends on color; a greedy row-packer wraps a full four-win board to a second row rather than overrunning the 1080px card.
- Two independent `ShareCardSheet` instances in RecapView (per-show recap card vs. bingo trophy) — distinct share targets, each pre-building its own File.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree `@guezzer/core` resolved to the MAIN repo, hiding this worktree's core edits from Vitest**
- **Found during:** Task 1 (GREEN — the test kept reporting `buildBingoShareCard is not a function` after the export was added)
- **Issue:** The worktree has no `node_modules`; `@guezzer/core` resolution walked up to the main checkout's `node_modules/@guezzer/core`, which symlinks to the MAIN repo's `packages/core` — so the test ran against unedited core source.
- **Fix:** Created directory junctions `node_modules/@guezzer/core` → `packages/core` and `node_modules/@guezzer/app` → `packages/app` inside the worktree so `@guezzer/*` resolves to the worktree packages. `node_modules` is gitignored — the junctions are a build-environment fix only, nothing committed.
- **Verification:** `node -e "require.resolve('@guezzer/core')"` now resolves inside the worktree; the bingo-share test and the full 747-test suite pass against the worktree core.
- **Committed in:** N/A (environment-only, not a code change)

---

**Total deviations:** 1 (1 blocking environment fix)
**Impact on plan:** No code scope change — the fix only made the worktree's own edits testable. Plan executed as written.

## Issues Encountered
- jsdom emits "getContext() not implemented" / "navigation to another Document" warnings during the app suite — pre-existing and benign (the share-card draw is not exercised through a real canvas in tests; `drawShareCard` is verified via typecheck per the plan).

## Verification
- `npm test -- --run packages/app/test/dex/bingoShareCard.test.ts` — 6/6 green
- `cd packages/app && npx tsc --noEmit` — exit 0
- `npm test -- --run` — full suite 95 files / 747 tests green

## Self-Check: PASSED
- Created files exist: `packages/app/test/dex/bingoShareCard.test.ts`, `.planning/phases/16-gizz-bingo-build-live-marking-celebrations/16-06-SUMMARY.md`
- Commits exist: `1016bc5`, `e734d93`, `6007e73`, `5dcdab7`
- Wave-1 bingo stub in `shareCard.ts` replaced with the real `drawBingoShareCard` branch (no early-return remains)

## Next Phase Readiness
- BINGO-08 shipped: the bingo trophy is shareable from the recap (auto-offered at the win) and re-shareable from every GizzGames replay row.
- Device UAT (tracked separately) should confirm the board + badges + venue/date render on a real canvas across iOS/Android share sheets.

---
*Phase: 16-gizz-bingo-build-live-marking-celebrations*
*Completed: 2026-07-21*
