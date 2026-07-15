---
phase: 06-pok-dex-history-stats
plan: 07
subsystem: database
tags: [dexie, zod, export-schema, migration, indexeddb, data-safety, react]

# Dependency graph
requires:
  - phase: 05-live-sync-data-safety
    provides: "export envelope v1, serializeExport, parseAndMergeImport, importSnapshot, MIGRATIONS chain"
  - phase: 06-pok-dex-history-stats (06-01)
    provides: "archive-types.ts set-shape vocabulary (n: 1|2|e)"
  - phase: 06-pok-dex-history-stats (06-06)
    provides: "SettingsView surface + getMeta/setMeta useLiveQuery idiom"
provides:
  - "Export envelope v2: owner (D-17 fork key) + archiveShows fallback setlist cache"
  - "MIGRATIONS[1] v1->v2 (v1 backups import losslessly)"
  - "Dexie version(4) archiveShows cache table (additive)"
  - "markShowAttended / unmarkShowAttended atomic retro-mark helpers (DEX-02 substrate)"
  - "db.snapshot() single export-assembly path (reads owner from meta ownerName)"
  - "Settings owner-name identity field"
affects: [06-08 ArchiveBrowser retro-mark, 06-10 compare fork/CompareView]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "zod .default() on envelope fields so v1 files parse while output type stays required"
    - "Atomic two-table mark (attendedShows + archiveShows) in one db.transaction (Pitfall 5)"
    - "Single export-assembly path via db.snapshot() shared by exportDownload + importPicker"

key-files:
  created:
    - packages/app/test/retroMark.test.ts
    - packages/app/test/settingsOwner.test.tsx
  modified:
    - packages/core/src/data-safety/export-schema.ts
    - packages/core/src/data-safety/serialize.ts
    - packages/core/src/data-safety/merge.ts
    - packages/core/src/config.ts
    - packages/core/src/index.ts
    - packages/app/src/db/db.ts
    - packages/app/src/config.ts
    - packages/app/src/settings/exportDownload.ts
    - packages/app/src/settings/importPicker.ts
    - packages/app/src/settings/SettingsView.tsx
    - packages/core/test/serialize.test.ts
    - packages/core/test/merge.test.ts
    - packages/app/test/exportImportRoundtrip.test.ts
    - packages/app/test/migrationV3.test.ts

key-decisions:
  - "Envelope v2 owner/archiveShows use zod .default(null)/.default([]) — a genuine v1 file (missing both keys) parses cleanly, and the inferred OUTPUT type stays required so serialize/merge/snapshot never juggle undefined"
  - "owner is device-local fork state, never merged: parseAndMergeImport keeps the LOCAL owner; importSnapshot does NOT write owner into meta"
  - "archiveShows commits via bulkPut upsert (stable &show_id), NOT clear-and-rewrite — union-only additive table"
  - "OWNER_NAME_MAX_LENGTH=40 lives in core config (schema clamp) and is mirrored in app config (input maxLength) since core config is not barrel-exported"

patterns-established:
  - "zod .default() to keep a strict versioned envelope both migration-tolerant (v1 parses) and downstream-clean (required output type)"
  - "db.snapshot() as the one assembly path for export + local-merge reads"

requirements-completed: [SHAR-01, DEX-02]

# Metrics
duration: 12min
completed: 2026-07-14
---

# Phase 6 Plan 07: Envelope-v2 Atomic Cluster Summary

**Export backups now carry the owner's name (D-17 fork key) and an `archiveShows` setlist cache so online-fallback marks survive reload and round-trips; delivered as one atomic core↔app cluster with Dexie version(4), retro mark/unmark helpers, and a Settings owner-name field.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3/3 completed
- **Files modified:** 14 (2 created, 12 modified)
- **Tests:** 404 passing (both projects); `tsc --noEmit` green for core + app

## Accomplishments

### Task 1 — Envelope v2 (core)
- Added `archiveShowRow` (strictObject, enum-pinned `n: "1"|"2"|"e"`) and `owner` + `archiveShows` fields to `exportEnvelope`, using `.default(null)` / `.default([])` so a genuine v1 backup (lacking both keys) still parses.
- `config.dex.OWNER_NAME_MAX_LENGTH = 40` (ASVS V5 clamp on the untrusted owner string).
- `ExportSnapshot` carries `owner` + `archiveShows` verbatim through `serializeExport`.
- `MIGRATIONS[1]` (v1→v2) registered; `archiveShows` union-merge by `show_id` (local wins); merged `owner` kept from LOCAL (fork key, not merged state).
- Barrel-exported `archiveShowRow`.

### Task 2 — Dexie version(4) + retro helpers (app)
- `ArchiveShowRow` interface (reuses `SetNumber`), additive `this.version(4).stores({ archiveShows: "&show_id" })` — no `.upgrade`, prior tables untouched.
- `markShowAttended` writes the `attendedShows` stub and, when a `cachedSetlist` is supplied (online-fallback marks only), the `archiveShows` row — both in ONE transaction. `unmarkShowAttended` is a plain two-table delete.
- `db.snapshot()` single-assembly helper (reads every table + owner from meta `ownerName`); `importSnapshot` gains an `archiveShows` bulkPut upsert branch and deliberately does NOT write owner into meta.
- `config.dataSafety.SCHEMA_VERSION` bumped 1→2.

### Task 3 — Owner identity in Settings
- SettingsView owner-name text input bound to meta `ownerName` via `useLiveQuery` + `setMeta` (trimmed persist), `maxLength` from the mirrored app-config constant, ≥16px input (no iOS form-zoom).
- New `config.copy.settings` owner-field copy; app-config `OWNER_NAME_MAX_LENGTH` mirror.
- `exportDownload`/`importPicker` route through `db.snapshot()` (single assembly path).

## Verification

- `npx vitest run` — 404 passed (51 files) across both projects.
- `npx tsc --noEmit` — green for `packages/core` and `packages/app` (the enum-pinned cross-boundary contract holds: core `archiveShowRow` rows assign to `Table<ArchiveShowRow>`).
- Round-trip pinned: a fallback-marked show's `archiveShows` row survives snapshot → clear → importSnapshot (Pitfall 5); owner round-trips through export at schemaVersion 2.

## Deviations from Plan

### Auto-fixed / scope adjustments

**1. [Rule 3 - Blocking] `exportDownload.ts` snapshot-routing moved into Task 2**
- **Found during:** Task 2. Making `ExportSnapshot` require `owner`/`archiveShows` (Task 1) broke `exportDownload.ts`'s inline snapshot assembly, so the app failed `tsc` until routed through `db.snapshot()`.
- **Fix:** Routed `exportBackup` and `importPicker.readLocalSnapshot` through the new `db.snapshot()` in Task 2 (Task 3 then only added the Settings UI). This is exactly the "one assembly path" Task 3 called for.
- **Files:** exportDownload.ts, importPicker.ts. **Commit:** 0907968.

**2. [Rule 3 - Blocking] `migrationV3.test.ts` version assertion + import fixtures**
- **Issue:** Adding version(4) changed `db.verno` 3→4, and three `importSnapshot` fixtures lacked the new required `owner`/`archiveShows` fields (tsc + runtime break).
- **Fix:** Updated the verno assertion to 4 and added `owner: null` + `archiveShows: []` to the fixtures. **Commit:** 0907968.

**3. [Rule 2 - Coverage] Added `settingsOwner.test.tsx` (not in plan file list)**
- **Reason:** Task 3 acceptance requires a test asserting the field writes meta `ownerName` and that `maxLength` is enforced. The plan listed only `exportImportRoundtrip.test.ts` under Task 3 tests, so a dedicated component test file was added to satisfy acceptance. **Commit:** c0b4ce0.

**Note on `.default()` vs plain required fields:** the plan's action text wrote `owner: z.string().max(N).nullable()` (required). A required field would reject a v1 file at parse before the migration could run, contradicting the "v1 migrates cleanly" behavior. Resolved with `.default(null)`/`.default([])`, which keeps the parse migration-tolerant while the inferred output type stays required (documented in the schema).

## Known Stubs

None. All new symbols are wired: helpers are consumed by tests here and by the ArchiveBrowser (06-08) / compare fork (06-10) next.

## TDD Gate Compliance

Each task followed RED (test commit) → GREEN (feat commit): Task 1 (6d50636 → 09a3e3a), Task 2 (880db79 → 0907968), Task 3 tests + impl (c0b4ce0), plus a fixture fixup (5045bc2).

## Self-Check: PASSED

All listed files exist on disk; all three feat commits present in history.
