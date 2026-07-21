---
phase: 16-gizz-bingo-build-live-marking-celebrations
plan: 04
subsystem: ui
tags: [react, dexie, bingo, live-marking, show-mode, useLiveQuery]

# Dependency graph
requires:
  - phase: 16-01
    provides: "core nearMiss single-closest one-away detector (estimate.ts)"
  - phase: 16-02
    provides: "deriveLiveBoard (bingoReplay.ts), getBingoContext + dexSnapshot (bingoContext.ts), shared <BingoBoard>"
  - phase: 15
    provides: "BingoCardRow + lockCard/saveDraftCard persistence (db.ts v5)"
provides:
  - "BingoPeekStrip — in-flow LiveGizz board thumbnail + single closest one-away banner (D-21)"
  - "StartShowNudge — dismissible card-less Start-Show prompt (D-08/D-09)"
  - "Start-Show → lockCard connection freezing the caught-set from the live dex (D-07)"
affects: [16-05, 16-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-flow peek strip in the show column, never fixed/over the FAB-orbit (trust-critical seam preserved)"
    - "Decorative shared <BingoBoard> thumbnail: aria-hidden + pointer-events-none so the whole strip is ONE tap target (no nested buttons)"
    - "Transition-surviving nudge: PreShowLauncher fires a callback, ShowView (which stays mounted) owns the nudge state"

key-files:
  created:
    - packages/app/src/show/BingoPeekStrip.tsx
    - packages/app/src/show/StartShowNudge.tsx
  modified:
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/show/PreShowLauncher.tsx

key-decisions:
  - "Nudge rendering lifted to ShowView (survives pre-show→active transition); lock stays in PreShowLauncher per the D-07 trigger contract"
  - "Reduced-motion static ring handled entirely by styles.css .bingo-oneaway-glow — no useReducedMotion wiring needed (would be dead code)"
  - "Peek strip re-derives with the LIVE dex snapshot (deriveLiveBoard contract), never the frozen row.caughtSnapshot"

patterns-established:
  - "Pattern 1: in-flow bingo surface adjacent to CometTrail, guarded to lockedAt != null — a draft never shows on LiveGizz"
  - "Pattern 2: fire-and-forget lockCard AFTER startShow resolves — the lock never blocks/delays the show going active (T-16-08)"

requirements-completed: [BINGO-04]

# Metrics
duration: 20min
completed: 2026-07-21
---

# Phase 16 Plan 04: LiveGizz Bingo Peek Strip + Start-Show Lock/Nudge Summary

**In-flow bingo peek strip (board thumbnail + single closest one-away banner, live-re-derived on every logSong) on the trust-critical LiveGizz screen, plus the Start-Show trigger wired to lock a draft card with the frozen dex caught-set or fire a dismissible card-less nudge.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-21T08:19:00Z
- **Completed:** 2026-07-21T08:26:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `BingoPeekStrip` renders a compact `<BingoBoard thumbnail>` of the live board + the single closest one-away banner (🔥 line / 👑 blackout crown), glowing the exact needed square (D-14), routing to `#/games` on tap — re-derived from `deriveLiveBoard` + `nearMiss` on every render, marks never stored (D-23).
- The strip is mounted in-flow on `ShowView` adjacent to `CometTrail`, guarded to a LOCKED active card only (`lockedAt != null`) via a reactive `db.bingoCards` `useLiveQuery` keyed to the active session — the orbit/FAB/CometTrail are untouched (the setlist log stays sacred).
- Start Show now locks a pre-dealt draft card with the caught-set frozen from the live dex as of lock (Pitfall 1, `[...dexSnapshot(dex)]`), fire-and-forget; with no card it fires the dismissible `StartShowNudge` ([Deal]→GizzGames, [Not now]→per-session dismiss, no persisted suppression, D-08/D-09).

## Task Commits

Each task was committed atomically:

1. **Task 1: BingoPeekStrip — in-flow thumbnail + closest one-away banner** - `f5f23b2` (feat)
2. **Task 2: Mount the peek strip in-flow on ShowView (locked card only)** - `08ef110` (feat)
3. **Task 3: Start-Show lock + dismissible card-less nudge** - `99ef738` (feat)

## Files Created/Modified
- `packages/app/src/show/BingoPeekStrip.tsx` (created) - In-flow LiveGizz board thumbnail + single closest one-away banner; re-derives live via deriveLiveBoard/nearMiss; one min-h-11 tap target → `#/games`.
- `packages/app/src/show/StartShowNudge.tsx` (created) - Dismissible Sheet-based "Deal a bingo card for tonight?" prompt; [Deal]→route, [Not now]→per-session dismiss.
- `packages/app/src/show/ShowView.tsx` (modified) - Reactive locked-card `useLiveQuery`; renders BingoPeekStrip adjacent to CometTrail; owns the nudge state and renders StartShowNudge.
- `packages/app/src/show/PreShowLauncher.tsx` (modified) - Start-Show handler locks a draft card with the frozen dex caught-set (fire-and-forget) or fires the card-less nudge callback.

## Decisions Made
- **Nudge lifted to ShowView, lock kept in PreShowLauncher.** PreShowLauncher unmounts the instant the show goes active, so a nudge owned there would flash and disappear. The lock (a fire-and-forget side effect) stays in PreShowLauncher to honor the D-07 "wrap the Start-Show trigger" contract and the `lockCard`-in-PreShowLauncher acceptance criterion; PreShowLauncher fires an `onStartedWithoutCard(sessionId)` callback and ShowView (which survives the transition) owns the nudge state and rendering.
- **Peek strip uses the LIVE dex snapshot**, not the frozen `row.caughtSnapshot` — this is `deriveLiveBoard`'s documented contract (the growing dex; freezing here would be Pitfall 1). The frozen snapshot is for later replay.
- **Reduced-motion ring:** the plan suggested a `useReducedMotion` static ring, but `styles.css .bingo-oneaway-glow` already renders a static accent outline by default and only adds the pulse inside `@media (prefers-reduced-motion: no-preference)`. Wiring `useReducedMotion` would be dead code, so it was intentionally omitted (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Simplification] Omitted redundant `useReducedMotion` in BingoPeekStrip**
- **Found during:** Task 1 (BingoPeekStrip)
- **Issue:** The plan's task note suggested a "reduced-motion static ring via useReducedMotion". The one-away glow lives on the shared `<BingoBoard>` square via the `.bingo-oneaway-glow` class, which `styles.css` already defines as a STATIC accent ring by default, adding the pulse only inside `@media (prefers-reduced-motion: no-preference)`. Adding a `useReducedMotion()` call in the strip would be an unused value (lint failure) with no behavioral effect.
- **Fix:** Relied on the existing CSS reduced-motion handling; did not import `useReducedMotion`. The reduced-motion static-ring behavior is fully preserved.
- **Files modified:** packages/app/src/show/BingoPeekStrip.tsx
- **Verification:** `npx tsc --noEmit` exits 0; styles.css confirms static-default + no-preference-gated pulse.
- **Committed in:** f5f23b2 (Task 1 commit)

**2. [Rule 2 - Missing Critical / A11y] Board thumbnail made aria-hidden + pointer-events-none**
- **Found during:** Task 1 (BingoPeekStrip)
- **Issue:** The shared `<BingoBoard>` renders each square as a focusable `<button>`. Wrapping the board in an interactive strip control would nest buttons (invalid HTML — browsers auto-close the outer control) and produce 16 spurious tab stops / duplicate AT nodes inside the peek strip.
- **Fix:** Rendered the strip as ONE `role="link"` control (Enter/Space + min-h-11 tap zone) and wrapped the decorative `<BingoBoard>` thumbnail in `aria-hidden` + `pointer-events-none`, so taps fall through to the single strip control and the board's per-square buttons leave the a11y tree. The board's live tap-to-reveal belongs to the full GamesView board, not the peek strip.
- **Files modified:** packages/app/src/show/BingoPeekStrip.tsx
- **Verification:** `npx tsc --noEmit` exits 0; full suite 729 green.
- **Committed in:** f5f23b2 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 simplification/dead-code avoidance, 1 a11y correctness)
**Impact on plan:** Both are local correctness/quality refinements to the peek strip; no scope change, no impact on the plan's contracts or the trust-critical seam.

## Issues Encountered
None — all three tasks typechecked and the full suite (729 tests) passed on the first run after each task.

## Threat Surface
No new security-relevant surface beyond the plan's `<threat_model>`. T-16-06 (escaped React text for kglw-derived labels) is honored — no `dangerouslySetInnerHTML`. T-16-07 (frozen caught-set as an array snapshot at lock) is honored via `[...dexSnapshot(dex)]`. T-16-08 (non-blocking lock/nudge, strip in-flow) is honored — `lockCard` is fire-and-forget after `startShow`, the strip never overlays the FAB/orbit.

## Next Phase Readiness
- BINGO-04's live-access + near-miss half and the D-07 Start-Show lock connection are complete and merge-ready.
- The `deriveLiveBoard`/`nearMiss`/`<BingoBoard>` live-marking surface is now exercised on LiveGizz; Plans 16-05 (celebrations) and 16-06 can build on the locked-card + live-board wiring.
- Manual device UAT (log songs → strip lights + closest one-away; Start Show locks/nudges) is tracked separately for end-of-phase verification.

---
*Phase: 16-gizz-bingo-build-live-marking-celebrations*
*Completed: 2026-07-21*
