---
phase: 21-layout-layering-foundations
plan: 08
subsystem: layout
tags: [fab, found-02, d-05, d-06, css-custom-properties, tap-target-stability]
requires:
  - phase: 21-layout-layering-foundations
    plan: 05
    provides: "the formatFullDate header conversion already landed in ShowView.tsx — read as it stands on disk, date changes left intact"
  - phase: 21-layout-layering-foundations
    plan: 07
    provides: "--gz-fab-offset and --gz-chrome-reserve, the owner vars both FAB surfaces now compose"
provides:
  - "showBottomFabOffset(stripSlotReserved) — the one FAB/weak-fan-hint offset source, composing var(--gz-fab-offset)"
  - "the D-05 behavior change: the Show-Mode FAB transitions at most once per show, on the reserved-slot signal"
  - "ExploreFilterFab resting offset composed from var(--gz-chrome-reserve)"
  - "exact-string offset tests locking both branches against a re-derived env()/64px/4rem"
affects:
  - "plan 21-10 (the D-12 source guard — the FAB group is now off its list; see the RESTING_BOTTOM_PX note below)"
  - "plan 21-13 (device re-verification of the FAB clearance over rendered suggestion rows, T-21-21)"
  - "any future reader of fabLayout.ts — the D-05 partial reversal is recorded in-file so it is not restored as a 'fix'"
tech-stack:
  added: []
  patterns:
    - "A tap target's position keyed to a LOCAL, once-per-show signal, never to remotely-timed content arrival"
    - "Lift by the RESERVED SLOT (a fixed constant ≥ any rendered row) rather than by measured content — same clearance, no motion"
    - "Spacing tokens local to a surface (the sm gap) stay inline; only bottom-space-owner values move to vars"
key-files:
  created: []
  modified:
    - packages/app/src/show/fabLayout.ts
    - packages/app/src/show/FabMenu.tsx
    - packages/app/src/show/OrbitStage.tsx
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/explore/ExploreFilterFab.tsx
    - packages/app/test/fabMenu.test.tsx
    - packages/app/test/explore/filterFabLift.test.tsx
decisions:
  - "D-05 shipped as a deliberate partial reversal of the Phase-10 trigger, with the reversal recorded in the commit message, the module doc and the test prose so it is never rediscovered as a regression"
  - "The 8px gap in ExploreFilterFab stays an inline literal — a UI-SPEC Spacing sm token belonging to that FAB, not a bottom-space-owner value"
  - "ExploreFilterFab's RESTING_BOTTOM_PX (64 + 8) was left as a numeric literal rather than derived from config: it feeds only the A11Y-02 lift math, and a rem→px conversion would encode a Dynamic-Type assumption that D-04 explicitly avoids"
requirements-completed: [FOUND-02]
metrics:
  duration: ~12 min
  completed: 2026-07-25
  tasks: 2
  commits: 2
  tests_before: 1052
  tests_after: 1056
---

# Phase 21 Plan 08: FAB Family Conversion + D-05 Trigger Change Summary

Both FAB surfaces now compose the bottom-space owner's variables instead of re-deriving
`calc(env(safe-area-inset-bottom) + 64px + …)`, and the Show-Mode FAB's vertical position stops
depending on whether a suggestion row happens to be on screen — it follows the reserved-slot
signal, so it moves at most once per show.

## What Changed

**`showBottomFabOffset(stripSlotReserved)`** — the parameter is renamed and, more importantly,
re-pointed. Both branches are numerically identical to what shipped (`--gz-fab-offset` is
`calc(var(--gz-chrome-reserve) + 16px)` and `--gz-chrome-reserve` is
`calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))`, i.e. the same `env + 64px + 16px`); only
the notation and the *trigger* changed:

| | before | after |
|---|---|---|
| resting | `calc(env(safe-area-inset-bottom) + 64px + 16px)` | `var(--gz-fab-offset)` |
| lifted | `calc(env(...) + 64px + 112px + 16px)` | `` calc(var(--gz-fab-offset) + ${SUGGESTION_STRIP_HEIGHT}px) `` |
| trigger | `stripHasContent` — rows rendered right now | `stripSlotReserved` — the slot is reserved |

**The D-05 behavior change.** `ShowView` now feeds both `OrbitStage` and `FabMenu` the same
`openerSeeded` flag that already drives `<SuggestionStrip reserveSpace>`. Previously a live
editor suggestion arriving from the kglw poll moved the FAB 112px mid-show, under a reaching
thumb, in the dark — a control's position driven by remote data timing. It now transitions once,
at the opener, and then holds for the rest of the show. The local `stripHasContent` derivation
had no other consumer and is deleted; its owner comment is replaced by one recording D-05 and
D-06.

**The `a60d5e2` lift is re-expressed, not undone.** That Phase-10 commit lifted the FAB above the
reserved strip so it never overlaps a row's +/X buttons. The clearance survives the trigger
change because the reserved slot (`config.ui.SUGGESTION_STRIP_HEIGHT` = 112px, corrected up from
56px in the VALID-02 rehearsal) is always ≥ the height of whatever rows render inside it — so
lifting by the *slot* clears every rendered *row* too. This is stated in three places on purpose
(the commit message, the `fabLayout.ts` module doc, and the test prose) so a future reader does
not rediscover the reversal as a regression and "restore" the jump.

**The weak-fan hint stays aligned.** `OrbitStage`'s "Low confidence" line still calls the same
`showBottomFabOffset` with the same argument — that shared call is the entire reason the function
exists, and both surfaces now move together or not at all.

**`ExploreFilterFab`** — resting offset is now `calc(var(--gz-chrome-reserve) + 8px)`, a
byte-identical value. The `8px` deliberately stays inline (UI-SPEC §Spacing `sm`, a gap local to
this FAB rather than a bottom-space-owner value) with an in-file comment saying so, so it is not
re-litigated into `config.ui.bottomSpace`. `translateY(-liftPx)` and `FAB_SHEET_GAP_PX` are
untouched per D-28 — that transform creates a stacking context containing only the FAB's own
children and captures no sheet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `fabMenu.test.tsx` had to be partly updated inside Task 1**

- **Found during:** Task 1
- **Issue:** The plan assigns all `fabMenu.test.tsx` edits to Task 2, but Task 1's own
  `<verify>` runs that file. After the prop rename the test still passed `stripHasContent`, so
  it rendered with `stripSlotReserved` undefined and both `dataset` assertions failed — Task 1
  could not verify green.
- **Fix:** Moved only the mechanical rename (helper parameter, the JSX prop, the two `dataset`
  reads, and the now-inaccurate test title) into Task 1. All *new* coverage — the exact-string
  branch assertions, the no-`env()`/`64px`/`4rem` guard, the rendered-container check and the
  D-05 prose — stayed in Task 2 exactly as planned. No scope escape: the file is in the plan's
  `files_modified`.
- **Verification:** `fabMenu.test.tsx` green at commit `1c31ae0` (8 tests), and again at
  `f6dfd08` (12 tests).
- **Commit:** `1c31ae0`

**2. [Rule 3 - Blocking] The Task 1 acceptance grep forbids the identifier even in prose**

- **Found during:** Task 1
- **Issue:** The replacement comment in `ShowView.tsx` referred to the deleted
  `stripHasContent` const by name to keep the history legible, which made
  `grep -rn 'stripHasContent' packages/app/src` non-zero and failed the criterion as literally
  written.
- **Fix:** Reworded to "the former rendered-rows derivation that lived here", preserving the
  meaning without the token. Criterion now returns 0.
- **Files modified:** `packages/app/src/show/ShowView.tsx`
- **Commit:** `1c31ae0`

### Planned Edits That Turned Out To Be No-Ops

- **`filterFabLift.test.tsx` had no assertion on the old offset string.** The plan anticipated
  updating one ("update any assertion that references the old `calc(env(...) + 64px + 8px)`
  string"); the file only asserted lift behavior. Rather than touch nothing in a file the plan
  lists, a positive FOUND-02 lock was ADDED: the resting wrapper must carry
  `calc(var(--gz-chrome-reserve) + 8px)` and must not carry `env(safe-area-inset-bottom)` or
  `64px`. Existing lift assertions untouched.

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking), plus 1 planned edit that was a
no-op and became an added test. **Impact:** none on behavior; both deviations were sequencing
and grep-literalism artifacts.

### Note on the jsdom caveat the plan warned about

The plan advised asserting on `getAttribute("style")` because "jsdom may not round-trip a
`var()` through a parsed property" (and a pre-existing comment in `fabMenu.test.tsx` claimed
jsdom drops `calc()`). This was probed directly before writing the assertions: jsdom 4.x
round-trips `calc(var(--gz-fab-offset) + 112px)` intact through **both** the style attribute and
`el.style.bottom`. The plan's advice was followed anyway — the attribute assertion is strictly
more robust and costs nothing — but the old inline comment claiming jsdom drops these values was
corrected, since it is only true of `env()`.

## Verification

- `npx vitest run` — **130 files / 1056 tests passing** (baseline 1052 from plan 21-07, plus 4
  new cases). No pre-existing test left failing.
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds.
- `grep -rn 'stripHasContent' packages/app/src` → **0**.
- `grep -c 'env(safe-area-inset-bottom)\|64px\|4rem'` → **0** for `fabLayout.ts`, `FabMenu.tsx`,
  `OrbitStage.tsx` and `ExploreFilterFab.tsx`, comments included.
- `grep -c 'data-strip-has-content' packages/app/src` → **0**; `data-strip-slot-reserved` present
  in `FabMenu.tsx`.
- `ShowView.tsx` carries `stripSlotReserved={openerSeeded}` twice and `reserveSpace={openerSeeded}`
  once — the single-signal `key_link` this plan's `must_haves` requires.

### One plan-level verification command cannot pass from this worktree

`grep -rn 'calc(env(safe-area-inset-bottom)' packages/app/src/show packages/app/src/explore`
still returns one hit: **`packages/app/src/show/CometTrail.tsx:231`**. That file is in **plan
21-09's** `files_modified`, not this plan's — 21-09 was executing in a sibling worktree at the
same time. The command is written phase-wide but this plan owns only the FAB group; it will
return nothing once 21-09 merges. Every path this plan owns is clean. No cross-plan file was
touched.

## Threat Model Notes

- **T-21-20 (mitigated — this was the plan's point):** remote poll timing can no longer move a
  live-logging control. `FabMenu`'s position depends solely on the local `openerSeeded` state;
  `visibleSuggestions` / `visibleFillHints` no longer reach any layout input.
- **T-21-21 (mitigated):** the clearance over rendered rows is preserved by the fixed reserved
  slot and locked by the exact-string offset test. Device re-verification remains owed to plan
  21-13.
- **T-21-22 (accepted, unchanged):** `ExploreFilterFab`'s `translateY` stacking context was left
  exactly as-is, per D-28.
- **T-21-SC (mitigated):** zero packages added, removed or upgraded; `package.json` untouched.

## Known Stubs

None. Every value both FAB surfaces render is wired to the owner's vars.

## Observation for plan 21-10 (the D-12 source guard)

`ExploreFilterFab.tsx` still contains `const RESTING_BOTTOM_PX = 64 + 8` — a JS-side numeric
mirror of the tab-bar height that the D-12 guard's `64px`/`4rem`/`env()` pattern will **not**
catch, because the literal is `64 + 8`, not `64px`. It was left in place deliberately: it feeds
only the A11Y-02 lift math (never the resting position), `var()`/`env()` do not resolve to
numbers in JS without a `getComputedStyle` round-trip, and deriving it from
`TAB_BAR_HEIGHT_REM * 16` would bake in a rem→px assumption that D-04 chose `rem` specifically to
avoid. Its comment now says all of this. If 21-10 wants the guard to be exhaustive rather than
pattern-based, this is the one known survivor in the FAB group.

## Self-Check: PASSED

All seven modified files exist on disk; both commit hashes (`1c31ae0`, `f6dfd08`) resolve in
`git log`.

## Notes for the Orchestrator

Ran in worktree `agent-a00285b83d6c8711f` on branch `worktree-agent-a00285b83d6c8711f`.
**The prompt's `EXPECTED_BASE=1ef66c26` does not exist as an object** — the intended base is
`master` at `1ef66c228a31bb6ed353dfb5177ff1d4ccdb6602` ("docs(phase-21): update tracking after
wave 3", the commit containing plan 21-07); the prompt's short hash has a wrong final digit. The
worktree spawned at the known-stale ancestor `f29edca`, which was verified to be a strict
ancestor of that commit before `git reset --hard` to it. `packages/app/src/layout/bottomSpace.ts`
was confirmed present post-reset, so the 21-07 dependency was genuinely in the base.
`STATE.md` and `ROADMAP.md` were not touched.
