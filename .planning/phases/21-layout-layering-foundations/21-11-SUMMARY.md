---
phase: 21-layout-layering-foundations
plan: 11
subsystem: layout
tags: [layering, z-index, stacking-context, portal, found-03, d-20, d-27, a11y]
requires:
  - phase: 21-layout-layering-foundations
    plan: 04
    provides: "21-HUMAN-UAT §7 — the repro that NAMED SearchSheet and FabMenu as the offending surfaces, promoting D-20 from hypothesis to evidence"
  - phase: 21-layout-layering-foundations
    plan: 10
    provides: "every zIndex expression left exactly as shipped, so this plan owned all of them; plus the D-12 source guard this plan's styles.css edit had to stay clear of"
  - phase: 21-layout-layering-foundations
    plan: 07
    provides: "the bottom-space ladder written onto document.documentElement — why var(--gz-fab-offset) still resolves inside a document.body portal"
  - phase: 21-layout-layering-foundations
    plan: 08
    provides: "the FabMenu structure (var(--gz-fab-offset) via showBottomFabOffset) this plan wrapped in a portal without touching"
provides:
  - "packages/app/test/layerOrder.test.tsx — the FOUND-03 structural invariant, ancestor-shaped, with exported createsStackingContext + ancestorsUpToBody for plan 21-12"
  - "SearchSheet portaled to document.body, still hand-rolled, with gesture suppression carried explicitly via a new .gesture-guard class"
  - "FabMenu's scrim AND speed-dial portaled together, so a toast can no longer eat a speed-dial tap mid-show"
  - "WR-01 (page < sheetScrim) and CR-01 (fabScrim < fab) locked by named assertions instead of prose"
  - "the .gesture-guard opt-in hook in styles.css for any future portaled show-mode surface"
affects:
  - "plan 21-12 (imports createsStackingContext / ancestorsUpToBody; adds the portal SOURCE-scan for the four already-root-level surfaces)"
  - "plan 21-13 (UAT: the ?layerRepro=1 band must no longer paint over the open SearchSheet or speed-dial; device test 8 owns the gesture-suppression check no unit test can make)"
  - "phase 22 (sheet-animation blast radius stays at 11 surfaces — SearchSheet deliberately NOT migrated onto <Sheet>)"
tech-stack:
  added: []
  patterns:
    - "An invariant asserted on the surface's OWN ROOT, so a primitive's intra-surface nesting (Sheet's scrim wrapping its own card) is not a false positive"
    - "A modal/non-modal split read off the aria-modal attribute already in the DOM rather than a hand-kept component list"
    - "A detector that states its own completeness boundary and names the one file that would break it"
    - "An escape assertion (surface is NOT inside the app content tree) as the generalizable companion to the ancestor walk"
key-files:
  created:
    - packages/app/test/layerOrder.test.tsx
  modified:
    - packages/app/src/show/SearchSheet.tsx
    - packages/app/src/show/FabMenu.tsx
    - packages/app/src/styles.css
decisions:
  - "The ancestor walk is asserted from each surface's OWN ROOT, not from its inner dialog — discovered by the <Sheet> negative control, whose portaled sheetScrim wrapper is a legitimate stacking-context ancestor of its own dialog card"
  - "Added a second, generalizable assertion form (expectEscapesContentTree) for the aria-modal sweep, because the ancestor walk needs per-surface knowledge of where the root sits and a DOM-driven sweep cannot have it"
  - "SearchSheet gets .gesture-guard as a deliberate SHOW-13 improvement, not a restored regression — it never had an .orbit-stage/.action-bar/.fab-menu ancestor"
  - "FabMenu portals BOTH roots in ONE createPortal so DOM order — and therefore the fabScrim < fab paint order — is preserved at the top level"
  - "No tier renumbered, no D-12 guard exemption added, no package added"
requirements-completed: [FOUND-03]
metrics:
  duration: ~15 min
  completed: 2026-07-25
  tasks: 3
  commits: 3
  tests_before: 1073
  tests_after: 1089
---

# Phase 21 Plan 11: The FOUND-03 Layer-Order Invariant + the Two Portal Fixes Summary

The nesting defect D-20 named is fixed structurally: `SearchSheet` and `FabMenu` now portal to
`document.body`, no z-index number changed anywhere, and an ancestor-shaped test that was
demonstrably RED against the live defect now holds the line.

## What Changed

**The invariant (`packages/app/test/layerOrder.test.tsx`, 16 cases).** It encodes D-20's
conclusion directly: the tier numbers are consistent and the *nesting* is not, so every
assertion is ancestor-shaped rather than numeric. Two helpers are exported for plan 21-12:

- `createsStackingContext(el)` — inline-style detector covering non-`auto` `zIndex` on a
  positioned element, `transform`, `filter`, `backdropFilter`, `willChange:
  transform|opacity`, `opacity < 1` and `isolation: isolate`. The positioned test accepts
  **either** an inline `position` **or** a positioning class, because the real defect uses
  the mixed idiom — `ShowView.tsx:177-179` takes `position` from the `relative` class and
  `zIndex` from an inline style. A detector reading only `el.style.position` would return
  `false` on the exact element this plan exists to fix. Class matching is token-exact and
  variant-aware (`md:absolute` counts, `sticky-header` does not).
- `ancestorsUpToBody(el)` — walks `parentElement` to, and excluding, `document.body`.

The completeness caveat is stated in the file header rather than assumed: inline-only is a
*complete* detector **in this codebase specifically**, because `config.ts` mandates the
`style={{ zIndex: config.ui.z.X }}` idiom (Tailwind v4 resolves `z-[…]` at author time from
static strings, so a JS-config value cannot travel through a class), and the only `z-*`
utility in the repo is `z-10` in `src/dev/OrbFitHarness.tsx:147` — a dev-only `#/dev/orb-fit`
route. jsdom does not cascade the stylesheet, so class-derived computed styles are invisible
here; **there are none to miss today, and the moment someone adds one this test silently
loses coverage.** The header says exactly that.

Surfaces are rendered inside a byte-faithful reproduction of `ShowView.withBackground`
(D-24) — the outer positioned frame plus the inner `zIndex: config.ui.z.content` column.
Rendered in isolation the walk is vacuous and the test would pass while the app is broken.

**`SearchSheet` (D-21/D-22/D-23).** Now `createPortal(…, document.body)` with `Sheet.tsx`'s
`if (typeof document === "undefined") return null;` guard immediately before the return, and
the portal as the **return value** rather than an extra wrapper. `role`, `aria-modal`,
`aria-label`, `zIndex: config.ui.z.sheet`, `autoFocus` and every handler are byte-identical
— the non-comment diff is exactly five hunks: the `react-dom` import, the guard, the
`createPortal(` return, the `gesture-guard` class, and the `, document.body)` tail. It stays
**hand-rolled** per D-22: no `<Sheet>` migration, no focus-trap/dismiss hooks, so Phase 22's
sheet-animation blast radius remains 11 surfaces rather than 16
(`grep -c 'from "../components/Sheet' … ` → **0**).

**`FabMenu` (D-27).** Both roots — the `fab-scrim` and the speed-dial container — travel in
**one** `createPortal`, so the scrim keeps its DOM position immediately before the dial and
their `fabScrim: 25 < fab: 30` paint order is re-established at the top level rather than
inside a level-10 context. Both `className`s (already carrying `.fab-menu`), both `zIndex`
expressions, `bottom`/`right`, `data-strip-slot-reserved`, `data-testid="fab-scrim"`, the
`onClick` handlers and the `motion-safe:transition-[bottom]` classes are unchanged.
`fabMenu.test.tsx` passes **unmodified** — its testid/dataset queries are portal-agnostic.

A comment in the file records that this is a **layering** fix, not a positioning one: both
roots are already `position: fixed` and therefore viewport-anchored, so `var(--gz-fab-offset)`
resolves identically outside `#app-content` because plan 21-07 writes the ladder onto
`document.documentElement`, which `document.body` inherits from.

**`styles.css`.** The gesture-suppression selector list went from `.orbit-stage, .action-bar,
.fab-menu` to `… , .gesture-guard`, with a comment citing D-23 and SHOW-13 and stating why it
is class-scoped rather than global (the rest of the app still wants normal text selection and
scrolling). No forbidden bottom-space token was introduced, so the D-12 guard is untouched and
still passing.

## The Recorded RED (T-21-33)

Task 1's file was committed deliberately RED (`9a7521e`, 10 passed / 3 failed). The exact
failing cases, before any portal landed:

| Failing case | Offending ancestor reported |
|---|---|
| `SearchSheet, opened inside the ShowView content column` | `<div class="relative flex h-full min-h-0 flex-1 flex-col" style-zIndex="10">` |
| `FabMenu's scrim and speed-dial … (D-27)` | same ancestor, reported for the scrim |
| `holds for EVERY modal dialog in the DOM … (D-26)` | `modal dialog aria-label="Search the catalog": still rendered inside the app content tree` |

Everything else passed at that commit: the three detector self-tests, the two
`ancestorsUpToBody` walk tests, the `<Sheet>` negative control, the `NodeSheet` exemption and
both numeric guards. That contrast — same tiers, opposite outcome, the only difference being
the portal — is what proves the diagnosis is nesting rather than tier numbering.

## The D-23 Audit (all four items, with outcomes)

1. **Gesture suppression — improvement, not a restored regression.** `SearchSheet` never had
   an `.orbit-stage`, `.action-bar` or `.fab-menu` ancestor. Verified: those three classes
   appear at exactly three sites in `src/` — `OrbitStage.tsx:214` and `FabMenu.tsx:125,134`,
   both **siblings** of `SearchSheet` under `withBackground`, never ancestors. So the portal
   lost nothing here. The `gesture-guard` class is added anyway, deliberately: this is *the*
   one-thumb, in-the-dark surface (SHOW-13), and `touch-action: manipulation` /
   `overscroll-behavior: none` / `-webkit-touch-callout: none` belong on it on their own
   merits. Stated as an improvement rather than implying an averted regression, per the plan.
2. **Escape — nothing to lose.** `SearchSheet` has never handled Escape (`grep` for
   `Escape|keydown|keyDown|onKeyDown` in the file returns nothing, before and after). There is
   no tree-position-dependent handler to restore. Closing is the X button. `useDialogDismiss`
   was **not** introduced — that is `Sheet`'s machinery and D-22 keeps this surface
   hand-rolled. *(Worth noting for a future plan: no-Escape is a pre-existing gap, unrelated
   to this portal, and out of scope here.)*
3. **Focus — unchanged.** React applies `autoFocus` on mount regardless of portal target. The
   jsdom test asserts `document.activeElement` is the search input after opening inside the
   fixture, and it passes. Focus restore on close is unchanged: neither before nor after does
   this hand-rolled surface manage restore (again pre-existing, again out of scope).
4. **Inert — audited, no behavior change.** `App.tsx` wraps the app in `#app-content`
   (`display: contents`) and `Sheet.tsx`'s focus trap sets `inert` on it. After portaling,
   `SearchSheet` renders outside that wrapper, so a `<Sheet>`-driven `inert` would no longer
   reach it. **Is the combination reachable?** In Show Mode the sheets that use the `<Sheet>`
   primitive (`CatchUpSheet`, `EndShowDialog`, `ShareCardSheet`) are opened from FAB actions
   that each `setSearchOpen`-independent state, and `SearchSheet`'s own actions close it
   before firing (`onUnknown` calls `setSearchOpen(false)`); no code path opens a `<Sheet>`
   while `searchOpen` is true. So the combination is not reachable today. Recorded rather than
   fixed — adding inert management would be adopting `Sheet`'s machinery.

## Deviations from Plan

### 1. [Rule 1 — bug in the plan's assertion target] The ancestor walk must start at the surface's OWN ROOT

- **Found during:** Task 1, via the `<Sheet>` negative control the plan itself asked for.
- **Issue:** The plan says to "find the surface root (`screen.getByRole("dialog")` for
  sheets)" and walk from there. For the shared `<Sheet>` primitive that is wrong. `Sheet`
  portals a **scrim wrapper** (`className="fixed inset-0 …"`, `zIndex: sheetScrim` = 40) with
  the dialog card (`zIndex: sheet` = 50) nested **inside** it. So the card genuinely has a
  stacking-context ancestor — its own scrim — and the walk reported `<div class="fixed
  inset-0 flex flex-col justify-end bg-black/50" style-zIndex="40">` as an offender. That is
  a **false positive**: the pair is portaled together and competes at the top level as one
  unit. Left uncorrected, the plan's own designated negative control would have been
  permanently red, which would have forced either deleting the control (losing the proof that
  the cause is nesting) or weakening the detector (losing the RED on the real defect).
- **Fix:** `expectNoStackingAncestors(root, label)` now documents that `root` must be the
  outermost element the surface itself renders, and the `<Sheet>` case passes
  `dialog.parentElement` (asserting first that it carries `sheetScrim`, so the choice is
  pinned rather than assumed). What FOUND-03 forbids is a **foreign** stacking-context
  ancestor, i.e. one belonging to the app content tree — the correction sharpens the
  invariant rather than loosening it. `SearchSheet` (one top-level box) and both `FabMenu`
  roots (top-level siblings) are unaffected: their roots are exactly the nodes the plan named.
- **Files modified:** `packages/app/test/layerOrder.test.tsx`
- **Commit:** `9a7521e`

### 2. [Rule 2 — missing coverage] Added `expectEscapesContentTree` for the DOM-driven sweep

- **Found during:** Task 1, immediately following deviation 1.
- **Issue:** The `aria-modal` sweep (D-26) discovers dialogs from the DOM and therefore
  cannot know where each surface's own root sits — which is precisely what deviation 1
  established the ancestor walk needs. Applying the walk from each discovered dialog
  reintroduces the `<Sheet>` false positive.
- **Fix:** A second, generalizable assertion form: the surface must not be contained by the
  app content tree at all (in the app that is `#app-content`, whose own comment already
  records that portaled sheets land outside it; in the tests it is the RTL container holding
  the `withBackground` fixture). It needs no per-surface knowledge, it is non-vacuous — it was
  one of the three recorded RED failures — and it states D-20 directly. The per-surface
  ancestor walk is kept as the primary FOUND-03 form; both are applied to `SearchSheet` and
  `FabMenu`.
- **Files modified:** `packages/app/test/layerOrder.test.tsx`
- **Commit:** `9a7521e`

### 3. [Plan defect — corrected, carried forward from waves 3–5] Every `<verify>` command cannot run as written

- **Found during:** all three tasks.
- **Issue:** The plan specifies `cd packages/app && npx vitest run --project @guezzer/app …`.
  Vitest projects are declared only in the **root** `vitest.config.ts`, so from
  `packages/app` this fails with `No projects matched the filter "@guezzer/app"`; dropping
  the filter is worse, running without `environment: "jsdom"`. Plans 21-09 and 21-10 hit the
  identical defect.
- **Fix:** Every verification was run from the repo root (`npx vitest run <paths>`). Test
  invocation only; no source or config file changed.
- **Commit:** n/a

### 4. [Acceptance-criteria note] The plan's "954-test baseline" is stale

Task 3's criteria cite a 954-test baseline. The real baseline at this plan's base
(`93fe17b`) is **130 files / 1073 tests**, as the orchestrator confirmed. Met in substance:
zero new failures, **1073 → 1089** by exactly the 16 cases added here.

## The FabMenu Gate

The plan gates Task 3 on the recorded repro. `21-HUMAN-UAT.md` §7 `result:` names
**`SearchSheet` and `FabMenu` (both scrim and speed-dial rows)** as the offending surfaces,
with `fabScrim: 25` and `fab: 30` each listed as resolving to effective 10. The gate is
satisfied, so the portal was applied. Caveat carried forward honestly: that result was
**RESOLVED BY STATIC ANALYSIS** (2026-07-25) rather than observed in a browser — the Chrome
extension was not connected. The reasoning is spec-level (`position: relative` + non-`auto`
`z-index` creates a stacking context) and the `<Sheet>` negative control corroborates it, but
the visual confirmation is still owed to 21-13's `?layerRepro=1` check.

## No Renumbering, No Guard Weakening

- `git diff HEAD~3 HEAD -- packages/app/src` contains **no change to any `zIndex`
  expression** and no change to `config.ts`. The tier ladder is byte-identical to what
  plan 21-10 handed over.
- The D-12 source guard in `bottomSpace.test.ts` was **not** touched: no exemption added, no
  allowlist extended, no pattern weakened. The `styles.css` edit adds only a selector and a
  comment — no `64px` / `4rem` / `env(safe-area-inset-bottom)` token — so the guard passes
  unchanged. No new exemption is warranted and none is requested.
- Zero packages added, removed or upgraded; `package.json` untouched. `createPortal` comes
  from the already-installed `react-dom`.

## Verification

- `npx vitest run` (repo root) — **131 files / 1089 tests passing**, up from the 1073
  baseline by exactly the 16 cases added. No pre-existing test failing or modified.
- `npx vitest run packages/app/test/layerOrder.test.tsx packages/app/test/fabMenu.test.tsx` —
  27 passed; `fabMenu.test.tsx` unmodified.
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds (PWA precache 40 entries).
- `grep -c 'from "../components/Sheet' packages/app/src/show/SearchSheet.tsx` → **0**.
- `grep -c 'OrbFitHarness' packages/app/test/layerOrder.test.tsx` → **1**.
- `git diff --diff-filter=D --name-only HEAD~3 HEAD` — **empty**; no file deleted.
- Not run: the `?layerRepro=1` desktop-browser check from `<verification>` — it needs a real
  compositor and is 21-13's device/browser UAT item. The two automated forms of the same claim
  (the ancestor walk and the escape assertion) were both RED before and GREEN after.

## Threat Model Notes

- **T-21-30 (mitigated):** both `FabMenu` roots portal to `document.body`, so `fabScrim: 25`
  and `fab: 30` compete at the top level instead of at effective 10. A `toast: 20` can no
  longer paint over the speed-dial or eat a tap in the live-logging loop. Browser confirmation
  owed to 21-13.
- **T-21-31 (mitigated):** `gesture-guard` is on the portaled `SearchSheet` root and in the
  `styles.css` selector list, restoring `touch-action: manipulation`, `overscroll-behavior:
  none` and `-webkit-touch-callout: none` on it. A source-read test asserts the selector list
  actually names the class, since jsdom cannot cascade it. No unit test can prove the device
  behavior — 21-13 UAT test 8 owns it.
- **T-21-32 (mitigated):** all four D-23 audit items performed with outcomes recorded above;
  `role`, `aria-modal`, `aria-label` and `zIndex` pinned by assertions and by a
  non-comment-diff review; `fabMenu.test.tsx` passes unmodified.
- **T-21-33 (mitigated):** the invariant was committed RED with the three failing cases and
  the offending ancestor's `className` + inline `zIndex` recorded above; three detector
  self-tests plus two `ancestorsUpToBody` walk tests prove the detector fires on the real
  `ShowView` idiom and does not fire on a positioned element without a z-index.
- **T-21-SC (mitigated):** zero package changes.

## Known Stubs

None. Both surfaces render exactly what they rendered before; only their DOM parent changed.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema changed. The one new
file-read is a test reading the repo's own `src/styles.css`.

## Self-Check: PASSED

- `packages/app/test/layerOrder.test.tsx` — FOUND
- `packages/app/src/show/SearchSheet.tsx`, `FabMenu.tsx`, `src/styles.css` — FOUND
- `9a7521e`, `11d4f8b`, `343615c` — all resolve in `git log`

## Notes for the Orchestrator

Ran in the **main checkout on `master`** (`.git` is a directory), already at the expected base
`93fe17b` — no reset performed, worktree-only commit guards did not apply.
`packages/app/test/bottomSpace.test.ts` was confirmed present with the D-12 source guard
before any work began. The three task commits are directly on `master`; there is no branch to
merge. `STATE.md` and `ROADMAP.md` were deliberately not touched.

Two items are owed forward:

1. **Plan 21-12** imports `createsStackingContext` and `ancestorsUpToBody` from
   `test/layerOrder.test.tsx`. Note the deviation-1 correction when using them: the walk must
   start at a surface's own root, and `<Sheet>`-based surfaces root at the scrim wrapper, not
   the dialog card. For a source-scan the distinction does not arise, but for any added
   runtime case it does.
2. **Plan 21-13** owes the `?layerRepro=1` browser confirmation. The UAT §7 result that gated
   this plan was resolved by static analysis, not observation, so the visual proof that the
   band no longer paints over the open sheet or speed-dial has not yet been seen by anyone.
