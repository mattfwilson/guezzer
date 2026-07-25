---
phase: 21-layout-layering-foundations
plan: 07
subsystem: layout
tags: [safe-area, css-custom-properties, single-owner, found-01, found-02, d-02, d-16]
requires:
  - phase: 21-layout-layering-foundations
    plan: 01
    provides: "?layoutProbe=1 harness + the 21-HUMAN-UAT.md evidence record"
  - phase: 21-layout-layering-foundations
    plan: 03
    provides: "config.copy.tabs — BottomTabBar labels already moved, so this plan touches only its geometry"
  - phase: 21-layout-layering-foundations
    plan: 04
    provides: "the FOUND-01 branch decision — CONFIRMATION BRANCH, licensing the styles.css:220 deletion"
provides:
  - "config.ui.bottomSpace — the three numbers behind every bottom reserve"
  - "src/layout/bottomSpace.ts — the FOUND-02 single owner (composition + documentElement write)"
  - "--gz-safe-bottom declared once in styles.css :root; body's bottom inset deleted"
  - "AppShell + BottomTabBar converted; the D-02 divergence preserved and named"
  - "the D-16 chrome-collapse seam, shipped pinned true"
affects:
  - "plans 21-08/21-09/21-10 (the remaining surfaces convert onto these same vars)"
  - "plan 21-10 (the D-12 source guard now has exactly one legitimate raw env() bottom read to whitelist)"
  - "plan 21-13 (the AFTER half of UAT test 1 now has a real fix to measure against)"
  - "Phase 22 (flips chromeVisible in one place instead of nine)"
tech-stack:
  added: []
  patterns:
    - "CSS custom-property ladder composed in one pure function, applied in one layout effect"
    - "env() authored in CSS, never round-tripped through JS setProperty"
    - "Hoisting env() into a variable removes calc(env(...)) — the standard Safari workaround"
    - "Two deliberately distinct reserves (chrome vs content) rather than one collapsed value"
key-files:
  created:
    - packages/app/src/layout/bottomSpace.ts
    - packages/app/test/bottomSpace.test.ts
  modified:
    - packages/app/src/config.ts
    - packages/app/src/styles.css
    - packages/app/src/components/AppShell.tsx
    - packages/app/src/components/BottomTabBar.tsx
    - packages/app/test/bottomOverlayInset.test.tsx
decisions:
  - "FOUND-01 resolved on the CONFIRMATION BRANCH — body's padding-bottom deleted, per plan 21-04's derivation that the dead gap equals exactly one safe-area inset"
  - "The overlay-inset store is folded in, not replaced (D-03): bottomOverlayInset.ts still measures, useBottomSpaceVars consumes"
  - "The pre-existing AppShell padding tests were re-pointed rather than deleted — the untappable-Start-Show regression is still guarded, now through --gz-overlay-inset"
metrics:
  duration: ~20 min
  completed: 2026-07-25
  tasks: 3
  commits: 3
  tests_before: 1026
  tests_after: 1052
---

# Phase 21 Plan 07: Bottom-Space Single Owner Summary

The app's bottom-space arithmetic now has one owner: three numbers in
`config.ui.bottomSpace`, one composition module writing a six-variable `--gz-*` ladder to
`document.documentElement`, and exactly one raw `env()` bottom read in the entire codebase.
The tab bar and `<main>` are the first two surfaces converted, and the FOUND-01 dead gap is
fixed on recorded evidence rather than assumption.

## The Evidence Gate — CONFIRMATION BRANCH

Task 2's `styles.css` edit was gated on plan 21-04's measurement. **The gate is satisfied and
the branch is CONFIRMATION** (`21-HUMAN-UAT.md` test 1, `21-04-SUMMARY.md`):

- The owner confirmed a **visible dead gap reproduces** on the installed instance
  (2026-07-25), which rules out the ALREADY-FLUSH branch (D-19) outright — D-19 is recorded
  as moot.
- The branch *selection* was then derived from the verified layout chain rather than from the
  probe, because the shipped `?layoutProbe=1` `GAP` formula turned out to be
  non-discriminating (it reads the border box, so it evaluates to a constant `−4rem`
  regardless of the inset).

The derivation, with `V` = visible viewport height and `S` = the safe-area bottom inset:

```
<main> content bottom = (V − S) − (4rem + S) = V − 4rem − 2S
<nav> top             = fixed, viewport-relative = V − 4rem − S
DEAD GAP              = S     ← exactly one safe-area inset
```

`GAP === sab` is D-15's signature exactly: the inset is counted twice on the content side
while the `fixed` tab bar ignores body padding entirely. So
`padding-bottom: env(safe-area-inset-bottom)` was deleted from `body`; `padding-left` and
`padding-right` stay, having no per-surface duplicate. The measured values are quoted in the
`styles.css` comment, which also carries the derivation so the deletion stays traceable.

**No numeric `sab` / `GAP` readings exist to quote** — the owner's device pass was a visual
confirmation and the three numbers were never recorded (the probe could not have produced
meaningful ones). What is quoted is therefore the derivation and the reproduction, which is
what plan 21-04 recorded as the gate's outcome. The on-device before/after record remains owed
to success criterion 1 as requirement bookkeeping, batched into plan 21-13 alongside a
corrected probe.

## What Was Built

**`config.ui.bottomSpace`** — `TAB_BAR_HEIGHT_REM: 4` (D-04: `rem` so the bar grows with
Dynamic Type instead of clipping its labels), `FAB_CLEARANCE_PX: 16`, `SHEET_PAD_BOTTOM_PX: 32`
(D-07: deliberately not tab-bar-relative — a sheet covers the bar, it does not sit above it).

**`styles.css :root`** — `--gz-safe-bottom: env(safe-area-inset-bottom)`, in a plain block, not
`@theme` (which would generate unwanted Tailwind utilities). Authored in CSS because the
`:root { --x: env(...) }` form is the documented pattern while a JS `setProperty` round-trip
with `env()` is unverified in Safari — and that failure would be invisible on a desktop, where
the inset is `0` (T-21-17).

**`src/layout/bottomSpace.ts`** — `BOTTOM_SPACE_VAR_NAMES`, the pure `bottomSpaceVarEntries`,
`applyBottomSpaceVars` and the `useBottomSpaceVars` hook. The ladder goes on
`document.documentElement`, never `#root`: `Sheet.tsx` portals to `document.body`, so a
variable on `#root` would be invisible to every portaled node — including
`--gz-sheet-pad-bottom`, which exists specifically for sheets. A layout effect, not a passive
one, so values land before the first paint of the commit that renders the chrome.

**D-02 is preserved and now named.** `--gz-chrome-reserve` (tab bar only) is what every
fixed-bottom surface composes from; `--gz-content-reserve` adds the measured overlay inset and
is for scrolling `<main>` only. Reserving the overlay inset on a non-scrolling route would
permanently squish a `flex-1` full-height stage whenever a transient banner appeared. The
`scroll` ternary in `AppShell` keeps exactly the divergence it had, now as two named
compositions instead of two hand-written strings.

**D-16's seam ships pinned.** `chromeVisible` defaults `true`, no caller passes `false`, and
there is no toggle or behavior change. Phase 22 flips this one source and every consumer
follows.

Side effect worth naming: composing from `var(--gz-safe-bottom)` eliminates the
`calc(env(...) + …)` form from every converted surface — itself the standard workaround for
Safari's historical trouble with `env()` inside `calc()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `bottomOverlayInset.test.tsx` encoded the pre-conversion arithmetic**

- **Found during:** Task 2
- **Issue:** The three `AppShell bottom padding reservation` cases assert
  `main.style.paddingBottom` contains `4rem` and `${px}px`. After the conversion `<main>`
  reads `var(--gz-content-reserve)`, so all three failed. The file is not in the plan's
  `files_modified`, but Task 2's own `<verify>` runs it, so the plan expects it green.
- **Fix:** Re-pointed `expectPaddingBottom` at the new path rather than deleting the tests —
  the untappable-Start-Show regression is still guarded, now by asserting `<main>` reserves
  the content composition *and* that `--gz-overlay-inset` on `documentElement` carries the
  registered height. A tall InstallBanner's real measured height is still what gets reserved,
  which is the whole point of that debug session. One stale test title mentioning `4rem` was
  renamed.
- **Files modified:** `packages/app/test/bottomOverlayInset.test.tsx`
- **Commit:** `f63ef88`

### Acceptance Criteria Notes

Two criteria could not be met as literally written; both are satisfied in substance:

- **`grep -c 'useLayoutEffect' bottomSpace.ts` returns 2, not 1.** The two lines are the
  `import` and the single call site — the minimum for any module that both imports and calls
  the hook. There is exactly one layout effect and no `useEffect`, which is the criterion's
  intent. Reaching literal `1` would require a namespace import (`React.useLayoutEffect`)
  against the codebase's named-import idiom purely to satisfy a grep, which was not done.
- **AppShell lines 29-37: sentences are byte-identical, line wrapping is not.** The
  CONFIRMATION-BRANCH carve-out amends the "(and it already respects body's safe-area
  padding)" clause mid-paragraph, which necessarily re-wraps the lines that follow it inside
  the same comment. Every other sentence in that block — the `min-h-screen`/100vh iOS trap,
  the PreShowLauncher centering explanation, the InstallBanner tap interception, the
  desktop-unaffected note — is preserved word-for-word. Both `start-show-not-clickable`
  attributions survive.

## Verification

- `npx vitest run` — **130 files / 1052 tests passing** (baseline 129 / 1026, plus the 26 new
  `bottomSpace.test.ts` cases). No pre-existing test was left failing.
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds.
- `grep -c 'env(safe-area-inset-bottom)' packages/app/src/styles.css` → **1** (the `:root`
  declaration; the `body` line is gone).
- `grep -c '4rem\|64px'` → **0** for both `AppShell.tsx` and `BottomTabBar.tsx`, comments
  included.
- `grep -rn 'env(safe-area-inset-bottom)' packages/app/src` → `styles.css` plus only the
  surfaces plans 21-08/09/10 still own (`BackupToast`, `BingoCelebration`, `InstallBanner`,
  `Sheet`, `UpdateToast`, `ArchiveBrowser`, `RecapView`, `ExploreFilterFab`, `NodeSheet`,
  `CometTrail`, `fabLayout`, plus `dev/LayoutProbe`). `AppShell` and `BottomTabBar` are off
  that list.

## Threat Model Notes

- **T-21-17 (mitigated):** `--gz-safe-bottom` is CSS-authored; no `env()` value passes through
  JS. A test asserts `BOTTOM_SPACE_VAR_NAMES` does not contain it.
- **T-21-19 (mitigated):** the body-padding removal shipped only on the recorded CONFIRMATION
  branch, and a test pins that branch — including an assertion that `styles.css` does **not**
  claim D-19, which would fabricate a non-reproduction the evidence contradicts.
- **T-21-SC (mitigated):** zero packages added, removed or upgraded; `package.json` untouched.

## Known Stubs

None. Every value the two converted surfaces render is wired to the owner.

## Notes for the Orchestrator

This agent ran in the **main repo checkout on `master`**, not a worktree — `.git` is a
directory and `git worktree list` showed only the main checkout. HEAD was already exactly at
the expected base `f29edca`, so no reset was performed and the worktree-only commit guards did
not apply. The three task commits are directly on `master`; there is no branch to merge.
`.planning/STATE.md` carries a pre-existing uncommitted modification from before this agent
started and was deliberately left untouched.
