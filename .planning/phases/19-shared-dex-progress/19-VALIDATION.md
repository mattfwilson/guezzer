---
phase: 19
slug: shared-dex-progress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `19-RESEARCH.md` §"Validation Architecture". The load-bearing invariant is the **round-trip fidelity** of the reconstructed `DexStats` vs the shipped `compareDexes` — nearly all phase correctness is pure-core unit-testable.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`test.projects`: core=`node`, app=`jsdom`) |
| **Config file** | root `vitest.config.ts` (projects config; no `vitest.workspace.ts` — removed in Vitest 4) |
| **Quick run command** | `npx vitest run packages/core/test/dex/shared-progress.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–15 seconds (core quick run sub-second; full suite includes app/jsdom) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/core/test/dex/shared-progress.test.ts` (the round-trip invariant is the highest-value fast check)
- **After every plan wave:** Run `npx vitest run packages/core` then `npx vitest run packages/app`
- **Before `/gsd-verify-work`:** Full `npx vitest run` must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| projector | core | 1 | PROG-01 | — | `deriveSharedProgress(fixtureDex)` deep-equals known `SharedProgress` (caught set, tierCounts, perAlbum array, sorted ids) | unit (core/node) | `npx vitest run packages/core/test/dex/shared-progress.test.ts -t "deriveSharedProgress"` | ❌ W0 | ⬜ pending |
| round-trip | core | 1 | PROG-06 | — | `compareDexes(mine, deriveDex(theirs))` deep-equals `compareDexes(mine, reconstructDexStats(deriveSharedProgress(deriveDex(theirs)), rarity))` | unit (core/node) | `npx vitest run packages/core/test/dex/shared-progress.test.ts -t "round-trip fidelity"` | ❌ W0 | ⬜ pending |
| reconstruct | core | 1 | PROG-06 | — | `reconstructDexStats` caught set = payload `caughtSongIds`; stubbed fields (`neverSeen`, `personalGap`) never read by `compareDexes` | unit (core/node) | `npx vitest run packages/core/test/dex/shared-progress.test.ts -t "reconstructDexStats"` | ❌ W0 | ⬜ pending |
| perAlbum | core | 1 | PROG-07 | — | Reconstructed `perAlbum` round-trips (array→Map); by-album breakdown matches `deriveDex(theirs).perAlbum` | unit (core/node) | `npx vitest run packages/core/test/dex/shared-progress.test.ts -t "perAlbum"` | ❌ W0 | ⬜ pending |
| rarest | core | 1 | PROG-08 | — | Top-5 rarest from `caughtSongIds` + local rarity matches expected order (rarest-first, id tie-break) | unit (core/node) | `npx vitest run packages/core/test/dex/shared-progress.test.ts -t "rarest showcase"` | ❌ W0 | ⬜ pending |
| parse/zod | core | 1 | PROG-01 / D-19 | T-19-V5 | `parseSharedProgress` accepts valid; returns `null` for malformed/hostile (missing fields, pct out of `[0,100]`, negative counts, non-int ids, oversized arrays) | unit (core/node) | `npx vitest run packages/core/test/dex/shared-progress.test.ts -t "parseSharedProgress"` | ❌ W0 | ⬜ pending |
| purity | core | 1 | PROG-01 | T-19-V5 | new `shared-progress.ts` imports no Supabase/DOM (existing static scan; zod permitted) | unit (core/node) | `npx vitest run packages/core/test/purity.test.ts` | ✅ exists | ⬜ pending |
| upsert | app | 2 | PROG-02 | T-19-identity | Debounced upsert fires once after ~5s of dex changes; gated on `ready`; identity-only write leaves `summary` untouched | integration (app/jsdom, mocked supabase) | `npx vitest run packages/app` (new spec) | ❌ W0 | ⬜ pending |
| subscribe | app | 2 | PROG-05 | T-19-tamper | A `postgres_changes` callback triggers full re-pull; malformed rows skipped; state + cache updated | integration (app/jsdom, mocked supabase) | `npx vitest run packages/app` (new spec) | ❌ W0 | ⬜ pending |
| list-sort | app | 2 | PROG-03 / PROG-04 | T-19-authz | Own row excluded from friends list; sort = completion desc → caught → name; 0-catch friend last (D-05) | unit/integration (app) | `npx vitest run packages/app` (new spec) | ❌ W0 | ⬜ pending |
| offline | app | 2 | PROG-05 / D-18 | — | Offline (`useOnlineStatus=false`) renders cached rows + "as of {time}"; "You" row stays live from local dex | integration (app/jsdom) | `npx vitest run packages/app` (new spec) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs are indicative surfaces; the planner assigns final plan/task numbering.*

---

## Wave 0 Requirements

- [ ] `packages/core/test/dex/shared-progress.test.ts` — projector + reconstruction + **round-trip fidelity** + parse (covers PROG-01/06/07/08 + D-19). Needs a small fixture `DexSnapshotInput` (reuse existing dex fixtures under `packages/core/test/dex/` if present; else author a cheap one).
- [ ] `packages/app/src/sync/*.test.ts` — mocked-supabase integration specs (debounce timing + `ready` gating, subscription→re-pull→skip-malformed→cache, offline cache read + "as of {time}", list sort/self-exclusion). Mock `@supabase/supabase-js` client methods (`from().upsert`, `channel().on().subscribe`, `from().select`) — no network in tests.
- [ ] Confirm root `vitest.config.ts` `projects` already picks up new `packages/core/test/dex/*.test.ts` and `packages/app/src/**/*.test.ts` (it should — no framework install needed).

*Framework is already installed and configured; no Wave 0 framework-install task required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-device live `postgres_changes` propagation | PROG-05 | Real Supabase realtime across two authenticated clients; mock covers the code path but not the network round-trip | Sign in on two devices/tabs, log a catch on device A, confirm device B's friends list updates within a few seconds (blueprint two-tab method) |
| Reconnect flush + re-pull after offline | D-17 | Requires toggling real network connectivity | Go offline on device A, log catches, come back online; confirm own row flushes and all friend rows re-pull once; offline marker clears, rows un-dim |
| RLS write-own enforcement (cross-user inflation blocked) | PROG-03 | Server-side policy; verified against the live project, not the app unit tests | Attempt (or reason through) an upsert with a mismatched `user_id`; confirm it is rejected by `with check (auth.uid() = user_id)` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
