---
phase: 14
slug: gizz-bingo-core-marking-generation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-19
updated: 2026-07-20
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (core project, `environment: 'node'`) |
| **Config file** | `vitest.config.ts` (root; `test.projects` includes `packages/*`) |
| **Quick run command** | `npx vitest run bingo` (path-substring filter over `packages/core/test/bingo/`) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10–30 seconds |
| **Gate CLI (not a unit test)** | `node packages/core/src/cli/bingo-calibrate.ts` — exit code IS the gate (D-19) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run bingo`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + calibration CLI exits 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | BINGO-03 | T-14-01 | zod strictObject BingoCard contract | unit/typecheck | `npx vitest run --project @guezzer/core config; npx tsc -p packages/core --noEmit` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | BINGO-03 | T-14-02 | pure non-crypto PRNG, no Math.random/Date.now | unit | `npx vitest run --project @guezzer/core bingo/prng` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | BINGO-03 | — | config.bingo total-order specificityRank | unit | `npx vitest run --project @guezzer/core config` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | BINGO-03 | T-14-03/04 | deterministic Map resolution, empty-roster safe | unit | `npx vitest run --project @guezzer/core bingo/context` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | BINGO-03 | — | 4×4 win geometry incl. free-cell (D-06) | unit | `npx vitest run --project @guezzer/core bingo/wins` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 3 | BINGO-03 | T-14-05/06 | consume-once, total tie-break | unit | `npx vitest run --project @guezzer/core bingo/mark` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 3 | BINGO-03 | T-14-05/06 | live==replay==catch-up property test | property/unit | `npx vitest run --project @guezzer/core bingo/mark` | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 3 | BINGO-03 | T-14-08/09/10 | pure seeded deal, schema-validated, never-blank | unit | `npx vitest run --project @guezzer/core bingo/generate` | ❌ W0 | ⬜ pending |
| 14-04-02 | 04 | 3 | BINGO-03 | — | same-seed reproducibility + segue-excluded catalog | unit | `npx vitest run --project @guezzer/core bingo/generate` | ❌ W0 | ⬜ pending |
| 14-05-01 | 05 | 4 | BINGO-03 | — | barrel exports (CLI behind boundary) | typecheck | `npx tsc -p packages/core --noEmit` | ❌ W0 | ⬜ pending |
| 14-05-02 | 05 | 4 | BINGO-03 | T-14-11/12/13/14 | real-fold Monte-Carlo, escaped report, hard-assert gate | unit + CLI-exit | `npx vitest run --project @guezzer/core bingo/calibrate` | ❌ W0 | ⬜ pending |
| 14-06-01 | 06 | 5 | BINGO-03 | — | roster candidates emitted to review file (not config) | CLI output | `node packages/core/src/cli/bingo-calibrate.ts --candidates && test -s data/bingo-roster-candidates.md` | ❌ W0 | ⬜ pending |
| 14-06-02 | 06 | 5 | BINGO-03 | T-14-15 | human roster sign-off BEFORE config write (D-20) | human-verify | manual (blocking checkpoint) | — | ⬜ pending |
| 14-06-03 | 06 | 5 | BINGO-03 | T-14-16/17 | gate exits 0 with locked constants (GATE 2) | CLI-exit + full suite | `node packages/core/src/cli/bingo-calibrate.ts && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** the only non-automated task (14-06-02, the D-20 human checkpoint) is flanked by
automated tasks on both sides (14-06-01 emits candidates, 14-06-03 runs the gate) — no 3 consecutive
tasks lack an automated verify.

---

## Wave 0 Requirements

Test scaffolds are created in-plan by the `tdd="true"` tasks (each behavior-adding task creates its own
test file alongside the implementation), not in a separate Wave 0 plan:

- [ ] `packages/core/test/bingo/prng.test.ts` (Plan 01) — PRNG determinism
- [ ] `packages/core/test/config.test.ts` (Plan 01, upgraded Plan 06) — config invariants + locked-roster assertions
- [ ] `packages/core/test/fixtures/bingo/synthetic.ts` (Plan 02) — shared card/trail/context fixtures
- [ ] `packages/core/test/bingo/context.test.ts` (Plan 02) — artifact resolution
- [ ] `packages/core/test/bingo/wins.test.ts` (Plan 02) — win geometry
- [ ] `packages/core/test/bingo/mark.test.ts` (Plan 03) — live==replay==catch-up, consume-once, tie-break, placeholder
- [ ] `packages/core/test/bingo/generate.test.ts` (Plan 04) — reproducibility, never-blank, catalog
- [ ] `packages/core/test/bingo/calibrate.test.ts` (Plan 05) — aggregation + gate-assertion logic

*Existing Vitest infrastructure covers all phase requirements; only new bingo test files are added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Roster sign-off (jam-vehicle + album candidate lists, D-16/D-20) | BINGO-03 | Human trust gate — corpus proposes, user disposes before constants lock | `--candidates` surfaces candidate rosters (Plan 06 Task 1); user reviews/edits (Task 2); only then are constants written (Task 3) |
| Calibration report trust gate (P(line)/P(blackout)/dark-share per vibe, D-19) | BINGO-03 | Human reads the report to confirm numbers feel right before relying on it live | Run `node packages/core/src/cli/bingo-calibrate.ts`; inspect per-vibe report; CLI also hard-asserts and exits non-zero on invariant violation |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are the D-20 human checkpoint (flanked by automated tasks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (created in-plan via tdd tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-20
