---
phase: 09-data-integrity-restore-ux
plan: 02
subsystem: testing
tags: [pwa, import, restore, dexie, vitest, react-testing-library]

# Dependency graph
requires:
  - phase: 06-pokedex-compare-backup
    provides: "D-17 import fork (classifyImport/pickAndImport), union-merge (parseAndMergeImport), the owner-identity meta row"
  - phase: quick/260716-vw2
    provides: "WARNING-1 fix — classifyImport widens owned-file-with-unset-local-owner to `unowned`; the typed-name file-owner match landed in e08ceee"
provides:
  - "isTypedNameMine — a pure, directly-tested typed-name it's-mine decision helper (packages/app/src/settings/ownerMatch.ts)"
  - "Unit coverage of the isMine edge matrix (local leg, file-owner leg, case/whitespace, empty-answer, null owners)"
  - "Component proof: typing your own owner name on an evicted DB reaches the merge/restore path (not read-only compare)"
  - "Real-Dexie integration proof: the evicted-DB union merge preserves every local row and adds the file's rows (zero drops)"
  - "PWA-05 closed with automated coverage only — no UX/copy changes (D-03)"
affects: [data-integrity, restore, backup, import-fork]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-decision-helper extraction (classifyImport style): sibling module, exported, zero DB/DOM, byte-equivalent to the inline logic it replaces"
    - "Configurable vi.fn() mock (classifyImportMock) for injecting per-case classifications into a whole-module mock"

key-files:
  created:
    - packages/app/src/settings/ownerMatch.ts
    - packages/app/test/ownerMatch.test.ts
  modified:
    - packages/app/src/settings/SettingsView.tsx
    - packages/app/test/settingsOwner.test.tsx
    - packages/app/test/importFork.test.ts

key-decisions:
  - "Extracted the isMine decision into a NEW sibling module (ownerMatch.ts), NOT into importPicker.ts — settingsOwner.test.tsx mocks the whole importPicker module, so co-locating would force the mock factory to re-export the helper"
  - "Byte-equivalent extraction: resolveNamePrompt delegates to isTypedNameMine with identical routing (D-03: tests + extraction only, no behavior change)"

patterns-established:
  - "Pattern 1: Pure decision helpers extracted from React handlers get flat one-it-per-edge unit tests + one component wiring test + one real-Dexie integration proof"
  - "Pattern 2: Whole-module vi.mock with a hoisted configurable vi.fn() delegate lets individual tests inject shape variants via mockReturnValueOnce"

requirements-completed: [PWA-05]

# Metrics
duration: 9min
completed: 2026-07-18
---

# Phase 9 Plan 2: PWA-05 Restore-Path Test Coverage Summary

**Closed PWA-05 by extracting the typed-name "it's mine" decision into a pure `isTypedNameMine` helper and proving the evicted-DB restore path three ways — unit edges, a component merge-route test, and a real-Dexie union-merge test that drops no local data.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-18T17:33:00Z
- **Completed:** 2026-07-18T17:39:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `isTypedNameMine(typedName, localOwnerName, fileOwner)` — a pure, zero-DB/DOM helper extracted byte-equivalently from `resolveNamePrompt`, with the PWA-05/WARNING-1 file-owner leg doc-commented (threat T-09-04 accepted).
- `resolveNamePrompt` now delegates to the helper; `importPicker.ts` and all prompt copy/config strings untouched (D-03).
- Six flat unit tests covering the full isMine edge matrix (both legs, case/whitespace insensitivity, empty-answer-never-mine, null/undefined file owner).
- New component test: file owned by "Matt" + local owner unset → type "matt" + confirm → `pickAndImport` fires once, success heading renders, no compare banner (the exact PWA-05 gap).
- New integration test: real `pickAndImport` on an evicted DB is a union — seeded local `attendedShows(111)` + `trackedShows(s-local)` survive AND the file's `attendedShows(222)` is added; `ownerName` meta stays unset (owner is a device-local fork key).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract isMine into pure ownerMatch.ts + unit tests** — `eaf4fa1` (test, RED) → `cd2b4eb` (feat, GREEN)
2. **Task 2: Component test — typed own name on evicted DB reaches merge path** — `6903293` (test)
3. **Task 3: Integration test — real union merge on evicted DB drops nothing** — `a058739` (test)

_Task 1 followed the TDD RED→GREEN cycle (no refactor commit — the GREEN implementation was already clean)._

## Files Created/Modified
- `packages/app/src/settings/ownerMatch.ts` (created) — pure `isTypedNameMine` decision helper; documents the local-owner and file-owner legs and the load-bearing `answer !== ""` guard.
- `packages/app/test/ownerMatch.test.ts` (created) — six flat one-`it`-per-edge unit tests.
- `packages/app/src/settings/SettingsView.tsx` (modified) — `resolveNamePrompt` delegates to `isTypedNameMine`; inline isMine computation removed; routing byte-equivalent.
- `packages/app/test/settingsOwner.test.tsx` (modified) — `classifyImport` mock converted to a configurable `classifyImportMock` (vi.fn); new PWA-05 typed-name→merge test.
- `packages/app/test/importFork.test.ts` (modified) — new evicted-DB union-merge integration test wiring `isTypedNameMine` to the real merge.

## Decisions Made
- **Sibling module over co-location:** `ownerMatch.ts` is a new sibling of `importPicker.ts` rather than an added export inside it, because `settingsOwner.test.tsx` mocks the entire `importPicker.ts` module — co-locating would force the mock factory to re-export the helper (per plan guidance).
- **Byte-equivalent extraction (D-03):** The helper reproduces the inline logic exactly (trim → lowercase → `answer !== ""` guard, local-owner OR file-owner leg); no routing or copy change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Vitest emits jsdom "Not implemented: getContext/navigation" noise in the full app-project run — pre-existing, unrelated to these tests; all 281 app tests pass.

## Verification
- `npx vitest run packages/app/test/ownerMatch.test.ts packages/app/test/settingsOwner.test.tsx packages/app/test/importFork.test.ts` — all green (6 + 9 + 9).
- `npx tsc --noEmit -p packages/app/tsconfig.json` — exits 0.
- `npx vitest run --project @guezzer/app` — 281 tests across 45 files pass.
- `git diff` confirms zero changes to `config.ts` copy strings and zero changes to `importPicker.ts` (D-03 honored; only SettingsView delegation + new ownerMatch.ts touch `src`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PWA-05 is provably closed: the typed-name decision is directly unit-tested, the merge route is component-proven on an evicted DB, and the real union merge is proven to drop no local data.
- No blockers. Full-workspace `npm test` (including core) is deferred to phase verification since plan 09-01 runs in the same wave.

## Self-Check: PASSED

All created files exist on disk (`ownerMatch.ts`, `ownerMatch.test.ts`, `09-02-SUMMARY.md`) and all task commits are present in git history (`eaf4fa1`, `cd2b4eb`, `6903293`, `a058739`, `0006bd1`). Working tree clean.

---
*Phase: 09-data-integrity-restore-ux*
*Completed: 2026-07-18*
