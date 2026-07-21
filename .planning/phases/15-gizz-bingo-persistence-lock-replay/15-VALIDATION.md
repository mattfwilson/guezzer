---
phase: 15
slug: gizz-bingo-persistence-lock-replay
status: draft
nyquist_compliant: true
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
| **Estimated runtime** | Single file ~5s; full suite ~45s (both projects) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/app/test/<file>.test.ts` (the single new/edited test for that task)
- **After every plan wave:** Run `npx vitest run` (both projects)
- **Before `/gsd-verify-work`:** Full suite green + `tsc --noEmit` must pass
- **Max feedback latency:** ~15 seconds (single-file quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | BINGO-07 / SC-4 (D-13) | T-15-01 | strictObject + reused discriminated-union reject extra keys / unknown square kind at the import boundary | unit (core) | `npx vitest run packages/core/test/merge.test.ts` | ✅ extend | ⬜ pending |
| 15-01-02 | 01 | 1 | BINGO-07 / SC-4 (D-13) | T-15-02 | MIGRATIONS[2] + version-guard: missing migration rejects "too old"; locked-wins-then-imported-wins collision merge | unit (core) | `npx vitest run packages/core/test/merge.test.ts` | ✅ extend | ⬜ pending |
| 15-02-01 | 02 | 2 | SC-1 (D-10) / D-08/D-12 | T-15-06 | saveDraftCard throws on finalized/locked session (reshuffle-rejection invariant, app-side); lockCard freezes lockedAt + caughtSnapshot | unit (app db) | `npx vitest run packages/app/test/bingoLock.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | SC-4 (D-14) | T-15-04 / T-15-05 | additive version(5) upgrade preserves v1-v4 tables; importSnapshot bulkPut union-only (no destructive clear) | unit (app migration) | `npx vitest run packages/app/test/migrationV5.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 2 | SC-4 (D-13) | T-15-05 | SCHEMA_VERSION 3 round-trip; v2 (no-bingoCards) backup still imports via .default([]) + MIGRATIONS[2] | unit (app) | `npx vitest run packages/app/test/exportImportRoundtrip.test.ts` | ✅ extend | ⬜ pending |
| 15-03-01 | 03 | 3 | BINGO-07 / D-22 | T-15-09 | 0-based reindex fires opener; FROZEN caughtSnapshot drives neverCaught (no live-dex drift) | unit (app fixture) | `npx vitest run packages/app/test/bingoReplay.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-02 | 03 | 3 | BINGO-07 (D-01/D-02) | T-15-08 | `games` added to fixed ROUTES allow-list; hash only SELECTs a view (never innerHTML/eval) | unit + tsc | `npx vitest run packages/app/test/bingoReplay.test.ts && npx tsc -p packages/app --noEmit` | ❌ W0 | ⬜ pending |
| 15-03-03 | 03 | 3 | BINGO-07 (D-05/D-06) | T-15-07 | Bingo section renders present-with-card / absent-without-card; kglw strings escaped React text only | render (jsdom) + tsc | `npx vitest run packages/app/test/recapView.test.tsx && npx tsc -p packages/app --noEmit` | ✅ extend | ⬜ pending |
| 15-04-01 | 04 | 4 | BINGO-06 | T-15-12 | catch-up adds carry shownFanSongIds [] -> classified as misses (honest denominator); trail-grow re-lights exactly qualifying squares | unit (app fixture) | `npx vitest run packages/app/test/bingoCatchup.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-02 | 04 | 4 | BINGO-06 (D-03/D-04) | T-15-10 / T-15-11 | human-in-the-loop pre-checked confirm-list (no silent auto-adopt); feed song names escaped React text only | render (jsdom) + tsc | `npx vitest run packages/app/test/bingoCatchup.test.ts packages/app/test/catchUpSheet.test.tsx && npx tsc -p packages/app --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are `{phase}-{plan}-{task}`. Requirement/threat refs seeded from RESEARCH.md §Validation Architecture "Phase Requirements → Test Map" and each plan's `<threat_model>`: SC-4/v5 migration, SC-1/D-10 lock rejection, D-08/D-12 freeze, SC-4/D-13 round-trip+merge, BINGO-07 replay + D-05/D-06 render, BINGO-06 catch-up, D-22 0-based reindex adapter.*

---

## Wave 0 Requirements

- [ ] `packages/app/test/migrationV5.test.ts` — v4→v5 additive upgrade preserves all tables (model on `migrationV3.test.ts`)
- [ ] `packages/app/test/bingoLock.test.ts` — draft persist, `lockCard` freeze + timestamp, reshuffle/draft rejection on finalized/locked session (D-08/D-09/D-10)
- [ ] `packages/app/test/bingoReplay.test.ts` — fixture setlist with a known board/wins; frozen `caughtSnapshot` drives `neverCaught`; 0-based reindex fires `opener`
- [ ] `packages/app/test/bingoCatchup.test.ts` — catch-up appends via `adoptSuggestion`/`logSong` re-light squares
- [ ] `packages/app/test/catchUpSheet.test.tsx` — render assertion: pre-checked confirm-list from a candidate-list prop + "all caught up" empty-state copy (jsdom)
- [ ] Extend `packages/app/test/recapView.test.tsx` — present-with-card / absent-without-card Bingo section (D-05)
- [ ] Extend `packages/app/test/exportImportRoundtrip.test.ts` — seed a `bingoCards` row; assert round-trip + a v2 (no-bingoCards) backup still imports
- [ ] Extend `packages/core/test/merge.test.ts` — `MIGRATIONS[2]` + `bingoCards` collision direction (locked-wins-then-imported-wins)
- [ ] Shared fixtures — a locked `BingoCardRow` + matching `TrackedEntry[]` trail with pre-computed expected `MarkedCard`/`Win[]` (reuse the `packages/core/test/bingo/mark.test.ts` fixture idiom)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live catch-up flow on a real venue feed | BINGO-06 | Requires a live `latest` feed + device; deferred to Phase-16 live-marking device UAT | Phase-16 concern; this phase's trail-grow/re-light is proven by `bingoCatchup.test.ts` |

*The re-light fold and confirm-list render are automated; only the end-to-end live-feed device flow is manual (Phase 16).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s (single-file quick run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-20
</content>
