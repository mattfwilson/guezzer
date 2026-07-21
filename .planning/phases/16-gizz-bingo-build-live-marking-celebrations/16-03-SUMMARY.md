---
phase: 16-gizz-bingo-build-live-marking-celebrations
plan: 03
subsystem: ui
tags: [react, dexie, bingo, gizz-bingo, fuse.js, deal, swap, fill-meter]

# Dependency graph
requires:
  - phase: 16-01
    provides: estimateFill/FillEstimate + config.bingo (fireRates, albumSquarePool, eraShowCount, fillMeter) + config.copy.games.bingo
  - phase: 16-02
    provides: getBingoContext/dexSnapshot, shared <BingoBoard> (captionMode + onSquareTap), deriveLiveBoard
  - phase: 14
    provides: pure core deal() generator + BingoCard contract + deriveMarks/detectWins
  - phase: 15
    provides: saveDraftCard/lockCard/BingoCardRow persistence, GamesView replay-only shell
provides:
  - "DealScreen — three vibe buttons that ARE the deal (D-01), deal()+resolve labels+saveDraftCard"
  - "FillMeter — pure pre-lock difficulty meter fed by estimateFill (D-10/D-11/D-12)"
  - "SwapSheet — sectioned Events/Albums/Songs/Search swap sheet with covers, fire-rate hints, dedup, reshuffle-confirm (D-02/D-04/D-05/D-06)"
  - "GamesView state machine — deal -> draft board+meter+swap -> locked live board (deriveLiveBoard, tapReveal)"
  - "bingoLabels — app label bridge (real song/album names) + deterministic isCardCustom flip"
affects: [16-04, 16-05, gizz-bingo, live-marking, celebrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App label bridge: resolve pure-card placeholder labels (Song N / albumUrl) to real names via shipped matrix + dex-albums, frozen at deal/swap time (D-08)"
    - "Deterministic custom-vibe detection: isCardCustom compares a card's identity signature to a re-deal of its own seed/vibe/corpusVersion (D-21) — persistent, label-independent"
    - "Callback-injected editing surface: SwapSheet takes onApplySwap/onReshuffle so it is Dexie-free and jsdom-testable; GamesView owns saveDraftCard"

key-files:
  created:
    - packages/app/src/games/DealScreen.tsx
    - packages/app/src/games/FillMeter.tsx
    - packages/app/src/games/SwapSheet.tsx
    - packages/app/src/games/bingoLabels.ts
    - packages/app/test/games/SwapSheet.test.tsx
  modified:
    - packages/app/src/games/GamesView.tsx

key-decisions:
  - "Resolve real display labels onto every square at deal/swap time (Rule 2) — the pure deal() generator freezes placeholder labels (Song 132, albumUrl); a board full of Song N is a broken UI"
  - "isCardCustom derives the Custom flip from a re-deal comparison rather than component state, so it survives reload and needs no extra persistence"
  - "Reshuffle lives inside SwapSheet (reached by tapping a square) — keeps the destructive confirm testable in SwapSheet.test and avoids a new component file"
  - "DealScreen ensures a session via getActiveShow ?? startShow (D-07 pre-show deal)"

patterns-established:
  - "Pure presentational meter (FillMeter) taking a core estimate prop; owner (GamesView) holds the memo"
  - "Consume-once dedup by identity key (song:id / album:url / event:kind) greying on-card candidates"

requirements-completed: [BINGO-01, BINGO-02, BINGO-04]

# Metrics
duration: 65min
completed: 2026-07-21
---

# Phase 16 Plan 03: Gizz Bingo Build & Live-Marking (GamesView) Summary

**The GizzGames tab now deals a real 4×4 card per vibe with a live honest fill meter, per-square swap + reshuffle from a sectioned sheet with cover art and measured fire-rates, and renders the locked live-marking board (clean stamp + tap-to-reveal) — replacing the Phase-15 "coming soon" stub.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-07-21T08:20:00Z
- **Completed:** 2026-07-21T08:35:00Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- DealScreen: three `bg-elevated` vibe buttons that ARE the deal (D-01) — tap → `deal()` → resolve real labels → `saveDraftCard` for the active session (pre-show via `getActiveShow ?? startShow`, D-07).
- FillMeter: pure readout of `estimateFill` — fill bar, honest `~N/15` figure, both-odds caption, amber `#F59E0B` (never red) below the likely-line threshold with a quiet non-blocking warning (D-12).
- SwapSheet: sectioned Events → Albums → Songs (Likely/Stretch) → Search; honest fire-rate % hints (bust-out 🌟), bundled cover art degrading to a text chip, consume-once dedup greying on-card items, single-square swap keeping 16 squares + free (T-16-05), reshuffle-confirm on custom swaps (`#ef4444`, D-06) else silent re-deal.
- GamesView state machine: no card → DealScreen; unlocked draft → FillMeter + draft `<BingoBoard onSquareTap=openSwap>` + SwapSheet with the vibe label flipping to "Custom" (D-04); locked+active → live `<BingoBoard captionMode="tapReveal">` over `deriveLiveBoard` (clean stamp + tap-to-reveal, D-16). Replay list + empty state unchanged.

## Task Commits

1. **Task 2: FillMeter fed by estimateFill** - `b693938` (feat)
2. **Task 3: SwapSheet + label bridge + test (TDD)** - `4c3c8fd` (feat, test co-committed)
3. **Task 1: DealScreen + GamesView state machine + locked tap-reveal** - `d502943` (feat)

_Commit order sequences leaf components before the GamesView integration so every committed snapshot builds; commit messages map to task numbers._

## Files Created/Modified
- `packages/app/src/games/DealScreen.tsx` - Three vibe buttons = the deal (D-01); deal + resolve labels + saveDraftCard.
- `packages/app/src/games/FillMeter.tsx` - Pure pre-lock difficulty meter fed by core `estimateFill`.
- `packages/app/src/games/SwapSheet.tsx` - Sectioned swap/reshuffle sheet (covers, fuse search, dedup, confirm).
- `packages/app/src/games/bingoLabels.ts` - App label bridge (real song/album names) + `isCardCustom` deviation check.
- `packages/app/src/games/GamesView.tsx` - Deal/draft/live state machine replacing the coming-soon teaser.
- `packages/app/test/games/SwapSheet.test.tsx` - Dedup + custom-flip + reshuffle-confirm + silent-reshuffle (4 tests).

## Decisions Made
- **Resolve real labels at deal/swap time (Rule 2).** The pure core `deal()` freezes placeholder labels (`Song 132`, raw `albumUrl`) because core has no name catalog. A board rendering "Song 132" is effectively a stub, so `bingoLabels.resolveCardLabels` stamps real song names (matrix) and album titles (dex-albums shelf) onto each square before persisting, preserving the D-08 frozen-label discipline. SwapSheet builds its candidates with the same maps so swapped-in and dealt squares read consistently.
- **Custom flip is derived, not stored.** `isCardCustom` re-deals the card's own `seed`/`vibe`/`corpusVersion` (D-21) and compares label-independent identity signatures — deterministic, reload-safe, no extra persistence.
- **Reshuffle inside SwapSheet.** Keeps the only destructive control (D-06 confirm) unit-testable in `SwapSheet.test.tsx` and avoids introducing an unplanned component file. Reached by tapping any draft square.
- **DealScreen ensures a session** via `getActiveShow ?? startShow` so a card can be dealt pre-show (D-07); lock stays a later Start-Show trigger (Phase-15 `lockCard`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Real display-label resolution for card squares**
- **Found during:** Task 1 (DealScreen/GamesView board wiring)
- **Issue:** The pure core `deal()` generator freezes placeholder labels (`Song 132`, `albumUrl`) — the shared `<BingoBoard>` renders `def.label`, so dealt/replayed boards would show "Song 132" and raw album URLs, a broken UI that fails the "complete, never-blank card" spirit of BINGO-01.
- **Fix:** Added `packages/app/src/games/bingoLabels.ts` — `getBingoNameMaps` (songId→name from the matrix catalog, albumUrl→title from the dex-albums shelf) + `resolveCardLabels` applied after every `deal()` and every swap, keeping the card shape/schema intact (D-08 frozen labels). SwapSheet builds candidates with the same maps.
- **Files modified:** packages/app/src/games/bingoLabels.ts (new), DealScreen.tsx, SwapSheet.tsx, GamesView.tsx
- **Verification:** `tsc --noEmit` clean; SwapSheet.test asserts resolved names render; full suite 733 green.
- **Committed in:** `4c3c8fd` (bingoLabels + SwapSheet) and `d502943` (DealScreen/GamesView wiring)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The label bridge is required for a non-stub board and is the only app-side name source SwapSheet also needs; no scope creep — no new endpoints, no schema change, pure app-layer resolution over already-shipped artifacts.

## Issues Encountered
- The `balanced` deal consumes all five event singletons, so the first custom-flip test (swap in an off-card event) had no enabled event candidate. Resolved by expanding the test fixture to 20 recent-era songs and swapping in an off-card song instead — a deterministic enabled candidate.

## Threat Flags
None — no new network endpoints, auth paths, or schema changes. Swap search stays client-only fuse.js (T-16-04 escaped React text preserved); the swapped square rebuilds a valid `BingoSquareDef` keeping 16 squares + free (T-16-05).

## Known Stubs
None. The `neverCaught` hint label resolves any embedded `Song N` token via the same name map; all rendered card content is real.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Build-agency + GamesView live-marking half are complete; the draft board (tap-to-swap), meter, reshuffle, and the locked live board (tapReveal) are wired off the memoized `getBingoContext` foundation.
- Ready for Plan 04/05: one-away banner + glow, mark/badge toasts, supernova celebration, peek strip, and the Start-Show lock/nudge trigger that flips a draft into the locked live board.

## Self-Check: PASSED

---
*Phase: 16-gizz-bingo-build-live-marking-celebrations*
*Completed: 2026-07-21*
