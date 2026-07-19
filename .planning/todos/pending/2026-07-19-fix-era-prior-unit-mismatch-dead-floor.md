---
created: 2026-07-19T04:48:04.422Z
title: "Fix eraPrior unit mismatch — retired-song floor is unreachable"
area: bug
files:
  - packages/core/src/model/predict.ts:280-288
  - packages/core/src/config.ts
---

## Problem

**Severity: MEDIUM (model-quality, not a crash). Found in 2026-07-19 bug-hunt review.**

`eraPrior` compares incommensurate rates: `eraRate = eraPlayCount / eraWindowShows` is plays-per-show (0..~1), while `allTimeRate = basePlayRate(B)` is B's **share of all plays** (~0.004 typical). With `eraPriorSmoothingK = 1`, the ratio `(eraRate + 1) / (allTimeRate + 1)` is ~0.99 for any fully-retired song — so `eraPriorFloor = 0.3` is unreachable dead config, and the signal is boost-only (up to ~2× for hot songs) rather than the documented relative hot-vs-cold multiplier that should penalize retired songs.

Existing unit tests pass only because they use hand-narrowed configs; the backtest ablation quietly shows near-zero impact.

## Solution

Make both sides the same unit — e.g. compare era plays-per-show against career plays-per-show (playCount / total shows in corpus), or normalize both to share-of-plays within their window. Re-derive sensible smoothing/floor/ceiling values afterward and re-run the backtest to confirm the signal now moves ablation numbers. Config knobs live in `packages/core/src/config.ts` (`eraWindowShows: 40`, `eraPriorSmoothingK: 1`, floor 0.3, ceil 2.0).

Run via /gsd-quick; verify with `run-backtest` CLI before/after.
