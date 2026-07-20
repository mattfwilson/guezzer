---
phase: 14
slug: gizz-bingo-core-marking-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (core project, `environment: 'node'`) |
| **Config file** | `vitest.config.ts` (root; `test.projects` includes `packages/*`) |
| **Quick run command** | `npx vitest run packages/core/src/bingo` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10–30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/core/src/bingo`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + calibration CLI exits 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by the planner as tasks are assigned. Every task producing core logic
> (fold, generator, wins, config) MUST map to an automated Vitest command; the
> calibration CLI maps to a headless `node` run that asserts the gate (D-19).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-XX-XX | XX | 1 | BINGO-03 | — | N/A (headless pure core) | unit/property | `npx vitest run packages/core/src/bingo` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/bingo/*.test.ts` — fold, generator, wins fixture + property test stubs for BINGO-03
- [ ] `packages/core/src/bingo/__fixtures__/` — small headless fixture setlists with known expected marks
- [ ] Vitest already installed (core project configured) — no framework install needed

*Existing Vitest infrastructure covers all phase requirements; only new bingo test files are added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Roster sign-off (jam-vehicle + album candidate lists, D-16/D-20) | BINGO-03 | Human trust gate — corpus proposes, user disposes before constants lock | Calibration CLI surfaces candidate rosters; user reviews/edits; only then are constants written to `config.ts` |
| Calibration report trust gate (P(line)/P(blackout)/dark-share per vibe, D-19) | BINGO-03 | Human reads the report to confirm the numbers feel right before relying on it live | Run `node packages/core/src/cli/bingo-calibrate.ts`; inspect per-vibe report; CLI also hard-asserts and exits non-zero on invariant violation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
