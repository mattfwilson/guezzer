---
phase: 11-live-sync-prediction-correctness
verified: 2026-07-19T00:00:00Z
status: passed
human_uat_reconciled: 2026-07-21T00:00:00Z
human_uat_source: 11-HUMAN-UAT.md
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Over an HTTPS tunnel with ?mockLatest=1 injecting an extra latest key, confirm SyncDot goes amber, tap shows key-name detail (never editor values), and suggestions keep working. Also confirm a previous-night cached payload yields no stale suggestions on night 2."
    expected: "Amber tappable dot appears; popover lists only novel key NAMES; logging never blocks; no previous-show songs in suggestions."
    why_human: "Visual amber render, tap popover UX, and cross-night stale-leak behavior are on-device rendering concerns not provable by grep. Underlying logic (guardLatestRows, schemaDrift threading, detectNovelKeys) is code-verified and unit-tested."
  - test: "Track two shows in one run; confirm the second night down-weights first-night songs. Tap the Settings 'start a fresh run' reset (two-tap confirm); confirm prior-run songs no longer sink on a subsequent show."
    expected: "Night-2 predictions visibly demote night-1 songs; after reset, pre-boundary songs return to normal weight."
    why_human: "Live prediction weighting feel and the two-tap reset control UX require on-device interaction. Suppression math, currentRunShowSets wiring, and reset-marker persistence/round-trip are code-verified and unit-tested."
---

# Phase 11: live-sync-prediction-correctness Verification Report

**Phase Goal:** On night 2+ of a no-repeat residency, tonight's live suggestions and predictions are trustworthy — no previous-show or wrong-artist songs leak in, live sync survives kglw.net API drift, and cross-night rotation suppression actually fires.

**Verified:** 2026-07-19T00:00:00Z
**Status:** passed (human UAT completed 2026-07-19, reconciled here 2026-07-21)
**Re-verification:** No — initial verification

> **Reconciliation note (2026-07-21):** The two "Human Verification Required" items below
> were subsequently tested and passed on-device — see `11-HUMAN-UAT.md` (status `passed`, 2/2,
> committed `31e19c1`). Item 1 verified over the cloudflared HTTPS tunnel with `?mockLatest=drift`
> (amber SyncDot + key-name-only popover). Item 2's reset-control UX verified on-device; the subtle
> cross-night down-weighting was owner-accepted on automated coverage. This report's status is
> updated `human_needed → passed` to reflect that; the descriptive block below is preserved as-authored.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | LIVE-01: night 2+ suggestions/fill-hints never offer a previous show's song — latestRows date-guarded before feeding suggestions/placeholder resolution | ✓ VERIFIED | `guardLatestRows` (suggest.ts:59-67) filters by `show_id` when bound else the show's OWN `date` (no wall-clock). `ShowView.tsx:180-231` applies it ONCE into `guardedRows`, which feeds `diffLatestAgainstTrail`, `resolvePlaceholders`, AND `bindShowFromLatest` (single ingress). Suggest tests pass. |
| 2 | LIVE-02: live poll surfaces only King Gizzard rows — no side-project/other-artist row enters suggestions/auto-bind | ✓ VERIFIED | `poll-latest.ts:109` `if (parsed.data.artist_id !== 1) continue;` is the sole artist-scope point (commented as such). Mixed-artist regression test passes (poll-latest.test.ts green, 75 core tests pass). |
| 3 | LIVE-03: an additive API field does not silently kill suggestions/auto-bind — drift surfaced on SyncDot, not swallowed | ✓ VERIFIED | `latestSetlistRow` uses `.catchall(z.unknown())` (latest-types.ts:82) so additive keys stay usable; `KNOWN_LATEST_KEYS` derived from `.shape` (no hand list); `detectNovelKeys` surfaces key NAMES only. `pollLatest` returns `PollResult{rows,schemaDrift,novelKeys}` aggregated once/poll (poll-latest.ts:46-123). Threaded `useLatestPoll → ShowView (schemaDrift/novelKeys state) → SyncDot` amber state (SyncDot.tsx:64-95). Amber pixel render is a human item. |
| 4 | PRED-01: night 2+ songs already played earlier in the run are down-weighted — rotation suppression fires with real cross-night data | ✓ VERIFIED | **CR-01 fix present and correct**: `predict.ts:256` `slice(0, cfg.rotationWindowShows)` on the newest-first array (was `slice(-N)`). `currentRunShowSets` returns newest-first (run-grouping.ts:66). Wired in `useShowSession.ts:131-142` replacing the hardcoded `[]`, feeding `buildShowContext` 3rd arg. Regression test (run-grouping.test.ts:110-138) exercises `rotationSuppression` end-to-end over a 5-night run where slice(0,3) vs slice(-3) diverge — asserts recent-night song IS suppressed, oldest-night song is NOT. Passes. |
| 5 | PRED-02/PRED-03: long-retired songs sink (era-prior floor reachable) and user can reset cross-night rotation state before a new run | ✓ VERIFIED | `eraPrior` now compares per-show rates: `allTimeRate = node.playCount / index.showCount` (predict.ts:295), dimensionally matching `eraRate`; clamped to `[eraPriorFloor=0.3, eraPriorCeil=2.0]`. Production-scale RED-gate test (predict.test.ts:398-467) asserts a zero-era retired song reaches ~floor and a hot song > 1 — flipped GREEN, passes. Reset: `SettingsView.tsx:90-95` writes `rotationRunResetDate` via `setMeta(todayIso())`; `currentRunShowSets` drops shows ≥ boundary (run-grouping.ts:64). Round-trips export/import (exportImportRoundtrip.test.ts:154-174 passes). Reset control UX is a human item. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/core/src/live/suggest.ts` | guardLatestRows + TonightGuardInput | ✓ VERIFIED | Exported, substantive, wired via ShowView guardedRows |
| `packages/core/src/ingest/latest-types.ts` | lenient row + KNOWN_LATEST_KEYS + detectNovelKeys | ✓ VERIFIED | catchall schema, shape-derived key set, detectNovelKeys exported/used by poller |
| `packages/core/src/live/poll-latest.ts` | PollResult + per-poll drift aggregation + artist filter | ✓ VERIFIED | PollResult returned; novel Set logged once; artist_id===1 sole filter |
| `packages/core/src/live/run-grouping.ts` | currentRunShowSets + FinalizedShowInput | ✓ VERIFIED | newest-first run walk, reset-boundary + active-show guards |
| `packages/core/src/model/predict.ts` | rotationSuppression slice fix + eraPrior per-show fix | ✓ VERIFIED | slice(0,N) at :256; per-show allTimeRate at :295 |
| `packages/core/src/config.ts` | runGapDays, rotationWindowShows, rescaled eraPriorSmoothingK | ✓ VERIFIED | runGapDays:2, rotationWindowShows:3, eraPriorSmoothingK:0.08, floor 0.3 |
| `packages/app/src/show/ShowView.tsx` | guardedRows wiring + drift→SyncDot threading | ✓ VERIFIED | guardLatestRows once; schemaDrift/novelKeys state → SyncDot prop |
| `packages/app/src/show/useShowSession.ts` | finalized+reset queries → currentRunShowSets → buildShowContext | ✓ VERIFIED | useLiveQuery finalized shows + reset marker feed recentRunShowSets |
| `packages/app/src/live/SyncDot.tsx` | third amber schemaDrift state | ✓ VERIFIED | Dedicated amber tappable branch with key-name-only popover |
| `packages/app/src/live/useLatestPoll.ts` | PollResult threading | ✓ VERIFIED | Consumes whole PollResult, one onResult channel |
| `packages/app/src/settings/SettingsView.tsx` | reset control writing rotationRunResetDate | ✓ VERIFIED | Two-tap confirm writes marker via setMeta(todayIso()) |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| ShowView.tsx | core guardLatestRows | one guardedRows feeding diff/resolve/bind | ✓ WIRED |
| useLatestPoll.ts | SyncDot.tsx | PollResult.schemaDrift → ShowView state → SyncDot prop | ✓ WIRED |
| useShowSession.ts | buildShowContext (3rd arg) | currentRunShowSets replaces hardcoded [] | ✓ WIRED |
| SettingsView.tsx | db.meta rotationRunResetDate | setMeta('rotationRunResetDate', todayIso()) | ✓ WIRED |
| poll-latest.ts | latest-types detectNovelKeys | per-row into Set, logged once | ✓ WIRED |
| predict.ts eraPrior | index-build MatrixIndex.showCount | allTimeRate = playCount / showCount | ✓ WIRED |
| run-grouping currentRunShowSets | config runGapDays | cfg.runGapDays run-break threshold | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Core phase-11 tests (rotation, era-prior, poll, suggest, schema) | `vitest run` on 5 core files | 75 passed | ✓ PASS |
| App phase-11 tests (session, settings, export/import, poll hook, adopt) | `vitest run` on 5 app files | 55 passed | ✓ PASS |
| CR-01 regression exercises rotationSuppression over 5-night run | run-grouping.test.ts:110 | recent-night suppressed, oldest not | ✓ PASS |
| PRED-02 production-scale era floor reachable | predict.test.ts:466 Test 10 | RED→GREEN | ✓ PASS |
| Reset marker export/import round-trip | exportImportRoundtrip.test.ts:154 | marker preserved | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LIVE-01 | 11-02, 11-04 | Date-guard suggestions on night 2+ | ✓ SATISFIED | guardLatestRows + single ShowView ingress |
| LIVE-02 | 11-02 | Only KGLW rows in live poll | ✓ SATISFIED | artist_id===1 sole filter + regression |
| LIVE-03 | 11-02, 11-04 | Schema drift surfaced not swallowed | ✓ SATISFIED | catchall + detectNovelKeys + amber SyncDot |
| PRED-01 | 11-03, 11-05 | Cross-night rotation suppression fires | ✓ SATISFIED | CR-01 slice(0,N) fix + useShowSession wiring |
| PRED-02 | 11-01, 11-03 | Era-prior floor reachable | ✓ SATISFIED | per-show rate fix + production RED gate green |
| PRED-03 | 11-03, 11-05 | Reset cross-night state before new run | ✓ SATISFIED | rotationRunResetDate marker + boundary exclusion + round-trip |

All 6 phase requirement IDs accounted for; every ID in PLAN frontmatter matches REQUIREMENTS.md (Phase 11 rows 76-81), no orphaned IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | — | No debt markers (TBD/FIXME/XXX/HACK) in any modified source | ℹ️ Info | Clean |
| suggest.ts | 106-134 | WR-01: diffLatestAgainstTrail does not dedupe against already-pushed suggestion ids | ⚠️ Warning | Low-likelihood duplicate song chip only if two un-logged reprise occurrences fall inside the suggestionCount window. Does not leak wrong-artist/previous-show songs; does not undermine any success criterion. Open in 11-REVIEW.md. |
| poll-latest.ts | 109 | WR-02: KGLW artist_id `1` is a bare literal, not in config.ts | ⚠️ Warning | Code-hygiene / CLAUDE.md single-config-file nicety. Filter is correct and functionally sound; does not undermine LIVE-02. Open in 11-REVIEW.md. |

Neither warning materially undermines any success criterion. The blocker CR-01 from the code review is confirmed FIXED (predict.ts:256, regression test present).

### Human Verification Required

Two device-UAT items harvested from 11-04-PLAN.md and 11-05-PLAN.md human-check blocks. These confirm on-device rendering/UX and prediction feel; the underlying logic for each is code-verified and unit-tested above.

1. **Schema-drift amber SyncDot + night-2 no-stale (LIVE-01/LIVE-03)** — Over an HTTPS tunnel with `?mockLatest=1` injecting an extra latest key, confirm SyncDot goes amber, tap shows key-name-only detail, suggestions keep working; and a previous-night cached payload yields no stale suggestions on night 2.
   - Expected: amber tappable dot, key-names-only popover, logging never blocks, no previous-show songs offered.

2. **Cross-night down-weight + reset control (PRED-01/PRED-03)** — Track two shows in one run; confirm night 2 down-weights night-1 songs. Tap the Settings reset; confirm prior-run songs no longer sink on a subsequent show.
   - Expected: night-2 predictions demote night-1 songs; post-reset, pre-boundary songs return to normal weight.

### Gaps Summary

No gaps. All 5 success criteria are satisfied in the codebase with substantive, wired implementations and passing regression tests. The code-review blocker CR-01 (rotation slice direction) is confirmed fixed at predict.ts:256 with a genuine end-to-end regression test that would fail under the old direction. The two remaining review warnings (WR-01 duplicate-suggestion edge case, WR-02 magic number) are non-blocking and do not undermine any criterion.

Status is `human_needed` (not `passed`) solely because two criteria include on-device visual/UX confirmation (amber dot render, two-tap reset control, prediction weighting feel) that cannot be proven by static analysis. Every automated-provable aspect passes — the phase is not failed on any programmatically verifiable criterion.

---

_Verified: 2026-07-19T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
