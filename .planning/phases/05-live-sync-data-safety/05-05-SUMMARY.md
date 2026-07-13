---
phase: 05-live-sync-data-safety
plan: 05
subsystem: ui
tags: [pwa, data-safety, export, import, dexie, indexeddb, backup, settings, react]

# Dependency graph
requires:
  - phase: 05-live-sync-data-safety (Plan 05-02)
    provides: "@guezzer/core serializeExport / parseAndMergeImport / ExportSnapshot / ImportResult / exportEnvelope"
  - phase: 05-live-sync-data-safety (Plan 05-03)
    provides: "Dexie v3 schema + importSnapshot helper + config.dataSafety / config.copy.settings"
  - phase: 04-show-mode
    provides: "EndShowDialog finalize flow, AppMenu bottom sheet, useHashRoute allow-list, PersistStatus meta"
provides:
  - "exportBackup(): never-throw Dexie-snapshot serialize + anchor-download of the versioned JSON"
  - "pickAndImport()/openBackupFilePicker(): iOS-safe file picker + core validate/merge + atomic commit"
  - "SettingsView (#/settings): accent Export CTA, neutral Import flow, storage-status readout, no destructive control"
  - "AppMenu Settings entry + 'settings' route (no 4th bottom tab)"
  - "End-Show auto-backup nudge + one-time persist-denied warning"
affects: [phase-06-dex, phase-07-explore]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Never-throw browser-API utilities (persist.ts idiom) for export/import"
    - "Validate-then-merge-then-commit: core is DB-free, app commits atomically only on ok:true"
    - "Route-selection stays a validated allow-list; new surfaces extend ROUTES, never innerHTML/eval"

key-files:
  created:
    - packages/app/src/settings/exportDownload.ts
    - packages/app/src/settings/importPicker.ts
    - packages/app/src/settings/SettingsView.tsx
    - packages/app/test/exportImportRoundtrip.test.ts
  modified:
    - packages/app/src/routing/useHashRoute.ts
    - packages/app/src/components/AppMenu.tsx
    - packages/app/src/App.tsx
    - packages/app/src/components/PlaceholderView.tsx
    - packages/app/src/show/EndShowDialog.tsx
    - packages/app/test/route.test.ts

key-decisions:
  - "Import commits via the module-level importSnapshot() export, not a db method (plan said db.importSnapshot)"
  - "PlaceholderView prop narrowed to placeholder-only routes so placeholders[route] stays exhaustive after adding 'settings'"
  - "End-Show backup nudge rendered as a muted at-confirm line (BackupNudge intent) since the existing test requires a synchronous onClose on confirm"

patterns-established:
  - "Anchor-download + URL.createObjectURL/revokeObjectURL wrapped in try/finally/catch; never the File System Access API (iOS Safari gap)"
  - "Import result rendered as fixed config copy + merge COUNTS only — never an echoed imported string (T-05-16)"

requirements-completed: [PWA-04]

# Metrics
duration: ~30min
completed: 2026-07-13
---

# Phase 5 Plan 05: Data-Safety Vertical Slice Summary

**PWA-04 end-to-end: a prominent JSON export/import Settings surface plus an End-Show auto-backup nudge make losing a phone never mean losing the dex — every row round-trips through Dexie, and corrupt files are rejected whole.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 completed
- **Files created:** 4
- **Files modified:** 6

## Accomplishments
- Never-throw `exportBackup()` / `pickAndImport()` / `openBackupFilePicker()` wired against the prior-wave core (`serializeExport`/`parseAndMergeImport`) and the Dexie `importSnapshot` atomic-commit seam — no re-implementation of serialize/merge logic.
- `SettingsView` at `#/settings`, reachable via a neutral AppMenu Settings entry (no 4th bottom tab, D-14): single accent Export CTA, neutral Import flow with success-counts / rejection feedback, and a `ShieldCheck`/`ShieldAlert` storage-protection readout — no destructive control.
- End-Show auto-backup: `EndShowDialog` fires `exportBackup()` on confirm (after `endShow`), shows a muted non-blocking nudge, and warns once (meta-flag-gated) if `persist()` was denied.
- New round-trip + malformed/wrong-file no-mutation tests; full app suite green (265 tests) and `tsc --noEmit` clean.

## Task Commits

1. **Task 1: export/import browser utilities (never-throw)** - `d052706` (feat)
2. **Task 2: SettingsView + settings route + AppMenu entry** - `6e5164f` (feat)
3. **Task 3: End-Show auto-backup nudge + one-time persist-denied warning** - `62060ec` (feat)

## Files Created/Modified
- `packages/app/src/settings/exportDownload.ts` - Reads the Dexie snapshot, serializes the D-09 envelope via core, anchor-downloads a dated JSON; never throws.
- `packages/app/src/settings/importPicker.ts` - File picker + `file.text()` + core validate/merge + atomic `importSnapshot`; zero DB write on a rejected file.
- `packages/app/src/settings/SettingsView.tsx` - The `#/settings` Backup & data surface (Export/Import + storage status, no destructive control).
- `packages/app/src/routing/useHashRoute.ts` - `ROUTES` gains `"settings"` (validated allow-list extension).
- `packages/app/src/components/AppMenu.tsx` - Neutral Settings row (gear) → `navigate("settings")` + `onClose()`.
- `packages/app/src/App.tsx` - `route === "settings"` render branch → `SettingsView`.
- `packages/app/src/components/PlaceholderView.tsx` - Prop type narrowed to placeholder-only routes (tsc exhaustiveness after the new route).
- `packages/app/src/show/EndShowDialog.tsx` - Auto-backup on confirm + one-time persist-denied warning.
- `packages/app/test/exportImportRoundtrip.test.ts` - Round-trip preservation + malformed/wrong-file no-mutation.
- `packages/app/test/route.test.ts` - Allow-list assertion extended for `"settings"`.

## Decisions Made
- **Import commit API:** the plan's `<action>` said `db.importSnapshot(merged)`, but the real db.ts API is a module-level `export async function importSnapshot(snapshot)`. Imported and called the standalone function (surfaced by a runtime "importSnapshot is not a function" TypeError in the round-trip test).
- **End-Show nudge shape:** the existing `endShowDialog.test.tsx` asserts a synchronous `onClose` on confirm (which unmounts the dialog in ShowView). To preserve that contract while still surfacing the D-13 "muted confirmation," the nudge is rendered as an at-confirm muted line (the `BackupNudge` component intent) rather than a post-close toast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import used the wrong commit API**
- **Found during:** Task 1
- **Issue:** Plan specified `db.importSnapshot(merged)`, but db.ts exposes `importSnapshot` as a module-level export, not a `db` method — round-trip test threw `importSnapshot is not a function`.
- **Fix:** Import and call the standalone `importSnapshot(result.merged)`.
- **Files modified:** packages/app/src/settings/importPicker.ts
- **Verification:** `exportImportRoundtrip.test.ts` round-trip passes (all seeded rows restored).
- **Committed in:** `d052706`

**2. [Rule 3 - Blocking] Adding "settings" broke PlaceholderView typecheck**
- **Found during:** Task 2
- **Issue:** `config.copy.placeholders[route]` is not exhaustive once `Route` includes `"settings"` (no placeholder entry) — `tsc` error.
- **Fix:** Narrowed `PlaceholderView`'s prop to `keyof typeof config.copy.placeholders`; App.tsx passes the narrowed `explore | dex`.
- **Files modified:** packages/app/src/components/PlaceholderView.tsx
- **Verification:** `tsc --noEmit` clean.
- **Committed in:** `6e5164f`

**3. [Rule 3 - Blocking] route.test.ts exact-match assertion**
- **Found during:** Task 2
- **Issue:** `route.test.ts` asserts `ROUTES` equals `["show","explore","dex"]`; adding `"settings"` fails the verify command.
- **Fix:** Updated the allow-list assertion and added a `#/settings` resolution case.
- **Files modified:** packages/app/test/route.test.ts
- **Verification:** `route.test.ts` passes (6 tests).
- **Committed in:** `6e5164f`

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking issues)
**Impact on plan:** All fixes were necessary to build/typecheck/test. No scope creep; the plan's architecture (core-owned serialize/merge, atomic app commit, allow-list route) was followed exactly.

## Issues Encountered
- **Vitest invocation quirk:** the plan's `cd packages/app && npx vitest run <file>` command fails with `MissingAPIError IndexedDB API missing` (and no jsdom) because it bypasses the root `vitest.config.ts` `projects` env/setup — a pre-existing condition that affects `db.test.ts` too. Verification was run from the repo root (`npx vitest run [...]`), which applies the jsdom + fake-indexeddb setup. All targeted tests and the full 265-test suite pass there.
- Benign jsdom warning `Not implemented: navigation to another Document` from `anchor.click()` during export tests — expected, not a failure.

## Threat Flags
None — no new trust boundary beyond the plan's `<threat_model>`. The import path (T-05-15/16), route allow-list (T-05-17), and export-backstop (T-05-18) mitigations are all in place; no destructive control shipped (T-05-19); no new dependencies (T-05-SC).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PWA-04 satisfied: export/import round-trips all personal data; End-Show auto-backup surfaces the backstop.
- Manual device gates (installed-iOS-PWA auto-download; export→loss→import restore) remain deferred per 05-VALIDATION §Manual-Only.
- Phase 6 (Dex) and 7 (Explore) can rely on the stable `#/settings` route and the export/import seam for data portability.
