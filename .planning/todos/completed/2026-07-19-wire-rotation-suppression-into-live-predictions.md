---
created: 2026-07-19T04:48:04.422Z
title: "Wire rotation suppression into live predictions (currently dead)"
area: bug
resolves_phase: 11
files:
  - packages/app/src/show/showContext.ts
  - packages/core/src/model/predict.ts
---

## Problem

**Severity: MEDIUM (model-quality; high impact for the actual 2026 shows). Found in 2026-07-19 research session.**

The rotation-suppression signal (config: `rotationWindowShows: 3`, `rotationPenaltyPerShow: 0.5`) is fully built and tested in core, but the app never feeds it: `buildShowContext` in `showContext.ts` defaults `recentFinalizedShowSongSets = []` with a comment admitting the wiring is "deferred". The live predictor gets zero cross-night data, so on night 2 of a run the app will happily re-predict night 1's setlist.

Community research (2026-07-19) confirmed **no-repeats is stated band policy for residencies** (Red Rocks, Salt Shed '23, The Caverns "4 Nights of No Repeats", 2025 Europe Residency), and both of the owner's 2026 runs — Field of Vision II (Aug 14–16) and Forest Hills (Aug 20–22) — are 3-night runs. Backtest ablation confirms rotation currently barely moves top-5 because it never fires with real data.

## Solution

Feed the last N finalized tracked shows' song sets from Dexie into `buildShowContext`. Consider whether the current `0.5^n` soft penalty is strong enough for stated-policy no-repeat runs (a much harder penalty may be warranted — see the related feature todo "Residency Mode", which builds a full run-aware experience on top of this fix; this todo is the minimal wiring).

Run via /gsd-quick (or fold into the Residency Mode feature if that gets picked up first).
