---
phase: 21-layout-layering-foundations
plan: 01
subsystem: app-dev-harnesses
tags: [diagnostics, url-flag, safe-area, stacking-context, device-uat]
requires: []
provides:
  - "?layerRepro=1 URL flag + LayerReproToast (FOUND-03 repro, D-29)"
  - "?layoutProbe=1 URL flag + LayoutProbe readout + readSafeAreaInsets (FOUND-01 diagnosis, D-14)"
  - "21-HUMAN-UAT.md with all 8 manual-only verifications scaffolded"
affects:
  - "plan 21-07 (gated on 21-HUMAN-UAT test 1 BEFORE numbers)"
  - "plan 21-11 (gated on 21-HUMAN-UAT test 7 repro naming the offending surface)"
  - "plan 21-10 (D-12 bottom-space source guard must exclude src/dev/** by name)"
tech-stack:
  added: []
  patterns:
    - "URL-flag dev harness: typeof location guard → URLSearchParams → exact === \"1\" equality (mockLatest.ts idiom)"
    - "env() read via detached probe element + getComputedStyle (21-RESEARCH §Measuring on device)"
    - "useMemo([]) flag caching in App.tsx — a URL flag cannot change without a reload"
key-files:
  created:
    - packages/app/src/dev/layerRepro.tsx
    - packages/app/src/dev/LayoutProbe.tsx
    - packages/app/test/layerRepro.test.tsx
    - .planning/phases/21-layout-layering-foundations/21-HUMAN-UAT.md
  modified:
    - packages/app/src/App.tsx
decisions:
  - "Both flags cached via useMemo([]) in App.tsx rather than module scope — avoids import-time evaluation freezing the value for any future test that renders <App/>"
  - "LayoutProbe is top-anchored (never bottom) so it cannot occlude the very gap being photographed"
  - "The layerRepro band is deliberately NOT pointer-events-none — tap-eating is half the FOUND-03 defect (D-27)"
  - "Task-1 test file created in Task 1 (plan assigned it to Task 2) so Task 1's own verify command could run"
metrics:
  duration: ~35 min
  completed: 2026-07-25
  tasks: 3
  commits: 3
  tests_added: 18
---

# Phase 21 Plan 01: Diagnostic Harnesses & Device-Test Scaffold Summary

Two inert-unless-explicit URL-flag dev harnesses — `?layerRepro=1` reproduces the FOUND-03
stacking-context defect in a desktop browser, `?layoutProbe=1` prints every number the FOUND-01
installed-PWA gap diagnosis needs as one screenshottable readout — plus `21-HUMAN-UAT.md` carrying
all 8 manual-only verifications with D-15's three-branch decision tree written down before the
device pass.

## What Was Built

### Task 1 — `?layerRepro=1` (commit `ef49e7e`)

`packages/app/src/dev/layerRepro.tsx` exports `isLayerReproEnabled()` and `LayerReproToast`.

The gate copies `mockLatest.ts:97-101` exactly: `typeof location === "undefined"` guard on the line
immediately before the `new URLSearchParams(location.search).get("layerRepro")` read, then
`flag === "1"` exact-value equality — never truthiness, never a regex over `location.search`.

`LayerReproToast` renders a persistent, non-dismissable band with the shipped toast geometry
(`fixed inset-x-0 bottom-16 flex items-center border-t border-hairline bg-elevated px-4 py-4`) and
`style={{ zIndex: config.ui.z.toast }}` — inline style, never a Tailwind `z-*` class, so `config.ts`
§`ui.z` stays the one source. Its text is a fixed literal (`layerRepro: toast tier {config.ui.z.toast}`);
no query-string content is ever rendered. It is deliberately **not** `pointer-events-none`: the band
must be able to eat taps from surfaces nested inside the `content: 10` stacking context, which is the
FabMenu half of the defect (D-27) and the part that would hit the live-logging loop mid-show.

`App.tsx` renders it as a sibling of `AppShell`, immediately after `<WaveToast />`, so it lands in
the root stacking context exactly as the real toasts do.

The header comment records — for the plan-21-10 D-12 guard author — that `src/dev/**` is excluded
from the bottom-space source guard by name (as `dev/OrbFitHarness.tsx` is already the one permitted
Tailwind `z-*` site), and that the `bottom-16` literal must NOT be rewritten to the chrome reserve:
the band imitates the shipped geometry on purpose, so the exclusion is deliberate, not an oversight.

### Task 2 — `?layoutProbe=1` (commit `6d3e346`)

`packages/app/src/dev/LayoutProbe.tsx` exports `isLayoutProbeEnabled()`, `readSafeAreaInsets()` and
`LayoutProbe`.

`readSafeAreaInsets()` uses the probe-element technique from 21-RESEARCH §Measuring on device: a
detached hidden `div` gets the four `env(safe-area-inset-*)` strings as padding, is appended to
`document.body`, its resolved padding is read back through `getComputedStyle`, and the element is
removed. Guarded by `typeof document === "undefined"` returning zeroes; every `parseFloat` collapses
a non-finite result to `0`, so under jsdom (where `env()` never resolves) all four honestly read `0`
— which is also exactly what a desktop Safari **tab** reports, and precisely why FOUND-01 is
invisible outside an installed instance.

`LayoutProbe` renders a top-anchored (`fixed left-0 right-0 top-0`) selectable `font-mono`
`text-[11px]` overlay at `zIndex: config.ui.z.sheet`, `bg-surface/95`, `userSelect: text`,
`pointerEvents: auto`, capped at `max-h-[60vh]` with scroll so the long UA string never pushes the
numbers off-screen. Top-anchored on purpose: the bottom gap is what gets photographed, so the readout
must never occlude it.

Fields, in order: `sab` / `sat` / `sal` / `sar`; `standalone` (printed as two separate booleans —
`nav=` for iOS's legacy `navigator.standalone`, `mq=` for Android Chrome's
`matchMedia("(display-mode: standalone)")`); `innerH`; `clientH`; `vvH`; `htmlH` / `bodyH` / `rootH`
/ `mainH`; **`bodyH-rootH`** (D-15's single falsifiable equality); `mainBottom`; `tabTop`;
**`>>> GAP`** (`tabTop - mainBottom`, prefixed and accent-coloured so a screenshot cannot miss it);
`dpr`; `htmlFont`; `orient`; `ua`.

Every DOM lookup tolerates a missing element and renders `n/a` rather than throwing. It recomputes on
mount, `resize`, `orientationchange` and `visualViewport` `resize`, with all three listeners removed
on unmount.

`packages/app/test/layerRepro.test.tsx` (18 tests) locks the inert-unless-explicit contract for both
gates — absent query string, `=0`, `=true`, and a bare valueless flag all return `false`; only `=1`
returns `true`; neither flag cross-enables the other — plus `readSafeAreaInsets()` returning four
finite numbers, leaving no probe element behind, and `LayoutProbe` rendering `n/a` (never `NaN`,
never a throw) with no `<main>`/`<nav>`/`#root` present, then real arithmetic when they are.

### Task 3 — `21-HUMAN-UAT.md` (commit `5cff016`)

All 8 rows from `21-VALIDATION.md` §Manual-Only Verifications carried as `### N. Title (REQ-ID)`
entries in the Phase-10 format: bare `expected: |` / `result: |` block scalars (no fenced wrappers
anywhere in the file), every result `PENDING`, `status: pending`.

Test 1 carries the full decision tree so the device operator does not have to re-derive it:
**CONFIRMATION BRANCH** (`bodyH-rootH === sab` and `GAP === sab` ⇒ D-15 confirmed, proceed with
21-07's removal of `styles.css:220`), **FALSIFICATION BRANCH** (`GAP === 0` ⇒ D-19 applies, the
measurement *is* the evidence and no code change is required to close FOUND-01), and a second
falsification form (`GAP != sab` and `GAP != 0` ⇒ fall back to the D-14 open investigation, with the
explicit "do not reintroduce `100vh`/`min-h-screen`, do not reach for `dvh`" warnings).

`## Current Test` names tests 1-BEFORE and 7 as the open items gating plans 21-07 and 21-11.
`## Harness` records build → `vite preview` → cloudflared with the **mandatory**
`--http-host-header localhost` flag (MEMORY `device-uat-hosting`), the prompt-to-update SW caveat for
AFTER measurements, and a sub-section for test 6 covering how to serve two builds at once (second
worktree at the pre-rename commit, second port, second tunnel, two identities).

## Verification

| Check | Result |
|---|---|
| `npx vitest run --project @guezzer/app test/layerRepro.test.tsx` | 18/18 pass |
| `npm test` | 126 files / **972 tests** green (baseline 125 / 954 — +1 file, +18 tests, no regressions) |
| `npm run build --workspace packages/app` | succeeds (40 precache entries) |
| `npx tsc --noEmit -p packages/app/tsconfig.json` | clean |
| `grep -c 'z-\[' src/dev/layerRepro.tsx` | 0 |
| `grep -n 'zIndex' src/dev/layerRepro.tsx` | `config.ui.z.toast` |
| `grep -c 'GAP' src/dev/LayoutProbe.tsx` | 3 (≥ 1 required) |
| `App.tsx` contains both gate calls | lines 58–59 |
| `grep -c '^### [1-8]\.' 21-HUMAN-UAT.md` | 8 |
| `grep -c 'expected: \|' / 'result: \|'` | 8 / 8 |
| `grep -c '```' 21-HUMAN-UAT.md` | 0 (no fenced blocks at all) |
| `grep -c '## Current Test' / '## Harness'` | 1 / 1 |
| `grep -c 'http-host-header localhost'` | 4 |

Both flags are proven inert on a normal load by automated test, so a no-query-string load renders
neither harness and behaves exactly as it did before this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `test/layerRepro.test.tsx` created in Task 1 instead of Task 2**
- **Found during:** Task 1
- **Issue:** Task 1's `<verify>` block runs `npx vitest run --project @guezzer/app test/layerRepro.test.tsx`, but the plan assigns creation of that file to Task 2 — so Task 1 could not be verified or committed as an atomic unit.
- **Fix:** Created the `isLayerReproEnabled` half of the test in Task 1 (6 tests); Task 2 extended it to both gates plus the probe (18 tests total), exactly as the plan's Task 2 wording ("Extend `packages/app/test/layerRepro.test.tsx`") describes.
- **Files modified:** `packages/app/test/layerRepro.test.tsx`
- **Commits:** `ef49e7e` (create), `6d3e346` (extend)

**2. [Rule 1 - Bug] Explicit RTL `cleanup()` in the test file**
- **Found during:** Task 2
- **Issue:** Two `LayoutProbe` render tests failed with "Found multiple elements with the text: rootH: n/a". The root vitest config does not set `globals: true`, so React Testing Library's auto-cleanup never registers and renders accumulate across tests in the file.
- **Fix:** `afterEach(() => { cleanup(); … })`, matching the shipped `archiveBrowser.test.tsx:77` / `authGate.test.tsx:68` precedent, with a comment recording why.
- **Files modified:** `packages/app/test/layerRepro.test.tsx`
- **Commit:** `6d3e346`

**3. [Rule 2 - Robustness] `document` accessed via a `typeof`-guarded local, not optional chaining**
- **Found during:** Task 2
- **Issue:** `document?.getElementById(…)` still throws a `ReferenceError` if `document` is undeclared (a non-DOM environment) — optional chaining only guards `null`/`undefined` values, not undeclared identifiers. The plan requires the probe never throw.
- **Fix:** One `const doc = typeof document === "undefined" ? null : document;` feeding every subsequent lookup.
- **Files modified:** `packages/app/src/dev/LayoutProbe.tsx`
- **Commit:** `6d3e346`

### Interpretation Notes (not deviations)

- **`GAP` field ordering.** The plan says `GAP` is "rendered last and prefixed so it is unmissable",
  but its own field list places `dpr` / `htmlFont` / `orient` / `ua` after it. Resolved by keeping the
  listed order (GAP last of the gap-arithmetic block, context fields after) and satisfying
  "unmissable" through presentation: `>>> GAP` prefix plus bold accent colour, shared only with
  `bodyH-rootH`.
- **Flag caching.** The plan allowed module-scope or `useMemo`. `useMemo(() => …, [])` inside `App`
  was chosen so no import-time evaluation freezes the value for any future test that renders `<App/>`.
  Both hooks sit above the `#/dev/orb-fit` early return, preserving the rules of hooks.
- **Band text interpolates `config.ui.z.toast`** rather than hardcoding the literal `20`, per the
  CLAUDE.md "no scattered magic numbers / single config file" rule. The interpolated value is
  config-derived, never query-derived, so T-21-02 still holds.

## Authentication Gates

None.

## Threat Model Compliance

| Threat | Disposition | How it was met |
|---|---|---|
| T-21-01 (EoP — URL flag) | mitigate | Both gates: `typeof location === "undefined"` guard, `URLSearchParams` (no regex), exact `=== "1"` equality. The flag toggles a boolean only. Locked by 11 gate assertions incl. `=true` and a bare valueless flag. |
| T-21-02 (Tampering — rendered query content) | mitigate | No query-string value is read into or rendered as output. `grep -c 'innerHTML\|dangerouslySetInnerHTML'` over both files returns 0. Rendered content is fixed literals, config numbers, and device-derived measurements only. |
| T-21-03 (Info disclosure — UA/geometry) | accept | `ua` and viewport geometry are printed, as designed and as already available to any script on the page; escaped React text, flag-gated, personal tool. |
| T-21-SC (Supply chain) | mitigate | Zero packages added, removed or upgraded. `package.json` and the lockfile are untouched in all three commits. |

## Known Stubs

None. Both harnesses are complete and functional; the `PENDING` results in `21-HUMAN-UAT.md` are the
intended un-run state of a device-test scaffold (`status: pending`), not stubbed code.

## Notes for Downstream Plans

- **Plan 21-07** must not remove `styles.css:220` until `21-HUMAN-UAT.md` test 1's BEFORE numbers are
  recorded and the CONFIRMATION branch is the one that fired.
- **Plan 21-10** (D-12 bottom-space source guard) must exclude `packages/app/src/dev/**` by name.
  `layerRepro.tsx` intentionally carries `bottom-16` (it imitates shipped toast geometry to reproduce
  the real stacking situation) and `LayoutProbe.tsx` intentionally carries all four literal
  `env(safe-area-inset-*)` strings (they are measurement inputs to the probe element, not layout).
  Both files' header comments record this so it is not later read as an oversight.
- **Plan 21-11** must name the offending surface from test 7's repro before portaling (D-20).

## Self-Check: PASSED
