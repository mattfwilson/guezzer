---
phase: 08-on-device-ui-polish-accessibility
plan: 07
subsystem: ui
tags: [polish, verification, fab-menu, install-banner, bookkeeping]
requires:
  - "Phase-6 D-20 FabMenu speed-dial (packages/app/src/show/FabMenu.tsx)"
  - "Phase-6 D-22 InstallBanner once-per-version gate (packages/app/src/components/InstallBanner.tsx)"
provides:
  - "POLISH-02 verification record: both Phase-6 behaviors confirmed against their originating todos via existing automated coverage"
  - "D-22 InstallBanner todo formally annotated resolved (status: done + verify-and-close note)"
affects:
  - ".planning/todos/completed/2026-07-14-install-banner-reappears-every-reload.md"
tech-stack:
  added: []
  patterns:
    - "verify-and-close: confirm a shipped behavior against its originating todo using existing tests, then file the todo resolved (no source change)"
key-files:
  created:
    - ".planning/phases/08-on-device-ui-polish-accessibility/08-07-SUMMARY.md"
  modified:
    - ".planning/todos/completed/2026-07-14-install-banner-reappears-every-reload.md"
decisions:
  - "POLISH-02 is a confirm-and-file gate, not a design change — no edits to FabMenu.tsx or InstallBanner.tsx"
  - "STATE.md Deferred Items rows are orchestrator-owned in worktree mode; the todo-file annotation is this agent's committable resolution artifact"
requirements: [POLISH-02]
metrics:
  duration: ~6min
  completed: 2026-07-18
  tasks: 2
  files_changed: 1
---

# Phase 8 Plan 07: POLISH-02 Verify-and-Close (FabMenu + InstallBanner) Summary

Confirmed the Phase-6 D-20 FabMenu speed-dial and D-22 once-per-version InstallBanner already behave exactly as their originating Phase-6 todos intended — proven by the existing `fabMenu.test.tsx` (6/6) and `installBannerVersion.test.tsx` (3/3) coverage (9/9 total green) — then formally filed the still-unannotated InstallBanner todo as resolved. No source changed; this was the POLISH-02 verification + bookkeeping gate.

## What Was Done

### Task 1 — Verify both Phase-6 behaviors against their todos

Ran the two existing test files and mapped each behavior to its originating todo intent. No source edit to `FabMenu.tsx` or `InstallBanner.tsx`.

**D-20 FabMenu speed-dial** — todo `2026-07-14-collapse-show-actions-into-fab-menu.md` ("consolidate Show-Mode actions into a collapsed bottom-right FAB, each target ≥44px"):

| Todo intent | Proving assertion (`fabMenu.test.tsx`) |
|-------------|----------------------------------------|
| Collapsed by default — only the FAB in the a11y tree (T-06-04) | `is collapsed by default: only the FAB is in the tree, no action buttons` |
| Expanding reveals the actions | `expands to six action rows when the FAB is tapped` (five original + End Show, per the LiveGizz-tweaks extension) |
| Scrim/second-tap collapse fires no action | `scrim tap collapses ... without firing any callback` + `tapping the FAB again collapses without firing any callback` |
| Five-callback contract (D-13..D-15) preserved, auto-collapse-then-act | `each action fires exactly its own callback once and auto-collapses` |
| ≥44px targets + never-accent floor | `the FAB carries the config aria-label; no control is accent-styled` (source: `min-h-11 min-w-11` + `FAB_ACTION_HEIGHT` per the todo's verify-and-close note) |

**D-22 InstallBanner once-per-version gate** — todo `2026-07-14-install-banner-reappears-every-reload.md` ("show at most once per app version via a persisted meta flag keyed on the build stamp"):

| Todo intent | Proving assertion (`installBannerVersion.test.tsx`) |
|-------------|-----------------------------------------------------|
| Show once per never-seen build stamp, persisting the flag | `shows once on a never-seen stamp and persists the flag` (writes `installBannerSeenVersion` = `` `${__APP_VERSION__}+${__GIT_SHA__}` ``, `InstallBanner.tsx:33,40,69-78`) |
| Suppress reloads on the same stamp | `stays hidden when the current stamp is already recorded` |
| Re-show once after a new build ships | `re-shows once when the recorded stamp is from an older build` (rewrites flag to current stamp) |

Session-only dismissal (D-05) is layered on top (`!dismissed`), and the meta read/write is never-throw (T-06-06) — a flag failure only re-shows a harmless banner.

**Test result:** `2 passed (2)` files, `9 passed (9)` tests.

### Task 2 — Formally file the two POLISH-02 todos resolved

- Both originating todo files already live in `.planning/todos/completed/` — no file move required.
- The FAB todo (`2026-07-14-collapse-show-actions-into-fab-menu.md`) was already fully annotated (`status: done`, `resolved_by`, verify-and-close block) from the 2026-07-17 pass — left untouched.
- The InstallBanner todo lacked the equivalent resolution metadata, so it was annotated to match: added `status: done` / `resolved_by` / `resolved_date` / `files` frontmatter plus a verify-and-close note mapping the D-22 gate to each "wanted" point and citing the passing test.

## Deviations from Plan

**1. [Worktree mode] STATE.md Deferred Items rows not edited by this agent**
- **Plan Task 2** calls to flip the two POLISH-02 rows in `.planning/STATE.md` from `pending` to `resolved`.
- **Why deferred:** This plan ran as a parallel worktree executor; per the orchestrator's explicit instruction, STATE.md/ROADMAP.md are orchestrator-owned and must NOT be written by worktree agents (they are updated after the whole wave completes). The plan's `<automated>grep -c "resolved" .planning/STATE.md</automated>` check for Task 2 is therefore an orchestrator-side verification, not this agent's.
- **What this agent delivered instead:** The committable resolution artifact — the InstallBanner todo file annotated resolved (the FAB todo was already resolved) — plus this verification record. The orchestrator flips the two STATE.md Deferred Items rows to `resolved` when integrating the wave.

No other deviations — no source (`FabMenu.tsx` / `InstallBanner.tsx`) was modified, exactly as the plan required.

## Verification Evidence

- `node node_modules/vitest/vitest.mjs run packages/app/test/fabMenu.test.tsx packages/app/test/installBannerVersion.test.tsx` → **2 files / 9 tests passed** (Vitest 4.1.10). Run from the main checkout because the parallel worktree had no `node_modules`; the two test files and both source files are byte-identical to the worktree at the shared base commit (only CRLF/LF differs — verified via `diff`), so the run validates the identical source this plan makes no change to.
- Both POLISH-02 originating todos confirmed present in `.planning/todos/completed/`.

## Known Stubs

None — verification + planning-doc bookkeeping only; no runtime code introduced.

## Self-Check: PASSED

- FOUND: `.planning/phases/08-on-device-ui-polish-accessibility/08-07-SUMMARY.md`
- FOUND: `.planning/todos/completed/2026-07-14-install-banner-reappears-every-reload.md` (annotated resolved)
- FOUND commit `ad9eff6` (todo annotation) in `git log`
