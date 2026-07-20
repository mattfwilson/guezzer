---
phase: 14-gizz-bingo-core-marking-generation
plan: 06
subsystem: testing
tags: [bingo, calibration, monte-carlo, config, vitest, gate]

# Dependency graph
requires:
  - phase: 14-05
    provides: bingo-calibrate CLI (real-fold Monte-Carlo + hard-assert gate), buildRosterCandidates
  - phase: 14-01
    provides: config.bingo scaffold (empty rosters, [ASSUMED] bands)
provides:
  - Locked config.bingo constants (jamVehicleSongIds, albumSquarePool, freeIndex, bustOutGapShows, per-vibe mix + bands)
  - GATE 2 cleared — calibration gate exits 0 with the locked constants
  - Amended D-02/D-03 winnability bands retargeted to the engine's measured range
  - Regenerated data/bingo-calibration-report.md + data/bingo-calibration.json
affects: [15-bingo-persistence, 16-bingo-ui, gizzgames]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retarget-to-measured-range when an authored target is proven structurally unreachable (amend the locked decision with dated evidence, keep originals as superseded)"
    - "Upper-cap-only gate band when a floor metric is unreachable (never gate on an eternally-red floor)"

key-files:
  created:
    - data/bingo-calibration-report.md
    - data/bingo-calibration.json
  modified:
    - packages/core/src/config.ts
    - packages/core/src/cli/bingo-calibrate.ts
    - packages/core/test/config.test.ts
    - packages/core/test/bingo/context.test.ts
    - packages/core/test/bingo/calibrate.test.ts
    - .planning/phases/14-gizz-bingo-core-marking-generation/14-CONTEXT.md

key-decisions:
  - "D-02/D-03 AMENDED (user Option 1): line targets retargeted chill 0.42 / balanced 0.35 / glory 0.20; blackout floors removed (unreachable), only per-vibe upper cap kept"
  - "Original 0.82/0.70/0.50 line targets + balanced/glory blackout floors proven structurally unreachable under D-11 consume-once single-show marking"
  - "Rosters locked verbatim from owner sign-off: 9 jam vehicles, 9 albums, freeIndex=5, bustOutGapShows=50"

patterns-established:
  - "Amend-with-evidence: a locked CONTEXT decision proven unreachable is superseded (not deleted) with a dated rationale + measured-ceiling table"

requirements-completed: [BINGO-03]

# Metrics
duration: ~40min
completed: 2026-07-20
---

# Phase 14 Plan 06: Bingo Calibration Lock + D-02/D-03 Retarget Summary

**Locked the owner-approved bingo rosters/mix into config.bingo and cleared GATE 2 by retargeting the D-02/D-03 winnability bands to the engine's real measured range (chill 42.4% > balanced 32.4% > glory 19.9% P(line), blackout ~0) after the original targets were proven structurally unreachable under D-11 consume-once marking.**

## Performance

- **Duration:** ~40 min (Task 3 continuation)
- **Completed:** 2026-07-20
- **Tasks:** Task 3 of 3 (Tasks 1–2 completed in prior passes)
- **Files modified:** 6 (2 created)

## ⚠️ Headline: D-02/D-03 Amendment (user-authorized Option 1)

This plan did **not** execute D-02/D-03 as originally written. At the D-20 gate a prior
pass **proved GATE 2 structurally unreachable** under the locked D-11 consume-once
single-show marking rule: with exactly one mark per logged song over a median-15-song
show, the engine's true achievable ceiling is far below the authored targets, and
P(blackout) collapses to ~0.00 in *every* reachable mix. No mix-weight assignment can
close a 30–40-point line gap or manufacture an unreachable blackout floor.

The **user authorized Option 1** — retarget the bands to the engine's real measured
range, preserving the chill > balanced > glory ordering with meaningful separation, and
finish the lock against a genuinely green gate (not a loosened/out-of-band one).

**Measured-ceiling evidence (mid-collection dex, 241 recent-era shows, 500 cards/vibe):**

| Vibe | Orig. P(line) target | Max achievable P(line) | Orig. P(blackout) target | Max achievable P(blackout) |
|---|---|---|---|---|
| Chill | ~0.82 | ~0.42 | rare cap | ~0.00 |
| Balanced | ~0.70 | ~0.37 | 0.02–0.05 floor | ~0.00 |
| Glory | ~0.50 | ~0.22 | 0.05–0.10 floor | ~0.00 |

**Retargeted bands now LOCKED (gate-green):**

- **P(line)** (± 0.05 tol): **chill 0.42 / balanced 0.35 / glory 0.20**. Measured at lock:
  **chill 42.4% / balanced 32.4% / glory 19.9%** — ordering intact, ~10pt and ~12.5pt
  separation, each comfortably inside its band.
- **P(blackout):** balanced/glory **floors REMOVED** (the crown is never mandatory); only a
  small **upper cap** per vibe (`blackoutMax`: chill 0.02 / balanced 0.03 / glory 0.05).
  Measured ~0.00 clears all three.
- **D-05 dark-floor UNCHANGED and still enforced** — every reliable event/album square clears
  the ≥20% floor in the gated run (lowest ≈ 44%); bustOut + neverCaught EXEMPT (D-15).

The amendment is recorded in `14-CONTEXT.md` under D-02/D-03 with the original values kept
visible as ~~struck~~ superseded text for auditable decision history.

## Accomplishments

- Locked owner-approved constants into `config.bingo`:
  - `jamVehicleSongIds`: `[132, 47, 227, 104, 168, 172, 75, 19, 93]`
  - `albumSquarePool`: 9 albums (`/albums/<slug>` keys matching `ctx.albumSongIds`)
  - `freeIndex: 5`, `bustOutGapShows: 50`
  - Per-vibe `mix` weights (chill album-heavy for max P(line); glory bustOut/neverCaught-heavy; balanced between)
- Retargeted `config.bingo.vibes` bands + simplified the gate's `blackoutBand()` to upper-cap-only
- Manually iterated the Monte-Carlo (no automated optimizer) to land each vibe in-band with ordering + D-05 held
- Regenerated `data/bingo-calibration-report.md` + `data/bingo-calibration.json`
- Stamped every locked value `[VERIFIED: bingo-calibrate gate 2026-07-20]`
- Upgraded/fixed tests: `config.test.ts` (non-empty rosters + mix present + ordering), plus fixture repairs in `context.test.ts` and `calibrate.test.ts` for the non-empty rosters + new blackout caps

## Task Commits

1. **Task 1: Generate roster candidates** — `1d9dd87` (prior pass, docs)
2. **Task 2: Human roster + dex-model sign-off** — checkpoint (no commit; approval recorded in prompt)
3. **Task 3 (this pass), grouped atomically:**
   - CONTEXT D-02/D-03 amendment — `fe84268` (docs)
   - Config lock + gate retarget — `e505d7c` (feat)
   - Regenerated calibration outputs — `dd956be` (chore)
   - Test upgrade + fixture fixes — `62b56d6` (test)

## Files Created/Modified

- `packages/core/src/config.ts` — locked rosters, freeIndex, bustOutGapShows, per-vibe mix + retargeted bands; JSDoc stamped VERIFIED
- `packages/core/src/cli/bingo-calibrate.ts` — `blackoutBand()` simplified to upper-cap-only (D-03 amendment)
- `packages/core/test/config.test.ts` — locked-roster + mix-present + line-ordering assertions
- `packages/core/test/bingo/context.test.ts` — default config now ships the locked jam roster; override/empty pass-through retained
- `packages/core/test/bingo/calibrate.test.ts` — greenResult() blackout under new per-vibe caps; stale comment updated
- `data/bingo-calibration-report.md`, `data/bingo-calibration.json` — regenerated against the green gate
- `.planning/phases/14-.../14-CONTEXT.md` — D-02/D-03 dated amendment + evidence table

## Decisions Made

- **Retarget over re-engineer:** per the user's Option 1 and the plan guardrails, the marking
  engine (mark.ts consume-once, D-11) and deal generator were NOT touched — this was a band
  retarget only. The bands reflect real achievable per-vibe rates, not a loosened gate.
- **Upper-cap-only blackout:** removed the eternally-red balanced/glory floors rather than gate
  on an unreachable metric; retained small caps so the crown stays rare, never mandatory.
- **Clean anchor targets:** kept targets at the round anchors (0.42/0.35/0.20); all three
  measured values land within ≤2.6 pts (well inside the ±5 tolerance), so no odd-precision
  targets were needed. The sim is fully seeded/deterministic, so measured P(line) is byte-stable
  run-to-run — the ±0.05 tolerance is a design margin, not noise absorption.

## Deviations from Plan

The entire Task 3 was executed under an **authorized amendment** to the locked D-02/D-03
CONTEXT decisions (user Option 1) — see the headline section. This is the documented
"retarget bands" path, not silent scope drift.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired synthetic gate fixtures broken by the new bands**
- **Found during:** Task 3 (full-suite verification after the config/gate retarget)
- **Issue:** `calibrate.test.ts`'s `greenResult()` set glory `pBlackout: 0.07`, which exceeds the
  new glory cap (0.05), so the "green" fixture no longer passed the gate; `context.test.ts`
  asserted an empty default jam roster, now non-empty (9 songs).
- **Fix:** Set fixture blackout values under the new per-vibe caps; updated the context test to
  assert the locked roster flows through (kept empty/override pass-through as an explicit override case).
- **Files modified:** `packages/core/test/bingo/calibrate.test.ts`, `packages/core/test/bingo/context.test.ts`
- **Verification:** `npx vitest run` → 682 passed.
- **Committed in:** `62b56d6`

---

**Total deviations:** 1 auto-fixed (blocking fixture repair), plus 1 pre-authorized
architectural-scope amendment (D-02/D-03 retarget, user Option 1).
**Impact on plan:** No scope creep. Engine untouched; the amendment is the explicit
user-chosen path and is fully documented in CONTEXT with evidence.

## Issues Encountered

- The objective cited best-achievable P(line) of chill 0.43 / balanced 0.37 / glory 0.22. The
  initial mixes measured lower (chill 30.3% / balanced 17.5%); pushing chill/balanced album-heavy
  (album is the highest-fire square kind, ~85–95%) recovered the ceiling. Balanced was tuned
  down from an over-close 37.7% (only 4.7pt from chill) to a well-separated 32.4% for a meaningful
  chill > balanced gap.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- GATE 2 is cleared: `node packages/core/src/cli/bingo-calibrate.ts` exits 0, full suite green (682).
- config.bingo is fully locked and pinned by `config.test.ts` — Phase 15 (persistence) and Phase 16
  (UI) can rely on the constants and the winnability bands as stable inputs.
- Downstream note: any future engine change (e.g. re-enabling multi-mark or a segue square) would
  shift the achievable P(line)/P(blackout) ceiling and require re-running the gate + re-amending
  the bands.

## Self-Check: PASSED

- Files verified present + non-empty: `data/bingo-calibration-report.md`, `data/bingo-calibration.json`, `packages/core/src/config.ts`, `14-06-SUMMARY.md`
- Commits verified in git log: `fe84268`, `e505d7c`, `dd956be`, `62b56d6`
- Gate: `node packages/core/src/cli/bingo-calibrate.ts` exits 0
- Suite: `npx vitest run` → 682 passed (85 files)

---
*Phase: 14-gizz-bingo-core-marking-generation*
*Completed: 2026-07-20*
