---
phase: 22-surface-motion-the-chrome-mechanism
plan: 08
subsystem: ui
tags: [react, useSyncExternalStore, layout, css-custom-properties, source-guard, motion]

# Dependency graph
requires:
  - phase: 21-layout-layering-foundations
    provides: "the `bottomOverlayInset.ts` measurement store (heights Map, cached scalar snapshot, `setBottomOverlayHeight`'s unchanged-value early return) and the FOUND-02 source-guard walk in `bottomSpace.test.ts`"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 01
    provides: "`config.ui.BOTTOM_OVERLAY_ORDER` and `config.ui.motion.TOAST_DURATION_MS` — both already existed, so `config.ts` was NOT touched"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 05
    provides: "the `--gz-tab-bar-box` / `--gz-chrome-reserve` split — this plan's offsets compose ON TOP of the collapsing reserve, so all five overlays follow the chrome collapse with no special case (D-15)"
provides:
  - "`offsetBelow(id: string): number` — summed height of every registered overlay declared BELOW `id`"
  - "`useBottomOverlayOffset(id: string): number` — per-id cached-number `useSyncExternalStore` hook"
  - "all five registered overlays render at `calc(var(--gz-chrome-reserve) + <offset>px)`"
  - "the CR-01 omission-detecting source guard — the guard shape Phase 21 lacked"
affects: [phase-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "per-id cached primitive snapshot: a `Map<string, number>` seeded lazily on first read and recomputed wholesale inside `notify()` BEFORE the listener fan-out, so `getSnapshot` never computes"
    - "omission-detecting source guard: extract every call-site id literal out of `src/`, assert containment in the config declaration, with an anti-vacuity assertion running first"
    - "declared-order-in-config + arithmetic-in-module — the same single-owner split as `layout/bottomSpace.ts`"

key-files:
  created: []
  modified:
    - packages/app/src/pwa/bottomOverlayInset.ts
    - packages/app/src/components/InstallBanner.tsx
    - packages/app/src/components/UpdateToast.tsx
    - packages/app/src/components/BackupToast.tsx
    - packages/app/src/components/BingoCelebration.tsx
    - packages/app/src/components/WaveToast.tsx
    - packages/app/test/bottomOverlayInset.test.tsx

key-decisions:
  - "the per-id offset cache is seeded LAZILY on first read and recomputed only for keys already read — a notify that fires before any hook has mounted must not have to guess which ids will exist"
  - "`useBottomOverlayOffset` wraps its `getSnapshot` in `useCallback([id])` — correctness never depended on it (the value is a primitive), but it stops React re-reading the store on every render"
  - "an UNKNOWN id ranks topmost and never throws; the omission is caught by the source guard, which is where a missing declaration is supposed to hurt — not at runtime, mid-show"
  - "`heightOf()` test helper written then deleted: it hard-coded `60` behind a function name that implied it read the store — a fake assertion. Case 2 states the arithmetic as stack geometry inline instead"

requirements-completed: [CR-01]

# Metrics
duration: 7min
completed: 2026-08-06
---

# Phase 22 Plan 08: Ordered Bottom-Overlay Stacking Summary

**The Phase-21 measurement store gained an ordering concept: `offsetBelow(id)` sums the heights declared beneath an overlay in `config.ui.BOTTOM_OVERLAY_ORDER`, all five overlays now render at `calc(var(--gz-chrome-reserve) + <offset>px)` instead of overlapping at the same `bottom`, and a new omission-detecting source guard fails the suite the day a sixth overlay is written without a declared position.**

## Performance

- **Duration:** ~7 min (2026-08-06T05:14:31Z → 05:21Z)
- **Tasks:** 3
- **Files:** 7 modified, 0 created — exactly the plan's declared `files_modified`, no extras

## Task Commits

1. **Task 1: `offsetBelow` + `useBottomOverlayOffset` in the shipped store** — `b1160f1` (feat)
2. **Task 2: all five overlays compose their own offset (+ D-25 rider)** — `81ed413` (feat)
3. **Task 3: ordering cases + the omission-detecting guard** — `fca6b15` (test)

---

## THE EXPORTED SURFACE

### `packages/app/src/pwa/bottomOverlayInset.ts` — two new exports

```ts
export function offsetBelow(id: string): number;
export function useBottomOverlayOffset(id: string): number;
```

| Export | Contract |
|---|---|
| `offsetBelow(id)` | Sums the **registered** heights of every overlay whose rank in `config.ui.BOTTOM_OVERLAY_ORDER` is strictly lower than `id`'s. Returns `0` when nothing is below. An **unknown id ranks last (topmost)** — it returns the sum of *all* registered heights and **never throws**. Pure read; safe to call outside React. |
| `useBottomOverlayOffset(id)` | `useSyncExternalStore` over a **per-id cached number**. Same `subscribe` set and same `getServerSnapshot` (`0`) as `useBottomOverlayInset`. Returns a **primitive** — deliberately, so React 19's "The result of getSnapshot should be cached to avoid an infinite loop" is unreachable. Do not widen to `{ offset, total }`. |

**How the cache works.** `offsets: Map<string, number>` is seeded **lazily** on first read
(`getOffsetSnapshot`) and recomputed for **every key already in it** inside `notify()`,
*before* the listener fan-out — so each subscriber's `getSnapshot` sees the new value in the
same notify. Lazy seeding matters: a notify that fires before any hook has mounted must not
have to guess which ids will eventually exist.
`__resetBottomOverlayInsetForTests()` now clears this map too.

**What did NOT change, on purpose:**

- `setBottomOverlayHeight`'s **unchanged-value early return** (`bottomOverlayInset.ts`, still
  present) — it is what closes the offset→re-render→`ResizeObserver`→re-measure loop.
- `layout/bottomSpace.ts` — **byte-unmodified**. `--gz-content-reserve = chrome-reserve +
  sum(heights)` used to *over*-reserve because the boxes overlapped; now that they genuinely
  stack, the same sum **is** the occupied height. The correction landed with zero edits to the
  FOUND-02 owner.
- `AppShell.tsx` and `config.ts` — **untouched**. Every constant this plan reads
  (`BOTTOM_OVERLAY_ORDER`, `motion.TOAST_DURATION_MS`) was created in plan 22-01.

### The five call sites

Each overlay renders at ``bottom: `calc(var(--gz-chrome-reserve) + ${bottomOffset}px)` `` using
the **same id string** it already passes to `useBottomOverlayHeightRegistration`:

| Order | File | id | zIndex / classes / registration |
|---|---|---|---|
| 1 (bottom-most) | `InstallBanner.tsx` | `installBanner` | unchanged |
| 2 | `UpdateToast.tsx` | `updateToast` | unchanged |
| 3 | `BackupToast.tsx` | `backupToast` | unchanged |
| 4 | `BingoCelebration.tsx` (toast only) | `bingoCelebration` | unchanged |
| 5 (top-most) | `WaveToast.tsx` | `waveToast` | unchanged |

The offset is **additive to the chrome reserve, never a replacement** — that is what keeps all
five following plan 22-05's chrome collapse with no special case (D-15: a toast firing while
chrome is hidden simply sits lower; chrome is not forced back). No bare bottom-space literal was
introduced anywhere; the FOUND-02 source guard in `bottomSpace.test.ts` passes **unmodified**.

The two `AnimatePresence` overlays (`WaveToast`, `BingoCelebration`) carry a source comment on
§Pitfall 14: an **exiting** toast keeps its last offset for the fade because `AnimatePresence`
renders exiting children from frozen props. That is harmless (it is leaving, not becoming
interactive) and in fact desirable — a departing toast should not jump — and it is explicitly
**not** the same class of defect as the sheet close-START contract, which had to be
presence-derived. The comment exists so a future reader does not "fix" it.

**D-25 rider, executed:** `BingoCelebration.tsx`'s hard-coded `transition={{ duration: 0.2 }}`
(the twin of the literal `WaveToast` gave up in 22-01) is now
`config.ui.motion.TOAST_DURATION_MS / 1000`. A source read finds **zero** `duration: 0.2` in the
file. The supernova's `SUPERNOVA_FADE_MS` / `SUPERNOVA_MS` transitions were left alone — already
named constants.

### `packages/app/test/bottomOverlayInset.test.tsx` — 11 cases → 20

Nine new cases in two new `describe` blocks. The four shipped store cases (including
`"sums multiple simultaneously-registered overlays"`) and the seven Phase-21 AppShell/D-03 cases
are **unmodified**.

| # | `describe` | Case |
|---|---|---|
| 1 | CR-01 ordered stacking | two visible overlays get distinct offsets **in declared order** — registered in the *reverse* of the declared order, and a third overlay lands *between* them despite registering last |
| 2 | ″ | `<main>`'s sum equals the real occupied height (`offsetBelow("waveToast") + 60 === 328`, the same 328 the shipped sum case asserts) |
| 3 | ″ | unregistering re-flows: clearing `installBanner` drops `offsetBelow("waveToast")` 268 → 48 |
| 4 | ″ | an undeclared id ranks topmost, returns the total, and does not throw |
| 5 | ″ | the offset is a referentially-stable **number**, and the hook settles rather than looping (bounded re-render count across one notify) |
| 6 | ″ | **positive rendered-DOM check** — a real `<BackupToast>` with a 220px banner registered has both `var(--gz-chrome-reserve)` and `220px` in its `style` attribute |
| 7 | CR-01 omission guard | **anti-vacuity**: the extraction walked >100 source files and found ≥5 ids, including all five known ones |
| 8 | ″ | every `useBottomOverlayHeightRegistration` id in `src/` is declared in `BOTTOM_OVERLAY_ORDER` |
| 9 | ″ | the reverse direction — no stale declaration for an overlay that no longer exists |

## Accomplishments

- **CR-01 is closed behaviourally, not just structurally.** Two simultaneously-visible overlays
  render at distinct declared positions; the reserve became **correct** rather than merely safe;
  and the single-owner model is intact — `layout/bottomSpace.ts` needed no edit at all.
- **The omission guard was FALSIFIED, not assumed.** A throwaway
  `src/__guardProbe.ts` containing `useBottomOverlayHeightRegistration("notOrdered", true)` was
  added and the suite run: case 8 failed with
  `expected [ 'notOrdered' ] to deeply equal []`, 19 others still passing. The probe file was then
  deleted (confirmed absent from `git status` and from the diff). This is the guard shape Phase 21
  lacked when the `ArchiveBrowser` inset bug shipped (`61e0b90`).
- **Full suite green: 139 files / 1197 tests**, up from the 139 / 1188 base — `+9` cases, no new
  file. `npx tsc -b packages/core packages/app` exits 0.
- **`git diff --stat a6320ea HEAD` shows exactly the 7 declared files**, no deletions, no
  untracked leftovers. `bottomSpace.ts`, `AppShell.tsx` and `config.ts` are absent from the diff,
  as the plan requires.

## Decisions Made

- **Lazy per-id cache seeding.** The plan allowed either a cache recomputed in `notify()` or
  derivation from primitives in `getSnapshot`. The cache was chosen (it makes `getSnapshot`
  allocation-free and computation-free), but seeded lazily rather than eagerly — `notify()` cannot
  know which ids will be read, and pre-populating from `BOTTOM_OVERLAY_ORDER` would silently
  exclude exactly the undeclared id the guard exists to catch.
- **`useCallback([id])` around `getSnapshot`.** Correctness never depended on it — the snapshot is
  a primitive, so a fresh closure would still compare equal by value. It is there so React does not
  re-read the store on every render, and the reason is commented at the source so it does not read
  as cargo-culted memoisation.
- **`InstallBanner` reads its offset from the store even though it is bottom-most and the value is
  always `0` today.** Hard-coding `bottom: var(--gz-chrome-reserve)` there would work identically
  and would silently break the moment someone re-ordered the config. Re-ordering the config is now
  the *only* edit a future change needs.
- **A fake test helper was written and then deleted.** Case 2's first draft called
  `heightOf("waveToast")`, a function whose name implied it read the store but which returned a
  hard-coded `60`. That is the shape of an assertion that cannot fail for the right reason. The
  case now states the arithmetic inline as stack geometry (`offsetBelow(top) + its own height ===
  the reserve`) with the reasoning in a comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npx tsc -b` is vacuous in this repo**

- **Found during:** Task 1 (verification)
- **Issue:** Tasks 1 and 2 specify `npx tsc -b`. There is no root `tsconfig.json`, so the bare
  command prints `TS5083` and **still exits 0** — a silently vacuous gate. (Same finding as plans
  22-01 and 22-05; recorded again because it is a per-plan substitution, not a repo fix.)
- **Fix:** ran `npx tsc -b packages/core packages/app` at every typecheck gate. No config file
  added — creating a root `tsconfig.json` is a repo-wide change outside this plan's scope.
- **Verification:** exits 0 with no output after each task and after the final suite run.

### Deliberate additions beyond the plan's task list

**2. A third omission-guard case: the reverse direction (stale declaration)**

- The plan specifies the forward containment (every id in `src/` is declared). The reverse — a
  declared id with no surviving registration — is not a rendering bug, but it makes the order table
  in `config.ui` lie about what can be on screen, which is the thing the next reader will trust.
  One extra assertion, no new machinery.

**3. A bounded-re-render assertion inside case 5**

- The plan's acceptance criterion is "`getSnapshot` returns the same value on two consecutive calls
  with no intervening `notify()`", which for a primitive is nearly tautological. The case asserts
  that *and* renders a probe through the real hook, counting renders across one notify. An uncached
  object snapshot would not merely differ — it would loop, and only the render-count form of the
  assertion can observe that.

---

**Total deviations:** 3 (1 Rule-3 blocking auto-fix, 2 additive test assertions)
**Impact on plan:** No scope change. No file added or removed beyond the declared
`files_modified`; no dependency added; runtime behaviour is exactly what the plan specified.

## Issues Encountered

- **None of substance.** The jsdom trap flagged in the upstream findings did **not** bite: the
  rendered value is `calc(var(--gz-chrome-reserve) + 220px)` — a `calc()` containing a `var()`,
  both of which jsdom's CSS parser preserves (verified by case 6 passing, which reads
  `getAttribute("style")` and would have found an empty attribute otherwise). No bare `env()` was
  introduced by this plan, and no `getByRole` query was used where `aria-hidden` could make it
  vacuously null — case 6 uses `container.querySelector('[role="status"]')` on a captured node.
- **The other flagged trap was avoided by construction:** the hook is called at the component top
  level in `WaveToast` and `BingoCelebration`, never inside the `{shown && …}` conditional JSX,
  which would have been a rules-of-hooks violation in both files.

## Known Stubs

None. Both new exports are fully implemented and exercised by rendered-DOM assertions as well as
unit reads. `offsetBelow("installBanner")` evaluating to `0` in every current state is the declared
design (it is bottom-most), not a stub — case 1 asserts it and case 3 asserts the value it takes
for the overlays above it.

## Threat Flags

None. No network call, no persistence, no user-supplied data path, no new dependency. Overlay ids
remain compile-time string literals. The register behaves as predicted:

- **T-22-27** (an overlay covering the live logging loop — the sacred D-17 rule) — mitigated: the
  overlays stack, and `--gz-content-reserve` (unchanged) reserves the genuinely occupied height.
  Asserted by cases 1–3 and by the positive rendered-DOM check in case 6.
- **T-22-28** (the update prompt covered by a transient toast) — mitigated: `updateToast` is
  declared second from the bottom, so every transient toast offsets *above* it. Case 1 asserts a
  later-registered `updateToast` still lands beneath `waveToast`.
- **T-22-29** (a future overlay registered but never ordered) — mitigated by the omission guard,
  **empirically falsified** (see Accomplishments), with the anti-vacuity assertion in front of it.
- **T-22-30** (notify/measure feedback loop, or React 19's uncached-`getSnapshot` loop) —
  mitigated: `setBottomOverlayHeight`'s early return is untouched and every hook returns a number.
  Case 5 asserts both the primitive-stability and the bounded-render halves.
- **T-22-SC** — no packages installed.

## Next Phase Readiness

- **Revert story intact (D-18):** the three commits are additive and independently revertible.
  Reverting `81ed413` alone returns all five overlays to the flat `var(--gz-chrome-reserve)` while
  leaving the store's new exports unused and harmless; reverting `b1160f1` as well restores the
  Phase-21 store byte-for-byte.
- **Follow-on housekeeping for phase close:** the todo
  `.planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md` is resolved by this
  plan and should move to `completed/`. Not moved here — this plan ran as a parallel worktree agent
  alongside 22-07 and 22-10, and touching a shared `.planning/todos/` path mid-wave invites a merge
  conflict (same reasoning 22-05 used for its deferred item).
- **Nothing else in the phase is blocked by this plan**, and nothing in it depends on the chrome
  toggle landing: with chrome visible, `--gz-chrome-reserve` is unchanged and the only rendered
  difference is the `+ 0px` / `+ Npx` term.

## Self-Check: PASSED

- All 7 modified files exist on disk at the paths above; 0 files created, 0 deleted.
- All 3 commits present in `git log a6320ea..HEAD`: `b1160f1`, `81ed413`, `fca6b15`.
- `git diff --stat a6320ea HEAD` → exactly 7 files, matching the plan's `files_modified` with no
  extras. `layout/bottomSpace.ts`, `components/AppShell.tsx` and `config.ts` do **not** appear.
- `git diff --diff-filter=D --name-only a6320ea HEAD` → empty (no deletions).
- `git status --short` → clean, no untracked files (the guard-falsification probe was removed).
- `npx vitest run` → **139 files / 1197 tests passed** (base: 139 / 1188).
- `npx vitest run --project @guezzer/app packages/app/test/bottomOverlayInset.test.tsx` → 20 passed
  (was 11).
- `npx tsc -b packages/core packages/app` → exit 0, no output.
- Source reads: 5 files contain `calc(var(--gz-chrome-reserve) + ${bottomOffset}px)`; 0 occurrences
  of `duration: 0.2` in `BingoCelebration.tsx`.

---
*Phase: 22-surface-motion-the-chrome-mechanism*
*Completed: 2026-08-06*
