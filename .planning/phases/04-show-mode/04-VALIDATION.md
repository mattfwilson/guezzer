---
phase: 4
slug: show-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

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

Requirement → test binding (task IDs assigned by the planner; every requirement below has an automated test except SHOW-12, which is manual/device per justification).

| Requirement | Behavior | Test Type | Automated Command | File | Status |
|-------------|----------|-----------|-------------------|------|--------|
| SHOW-04 | `searchCatalog` fuzzy-matches a known song, tolerates a typo, empty→[] | unit (core, node) | `npx vitest run packages/core -t "searchCatalog"` | `packages/core/test/search-catalog.test.ts` | ❌ W0 |
| SHOW-02 | `layoutOrbs` deterministic (same input→same output), all diameters ≥56, positions in-bounds | unit (app) | `npx vitest run packages/app -t "orbitLayout"` | `packages/app/test/orbitLayout.test.ts` | ❌ W0 |
| SHOW-11 | Write-through: log song → row in IndexedDB immediately | integration (app) | `npx vitest run packages/app -t "write-through"` | `packages/app/test/showSession.test.ts` | ❌ W0 |
| SHOW-11 / D-03 | Restore: seed active show + entries, re-query → exact resume; exactly one active | integration (app) | `npx vitest run packages/app -t "restore"` | `packages/app/test/showSession.test.ts` | ❌ W0 |
| SHOW-03 / D-06 | Hit/miss scoring: tap-orb=hit (in fan), search/???=miss; tally math | unit (app) | `npx vitest run packages/app -t "tally"` | `packages/app/test/tally.test.ts` | ❌ W0 |
| SHOW-06 | Set structure: set break→"2", encore→"e"; entries snapshot setNumber; round-trip grouping | unit (app) | `npx vitest run packages/app -t "set-structure"` | `packages/app/test/showSession.test.ts` | ❌ W0 |
| SHOW-07 / D-15 | Undo deletes max-position entry; delete recomputes tally | integration (app) | `npx vitest run packages/app -t "undo"` | `packages/app/test/showSession.test.ts` | ❌ W0 |
| SHOW-09 | Running hit/miss tally derived from entries, persistently correct | unit (app) | `npx vitest run packages/app -t "tally"` | `packages/app/test/tally.test.ts` | ❌ W0 |
| DEX-01 / D-02 | Start Show writes a date-keyed tracked-show row (provisional attendance) | integration (app) | `npx vitest run packages/app -t "attendance"` | `packages/app/test/showSession.test.ts` | ❌ W0 |
| D-12 | Adaptive fan: drops orbs < drop-score, clamps count 5–8 | unit (app/core helper) | `npx vitest run -t "adaptive fan"` | `packages/app/test/orbitLayout.test.ts` | ❌ W0 |
| D-09 / EVAL-04 | Score→display: absolute %, `<1%` floor, no renormalization | unit (app) | `npx vitest run packages/app -t "orb percent"` | `packages/app/test/confidence.test.ts` | ❌ W0 |
| D-10 / EVAL-04 | Weak-fan softening triggers when top score < 0.15 | unit (app) | `npx vitest run packages/app -t "softening"` | `packages/app/test/confidence.test.ts` | ❌ W0 |

*Status: ❌ W0 = test file does not exist yet, created in Wave 0 · ✅ green · ⬜ pending · ⚠️ flaky*

---

## Wave 0 Requirements

Test scaffolding to create before/alongside implementation waves (RED first where TDD-eligible):

- [ ] `packages/core/test/search-catalog.test.ts` — SHOW-04 (create `searchCatalog` in core first; install fuse.js into core)
- [ ] `packages/app/test/orbitLayout.test.ts` — SHOW-02 determinism + ≥56px floor + D-12 adaptive fan
- [ ] `packages/app/test/showSession.test.ts` — SHOW-11 write-through, SHOW-11/D-03 restore + single-active invariant, SHOW-06 set structure, SHOW-07 undo, DEX-01 provisional attendance (via existing `fake-indexeddb`)
- [ ] `packages/app/test/tally.test.ts` — SHOW-03/D-06 hit/miss classification + SHOW-09 tally math
- [ ] `packages/app/test/confidence.test.ts` — D-09 absolute-% display + D-10 softening threshold
- [ ] Framework install: **none** (Vitest + `fake-indexeddb` already present from Phase 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screen wake lock held during show; reacquired after tab hide/show | SHOW-12 | No reliable Wake Lock under jsdom; iOS installed-PWA support only landed in 18.4 (WebKit bug 254545) — behavior is device/version-specific | Real-iPhone spike (Wave 0 priority): install PWA on the oldest device in the friend group, start a show, confirm screen stays awake; background+foreground the app and confirm lock reacquires; on a pre-18.4 device confirm the fallback message appears instead of a silent failure |
| One-thumb usability in a dark venue; gesture suppression (no pull-to-refresh, no double-tap zoom, no text-select on the orbit stage) | SHOW-13 | Physical touch behavior on real iOS/Android hardware can't be asserted in jsdom | Manual on-device: attempt pull-to-refresh, double-tap, long-press-select over the orbit stage — none should fire; verify all targets reachable with one thumb |
| Accidental-gesture suppression near orbs; no tap-target moves under the thumb | SHOW-01/SHOW-13 | Perceptual/physical | Manual on-device during a mock tracking session |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or a Wave 0 test dependency (except SHOW-12/SHOW-13 manual-only, justified above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (all commands use `vitest run`)
- [ ] Feedback latency < ~10s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner binds task IDs)

**Approval:** pending
