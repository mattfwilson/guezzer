---
phase: 22-surface-motion-the-chrome-mechanism
plan: 04
subsystem: ui
tags: [react, dexie, useLiveQuery, a11y, aria-modal, escape, motion, animate-presence, error-state]

# Dependency graph
requires:
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 01
    provides: "`config.copy.dex.setlistLoading` / `setlistMissingHeading` / `setlistMissingBody`, and the portal → AnimatePresence → SheetSurface restructure"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 02
    provides: "the SHEET-02 close-start contract (exiting card `aria-hidden` + `pointer-events: none` derived from `useIsPresent()`) and the SHEET-01 exit animation this plan's fullscreen consumer finally exercises"
  - phase: 08-accessibility-the-modal-layer
    provides: "`useDialogDismiss` + the shared LIFO `dialogStack` — reused verbatim for the new missing state"
provides:
  - "CR-02: `SetlistView` distinguishes PENDING from UNRESOLVABLE via an object-wrapped `useLiveQuery` querier (`async () => ({ row })`)"
  - "A labelled, escapable missing state — `role=\"dialog\"` named `setlistMissingHeading`, a 44px `ChevronLeft` Back wired to `onClose`, and Escape through the shared LIFO stack"
  - "The loading frame is announced as `Loading show…`, never as `Back`"
  - "SHEET-01's live FULLSCREEN exit consumer: `DexView`'s trophy case is now prop-driven (`open={selfCaseOpen && rarity != null}`)"
  - "`key={openShow.showId}` on `<SetlistView>` — makes the pending window honest by construction rather than by call-site accident"
  - "`describe(\"fullscreen sheet exit window (reverts with the 22-02 exit commit)\")` in `dexView.test.tsx` — step (b) of plan 22-09's revert procedure 1"
affects: [22-09, 22-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "object-wrap a `useLiveQuery` querier (`async () => ({ row: await … })`) when absence and in-flight must be told apart — no third `defaultResult` argument, no `symbol` in the type union, and it degrades toward *pending* (safe) under a naive `useLiveQuery: () => undefined` double"
    - "convert an unmount-driven `<Sheet>` by moving the guard from the ELEMENT to the CHILDREN: `open={cond && payload != null}` with the body guarded inside, so no last-non-null-payload ref is needed"
    - "a controllable module double held in `vi.hoisted({ result })` rather than a bare `let`, because `vi.mock` factories are hoisted above the module body"
    - "mutation-verify every new case before committing: state which mutation reds which case, and disclose the cases that stay green"

key-files:
  created: []
  modified:
    - packages/app/src/dex/SetlistView.tsx
    - packages/app/src/dex/DexView.tsx
    - packages/app/test/setlistView.test.tsx
    - packages/app/test/dexView.test.tsx

key-decisions:
  - "The pending/missing split lives INSIDE the existing `if (resolved == null)` branch, below the archive-first lookup — which is why both shipped `useLiveQuery: () => undefined` doubles (`setlistView.test.tsx`, `sheet.a11y.test.tsx`) needed no edit at all. `sheet.a11y.test.tsx` and `layerOrder.test.tsx` are byte-unmodified by this plan."
  - "`FriendsList` is stubbed in `dexView.test.tsx` down to its `onOpenSelf` callback. `DexView` — not `FriendsList` — owns the trophy-case overlay, so the real list contributes nothing to the exit-window cases while pulling in Supabase identity, the presence store and the friends pull."
  - "The missing state's heading is an `<h1>`, matching `ExploreView`'s calm-error block element-for-element (the named tone model), not the `<p>`/`<span>` used elsewhere in this file."
  - "`Sheet.tsx` deliberately untouched — the seam roster is plan 22-10's to word."

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-08-06
---

# Phase 22 Plan 04: Dex Drill-In — Honest States and the Fullscreen Exemplar Summary

**`SetlistView` no longer conflates "still loading" with "will never load": the Dexie read is object-wrapped so a held frame announces itself as "Loading show…" while a genuinely unresolvable show gets a labelled dialog with a 44px Back and Escape instead of a blank `aria-modal` trap that VoiceOver called "Back" — and `DexView`'s trophy case became the phase's one prop-driven fullscreen `<Sheet>`, giving D-26's exit fade a live consumer to device-verify.**

## Performance

- **Duration:** ~15 min
- **Base:** `cddcddd`
- **Tasks:** 3 (landing as 4 commits — a small fidelity fix follows Task 1)
- **Files modified:** 4 (0 created, 4 modified)
- **Suite:** 137 files / 1170 tests green (base was 137 / 1165 — **+5**, and no pre-existing case was edited)

## Accomplishments

- **The `aria-modal` trap is gone, and both exits are proven.** The permanent case now renders a `role="dialog"` labelled by the problem, a visible `min-h-11 min-w-11` Back wired to `onClose`, and Escape through the same shared LIFO stack every other dialog uses. Task 2 case 2 fires the `onClose` spy for **both** the click and the keydown in one body — T-22-09's mitigation is executable, not asserted in prose.
- **All three new `setlistView` cases are mutation-verified.** Hard-coding `cachePending = true` and reverting the loading `aria-label` to `copy.albumBack` reds cases 1 and 2 (`expected 'Back' to be 'Loading show…'`, `expected 'Back' to be "Couldn't open this show."`); separately breaking the `cacheRow` derivation reds case 3. Each case discriminates a different half of the object-wrap.
- **The fullscreen conversion is mutation-verified too, against the exact shape it replaced.** Restoring the `{selfCaseOpen && rarity != null && (<Sheet open …>)}` wrapper reds the retention case on `document.body.contains(dialog)` — the node is destroyed synchronously, which is precisely the defect D-26 needs a live consumer to escape. **Disclosed honestly:** the *other* case ("mounted while closed, zero nodes") stays **green** under that mutation, because both shapes render zero nodes when closed. The block's discriminating power over the conversion is **one** case, not two.
- **Both upstream traps from 22-02 were avoided by construction.** Removal is awaited on the **captured node** (`waitForElementToBeRemoved(dialog, { timeout: 2000 })`), never `waitForElementToBeRemoved(() => screen.queryByRole("dialog"))` — the silent false green that `*ByRole`'s `aria-hidden` blindness creates against the D-19 close-start contract. And no focus-timing assertion was written, so the re-timed `useFocusTrap` is not touched.
- **The blast radius is exactly the plan's file set.** `git diff --stat cddcddd HEAD` lists four files: `dex/SetlistView.tsx`, `dex/DexView.tsx`, `test/setlistView.test.tsx`, `test/dexView.test.tsx`. `components/Sheet.tsx`, `test/sheet.a11y.test.tsx` and `test/layerOrder.test.tsx` are **unmodified**, as the plan's verification block requires.

## Task Commits

1. **Task 1: split pending from unresolvable in `SetlistView`** — `db6f98a` (fix)
2. **Task 2: positive rendered-DOM assertions for both new states** — `64c05a4` (test)
3. **Task 3: `DexView`'s trophy case → prop-driven, + the exit-window block** — `6712dfb` (feat)
4. **Fidelity fix to Task 1: a real `<h1>` in the missing state** — `c508924` (style)

`git show --stat 6712dfb` lists exactly the two files Task 3's acceptance criterion names: `packages/app/src/dex/DexView.tsx` and `packages/app/test/dexView.test.tsx`.

## Files Created/Modified

- **`packages/app/src/dex/SetlistView.tsx`** — the bare `useLiveQuery(() => db.archiveShows.get(showId))` becomes the object-wrapped `async () => ({ row: await … })`, held in `wrapped`, with `cacheRow = wrapped?.row` feeding the (otherwise byte-unchanged) `resolved` memo and `cachePending = wrapped === undefined`. `useDialogDismiss(missing, onClose)` is called unconditionally above every early return. The single `if (resolved == null)` return splits into two portaled returns at the same `config.ui.z.sheet` tier — a held frame named `copy.setlistLoading`, and a missing state carrying the resolved branch's header bar (shipped `calc(env(safe-area-inset-top) + 12px)`, same `ChevronLeft` Back) over an `ExploreView`-voiced `<h1>` + muted `<p>`. Module doc records the defect, the deps-change caveat, the D-22/D-23 boundary, and the deferred five-sheet migration.
- **`packages/app/src/dex/DexView.tsx`** — the trophy-case `<Sheet>` is unconditionally rendered with `open={selfCaseOpen && rarity != null}`; the `rarity` guard moved into the children as a fragment. `<SetlistView>` gains `key={openShow.showId}`. A block comment names what the conversion is for, why no last-payload ref is needed, and which sheets plan 22-10 owns.
- **`packages/app/test/setlistView.test.tsx`** — the inline `useLiveQuery: () => undefined` becomes `vi.hoisted({ result })`-backed with an `afterEach` reset to the same default. Three new cases in a `SetlistView — pending vs unresolvable (CR-02)` describe, all asking for a `showId` absent from the fixture archive. No copy string is hardcoded; every assertion reads `config.copy.dex`.
- **`packages/app/test/dexView.test.tsx`** — a `FriendsList` stub exposing only `onOpenSelf`, plus the `fullscreen sheet exit window (reverts with the 22-02 exit commit)` describe. No `vi.mock("motion/react")` anywhere in the file.

## Decisions Made

- **Shape (b), the object-wrap, exactly as the planner specified.** The decisive property in practice: under the two shipped `useLiveQuery: () => undefined` doubles it reads as *pending* (hold the frame), never as *permanently missing*. A `defaultResult` sentinel would have flipped both files onto the new error branch and forced edits to `sheet.a11y.test.tsx`, which the plan forbids.
- **Neither shipped double needed editing — confirmed empirically, not just by audit.** `setlistView.test.tsx`'s four original cases and `sheet.a11y.test.tsx`'s SetlistView portal-parity case all pass with their bodies untouched, because `resolved` is computed archive-first and both supply show `4001`.
- **The Escape wiring is scoped to the missing state only.** `useDialogDismiss(missing, onClose)` — `active` is false on the resolved and pending paths, so nothing is ever pushed onto the LIFO stack for them. Phase-21 D-23 recorded that the resolved path has never handled Escape; that is deliberately unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 – Blocking] `npx tsc -b` is vacuous in this repo**

- **Found during:** every typecheck gate (Tasks 1 and 3), carried from plans 22-01 and 22-02's identical finding.
- **Issue:** there is no root `tsconfig.json` (only `tsconfig.base.json` + per-package configs). Bare `npx tsc -b` prints `TS5083` and **still exits 0**, so the plan's literal `&& npx tsc -b` gate would have proved nothing.
- **Fix:** ran `npx tsc -b packages/core packages/app` at every gate — exit 0, no output, every time. No config file added.
- **Files modified:** none (verification-only)

### Test-harness choices that differ from the plan's literal wording

**2. `vi.hoisted({ result })` instead of a bare module-level `let liveQueryResult`**

- **Where:** `packages/app/test/setlistView.test.tsx`.
- **Why:** `vi.mock` calls are hoisted above the module body. A factory closing over a plain `let` sits in that binding's temporal dead zone if the factory is ever evaluated first, which is a latent, ordering-dependent failure rather than a loud one. The semantics the plan asked for are preserved exactly — a controllable module-level binding, default `undefined`, reset in `afterEach` — so every pre-existing case passes untouched. Recorded in a comment at the mock.

**3. `FriendsList` is stubbed in `dexView.test.tsx`**

- **Where:** `packages/app/test/dexView.test.tsx`.
- **Why:** the plan's Task 3 says to add the two cases but does not say how to reach the trophy case. The real path runs through `FriendsList` → `SelfRow`, which needs a non-null `useAuthIdentity()` (localStorage-backed) and pulls in the Supabase client, the shared presence store and the friends pull — none of which this block asserts anything about, and all of which would add async churn to a file that currently mocks no auth at all. `DexView` owns the overlay; the stub isolates the seam that matters (`onOpenSelf`) and leaves every other case in the file on the Albums/Shows segments, untouched.

### Deliberate deviation from one plan instruction

**4. The missing state's heading is an `<h1>`, not an unspecified element with the given classes**

The plan specifies the class list (`text-[20px] font-semibold leading-tight text-text-primary`) but not the tag. It first landed as a `<p>` (matching the non-heading elements elsewhere in this file), then was changed to `<h1>` in `c508924` to match `ExploreView`'s calm-error block — the block the plan names as "the tone to match" — element-for-element. An AT user in this dialog otherwise has nothing but the Back control to navigate to. Class list and copy are unchanged; no assertion depends on the tag.

### Disclosure, not a change

**5. Only ONE of the two exit-window cases discriminates the conversion**

Under the mutation that restores the pre-conversion unmount-driven wrapper, the retention case goes red and "keeps the sheet element mounted while closed, rendering zero DOM nodes" stays **green** — both shapes render zero nodes when closed, so that case pins "the conversion did not leave a permanently-painted overlay behind" rather than the conversion itself. Same class of honesty note as plan 22-02's deviation 5. It is kept because the property it pins is real and is what a careless conversion would break.

---

**Total deviations:** 5 (1 Rule-3 blocking, 2 test-harness choices, 1 deliberate, 1 disclosure)
**Impact on plan:** No scope change. No file outside the plan's `files_modified` was touched, no dependency added, no behaviour beyond the `<action>` text implemented.

## Notes for plan 22-09 (the revert procedure)

Step **(b)** of revert procedure 1 is now real and lives at the bottom of `packages/app/test/dexView.test.tsx`:

```
describe("fullscreen sheet exit window (reverts with the 22-02 exit commit)", …)
```

Deleting that block is sufficient — it is the only thing in this plan that asserts an exit window. **The `DexView` source conversion itself should NOT be reverted with it:** a prop-driven `<Sheet>` is correct under both the animated and the enter-only ship (with the exit reverted it simply removes synchronously, exactly as it did before), and `key={openShow.showId}` is CR-02's, unrelated to motion. Reverting the conversion would additionally re-break nothing but would need `dexView.test.tsx`'s stub removed, which is churn for no gain.

## Notes for plan 22-10

- `packages/app/src/components/Sheet.tsx` is **untouched** by this plan. Its module-doc note (b) still reads "Plan 22-04 converts `DexView` only (the D-21 fullscreen exemplar); the rest are a documented seam" — that sentence is now accurate as shipped, and re-wording the seam roster after `TrailNodeSheet`/`WhyDetail` land is 22-10's job.
- The conversion recipe that worked here, if it transfers: move the guard from the element to the children (`open={cond && payload != null}` + a guarded fragment inside). It needs no payload-retaining ref whenever a null payload also forces `open` false.
- Both 22-10 exit-window blocks must wait on the **captured node**. `queryByRole` is blind to the `aria-hidden` the close-start contract sets, so the role-query form resolves instantly and never observes removal.

## Issues Encountered

- Nothing blocking. The one thing worth flagging forward: `useObservable`'s `hasResult: true` persisting across a deps change means `cachePending` would silently lie if `<SetlistView>` were ever rendered without a `key` on a changing `showId`. The `key` added in Task 3 is what makes it structural, and both the key and the flag carry comments saying so — a future reader deleting the "redundant" key would reintroduce a stale-pending window with a fully green suite.

## Known Stubs

None in `src/`. Every branch added is reachable and exercised by a passing assertion: pending (case 1), missing (case 2), cache-fallback (case 3), closed-fullscreen-sheet (exit case 1), exiting-fullscreen-sheet (exit case 2).

The one stub added is test-only and disclosed above: `dexView.test.tsx`'s `FriendsList` double. It stands in for a component whose real behaviour is covered by `test/dex/friendPresence.test.tsx` and `test/dex/ReactionPalette.test.tsx`.

## Threat Flags

None. No network call, no new persistence, no new trust boundary — the `<threat_model>`'s single Dexie → UI row holds exactly, and this plan changed only *how absence is detected*, not what is rendered from a present row. The registered mitigations behave as predicted:

- **T-22-09** (unrecoverable `aria-modal` trap) — visible ≥44px Back **and** Escape, both asserted in one body.
- **T-22-10** (XSS in the new markup) — the branch renders `config.copy.dex.*` constants as escaped React text. No `cacheRow` interpolation, no imported-file value, no `dangerouslySetInnerHTML` anywhere in the file.
- **T-22-11** (error leakage) — no Dexie error object and no stack reaches the DOM; the copy names the problem and the next step, and blocks only this view.
- **T-22-22** (retained node after close) — accepted, and now observable: the retained dialog carries `aria-hidden="true"` synchronously at close-start and is removed at the end of the exit.
- **T-22-SC** — no package installed.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

Files verified on disk: `packages/app/src/dex/SetlistView.tsx`, `packages/app/src/dex/DexView.tsx`,
`packages/app/test/setlistView.test.tsx`, `packages/app/test/dexView.test.tsx`, and this SUMMARY.

Commits verified in `git log` on `worktree-agent-a3d6e035c70b09cdf` (base `cddcddd`):
`db6f98a`, `64c05a4`, `6712dfb`, `c508924`.

Verification re-run at close:
`npx vitest run` → **137 files / 1170 tests passed**;
`npx tsc -b packages/core packages/app` → exit 0, no output;
`git diff --stat cddcddd HEAD` → exactly 4 files, none of them `Sheet.tsx`, `sheet.a11y.test.tsx` or `layerOrder.test.tsx`;
`grep -n "open={selfCaseOpen" packages/app/src/dex/DexView.tsx` → line 238;
`grep -rn "<Sheet" packages/app/src/` → one call site changed from unmount-driven to prop-driven by this plan.

---
*Phase: 22-surface-motion-the-chrome-mechanism*
*Completed: 2026-08-06*
