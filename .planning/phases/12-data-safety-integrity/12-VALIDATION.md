---
phase: 12
slug: data-safety-integrity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `12-RESEARCH.md` § Validation Architecture (HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, `test.projects` (core=`node`, app=`jsdom`) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm vitest run packages/core/test/merge.test.ts packages/core/test/dex/derive-dex.test.ts` (SAFE-04) |
| **Component run command** | `pnpm vitest run --project @guezzer/app` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~15 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command above (core tests for SAFE-04, component tests for SAFE-01/02/03).
- **After every plan wave:** Run `pnpm vitest run` (full suite).
- **Before `/gsd-verify-work`:** Full suite must be green AND the SAFE-02 iOS Safari UAT step must be logged.
- **Max feedback latency:** ~15 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SAFE-04-dex | core | 1 | SAFE-04 | — | Two unbound same-date shows → **2** attendances in dex derivation | unit (node) | `vitest run packages/core/test/dex/derive-dex.test.ts` | ✅ rewrite `:91` + add case | ⬜ pending |
| SAFE-04-merge | core | 1 | SAFE-04 | — | Two unbound same-date shows → **2** attendances in merge | unit (node) | `vitest run packages/core/test/merge.test.ts` | ✅ rewrite `:246` + add case | ⬜ pending |
| SAFE-04-dedup | core | 1 | SAFE-04 | — | Bound same-`show_id` multi-device → **1** attendance (dedup preserved) | unit (node) | same files | ✅ `:216` / `:75` stay green | ⬜ pending |
| SAFE-04-mixed | core | 1 | SAFE-04 | — | Bound + unbound same date → 2 (unchanged behavior) | unit (node) | same files | ✅ add/assert | ⬜ pending |
| SAFE-01-order | app | 2 | SAFE-01 | — | `endShow` awaited (finalize commits) BEFORE `exportBackup` snapshot read | component (jsdom) | `vitest run --project @guezzer/app` | ⚠️ extend `endShowDialog.test.tsx` | ⬜ pending |
| SAFE-03-toast | app | 2 | SAFE-03 | — | Success toast fires ONLY on `{ ok: true }`, only after dialog close; no static "Backup saved" while open | component (jsdom) | `vitest run --project @guezzer/app` | ❌ W0 (new assertions + testable toast seam) | ⬜ pending |
| SAFE-02-revoke | app | 2 | SAFE-02 | — | Deferred revoke — no same-tick `revokeObjectURL`; URL revoked only after config delay elapses | component (jsdom, fake timers) | `vitest run --project @guezzer/app` | ❌ W0 (new `triggerDownload.test.tsx`) | ⬜ pending |
| SAFE-02-ios | app | 2 | SAFE-02 | — | Real iOS Safari download of backup JSON **and** share-card PNG both complete | manual iOS UAT | device (D-08) | ➖ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Rewrite `packages/core/test/dex/derive-dex.test.ts:91` (doubleheader → 2 attendances) + add a "bound-dedup still works" assertion.
- [ ] Rewrite `packages/core/test/merge.test.ts:246` (doubleheader → 2 attendances) + retain the bound-dedup case.
- [ ] Extend `packages/app/test/endShowDialog.test.tsx`: mock `exportBackup`, `await` the confirm click, assert finalize-before-snapshot ordering (SAFE-01) and toast-only-on-`{ ok: true }` (SAFE-03).
- [ ] New `packages/app/test/triggerDownload.test.tsx` (fake timers): assert the object URL is revoked **only after** the configured revoke delay elapses, never on the click tick (SAFE-02).
- [ ] `packages/app/test/configMirror.test.ts` (existing) — extend only if a core mirror of the new constant is introduced (recommend keeping the revoke-delay app-only, no core mirror).
- [ ] Document the SAFE-02 iOS Safari UAT step (backup JSON **and** share-card PNG both download without abort).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backup JSON + share-card PNG download completes on real iOS Safari (no download-abort from same-tick revoke) | SAFE-02 | Object-URL / anchor download behavior on iOS Safari cannot be reproduced under jsdom; the safe revoke delay is device-specific | On an iOS Safari device (installed PWA and browser tab): (1) End a show and confirm the backup JSON downloads; (2) open a share card and confirm the PNG downloads. Both must save without the download aborting. Log result as a persisted UAT item. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (SAFE-02 `triggerDownload` test, SAFE-03 toast seam)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
