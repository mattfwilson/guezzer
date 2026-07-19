---
phase: 12-data-safety-integrity
plan: 02
subsystem: ui
tags: [react, backup, toast, indexeddb, dexie, end-show, data-safety]

# Dependency graph
requires:
  - phase: 05-export-import (D-13 End-Show auto-backup)
    provides: exportBackup() never-throw contract + EndShowDialog finalize/backup flow
  - phase: 04-show-mode
    provides: endShow(sessionId) finalize + EndShowDialog confirm gate (T-04-18)
provides:
  - App-level ephemeral "Backup saved" toast (BackupToast) with a module-level emitter seam
  - Async End-Show sequence that finalizes BEFORE the backup snapshot is read (SAFE-01)
  - Honest confirmation — the toast appears only after a real { ok: true } export (SAFE-03)
affects: [12-data-safety-integrity, export-import, show-mode, recap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level emitter seam (showBackupToast/subscribeBackupToast) so an unmounting component can trigger an App-level overlay without setState-after-unmount"
    - "App-level overlay hosting so notifications survive route/subtree swaps (ShowView→RecapView)"

key-files:
  created:
    - packages/app/src/components/BackupToast.tsx
  modified:
    - packages/app/src/App.tsx
    - packages/app/src/show/EndShowDialog.tsx
    - packages/app/test/endShowDialog.test.tsx

key-decisions:
  - "Toast trigger is a module-level emitter, not props/context — confirming End Show unmounts the dialog subtree, so a dialog-owned toast could never render"
  - "handleConfirm awaits endShow BEFORE exportBackup so the snapshot always reads a finalized show (SAFE-01)"
  - "showBackupToast fires only inside if(ok) after exportBackup resolves — a failed backup shows no success toast (SAFE-03)"
  - "Reused existing config copy (endShowBackupConfirmation); no new copy key added"

patterns-established:
  - "Emitter seam for decoupled overlay triggers: let listener + showX()/subscribeX() mirrors the bottom-overlay height-registration idiom"
  - "App-level overlay stack hosts transient notifications (InstallBanner, UpdateToast, BackupToast) above the tab router"

requirements-completed: [SAFE-01, SAFE-03]

# Metrics
duration: ~25min
completed: 2026-07-19
---

# Phase 12 Plan 02: Honest End-Show Auto-Backup Summary

**End-Show now finalizes the show before the backup snapshot is read (SAFE-01) and shows an App-level "Backup saved" toast only after a real successful export (SAFE-03), via a module-level emitter that survives the ShowView→RecapView swap.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-19T~16:58Z
- **Completed:** 2026-07-19T17:06Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- New `BackupToast` component with a module-level `showBackupToast()`/`subscribeBackupToast()` emitter seam, hosted at App level as a sibling of `<UpdateToast/>` so it survives the ShowView→RecapView unmount.
- Rewired `EndShowDialog.handleConfirm` to an async sequence: `await endShow` (commit finalize) → `onEnded?` → `onClose` → `await exportBackup()` → `if (ok) showBackupToast()`.
- Removed the dishonest static `CircleCheck` "Backup saved" markup that rendered unconditionally while the dialog was open.
- Extended the component test to prove finalize-before-snapshot ordering, toast-only-on-success, and absence of the premature static confirmation (8 tests green).

## Task Commits

Each task was committed atomically:

1. **Task 1: BackupToast component + emitter, hosted in App.tsx** - `58722b1` (feat)
2. **Task 2: Async finalize→backup→toast sequence; static markup removed** - `f70cfe3` (fix)
3. **Task 3: Ordering + toast-only-on-success + no-static-markup tests** - `01b1333` (test)

**Plan metadata:** final docs commit (this SUMMARY + STATE + ROADMAP).

## Files Created/Modified
- `packages/app/src/components/BackupToast.tsx` - NEW: App-level ephemeral toast + `showBackupToast()` emitter and `subscribeBackupToast()` subscriber; auto-dismisses; reuses `config.copy.settings.endShowBackupConfirmation`; registers height under the `"backupToast"` overlay key.
- `packages/app/src/App.tsx` - Renders `<BackupToast />` as a sibling of `<UpdateToast />` in the overlay stack (above the tab router).
- `packages/app/src/show/EndShowDialog.tsx` - `handleConfirm` now async (awaits `endShow` before `exportBackup`, fires the toast only on `{ ok: true }`); static `CircleCheck` markup + unused import removed; `ShieldAlert` persist warning retained.
- `packages/app/test/endShowDialog.test.tsx` - Added `exportBackup`/`showBackupToast` mocks + 4 new cases (SAFE-01 ordering, SAFE-03 toast-on-success, no-toast-on-failure, no static markup); existing confirm case updated to await the now-async close.

## Decisions Made
- **Module-level emitter over props/context** — confirming End Show makes `ShowView` early-return `<RecapView>`, unmounting the dialog subtree; only an App-hosted overlay triggered by a decoupled emitter can render the confirmation.
- **Finalize awaited before snapshot** — `await endShow(sessionId)` guarantees the show is `finalized` before `exportBackup` reads it, so a restored backup can never resurrect an active show.
- **Toast gated on real success** — `showBackupToast()` lives inside `if (ok)`, so a failed export produces no success signal.
- **No new copy** — reused the existing `endShowBackupConfirmation` string per the plan's smallest-hardening posture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored npm-based node_modules after an errant pnpm install**
- **Found during:** Task 1 verification (typecheck) / Task 3 (test run)
- **Issue:** CLAUDE.md recommends pnpm, but this repo is actually installed via **npm workspaces** (tracked `package-lock.json`, no `pnpm-workspace.yaml`). Running `corepack pnpm --filter … exec` triggered a pnpm install that created a `.pnpm` store and `pnpm-lock.yaml`, causing React/react-dom to resolve to two different instances — the test suite then failed with `Cannot read properties of null (reading 'useState')`.
- **Fix:** Removed the untracked `pnpm-lock.yaml` and `node_modules/.pnpm` store, then ran `npm install` to restore the hoisted npm layout. Ran typecheck via the repo-local `node_modules/.bin/tsc -p tsconfig.json` and tests via `node_modules/.bin/vitest` instead of pnpm.
- **Files modified:** None tracked (node_modules / lockfile only; no repo source touched). No pnpm artifacts committed.
- **Verification:** `git status --short` shows only the intended source/test files; all 8 tests green; `tsc --noEmit` exit 0.
- **Committed in:** N/A (environment-only; no repo file change)

**2. [Rule 1 - Bug] Wrapped the async onClick to avoid a floating promise**
- **Found during:** Task 2
- **Issue:** `handleConfirm` became `async` (returns a Promise); binding it directly as `onClick={handleConfirm}` leaks an unhandled promise into the DOM handler.
- **Fix:** Changed the confirm button to `onClick={() => void handleConfirm()}`, mirroring the existing `void updateServiceWorker(true)` idiom in `UpdateToast`.
- **Files modified:** packages/app/src/show/EndShowDialog.tsx
- **Verification:** `tsc --noEmit` passes; confirm flow test green.
- **Committed in:** f70cfe3 (Task 2 commit)

---

**Total deviations:** 2 (1 blocking environment fix, 1 bug). No scope creep — both necessary to complete/verify the plan.
**Impact on plan:** All planned artifacts delivered exactly as specified; no source-level deviations from the intended design.

## Issues Encountered
- The pnpm/npm mismatch (deviation 1) was the only friction — resolved by using the repo's actual npm toolchain and repo-local binaries for typecheck/test.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — the toast is wired to real data (the reused config copy and the real `exportBackup` result); no placeholder or empty-state stubs introduced.

## Next Phase Readiness
- SAFE-01 and SAFE-03 satisfied; the End-Show backstop is now honest about both content and success.
- Plan 12-03 remains in this phase. The App-level emitter pattern is available for reuse by any future transient App-level notification.

## Self-Check: PASSED
- Files: all 4 (BackupToast.tsx, App.tsx, EndShowDialog.tsx, endShowDialog.test.tsx) FOUND.
- Commits: 58722b1, f70cfe3, 01b1333 all FOUND in git history.
- Verification: `tsc --noEmit` exit 0; `vitest run` for endShowDialog.test.tsx — 8/8 green.

---
*Phase: 12-data-safety-integrity*
*Completed: 2026-07-19*
