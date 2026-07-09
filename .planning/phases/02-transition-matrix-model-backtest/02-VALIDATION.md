---
phase: 02
slug: transition-matrix-model-backtest
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture (grounded in the real corpus + Phase 1 code).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`node` environment for core, via root `test.projects`) |
| **Config file** | `vitest.config.ts` (root; `test.projects: ['packages/*']`) |
| **Quick run command** | `npx vitest run packages/core` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5–15 seconds (pure-arithmetic core, no browser env) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/core` (fast; node env, no browser)
- **After every plan wave:** Run `pnpm test` (full core suite)
- **Before `/gsd-verify-work`:** Full suite green **AND** the `run-backtest` CLI produces a report artifact
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

Requirement → behavior → automated command (from RESEARCH.md § Phase Requirements → Test Map). Task IDs bind to plans during planning; the requirement/behavior/command columns are stable now.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| DATA-05 | Set-boundary/encore transitions excluded from edge counts | unit | `npx vitest run packages/core -t "boundary exclusion"` | ❌ W0 (`model/matrix.test.ts`); fixtures `2013-encore`, `2022-rr1010-multiset` exist |
| MODL-01 | Serializable frozen-schema `TransitionMatrix` artifact (nodes + edges) | unit | `... -t "matrix schema"` | ❌ W0 |
| MODL-02 | As-of cutoff filters shows by `(date, showOrder)` (leak prevention) | unit | `... -t "as-of cutoff"` | ❌ W0 |
| MODL-03 | First-order `P(next\|current)` core signal | unit | `... -t "transitionProb"` | ❌ W0 |
| MODL-04 | Exponential recency decay relative to cutoff; `weightedCount` per edge | unit | `... -t "decay half-life"` | ❌ W0 |
| MODL-05 | Hard-segue override, consistency-gated, only notated segues reach ~100% | unit | `... -t "hard segue override"` | ❌ W0; fixtures `2017-segues`, `2025-segue-chain` exist |
| MODL-06 | Rotation suppression over recent tour shows | unit | `... -t "rotation suppression"` | ❌ W0 |
| MODL-07 | Era prior (relative multiplier, centered ~1) | unit | `... -t "era prior"` | ❌ W0 |
| MODL-08 | Interpolated backoff — never hard-zero, never 100% except segue | unit | `... -t "backoff floor"` | ❌ W0 |
| MODL-09 | Tuning-family affinity only inside backoff tier | unit | `... -t "tuning backoff only"` | ❌ W0 |
| MODL-10 | Already-played → near-zero, sandwich/reprise-aware | unit | `... -t "already played"` | ❌ W0; fixture `2025-sandwich` exists |
| MODL-11 | All model constants live in `config.ts` | unit/lint | `... -t "config constants"` | ❌ W0 |
| EVAL-01 | Holdout tour + top-1/5/10 hit rates overall + hard-segue/free-choice split | unit | `... -t "backtest metrics"` | ❌ W0 |
| EVAL-02 | Leave-one-signal-out ablation deltas, report-only | unit | `... -t "ablation"` | ❌ W0 |
| EVAL-03 | Backtest runs from Node CLI, zero browser deps | structural | tsconfig `lib: ES2023` compile-enforced + CLI smoke run | ✅ enforced |
| EVAL-05 | Fixture setlists with known expected scoring outputs | unit | `pnpm test` | ❌ W0 (fixtures exist; scoring-output tests new) |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · `W0` = supplied by Wave 0*

---

## Wave 0 Requirements

New test scaffolding this phase must stand up before signal work is verifiable:

- [ ] `packages/core/test/model/matrix.test.ts` — DATA-05, MODL-01/02/04 (reuse `2013-encore`, `2022-rr1010-multiset` for boundary exclusion; add a tiny 2-cutoff fixture for as-of leak-safety)
- [ ] `packages/core/test/model/predict.test.ts` — MODL-03/05/06/07/08/09/10 (reuse `2025-sandwich` for already-played, `2017-segues`/`2025-segue-chain` for hard-segue)
- [ ] `packages/core/test/eval/backtest.test.ts` — EVAL-01/02 (small synthetic multi-tour fixture with a known holdout + hand-computed top-k and ablation deltas)
- [ ] `packages/core/test/fixtures/` — 1–2 **new synthetic scoring fixtures** with hand-computed expected scores (existing fixtures are normalize-oriented; scoring needs known-output setlists per D-17)
- [ ] Determinism test — matrix artifact + `backtest.json` are byte-stable across rebuilds (RESEARCH Pitfall 2: float/ordering reproducibility)
- [ ] Framework install: **none** — Vitest 4.1.10 already configured via `test.projects`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trust judgement from ablation numbers | EVAL-02 / D-14 | No automated go/no-go gate in Phase 2 by design — the owner reads the ablation deltas and judges whether the model is trustworthy live | Run `run-backtest` CLI; read the `.md` report's per-split hit rates and per-signal ablation deltas; confirm each signal earns its place |
| Seed-constant plausibility | MODL-11 / D-16 | Numeric seeds (half-life 365d, alreadyPlayed 0.02, rotation 0.5^n, segue 0.70/0.97) are ASSUMED starting points, tuned by reading backtest output | Compare backtest hit rates across constant tweaks; justify final values from the numbers |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌ (MISSING) references above
- [ ] No watch-mode flags (`vitest run`, never `vitest` watch)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner binds task IDs)

**Approval:** pending
