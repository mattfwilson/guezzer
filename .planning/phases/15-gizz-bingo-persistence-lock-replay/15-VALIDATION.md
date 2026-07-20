---
phase: 15
slug: gizz-bingo-persistence-lock-replay
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (root `vitest.config.ts` with `test.projects: ['packages/*']`) |
| **Config file** | `vitest.config.ts` (root) + `test/setup.ts` (`fake-indexeddb/auto` for app IDB tests) |
| **Quick run command** | `npx vitest run packages/app/test/<file>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/app/test/<file>.test.ts` (the single new/edited test for that task)
- **After every plan wave:** Run `npx vitest run` (both projects)
- **Before `/gsd-verify-work`:** Full suite green + `tsc --noEmit` must pass
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Seed from RESEARCH.md §Validation Architecture "Phase Requirements → Test Map": SC-4/v5 migration, SC-1/D-10 lock rejection, D-08/D-12 freeze, SC-4/D-13 round-trip+merge, BINGO-07 replay, BINGO-06 catch-up, D-22 0-based reindex adapter.*

---

## Wave 0 Requirements

- [ ] `packages/app/test/migrationV5.test.ts` — v4→v5 additive upgrade preserves all tables (model on `migrationV3.test.ts`)
- [ ] `packages/app/test/bingoLock.test.ts` — draft persist, `lockCard` freeze + timestamp, reshuffle/draft rejection on finalized/locked session (D-08/D-09/D-10)
- [ ] `packages/app/test/bingoReplay.test.ts` — fixture setlist with a known board/wins; frozen `caughtSnapshot` drives `neverCaught`; 0-based reindex fires `opener`
- [ ] `packages/app/test/bingoCatchup.test.ts` — catch-up appends via `adoptSuggestion`/`logSong` re-light squares
- [ ] Extend `packages/app/test/exportImportRoundtrip.test.ts` — seed a `bingoCards` row; assert round-trip + a v2 (no-bingoCards) backup still imports
- [ ] Extend `packages/core/test/merge.test.ts` — `MIGRATIONS[2]` + `bingoCards` collision direction
- [ ] Shared fixtures — a locked `BingoCardRow` + matching `TrackedEntry[]` trail with pre-computed expected `MarkedCard`/`Win[]` (reuse the `packages/core/test/bingo/mark.test.ts` fixture idiom)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
