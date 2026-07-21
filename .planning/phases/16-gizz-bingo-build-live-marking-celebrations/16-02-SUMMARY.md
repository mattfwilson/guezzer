---
phase: 16-gizz-bingo-build-live-marking-celebrations
plan: 02
subsystem: ui
tags: [react, bingo, gizz-bingo, component-extraction, memoization, testing-library]

# Dependency graph
requires:
  - phase: 14-gizz-bingo-core-marking-generation
    provides: "pure core bingo module (deriveMarks, detectWins, buildBingoContext, BingoCard/MarkedCard/Win types)"
  - phase: 15-gizz-bingo-persistence-lock-replay
    provides: "bingoReplay.replayCard adapter, RecapView inline 4x4 replay board, bingoCards Dexie table"
provides:
  - "Shared <BingoBoard> component (one 4x4 board for replay, live, and thumbnail) with captionMode persistent|tapReveal"
  - "getBingoContext() — memoized app->core BingoContext + corpusVersion + dexSnapshot helper"
  - "deriveLiveBoard() — live sibling of replayCard over a non-frozen caught-set sharing the 0-based reindex"
  - "RecapView migrated to render the shared <BingoBoard captionMode='persistent'> (no visual change)"
affects: [gizz-bingo-build-screen, gizz-bingo-live-marking, gizz-bingo-celebrations, bingo-peek-strip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared render component extracted in-place from an inline block; all surfaces consume it (no divergence)"
    - "captionMode prop: one component, two disclosure behaviors (persistent always-on vs tapReveal transient)"
    - "Module-cache memoization of a corpus-scanning builder (mirrors getRarityIndex)"
    - "Factored adaptTrail helper so frozen (replay) and live derivations share ONE 0-based opener reindex"

key-files:
  created:
    - packages/app/src/components/BingoBoard.tsx
    - packages/app/src/games/bingoContext.ts
    - packages/app/test/components/BingoBoard.test.tsx
  modified:
    - packages/app/src/games/bingoReplay.ts
    - packages/app/src/dex/RecapView.tsx
    - packages/app/src/styles.css

key-decisions:
  - "corpusVersion = matrix.asOfDate (stable corpus-snapshot identity), NOT generatedAt (per-build timestamp) — a rebuilt-but-identical corpus deals identical cards (D-21)"
  - "One-away glow is a STATIC accent ring by default (visible under reduced-motion), pulse ADDED only in a prefers-reduced-motion:no-preference keyframe block — it's a functional indicator, not decorative"
  - "wins prop applies a non-visual data-win marker only (keeps RecapView byte-identical; win badges stay in RecapView)"
  - "Squares are toggle <button>s relying on Tailwind preflight to neutralize UA button chrome — visually byte-identical to the extracted <div> board"

patterns-established:
  - "captionMode disclosure prop pattern for a shared board"
  - "adaptTrail shared reindex guaranteeing live == replay == catch-up"

requirements-completed: [BINGO-04]

# Metrics
duration: 12min
completed: 2026-07-21
---

# Phase 16 Plan 02: Shared BingoBoard Foundation Summary

**One shared `<BingoBoard>` (captionMode persistent|tapReveal) extracted from RecapView's inline 4×4 render, plus a memoized `getBingoContext` app adapter and a `deriveLiveBoard` sibling — the Wave-1 foundation every later Gizz-Bingo surface renders and derives from.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-21T07:56:00Z
- **Completed:** 2026-07-21T08:01:00Z
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Extracted the inline RecapView 4×4 board into a single reusable `<BingoBoard>` with focusable toggle-`<button>` squares (D-24), `aria-pressed`, accessible per-square labels, and NO ARIA live regions.
- Implemented the dual-disclosure `captionMode`: `'persistent'` renders the always-on "Lit by {song}" caption (Phase-15 D-06); `'tapReveal'` renders a clean stamp and surfaces the lit-by song only on tap (D-16) via internal transient state.
- Added `getBingoContext()` — memoizes `buildBingoContext` in a module cache (never rebuilt per render), exposes `corpusVersion` and a `dexSnapshot` helper for all games/live surfaces.
- Added `deriveLiveBoard()` — the live sibling of `replayCard` over a non-frozen caught-set, factoring a shared `adaptTrail` 0-based opener reindex so `live == replay == catch-up` holds by construction.
- Migrated RecapView to `<BingoBoard captionMode="persistent">` with no visual regression; full suite 723 tests green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract `<BingoBoard>` (captionMode persistent|tapReveal) + one-away glow CSS** - `cc37951` (feat)
2. **Task 2: getBingoContext + deriveLiveBoard; migrate RecapView** - `e7d46d2` (feat)
3. **Task 3: BingoBoard render test (both caption modes)** - `86ea125` (test)

## Files Created/Modified
- `packages/app/src/components/BingoBoard.tsx` (created) - The one shared 4×4 board; toggle-button squares, captionMode persistent|tapReveal, onSquareTap, oneAwayIndex glow, thumbnail sizing, data-semantic hexes.
- `packages/app/src/games/bingoContext.ts` (created) - Memoized `getBingoContext()` (ctx + corpusVersion) + `dexSnapshot(dex)` helper over the four guarded loaders.
- `packages/app/test/components/BingoBoard.test.tsx` (created) - Render test: free/marked/unmarked aria-pressed, one-away glow, data-win, persistent caption, tapReveal clean-stamp→tap→toggle, onSquareTap index.
- `packages/app/src/games/bingoReplay.ts` (modified) - Factored `adaptTrail`; added `deriveLiveBoard` sibling of `replayCard`.
- `packages/app/src/dex/RecapView.tsx` (modified) - Replaced the inline 4×4 board with `<BingoBoard captionMode="persistent">`; imported BingoBoard.
- `packages/app/src/styles.css` (modified) - `.bingo-oneaway-glow` static accent ring + a `prefers-reduced-motion:no-preference` pulse keyframe.

## Decisions Made
- **corpusVersion = `matrix.asOfDate`**: the matrix loader exposes both `asOfDate` (corpus cutoff) and `generatedAt` (build timestamp). Chose `asOfDate` as the stable corpus-snapshot identity so a rebuilt-but-unchanged corpus deals identical cards (D-21); `generatedAt` would perturb deal determinism on every build. The calibration CLI's use of `generatedAt` is unaffected — corpusVersion only mixes into the PRNG seed, not the fill-rate distribution.
- **wins → non-visual `data-win` marker only**: RecapView must stay byte-identical, and its win badges live outside the board block, so the board applies `data-win` (for later celebration diffing, Plan 05) without altering rendered pixels.
- **Toggle `<button>` squares rely on Tailwind preflight** to zero UA button chrome, keeping the extracted board visually byte-identical to the original `<div>` render (marked branch sets `border:none`, unmarked keeps the 1px hairline — identical box model under border-box).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking/Enabling] Added `.bingo-oneaway-glow` CSS to styles.css**
- **Found during:** Task 1 (BingoBoard extraction)
- **Issue:** The plan mandates the one-away glow ring "using the orb-ripple/orb-breathe idiom (static ring under reduced-motion via the `@media (prefers-reduced-motion: no-preference)` keyframe gate)", but `packages/app/src/styles.css` was not in the plan's `files_modified` list — the keyframe/animation must live in a stylesheet.
- **Fix:** Added a `.bingo-oneaway-glow` rule with a STATIC accent `#f2c14e` box-shadow ring by default (visible under reduced motion, since the glow is a functional one-away indicator, not decorative) plus a `bingo-oneaway-pulse` animation added only inside the `prefers-reduced-motion: no-preference` block — matching the file's existing orb-ripple/explore-bg-bloom idiom.
- **Files modified:** packages/app/src/styles.css
- **Verification:** Test asserts the glow class + `data-oneaway` land on exactly `oneAwayIndex`; app typechecks; full suite green.
- **Committed in:** cc37951 (Task 1 commit)

---

**Total deviations:** 1 (1 blocking/enabling — a required stylesheet edit outside the declared file list)
**Impact on plan:** In-scope; directly implements the plan's stated one-away glow requirement using the file's established reduced-motion keyframe-gate pattern. No scope creep.

## Issues Encountered
None - all three tasks executed as written. Pre-existing jsdom warnings ("Not implemented: navigation", "getContext without canvas package") are unrelated to these changes and appear in the untouched baseline suite.

## Known Stubs
None - `getBingoContext` and `deriveLiveBoard` are fully wired to the shipped loaders and core fold; RecapView renders live data. Their build/live/celebration CALLERS are the subject of Waves 2-3 (Plans 03-06), as designed — this plan is the foundation those thin waves consume.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave-1 foundation complete: `<BingoBoard>`, `getBingoContext`, `deriveLiveBoard` are ready for the build screen (Plan 03), live marking (Plan 04/05), and celebrations (Plan 06).
- `deriveLiveBoard` + `dexSnapshot` give the live board its non-frozen caught-set derivation; `getBingoContext().corpusVersion` feeds the Plan-04 `deal` generator's seed.
- No blockers.

---
*Phase: 16-gizz-bingo-build-live-marking-celebrations*
*Completed: 2026-07-21*
