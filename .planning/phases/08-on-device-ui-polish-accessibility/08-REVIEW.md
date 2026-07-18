---
phase: 08-on-device-ui-polish-accessibility
reviewed: 2026-07-18T08:46:21Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - packages/app/src/App.tsx
  - packages/app/src/config.ts
  - packages/app/src/components/Sheet.tsx
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/components/InstallBanner.tsx
  - packages/app/src/components/UpdateToast.tsx
  - packages/app/src/components/a11y/dialogStack.ts
  - packages/app/src/components/a11y/inertRoot.ts
  - packages/app/src/components/a11y/useDialogDismiss.ts
  - packages/app/src/components/a11y/useFocusTrap.ts
  - packages/app/src/dev/OrbFitHarness.tsx
  - packages/app/src/dex/AlbumDetail.tsx
  - packages/app/src/dex/ArchiveBrowser.tsx
  - packages/app/src/dex/CompareView.tsx
  - packages/app/src/dex/RecapView.tsx
  - packages/app/src/dex/SetlistView.tsx
  - packages/app/src/dex/ShareCardSheet.tsx
  - packages/app/src/explore/ConstellationCanvas.tsx
  - packages/app/src/explore/ExploreFilterFab.tsx
  - packages/app/src/explore/ExploreView.tsx
  - packages/app/src/explore/NodeSheet.tsx
  - packages/app/src/explore/useVisibleViewportHeight.ts
  - packages/app/src/settings/SettingsView.tsx
  - packages/app/src/show/CometTrail.tsx
  - packages/app/src/show/EndShowDialog.tsx
  - packages/app/src/show/FabMenu.tsx
  - packages/app/src/show/SearchSheet.tsx
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/show/TrailNodeSheet.tsx
  - packages/app/src/show/WhyDetail.tsx
  - packages/app/src/show/orbLabelFit.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: fixed
---

# Phase 08: Code Review Report

**Reviewed:** 2026-07-18T08:46:21Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 08 was an accessibility + layering refactor: a shared `<Sheet>` primitive, dependency-free focus-trap / dialog-stack / inert hooks, a centralized `config.ui.z` tier scale replacing every raw `z-NN` literal, an Explore FilterFab-lift + shared viewport-height hook, and an orb-label fit retune with a dev harness.

The a11y hook layer itself is sound: `useFocusTrap` balances `setRootInert` correctly across mount/unmount and early-return paths, the LIFO `dialogStack` uses one shared listener, `useVisibleViewportHeight` subscribes/unsubscribes cleanly, `Sheet` runs hooks before the `if (!open) return null` guard (no rules-of-hooks violation), the guarded branches in `ShareCardSheet` and `CompareView` are intact, and no `dangerouslySetInnerHTML` was introduced. The z-migration is complete (all `zIndex` reads go through `config.ui.z`; one stray literal survives only in the throwaway dev harness).

**However, the z-tier migration introduced one BLOCKER**: in `FabMenu` the full-viewport scrim was placed on a tier (`fabScrim` = 35) that sits *above* the FAB action container (`fab` = 30), so the scrim paints on top of every speed-dial action and the FAB toggle. This makes the entire Show-Mode action set (Search, ???, Set break, Encore, Undo, End Show) untappable while the menu is open — a regression against the pre-phase `z-20` scrim / `z-30` container ordering, and it directly hits the show-#1 functionality bar. The existing `fabMenu.test.tsx` does not catch it because jsdom has no z-index hit-testing. A related tier interaction (RecapView → ShareCardSheet) degrades a modal scrim, and a handful of surfaces still claim `aria-modal` without real focus management.

## Critical Issues

### CR-01: FabMenu scrim renders ABOVE its own action buttons — all Show-Mode speed-dial actions are untappable

**File:** `packages/app/src/show/FabMenu.tsx:94-128` (tiers defined in `packages/app/src/config.ts:219-220`)
**Issue:** The full-viewport scrim is rendered at `zIndex: config.ui.z.fabScrim` (**35**) while the FAB + action-rows container is at `zIndex: config.ui.z.fab` (**30**). Both are `position: fixed` siblings inside the same stacking context (the `z.content`=10 column in `ShowView.withBackground`). Because 35 > 30, the scrim paints *on top of* the container, and the scrim owns an `onClick={() => setOpen(false)}` with no `pointer-events-none`. Result: once the menu is open, every tap — on any action row or on the FAB toggle itself — lands on the scrim and merely collapses the menu. **Search, ???, Set break, Encore, Undo, and End Show are all unreachable.** This is a regression: the diff shows the pre-phase code used `z-20` on the scrim and `z-30` on the container (scrim strictly *below* the actions), which worked. The `fabMenu.test.tsx` coverage passes because jsdom fires `onClick` directly regardless of paint order / z-index.

The underlying cause is that the tier table itself (RESEARCH Pattern 4 / `config.ts` `z`) orders `fab: 30` below `fabScrim: 35`, which is internally inconsistent for a speed-dial whose own scrim must sit *beneath* its actions.

**Fix:** Make the FabMenu scrim sit below the `fab` tier (it only needs to be above `content`, per its own doc comment "below sheets, above content" — it never needs to be above the FAB it dims). E.g. give the scrim its own sub-`fab` value:

```ts
// config.ts — z tiers
z: {
  content: 10,
  toast: 20,
  fabScrim: 25,   // FabMenu scrim: above content, BELOW the FAB it dims
  fab: 30,        // resting FABs + FabMenu action rows (now strictly above fabScrim)
  sheetScrim: 40,
  sheet: 50,
  focusedFab: 60,
},
```

(Keep `FabMenu` reading `z.fabScrim` for the scrim and `z.fab` for the container — only the tier *values* need reordering so `fabScrim < fab`.) Then add a real-DOM/pointer test, or an assertion that the scrim's computed `zIndex` is numerically less than the action container's, so this can't silently regress again.

## Warnings

### WR-01: ShareCardSheet opened from RecapView loses its backdrop dim and tap-to-dismiss

**File:** `packages/app/src/dex/RecapView.tsx:145` + `packages/app/src/components/Sheet.tsx:96`
**Issue:** `RecapView` is a full-screen opaque overlay (`fixed inset-0 bg-surface`) rendered *in the React tree* at `zIndex: config.ui.z.sheet` (**50**). `ShareCardSheet` (opened from the recap footer) is a `<Sheet>` that **portals to `document.body`**, so its backdrop scrim lands at `z.sheetScrim` (**40**) in the same root stacking context — i.e. *behind* the opaque recap (40 < 50). Consequences when sharing from the recap: (a) the `bg-black/50` scrim dim is completely hidden behind the recap, and (b) tap-outside-to-dismiss is dead because the taps hit RecapView (z 50), not the scrim (z 40). The sheet card content itself is at `z.sheet` (50, later in DOM) so it still shows and the explicit Close button still works — hence not a blocker. This is a regression: the diff shows RecapView was `z-40` pre-phase (equal to the old ShareCardSheet backdrop `z-40`), so DOM order previously put the scrim on top and it worked.
**Fix:** A full-screen host overlay that itself sits at `z.sheet` must not host a portaled modal whose scrim is a lower tier. Simplest: render RecapView at `z.content` (or a dedicated `page` tier below `sheetScrim`) instead of `z.sheet` — it is an opaque page, not a scrim-backed modal, so it does not need the sheet tier. Alternatively route the recap's share flow through a host that is below `sheetScrim`.

### WR-02: `inert` background suppression rides on `display: contents`, whose inert propagation is unverified on the primary target

**File:** `packages/app/src/App.tsx:59` (+ `packages/app/src/components/a11y/inertRoot.ts:40-45`)
**Issue:** The whole A11Y-01 background-suppression contract depends on toggling native `inert` on `#app-content`, but that element is `style={{ display: "contents" }}`. `inert` on a `display: contents` element (which has no box) has historically had inconsistent descendant-propagation across engines; if it no-ops on the owner's iOS Safari, the phase's headline guarantee (background not focusable / not in the AT tree while a modal is open) silently fails with no error and no visual tell. The code comment acknowledges the risk and names a concrete fallback (move `id`/`inert` onto AppShell's root flex div) but ships the risky variant. Given iOS Safari is the primary target and this is the phase's core deliverable, it should be confirmed on-device (VoiceOver: swipe past the last control and verify focus cannot reach the background) or switched to the boxed fallback pre-emptively.
**Fix:** Verify on the cloudflared UAT tunnel with VoiceOver; if the background remains reachable, move `id="app-content"` + the `inert` target onto a real box (AppShell's root) rather than a `display: contents` wrapper.

### WR-03: Full-screen overlays still declare `aria-modal="true"` without focus trap, Escape, or focus restore

**File:** `packages/app/src/show/SearchSheet.tsx:96-100` (also `dex/AlbumDetail.tsx:44-48`, `dex/ArchiveBrowser.tsx:247-251`, `dex/RecapView.tsx:141-145`, `dex/SetlistView.tsx:127-131`, `show/CometTrail.tsx:221-225` FullSetlistSheet)
**Issue:** These surfaces keep the exact anti-pattern the phase set out to eliminate (RESEARCH Pitfall 1): `role="dialog" aria-modal="true"` with **no** focus trap, **no** Escape-to-dismiss, and **no** focus restore. `SearchSheet` is the most consequential — it is a live text-input sheet reachable mid-show (from `ShowView` and via `TrailNodeSheet`'s swap), yet a keyboard/AT user can Tab straight out behind it and Escape does nothing. They were excluded from the audited-7 migration scope, but they now carry the `z.sheet` tier and a *false* `aria-modal` promise, so a screen-reader user is told the region is modal while it demonstrably is not. This is inconsistent with the A11Y-01 invariant the phase advertises.
**Fix:** Either drop `aria-modal="true"` from surfaces that genuinely can't trap (so AT isn't misinformed), or bring at least `SearchSheet` onto the shared `useDialogDismiss` + focus-restore hooks (it already has `autoFocus`; adding Escape + restore is the same cheap idiom used for `NodeSheet`). Document the intentional scope boundary in the phase summary if the others are deliberately deferred.

## Info

### IN-01: `useDialogDismiss` LIFO ordering is fragile against unstable `onClose` identities

**File:** `packages/app/src/components/a11y/useDialogDismiss.ts:13-19`
**Issue:** The effect deps are `[active, onClose]`, and every caller passes an inline arrow (`onClose={() => setX(null)}`), so any parent re-render re-runs the effect → `removeDialog(old)` + `pushDialog(new)`, moving that dialog to the *top* of the LIFO. If two `dialogStack` participants were ever open simultaneously and the lower one re-rendered, one Escape would then dismiss the wrong (lower) dialog — the exact double-fire the stack exists to prevent. In practice this is currently unreachable (true modals set the background `inert`, so a second dialog can't be triggered while one is open, and the one documented swap — TrailNodeSheet→SearchSheet — doesn't route both through the stack), so it's latent, not active.
**Fix:** Have callers wrap `onClose` in `useCallback`, or store the latest `onClose` in a ref inside the hook and register a stable wrapper, so stack position is decoupled from render identity.

### IN-02: One raw `z-10` Tailwind literal survives in the dev harness

**File:** `packages/app/src/dev/OrbFitHarness.tsx:108`
**Issue:** The D-04 contract is "no `z-NN` literal remains." A `sticky top-0 z-10` remains on the harness header. It is self-contained in a throwaway dev-only component (`#/dev/orb-fit`, slated for removal), so it does not affect the tier system — noted only for completeness against the "migrate ALL" claim.
**Fix:** Ignore (throwaway) or delete with the harness post-phase.

### IN-03: `RESTING_BOTTOM_PX` duplicates the `bottomOffset` layout constant and can drift

**File:** `packages/app/src/explore/ExploreFilterFab.tsx:31` vs `:73`
**Issue:** `RESTING_BOTTOM_PX = 64 + 8` is hand-kept in sync with `bottomOffset = "calc(env(safe-area-inset-bottom) + 64px + 8px)"`. If the BottomTabBar height (64) or gap (8) ever changes, the FAB-lift math and the actual resting offset silently disagree, mis-resting the lifted FAB relative to the NodeSheet peek edge — the CLAUDE.md "no scattered magic numbers" concern.
**Fix:** Derive both from shared named constants (e.g. `config.ui` `BOTTOM_TAB_BAR_PX` / `FAB_EDGE_GAP_PX`) so the offset string and the lift math read one source.

---

## Remediation

Both z-tier layering regressions fixed on 2026-07-18. Typecheck clean
(`tsc -p packages/app/tsconfig.json --noEmit`); full app suite green
(558 tests / 74 files).

- **CR-01 — FIXED** (commit `700b19e`): reordered the `config.ui.z` tier
  values so the FabMenu scrim (`fabScrim`) sits strictly below the FAB +
  action-row container (`fab`) — `fabScrim: 35 → 25` (above `toast: 20`,
  below `fab: 30`). FabMenu still reads `z.fabScrim`/`z.fab`; only the numeric
  values changed. Added a numeric regression guard in `fabMenu.test.tsx`
  asserting `config.ui.z.fabScrim < config.ui.z.fab` (jsdom can't hit-test
  paint order). Show-Mode speed-dial actions are tappable again.
- **WR-01 — FIXED** (commit `2514399`): added a dedicated `z.page: 15` tier
  for opaque full-screen in-tree pages (above `content: 10`, below every
  modal/scrim tier) and moved both RecapView page-root overlays from
  `z.sheet` (50) to `z.page`. The portaled ShareCardSheet scrim
  (`sheetScrim: 40`) now renders above the recap, restoring the backdrop dim
  and tap-outside-to-dismiss.

Deferred (intentionally NOT touched in this pass):

- **WR-02** (`inert` on `display: contents`) — deferred to the on-device
  VoiceOver pass on the cloudflared UAT tunnel; switch to the boxed fallback
  only if the background remains reachable.
- **WR-03** (full-screen overlays declaring `aria-modal` without a real trap)
  — deferred follow-up (drop the false `aria-modal` or bring SearchSheet onto
  the shared dismiss/restore hooks).
- **IN-01** (`useDialogDismiss` LIFO vs unstable `onClose`) — latent, deferred.
- **IN-02** (one raw `z-10` literal in the throwaway dev harness) — ignore /
  delete with the harness post-phase.
- **IN-03** (`RESTING_BOTTOM_PX` duplicates the `bottomOffset` constant) —
  deferred cleanup.

_Reviewed: 2026-07-18T08:46:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Remediated: 2026-07-18 (CR-01, WR-01)_
