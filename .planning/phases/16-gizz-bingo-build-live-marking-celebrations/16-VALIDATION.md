---
phase: 16
slug: gizz-bingo-build-live-marking-celebrations
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-21
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (root `test.projects`: core = node env, app = jsdom) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- --run <changed-file.test.ts>` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <changed-file.test.ts>`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-T1 | 16-01 | 1 | BINGO-02/04/08 | T-16-01 | Honest-number config + era-cutoff check (Pitfall 5) | typecheck | `cd packages/core && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-01-T2 | 16-01 | 1 | BINGO-02/04 | T-16-01 | Pure core, no I/O/DOM/entropy | typecheck | `cd packages/core && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-01-T3 | 16-01 | 1 | BINGO-02/04 | T-16-01 | D-10 trust gate vs Monte-Carlo (honest meter) | unit (core) | `npm test -- --run packages/core/test/bingo/estimate.test.ts` | task-created (Wave 0) | ⬜ pending |
| 16-02-T1 | 16-02 | 1 | BINGO-04 | T-16-02 | Escaped React text; captionMode persistent/tapReveal | typecheck | `cd packages/app && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-02-T2 | 16-02 | 1 | BINGO-04 | T-16-03 | Live snapshot parameterized (not frozen); reindex reused | unit (app) | `npm test -- --run packages/app/test/dex` | reuses existing dex tests | ⬜ pending |
| 16-02-T3 | 16-02 | 1 | BINGO-04 | T-16-02 | Render test both caption modes + aria-pressed | unit (app) | `npm test -- --run packages/app/test/components/BingoBoard.test.tsx` | task-created | ⬜ pending |
| 16-03-T1 | 16-03 | 2 | BINGO-01/04 | T-16-04 | Escaped labels; locked board tapReveal, draft tap-to-swap | typecheck | `cd packages/app && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-03-T2 | 16-03 | 2 | BINGO-02 | T-16-04 | Meter guides never blocks; no red state | typecheck | `cd packages/app && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-03-T3 | 16-03 | 2 | BINGO-02 | T-16-05 | Rebuild valid BingoSquareDef; dedup; escaped chips | unit (app) | `npm test -- --run packages/app/test/games/SwapSheet.test.tsx` | task-created | ⬜ pending |
| 16-04-T1 | 16-04 | 2 | BINGO-04 | T-16-06 | Escaped strip/banner text; in-flow (never over FAB) | typecheck | `cd packages/app && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-04-T2 | 16-04 | 2 | BINGO-04 | T-16-06 | Strip only for locked/active card | unit (app) | `npm test -- --run packages/app/test/show` | reuses existing show tests | ⬜ pending |
| 16-04-T3 | 16-04 | 2 | BINGO-04 (D-07/08/09) | T-16-07 | Freeze caught-set at lock (snapshot not live ref) | typecheck | `cd packages/app && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-05-T1 | 16-05 | 2 | BINGO-05 | T-16-09 | Supernova pointer-events-none below sheetScrim | typecheck | `cd packages/app && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-05-T2 | 16-05 | 2 | BINGO-05 | T-16-11 | Fire-once on 0→1 edge; ≤2 supernovas/show budget | unit (app) | `npm test -- --run packages/app/test/games/useBingoCelebrations.test.ts` | task-created | ⬜ pending |
| 16-06-T1 | 16-06 | 3 | BINGO-08 | T-16-12 | Pure assembler; trophy-only (no lit-by detail) | unit (app) | `npm test -- --run packages/app/test/dex/bingoShareCard.test.ts` | task-created | ⬜ pending |
| 16-06-T2 | 16-06 | 3 | BINGO-08 | T-16-12 | Canvas fillText inert; escaped entry-point text | typecheck | `cd packages/app && npx tsc --noEmit` | N/A (typecheck) | ⬜ pending |
| 16-06-T3 | 16-06 | 3 | BINGO-08 | T-16-13 | Pre-built File on sheet-open; deferred revoke (SAFE-02) | unit (app) | `npm test -- --run packages/app/test/dex` | reuses existing dex tests | ⬜ pending |

*Populated by the planner/executor per task. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Every task carries an automated verify: a dedicated unit test, or a `tsc --noEmit` typecheck gate for UI/config/wiring tasks whose behavior is device-UAT-verified (per the Manual-Only table below). The Nyquist trust anchor is the Wave-0 core test `estimate.test.ts` (16-01-T3) — the D-10 honest-meter gate.*

---

## Wave 0 Requirements

- [ ] `packages/core/test/bingo/estimate.test.ts` — D-10 pre-lock fill estimator, validated against the `bingo-calibrate` Monte-Carlo bands (16-01-T3)
- [ ] `packages/app/test/components/BingoBoard.test.tsx` — shared board render + both caption modes (16-02-T3)
- [ ] `packages/app/test/games/SwapSheet.test.tsx` — dedup + custom-flip + reshuffle-confirm (16-03-T3)
- [ ] `packages/app/test/games/useBingoCelebrations.test.ts` — celebration transition-diff reducer, fire-once + ≤2 budget (16-05-T2)
- [ ] `packages/app/test/dex/bingoShareCard.test.ts` — pure bingo share-data assembly (16-06-T1)
- [ ] Existing vitest infrastructure covers all remaining phase requirements (no new framework install)

*The one net-new pure-core function (D-10 `estimateFill`) is the primary automated-test target; app UI verifies via jsdom component/reducer tests + manual device UAT.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deal + vibe one-tap build, swap sheet, live meter | BINGO-01/02 | Visual/interaction on-device (one-thumb, dark) | Deal each vibe; swap squares; confirm meter reacts + vibe flips to "Custom" |
| Live auto-mark clean stamp + tap-to-reveal, "one away" glow/banner, celebrations | BINGO-04/05 | Timing/animation + reduced-motion, needs a real logging flow | Log songs; confirm clean stamps, tap a stamp re-reveals its lit-by song, closest one-away only, supernova on first line + blackout only, reduced-motion fallback |
| Share bingo result-card image | BINGO-08 | Canvas render + native share sheet | Trigger share from recap + GizzGames replay; confirm board + badges + venue/date |

*UI/UX celebration and interaction behaviors verify on-device (iPhone) per the project's device-UAT discipline.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-21
</content>
</invoke>
