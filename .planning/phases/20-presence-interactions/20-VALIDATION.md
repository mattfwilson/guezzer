---
phase: 20
slug: presence-interactions
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-24
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `20-RESEARCH.md` § Validation Architecture and the five PLAN.md task maps.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 |
| **Config file** | `vitest.config.ts` (root; `test.projects` — core=node, app=jsdom with `@vitejs/plugin-react`) |
| **Quick run command** | `npx vitest run packages/app/test/sync` (scoped) |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | Scoped sync/component file <5s; full suite ~tens of seconds (unmeasured — measure on first run) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>` (+ `packages/app/test/sync` for engine/store changes)
- **After every plan wave:** Run `npm test` (full suite, incl. `packages/core/test/purity.test.ts`)
- **Before `/gsd-verify-work`:** Full suite must be green, purity guard included
- **Max feedback latency:** scoped file <5s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-T1 | 01 | 1 | PRES-04 | T-20-03 | Coarse `{tab, atShow?}` only — never a song/setlist position | unit | `npx vitest run packages/app/test/sync/presenceActivity.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 20-01-T2 | 01 | 1 | PRES-01, PRES-03, PRES-05 | T-20-01 / T-20-05 | `validateWave` rejects malformed/unknown-emoji/self/other-targeted (null, never throws); no Postgres/Dexie/localStorage write in presence path | unit | `npx vitest run packages/app/test/sync/presenceSync.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 20-02-T1 | 02 | 2 | PRES-06 | T-20-04 / T-20-09 | Bounded FIFO drain + over-cap drop; `pointer-events-none`; reduced-motion; escaped React text | component | `npx vitest run packages/app/test/components/WaveToast.test.tsx` | ❌ W0 (created by task) | ⬜ pending |
| 20-02-T2 | 02 | 2 | PRES-02, PRES-05 | T-20-06 | Fixed 4-emoji allow-list; sender name from trusted store, never payload | component | `npx vitest run packages/app/test/components/WaveToast.test.tsx` | ❌ W0 (created by task) | ⬜ pending |
| 20-03-T1/T2 | 03 | 3 | PRES-01, PRES-02, PRES-03, PRES-04 | T-20-03 / T-20-10 | Engine is SOLE `gizz-room` owner; gates on identity+online; tears channel down + clears store on sign-out/offline; core stays Supabase-free | unit + guard | `npx vitest run packages/app/test/sync/presenceSync.test.ts packages/core/test/purity.test.ts` | ❌ W0 / ✅ guard | ⬜ pending |
| 20-04-T1 | 04 | 4 | PRES-07, PRES-01, PRES-04 | T-20-03 / T-20-11 | Presence decorates PROG rows only (no placeholder rows); offline hides all dots, dimmed cached rows persist | component | `npx vitest run packages/app/test/dex/friendPresence.test.tsx` | ❌ W0 (created by task) | ⬜ pending |
| 20-04-T2 | 04 | 4 | PRES-02, PRES-05 | — | Two entry points (list palette + FriendDetail pre-targeted), one `sendWave` path | component | `npx vitest run packages/app/test/dex/friendPresence.test.tsx` | ❌ W0 (created by task) | ⬜ pending |
| 20-05-T1 | 05 | 5 | PRES-01, PRES-02, PRES-05, PRES-07 | T-20-05 / T-20-11 | Two-device live: honest online/offline dots, targeted vs broadcast toasts | manual (checkpoint) | — (see Manual-Only Verifications) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The four failing-first test files are created **inline by their owning TDD tasks** (not pre-existing on disk):

- [ ] `packages/app/test/sync/presenceActivity.test.ts` — PRES-04 (pure activity derivation; no DOM) — created by 20-01-T1
- [ ] `packages/app/test/sync/presenceSync.test.ts` — PRES-01/03/05 (mock the `supabase` singleton per `test/sync/progressSync.test.ts:13-46`: `channel/on/subscribe/track/send/removeChannel/presenceState` spies via `vi.hoisted` + `vi.mock("../../src/db/supabase.ts")`) — created by 20-01-T2
- [ ] `packages/app/test/components/WaveToast.test.tsx` — PRES-06 (queue drain/cap, reduced-motion, escaped text) — created by 20-02-T1
- [ ] `packages/app/test/dex/friendPresence.test.tsx` — PRES-07 (slot fill + offline hide) — created by 20-04-T1
- [ ] Framework install: none — Vitest + jsdom + the Supabase-mock idiom already exist.

Existing infrastructure (Vitest projects, jsdom, RTL, Supabase-mock idiom, `packages/core/test/purity.test.ts`) covers everything else.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-device live presence + wave | PRES-01, PRES-02, PRES-05, PRES-07 | Realtime presence-sync + broadcast across two real signed-in devices cannot be exercised by a single jsdom process | Plan 20-05: sign in as two identities on two devices; confirm each sees the other's online dot + coarse activity; send a targeted wave (reads "waved at you") and a broadcast wave (reads group hype); disconnect one device and confirm its dot disappears (no stale green) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (20-05 is the sole intentional manual checkpoint)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (4 files created by owning TDD tasks)
- [x] No watch-mode flags (`vitest run` only)
- [x] Feedback latency < 5s (scoped file)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-24
