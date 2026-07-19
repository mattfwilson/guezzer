---
phase: 11
slug: live-sync-prediction-correctness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (`projects`: core = node env, app = jsdom) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run <changed-test-file>` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~15–30 seconds |

Core tests live in `packages/core/test/**`; app tests in `packages/app/**`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-test-file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Scaffold — filled once PLAN.md tasks exist (populated by planner tasks + `/gsd-validate-phase`). Requirement-level targets below.

| Requirement | Secure/Correct Behavior | Test Type | Automated Command |
|-------------|-------------------------|-----------|-------------------|
| LIVE-01 | `guardLatestRows` drops previous-show rows (show_id identity when bound, else `TrackedShow.date`) before suggestions/placeholder resolution; past-midnight show's own rows survive | unit (core) | `npx vitest run packages/core/test/live/suggest.test.ts` |
| LIVE-02 | Regression: no consumer of `latestRows` receives `artist_id !== 1` rows across suggest / bind / fill-hint path | unit (core) | `npx vitest run packages/core/test/live/poll-latest.test.ts` |
| LIVE-03 | Additive/unknown key leaves row usable (lenient `catchall`), `detectNovelKeys` surfaces drift flag on `PollResult`, consumed-field breakage still fatal-per-row, drift logged once | unit (core) | `npx vitest run packages/core/test/live/poll-latest.test.ts` |
| PRED-01 | `rotationSuppression` down-weights this-run songs when `recentFinalizedShowSongSets` is fed real cross-night data (wiring seam populated) | unit (core) + app wiring | `npx vitest run packages/core/test/model/predict.test.ts` |
| PRED-02 | `eraPriorFloor` (0.3) is reachable at production scale — `allTimeRate = playCount / showCount` per-show comparison + rescaled `eraPriorSmoothingK`; masking fixture test rewritten to production scale | unit (core) | `npx vitest run packages/core/test/model/predict.test.ts` |
| PRED-03 | Run grouping by date gap (`runGapDays`); manual reset marker (`db.meta`) clears cross-night suppression so prior-run songs are no longer down-weighted after reset | unit (core, `currentRunShowSets`) + app | `npx vitest run packages/core/test/live/run-grouping.test.ts` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Rewrite the masking era-prior test** — the existing `predict.test.ts` era-prior assertion passes on the buggy code because its tiny fixture accidentally aligns units. It must be rewritten at production scale FIRST so the PRED-02 fix is provable (RESEARCH.md Validation Architecture — flagged Wave 0 gap).
- [ ] New test files for the new pure functions: `guardLatestRows` (LIVE-01), `detectNovelKeys` (LIVE-03), `currentRunShowSets` run-grouping (PRED-03).

*Existing vitest infrastructure covers the framework; no install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Amber SyncDot drift state renders + is tappable, never blocks logging | LIVE-03 | Visual/interaction on a real device; DOM-side wiring is thin | On device UAT (HTTPS tunnel), inject an extra `latest` key; confirm SyncDot goes amber, tap shows detail, suggestions keep working |
| Reset control clears cross-night suppression mid-weekend | PRED-03 | End-to-end across Dexie persistence + prediction refresh | Track 2 shows same run, confirm suppression fires; tap reset; confirm prior-run songs no longer sink |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (era-prior masking test rewrite)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
