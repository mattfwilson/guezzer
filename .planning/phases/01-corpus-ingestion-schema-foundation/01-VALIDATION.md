---
phase: 1
slug: corpus-ingestion-schema-foundation
status: planned
nyquist_compliant: true
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
| **Config file** | root `vitest.config.ts` with `test.projects` (core project, `environment: 'node'`) — created in plan 01-01 Task 1 |
| **Quick run command** | `pnpm vitest run packages/core/test/<file>.test.ts` |
| **Full suite command** | `pnpm vitest run` (root script: `pnpm test`) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run` (fast — pure functions, small fixtures)
- **After every plan wave:** Run `pnpm vitest run` + `pnpm -r exec tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green + real fetch executed once + census report generated + SCHEMA.md unknowns resolved
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01/T1 | 01 | 1 | (scaffold) | T-01-SC | pinned versions, lockfile committed, no postinstall | smoke | `pnpm vitest run` | ❌ W0 (creates it) | ⬜ pending |
| 01-01/T2 | 01 | 1 | DATA-01 | — | untrusted-content note (§12) present | doc-gate | node section-check script (in plan) | ❌ | ⬜ pending |
| 01-01/T3 | 01 | 1 | DATA-01, DATA-03 | T-01-01, T-01-02 | strictObject rejects drift; filter mismatch throws named error | unit | `pnpm vitest run packages/core/test/api-types.test.ts packages/core/test/validate.test.ts` | ❌ | ⬜ pending |
| 01-02/T1 | 02 | 2 | DATA-03 | T-01-04 | rows zod-validated pre-normalize; artist_id===1 filter counted; guarded footnotes parse never throws | unit | `pnpm vitest run packages/core/test/normalize.test.ts` | ❌ | ⬜ pending |
| 01-02/T2 | 02 | 2 | DATA-02 | T-01-05, T-01-06 | CLI arg rejection; committed artifact reviewable | CLI + node assert | `pnpm refresh --normalize-only --input data/samples` + header assert script (in plan) | ❌ | ⬜ pending |
| 01-03/T1 | 03 | 3 | DATA-02, DATA-03 | T-01-07..T-01-10 | mocked-fetch only in tests; no retries; showyear assertion; --year bounded int | unit (mocked) | `pnpm vitest run packages/core/test/fetch.test.ts` | ❌ | ⬜ pending |
| 01-03/T2 | 03 | 3 | DATA-02, DATA-03 | T-01-09 | one-time live pull, paced; committed raw provenance | manual-once + node assert | raw-corpus assert script (in plan) — live fetch run ONCE by executor | — | ⬜ pending |
| 01-03/T3 | 03 | 3 | DATA-01 | — | census reads committed raw only (zero network) | unit + node assert | `pnpm vitest run packages/core/test/census.test.ts` + census.json assert (in plan) | ❌ | ⬜ pending |
| 01-04/T1 | 04 | 4 | DATA-01 | T-01-11 | locked enums fail loudly naming field/value/example show | unit + doc-gate | `pnpm vitest run packages/core/test/api-types.test.ts` + SCHEMA.md resolution check (in plan) | ✅ (extends) | ⬜ pending |
| 01-04/T2 | 04 | 4 | DATA-02 | T-01-12 | artifact counts cross-check census via independent path | CLI + node assert | `pnpm refresh --normalize-only` + header/census assert (in plan) | — | ⬜ pending |
| 01-04/T3 | 04 | 4 | DATA-01 (SC-5) | — | era fixtures: structure never from transition_id; sandwiches positional | unit | `pnpm vitest run packages/core/test/normalize.test.ts` | ✅ (extends) | ⬜ pending |
| 01-05/T1 | 05 | 5 | DATA-04 | T-01-13, T-01-14, T-01-15 | closed family enum; hand-edits survive byte-for-byte; album_notes never parsed | unit | `pnpm vitest run packages/core/test/tuning-tags.test.ts` | ❌ | ⬜ pending |
| 01-05/T2 | 05 | 5 | DATA-04 | T-01-15 | live idempotence: second run → zero git diff | CLI + node assert | tags assert + idempotence check (in plan) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Covered by plan 01-01 Task 1 (wave 1 — greenfield repo, so Wave 0 and the first wave coincide):

- [ ] pnpm workspace scaffold (`packages/core`) with vitest 4.1.10 installed and a passing smoke test
- [ ] Root `vitest.config.ts` with `test.projects` (no `vitest.workspace.ts` — removed in Vitest 4)
- [ ] `data/samples/` — real API samples moved off repo root and committed (skeleton test inputs; era fixtures extracted from `data/raw` in plan 01-04 T3, after the corpus exists)
- [ ] `.gitattributes` (LF for JSON)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full-corpus fetch against live kglw.net | DATA-02 | Volunteer-run API — CI/tests must never hit it (D-07/P11); the pull is a one-time documented command | Plan 01-03 Task 2: executor runs `pnpm refresh --all --fetch-only` exactly once; raw-corpus assert script verifies files/years/counts; no automatic re-runs |
| Census report review | DATA-01 | Owner reads the evidence resolving SCHEMA.md unknowns (D-10) | End-of-phase: read `data/census-report.md` "What this resolves" section; confirm allowlist + enum decisions in SCHEMA.md match the evidence |
| Tuning-family tagging file hand-fill readiness | DATA-04 | Owner judgment on album-derived defaults | End-of-phase: spot-check ~10 songs in `data/tuning-tags.json` (human-check in plan 01-05 T2) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (plan 01-01 T1 creates the framework before any other test runs)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner, 2026-07-08 (plans 01-01 … 01-05)
