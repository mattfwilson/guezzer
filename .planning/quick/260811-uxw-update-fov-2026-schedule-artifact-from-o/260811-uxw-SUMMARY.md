---
phase: quick-260811-uxw
plan: 01
subsystem: data
tags: [schedule, fov-2026, artifact, zod, vitest]

requires:
  - phase: 20-schedule
    provides: the committed fov-2026 artifact, parseScheduleArtifact, sanitizeEventIds
provides:
  - FOV 2026 schedule artifact matching the final official poster (re-transcribed 2026-08-11)
  - a pinning test for all six poster deltas
  - an id-permanence guard that fails any future rename of `fri-castle-1300`
affects: [schedule, sched-tab, schedule-picks]

tech-stack:
  added: []
  patterns:
    - "Event ids are permanent opaque keys, decoupled from the slot they describe"

key-files:
  created: []
  modified:
    - data/schedule/fov-2026.json
    - packages/core/test/schedule/schedule.test.ts
    - packages/core/src/schedule/schedule.ts

key-decisions:
  - "Event ids are permanent keys: four events keep a slug that no longer describes them, because sanitizeEventIds drops unknown ids silently and a rename would delete friends' saved picks with no error"
  - "The jazz band's Saturday-to-Sunday move is a delete + add (sat-castle-1200 removed, sun-castle-1100 added), not a re-dated id; the lost pick is accepted rather than migrated"
  - "The pinning test was written from the transcription table and proven RED before the artifact was touched, so it verifies the poster rather than the file"

patterns-established:
  - "Poster deltas are pinned by test, not just committed: a re-transcription that silently reverts fails the suite"

requirements-completed: [SCHED-DATA]

duration: 4min
completed: 2026-08-11
---

# Quick 260811-uxw: FOV 2026 Schedule Re-transcription Summary

**Six Castle deltas from the final official poster applied to the committed artifact — three mystery sets named (Stu Mackenzie, Cavs Gong Bath, Bullant), Moktar swapped for Nikki Nair, Stu's set moved to a 12:30 PM start, and the high school jazz band moved from Saturday to Sunday — with every surviving event id byte-identical and a test that fails if anyone "tidies up" `fri-castle-1300`.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-08-11T22:22:20Z
- **Completed:** 2026-08-11T22:26:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Zero `?????????` placeholder titles remain in the artifact.
- `fri-castle-1300` now reads Stu Mackenzie, 12:30 PM – 1:40 PM (`startMin` 780 → 750, `endMin` unchanged at 820) while keeping its original id.
- `fri-castle-0130` is Nikki Nair (was Moktar); `sat-castle-1300` is Cavs Gong Bath; `sun-castle-2330` is Bullant. All three times unchanged.
- Buena Vista High School Red Hots Jazz Band appears exactly once, as `sun-castle-1100`, Sunday 11:00–11:40 AM; `sat-castle-1200` is gone.
- `source` records the provenance: the KBYG poster URL plus "poster re-transcribed 2026-08-11".
- Three new assertions pin all six deltas, including an id-permanence guard asserting no `fri-castle-1230` exists, with a comment explaining that the rename would be a silent data deletion.
- The two stale `Moktar` prose comments (module doc in `schedule.ts`, the `minToClock(1530)` example in the test) now name Nikki Nair.

## Task Commits

1. **Task 1: Pin the six poster deltas with a RED test** — `c93620c` (test)
2. **Task 2: Apply the six poster deltas to the artifact** — `5ec356b` (fix)

## Files Created/Modified

- `data/schedule/fov-2026.json` — six poster deltas: 5 modified event/source lines, 1 deleted event, 1 inserted event.
- `packages/core/test/schedule/schedule.test.ts` — new `poster re-transcription 2026-08-11` describe block (3 `it` blocks); the `minToClock(1530)` trailing comment renamed to Nikki Nair.
- `packages/core/src/schedule/schedule.ts` — one word in the module doc comment (`Moktar` → `Nikki Nair`). No code, no schema.

## Verification (actual output)

| Command | Result |
|---|---|
| `npx vitest run --project @guezzer/core schedule` (baseline, before Task 1) | 7 passed |
| `npx vitest run --project @guezzer/core schedule` (after Task 1, RED) | exit 1 — **3 failed \| 7 passed (10)**; failures were real assertion mismatches naming `fri-castle-1300`, `sat-castle-1200`, and the `source` string — no crashes |
| `npx vitest run --project @guezzer/core schedule` (after Task 2, GREEN) | **10 passed (10)**, exit 0 |
| `npx tsc -p packages/core --noEmit` | exit 0, silent |
| `npx tsc -p packages/app --noEmit` | exit 0, silent |
| `npm test` | **140 test files passed, 1234 tests passed**, exit 0 |
| `git status --short --untracked-files=all` | only the 3 intended files modified; `?? FOV2026_SCHEDULE_FINAL.jpg` still untracked |

Diffstat on the artifact: `12 ++++++------` — five in-place line edits, one deletion, one insertion, and nothing else. The diff touches no `days` line, no `venues` line, and no `*-timeland-*` event.

## Decisions Made

None beyond the plan's D-1 through D-5 — followed as specified. Worth restating the load-bearing one: the surviving ids are byte-identical to HEAD, including `fri-castle-1300`, whose slug now disagrees with its own 12:30 start time. That is intentional. `sanitizeEventIds` drops unknown ids silently by design (so a friend on a newer artifact isn't rejected), which means an id rename is indistinguishable from a deletion at the read boundary. The `expect(eventById("fri-castle-1230")).toBeUndefined()` assertion exists specifically to survive the next person's tidy-up instinct.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The RED run failed for exactly the three expected reasons, and the GREEN run needed no iteration.

## Known Stubs

None. Zero `?????????` placeholders remain in the artifact.

## User Setup Required

None. Data-only change, already bundled at build time — a rebuild/redeploy is all that's needed for friends to see the corrected schedule.

## Self-Check: PASSED

- `data/schedule/fov-2026.json` — FOUND, contains `sun-castle-1100`
- `packages/core/test/schedule/schedule.test.ts` — FOUND, contains `re-transcription`
- `packages/core/src/schedule/schedule.ts` — FOUND
- Commit `c93620c` — FOUND in `git log`
- Commit `5ec356b` — FOUND in `git log`
- `FOV2026_SCHEDULE_FINAL.jpg` — still present and still untracked (neither committed nor deleted)

---
*Quick task: 260811-uxw*
*Completed: 2026-08-11*
