---
phase: 21-layout-layering-foundations
plan: 12
subsystem: layout
tags: [layering, z-index, stacking-context, portal, found-03, d-21, d-22, d-23, d-24, a11y]
requires:
  - phase: 21-layout-layering-foundations
    plan: 11
    provides: "the ancestor-walk invariant + createsStackingContext / ancestorsUpToBody / expectNoStackingAncestors / expectEscapesContentTree, and the SearchSheet portal shape copied verbatim onto these four"
  - phase: 21-layout-layering-foundations
    plan: 09
    provides: "ArchiveBrowser's unmark-confirm card already on var(--gz-sheet-pad-bottom), so the portal touched no padding arithmetic"
  - phase: 21-layout-layering-foundations
    plan: 07
    provides: "the bottom-space ladder written onto document.documentElement — why var(--gz-safe-bottom) still resolves inside a document.body portal (NodeSheet)"
  - phase: 21-layout-layering-foundations
    plan: 10
    provides: "every zIndex expression left as shipped, and the D-12 source guard this plan stayed clear of"
provides:
  - "AlbumDetail, ArchiveBrowser, SetlistView (BOTH return paths) and NodeSheet portaled to document.body, all still hand-rolled"
  - "packages/app/test/layerOrder.test.tsx §5 — the FOUND-03 portal SOURCE scan, completing the invariant's second form"
  - "the ancestor walk extended to the four, rendered against a DELIBERATELY ARMED reproduction of DexView's wrapper (the latent trap) so the new cases are not vacuous"
  - "packages/app/test/sheet.a11y.test.tsx — a portal-parity block across all five hand-rolled sheet surfaces, additions only"
  - "the jsdom-limits disclaimer extended with the three things device UAT test 8 still owns"
affects:
  - "plan 21-13 (UAT: the ?layerRepro=1 band must paint over NONE of the five hand-rolled surfaces; device test 8 owns the gesture-suppression and VoiceOver-order checks no unit test can make)"
  - "any future sheet-tier surface (the source scan now catches it the day it is written, portaled or not)"
  - "phase 22 (sheet-animation blast radius still 11 surfaces — none of these four migrated onto <Sheet>)"
tech-stack:
  added: []
  patterns:
    - "A source-scan guard that asserts its own discovered set is non-empty AND contains a known roster, so renaming the thing it scans for cannot silently disable it"
    - "Exclusions carried as a typed list of {prefix, why} rather than an inline filter — a hole in a guard has to be argued for in writing"
    - "A DELIBERATELY ARMED fixture (the shipped wrapper + the one future edit that would break it) as the way to give a prophylactic fix a non-vacuous test"
    - "A roster-driven parity block (surface × expected aria-modal value) so the non-modal exemption is data, not a special case"
key-files:
  created: []
  modified:
    - packages/app/src/dex/AlbumDetail.tsx
    - packages/app/src/dex/ArchiveBrowser.tsx
    - packages/app/src/dex/SetlistView.tsx
    - packages/app/src/explore/NodeSheet.tsx
    - packages/app/test/layerOrder.test.tsx
    - packages/app/test/sheet.a11y.test.tsx
decisions:
  - "The four prophylactic cases are walked against an ARMED DexView wrapper, not the shipped one — against the shipped wrapper (no z-index, no transform) the walk is vacuous by this file's own D-24 standard, and would have been four permanently-green cases proving nothing"
  - "The source scan's tier regex is word-boundary-anchored so config.ui.z.sheetScrim (CometTrail) is NOT swept in — a different tier with a different role, and a failure nobody could act on"
  - "The expected-file roster is asserted as a SUBSET, not an exact match: a seventh sheet written tomorrow should be caught by the portal assertion, not rejected by a stale list"
  - "NodeSheet's exemption is documented as scoped to the MODAL walk only — it is in the source scan's set and its structural position is asserted; an exemption from one form of the invariant is not an exemption from the invariant"
  - "dexie-react-hooks stubbed to undefined in both test files so DOM-STRUCTURE assertions can never be made flaky by async Dexie settling"
  - "No tier renumbered, no D-12 guard exemption added, no package added"
requirements-completed: [FOUND-03]
metrics:
  duration: ~20 min
  completed: 2026-07-25
  tasks: 2
  commits: 2
  tests_before: 1089
  tests_after: 1104
---

# Phase 21 Plan 12: The Four Prophylactic Portals + the FOUND-03 Source Scan Summary

All five hand-rolled sheet-tier surfaces now portal to `document.body`, and FOUND-03 holds
in both of its forms — the rendered ancestor walk and a static source scan that catches the
sixth sheet nobody has written yet. No z-index number changed anywhere in this plan.

## What Changed

**The four portals (`363b42c`).** `AlbumDetail`, `ArchiveBrowser`, `SetlistView` and
`NodeSheet` each got the exact transformation plan 21-11 applied to `SearchSheet`: a
`createPortal` import from `react-dom`, `Sheet.tsx`'s `if (typeof document === "undefined")
return null;` guard immediately before the return, and `createPortal(<existing tree>,
document.body)` as the **return value** rather than an extra wrapper element. `SetlistView`
has **two** return paths and both are portaled — the loading hold-the-frame dialog at the
top and the resolved one below it. Both carry `role="dialog" aria-modal="true"` at
`config.ui.z.sheet`, so portaling only the resolved one would have left the invariant true
for half the surface's lifetime, and specifically the half nobody looks at.

`grep -c createPortal` → `AlbumDetail` 2, `ArchiveBrowser` 2, `SetlistView` **3**,
`NodeSheet` 2 (import + call sites). `grep -c 'components/Sheet'` → **0** for all four:
they stay hand-rolled per D-22, so Phase 22's sheet-animation blast radius stays at 11
surfaces. Nothing else in the non-comment diff — `role`, `aria-modal` (including
`NodeSheet`'s `false`), `aria-label`, every `className`, every `zIndex` expression,
`NodeSheet`'s `touchAction: "none"` / drag geometry / `height` / `transition` /
`onClick` stopPropagation, and every handler are byte-identical.

**These four were not broken, and the code says so.** Each file's new header block states
plainly that its portal is **prophylactic**: `DexView.tsx:99` has no `z-index` and no
`transform`, and `NodeSheet` is a fragment child of `<main>`, so all four already
composited at the top level. What the portals buy is (a) the D-24 invariant becoming
uniformly true so the source scan has no exception to carry, and (b) removal of a latent
trap — one `z-index` added to `DexView`'s wrapper later would otherwise sink three dex
sheets at once, at any tier number.

**The invariant's second form (`a91f182`).** `layerOrder.test.tsx` §5 walks
`join(import.meta.dirname, "..", "src")` recursively for `.ts`/`.tsx` and asserts every
file matching `/config\.ui\.z\.sheet\b/` also matches `/createPortal\(/`. The word boundary
is load-bearing: without it the regex swallows `config.ui.z.sheetScrim`, which would sweep
in `CometTrail.tsx` — a different tier with a scrim's role, and a failure nobody could act
on. `dist/` is never read, and a case asserts that.

Exclusions are a typed `{ prefix, why }[]` rather than an inline filter, because an
exclusion is a hole in the guard and ought to be argued for in writing:

| Excluded | Why |
|---|---|
| `dev/` | The established exception. `dev/OrbFitHarness.tsx:147` already holds the repo's only Tailwind `z-10`; `dev/LayoutProbe.tsx:250` renders a measurement overlay at the sheet tier. Both are reached only by an explicit `#/dev/*` hash. |
| `config.ts` | Declares the tier ladder; renders nothing. Listed by name as the plan asks, though it does not contain the literal expression today. |
| `layout/bottomSpace.ts` | Composes the bottom-space ladder; renders nothing. Same. |

**The ancestor walk, extended honestly.** The plan asks for the four to be walked "inside a
`DexView`-shaped wrapper". Rendered against the wrapper **as it ships**, that walk is
vacuous by this file's own D-24 standard — the wrapper creates no stacking context, so the
four cases would have been permanently green and would have proven nothing. So `DexShell`
takes an `armed` prop that adds the **one** `position: relative` + `z-index` a future edit
could plausibly put there, and the four are walked against that. An `ANTI-VACUITY` case
pins both halves: the shipped wrapper is inert (`createsStackingContext` → `false`) and the
armed one is not (`→ true`). `armed` is test-only; nothing in `src/` sets it.

**Portal parity in `sheet.a11y.test.tsx`.** A roster of the five hand-rolled surfaces ×
their expected `aria-modal` value drives six new cases asserting, per surface: `role` is
`dialog`, `aria-modal` has its expected value (`"false"` for `NodeSheet` — the contract, not
an oversight), the accessible name is non-empty and trimmed-non-empty, `parentElement` is
`document.body`, and the root is contained by neither the render container nor the
`mountAppContent()` trigger subtree. A sixth case pins that all five still render at
`config.ui.z.sheet` — parity in the other direction, proving the portals did not quietly
re-tier anything.

The eight shipped `<Sheet>` cases are **byte-identical**: `git diff --numstat` on that file
is `184  0` — 184 insertions, **zero** deletions.

## The Recorded RED (non-vacuity, proven not asserted)

`AlbumDetail.tsx` was temporarily restored to its pre-portal form (`git checkout e13b478 --`)
and the two test files re-run. Exactly **three** cases failed and nothing else:

| Failing case | What it reported |
|---|---|
| `AlbumDetail escapes the armed DexView wrapper (D-21)` | `AlbumDetail: 1 ancestor(s) create a stacking context, so this surface composites at the ANCESTOR's level, not its own tier.` |
| `every file rendering at config.ui.z.sheet also calls createPortal` | offenders `["dex/AlbumDetail.tsx"]`, with the full scanned list and the named exclusions printed |
| `AlbumDetail: keeps role/aria-modal/name and lands on document.body` | the parity assertion on `parentElement` |

That is one failure per assertion form — the walk, the source scan, and the a11y parity —
which is the evidence that each of the three is independently load-bearing rather than
three restatements of one check. The file was restored immediately
(`git checkout HEAD -- …`); the working tree at commit time had only the two test files
modified. For the record, at the base commit `e13b478` all four surfaces had
`grep -c createPortal` → **0**, so the scan would have reported four offenders.

## The D-23 Audit (per surface, with outcomes)

Asked of each of the four: does it render inside `.orbit-stage` / `.action-bar` /
`.fab-menu`; does Escape handling depend on DOM tree position; does focus enter on open and
return on close; did anything rely on being inside `#app-content`.

| | `.orbit-stage`/`.action-bar`/`.fab-menu` ancestor | Escape | Focus | `#app-content` dependency |
|---|---|---|---|---|
| **AlbumDetail** | No — those three classes exist only on Show/Explore surfaces (`OrbitStage.tsx:214`, `FabMenu.tsx:125,134`); this is `#/dex`. Nothing lost, no `gesture-guard` warranted. | Never handled. Closing is the ≥44px back control. No tree-position-dependent handler to lose. | Manages none, before or after. | None. |
| **ArchiveBrowser** | No — same reasoning. | Never handled. Closing is the ✕ control; the D-12 confirm cancels by scrim tap or its own button. | Manages none. | None. `useLiveQuery` / `useOnlineStatus` / `useAuthIdentity` are all context-free reads unaffected by DOM position. |
| **SetlistView** | No — same reasoning. | Never handled. Closing is the ≥44px back control. | Manages none. | None. |
| **NodeSheet** | No — it is a fragment child of `<main>`, and those classes are siblings. **It already owns its gesture suppression via the INLINE `touchAction: "none"` on its own root** (plus `pan-y` on the scroll body), and inline style travels with the portaled node. It needs no `.gesture-guard` class, and one was deliberately not added. | Handled — but through the shared LIFO `dialogStack` (`useDialogDismiss`), which listens on `document`. Tree-position-independent; nothing to re-apply. | Focus-**restore** only (deliberately no trap, T-08-10): captures `document.activeElement` on mount, restores on unmount. Also position-independent. | None. `useVisibleViewportHeight` reads `visualViewport`, and `--gz-safe-bottom` is written onto `document.documentElement` (plan 21-07) which `document.body` inherits — so the peek geometry and the bottom padding resolve identically outside `#app-content`. Asserted in the new NodeSheet case. |

Nothing was lost, so nothing was re-applied. The one thing worth writing down that the plan
did not ask about:

**`ArchiveBrowser` has intra-surface nesting, and it is correct.** Its D-12 unmark-confirm
dialog renders at `sheetScrim` (40) **inside** the `sheet` (50) root. That is the same shape
`<Sheet>` has — the scrim wrapper containing its own card — and plan 21-11's deviation 1
already established that a surface's **own** stacking-context ancestor is not what FOUND-03
forbids: the pair travels through this one portal and competes at the top level as one unit.
The ancestor walk is therefore anchored on `ArchiveBrowser`'s outer root, and the file
carries a comment saying so. No renumbering was considered or performed.

## Deviations from Plan

### 1. [Rule 2 — the plan's fixture would have made four cases vacuous] The dex walk needed an ARMED wrapper

- **Found during:** Task 2, writing the three dex ancestor-walk cases.
- **Issue:** The plan says to render each surface "in a realistic tree (inside a
  `DexView`-shaped wrapper)". But `DexView.tsx:99` is
  `mx-auto flex w-full max-w-md … flex-col` — no `z-index`, no `transform`, so it creates
  no stacking context. `expectNoStackingAncestors` against that wrapper passes whether or
  not the surface is portaled. The plan's own objective says these four are already at root
  level, so the fixture it specifies cannot distinguish the before state from the after
  state. Four permanently-green cases is exactly the vacuity this file's D-24 header warns
  about, and the same defect 21-11 caught in its own `<Sheet>` control.
- **Fix:** `DexShell` takes an `armed` prop adding the single `position: relative` +
  `z-index` a future edit could put on that wrapper — the exact latent trap the plan's own
  objective names as these portals' purpose. The four cases run against the armed shell, so
  they now encode "this future edit must remain harmless" rather than "this currently works
  anyway". An `ANTI-VACUITY` case pins that the shipped shell is inert and the armed shell
  is not, so an `armed` prop that silently stopped working (renamed class, dropped style)
  cannot turn the four green-and-meaningless. Verified by the recorded RED above.
- **Files modified:** `packages/app/test/layerOrder.test.tsx`
- **Commit:** `a91f182`

### 2. [Rule 3 — plan describes work already shipped] The `focusedFab > sheet` assertion already existed

- **Found during:** Task 2.
- **Issue:** The plan asks to "add an explicit `it` asserting
  `config.ui.z.focusedFab > config.ui.z.sheet` with the D-03/D-26 reason quoted". Plan 21-11
  already shipped exactly that (`layerOrder.test.tsx`, "focusedFab deliberately sits ABOVE
  sheet (D-03) — asserted so nobody 'fixes' it", with a docblock giving the keyboard/VoiceOver
  reason). Adding a second copy would be duplicate coverage that drifts.
- **Fix:** The existing assertion was kept and its docblock **extended** with the piece this
  plan actually contributes: portaling `NodeSheet` is what makes the comparison mean what it
  says, because both boxes are `position: fixed` and both now compete at the top level —
  nested under a stacking context the two numbers would have been decided by their ancestors
  instead. The acceptance criterion ("the assertion exists with its D-03 reason") is met.
- **Files modified:** `packages/app/test/layerOrder.test.tsx`
- **Commit:** `a91f182`

### 3. [Plan defect — corrected, carried forward from waves 3–6] Every `<verify>` command cannot run as written

- **Found during:** both tasks.
- **Issue:** The plan specifies `cd packages/app && npx vitest run --project @guezzer/app …`.
  Vitest projects are declared only in the **root** `vitest.config.ts`, so from
  `packages/app` this fails with `No projects matched the filter "@guezzer/app"`; dropping
  the filter is worse, running without `environment: "jsdom"`. Plans 21-09, 21-10 and 21-11
  hit the identical defect.
- **Fix:** Every verification was run from the repo root (`npx vitest run <paths>`). Test
  invocation only; no source or config file changed.
- **Commit:** n/a

### 4. [Acceptance-criteria note] The plan's "954-test baseline" is stale

Task 2's criteria cite a 954-test baseline; `<verification>` cites "125 files / 954 tests".
The real baseline at this plan's base (`e13b478`) is **131 files / 1089 tests**, as plan
21-11's summary and the orchestrator both record. Met in substance: zero new failures,
**1089 → 1104** by exactly the 15 cases added here (9 in `layerOrder.test.tsx`, 6 in
`sheet.a11y.test.tsx`), file count unchanged at 131.

## No Renumbering, No Guard Weakening, No Scope Creep

- `git diff packages/app/src/config.ts` is **empty**. No tier renumbered anywhere in this
  plan; the ladder is byte-identical to what plan 21-10 handed over and 21-11 preserved.
- The D-12 source guard in `bottomSpace.test.ts` was **not** touched: no exemption added,
  no allowlist extended, no pattern weakened. It passes unchanged (37 tests). Neither task
  introduced a hardcoded bottom-space literal — `NodeSheet`'s `var(--gz-safe-bottom)` and
  `ArchiveBrowser`'s `var(--gz-sheet-pad-bottom)` were already owner-composed by plans
  21-07/21-09 and were carried through the portal untouched.
- Scope held to the four named surfaces plus the source-scan assertion and the a11y
  re-verification. No fifth surface touched, no `<Sheet>` migration, no `styles.css` edit
  (none was needed — see the `NodeSheet` row of the D-23 table).
- Zero packages added, removed or upgraded; `package.json` untouched. `createPortal` comes
  from the already-installed `react-dom`.

## Verification

- `npx vitest run` (repo root) — **131 files / 1104 tests passing**, up from the 1089
  baseline by exactly the 15 cases added. No pre-existing test failing or modified.
- `npx vitest run packages/app/test/layerOrder.test.tsx` — 25 passed (was 16).
- `npx vitest run packages/app/test/sheet.a11y.test.tsx` — 15 passed (was 9); the 8 shipped
  `<Sheet>` cases plus the FOUND-02 padding case are byte-identical.
- Targeted regression sweep before commit —
  `layerOrder`, `archiveBrowser`, `setlistView`, `dexView`, `test/explore`, `test/dex`,
  `authViewScoping`, `showsList`: 11 files / 93 tests, all passing **unmodified**. Their
  queries are `screen`/testid-based and therefore portal-agnostic.
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean.
- `npm run build --workspace packages/app` — succeeds (PWA precache 40 entries).
- `git diff --numstat packages/app/test/sheet.a11y.test.tsx` → `184  0` (additions only).
- `git diff --diff-filter=D --name-only e13b478 HEAD` — **empty**; no file deleted.
- Not run: the `?layerRepro=1` browser check from `<verification>` — it needs a real
  compositor and is 21-13's device/browser UAT item.

## Threat Model Notes

- **T-21-34 (mitigated):** the diff on all four surfaces is the portal wrapper plus an SSR
  guard plus a header comment — `role`, `aria-modal`, accessible name, classes, `zIndex`
  and handlers verified unchanged by review and pinned by the new parity block in
  `sheet.a11y.test.tsx`. `archiveBrowser.test.tsx`, `setlistView.test.tsx`,
  `showsList.test.tsx` and `authViewScoping.test.tsx` all pass **unmodified**. The four land
  as **one** commit (`363b42c`), independently revertible from 21-11's live fix.
- **T-21-35 (mitigated):** `NodeSheet` owns its gesture suppression via the inline
  `touchAction: "none"` on its own root, which travels with the portaled node; the new case
  asserts `style.touchAction === "none"`, the `fixed inset-x-0 bottom-0` geometry and the
  `var(--gz-safe-bottom)` padding after portaling. No class-scoped inheritance was lost, so
  no `.gesture-guard` was added. Real device gesture behaviour remains UAT test 8.
- **T-21-36 (mitigated):** `focusedFab: 60 > sheet: 50` survives as a named assertion with
  its D-03 reason, now extended to record that portaling is what makes the comparison
  meaningful. `config.ts` diff is empty, so the keyboard/VoiceOver escape route is intact.
- **T-21-37 (mitigated):** the source scan asserts its discovered set is non-empty **and**
  contains all six known sheet-tier files, with the full list printed on failure. Renaming
  the tier or breaking the source walk fails loudly instead of emptying the set.
- **T-21-SC (mitigated):** zero package changes; `package.json` not in the diff.

## Known Stubs

None. All four surfaces render exactly what they rendered before; only their DOM parent
changed. No placeholder value, no empty-array-to-UI path, no TODO introduced.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema changed. The one new
file-read is a test reading the repo's own `src/` tree.

## Self-Check: PASSED

- `packages/app/src/dex/AlbumDetail.tsx` — FOUND
- `packages/app/src/dex/ArchiveBrowser.tsx` — FOUND
- `packages/app/src/dex/SetlistView.tsx` — FOUND
- `packages/app/src/explore/NodeSheet.tsx` — FOUND
- `packages/app/test/layerOrder.test.tsx` — FOUND
- `packages/app/test/sheet.a11y.test.tsx` — FOUND
- `363b42c`, `a91f182` — both resolve in `git log`

## Notes for the Orchestrator

Ran in the **main checkout on `master`** (`.git` is a directory), already at the expected
base `e13b478` — no reset performed, worktree-only commit guards did not apply.
`packages/app/test/layerOrder.test.tsx` was confirmed present before any work began, as
instructed. The two task commits are directly on `master`; there is no branch to merge.
`STATE.md` and `ROADMAP.md` were deliberately not touched.

Two items owed forward to **21-13**:

1. The `?layerRepro=1` browser confirmation is still owed, and its scope has grown: the
   band must now paint over **none of the five** hand-rolled surfaces. 21-11's gating UAT §7
   result was resolved by static analysis rather than observation, so the visual proof has
   still not been seen by anyone.
2. Device UAT test 8 now owns three things the jsdom suite cannot reach, and the a11y file
   says so in its header: real double-tap-zoom / long-press-callout suppression, real
   VoiceOver focus order across the portaled surfaces, and real Tab wrapping.

One note for whoever schedules the rest of the phase: per RESEARCH this plan was the
explicitly droppable part. It shipped, and the four portals are a single revertible commit
(`363b42c`) if a device regression appears in 21-13. Reverting it alone would also require
reverting the four `layerOrder.test.tsx` walk cases and the four non-`SearchSheet` parity
cases in `a91f182`; the source-scan block would then need its expected roster trimmed to
the two portaled surfaces. The live fix (21-11) and the invariant's core are untouched by
such a revert.
