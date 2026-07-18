---
phase: 08-on-device-ui-polish-accessibility
plan: 02
subsystem: ui
tags: [react19, accessibility, focus-trap, dialog, sheet, show-mode, vitest]

# Dependency graph
requires:
  - phase: 08-on-device-ui-polish-accessibility
    provides: shared <Sheet> primitive + config.ui.z tiers + dialogStack LIFO (plan 08-01)
provides:
  - "EndShowDialog rendered through <Sheet modal variant=bottom-sheet> (Escape/trap/restore, confirm gate intact)"
  - "TrailNodeSheet rendered through <Sheet modal> (Escape via shared LIFO, undo/delete split intact)"
  - "WhyDetail rendered through <Sheet modal> (Escape/trap/restore, 'why' content intact)"
affects: [08-03, 08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modal migration = wrap children in <Sheet>; delete the hand-rolled role=dialog + bg-black/50 + z-* shell"
    - "Escape centralized in dialogStack LIFO — no per-sheet document keydown listener (Pitfall 2)"

key-files:
  created: []
  modified:
    - packages/app/src/show/EndShowDialog.tsx
    - packages/app/src/show/TrailNodeSheet.tsx
    - packages/app/src/show/WhyDetail.tsx
    - packages/app/test/endShowDialog.test.tsx
    - packages/app/test/trailNodeSheet.test.tsx

key-decisions:
  - "Kept WhyDetail's existing accessible name `Why <song>?` rather than authoring the plan's suggested `<song> — why` string — functionally equivalent, zero new copy surface (T-08-05)"
  - "Removed EndShowDialog's now-duplicate `if (!open) return null` guard: the <Sheet open={open}> primitive owns the closed→null path; the persist-warning useEffect still self-guards on `open`"
  - "TrailNodeSheet passes `open` (true) to <Sheet> after its own `if (!entry) return null` + `if (searchOpen)` guards — the SearchSheet swap stays a separate (plan 08-03) sheet, so this sheet adds no bespoke Escape listener"

requirements-completed: [A11Y-01]

# Metrics
duration: ~10min
completed: 2026-07-18
---

# Phase 8 Plan 02: Show-Area Modal A11y Migration Summary

**Migrated the three Show-area true modals — `EndShowDialog`, `TrailNodeSheet`, and `WhyDetail` — off their hand-rolled `role="dialog"` + `bg-black/50 z-*` shells onto the shared `<Sheet modal variant="bottom-sheet">` primitive, giving each Escape-dismiss, focus-trap, and focus-restore while preserving the confirm gate, undo/delete split, and "why" content exactly.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-18
- **Tasks:** 3
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments
- **EndShowDialog** now renders through `<Sheet modal>`: the raw `z-30` + backdrop + safe-area shell is gone (owned by the primitive via `config.ui.z`), the destructive confirm-gated `endShow(sessionId)` + auto-backup (D-04/D-13) is byte-for-byte intact, and Cancel/backdrop/Escape all map to `onClose`.
- **TrailNodeSheet** now renders through `<Sheet modal>`: the `z-30` shell is removed, Escape rides the plan-01 `dialogStack` LIFO (no bespoke `document` keydown listener — Pitfall 2, so the SearchSheet swap stays topmost-only), and the one-tap-Undo-vs-confirm-gated-`deleteEntry` split (D-15) plus the WR-01 outcome recompute are unchanged.
- **WhyDetail** now renders through `<Sheet modal>` (Open Q1 — included): the `z-20` shell is removed, the header-X and backdrop both map to `onClose`, focus restores to the long-press trigger automatically, and the untrusted-text `reason` + STAT-01 corpus / D-08 debut framing are unchanged.
- Added Escape→`onClose` assertions to `endShowDialog.test.tsx` (dismiss without finalizing) and `trailNodeSheet.test.tsx` (dismiss without deleting). Full app suite green (252 tests, up from 250 — the two new assertions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate EndShowDialog to `<Sheet modal>`** - `671cc80` (feat)
2. **Task 2: Migrate TrailNodeSheet to `<Sheet modal>` (LIFO-aware)** - `60c39f1` (feat)
3. **Task 3: Migrate WhyDetail to `<Sheet modal>` (Open Q1)** - `9b61b93` (feat)

## Files Created/Modified
- `packages/app/src/show/EndShowDialog.tsx` - Confirm content wrapped in `<Sheet modal>`; removed `z-30`/backdrop/duplicate open-guard.
- `packages/app/src/show/TrailNodeSheet.tsx` - Editor content wrapped in `<Sheet modal>`; removed `z-30`; Escape via shared LIFO (no local listener).
- `packages/app/src/show/WhyDetail.tsx` - "Why" content wrapped in `<Sheet modal>`; removed `z-20`; X + backdrop → `onClose`.
- `packages/app/test/endShowDialog.test.tsx` - Added Escape-dismisses-without-finalizing assertion.
- `packages/app/test/trailNodeSheet.test.tsx` - Added Escape-dismisses-without-deleting assertion.

## Decisions Made
- **Preserved existing WhyDetail aria-label:** kept `Why <song>?` (already present) rather than the plan's suggested `<song> — why` — functionally equivalent accessible name, no new interpolation surface (T-08-05).
- **Dropped the duplicate open-guard in EndShowDialog:** `<Sheet open={open}>` owns closed→null (the "renders nothing when closed" test still passes because `container.firstChild` is null). The persist-warning `useEffect` retains its own `if (!open) return` self-guard.
- **No bespoke Escape listener in TrailNodeSheet:** relied on the plan-01 `dialogStack` LIFO per RESEARCH Pitfall 2, so when the sheet swaps to SearchSheet a single Escape dismisses only the topmost dialog.

## Deviations from Plan

None - plan executed exactly as written. (The WhyDetail aria-label wording is a preservation choice, not a behavior change — see Decisions.)

## Issues Encountered
None. All three test targets (`endShowDialog`, `trailNodeSheet`, `predictionOrb`) plus the full 252-test app suite are green; `tsc --noEmit` exits 0 after each task.

## Verification
- `endShowDialog.test.tsx` 4/4, `trailNodeSheet.test.tsx` 6/6, `predictionOrb.test.tsx` 4/4 — all green.
- Full app suite: **252 passed (42 files)**.
- App `tsc --noEmit`: **exit 0**.
- Grep confirms **no `z-[0-9]` literal** remains in `EndShowDialog.tsx`, `TrailNodeSheet.tsx`, or `WhyDetail.tsx`.
- Grep confirms **no `addEventListener("keydown", …)`** was added in any of the three files.

## Threat Flags
None. No new network endpoints, auth paths, file access, or schema changes. Song names continue to render as React text only (no `dangerouslySetInnerHTML`), and no new packages were installed (T-08-SC).

## User Setup Required
None.

## Next Phase Readiness
- Three of the seven A11Y-01 surfaces are done. Remaining modal migrations: 08-03 (ShareCardSheet, CompareView `fullscreen`, Settings "whose dex?" prompt), 08-04 (FilterFab z-lift + non-modal NodeSheet Escape/restore), 08-05 (remaining raw `z-*` literals → `config.ui.z`).
- No shared-file (STATE.md/ROADMAP.md) writes were made — the orchestrator owns those after the wave completes.

---
*Phase: 08-on-device-ui-polish-accessibility*
*Completed: 2026-07-18*

## Self-Check: PASSED

- All 5 modified files present on disk.
- All task commits (`671cc80`, `60c39f1`, `9b61b93`) present in git history.
- No `z-[0-9]` literal or bespoke keydown listener in the three migrated components.
