---
phase: 21-layout-layering-foundations
plan: 02
subsystem: ui
tags: [intl, date-formatting, timezone, vitest, tdd]

# Dependency graph
requires:
  - phase: 06-dex
    provides: "dex/formatMonYear.ts — the module-scope Intl.DateTimeFormat + never-throw formatter shape this plan renamed and extended"
provides:
  - "packages/app/src/dex/formatDate.ts — the single owner of both display date formats"
  - "formatFullDate(iso) — UTC-pinned 'Mon D, YYYY' show-date formatter, never-throw"
  - "formatMonYear(iso) — re-homed unchanged from formatMonYear.ts"
  - "packages/app/test/formatDate.test.ts — UTC-boundary, never-throw and source-guard coverage"
affects: [21-05, 21-06, 21-07, setlist-view, archive-browser, recap-view, share-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two module-scope Intl.DateTimeFormat constants per format, both timeZone-pinned, one module owns all display date formats"
    - "Source-scan guard (readFileSync + fileURLToPath) to lock a config value that behavior alone cannot catch on a UTC CI machine"

key-files:
  created:
    - packages/app/src/dex/formatDate.ts
    - packages/app/test/formatDate.test.ts
  modified:
    - packages/app/src/dex/SongRow.tsx
    - packages/app/src/show/WhyDetail.tsx
  deleted:
    - packages/app/src/dex/formatMonYear.ts

key-decisions:
  - "Timezone test setup takes option (c) from 21-PATTERNS §No Analog Found: assert UTC-pinned output directly plus a source guard, rather than setting process.env.TZ (races module-import formatter construction) or test.env.TZ in the shared root vitest.config.ts (blast radius across both workspace projects)"
  - "Doc-comment prose avoids the literal token `timeZone: \"UTC\"` so the plan's exact-count acceptance check (grep -c returns 2) counts real pins only, not mentions"

patterns-established:
  - "formatDate.ts is the display-date owner: D-35 display-only boundary stated in the module doc comment — a formatted date never reaches Dexie rows, the export envelope, export filenames, or the attendanceKey join key"
  - "Never-throw formatter contract: `Number.isNaN(date.getTime()) ? iso : FMT.format(date)` returns the raw input, which also makes '' round-trip to ''"

requirements-completed: [FOUND-04]

# Metrics
duration: 12min
completed: 2026-07-24
---

# Phase 21 Plan 02: UTC-Safe Display Date Helper Summary

**`dex/formatDate.ts` now owns both display date formats — the re-homed `formatMonYear` plus the new `formatFullDate` ("Mon D, YYYY") — each a module-scope `Intl.DateTimeFormat` pinned to `timeZone: "UTC"` and never-throw, with the pin itself locked by a source guard.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-24T21:09Z
- **Completed:** 2026-07-24T21:16Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 2 modified, 1 deleted via rename)

## Accomplishments

- `packages/app/src/dex/formatMonYear.ts` renamed to `formatDate.ts` via `git mv` (history follows); `formatMonYear` and its `MON_YEAR` formatter are byte-identical.
- `formatFullDate(iso: string): string` added as a sibling with its own `FULL_DATE` formatter — `month: "short", day: "numeric", year: "numeric", timeZone: "UTC"` — and the identical never-throw shape, so `""` round-trips to `""` for RecapView's `show?.date ?? ""` path.
- Module doc comment records the concrete UTC hazard (`"2026-08-15"` renders `Aug 14, 2026` in `America/New_York` without the pin), every downstream consumer by component name, and the D-35 display-only boundary.
- Both `formatMonYear` importers (`dex/SongRow.tsx`, `show/WhyDetail.tsx`) updated to the new path with the repo's `.ts` extension convention; rendered output unchanged (D-32).
- First direct unit test of this module: 11 cases across three `describe` blocks, including a TZ-independent demonstrative case and the source guard on the pin.

## Task Commits

1. **Task 1 (RED): failing test for `formatFullDate`** — `336dd62` (test)
2. **Task 1 (GREEN): rename module + add `formatFullDate`** — `7c6f55e` (feat)
3. **Task 2: full test spec — UTC boundary, never-throw, source guard** — `af0e841` (test)

_No REFACTOR commit — the GREEN implementation copies the shipped formatter shape verbatim; there was nothing to clean up._

## Files Created/Modified

- `packages/app/src/dex/formatDate.ts` (created via rename) — the single owner of both display date formats; exports `formatMonYear` and `formatFullDate`, two UTC pins, no default export.
- `packages/app/src/dex/formatMonYear.ts` (deleted) — renamed, per plan.
- `packages/app/test/formatDate.test.ts` (created) — 3 `describe` blocks / 11 `it` cases.
- `packages/app/src/dex/SongRow.tsx` — import path updated to `./formatDate.ts`.
- `packages/app/src/show/WhyDetail.tsx` — import path updated to `../dex/formatDate.ts`.

## Decisions Made

- **Timezone test setup: option (c).** Asserted the UTC-pinned output directly and backed it with a source guard. Option (a) (`process.env.TZ` at the top of the test file) is brittle because both formatters are constructed at module import, before the assignment can be guaranteed to land. Option (b) (`test.env.TZ` in the root `vitest.config.ts`) changes shared config for both workspace projects — blast radius beyond this phase for one assertion. Option (c) is TZ-independent by construction, and the source guard closes the hole option (c) would otherwise leave: on a UTC CI machine, deleting the pin would not fail a single behavioral assertion.
- **The demonstrative hazard case is itself TZ-independent.** It builds a local `America/New_York` formatter and asserts `new Date("2026-01-01")` formats as `"Dec 31, 2025"`, then asserts `formatFullDate("2026-01-01")` differs. This documents *why* the pin exists without depending on the machine's zone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's `<verify>` command runs vitest from the wrong directory**

- **Found during:** Task 1 (RED verification)
- **Issue:** The plan specifies `cd packages/app && npx vitest run --project @guezzer/app …`. `packages/app` has no vitest config declaring projects — the projects list lives in the root `vitest.config.ts`, so vitest exits with `Error: No projects matched the filter "@guezzer/app"`.
- **Fix:** Ran the equivalent from the workspace root: `npx vitest run --project @guezzer/app packages/app/test/formatDate.test.ts packages/app/test/songRow.test.tsx`. No source or config change — the plan's command text is the only thing that was wrong.
- **Files modified:** None
- **Verification:** Both the targeted runs and the full `npm test` pass.
- **Committed in:** N/A (no file change)

**2. [Rule 1 - Bug] Doc-comment prose broke the plan's exact pin-count criterion**

- **Found during:** Task 1 (acceptance-criteria check)
- **Issue:** The first draft of the module doc comments quoted the literal token `timeZone: "UTC"` twice in prose, so `grep -c 'timeZone: "UTC"' packages/app/src/dex/formatDate.ts` returned 4 against the plan's required 2. The criterion is meant to count real pins, one per formatter.
- **Fix:** Rephrased both prose mentions to "pinned to UTC via `timeZone`" and "The UTC `timeZone` pin below" — same information, no false positives. Count is now exactly 2.
- **Files modified:** `packages/app/src/dex/formatDate.ts`
- **Verification:** `grep -c 'timeZone: "UTC"' packages/app/src/dex/formatDate.ts` → `2`.
- **Committed in:** `7c6f55e` (Task 1 GREEN commit)

**3. [Rule 2 - Missing Critical] Added a named-exports-only assertion to the source guard**

- **Found during:** Task 2
- **Issue:** Task 1's acceptance criterion "exports exactly two named functions and no default export" had no durable test — it was a one-time manual check that nothing would catch on regression.
- **Fix:** Added a second `it` to the `timezone pin (source guard)` block asserting the source has no `export default` and does export both named functions.
- **Files modified:** `packages/app/test/formatDate.test.ts`
- **Verification:** Test passes; the file has 11 cases against the plan's ≥ 9 requirement.
- **Committed in:** `af0e841` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** No scope creep. Deviation 1 was a command-text error in the plan with no code impact; 2 and 3 both tighten adherence to the plan's own stated criteria.

## Verification

- `npm test` — **126 files / 965 tests passed** (baseline 125 / 954; +1 file, +11 tests, zero regressions).
- `npm run build --workspace packages/app` — succeeds; both importer paths resolve. PWA precache 40 entries.
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `git grep -n 'formatMonYear.ts' -- packages` — no matches.
- `grep -c 'timeZone: "UTC"' packages/app/src/dex/formatDate.ts` — `2`.
- `test/songRow.test.tsx` passes unmodified (the indirect regression net for the rename).

## Known Stubs

None — both exported functions are fully implemented and unit-tested.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes. Zero packages added, removed or upgraded; `package.json` untouched. `Intl.DateTimeFormat` is a platform API.

Threat register dispositions from the plan:
- **T-21-04 (Tampering, display-only boundary):** D-35 stated in the module doc comment; both helpers are pure and return strings, and no writer imports them. The enforcing `attendanceKey` assertion lands with the call-site conversion in plan 21-05, as planned.
- **T-21-05 (DoS, unparseable date):** never-throw by construction, asserted by test for both formatters.
- **T-21-SC (Tampering, npm installs):** no install performed.

## Issues Encountered

- The plan's `<verify>` command directory error (see Deviation 1) — resolved by running from the workspace root.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `formatFullDate` is available for the plan 21-05 call-site conversion (`ShowView` header, `ShowsList`, `SetlistView` visible + `aria-label`, `ArchiveBrowser` visible + unmark-confirm `aria-label`, `RecapView` subline, `shareCard`).
- The D-35 display-only boundary is documented but not yet mechanically enforced — 21-05 owns the `attendanceKey` regex assertion (`/^date:\d{4}-\d{2}-\d{2}#/`).
- No blockers. This plan touched no shared layout, CSS, or config surface, so it carries no merge risk against the other Wave-1 plans.

## Self-Check: PASSED

- `packages/app/src/dex/formatDate.ts` — FOUND
- `packages/app/test/formatDate.test.ts` — FOUND
- `.planning/phases/21-layout-layering-foundations/21-02-SUMMARY.md` — FOUND
- `packages/app/src/dex/formatMonYear.ts` — correctly absent (renamed)
- Commits `336dd62`, `7c6f55e`, `af0e841` — all present in `git log`

## TDD Gate Compliance

RED (`336dd62` test) → GREEN (`7c6f55e` feat) → no REFACTOR needed. Gate sequence intact.

---
*Phase: 21-layout-layering-foundations*
*Completed: 2026-07-24*
