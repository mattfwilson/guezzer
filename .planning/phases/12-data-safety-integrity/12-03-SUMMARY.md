---
phase: 12-data-safety-integrity
plan: 03
subsystem: ui
tags: [ios-safari, object-url, download, blob, share-card, pwa]

# Dependency graph
requires:
  - phase: 05-live-sync-data-safety
    provides: exportBackup anchor-download idiom + config.dataSafety.SCHEMA_VERSION
  - phase: 06-pokedex-history-stats
    provides: shareCard shareOrDownload web-share/anchor fallback
provides:
  - Single browser-only triggerDownload(data, filename) helper with deferred setTimeout revoke
  - config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS revoke-delay constant (5000ms)
  - Both backup JSON and share-card PNG downloads now route through the one helper
affects: [data-safety, downloads, share-card, backup, ios-safari]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One centralized anchor-download idiom (triggerDownload) — no copied browser I/O"
    - "Deferred object-URL revoke via setTimeout so iOS Safari can begin the download"

key-files:
  created:
    - packages/app/src/settings/triggerDownload.ts
    - packages/app/test/triggerDownload.test.tsx
  modified:
    - packages/app/src/config.ts
    - packages/app/src/settings/exportDownload.ts
    - packages/app/src/dex/shareCard.ts
    - packages/app/test/shareCard.test.tsx

key-decisions:
  - "Object URL revoked only after config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS (5000ms), never on the click tick (D-06)"
  - "Anchor-download idiom centralized in exactly one place (triggerDownload) consumed by both exportDownload.ts and shareCard.ts (D-07)"
  - "previewUrl in shareCard.ts left untouched — released by ShareCardSheet effect cleanup, intentionally NOT centralized (RESEARCH SAFE-02)"
  - "Revoke delay is app-only (browser-timing) — no core mirror, configMirror.test unchanged"

patterns-established:
  - "triggerDownload(data, filename): create object URL → rel=noopener anchor → click → remove → setTimeout deferred revoke"
  - "Consumers keep their own never-throw outer wrappers; only the inner anchor idiom is shared"

requirements-completed: [SAFE-02]

# Metrics
duration: 3min
completed: 2026-07-19
---

# Phase 12 Plan 03: Deferred Object-URL Revoke for iOS Downloads Summary

**Backup JSON and share-card PNG downloads on iOS Safari no longer abort on a same-tick `revokeObjectURL` — the anchor-download idiom is centralized in one `triggerDownload` helper that defers the revoke by a config-tunable delay.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-19T21:09:26Z
- **Completed:** 2026-07-19T21:11:48Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Added `config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS = 5000` (safe 1000–10000ms band, SAFE-02 UAT-gated) alongside `SCHEMA_VERSION` in the single app config block.
- Created the browser-only `triggerDownload(data, filename)` helper that defers the object-URL revoke via `setTimeout`, never on the click tick (D-06).
- Rewired both `exportBackup` (backup JSON) and `shareOrDownload` (share-card PNG fallback) onto the single helper — the same-tick `finally { URL.revokeObjectURL }` bug now exists in zero places (D-07).
- Left `previewUrl` untouched with a comment marking it as a non-bug (released by `ShareCardSheet` cleanup) so no reviewer "fixes" it.
- Fake-timer test proves the revoke is NOT called synchronously and IS called exactly once with the created URL after the delay.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add revoke-delay config constant + triggerDownload helper + fake-timer test** - `bdfb2e0` (feat)
2. **Task 2: Adopt triggerDownload in exportDownload.ts and shareCard.ts** - `8cdc17a` (fix)

## Files Created/Modified
- `packages/app/src/settings/triggerDownload.ts` (created) - Single deferred-revoke anchor-download helper.
- `packages/app/test/triggerDownload.test.tsx` (created) - Fake-timer test: revoke deferred, once, with the created URL; anchor rel=noopener + removed.
- `packages/app/src/config.ts` (modified) - Added `OBJECT_URL_REVOKE_DELAY_MS` to the `dataSafety` block.
- `packages/app/src/settings/exportDownload.ts` (modified) - Inner try/finally replaced by `triggerDownload`; outer never-throw `{ ok }` wrapper retained.
- `packages/app/src/dex/shareCard.ts` (modified) - Share fallback uses `triggerDownload`; `previewUrl` untouched with explanatory comment; never-throw `{ ok, method }` contract retained.
- `packages/app/test/shareCard.test.tsx` (modified) - Fallback-download test now advances fake timers to observe the deferred revoke.

## Decisions Made
- Followed the plan and PATTERNS exactly: 5000ms default, one helper, app-only constant (no core mirror).
- Chose to update the existing `shareCard.test.tsx` fallback test to assert deferred (not same-tick) revoke — required by the behavior change, kept as coverage rather than deleting the assertion.

## Deviations from Plan

None — plan executed exactly as written. The only work beyond the literal task text was updating the pre-existing `shareCard.test.tsx` fallback-download assertion (line ~272) that asserted a synchronous revoke; the deferred-revoke change made that assertion stale. This is directly caused by this task's behavior change (in scope) and was converted to a fake-timer assertion that verifies the new deferred contract. `exportImportRoundtrip.test.ts` needed no change (it only captures the blob from `createObjectURL`, does not assert on revoke).

## Issues Encountered
None. jsdom emits harmless "Not implemented: navigation to another Document" notices from `anchor.click()` and canvas `getContext` notices from the share-card render tests — both pre-existing and unrelated.

## Verification
- `vitest run --project @guezzer/app` — 46 files, 299 tests GREEN (incl. new `triggerDownload.test.tsx`).
- `tsc --noEmit -p packages/app/tsconfig.json` — clean (exit 0).
- `grep revokeObjectURL packages/app/src/settings/exportDownload.ts` — 0 matches.
- `shareCard.ts` — no `revokeObjectURL`; only the untouched `previewUrl` `createObjectURL`; download fallback calls `triggerDownload`.
- Exactly one `export function triggerDownload` in the app source.

## Manual UAT Required (SAFE-02, D-08 — cannot be unit-tested)
On a real iOS Safari device (installed PWA and browser tab):
1. End a show and confirm the backup JSON downloads and saves.
2. Open a share card and confirm the PNG downloads and saves.
Both must complete without the download aborting. Persist as a UAT item before `/gsd-verify-work`.

## Next Phase Readiness
- SAFE-02 code-complete; remaining gate is the device UAT above.
- No blockers. All three Phase 12 plans (12-01 SAFE-04, 12-02 SAFE-01/03, 12-03 SAFE-02) now executed.

---
*Phase: 12-data-safety-integrity*
*Completed: 2026-07-19*

## Self-Check: PASSED
- FOUND: packages/app/src/settings/triggerDownload.ts
- FOUND: packages/app/test/triggerDownload.test.tsx
- FOUND: .planning/phases/12-data-safety-integrity/12-03-SUMMARY.md
- FOUND commit: bdfb2e0 (Task 1)
- FOUND commit: 8cdc17a (Task 2)
