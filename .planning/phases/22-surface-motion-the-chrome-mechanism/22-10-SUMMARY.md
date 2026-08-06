---
phase: 22-surface-motion-the-chrome-mechanism
plan: 10
subsystem: ui
tags: [react, motion, animate-presence, useIsPresent, bottom-sheet, exit-animation, dexie, a11y, aria-hidden, pointer-events]

# Dependency graph
requires:
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 01
    provides: "the portal → AnimatePresence → SheetSurface restructure, and the `open`-false path that renders ZERO DOM nodes (what makes an always-mounted closed sheet free)"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 02
    provides: "the SHEET-02 close-start contract (`aria-hidden` + `pointer-events: none` derived from `useIsPresent()`) that these two surfaces now actually exercise, and the `waitForElementToBeRemoved(node)` trap this plan had to avoid"
  - phase: 22-surface-motion-the-chrome-mechanism
    plan: 04
    provides: "`DexView`'s fullscreen conversion — its landing is what makes this plan's 13/6 inventory correct, and the working exit-window test shape copied here"
provides:
  - "SHEET-01's live BOTTOM-SHEET exit consumers: `TrailNodeSheet` and `WhyDetail` are now `open`-prop-driven (`open={entry != null}` / `open={candidate != null}`)"
  - "the last-non-null-payload ref idiom, assigned DURING RENDER — null-safety for the closing render (T-22-37), NOT exit-frame content retention"
  - "`Sheet.tsx`'s corrected seam list: six openings across three files (`CompareView` ×2, `FriendDetail` ×2, `PinSheet` ×2) remain unmount-driven; thirteen are prop-driven"
  - "`describe(\"bottom-sheet exit window (reverts with the 22-02 exit commit)\")` in BOTH `trailNodeSheet.test.tsx` and `songRow.test.tsx` — steps (c) and (d) of plan 22-09's revert procedure 1"
affects: [22-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "convert an unmount-driven `<Sheet>` whose payload is the open signal: hold the last non-null payload in a `useRef` assigned during RENDER, derive `shown = payload ?? ref.current`, render `open={payload != null}` and guard the body on `shown != null`"
    - "RENDER reads the retained `shown`; HANDLERS read the raw PROP. Inside a retained exiting subtree the closure is frozen at the last present render, so the prop is the row the surface was opened on — a call-time ref read is the unsafe one (T-22-36)"
    - "mutation-verify with TWO mutations when a conversion has two distinct failure modes: restoring the pre-conversion early return (proves retention) and leaving a derived read on the nullable prop (proves the null-safety)"

key-files:
  created: []
  modified:
    - packages/app/src/show/TrailNodeSheet.tsx
    - packages/app/src/show/WhyDetail.tsx
    - packages/app/src/components/Sheet.tsx
    - packages/app/test/trailNodeSheet.test.tsx
    - packages/app/test/songRow.test.tsx

key-decisions:
  - "The plan's Task 2 `<action>` literally specifies `waitForElementToBeRemoved(() => screen.queryByRole(\"dialog\"))`. That is the silent false green plan 22-02 documented (deviation 3) — `*ByRole` ignores `aria-hidden` subtrees, which the close-start contract sets on the exiting card. Both blocks wait on the CAPTURED NODE instead."
  - "The plan's Task 1 step C instructs citing `22-CONTEXT.md` §Deferred Ideas as recording the deferral of the remaining six conversions. It does not — that section records the five HAND-ROLLED sheet migration (D-16), swipe-down, back-gesture and nested scrims. An accurate citation was written into `Sheet.tsx` rather than a false one."
  - "`ShowView.tsx` is untouched: both call sites were ALREADY always-mounted with a nullable prop, confirmed by reading lines 641 and 652 before editing. The conversion is entirely inside the two components."
  - "`searchOpen` stays a real early return, byte-unchanged, with a new comment recording why `<Sheet open={…}>` must NOT also be gated on `!searchOpen`."

requirements-completed: []

# Metrics
duration: 13min
completed: 2026-08-06
---

# Phase 22 Plan 10: The Bottom-Sheet Exit Exemplars Summary

**The trail-node editor and the orb why-sheet no longer vanish on close — each now renders `<Sheet open={payload != null}>` with its last non-null payload held in a render-assigned ref, so `AnimatePresence` slides the card down over 200ms while the close-start contract (`aria-hidden`, `pointer-events: none`) lands in the same tick, and `Sheet.tsx`'s seam list finally names only the six openings that genuinely remain unmount-driven.**

## Performance

- **Duration:** ~13 min
- **Base:** `a6320ea`
- **Tasks:** 2 (landing as 2 commits)
- **Files modified:** 5 (0 created, 5 modified)
- **Suite:** 139 files / **1194** tests green (base was 139 / 1188 — **+6**, exactly the six new cases; no pre-existing case edited or lost)

## Accomplishments

- **SHEET-01's bottom-sheet half now has live consumers.** Before this plan the exit animation's only prop-driven consumer was `DexView`'s fullscreen trophy case (22-04), which takes the D-26 *fade* path. The bottom-sheet `y: 100%` **slide** — the thing ROADMAP criterion 1 actually names — had no converted call site at all. It has two now, and both are in the D-21 device sample.
- **Both cases are mutation-verified, with two different mutations, because the conversion has two distinct failure modes.**
  - Restoring the pre-conversion `if (!candidate) return null` reds **2 of 3** cases, both on the anti-vacuity `document.body.contains(dialog)` assertion — the node is destroyed synchronously, which is exactly the defect the conversion exists to escape.
  - Leaving a derived read on the nullable prop (`getRarityIndex()?.get(candidate!.songId)` — the T-22-37 shape the plan warns about by name) reds **all 3**, with case 3 failing on its explicit `.not.toThrow()` and naming `TypeError: Cannot read properties of null (reading 'songId')`.
- **The upstream false-green trap was avoided by construction.** Both blocks capture the dialog node first and `await waitForElementToBeRemoved(dialog, { timeout: 2000 })`. The plan's own `<action>` text specified the role-query form; taking it literally would have produced a block that resolves instantly and never observes removal.
- **The write-safety rule is enforced in source, not just asserted in prose.** `handlePick` and `handleDelete` read the `entry` **prop** and are guarded `entry != null && entry.id != null`; neither dereferences `shown` or `lastEntryRef`. A comment at each explains that the frozen exiting closure is what makes the prop the *correct* target and a call-time ref read the unsafe one (T-22-36).
- **Blast radius is exactly the plan's file set.** `git diff --stat a6320ea HEAD` lists the five declared files. `ShowView.tsx` is unmodified, as the verification block requires.

## Task Commits

1. **Task 1: both bottom-sheet exemplars → prop-driven, + the corrected seam list** — `07c6476` (feat)
2. **Task 2: the exit-window assertion blocks** — `c852379` (test)

## Files Created/Modified

- **`packages/app/src/show/WhyDetail.tsx`** — `if (!candidate) return null` deleted; `lastCandidateRef` assigned during render; `shown = candidate ?? lastCandidateRef.current`. `<Sheet open={candidate != null}>` with `ariaLabel={shown != null ? \`Why ${shown.songName}?\` : ""}` and the body wrapped in `{shown != null && (…)}`. Every derived read (`getRarityIndex()`, `songName`, `reason`, `nn`) moved onto `shown`. A block comment records why the surface is prop-driven **and** the counter-intuitive fact that the ref is not what puts content on screen during the exit.
- **`packages/app/src/show/TrailNodeSheet.tsx`** — same shape via `lastEntryRef` / `shown`. `<Sheet open={entry != null} … ariaLabel={shown?.songName ?? ""}>`; render reads `shown`, handlers read the `entry` prop. The `searchOpen` early return is byte-unchanged and gains a comment stating that the surface *swap* is why `<Sheet open>` must not be gated on `!searchOpen`. `useState` import extended to `useRef, useState`.
- **`packages/app/src/components/Sheet.tsx`** — **module doc only, no behaviour change.** Note (b)'s "nine of the nineteen" paragraph rewritten: six openings across three files remain unmount-driven, thirteen are prop-driven, three were converted on purpose as the D-21 exit exemplars (naming `DexView`→22-04 and `TrailNodeSheet`/`WhyDetail`→22-10), and the remaining six are a bounded deliberate seam to revisit only after device verification. Note (a) (the D-16 hand-rolled-sheet seam) is untouched, as instructed.
- **`packages/app/test/trailNodeSheet.test.tsx`** — new `describe` (below); imports gain `waitForElementToBeRemoved` and `within`. The six pre-existing cases are unmodified.
- **`packages/app/test/songRow.test.tsx`** — new `describe` (below); imports gain `waitForElementToBeRemoved`. `WhyDetail` deliberately covered here rather than in a new `whyDetail.test.tsx`, reusing the `candidate()` factory and `@archive` stub. The five pre-existing cases are unmodified.

## ⚠ Notes for plan 22-09 (the revert procedure)

Steps **(c)** and **(d)** of revert procedure 1 are now real. Both blocks carry the **exact** name below and sit at the **bottom** of their file:

| File | `describe` block title |
|------|------------------------|
| `packages/app/test/trailNodeSheet.test.tsx` | `bottom-sheet exit window (reverts with the 22-02 exit commit)` |
| `packages/app/test/songRow.test.tsx` | `bottom-sheet exit window (reverts with the 22-02 exit commit)` |

Each block is **3 cases** and is self-contained (its own `afterEach(cleanup)` in `trailNodeSheet.test.tsx`; `songRow.test.tsx` uses the file-level `afterEach(cleanup)`). Deleting the two blocks — plus the import additions if lint complains about unused `waitForElementToBeRemoved` / `within` — is sufficient; nothing else in either file asserts an exit window.

**The SOURCE conversions should NOT be reverted with them.** A prop-driven `<Sheet>` is correct under both the animated and the enter-only ship: with the 22-02 exit commit reverted, `open={payload != null}` simply removes the node synchronously, exactly as the pre-conversion shape did. Reverting the conversions would be pure churn and would additionally re-break the `Sheet.tsx` seam roster.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 – Bug] The plan's prescribed removal assertion is a silent false green**

- **Found during:** Task 2 (avoided pre-emptively — plan 22-02 deviation 3 and 22-04 both flag it).
- **Issue:** Task 2's `<action>` specifies `await waitForElementToBeRemoved(() => screen.queryByRole("dialog"), { timeout: 2000 })`. `*ByRole` ignores `aria-hidden` subtrees by default, and the D-19 close-start contract puts `aria-hidden="true"` on the exiting card — so the query returns `null` the instant the contract **works**, and the wait resolves without ever observing removal.
- **Fix:** capture the node first, `await waitForElementToBeRemoved(dialog, { timeout: 2000 })`, with the trap recorded in a comment at each call site.
- **Files modified:** `packages/app/test/trailNodeSheet.test.tsx`, `packages/app/test/songRow.test.tsx`
- **Committed in:** `c852379`

**2. [Rule 1 – Bug] The plan's prescribed source citation is false**

- **Found during:** Task 1 step C (checked before writing it into permanent source).
- **Issue:** step C instructs the `Sheet.tsx` seam paragraph to state "that converting them is the deferred idea recorded in `22-CONTEXT.md` §Deferred Ideas". That section records four other things — the five **hand-rolled** sheet migration (D-16), swipe-down-to-dismiss, OS back-gesture handling, and nested scrim suppression. It does **not** record deferring the six unmount-driven `<Sheet>` conversions. A permanent module comment sending a future reader to a section that does not say what it claims is exactly the kind of rot this phase's comment discipline exists to prevent.
- **Fix:** the paragraph states the deferral in its own words (bounded deliberate seam; revisit only after device verification via 22-HUMAN-UAT) and cites §Deferred Ideas accurately — as the *adjacent* hand-rolled-sheet seam already covered in note (a).
- **Files modified:** `packages/app/src/components/Sheet.tsx`
- **Committed in:** `07c6476`

**3. [Rule 3 – Blocking] `npx tsc -b` is vacuous in this repo**

- **Found during:** both typecheck gates (carried from plans 22-01, 22-02 and 22-04's identical finding).
- **Issue:** there is no root `tsconfig.json` (only `tsconfig.base.json` + per-package configs), so bare `npx tsc -b` prints `TS5083` and **still exits 0** — the plan's literal `&& npx tsc -b` gate would have proved nothing.
- **Fix:** ran `npx tsc -b packages/core packages/app` at every gate — exit 0, no output, both times. No config file added.
- **Files modified:** none (verification-only)

### Disclosures, not changes

**4. Case 1 does not discriminate the conversion**

Under the pre-conversion mutation, "renders zero DOM nodes while closed" stays **green** in both files — the old early return and the new `open={false}` path both render zero nodes when closed. Its discriminating power is over a *careless* conversion that leaves a permanently-painted overlay behind, which is a real property worth pinning but is not the conversion itself. Same class of honesty note as 22-02 deviation 5 and 22-04 deviation 5. The block's power over the conversion is **2 of 3** cases.

**5. The ref and the `shown != null` body guard are belt-and-braces, and the guard alone would prevent the throw**

Stated plainly because the plan's framing invites over-crediting the ref. With the body wrapped in `{shown != null && (…)}`, a no-ref implementation (`shown = payload`) would render an empty body on the closing render and would **also** not throw. What the ref actually buys is that the closing render builds the **full** body from the last payload — a strictly larger throw surface, deliberately exercised — which is what makes case 3's `.not.toThrow()` a meaningful T-22-37 guard rather than a tautology. Mutation 2 (a derived read left on the nullable prop) is the one that proves the assertion has teeth, and it reds all three cases. The ref is kept because the plan mandates it, its acceptance criterion requires render-time assignment, and it keeps the closing render honest about the data it claims to describe.

---

**Total deviations:** 5 (2 Rule-1 bugs, 1 Rule-3 blocking, 2 disclosures)
**Impact on plan:** No scope change. No file outside `files_modified` was touched, no dependency added, no behaviour beyond the `<action>` text implemented. Both Rule-1 fixes correct instructions that would have produced a vacuous test and a false source citation respectively.

## Verification

- `npx vitest run` → **139 files / 1194 tests passed** (base `a6320ea`: 139 / 1188).
- `npx vitest run --project @guezzer/app` → **91 files / 739 tests passed**, exit 0.
- `npx tsc -b packages/core packages/app` → exit 0, no output.
- `grep` of JSX `<Sheet` openings → **19** openings; the bare-`open` (parent-conditional) set is exactly `PinSheet` ×2, `CompareView` ×2, `FriendDetail` ×2 = **6**, leaving **13** `open`-prop-driven. Matches the plan's required inventory.
- `git diff --stat a6320ea HEAD` → exactly the 5 declared files; `packages/app/src/show/ShowView.tsx` unmodified.
- Neither test file contains `vi.mock("motion/react"` or `vi.useFakeTimers()` (only the prohibition comments naming them).

## Issues Encountered

- **Nothing blocking.** The one thing worth flagging forward: the two plan instructions corrected in deviations 1 and 2 were both *copied forward* from earlier phase artifacts (22-RESEARCH's code example and a stale reading of §Deferred Ideas). Plan 22-09 inherits the same research document — its revert procedure should be read against the shipped test files, not against the research example.
- The worktree spawned at a **stale ancestor** (`e847183`, ~6 commits behind) and required the sanctioned `git reset --hard a6320ea` before any work. `22-04-SUMMARY.md` was verified present afterwards, per the dependency check.

## Known Stubs

None. Every branch added is reachable and exercised: closed/zero-nodes (case 1), retained-and-hidden (case 2), no-blank-card + no-throw (case 3), and both `shown`-guarded bodies render real payload data in the pre-existing cases.

## Threat Flags

None. No network call, no new persistence, no new trust boundary — the `<threat_model>`'s single UI → Dexie row holds exactly, and this plan changed only *when* the surface unmounts, never what it writes. The registered dispositions behave as predicted:

- **T-22-36** (wrong-row edit from the retained subtree) — **accept, not reachable**, and the residual design rule is now enforced in source: both handlers read the `entry` prop, guarded `entry != null`, with the mechanism explained at each.
- **T-22-37** (a converted sheet throwing on the render where its payload goes null) — mitigated by the render-assigned ref plus the `shown != null` guard; proven by mutation 2 reding all three cases.
- **T-22-04** (tapping a control in a sliding-away sheet) — `pointer-events: none` re-asserted per surface (case 2). `fireEvent` bypasses `pointer-events`, so the behavioural proof stays with plan 22-09 / `22-HUMAN-UAT.md` test 2.
- **T-22-35** (exit-window tests outliving a 22-02 revert) — both blocks carry the exact revert-procedure name, tabulated above.
- **T-22-SC** — no package installed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 22-09 is unblocked** and now has all four exit-window artifacts to enumerate: `sheet.closeStart.test.tsx` (inside the 22-02 commit), `dexView.test.tsx` (22-04), and the two named above.
- **`SHEET-01` / `SHEET-02` deliberately NOT checked off** (`requirements-completed: []`), consistent with 22-02 and 22-04: SHEET-02's device half is 22-09 UAT test 2, and marking either here would be a false green. `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` are untouched by this agent — the orchestrator owns those writes.
- **Carried to the device session:** both bottom sheets now genuinely slide down on close, so `22-HUMAN-UAT.md` test 2's close-start tap can finally be performed on a bottom-sheet surface rather than only the fullscreen trophy case.

## Self-Check: PASSED

Files verified on disk: `packages/app/src/show/TrailNodeSheet.tsx`, `packages/app/src/show/WhyDetail.tsx`,
`packages/app/src/components/Sheet.tsx`, `packages/app/test/trailNodeSheet.test.tsx`,
`packages/app/test/songRow.test.tsx`, and this SUMMARY.

Commits verified in `git log` on `worktree-agent-acd793229b7c57007` (base `a6320ea`): `07c6476`, `c852379`.

---
*Phase: 22-surface-motion-the-chrome-mechanism*
*Completed: 2026-08-06*
