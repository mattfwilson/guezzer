---
phase: 16
slug: gizz-bingo-build-live-marking-celebrations
status: draft
nyquist_compliant: false
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
| TBD | — | — | BINGO-01/02/04/05/08 | — | N/A (local-only PWA) | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |

*Populated by the planner/executor per task. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/bingo/estimate.test.ts` — D-10 pre-lock fill estimator, validated against the `bingo-calibrate` Monte-Carlo bands
- [ ] Existing vitest infrastructure covers all remaining phase requirements (no new framework install)

*The one net-new pure-core function (D-10 `estimateFill`) is the primary automated-test target; app UI verifies via jsdom component tests + manual device UAT.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deal + vibe one-tap build, swap sheet, live meter | BINGO-01/02 | Visual/interaction on-device (one-thumb, dark) | Deal each vibe; swap squares; confirm meter reacts + vibe flips to "Custom" |
| Live auto-mark, "one away" glow/banner, celebrations | BINGO-04/05 | Timing/animation + reduced-motion, needs a real logging flow | Log songs; confirm stamps, closest one-away only, supernova on first line + blackout only, reduced-motion fallback |
| Share bingo result-card image | BINGO-08 | Canvas render + native share sheet | Trigger share from recap + GizzGames replay; confirm board + badges + venue/date |

*UI/UX celebration and interaction behaviors verify on-device (iPhone) per the project's device-UAT discipline.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
