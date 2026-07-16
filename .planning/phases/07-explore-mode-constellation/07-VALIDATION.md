---
phase: 07
slug: explore-mode-constellation
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-16
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (`projects`: core=node, app=jsdom) — already installed |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm -w test --run` |
| **Full suite command** | `pnpm -w test --run` |
| **Estimated runtime** | ~15 seconds (unit suite; no watch mode, no e2e) |

Core-purity guard (Explore derivation stays React/DOM-free): `pnpm --filter @guezzer/core exec tsc --noEmit`.

---

## Sampling Rate

- **After every task commit:** Run `pnpm -w test --run`
- **After every plan wave:** Run `pnpm -w test --run` + `pnpm --filter @guezzer/app exec tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | EXPL-01..04 | T-07-01 / accept | Config/copy only; song names carried as inert data | unit/config | `pnpm -w test --run` + `pnpm --filter @guezzer/core exec tsc --noEmit` | ✅ created this task | ⬜ pending |
| 07-01-02 | 01 | 0 | EXPL-01, EXPL-02 | — | Pure reshape of schema-guarded matrix; no I/O | unit (tdd) | `pnpm vitest run packages/core/test/explore/derive-constellation.test.ts packages/core/test/explore/rank-outgoing.test.ts` | ✅ created this task | ⬜ pending |
| 07-01-03 | 01 | 0 | EXPL-03 | — | Pure reshape of @archive; no I/O | unit (tdd) | `pnpm vitest run packages/core/test/explore/rotation.test.ts` (real-corpus N=5→56 guard) | ✅ created this task | ⬜ pending |
| 07-02-01 | 02 | 1 | EXPL-01 | T-07-01 / accept | Song names via canvas `fillText` only (no eval) | build/typecheck | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm --filter @guezzer/app exec vite build` | ✅ existing infra | ⬜ pending |
| 07-02-02 | 02 | 1 | EXPL-06 | — | Schema-guarded `loadMatrix()` (sentinel, never throw) | typecheck+unit | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm -w test --run` | ✅ existing infra | ⬜ pending |
| 07-03-01 | 03 | 2 | EXPL-06 | — | N/A (visual/perf readability) | **manual (device)** | see Manual-Only Verifications | n/a | ⬜ pending |
| 07-04-01 | 04 | 3 | EXPL-05 | — | Adjacency reads `fromId`/`toId` (mutation-safe) | typecheck+unit | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm -w test --run` | ✅ existing infra | ⬜ pending |
| 07-04-02 | 04 | 3 | EXPL-02 | T-07-01 / accept | Raw edge % (no predict()); why-string is inert copy | typecheck+unit | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm -w test --run` | ✅ existing infra | ⬜ pending |
| 07-05-01 | 05 | 4 | EXPL-03 | — | Slider = bounded int, toggle = binary (no free text) | typecheck+unit | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm -w test --run` | ✅ existing infra | ⬜ pending |
| 07-05-02 | 05 | 4 | EXPL-04 | — | Render-pass edge filter; node population invariant | typecheck+unit | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm -w test --run` | ✅ existing infra | ⬜ pending |
| 07-06-01 | 06 | 5 | DEX-05 | — | Overlay from `useDexStats` (single derived path) | typecheck+unit | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm -w test --run` | ✅ existing infra | ⬜ pending |
| 07-06-02 | 06 | 5 | DEX-05 | — | Overlay switch = binary; no new persistence | typecheck+unit | `pnpm --filter @guezzer/app exec tsc --noEmit` + `pnpm -w test --run` | ✅ existing infra | ⬜ pending |
| 07-07-01 | 07 | 6 | EXPL-01..06, DEX-05 | T-07-01 / accept | End-to-end; confirms no untrusted-input escape | **manual (device)** | see Manual-Only Verifications | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: no 3 consecutive implementation tasks lack an automated verify — the only non-automated gates (07-03-01, 07-07-01) are the two intentional on-device human checkpoints, each isolated between automated waves.

---

## Wave 0 Requirements

Wave 0 (Plan 07-01) creates the tested pure-core substrate every UI slice consumes. vitest is already installed — no framework install needed.

- [ ] `packages/core/test/explore/derive-constellation.test.ts` — fixture tests for `deriveConstellation` + the edge-threshold predicate (EXPL-01, EXPL-04); asserts `fromId`/`toId` mutation-safety and node-population invariance under threshold
- [ ] `packages/core/test/explore/rank-outgoing.test.ts` — fixture tests for `rankOutgoing` (EXPL-02); asserts raw `pct = count/total` and zero-outgoing → `{total:0, bars:[]}`
- [ ] `packages/core/test/explore/rotation.test.ts` — fixture (out-of-order dates → newest-N) + **real-corpus guard `rotationSongIds(archive, 5).size === 56`** (EXPL-03, locks the D-06 data-driven default)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas-label readability at ~250 nodes + Full-catalog render perf on a 375px phone | EXPL-06 | Subjective legibility + real-device GPU/paint perf cannot be asserted in jsdom; resolves the STATE-flagged spike | Load `#/explore` on an iPhone (Safari installed PWA). At rest, confirm labels do not jitter-crowd (tune `LABEL_AT_REST_TOP_K` down from 8 / to 0 if needed). Zoom in past `LABEL_ZOOM_THRESHOLD` → labels fade in; focused node + neighbors always labeled. Toggle Full catalog + edge threshold=1 → confirm no unacceptable frame drops. Record the chosen K. |
| Full Explore loop end-to-end | EXPL-01..06, DEX-05 | Cross-slice interaction (render → tap-bars → focus-dim → chain-hop → filters → dex overlay) is a device-gated acceptance check | On device: constellation renders and settles/freezes; tap a node → 40% sheet with ranked bars + why lines + neighborhood focus/dim; tap a bar → chain-hops and refocuses; open filter FAB → rotation/full toggle + edge slider behave (nodes stay as stars below threshold); dex overlay on by default (caught lit, unseen dimmed, sighting rings); mark a show elsewhere → constellation recolors live. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (2 manual gates are intentional device checkpoints)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 core fixture-test files)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (core unit suite ~15s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-16
