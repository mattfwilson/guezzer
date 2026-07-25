---
phase: 21-layout-layering-foundations
plan: 09
subsystem: layout
tags: [safe-area, css-custom-properties, sheets, found-02, d-07, d-08, d-10]
requires:
  - phase: 21-layout-layering-foundations
    plan: 07
    provides: "--gz-sheet-pad-bottom / --gz-safe-bottom on document.documentElement — the values every surface here reads"
  - phase: 21-layout-layering-foundations
    plan: 05
    provides: "the formatFullDate edits already landed in ArchiveBrowser.tsx and RecapView.tsx, both of which this plan re-edits"
provides:
  - "the sheet-padding family collapsed onto one owned value — the four-file copy-paste is gone"
  - "RecapView's page footer and NodeSheet's gutter reading --gz-safe-bottom at unchanged values"
  - "the D-08 audit outcome for MapView's status-chip strip, recorded in its own source"
  - "the D-10 peek-strip exemption recorded in BingoPeekStrip's header doc, so the FOUND-02 milestone audit does not read it as unmet"
  - "render assertions on both converted sheet surfaces that reject a re-introduced env()"
affects:
  - "plan 21-10 (the D-12 source guard now has five toast-family env() reads left to clear, not twelve)"
  - "plan 21-12 (owns the portal question for NodeSheet; its padding is already owner-composed)"
tech-stack:
  added: []
  patterns:
    - "Hand-rolled sheets read the same owned var as the Sheet primitive without being migrated onto it (D-22)"
    - "Deliberately unconverted surfaces carry their audit outcome as a source comment, not only in planning docs"
    - "Assert var() values via getAttribute(\"style\"), never the typed longhand — jsdom does not round-trip them"
key-files:
  created: []
  modified:
    - packages/app/src/components/Sheet.tsx
    - packages/app/src/dex/ArchiveBrowser.tsx
    - packages/app/src/show/CometTrail.tsx
    - packages/app/src/dex/RecapView.tsx
    - packages/app/src/explore/NodeSheet.tsx
    - packages/app/src/map/MapView.tsx
    - packages/app/src/show/BingoPeekStrip.tsx
    - packages/app/test/sheet.a11y.test.tsx
    - packages/app/test/cometTrail.test.tsx
decisions:
  - "MapView's status-chip strip audited as NOT tab-bar-relative and left unconverted (D-08 escape hatch) — it is absolute inside an already-reserved container and a sibling of the transformed stage"
  - "BingoPeekStrip's D-10 exemption written into the component's own header doc rather than left in the planning record"
  - "RecapView keeps its own 16px instead of adopting --gz-sheet-pad-bottom — it is a page footer at z.page, not a modal sheet"
metrics:
  duration: ~12 min
  completed: 2026-07-25
  tasks: 3
  commits: 3
  tests_before: 1052
  tests_after: 1054
---

# Phase 21 Plan 09: Sheet Padding + Remaining Bottom Surfaces Summary

Five bottom surfaces now read the plan-21-07 owner instead of hand-writing
`env(safe-area-inset-bottom)`, and the two surfaces that deliberately do *not* convert —
MapView's status-chip strip and the bingo peek strip — carry their reasons as comments in
their own source rather than only in the planning record.

## What Changed

**The sheet-padding family (D-07).** `calc(env(safe-area-inset-bottom) + 32px)` was
copy-pasted into three files; all three now read `var(--gz-sheet-pad-bottom)`:

| File | Surface |
|------|---------|
| `components/Sheet.tsx` | the shared bottom-sheet card |
| `dex/ArchiveBrowser.tsx` | the hand-rolled unmark-confirm sheet |
| `show/CometTrail.tsx` | the hand-rolled full-setlist sheet |

The `Sheet.tsx` site carries the D-07 rationale: sheet padding is deliberately **not**
tab-bar-relative — a sheet *covers* the tab bar rather than sitting above it, so it composes
from `--gz-safe-bottom` and must never adopt `--gz-chrome-reserve`. A second line records that
the value is inherited from `document.documentElement`, which is why it survives the
`createPortal(…, document.body)` boundary (T-21-23). D-22 holds: the two hand-rolled sheets stay
hand-rolled, they just stop forking the arithmetic.

**The two remaining non-tab-relative surfaces.** `RecapView`'s footer became
`calc(var(--gz-safe-bottom) + 16px)` and `NodeSheet`'s gutter became `var(--gz-safe-bottom)`.
Both are byte-equivalent to what shipped. The RecapView comment records why it keeps its own
16px rather than adopting `--gz-sheet-pad-bottom`: it is a full-screen opaque **page** footer at
`z.page`, not a modal sheet. NodeSheet's `aria-modal={false}`, `touchAction`, `height`,
`transition` and `zIndex` are untouched — D-26 carries the non-modal exemption and plan 21-12
owns its portal question.

Every conversion above was value-preserving. All five are inside `fixed`/`absolute` overlays
(21-RESEARCH Group B), so none of them ever double-counted the inset the way `<main>` did —
this was a single-ownership change, not a layout fix.

## The Two Audits

**`MapView` (D-08) — audited, NOT converted.** Verified from source, all three conditions hold:

1. The strip is `absolute bottom-0`, not `fixed` — it is not viewport-anchored.
2. It is a **sibling** of the transformed pan/zoom stage (`transform: translate(…) scale(…)` at
   line ~213), not a descendant. Both are children of MapView's `relative h-full` root, so no
   transform ancestor is in play — the D-28 failure mode where a transform ancestor silently
   re-bases a `fixed` descendant cannot occur here.
3. That root is `<main>`'s child, and `<main>` already reserves `--gz-chrome-reserve`
   (`#/map` mounts with `scroll={false}`, per `App.tsx:109` and `AppShell.tsx:86-88`).

So `bottom-0` on this strip is the bottom of the already-reserved content box: it holds no inset
and has nothing to own. The code is unchanged and a comment records the outcome, the reasoning
and the decision ID. The plan's conditional branch (convert to `bottom: var(--gz-chrome-reserve)`
if the audit contradicted the assumption) **was not taken** — the audit confirmed the assumption.

**`BingoPeekStrip` (D-10) — comment-only, zero code change.** ROADMAP's FOUND-02 criterion names
the "peek strip" among the surfaces to unify; D-10 records that as an overreach. The strip is
in-flow in the show column and never `fixed` (its own header doc's first sentence already said
so), and its expanded panel is absolutely positioned inside its own `relative` container on the
`z.peek` tier — there is no bottom offset to unify and nothing to compose from the owner. That
finding now lives in the component's header doc, so the milestone audit reads an executed
artifact rather than a planning doc (T-21-26). `git diff` on this file is comment lines only: no
JSX, class, style, `role="link"` shape, `min-h-11` zone or `z.peek` panel was touched.

## Verification

- `npx vitest run` — **130 files / 1054 tests passing**, up from the 1052 baseline plan 21-07
  left, by exactly the two cases added here. No pre-existing test changed behavior.
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds (run after both conversion tasks).
- `grep -c 'calc(env(safe-area-inset-bottom) + 32px)' packages/app/src` → **0**.
- `grep -c 'env(safe-area-inset-bottom)' RecapView.tsx NodeSheet.tsx` → **0** for both.
- `grep -rn 'env(safe-area-inset-bottom)' packages/app/src` now returns exactly what the plan's
  verification predicted: `styles.css` (the one legitimate `:root` declaration), the toast family
  plan 21-10 owns (`BackupToast`, `InstallBanner`, `UpdateToast`, plus a `BingoCelebration`
  comment), `dev/LayoutProbe` (the harness, deliberately raw), and `ExploreFilterFab` /
  `fabLayout` — which belong to **plan 21-08**, executing in parallel, and were not touched.
- `git diff packages/app/test/sheet.a11y.test.tsx` — **additions only** (30 added, 0 removed);
  the 8 shipped a11y cases are byte-identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Both tasks' `<verify>` commands cannot run as written**

- **Found during:** Task 1 (recurred in Tasks 2 and 3)
- **Issue:** The plan specifies `cd packages/app && npx vitest run --project @guezzer/app …`.
  Vitest's projects are declared only in the **root** `vitest.config.ts`, so from
  `packages/app` the run fails with `No projects matched the filter "@guezzer/app"`. Dropping
  the filter is worse, not better: it runs against `packages/app/vite.config.ts` with no
  `environment: "jsdom"` and no setup file, so all 25 cases fail with
  `ReferenceError: document is not defined` — a false failure that looks like a real one.
- **Fix:** Ran every verification from the repo root (`npx vitest run --project @guezzer/app
  <name-filters>`), which is the invocation the root config is built for. Test-command
  correction only; no source or config file was changed.
- **Files modified:** none
- **Commit:** n/a (affects how the tasks were verified, not what they produced)

### Acceptance Criteria Notes

- **The plan's stated baseline of "954 tests / 125 files" is stale.** The real baseline on this
  plan's base commit is **1052 tests / 130 files** — plan 21-07 recorded that same number and
  added 26 cases of its own after the 954 figure was written. Criterion 3 of Task 3 ("`npm test`
  passes with no new failures against the 954-test baseline") is met in substance: zero new
  failures, and the count moved 1052 → 1054 by exactly the two cases this plan adds.

### Environment Note

The orchestrator's prompt gave the expected base as `1ef66c26`; the actual commit is
`1ef66c228a31bb6ed353dfb5177ff1d4ccdb6602`, whose short form is `1ef66c2` — the prompt's
8-character form is a mis-truncation (`git rev-parse 1ef66c26` errors as an unknown revision).
The worktree did spawn stale, at `f29edca`, exactly as the known issue predicts; `git reset
--hard` to the real base was performed and verified by full hash before any work began.

## Threat Model Notes

- **T-21-23 (mitigated):** the padding value is inherited from `document.documentElement`, where
  plan 21-07 writes the ladder — the one ancestor a `document.body` portal still shares. The new
  `sheet.a11y` case renders a real portaled sheet and asserts the var is present on the dialog's
  style attribute, so a regression to a `#root` target would surface here.
- **T-21-24 (accepted, as planned):** MapView's strip audited and left unconverted; the audit
  confirmed the disposition's premise rather than contradicting it, so the conditional conversion
  branch was not taken.
- **T-21-25 (mitigated):** the `Sheet.tsx` diff is one style value plus comments — `createPortal`,
  `useFocusTrap`, `useDialogDismiss`, `dialogProps`, both `zIndex` expressions and both
  early-return guards are unchanged, and all 8 shipped a11y cases pass unmodified.
- **T-21-SC (mitigated):** zero packages added, removed or upgraded; `package.json` untouched.

## Known Stubs

None. Every value the five converted surfaces render resolves to the owner's composition, and the
two unconverted surfaces are documented no-ops by design rather than deferred work.

## Self-Check: PASSED

All claimed files exist on disk; all four commit hashes resolve in `git log`. `git diff
--diff-filter=D 1ef66c2..HEAD` is empty (no file was deleted), the working tree is clean, and the
full diffstat touches exactly the nine files in this plan's `files_modified` list plus the
summary.

## Notes for the Orchestrator

Ran as a parallel worktree agent on `worktree-agent-a58db9d30fa36b0f8`; three task commits plus
this summary. `STATE.md` and `ROADMAP.md` were deliberately not touched. No file outside this
plan's `files_modified` list was modified — in particular `FabMenu.tsx`, `OrbitStage.tsx`,
`ShowView.tsx`, `fabLayout.ts` and `ExploreFilterFab.tsx` (plan 21-08's) are untouched, so the
two branches should merge without conflict.
