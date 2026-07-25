---
phase: 21-layout-layering-foundations
plan: 04
subsystem: device-verification
tags: [uat, device-session, safe-area, stacking-context, static-analysis, harness-defect]
requires:
  - phase: 21-layout-layering-foundations
    plan: 01
    provides: "?layoutProbe=1 and ?layerRepro=1 dev harnesses + the 21-HUMAN-UAT.md scaffold"
provides:
  - "21-HUMAN-UAT.md test 1 — the FOUND-01 branch decision: CONFIRMATION BRANCH (D-15 confirmed)"
  - "21-HUMAN-UAT.md test 7 — the FOUND-03 offending surfaces named: SearchSheet + FabMenu"
  - "21-HUMAN-UAT.md tests 3 and 5 — PASS on the installed instance"
  - "A recorded defect in the ?layoutProbe=1 GAP formula (blocks any meaningful D-18 capture)"
affects:
  - "plan 21-07 (licensed to delete styles.css:220 — the gate is satisfied)"
  - "plan 21-11 (offending surfaces named; portal SearchSheet + FabMenu, renumber nothing)"
  - "plan 21-13 (inherits the probe fix + the outstanding on-device before/after record)"
tech-stack:
  added: []
  patterns:
    - "Deriving a layout defect from the box-model chain when the harness cannot observe it"
    - "CSS stacking-context reasoning (position:relative + non-auto z-index) as primary evidence"
    - "Negative-case proof: contrasting portaled vs nested surfaces at identical tiers"
key-files:
  created: []
  modified:
    - .planning/phases/21-layout-layering-foundations/21-HUMAN-UAT.md
decisions:
  - "Both gating questions were resolved by derivation from source rather than by device/browser observation — the Chrome extension was unavailable and the installed-PWA probe turned out to be non-discriminating"
  - "D-19 is moot: the gap reproduces on the owner's device, so FOUND-01 cannot close on a flush baseline"
  - "The on-device before/after record is reclassified from development blocker to requirement bookkeeping, deferred to 21-13 — and it needs a corrected probe first"
  - "No tier renumbering: the negative case (Sheet.tsx portals; same tiers, opposite outcome) proves the cause is nesting, upholding D-20's standing constraint"
metrics:
  duration: ~2 h (two sessions — owner device pass, then static analysis)
  completed: 2026-07-25
  tasks: 2
  commits: 3
  tests_before: 1026
  tests_after: 1026
---

# Phase 21 Plan 04: Device Session #1 Summary

Both wave-2 gates are resolved and waves 3–8 are unblocked — but not the way the plan
anticipated. The owner's device pass confirmed the FOUND-01 gap reproduces and cleared tests 3
and 5; the two *decisions* the plan existed to produce were then derived from source, because
the shipped probe cannot measure the bug it was built for.

## What Was Established

**Test 1 — CONFIRMATION BRANCH (D-15 confirmed).**

The owner confirmed a visible dead gap on the installed instance, ruling out D-19's
non-reproduction branch. The branch *selection* was then derived from the verified layout chain
(`html,body,#root{height:100%}`, `body{margin:0}` with a bottom inset and no top inset, Tailwind
preflight `border-box`, `<main>` as `flex-1`, `<nav>` as `fixed bottom-0`):

```
body content box       = V − S          (body's own padding-bottom)
#root, <main> bottom   = V − S
<main> content bottom  = (V − S) − (4rem + S) = V − 4rem − 2S
<nav> top              = V − 4rem − S   (fixed → viewport-relative, ignores body padding)

DEAD GAP               = S              exactly one safe-area inset
```

The inset is counted twice on the content side while the fixed tab bar ignores it entirely.
Plan 21-07 is licensed to remove `padding-bottom: env(safe-area-inset-bottom)` from `body`
(`styles.css:220`). The left/right gutters stay — they have no per-surface duplicate.

**Test 7 — offending surfaces named: `SearchSheet` and `FabMenu`.**

`ShowView.withBackground` sets `position: relative` plus a non-auto `zIndex: config.ui.z.content`
(10), which creates a stacking context by spec. Every descendant z-index resolves *inside* it, so
the whole ShowView subtree composites at effective level 10 — `SearchSheet` (`sheet: 50`) and
`FabMenu` (`fabScrim: 25` / `fab: 30`) included. The toast family renders as siblings of
`<AppShell>` in `App.tsx` and keeps its literal `toast: 20` in the root context. 20 beats 10, so
a 50 loses to a 20 — renumbering cannot fix it.

The negative case is what makes this conclusive: `Sheet.tsx` is the **only** `createPortal` site
in the app (exhaustive grep). Surfaces on that primitive escape to `document.body` and win against
`toast: 20` at the same tier numbers. Identical numbers, opposite outcome, decided purely by DOM
position — D-20 confirmed, and the "write the invariant test, renumber nothing" constraint holds.

**Tests 3 and 5 — PASS.** Tab strip renders all five post-rename labels cleanly; the share-card
footer shows no date truncation and no overflow. Both carry a recorded scope caveat (max Dynamic
Type; the D-37 descender check) deferred to 21-13.

## Deviation: the harness could not do its job

Plan 21-01 shipped `?layoutProbe=1` to make the FOUND-01 branch decision mechanical. It cannot:

- `GAP` is `tabTop − main.getBoundingClientRect().bottom`. `getBoundingClientRect` returns the
  **border** box, which includes `<main>`'s padding, so `GAP = (V − 4rem − S) − (V − S) = −4rem`
  — a constant, independent of the inset, identical before and after the fix.
- `bodyH − rootH` equals `S` by construction on any build. It confirms body padding exists; it is
  not evidence of a defect.

Both "load-bearing" lines are non-discriminating. The formula must become
`navTop − (mainRect.bottom − mainPaddingBottom)` before the D-18 before/after capture can carry
meaning. Recorded against 21-13.

## What Remains Owed

Success criterion 1 asks for the gap "measured on-device before and after, portrait **and**
landscape". The derivation licenses the code change but is not that record. It is bookkeeping
against the requirement, not a blocker on waves 3–8, and is batched into plan 21-13 alongside
tests 2, 4, 6 and 8.

## Verification

- `21-HUMAN-UAT.md` status advanced `pending → testing → partial → diagnosed`
- Two gap entries carry filled `root_cause`, `artifacts` and `missing` fields
- Commits: `f7467d9` (session open), `d5fe014` (device results), `83ea0d8` (static analysis)
- No source files touched by this plan; the test suite is unchanged at 1026 passing (129 files)
