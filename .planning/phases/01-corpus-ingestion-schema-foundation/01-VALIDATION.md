---
phase: 1
slug: corpus-ingestion-schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 |
| **Config file** | none — Wave 0 installs (root `vitest.config.ts` with `test.projects`, core project `environment: 'node'`) |
| **Quick run command** | `pnpm --filter core test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter core test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled by planner from PLAN.md task breakdown)* | | | DATA-01..DATA-04 | | | | | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] pnpm workspace scaffold (`packages/core`) with vitest 4.1.10 installed and a passing smoke test
- [ ] `packages/core/test/fixtures/` — era-spanning fixture setlists (2012 / 2017 / 2022 marathon / 2025-style) derived from committed real samples
- [ ] Root `vitest.config.ts` with `test.projects` (no `vitest.workspace.ts` — removed in Vitest 4)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full-corpus fetch against live kglw.net | DATA-01 | Volunteer-run API — CI/test must never hammer it; fetch is a one-time documented command | Run the documented fetch CLI once; confirm versioned corpus JSON artifact written and row counts match census report |
| Tuning-family tagging file hand-fill readiness | DATA-04 | Owner judgment on album-derived defaults | Open generated tags file; spot-check ~10 songs have sensible album-derived family defaults |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
