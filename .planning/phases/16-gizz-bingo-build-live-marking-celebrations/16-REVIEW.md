---
phase: 16-gizz-bingo-build-live-marking-celebrations
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - packages/core/src/bingo/estimate.ts
  - packages/core/src/bingo/wins.ts
  - packages/core/src/config.ts
  - packages/core/src/dex/share-stats.ts
  - packages/core/src/index.ts
  - packages/core/test/bingo/estimate.test.ts
  - packages/app/src/App.tsx
  - packages/app/src/components/BingoBoard.tsx
  - packages/app/src/components/BingoCelebration.tsx
  - packages/app/src/config.ts
  - packages/app/src/dex/RecapView.tsx
  - packages/app/src/dex/shareCard.ts
  - packages/app/src/games/DealScreen.tsx
  - packages/app/src/games/FillMeter.tsx
  - packages/app/src/games/GamesView.tsx
  - packages/app/src/games/SwapSheet.tsx
  - packages/app/src/games/bingoContext.ts
  - packages/app/src/games/bingoLabels.ts
  - packages/app/src/games/bingoReplay.ts
  - packages/app/src/games/useBingoCelebrations.ts
  - packages/app/src/show/BingoPeekStrip.tsx
  - packages/app/src/show/PreShowLauncher.tsx
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/show/StartShowNudge.tsx
  - packages/app/src/styles.css
  - packages/app/test/components/BingoBoard.test.tsx
  - packages/app/test/dex/bingoShareCard.test.ts
  - packages/app/test/games/SwapSheet.test.tsx
  - packages/app/test/games/useBingoCelebrations.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 16 builds Gizz-Bingo's live-marking + celebration layer on top of the shipped
pure marking geometry. Core purity is respected (estimate.ts imports only core;
no DOM/entropy). The celebration reducer is well-factored and pure, the share
projection is clean, and the swap/reshuffle surface is well-guarded.

One BLOCKER: the two LIVE surfaces that render a **locked** card's board (the
trust-critical LiveGizz peek strip and the GamesView games board) derive the board
with the **live, growing** dex snapshot, while the celebration driver and the
post-show replay both use the **frozen** `caughtSnapshot`. This breaks the phase's
central "live == replay == catch-up" invariant on the `neverCaught` square and can
show the user a board that visibly contradicts the celebration that just fired.

Remaining findings are config-discipline, budget, and consistency issues.

## Critical Issues

### CR-01: Locked bingo board derives from the LIVE dex snapshot, not the frozen `caughtSnapshot` — peek strip + games board diverge from celebrations and replay

**Files:**
- `packages/app/src/show/BingoPeekStrip.tsx:51-55`
- `packages/app/src/games/GamesView.tsx:108, 155-160`
- `packages/app/src/show/ShowView.tsx:506-508` (does not forward the frozen snapshot)

**Issue:**
For a **locked, active** card, `deriveMarks`' `neverCaught` predicate must read the
snapshot frozen at Start Show (`row.caughtSnapshot`) so it "can't drift mid-show as
tonight's songs land in the dex" — this is stated verbatim in
`useBingoCelebrations.ts:20-24, 201-203` (which correctly passes
`new Set(card.caughtSnapshot)`) and in `bingoReplay.ts` / `PreShowLauncher.tsx`
(replay uses `row.caughtSnapshot`).

But the two live-board surfaces pass the **live** dex snapshot instead:

- `BingoPeekStrip.tsx:53-55` — `const caught = dexSnapshot(dex); deriveLiveBoard(card, entries, ctxResult.ctx, caught)` where `dex` is `useDexStats()` (the growing dex). The strip only receives `card` (a pure `BingoCard`), never the row, so it has no access to the frozen snapshot.
- `GamesView.tsx:108,155-160` — `snapshot = dexSnapshot(stats.dex)` is passed to `deriveLiveBoard(activeCard.card, unlocked ? [] : sessionEntries, ctx, snapshot)` for the **locked** branch too.

I confirmed the divergence is live-visible, not latent: `deriveDex`
(`derive-dex.ts:110-141`) groups **all** `trackedShows` with **no status filter** and
counts their `trackedEntries` as sightings, so `useDexStats` includes the active
(in-progress) show's just-logged songs. Consequently, once a song that fills a
`neverCaught` square is logged tonight, the live snapshot contains it →
`squareMatches(... neverCaught ...)` returns `false` (`mark.ts:91-94`) → the peek
strip / games board show that square **unmarked**, while `useBingoCelebrations`
(frozen snapshot) **fires the "✦ … lit …!" mark celebration** and the eventual
`RecapView` replay (frozen) shows it **marked**. A direct, visible contradiction on
the sacred LiveGizz screen — exactly the "live == replay == catch-up" failure the
frozen snapshot exists to prevent.

**Fix:**
Use the frozen snapshot whenever the card is locked; only an unlocked draft (which
is derived over an empty trail anyway) may use the live snapshot.

```tsx
// GamesView.tsx — locked board must use the frozen snapshot
const boardCaught = unlocked
  ? snapshot
  : new Set<number>(activeCard.caughtSnapshot);
const board = deriveLiveBoard(
  activeCard.card,
  unlocked ? [] : sessionEntries,
  ctx,
  boardCaught,
);
```

```tsx
// ShowView.tsx — forward the frozen snapshot to the peek strip
{bingoCardRow != null && bingoCardRow.lockedAt != null && (
  <BingoPeekStrip
    card={bingoCardRow.card}
    caughtSnapshot={bingoCardRow.caughtSnapshot}
    entries={session.entries}
  />
)}
```

```tsx
// BingoPeekStrip.tsx — accept + use the frozen snapshot (locked card only)
const caught = new Set<number>(caughtSnapshot);
const board = deriveLiveBoard(card, entries, ctxResult.ctx, caught);
const miss = nearMiss(board.marked, card, ctxResult.ctx, caught);
```

## Warnings

### WR-01: `estimateFill` blackout-band thresholds are hardcoded magic numbers, violating the single-config-file constraint

**File:** `packages/core/src/bingo/estimate.ts:153-155`

**Issue:**
```ts
const blackoutLikelihood: FillBand =
  expectedMarks >= 15.5 ? "likely" : expectedMarks >= 14 ? "possible" : "unlikely";
```
The line thresholds correctly read `cfg.bingo.fillMeter.lineLikelyThreshold` /
`linePossibleThreshold`, but the blackout thresholds `15.5` and `14` are inlined.
This contradicts both this module's own header ("All numeric constants … live in
`cfg.bingo.fireRates`/`eraShowCount`/`fillMeter` — never inlined here") and the
CLAUDE.md constraint ("All model constants … in a single config file — no scattered
magic numbers"). `cfg.bingo.fillMeter` has no blackout keys.

**Fix:** Add `blackoutLikelyThreshold` / `blackoutPossibleThreshold` to
`config.bingo.fillMeter` and read them here, mirroring the line-band pattern.

### WR-02: Mark/badge celebration toast is not `pointer-events-none` — can intercept taps over the bottom strip during live marking

**File:** `packages/app/src/components/BingoCelebration.tsx:191-209`

**Issue:**
The supernova overlay is carefully `pointer-events-none` (line 219) so "the live
logging loop is never blocked (the loop is sacred)". The mark/badge toast — which
fires on **every** logged song that lights a square, and stacks over rapid catch-up
marks — is a full-width opaque `fixed inset-x-0 bottom-16` bar with **no**
`pointer-events-none`. It carries only `role="status"` text (no interactive
content), yet for its 1.8–2s lifetime it can absorb a tap landing in the bottom
region on the LiveGizz screen. The phase constraint is explicit: "celebrations must
be non-blocking and never intercept taps." The asymmetry with the supernova (which
got the guard) suggests this was an oversight.

**Fix:** Add `pointer-events-none` to the toast `motion.div` (it has no tappable
content, so this is safe and matches the non-blocking contract).

### WR-03: Supernova stays on-screen ~3.5s, exceeding the documented 2–3s non-blocking budget

**File:** `packages/app/src/components/BingoCelebration.tsx:167, 224`

**Issue:**
`setSupernova(null)` is scheduled at `SUPERNOVA_MS` (2700ms), and only then does the
`AnimatePresence` exit fade of `SUPERNOVA_FADE_MS` (800ms) play. Total on-screen
time ≈ 3.5s. `config.ui.celebration` documents the intended timeline as
"bloom-in ~400ms / hold ~1.5s / fade-out ~800ms (≤2.7s, inside the D-17 non-blocking
2–3s budget)" — i.e. the 800ms fade was meant to be *inside* the 2700ms, not appended
after it. The fade-out is effectively double-counted. Non-blocking (pointer-events-none),
so not a functional block, but it overshoots the stated budget.

**Fix:** Schedule the dismiss at `SUPERNOVA_MS - SUPERNOVA_FADE_MS`, or fold the
fade into `SUPERNOVA_MS`.

### WR-04: FillMeter bar fraction (÷16, includes free) is inconsistent with the "~N/15" figure and the progressbar aria values (÷15, excludes free)

**File:** `packages/app/src/games/FillMeter.tsx:37, 41, 63-65`

**Issue:**
`widthPct = round(estimate.fillFraction * 100)` where `fillFraction = expectedMarks/16`
(free cell in the numerator, ÷16 denominator). The figure and the ARIA values use a
different basis: `fillableMarks = round(expectedMarks - 1)` out of `aria-valuemax={15}`.
So the visual bar can read ~50% while the caption/screen-reader report "~7/15"
(≈47%). Two denominators for the same meter is a low-grade but real inconsistency in
what the control communicates.

**Fix:** Drive the bar width from the same fillable basis as the figure
(`fillableMarks / 15`) so the bar, the "~N/15" figure, and the progressbar ARIA all
agree.

## Info

### IN-01: `nearMiss` / `useBingoCelebrations` index `marked.squares[boardIndex]` positionally, unlike `wins.ts` which deliberately resolves by `square.index`

**Files:** `packages/core/src/bingo/estimate.ts:186, 208, 217`; `packages/app/src/games/useBingoCelebrations.ts:227`

**Issue:**
`wins.ts:43-55` explicitly resolves marked squares by each square's own `.index`
"so array order is irrelevant." `nearMiss` and the celebration hook instead assume
`marked.squares[i].index === i` (positional access). This holds today because
`deriveMarks` builds the array in board-index order (`mark.ts:119`), so it is not a
live bug — but the two modules disagree on the invariant, and if the fold ever emits
squares out of board order, `nearMiss`/celebrations would break silently while
`detectWins` stayed correct.

**Fix:** Either add a comment pinning the "squares are board-index-ordered"
invariant at both call sites, or resolve by `.index` for consistency with `wins.ts`.

### IN-02: SwapSheet dedup set includes the currently-tapped square's own identity

**File:** `packages/app/src/games/SwapSheet.tsx:139-142, 260`

**Issue:**
`onCardKeys = new Set(card.squares.map(keyForDef))` includes the def at
`squareIndex` (the square being replaced), so the identity you are currently
swapping renders disabled among the candidate list. Harmless (you simply can't
"swap to itself"), but slightly surprising UX.

**Fix (optional):** Exclude `squareIndex` when building the dedup set so the tapped
square's own identity is not greyed out.

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
