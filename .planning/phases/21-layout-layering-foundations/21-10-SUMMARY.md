---
phase: 21-layout-layering-foundations
plan: 10
subsystem: layout
tags: [toasts, overlays, found-02, d-09, d-12, source-guard, safe-area]
requires:
  - phase: 21-layout-layering-foundations
    plan: 07
    provides: "--gz-chrome-reserve on document.documentElement — the value all five overlays now pin to"
  - phase: 21-layout-layering-foundations
    plan: 08
    provides: "the FAB group already converted, plus the recorded RESTING_BOTTOM_PX survivor the D-12 guard had to decide about"
  - phase: 21-layout-layering-foundations
    plan: 09
    provides: "the sheet family already converted, plus the MapView / BingoPeekStrip audit exemptions the guard must not flag"
provides:
  - "all five bottom overlays pinned to var(--gz-chrome-reserve) — no bottom-16 survives in production source"
  - "the three redundant safe-area self-paddings deleted, correcting the overlay-height measurement by one inset"
  - "the D-12 single-owner source guard in test/bottomSpace.test.ts, with five self-tests proving it can fail"
  - "the ExploreFilterFab RESTING_BOTTOM_PX exemption promoted from a planning note to an allowlist assertion"
  - "the deferred simultaneous-overlay-stacking case captured as a todo"
affects:
  - "plan 21-11 (owns the layering work — every zIndex expression here was left exactly as shipped)"
  - "plan 21-13 (UAT test 2 must confirm the one-inset reserve SHRINK covers nothing)"
  - "any future contributor who hand-writes a tab-bar height — the guard now names the owner file in its failure message"
tech-stack:
  added: []
  patterns:
    - "A source guard that strips comments before matching, and states that discipline in its own doc comment"
    - "A known-unmatched literal recorded as a named allowlist assertion rather than left as a silent miss"
    - "Guard self-tests that prove the guard can fail, so it cannot rot into a vacuous pass"
    - "The `bottom` change and the compensating-padding deletion treated as ONE atomic edit per file"
key-files:
  created:
    - .planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md
  modified:
    - packages/app/src/components/InstallBanner.tsx
    - packages/app/src/components/UpdateToast.tsx
    - packages/app/src/components/BackupToast.tsx
    - packages/app/src/components/BingoCelebration.tsx
    - packages/app/src/components/WaveToast.tsx
    - packages/app/src/pwa/bottomOverlayInset.ts
    - packages/app/test/bottomSpace.test.ts
    - packages/app/test/bottomOverlayInset.test.tsx
decisions:
  - "The D-12 guard ALLOWLISTS ExploreFilterFab's RESTING_BOTTOM_PX by name (a bare-64 scan pinned to exactly that one site) rather than silently missing it or forcing a behavior change 21-08 argued against"
  - "The guard scans code only; the deletion-site comments were reworded to avoid the forbidden tokens verbatim, so a NAIVE grep also returns one owner — which is FOUND-02's literal wording"
  - "styles.css is asserted directly inside the guard block rather than blind-skipped, so the one legitimate env() read is positively pinned"
  - "The three toasts' bottom change and paddingBottom deletion shipped as one edit per file — doing only the first would have opened ~34px of dead space inside each"
requirements-completed: [FOUND-02]
metrics:
  duration: ~20 min
  completed: 2026-07-25
  tasks: 3
  commits: 3
  tests_before: 1058
  tests_after: 1073
---

# Phase 21 Plan 10: Bottom Overlays + the D-12 Single-Owner Guard Summary

The last five surfaces that hand-wrote the tab-bar height now pin to the owner's
`--gz-chrome-reserve`, the three compensating safe-area paddings that made the overlay
store over-reserve are gone, and FOUND-02's "a search returns exactly one owner" is now a
test that fails on the offending file and line rather than a claim in a doc.

## What Changed

**The five overlays (D-09).** `InstallBanner`, `UpdateToast`, `BackupToast`,
`BingoCelebration`'s bottom toast and `WaveToast` all dropped the Tailwind `bottom-16`
class for `bottom: "var(--gz-chrome-reserve)"` in their existing inline `style` object.
`fixed inset-x-0`, every other class, the `motion-safe:transition-*` classes,
`pointer-events-none` where present, and **every `zIndex` expression** are untouched —
plan 21-11 owns the layering work.

The defect this fixes: `bottom-16` is a flat 64px from the **viewport**, and a `fixed` box
ignores body padding. The tab bar is `64px + env(safe-area-inset-bottom)` tall. So on an
installed instance every one of these boxes started one safe-area inset *below* the top of
the bar — overlapping its buttons.

**The three redundant paddings, deleted in the same edits.** RESEARCH Pitfall 2 is the
reason this was atomic rather than two passes. `InstallBanner`, `UpdateToast` and
`BackupToast` each set `paddingBottom: env(safe-area-inset-bottom)`, which is precisely
the compensation for sitting one inset too low — it pushed their *content* clear of the
bar even though their *box* overlapped it. Against the chrome reserve that padding is
double-counting: keeping it would have opened ~34px of dead space **inside** each toast on
an installed instance, a brand-new gap in the phase whose point is removing one. Each
deletion site carries a comment recording why the padding existed and why it now
double-counts.

**The reserve direction, stated deliberately.** `useBottomOverlayHeightRegistration`
measures `el.offsetHeight`, so those three toasts were registering one safe-area inset
*more* than they occupied. Deleting the padding makes the measurement honest, which means:

> **`--gz-overlay-inset` — and therefore the content reserve on scrolling routes — gets
> SMALLER by one inset while one of those three toasts is visible.**

That is the correction, not a regression. But under-reserving is the failure mode that
covers a control, so the direction is recorded in `bottomOverlayInset.ts`, in the new test
block's doc comment, and here — and is explicitly re-checked on an installed instance in
**21-13 UAT test 2** rather than trusted from arithmetic.

**`BingoCelebration`'s comment was rewritten, not deleted.** The old rationale ("adding
the padding only made the bottom padding smaller than `py-4`'s top — the text read as cut
off") was a Safari-tab-only observation: in a tab the inset is 0, so the padding replaced
`py-4`'s 16px with 0. Installed, the inset is ~34 > 16 and the reasoning inverts. The new
comment states the mechanism instead — the overlay composes from the reserve, so it clears
the bar in both contexts and needs no self-padding at all — and says explicitly that it
supersedes a tab-only observation, so nobody re-derives the old conclusion.

**`pwa/bottomOverlayInset.ts` is a comment-only diff** (verified: every `+`/`-` line
outside the doc block is empty). It now describes the overlay family as composing from the
owner and records the one-inset measurement correction.

## The D-12 Guard

A `describe("FOUND-02 single-owner guard (D-12)")` block in
`packages/app/test/bottomSpace.test.ts` walks `src/` for `.ts`/`.tsx`/`.css`, strips
comments, and fails on `bottom-16`, `inset-y-16`, `h-16`, `bottom-[`, `4rem`, `64px` or a
bottom-anchored `env()`. The failure message names the file, the line and the matched
token, and points at `packages/app/src/layout/bottomSpace.ts` — the entire value of the
guard is that the next contributor immediately knows where the value belongs.

Three hazards, three answers:

| Hazard (21-RESEARCH) | Answer |
|---|---|
| The literal is `bottom-16`, not `4rem` — a unit-only guard passes while all five are broken | `bottom-16` / `inset-y-16` / `h-16` / `bottom-[` are in the pattern set, and each has a self-test |
| `pb-16` / `pt-16` are legitimate at twelve sites | Patterns anchored on `bottom`/`h`, never a loose `-16\b`; two self-tests assert `pb-16` and `pt-16` pass |
| Comments name the numbers in prose at seven sites | Comments stripped before matching, line numbers preserved; the discipline is stated in the block's doc comment because a guard that doesn't say which it enforces fails confusingly |

**Exemptions, each with a written reason:** `layout/bottomSpace.ts` (composition owner),
`config.ts` (numeric owner), `styles.css` (asserted directly rather than skipped — exactly
one raw bottom `env()`, inside `:root`), and `src/dev/**` (the URL-flag-gated harnesses;
`layerRepro` deliberately clones the pre-conversion geometry and `LayoutProbe` must read
the raw inset to report it). The exemption *set itself* is pinned by an assertion, so a
future "just add my file to the skip list" shows up as a diff rather than quiet erosion.

**Anti-vacuity (T-21-29).** Five self-tests prove the guard can fail: comment stripping
(including that `://` survives and line count is preserved), `bottom-16` matching while
`pb-16`/`pt-16` do not, `env(safe-area-inset-top/left/right)` not tripping while
`env( safe-area-inset-bottom )` does, every remaining forbidden form reported with its line
number, and the failure message's contents. A sixth asserts the walk actually collected
>100 files. Beyond the self-tests the guard was verified **against the real tree**: injecting
`const __guardProbe = "fixed bottom-16";` into `WaveToast.tsx` produced
`packages/app/src/components/WaveToast.tsx:197 — bottom-16` and failed the suite; the
injection was reverted with a file-scoped `git checkout --`.

### The `RESTING_BOTTOM_PX` survivor — allowlisted, not missed

Plan 21-08 deliberately left `const RESTING_BOTTOM_PX = 64 + 8` in `ExploreFilterFab.tsx`;
the split literal evades every pattern above. Per the orchestrator's instruction the
**preferred** option was taken — an explicit, recorded exemption. A dedicated test scans
every non-exempt file for a bare `64` and asserts the set of sites is exactly
`["explore/ExploreFilterFab.tsx"]`. So the known survivor is documented in the test itself
with 21-08's reasoning (it feeds only the A11Y-02 lift math, `var()` doesn't resolve to a
number in JS, and `TAB_BAR_HEIGHT_REM * 16` would bake in the rem→px assumption D-04 chose
`rem` to avoid), **and** a second bare mirror appearing anywhere fails the test.
`ExploreFilterFab`'s behavior was not changed.

The 21-09 audit exemptions are unaffected: `MapView`'s status-chip strip uses `bottom-0`
and `BingoPeekStrip` has no bottom offset at all, so neither contains a forbidden token
and neither needed an exemption entry.

## Deviations from Plan

### 1. [Plan defect — corrected] Every `<verify>` command in this plan cannot run as written

- **Found during:** Task 1 (applies to all three tasks)
- **Issue:** The plan specifies `cd packages/app && npx vitest run --project @guezzer/app …`.
  Vitest's projects are declared only in the **root** `vitest.config.ts`, so from
  `packages/app` this fails with `No projects matched the filter "@guezzer/app"`. Dropping
  the filter is worse — it runs without `environment: "jsdom"` and produces a wave of false
  `document is not defined` failures that look real. Plan 21-09 hit the identical defect.
- **Fix:** Every verification was run from the repo root (`npx vitest run <paths>`). Test
  invocation only; no source or config file changed.
- **Commit:** n/a (affects how tasks were verified, not what they produced)

### 2. [Rule 2 — correctness] Deletion-site comments reworded to satisfy the acceptance greps

- **Found during:** Task 1
- **Issue:** The plan's action requires a comment at each deletion site explaining the old
  geometry, while its acceptance criteria require `grep -rc 'bottom-16' packages/app/src`
  → 0 outside `src/dev/` and `grep -c 'env(safe-area-inset-bottom)'` → 0 for the three
  toasts. Written naturally, those comments quote the exact tokens and both greps fail.
- **Fix:** The comments were kept in full but reworded to describe the mechanism without
  the literals — "a Tailwind bottom utility hard-coding the tab bar's NOMINAL height,
  measured from the viewport" and "a raw safe-area bottom read". This is not pure
  grep-appeasement: FOUND-02's wording is *"a search for the tab-bar height returns exactly
  one owner"*, and a naive `grep bottom-16` returning five prose hits would read as five
  unconverted surfaces. The guard strips comments anyway, so this is belt-and-braces.
- **Files modified:** all five overlays plus `pwa/bottomOverlayInset.ts`
- **Commit:** `6154e11`

### Acceptance-Criteria Notes

- **`grep -c 'dist' packages/app/test/bottomSpace.test.ts` cannot return 0.** The file
  already contained two `dist` substrings before this plan: 21-07's header line "the two
  deliberately **dist**inct reserves" and its comment `// Source read, never \`dist\` — a
  stale committed bundle is on disk`. The second says exactly the right thing and deleting
  it to satisfy a grep would be strictly worse. The criterion's **intent** is met more
  strongly than the grep could: the walk is rooted at `join(testDir, "..", "src")`, and a
  dedicated test asserts no scanned path contains a `dist` or `build` segment. (`dist/` is
  not tracked by git in this repo, but it does exist on disk after `npm run build`.)
- **The plan's "954-test baseline" is stale**, as it was for 21-08 and 21-09. The real
  baseline at this plan's base (`b399683`) is **130 files / 1058 tests**. Criterion met in
  substance: zero new failures, 1058 → 1073 by exactly the 15 cases added here.
- **`grep -rn 'bottom-16\|4rem\|64px' packages/app/src` returns matches only under
  `src/dev/` and in `styles.css` comments** — the latter being 21-07's FOUND-01 derivation,
  which is load-bearing traceability for the body-padding deletion and was left intact. The
  plan's verification predicted `src/dev/`, `config.ts` and `layout/bottomSpace.ts`; the
  latter two turned out to have **zero** hits (they hold `TAB_BAR_HEIGHT_REM: 4` and
  `${n}rem`), and `styles.css` takes their place. Both files are guard-exempt regardless.

## Verification

- `npx vitest run` (repo root) — **130 files / 1073 tests passing**, up from the 1058
  baseline by exactly the 15 cases added (11 guard + self-tests, 4 D-03). No pre-existing
  test was left failing or modified in behavior.
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds.
- `grep -rn 'bottom-16' packages/app/src` outside `src/dev/` → **0**.
- `grep -c 'env(safe-area-inset-bottom)'` → **0** for `InstallBanner.tsx`,
  `UpdateToast.tsx` and `BackupToast.tsx`, comments included.
- All five overlays contain `bottom: "var(--gz-chrome-reserve)"`; `git diff` on
  `pwa/bottomOverlayInset.ts` is comment lines only (verified by filtering the `-U0` diff).
- Guard proven to fail on the real tree by temporary injection (see above), reverted with a
  file-scoped `git checkout --`. `git diff --diff-filter=D HEAD~3 HEAD` is empty — no file
  was deleted.

## Threat Model Notes

- **T-21-26 (mitigated):** the one-inset overlap that made tab buttons partially
  untappable behind an overlay is gone on all five. Device confirmation owed to 21-13 UAT
  test 2. The FOUND-02 milestone audit now reads an executed artifact (the guard) rather
  than a planning doc.
- **T-21-27 (mitigated, direction flagged):** the reserve shrinks by one inset while a
  padded toast is visible. Recorded in three places in-repo and explicitly queued for
  device re-check, because an under-reserve covers a control.
- **T-21-28 (mitigated):** the walk is rooted at `src`; a test asserts no scanned path has
  a `dist`/`build` segment.
- **T-21-29 (mitigated):** five self-tests plus a >100-file anti-vacuity assertion, plus a
  real-tree injection that was observed to fail with file, line and token.
- **T-21-SC (mitigated):** zero packages added, removed or upgraded; `package.json`
  untouched.

## Known Stubs

None. Every value the five overlays render resolves to the owner's composition.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema changed — this plan
moved CSS offsets and added a filesystem-reading test that only reads the repo's own
`src/` tree.

## Self-Check: PASSED

- `.planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md` — FOUND
- All eight modified source/test files — FOUND
- `6154e11`, `9a3db60`, `3a4d04c` — all resolve in `git log`

## Notes for the Orchestrator

Ran in the **main checkout on `master`** (`.git` is a directory), already at the expected
base `b399683` — no reset performed, worktree-only commit guards did not apply.
`packages/app/src/layout/bottomSpace.ts` was confirmed present with `--gz-chrome-reserve`
before any work began. The three task commits are directly on `master`; there is no branch
to merge. `STATE.md` and `ROADMAP.md` were deliberately not touched.

One item is owed to plan 21-13 beyond the UAT test already scheduled: the reserve
**shrank** by one inset on scrolling routes when a padded toast is visible. If UAT test 2
finds anything covered, the fix is in this plan's territory, not 21-11's.
