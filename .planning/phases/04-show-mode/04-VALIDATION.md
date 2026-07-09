---
phase: 4
slug: show-mode
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
bound_at: 2026-07-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Task IDs bound (2026-07-09):** each requirement below is mapped to the plan · task that creates its test (Wave-0 test files are folded RED-first into the TDD/impl tasks that own them, not a separate wave). `nyquist_compliant: true` — every implementation task has an automated verify or a manual-only justification. `wave_0_complete: false` is intentional: execution has not run yet; it flips true when the Wave-0-equivalent RED tests are first committed green.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`test.projects`: core=`node`, app=`jsdom` + `fake-indexeddb/auto`) |
| **Config file** | `vitest.config.ts` (root) — already wired from Phase 3 |
| **Quick run command** | `npx vitest run packages/app` (or `packages/core`) |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/<pkg-touched>`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

Requirement → test binding, with the owning plan · task. Every requirement has an automated test except SHOW-12/SHOW-13 (manual/device, justified below).

| Requirement | Behavior | Test Type | Automated Command | File | Owning Plan · Task | Status |
|-------------|----------|-----------|-------------------|------|--------------------|--------|
| SHOW-04 | `searchCatalog` fuzzy-matches a known song, tolerates a typo, empty→[] | unit (core, node) | `npx vitest run packages/core -t "searchCatalog"` | `packages/core/test/search-catalog.test.ts` | 04-02 · T1 | ❌ W0 |
| SHOW-02 | `layoutOrbs` deterministic (same input→same output), all diameters ≥56, positions in-bounds | unit (app) | `npx vitest run packages/app -t "orbitLayout"` | `packages/app/test/orbitLayout.test.ts` | 04-03 · T1 | ❌ W0 |
| SHOW-11 | Write-through: log song → row in IndexedDB immediately | integration (app) | `npx vitest run packages/app -t "write-through"` | `packages/app/test/showSession.test.ts` | 04-01 · T1 | ❌ W0 |
| SHOW-11 / D-03 | Restore: seed active show + entries, re-query → exact resume; exactly one active | integration (app) | `npx vitest run packages/app -t "restore"` | `packages/app/test/showSession.test.ts` | 04-01 · T1 (helper) + 04-04 · T2 (E2E) | ❌ W0 |
| SHOW-03 / D-06 | Hit/miss scoring: tap-orb=hit (in fan), search/???=miss; tally math | unit (app) | `npx vitest run packages/app -t "tally"` | `packages/app/test/tally.test.ts` | 04-01 · T2 | ❌ W0 |
| SHOW-06 | Set structure: set break→"2", encore→"e"; entries snapshot setNumber; round-trip grouping | unit (app) | `npx vitest run packages/app -t "set-structure"` | `packages/app/test/showSession.test.ts` | 04-01 · T1 (helper) + 04-06 · T1 (wiring) | ❌ W0 |
| SHOW-07 / D-15 | Undo deletes max-position entry; delete recomputes tally | integration (app) | `npx vitest run packages/app -t "undo"` | `packages/app/test/showSession.test.ts` | 04-01 · T1 (helper) + 04-06 · T1 (wiring) | ❌ W0 |
| SHOW-09 | Running hit/miss tally derived from entries, persistently correct | unit (app) | `npx vitest run packages/app -t "tally"` | `packages/app/test/tally.test.ts` | 04-01 · T2 (+ 04-06 · T2 readout) | ❌ W0 |
| DEX-01 / D-02 | Start Show writes a date-keyed tracked-show row (provisional attendance) | integration (app) | `npx vitest run packages/app -t "attendance"` | `packages/app/test/showSession.test.ts` | 04-01 · T1 | ❌ W0 |
| D-12 | Adaptive fan: drops orbs < drop-score, clamps count 5–8 | unit (app) | `npx vitest run packages/app -t "orbitLayout"` | `packages/app/test/orbitLayout.test.ts` | 04-03 · T1 | ❌ W0 |
| D-09 / EVAL-04 | Score→display: absolute %, `<1%` floor, no renormalization | unit (app) | `npx vitest run packages/app -t "orb percent"` | `packages/app/test/confidence.test.ts` | 04-03 · T1 | ❌ W0 |
| D-10 / EVAL-04 | Weak-fan softening triggers when top score < 0.15 | unit (app) | `npx vitest run packages/app -t "softening"` | `packages/app/test/confidence.test.ts` | 04-03 · T1 | ❌ W0 |

*Status: ❌ W0 = test file does not exist yet, created RED-first inside its owning task · ✅ green · ⬜ pending · ⚠️ flaky*

> Naming contract (so both broad and granular `-t` filters resolve): `showSession.test.ts` it-names contain the substrings `write-through`, `restore`, `set-structure`, `undo`, `attendance` (04-01 · T1); `confidence.test.ts` contains `orb percent` and `softening` (04-03 · T1); `orbitLayout.test.ts` contains `orbitLayout` (04-03 · T1).

---

## Wave 0 Requirements

Test scaffolding created RED-first inside the task that owns each file (no separate Wave-0 plan; folded into the TDD/impl tasks):

- [ ] `packages/core/test/search-catalog.test.ts` — SHOW-04 (04-02 · T1; install fuse.js into core first)
- [ ] `packages/app/test/orbitLayout.test.ts` — SHOW-02 determinism + ≥56px floor + D-12 adaptive fan (04-03 · T1)
- [ ] `packages/app/test/confidence.test.ts` — D-09 absolute-% display + D-10 softening threshold (04-03 · T1)
- [ ] `packages/app/test/showSession.test.ts` — SHOW-11 write-through, SHOW-11/D-03 restore + single-active, SHOW-06 set structure, SHOW-07 undo, DEX-01 provisional attendance (04-01 · T1; E2E restore extended in 04-04 · T2) via existing `fake-indexeddb`
- [ ] `packages/app/test/tally.test.ts` — SHOW-03/D-06 hit/miss classification + SHOW-09 tally math (04-01 · T2)
- [ ] Framework install: **none** (Vitest + `fake-indexeddb` already present from Phase 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screen wake lock held during show; reacquired after tab hide/show | SHOW-12 | No reliable Wake Lock under jsdom; iOS installed-PWA support only landed in 18.4 (WebKit bug 254545) — behavior is device/version-specific | Real-iPhone spike (04-07 · T3 blocking checkpoint): install PWA on the oldest device in the friend group, start a show, confirm the screen stays awake; background+foreground and confirm reacquire; on a pre-18.4 device confirm the fallback message appears instead of a silent failure |
| One-thumb usability in a dark venue; gesture suppression (no pull-to-refresh, no double-tap zoom, no text-select on the orbit stage) | SHOW-13 | Physical touch behavior on real iOS/Android hardware can't be asserted in jsdom | Manual on-device (04-07 · T3): attempt pull-to-refresh, double-tap, long-press-select over the orbit stage — none should fire; verify all targets reachable with one thumb |
| Accidental-gesture suppression near orbs; no tap-target moves under the thumb | SHOW-01/SHOW-13 | Perceptual/physical | Manual on-device during a mock tracking session (04-03 · T3 human-check + 04-07 · T3) |

---

## Validation Sign-Off

- [x] All tasks have automated verify or a Wave 0 test dependency (except SHOW-12/SHOW-13 manual-only, justified above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (folded RED-first into owning tasks)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < ~10s
- [x] `nyquist_compliant: true` set in frontmatter (task IDs bound above)
- [ ] `wave_0_complete` — flips true after the RED tests are first committed green during execution (not yet run)

**Approval:** approved (planning); wave_0_complete pending execution.
