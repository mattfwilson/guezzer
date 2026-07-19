---
phase: 10-pre-show-validation-device-dry-run
plan: 02
subsystem: testing
tags: [uat, device-dry-run, pwa, offline, service-worker, share-card, valid-02]

# Dependency graph
requires:
  - phase: 10-01
    provides: VALID-01 tuning spot-check + the 10-HUMAN-UAT.md doc this plan extends
  - phase: 04-show-mode
    provides: the full Show Mode loop (start/log/set-break/encore/End Show/recap) rehearsed here
  - phase: 05-live-sync-data-safety
    provides: the ?mockLatest sync path + JSON export/import round-trip exercised here
provides:
  - VALID-02 closed — full show loop passed a real-device (iPhone) rehearsal, recorded in 10-HUMAN-UAT.md
  - Two D-09 loop-breaking blocker fixes (SuggestionStrip slot sizing + FAB lift)
  - Per-show recap Share card (session-scoped stats, six-tier rarity box, share-icon chrome)
affects: [show-1-readiness, share-card, live-sync-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-show recap share stats: core buildRecapShareStats derives session-scoped card data off deriveRecap (card math stays in core, DexHeader all-time path preserved)"

key-files:
  created:
    - .planning/phases/10-pre-show-validation-device-dry-run/10-02-SUMMARY.md
  modified:
    - .planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md
    - packages/app/src/live/SuggestionStrip.tsx (D-09 fix a — commit b0213c0)
    - packages/app/src/config.ts (strip slot height + share-card tunables)
    - packages/app/src/show/FabMenu.tsx (D-09 fix b — commit a60d5e2)
    - packages/app/src/show/ShowView.tsx (FAB lift when strip slot reserved)
    - packages/core/src/dex/share-stats.ts (buildRecapShareStats — commit 3c09839)
    - packages/app/src/dex/RecapView.tsx, ShareCardSheet.tsx, shareCard.ts (per-show card)

key-decisions:
  - "Owner declined the cloudflared tunnel this run: tests 2–5 ran on iPhone via the owner's own means; tests 6–7 ran on desktop localhost (a secure-context SW fallback) — their iPhone-specific legs are deferred, non-blocking"
  - "Plan scope expanded beyond pure validation at owner direction: the LIFETIME-vs-show recap share-card mismatch found in test 5 was fixed inline as a new per-show recap Share card"

patterns-established:
  - "Per-show recap share card: buildRecapShareStats (core) off deriveRecap for session-scoped stats; DexHeader all-time buildShareStats path left intact"

requirements-completed: [VALID-02]

# Metrics
duration: ~2h (owner-run rehearsal, spanning inline fixes)
completed: 2026-07-18
---

# Phase 10 Plan 02: VALID-02 Device Dry-Run Summary

**The full one-thumb show loop passed a real-device (iPhone) rehearsal against the production build — including two loop-breaking blocker fixes and an owner-directed per-show recap Share card — with the offline + import legs confirmed on desktop localhost and Android formally waived.**

## Performance

- **Duration:** ~2h (owner-run graded rehearsal, including three inline code changes)
- **Started:** 2026-07-18 (Task 1 authored 20:37 EDT)
- **Completed:** 2026-07-18 (fixes committed through 23:17 EDT)
- **Tasks:** 2 (Task 1 auto; Task 2 checkpoint:human-verify, now closed)
- **Files modified:** 1 planning doc + 10 source files (across the three inline commits)

## Accomplishments

- **VALID-02 closed:** the full show loop (live-sync leg → start/predictions/log hits+misses → set break → encore → End Show → recap → dex credit) passed on the owner's iPhone against the vite production build (`npm run preview`, `localhost:4173`).
- **Two D-09 loop-breaking blockers found and fixed inline** during the live-sync leg (SuggestionStrip clip + FAB overlap), then re-verified on-device.
- **Owner-directed per-show recap Share card** replaced the lifetime-GizzDex card that mismatched the recap (session-scoped stats, six-tier rarity box, share-icon chrome).
- Offline airplane-mode leg (test 6) and JSON export/import round-trip (test 7) functionally confirmed on desktop localhost; Android waived (D-06).

## Task Commits

1. **Task 1: Author the VALID-02 device-loop checklist + D-07 harness** — `32c6302` (docs) — completed before this continuation.

**Task 2 (checkpoint:human-verify — owner-run rehearsal) in-checkpoint code changes:**

2. **D-09 fix (a): size SuggestionStrip slot to its rows, scroll overflow** — `b0213c0` (fix)
3. **D-09 fix (b): lift the Show-Mode FAB above the reserved SuggestionStrip** — `a60d5e2` (fix)
4. **Owner-directed enhancement: per-show recap share card + share-sheet layout** — `3c09839` (feat)

**Plan metadata:** committed with this SUMMARY + the completed 10-HUMAN-UAT.md record, then STATE.md/ROADMAP.md.

## Files Created/Modified

- `.planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md` — filled tests 2–8 result lines with on-device / desktop-localhost verdicts + evidence, D-09 found+fixed notes, Gaps entry, status→resolved, Summary counts.
- `.planning/phases/10-pre-show-validation-device-dry-run/10-02-SUMMARY.md` — this file.
- Source (already committed — not touched by this continuation): SuggestionStrip.tsx, config.ts, FabMenu.tsx, ShowView.tsx (D-09 fixes); RecapView.tsx, ShareCardSheet.tsx, shareCard.ts, core share-stats.ts (per-show card).

## Decisions Made

- **Harness this run:** vite production build + `npm run preview` on `localhost:4173`, no cloudflared tunnel (owner declined). Tests 2–5 on iPhone via the owner's own means; tests 6–7 on desktop localhost (secure context, so the precache SW installs and the offline/import logic is exercised).
- **Test 5 mismatch resolved by scope expansion:** the End-Show Share card showed the LIFETIME whole-GizzDex collection, so its rarity counts didn't match the recap. Per owner direction, addressed inline as a new PER-SHOW recap Share card rather than deferring — see Deviations.

## Deviations from Plan

### Scope expansion (owner-directed)

**1. [Owner-directed enhancement] Per-show recap Share card**
- **Found during:** Task 2, test 5 (End Show + recap + dex credit)
- **Issue:** the End-Show Share card self-sourced `useDexStats` + `buildShareStats(dex, archive)` and rendered the LIFETIME whole-GizzDex collection, so its rarity counts did not match the just-ended show's recap. (This is the pending "final-show recap Share card uses GizzDex totals" todo.)
- **Fix:** new session-scoped recap card — core `buildRecapShareStats` off `deriveRecap`; hero = songs-caught count (no %); vertical six-tier rarity box (Debut Candidate..Legendary, right-aligned tier-colored counts); share-sheet chrome changed to a share-icon button upper-right + primary Close button. Card math kept in core; the DexHeader all-time path is preserved.
- **Files modified:** packages/core/src/dex/share-stats.ts, packages/core/src/index.ts, packages/app/src/dex/RecapView.tsx, ShareCardSheet.tsx, shareCard.ts, config.ts (+ core + app tests)
- **Verification:** owner re-verified on-device — the per-show card now matches the just-ended show; core + app test suites updated and green (committed with the change).
- **Committed in:** `3c09839`

### Auto-fixed Issues (D-09 loop-breaking blockers)

**2. [Rule 1 - Bug] SuggestionStrip clipped its 2nd suggestion against the tab bar**
- **Found during:** Task 2, test 2 (live-sync leg)
- **Issue:** the reserved strip slot (56px) was too short for two 44px suggestion rows, clipping the 2nd suggestion against the bottom tab bar — breaking the one-thumb adopt loop.
- **Fix:** sized the slot to 112px + `overflow-y-auto`.
- **Verification:** owner re-verified on-device — both rows visible, no tab-bar clip.
- **Committed in:** `b0213c0`

**3. [Rule 1 - Bug] Corner FAB overlapped the strip rows' +/X buttons**
- **Found during:** Task 2, test 2 (live-sync leg)
- **Issue:** the corner FAB overlapped the strip rows' +/X buttons, blocking taps.
- **Fix:** lifted the FAB above the strip whenever the strip's slot is reserved.
- **Verification:** owner re-verified on-device — no overlap, row +/X buttons tappable.
- **Committed in:** `a60d5e2`

---

**Total deviations:** 1 owner-directed scope expansion (per-show share card) + 2 auto-fixed D-09 loop-breaking bugs.
**Impact on plan:** The two D-09 fixes were exactly the in-phase blocker branch the plan anticipated. The share-card redesign expanded the plan beyond pure validation into a UI change at owner direction — an intentional, owner-approved scope expansion, not scope creep.

## Issues Encountered

- **Desktop-localhost disposition for tests 6–7:** the owner declined the cloudflared tunnel, so the offline airplane-mode leg and the JSON export/import round-trip were verified on desktop localhost (a secure-context fallback that still installs the precache SW) rather than on the iPhone. Both are functionally confirmed; the device-surface legs (iOS SW eviction under airplane mode; iOS file picker / share-sheet import) are recorded as a deferred, non-blocking Gap in 10-HUMAN-UAT.md to run before show #1.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 10 complete** (both plans done): VALID-01 (10-01) and VALID-02 (10-02) closed. This is the final phase of the v1.1 Polish & Pre-Show Hardening milestone.
- **Deferred follow-up (non-blocking):** a short tunnel-backed iPhone pass to confirm the iOS-specific offline and import legs before show #1.

## Self-Check: PASSED

- FOUND: 10-02-SUMMARY.md, 10-HUMAN-UAT.md
- FOUND commits: 32c6302 (task 1), b0213c0 + a60d5e2 (D-09 fixes), 3c09839 (per-show card)

---
*Phase: 10-pre-show-validation-device-dry-run*
*Completed: 2026-07-18*
