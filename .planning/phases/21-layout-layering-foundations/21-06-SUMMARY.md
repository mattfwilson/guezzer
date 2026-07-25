---
phase: 21-layout-layering-foundations
plan: 06
subsystem: ui
tags: [share-card, canvas, date-formatting, text-truncation, vitest, tdd]

# Dependency graph
requires:
  - phase: 21-layout-layering-foundations
    plan: 02
    provides: "packages/app/src/dex/formatDate.ts — formatFullDate, the UTC-pinned 'Mon D, YYYY' never-throw formatter"
  - phase: 06-dex
    provides: "shareCard.ts — centerText, truncateToWidth, the two footer draw sites, and the recorded mock-ctx test harness"
provides:
  - "packages/app/src/dex/shareCard.ts composeFooterLine — module-private, width-constrained footer composition"
  - "Both share-card footers (recap/collection + bingo trophy) draw 'Mon D, YYYY · Venue' bounded to width * 0.9"
  - "packages/app/test/shareCard.test.tsx — the FOUND-05 / D-36 overflow algorithm locked on both branches"
  - "makeMockCtx now carries the path/stroke surface, so the bingo trophy branch is unit-drawable"
affects: [21-13, share-card, recap-view, bingo-trophy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measure-the-fixed-part-first budgeting: the protected substring is measured, the remainder is the truncation budget handed to the shipped truncateToWidth — no second character-dropping routine"
    - "describe.each over a [name, factory] branch table to run one behavioural spec against two draw call sites"

key-files:
  created: []
  modified:
    - packages/app/src/dex/shareCard.ts
    - packages/app/test/shareCard.test.tsx
  deleted: []

key-decisions:
  - "composeFooterLine stays module-private and is tested through drawShareCard's captured fillText calls, per the plan's grep -c == 3 criterion — no export was added purely for testability"
  - "The bingo fixture is built locally in the test file rather than via core buildBingoShareCard: the footer spec needs a named date/venue pair, not a real marked board, and a local literal keeps the case independent of core's builder"
  - "makeMockCtx gained no-op beginPath/moveTo/arcTo/closePath/fill/stroke rather than a per-test stub, so any future test of the bingo branch inherits a drawable context"

patterns-established:
  - "D-36 rule stated in prose in the helper's doc comment ('truncate the venue, never the date'), so the invariant survives a reader who never opens the plan"
  - "Test-harness limits are documented at the describe block, naming the device UAT test that covers what the mock cannot"

requirements-completed: [FOUND-05]

# Metrics
duration: 8min
completed: 2026-07-24
---

# Phase 21 Plan 06: Share-Card Footer Date + Overflow Summary

**Both share-card footers now draw the show date as "Mon D, YYYY" through a module-private `composeFooterLine` that measures the date first and hands `truncateToWidth` only the leftover budget — so an over-long venue ellipsizes and the date never can.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-24T21:26Z
- **Completed:** 2026-07-24T21:33Z
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- `composeFooterLine(ctx, date, venue, maxWidth, size)` added beside `truncateToWidth`, following the file's conventions: module-private `function`, `ctx` first, pure over the passed context's `measureText`, doc comment stating the pixel/px units, the `ctx.font` precondition, and D-36's rule in words.
- Order of operations is exactly the RESEARCH §Share-Card Footer sequence: falsy venue returns the date untouched → set the 600-weight 44px face so `measureText` is honest → measure the `` `${date} · ` `` prefix → `venueBudget = maxWidth - prefixWidth` → the **shipped** `truncateToWidth` → compose. No new character-dropping loop exists.
- Both draw sites rewired: the recap/collection footer (`shareCard.ts:196`) and the bingo trophy footer (`shareCard.ts:464`), each passing `formatFullDate(...)` and the existing `width * 0.9` margin. Neither inline `` `${date} · ${venue}` `` composition survives.
- Both `centerText` calls, their positions (`height * 0.955`, `height * 0.99`), sizes (38, 44) and colors are untouched. The D-37 `height * 0.97` fallback is recorded as a comment at both draw sites, applied nowhere — the device pass (21-13 / UAT test 5) decides it.
- Test coverage went 10 → 20 cases in `shareCard.test.tsx`: a fixture-sanity case plus four D-36 cases run twice via `describe.each` over the recap and bingo branches, including the exact ellipsized string and a raw-ISO absence check.

## Task Commits

1. **Task 1 (RED): failing test for the formatted, width-constrained footer** — `f1fdc27` (test)
2. **Task 1 (GREEN): `composeFooterLine` + both footer draws rewired** — `388b28f` (feat)
3. **Task 2: full FOUND-05 / D-36 spec on both branches** — `c53391e` (test)

_No REFACTOR commit — the GREEN implementation is six statements over two shipped helpers; there was nothing to clean up._

## Files Created/Modified

- `packages/app/src/dex/shareCard.ts` — `formatFullDate` import, the `composeFooterLine` helper, both footer call sites, and the two D-37 comments. Nothing else changed.
- `packages/app/test/shareCard.test.tsx` — `showDataAt` / `bingoDataAt` / `footerLine` / `drawnCalls` fixtures, the FOUND-05 `describe` block, and the `makeMockCtx` path/stroke extension.

## Decisions Made

- **Tested through the public draw, not through an export.** The plan's `grep -c 'composeFooterLine' == 3` criterion (definition + two call sites) forbids widening the module's API for tests. Because the footer line is the last `fillText` on both branches, a three-line `footerLine(calls)` helper reaches it without exporting anything.
- **Exact-string assertions over shape assertions.** The mock's `measureText` is deterministic (`length * 12`), so the 972px budget is exactly 81 characters and the truncation boundary is exactly reproducible. The overflow case asserts the full literal `"Aug 14, 2026 · Saint Augustine Amphitheatre at the Anastasia Island Fairgrounds …"`, so a silent change to `truncateToWidth`'s boundary fails loudly rather than still passing a `toContain("…")`.
- **The harness's honesty is documented, not papered over.** The block doc comment says outright that the mock is linear in character count and ignores font size and face, so these cases verify the *algorithm* and not the real pixel fit — and names device UAT test 5 as what covers the rest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's `<verify>` command targets a project filter that does not exist at that path**

- **Found during:** Task 1 (RED verification)
- **Issue:** `cd packages/app && npx vitest run --project @guezzer/app …` fails with `No projects matched the filter "@guezzer/app"` — the projects list lives in the ROOT `vitest.config.ts`, not in `packages/app`. Wave 1 hit the identical defect (see 21-02-SUMMARY Deviation 1).
- **Fix:** Ran the equivalent from the workspace root: `npx vitest run --project @guezzer/app packages/app/test/shareCard.test.tsx`. Plan command text only; no source or config change.
- **Files modified:** None
- **Verification:** Both the targeted run and the full `npm test` pass.
- **Committed in:** N/A (no file change)

**2. [Rule 3 - Blocking] The shared mock context could not draw the bingo trophy branch**

- **Found during:** Task 2 (adding the bingo footer cases)
- **Issue:** `makeMockCtx` predates the bingo branch and exposes only `fillRect`/`fillText`/`measureText`/`save`/`restore`. `drawBingoShareCard` traces rounded board cells and badge pills first, so every bingo case threw `TypeError: ctx.beginPath is not a function` before reaching the footer under test. The plan's Task 2 requires the bingo branch to get the same four cases, so this blocked the task.
- **Fix:** Added the no-op path/stroke surface (`beginPath`, `moveTo`, `arcTo`, `closePath`, `fill`, `stroke`, plus `lineWidth`/`strokeStyle`) to `makeMockCtx`, with a comment saying the geometry is deliberately not asserted — the branch just has to be able to run. Purely additive; the three pre-existing `drawShareCard` tests are untouched and still pass.
- **Files modified:** `packages/app/test/shareCard.test.tsx`
- **Verification:** All 20 cases in the file pass; full `npm test` green.
- **Committed in:** `c53391e` (Task 2 commit)

**3. [Rule 3 - Blocking] Task 1's `<files>` lists only the source file, but `tdd="true"` requires a RED commit**

- **Found during:** Task 1 (RED)
- **Issue:** Task 1 is marked `tdd="true"`, which mandates a failing-test commit before the implementation, but its `<files>` names only `packages/app/src/dex/shareCard.ts`; the test file is listed under Task 2. Following `<files>` literally would make the RED gate impossible.
- **Fix:** Landed a minimal two-assertion RED case in `packages/app/test/shareCard.test.tsx` (the file the plan already scopes to this plan, via Task 2), then expanded it into the full parameterised spec during Task 2. Net effect on the plan's file set: zero — both tasks touch only the two files in `files_modified`.
- **Files modified:** `packages/app/test/shareCard.test.tsx`
- **Verification:** RED failed with `expected '2026-08-14 · Red Rocks' to be 'Aug 14, 2026 · Red Rocks'`; GREEN passed.
- **Committed in:** `f1fdc27` (RED), superseded by `c53391e`

**4. [Rule 3 - Blocking] `npm run build` does not typecheck**

- **Found during:** Task 1 (acceptance-criteria check)
- **Issue:** Task 1's criterion `npm run build --workspace packages/app succeeds` is stated as if the build proves typing. It does not — the script is `vite build`, an esbuild transpile with no type checking, so a type error in the new helper would ship a green build.
- **Fix:** Ran `npx tsc --noEmit -p packages/app/tsconfig.json` in addition to the build. Both are clean.
- **Files modified:** None
- **Verification:** `tsc --noEmit` exits 0; `vite build` succeeds (PWA precache 40 entries).
- **Committed in:** N/A (no file change)

---

**Total deviations:** 4 auto-fixed (all Rule 3 — blocking). Zero Rule 4 escalations.
**Impact on plan:** No scope creep. Deviations 1 and 4 are verification-command defects with no code impact (both are known repo-wide issues flagged before execution); 2 is a test-harness gap that had to close for the plan's own Task 2 criterion; 3 is a plan-internal inconsistency resolved without touching any file outside `files_modified`.

## Verification

- `npm test` — **128 files / 1012 tests passed**, zero failures (`shareCard.test.tsx` went 10 → 20 cases; +10, no regressions anywhere else).
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds; PWA precache 40 entries.
- `grep -c 'composeFooterLine' packages/app/src/dex/shareCard.ts` — **3** (definition + two call sites), as required.
- `grep -c 'formatFullDate' packages/app/src/dex/shareCard.ts` — **3** (import + two call sites), meets ≥ 3.
- `grep -c 'footer.date} · ${footer.venue}\|data.show.date} · ${data.show.venue}'` — **0**; neither inline composition survives.
- `grep -n 'height \* 0.99' packages/app/src/dex/shareCard.ts` — still **two** matches (lines 198, 466); the baseline is untouched.
- `composeFooterLine` calls `truncateToWidth` and contains no loop of its own.
- `git diff --diff-filter=D HEAD~1 HEAD` — no deletions in any commit.

## Known Stubs

None. `composeFooterLine` is fully implemented and covered on both call sites.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes. Zero packages added, removed or upgraded; `package.json` untouched.

Threat register dispositions from the plan:

- **T-21-14 (DoS, `composeFooterLine` → `truncateToWidth`):** mitigated as planned. The falsy-venue early return means the helper never enters truncation without a venue; `truncateToWidth`'s loop is bounded by `s.length` and terminates at the empty string, so even a negative `venueBudget` yields `"…"` in at most `venue.length` iterations rather than spinning. A comment at the call records this. The overflow unit case exercises the truncation path on both branches.
- **T-21-15 (Tampering, corpus venue text):** accepted, unchanged. Canvas `fillText` interprets no markup; the venue was already drawn before this plan, which only bounds its width.
- **T-21-16 (Info disclosure, share PNG):** accepted, unchanged. No new field on the card — the date and venue were both already present; only the date's format changed.
- **T-21-SC (Tampering, npm installs):** no install performed; `package.json` and lockfile untouched.

## Issues Encountered

- The two known repo-wide verification-command defects (vitest project filter path, `npm run build` not typechecking) — both were flagged before execution and corrected silently; see Deviations 1 and 4.
- The mock-context gap for the bingo branch (Deviation 2) was the only real surprise, and it was a five-line fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- FOUND-05's *algorithm* is done and locked by test. What remains is genuinely device-only: **UAT test 5** must confirm the real 44px system font at the widest archive venue name fits `width * 0.9`, because the mock's `measureText` is linear-in-length and font-size-blind. Plan 21-13 owns that shot.
- **D-37 is deliberately unresolved.** Both footers still draw at `height * 0.99`; RESEARCH predicts ~4px of headroom at `textBaseline: "alphabetic"` (confirmed — `centerText` sets exactly that), and `Aug`/`Sep` do carry descenders. If the device shot clips, the fix is a one-character edit to `0.97` at two lines, and a comment at each draw site says so.
- Merge risk against the other Wave-2 plans is nil: this plan touches only `shareCard.ts` and `shareCard.test.tsx`, neither of which appears in another plan's `files_modified`. Its one dependency (21-02's `formatFullDate`) is already merged and was consumed unchanged.

## Self-Check: PASSED

- `packages/app/src/dex/shareCard.ts` — FOUND
- `packages/app/test/shareCard.test.tsx` — FOUND
- `.planning/phases/21-layout-layering-foundations/21-06-SUMMARY.md` — FOUND
- Commits `f1fdc27`, `388b28f`, `c53391e` — all present in `git log`
- Working tree clean apart from this SUMMARY before its own commit

## TDD Gate Compliance

RED (`f1fdc27` test) → GREEN (`388b28f` feat) → no REFACTOR needed. Gate sequence intact; the RED run failed for the right reason (`'2026-08-14 · Red Rocks'` vs `'Aug 14, 2026 · Red Rocks'`), not on a missing symbol.

---
*Phase: 21-layout-layering-foundations*
*Completed: 2026-07-24*
