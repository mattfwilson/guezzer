---
phase: 16-gizz-bingo-build-live-marking-celebrations
plan: 05
subsystem: ui
tags: [react, motion, dexie, bingo, celebrations, useLiveQuery]

# Dependency graph
requires:
  - phase: 16 (plans 01/02)
    provides: deriveLiveBoard + getBingoContext (app→core bridge), detectWins (core), config.ui.z.celebration + config.copy.games.bingo celebration strings
  - phase: 15
    provides: BingoCardRow persistence (locked card + frozen caughtSnapshot), replayCard adapter, trackedShows/trackedEntries live trail
provides:
  - Three-tier Gizz-Bingo celebration layer (mark-toast / badge-toast / supernova)
  - Module emitter + App-level host (showBingoCelebration / subscribeBingoCelebration / <BingoCelebration/>)
  - App-level driver hook useBingoCelebrations() + pure fire-once transition reducer nextCelebrations()
  - config.ui.celebration timing block
affects: [gizz-bingo, live-marking, share-card, device-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BackupToast module-emitter + App-level host cloned for a 3-tier celebration surface (survives ShowView→RecapView unmount, fires over any tab)"
    - "Pure transition reducer (nextCelebrations) extracted from the hook so fire-once + ≤2-supernova budget are unit-provable without a DOM"
    - "Silent memo-seed on first per-session derive (fire on 0→1 edge, never on presence — RESEARCH Pitfall 3)"

key-files:
  created:
    - packages/app/src/components/BingoCelebration.tsx
    - packages/app/src/games/useBingoCelebrations.ts
    - packages/app/test/games/useBingoCelebrations.test.ts
  modified:
    - packages/app/src/App.tsx
    - packages/app/src/config.ts

key-decisions:
  - "Fed deriveLiveBoard the card's FROZEN caughtSnapshot (not the live dex) so live celebrations are byte-identical to the eventual replay (live == replay == catch-up)"
  - "Added a config.ui.celebration timing block rather than inline literals (single-config ethos)"
  - "Supernova reuses ExploreBackground galaxy backdrop + OrbitStage motion.div orb idiom; reduced-motion is a static full-bloom crossfade"

patterns-established:
  - "Celebration emitter: single module listener, one App-level host subscriber dispatching to independent toast + supernova state slots"
  - "Non-blocking overlay: pointer-events-none at z.celebration (18), strictly below sheetScrim (40), auto-fade inside the 2–3s budget"

requirements-completed: [BINGO-05]

# Metrics
duration: ~20min
completed: 2026-07-21
---

# Phase 16 Plan 05: Live Marking Celebrations Summary

**Three-tier Gizz-Bingo celebration layer — ✦ mark-toasts, ✨ badge-toasts, and a non-blocking first-line/blackout supernova — fired app-wide via a BackupToast-style module emitter and driven by a fire-once transition reducer with a ≤2-big-moments/show budget.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-21T08:20Z (approx)
- **Completed:** 2026-07-21T08:26Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Module-emitter + App-level `<BingoCelebration/>` host rendering all three tiers (mark/badge toast at `z.toast`, supernova at `z.celebration`), cloned from the `BackupToast` pattern so it survives the ShowView→RecapView unmount and fires over any tab.
- Non-blocking supernova: `pointer-events-none` overlay strictly below `sheetScrim`, auto-fading inside the 2–3s budget — the live logging loop is never intercepted (D-17, T-16-09).
- Reduced-motion path (D-20): the supernova degrades to a static full-bloom headline crossfade (zero particles/scale/translate); toasts are opacity-only — gated on the shared `useReducedMotion`.
- App-level `useBingoCelebrations()` driver: liveQuery of the active locked card + live trail → `deriveLiveBoard` over the FROZEN `caughtSnapshot` → diff via a per-session `useRef` → fire the emitter on 0→1 edges only.
- Pure `nextCelebrations(prev, marked, wins)` reducer with the fire-once + ≤2-supernova-budget contract, unit-tested in isolation (8/8 green).

## Task Commits

Each task was committed atomically:

1. **Task 1: BingoCelebration emitter + host (three tiers + reduced-motion)** - `1f7ddb4` (feat)
2. **Task 2: useBingoCelebrations driver + fire-once reducer + App mount** - `b67b973` (feat)

_Task 2 is a `tdd="true"` task: the reducer test was written RED (module-missing failure) before the implementation drove it GREEN; both landed in one commit as the reducer + hook are one unit._

## Files Created/Modified
- `packages/app/src/components/BingoCelebration.tsx` - Module emitter (`showBingoCelebration`/`subscribeBingoCelebration`) + App-level host rendering the three tiers; supernova reuses `ExploreBackground` + a `motion.div` orb-burst.
- `packages/app/src/games/useBingoCelebrations.ts` - App-level driver hook + the pure `nextCelebrations` transition reducer + `initialCelebrationMemo`.
- `packages/app/test/games/useBingoCelebrations.test.ts` - Reducer unit test: first-line-supernova, subsequent-line-badge, corners/X badge, blackout supernova, idempotency, ≤2-supernova budget, mark event.
- `packages/app/src/App.tsx` - Mounts `<BingoCelebration/>` (sibling of `<BackupToast/>`) and calls `useBingoCelebrations()`.
- `packages/app/src/config.ts` - New `config.ui.celebration` timing block (mark 1.8s / badge 2s / supernova 2.7s + orb-burst params).

## Decisions Made
- **Frozen caughtSnapshot, not live dex:** `deriveLiveBoard` is fed `new Set(card.caughtSnapshot)` so the `neverCaught` square can't drift mid-show as tonight's songs land in the dex, keeping live celebrations byte-identical to the replay. The plan text illustrated `liveDexSnapshot`; the frozen set is the stronger `live == replay == catch-up` guarantee and removes a `useDexStats` dependency.
- **Config timing block:** added `config.ui.celebration` rather than scattering ms literals (CLAUDE.md single-config rule).
- **Emoji-in-copy:** all glyphs (✦/✨) come from the shipped `config.copy.games.bingo` strings; song/square/headline are ordinary escaped React text (T-16-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Silent memo-seed on the first per-session derivation**
- **Found during:** Task 2 (driver hook)
- **Issue:** Firing celebrations directly off the first derived board would replay a burst of stamps (and an already-won supernova) on reload / tab switch / catch-up — the exact "fire on presence" failure RESEARCH Pitfall 3 warns against.
- **Fix:** On the first derive for a session, `nextCelebrations` is run from an empty memo and its events are DISCARDED, seeding the memo to current state; only subsequent transitions fire.
- **Files modified:** packages/app/src/games/useBingoCelebrations.ts
- **Verification:** Idempotency + budget covered by the reducer test; hook gates on `lockedAt != null` and a ready `getBingoContext()`.
- **Committed in:** `b67b973` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical correctness guard)
**Impact on plan:** The seed guard is required for correctness (fire-once across renders/reloads). No scope creep; the caught-snapshot decision strengthens the replay-parity invariant.

## Issues Encountered
None. Typecheck clean; the reducer test drove RED→GREEN as expected; full suite 737/737 green.

## Threat Flags
None — no new network endpoints, auth paths, file access, or schema changes. The two register threats (T-16-09 overlay-blocks-logging, T-16-10 XSS in celebration text, T-16-11 duplicate-on-re-render) are mitigated as planned: `pointer-events-none` supernova below `sheetScrim`; escaped React text only; fire-once via `useRef` + per-session supernova budget.

## Known Stubs
None — all three tiers are wired to live board data via `deriveLiveBoard`/`detectWins`; no placeholder or empty-data paths.

## Verification
- `cd packages/app && npx tsc --noEmit` → exit 0.
- `npm test -- --run packages/app/test/games/useBingoCelebrations.test.ts` → 8/8 green (fire-once + ≤2-supernova budget + subsequent-line-is-badge).
- `npm test -- --run` (full suite) → 737/737 green, 93 files.
- Manual (device UAT, tracked separately): stamps throughout; supernova on first line + blackout only; reduced-motion fallback; logging never blocked.

## Next Phase Readiness
- BINGO-05 delivered: three-tier, app-wide, fire-once, ≤2 big moments/show, non-blocking supernova + reduced-motion fallback.
- The emitter/host is a stable seam a future share-card or additional badge tier can extend.
- Device UAT (stamps throughout, supernova on first-line/blackout only, reduced-motion, logging-never-blocked) is the remaining human gate.

---
*Phase: 16-gizz-bingo-build-live-marking-celebrations*
*Completed: 2026-07-21*
