---
phase: 16-gizz-bingo-build-live-marking-celebrations
plan: 01
subsystem: bingo-core
tags: [bingo, estimate, config, share-stats, calibration-gate]
requires:
  - "packages/core/src/bingo/wins.ts (ROWS/COLS/DIAG geometry, detectWins)"
  - "packages/core/src/bingo/context.ts (BingoContext eraPlayRate/albumSongIds)"
  - "packages/core/src/bingo/generate.ts (deal — for the trust-gate cards)"
  - "packages/core/src/cli/bingo-calibrate.ts (Monte-Carlo means + RECENT_ERA_MIN_YEAR)"
  - "data/bingo-calibration-report.md, data/bingo-roster-candidates.md (fire-rate provenance)"
provides:
  - "estimateFill + nearMiss pure-core helpers (D-10 / D-13/14/15)"
  - "config.bingo.fireRates / eraShowCount / fillMeter (tuned, green trust gate)"
  - "config.copy.games.bingo copy block + config.ui.z.celebration (18) [app config]"
  - "BingoShareCard scope:'bingo' member of ShareCardData (builder deferred to Plan 06)"
  - "wins.ts ROWS/COLS/DIAG_MAIN/DIAG_ANTI/CORNERS/X_INDICES now exported"
affects:
  - "Plans 02-06 (app waves) consume estimateFill/nearMiss + the copy/z-tier/config"
tech-stack:
  added: []
  patterns:
    - "cfg: typeof config = config last-param injection (mirrors mark.ts/wins.ts)"
    - "trust gate replays sim-${vibe}-${i} seeds over real artifacts vs Monte-Carlo means"
key-files:
  created:
    - packages/core/src/bingo/estimate.ts
    - packages/core/test/bingo/estimate.test.ts
  modified:
    - packages/core/src/config.ts
    - packages/core/src/bingo/wins.ts
    - packages/core/src/index.ts
    - packages/core/src/dex/share-stats.ts
    - packages/app/src/config.ts
decisions:
  - "RESEARCH A3 era check RESOLVED: matrix eraPlayCount = trailing 40-show window (cfg.eraWindowShows) != calibration recent-era (year>=2022 = 241 shows) -> song fire-rate is a LABELED APPROXIMATION, divergence recorded in the eraShowCount comment"
  - "consumeOnceDiscount tuned 0.45 -> 1.02: a SINGLE discount suffices (no RESEARCH A2 per-kind escalation); the undercounting song denominator cancels the consume-once overcount, so the factor lands ~1.0"
  - "copy.games.bingo + ui.z.celebration placed in packages/app/src/config.ts (NOT core) — core config holds only pure model constants; the plan's page/toast/sheetScrim reference values confirmed app-config intent"
  - "BingoShareCard union member added now; buildBingoShareCard builder deferred to Plan 06 per plan"
metrics:
  tasks_completed: 3
  files_created: 2
  files_modified: 5
  tests_added: 6
  full_suite: "723 passed"
  completed: 2026-07-21
---

# Phase 16 Plan 01: Bingo Estimate Core, Config & Share Scope Summary

Built the one new pure-core module the phase needs — `estimate.ts` (`estimateFill` + `nearMiss`) — plus every new config constant/copy/z-tier and the `"bingo"` share-scope union member, validated by a green D-10 Monte-Carlo trust gate.

## What shipped

- **`estimateFill(card, ctx, caughtSnapshot, cfg)`** — the pre-lock difficulty meter (D-10/D-11). `expectedMarks ≈ 1 (free) + consumeOnceDiscount · Σ p_s` over the 15 fillable squares; per-square `p_s` by kind (song = `min(1, eraPlayRate/eraShowCount)`, album/event = the corpus fire-rate). Returns `{ expectedMarks, fillFraction, lineLikelihood, blackoutLikelihood }` with likely/possible/unlikely bands.
- **`nearMiss(marked, card, ctx, caughtSnapshot, cfg)`** — the live one-away detector (D-13/14/15). Scans `ROWS`/`COLS`/`DIAG_MAIN`/`DIAG_ANTI` for lines with exactly one unmarked square (tie-break: highest needed-square fill-rate) plus the blackout-minus-one case; blackout crowns a line; four-corners and X are excluded; returns `null` when nothing is one away.
- **`config.bingo.fireRates`** (9 album urls transcribed verbatim from `bingo-roster-candidates.md`, infest 0.801 … lw 0.427; 5 events opener 0.55 / microtonal 0.51 / marathonJam 0.66 / bustOut 0.21 / neverCaught 0.15), **`eraShowCount: 241`**, **`fillMeter`** (tuned `consumeOnceDiscount 1.02`, `lineLikelyThreshold 7.6`, `linePossibleThreshold 6.6`).
- **`config.copy.games.bingo`** — the full 16-UI-SPEC Copywriting Contract (deal heading + 3 vibe labels + 3 gamble hints, swap-sheet title/sections/groups/placeholder, fire-rate + bust-out formatters, custom-vibe label, fill-meter caption/band-labels/expected-marks/amber warning, line one-away + blackout callout, auto-mark toast, three badge toasts, two supernova headlines, Start-Show nudge + actions, locked explainer, reshuffle-confirm quartet). **`config.ui.z.celebration: 18`** (above page 15, below toast 20, strictly below sheetScrim 40).
- **`BingoShareCard`** (`scope: "bingo"`) added to the `ShareCardData` union — canvas-ready flat shape (16 squares row-major, wins, show). Builder deferred to Plan 06.
- **`wins.ts` geometry exported** (`ROWS`/`COLS`/`DIAG_MAIN`/`DIAG_ANTI`/`CORNERS`/`X_INDICES`) — `detectWins` byte-identical; `estimate.ts` reuses the identical geometry (one source, no second copy).

## The trust gate (D-10)

`estimate.test.ts` deals `sim-${vibe}-${i}` cards over the real committed corpus artifacts (matrix/archive/dex-albums, cwd-independent load) and asserts the mean predicted `expectedMarks` per vibe tracks the shipped mid-collection Monte-Carlo means within ±0.75:

| Vibe | Monte-Carlo mean | estimateFill mean (N=200) | Δ |
|------|-----------------|---------------------------|---|
| chill | 7.89 | 8.27 | +0.38 |
| balanced | 7.26 | 7.40 | +0.14 |
| glory | 6.25 | 5.78 | −0.47 |

Line-band mean rank is strictly ordered (chill 2.00 > balanced 1.25 > glory 0.12), matching measured pLine. Four `nearMiss` geometry unit cases pin one-away line detection, the fire-rate tie-break, the blackout crown, and the corners/X exclusion. The assertions use the LITERAL calibration means — not a tautological self-comparison.

## Deviations from Plan

### [Rule 3 — Correct-interpretation] copy/z-tier routed to the app config, not core

- **Found during:** Task 1.
- **Issue:** The plan frontmatter listed only `packages/core/src/config.ts` and its artifacts block said `config.copy.games.bingo` + `config.ui.z.celebration` belong in core config. In reality the core config (`packages/core/src/config.ts`) holds only pure pipeline/model constants and has NO `copy`/`ui` sections — those live in `packages/app/src/config.ts` (UI concerns; core purity forbids UI copy in core).
- **Resolution:** Split correctly — `fireRates`/`eraShowCount`/`fillMeter` (pure model constants read by the pure `estimate.ts`) went into CORE config; `copy.games.bingo` + `ui.z.celebration` went into the APP config. The plan's own reference values (`page 15`, `toast 20`, `sheetScrim 40`) match the app config's `ui.z` tiers exactly, confirming the app-config intent.
- **Files modified:** added `packages/app/src/config.ts` to the change set (not in the plan's `files_modified`).

### [Rule 2 — Honest-number discipline] RESEARCH A3 era check resolved as a LABELED approximation

- **Found during:** Task 1 (the mandated FIRST step).
- **Finding:** `ctx.eraPlayRate` is `MatrixNode.eraPlayCount`, baked by `model/matrix.ts` over the TRAILING `cfg.eraWindowShows = 40` shows before the matrix cutoff. The calibration's recent era is a YEAR cutoff (`RECENT_ERA_MIN_YEAR = 2022`, `bingo-calibrate.ts:59`) spanning 241 shows. The windows DIFFER (40-show trailing ≠ 2022/241-show), so `eraPlayCount / 241` is a deliberate, LABELED under-counting approximation — documented in the `eraShowCount` config comment (both cutoffs named), never silent.

### [Tuning] consumeOnceDiscount 0.45 → 1.02, single discount

- **Found during:** Task 3.
- **Detail:** The seed 0.45 produced means ~4.2/3.8/3.2 (far under target) because the labeled-approximation song denominator under-counts. The tuned single discount (1.02) centers all three vibe means inside ±0.75 (errors +0.37/+0.12/−0.35 at N=500). A single discount sufficed — the RESEARCH A2 per-kind/saturation escalation was NOT needed. Thresholds 7.6/6.6 sit cleanly between the three tuned means.

## Known Stubs

- `BingoShareCard` union member exists with no builder yet — `buildBingoShareCard` is intentionally deferred to Plan 06 (documented in the type's doc comment and the plan's `<action>`). Not a blocking stub: no app surface renders a bingo share card this plan.

## Verification

- `cd packages/core && npx tsc --noEmit` — exit 0.
- `npm test -- --run packages/core/test/bingo/estimate.test.ts` — 6/6 green (the trust gate).
- `npm test -- --run` (full suite) — 723 passed, 0 failed (no regression; the `wins.ts` export-only change kept `detectWins` byte-identical).
- `packages/app` typecheck — exit 0 (app config edits compile).

## Self-Check: PASSED

- All created files exist: `estimate.ts`, `estimate.test.ts`.
- All modified files present: `config.ts` (core), `wins.ts`, `index.ts`, `share-stats.ts`, `config.ts` (app).
- All task commits found: `11b98a0` (Task 1), `d36e178` (Task 2), `ab56b38` (Task 3).
