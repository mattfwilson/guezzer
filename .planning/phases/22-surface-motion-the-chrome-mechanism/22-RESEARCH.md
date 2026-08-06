# Phase 22: Surface Motion & the Chrome Mechanism - Research

**Researched:** 2026-08-05
**Domain:** React 19 presence/exit animation, CSS-custom-property-driven layout collapse, `inert`/a11y-tree removal, `useSyncExternalStore` singletons, jsdom assertion technique
**Confidence:** HIGH (mechanism findings are read from the *installed* React 19.2.7 / framer-motion 12.42.2 / dexie-react-hooks 4.4.0 / jsdom 29.1.1 sources in `node_modules`, not from training data — and the presence/exit lifecycle claims were additionally **executed** as live probes in this repo's own Vitest/jsdom environment, see §Verification Addendum)

<user_constraints>
## User Constraints (from CONTEXT.md)

`.planning/phases/22-surface-motion-the-chrome-mechanism/22-CONTEXT.md` is the authority and
is **not restated here** (its 38 decisions are settled and this document deliberately does not
re-litigate or paraphrase them — see the anti-goal in the research brief). Index only:

| Topic | Decisions |
|---|---|
| Chrome trigger + escape | D-01 … D-06 |
| Chrome motion, a11y tree, resize contract | D-07, D-08, D-09 |
| What "chrome" means / stickiness | D-10 … D-15 |
| Sheet motion scope + structure | D-16, D-17, D-18 |
| Sheet a11y contract | D-19 … D-22 |
| Sheet mechanism + feel | D-23 … D-31 |
| Install relocation | D-32 … D-37 |
| Scope boundary | D-38 |

`22-UI-SPEC.md` (status: **approved**) is likewise a locked contract for this phase — it closes all
four Claude's-Discretion items below. Research does not reopen it; where a mechanism finding has a
UI-SPEC consequence, it is flagged inline.

### Claude's Discretion (verbatim)

- The exact icon for the chrome toggle and the visual styling of the Settings install section.
  This phase carries a **UI hint: yes** in ROADMAP.md — `/gsd-ui-phase 22` is available to
  produce a UI-SPEC before planning.
- The precise easing curve and the exact `config.ui` constant names for the sheet transition,
  within the ~200ms / parallel-scrim envelope of D-24.
- The internal shape of the chrome-visibility module (D-12), provided it composes with
  `layout/bottomSpace.ts`'s `chromeVisible` parameter rather than duplicating it.
- Slice ordering within the phase, subject to the roadmap's own constraint that the sheet
  animation lands as the first slice and stays backable-out.

### Deferred Ideas (OUT OF SCOPE — verbatim)

- **Migrating `SearchSheet` / `AlbumDetail` / `ArchiveBrowser` / `SetlistView` / `NodeSheet`
  onto the shared `<Sheet>` primitive.** Deferred once already in Phase-21 D-22 and again here
  in D-16.
- **Swipe-down-to-dismiss on sheets.** Explicitly ruled out (D-29).
- **OS back-gesture handling as a general mechanism.** D-04 leaves it alone; Phase 23's
  INSHOW-02 genuinely needs it for the bingo overlay.
- **Suppressing nested sheet scrims so the background darkens only once** (D-28).
- **Chrome-hide on tabs other than GizzVerse** beyond Phase 23's in-show case (D-03).
- **`aria-pressed` toggle semantics** (D-05).
- **A `config.ui` runtime kill-switch for sheet motion** (D-18).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHEET-01 | Every bottom sheet animates smoothly up on open and down on close with a scrim cross-fade, honoring `prefers-reduced-motion` | §Pattern 1 (AnimatePresence must live *inside* the portal), §Pattern 2 (the enter/exit prop shape), §Pitfall 1 (9 of 19 instances are unmount-driven and cannot exit-animate), §Pitfall 3 (`initial={false}` kills the enter for 9 instances) |
| SHEET-02 | Focus returns to the trigger and the background becomes interactive at close-**start**; re-verified on-device | §Pattern 3 (the `useFocusTrap` split — the teardown already fires at close-start; what's actually new), **§Pitfall 14 (exiting children render from FROZEN props — `aria-hidden`/`pointer-events` cannot be derived from `open`)**, §Pitfall 4 (passive-effect vs mutation-phase ordering), §Pitfall 5 (double-release underflows the ref-counted `inert`), §Validation Architecture D-20 row |
| CHROME-01 | One tap hides top bar + bottom tabs; a control in the same place restores them | §Pattern 4 (one-commit collapse), §Pitfall 6 (`BottomTabBar` sizes itself from the very var that collapses) |
| CHROME-03 | Always escapable: exit control always rendered, ≥44px, in the safe area, first in tab order; never sticky across cold boot | §Validation Architecture (structural-by-construction rows), §Pattern 5 (first-in-tab-order is a DOM-order fact, not a `tabIndex` fact) |
| CHROME-04 | Hidden chrome removed from the a11y tree, not translated off-screen | §Pattern 6 (`inert` as a React 19 JSX boolean prop, not the imperative helper), §Pitfall 7 (jsdom 29 does **not** implement `inert`) |
| CHROME-05 | Exactly one resize callback; no reheat / battery cost, asserted by test | §Pattern 4, §Pitfall 8 (`d3ReheatSimulation` **is** called — a "no reheat" assertion will fail), §Validation Architecture CHROME-05 row |
| NAV-05 | Install instructions at the bottom of Settings, hidden once installed; one neutral menu row deep-links there | §Pattern 8 (the deep-link + focus-move shape), §Pitfall 10 (same-hash `navigate()` fires no `hashchange`), §Pitfall 11 (jsdom has no `scrollIntoView`) |
| NAV-06 | Installing from the relocated affordance works on Android, confirmed on-device | §Pattern 7 (`beforeinstallprompt` module singleton), §Pitfall 9 (React 19 loops on an uncached snapshot), §Pitfall 13 (**`apple-mobile-web-app-capable` is not a cosmetic no-op**), §Validation Architecture (install-mode proof gates the evidence) |

</phase_requirements>

## Summary

Almost every hard question in this phase resolves to a **structural** answer that is cheap once
known and expensive once shipped wrong. Four of them are decisive and none is guessable:

1. **`AnimatePresence` cannot wrap a `createPortal` call.** Read from the installed sources:
   framer-motion's `onlyElements()` filters children with `React.isValidElement`, and React
   19.2.7's `isValidElement` accepts *only* `$$typeof === Symbol.for("react.transitional.element")`
   — a portal is `Symbol.for("react.portal")`. A portal child is silently dropped and
   `AnimatePresence` renders **nothing**. The primitive must be restructured so the portal is
   the outer layer and `AnimatePresence` lives inside it, which also preserves Phase-21 D-24's
   `dialog.parentElement === document.body` invariant unchanged.

2. **Nine of the nineteen `<Sheet>` instances are unmount-driven, not `open`-driven.** They pass
   a hard-coded `open` and their *parent* stops rendering them. When the parent unmounts them the
   whole `Sheet` — including its internal `AnimatePresence` — dies synchronously. Those nine get
   an enter animation and **no exit animation and no close-start window at all**. This is not a
   defect to fix inside the primitive; it is a per-surface conversion, and the planner must
   decide explicitly whether the phase converts them, records them as a named seam (the D-16
   `SearchSheet` shape), or splits the difference. D-21's proposed device sample lands almost
   entirely on this set — it needs re-picking.

3. **`BottomTabBar` sizes its own height from `var(--gz-chrome-reserve)`** — the exact variable
   D-12 collapses. Collapsing it squashes the bar to a bare safe-area strip instead of sliding it
   out, and `translateY(100%)` of a squashed box no longer clears the viewport. The ladder needs
   one new never-collapsing named composition (`--gz-tab-bar-box`) that the bar reads while
   everyone else keeps reading `--gz-chrome-reserve`.

4. **An exiting `AnimatePresence` child renders from a FROZEN React element, so the close-start
   attributes cannot be derived from the `open` prop.** `AnimatePresence` keeps exiting children in
   its own `renderedChildren` state; those are the elements exactly as they were last rendered
   *while present*, and motion's own docs say their props "can no longer be updated". Any
   `aria-hidden={open ? undefined : true}` / `pointerEvents: open ? … : "none"` computed in
   `Sheet`'s render is therefore baked in as `undefined` **for the whole exit window** — D-19 items
   3 and 4 silently never happen, and every test written against the open state still passes. The
   only mechanism that works is **`useIsPresent()` called inside a child component**, which does
   re-render because `PresenceChild` re-creates its context value when `isPresent` flips.
   *(Verified by live probe — §Verification Addendum. This finding corrects the earlier draft of
   this document; §Pattern 3, §Pitfall 14 and §Code Examples all carry the fix.)*

Beyond those: the one-resize contract is achievable **only** if the header leaves the flow in the
*same commit* as the reserve collapse (if `AnimatePresence` unmounts the header at exit-complete,
`<main>` grows late and a second `ResizeObserver` callback fires); `useFocusTrap`'s teardown
already fires at close-start (React runs an effect cleanup on dep change, not only on unmount), so
D-19's real work is the `aria-hidden`/`pointer-events` layer and its *ordering* against the focus
restore; jsdom 29.1.1 implements neither `ResizeObserver`, nor `Element.animate`, nor `inert`, nor
`scrollIntoView`, which dictates every assertion technique in §Validation Architecture — **but it
does run motion's rAF fallback correctly end-to-end**, which changes the D-20 test strategy
(§Verification Addendum); and `dexie-react-hooks` 4.4.0's `useLiveQuery(querier, deps,
defaultResult)` third argument is a real, source-verified pending sentinel that resolves CR-02
without adding a `loaded` flag.

**Primary recommendation:** land the sheet slice as `portal → AnimatePresence → motion.div`, with
the close-start attributes driven by `useIsPresent()` inside a `SheetSurface` child (never by
`open`), ship exit + close-start for the ten `open`-prop-driven instances, and make the chrome
toggle a single React commit that (a) collapses `--gz-chrome-reserve`, (b) takes `<header>` out of
flow, and (c) applies `inert` — with the transform animation strictly on top of that commit, never
gating it.

## Verification Addendum — live probes run in this repository

Four claims in this document are lifecycle claims that source-reading alone cannot settle. They were
executed as temporary Vitest files under `packages/app/test/` (real `motion@12.42.2`, real
`jsdom@29.1.1`, the repo's own `test/setup.ts`), observed, and the files deleted. `git status` is
clean of them. Results:

| # | Probe | Result | Consequence |
|---|---|---|---|
| P1 | Render `createPortal(<AnimatePresence>{open && <Surface/>}</AnimatePresence>, body)`; flip `open` false; assert **synchronously**, before any timer | Node still in the DOM `true`; `aria-hidden="true"`; `pointer-events: none`; `#app-content.inert === false`; `document.activeElement === trigger` | **The whole D-19 close-start contract is achievable and observable.** `useFocusTrap`'s cleanup fires at close-start for free; `useIsPresent()` supplies items 3 and 4. |
| P2 | Same probe, but with the close-start attributes derived from the **`open` prop** instead of `useIsPresent()` | `aria-hidden` and `pointerEvents` stay `undefined` for the entire exit | **§Pitfall 14.** This is the defect the earlier draft's §Code Examples contained. |
| P3 | Wait ~600 ms after close | Node removed; `onAnimationComplete` fired | **Exit animations complete under jsdom.** motion falls back off WAAPI (`Element.prototype.animate === undefined`) to its rAF loop, which Vitest's jsdom env drives. **The D-20 test does not need a hand-rolled `AnimatePresence` double** — see §Code Examples. |
| P4 | `onAnimationComplete` on the **enter** | Fires once with definition `{ y: 0 }` and `useIsPresent() === true` | **D-27 is implementable**, and enter/exit completions are distinguishable *by presence*, not by the frozen `open` prop (§Pitfall 12 corrected). |
| P5 | Unmount the whole tree containing `AnimatePresence` | Node gone at 0 ms and at 400 ms | Confirms §Pitfall 1's mechanism empirically, not just by reasoning. |
| P6 | `style.transform` after the enter settles | `"none"`; `willChange` never set | The `position: fixed`-descendant containing-block hazard (Phase-21 D-28) is confined to the ~200 ms window. A grep found **no** `position: fixed` descendant in any current `<Sheet>` consumer, so current exposure is zero — record it as a forward-looking constraint. |
| P7 | `lucide-react@1.23.0` export probe | `Maximize2`, `Minimize2`, `Smartphone` all present | Closes assumption A4. |
| P8 | Standalone jsdom 29.1.1 probe | `'inert' in HTMLElement.prototype === false`; `el.inert = true` reflects **no** attribute; `document.querySelector("[inert]")` finds nothing; `scrollIntoView === undefined` | Confirms §Pitfall 7 and §Pitfall 11 exactly as written. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sheet enter/exit choreography | Browser / Client (React render tree) | — | Pure presentation; `motion` runs on the main thread inside the client bundle. No core, no network. |
| Sheet a11y lifecycle (focus, `inert`, Escape) | Browser / Client (DOM APIs) | — | `document.activeElement`, `inert`, the LIFO dismiss stack — all DOM-only. `packages/core` must never see these (CLAUDE.md core purity). |
| Chrome visibility state | Browser / Client (module-level store) | — | D-11 pins it as non-persisted component/module state. No Dexie, no `db.meta`, no Supabase row. |
| Bottom-space arithmetic | Browser / Client (CSS custom properties on `documentElement`) | — | Single owner `layout/bottomSpace.ts` (Phase-21 FOUND-02). Values are *composed strings*, resolved by the CSS engine — not computed in JS. |
| Constellation resize response | Browser / Client (`ResizeObserver` → React state → canvas) | — | `ConstellationCanvas` owns it; the chrome module must never reach into it. |
| `beforeinstallprompt` capture | Browser / Client (module-load `window` listener) | — | One-shot browser event; must be captured before React mounts (D-33). |
| Install-mode detection | Browser / Client (`matchMedia` / `navigator.standalone`) | — | Read once at load (D-36); no server involvement — this app has no backend tier for chrome/PWA concerns. |
| Setlist row resolution (CR-02) | Database / Storage (Dexie `archiveShows`) | Browser / Client (`useLiveQuery`) | The pending-vs-missing distinction is a *storage-layer observable* fact; the UI only renders the two states. |

No capability in this phase belongs to a server, API, or CDN tier. Supabase is untouched.

## Standard Stack

### Core — all already installed; **zero new runtime dependencies** (CLAUDE.md standing constraint)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` | 12.42.2 | `AnimatePresence` + `motion.div` + `useReducedMotion` + **`useIsPresent`** | Already a dependency and already the app's idiom (`WaveToast`, `BingoCelebration`, `OrbitStage`, `ShowView`). Verified installed at `node_modules/motion@12.42.2` re-exporting `framer-motion@12.42.2`. `useIsPresent(): boolean` is a typed public export. [VERIFIED: `node_modules/motion/package.json`, `framer-motion/dist/index.d.ts:1383`] |
| `react` / `react-dom` | 19.2.7 | `createPortal`, `useSyncExternalStore`, boolean `inert` prop | React 19 is the first version that renders `inert` as a real boolean attribute from JSX. [VERIFIED: `react-dom-client.development.js` boolean-attribute switch, line ~3063] |
| `dexie-react-hooks` | 4.4.0 | `useLiveQuery(querier, deps, defaultResult)` | The 3-arg overload is the pending sentinel CR-02 needs. [VERIFIED: installed `dist/useLiveQuery.d.ts` + `src/useObservable.ts`] |
| `vitest` + `@testing-library/react` | 4.1.10 / 16.3.2 | jsdom assertions | Existing harness. |

### Supporting (already present)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 1.23.0 | Chrome-toggle icon + install glyph | UI-SPEC picks `Maximize2` / `Minimize2` (toggle) and `Smartphone` (install). **All three verified present as live exports of the installed build** (probe P7) — assumption A4 is closed. |
| `jsdom` | 29.1.1 | Test environment | Its *absences* are load-bearing (§Pitfall 7/11) — but it **does** drive motion's rAF fallback to completion (probe P3), which is equally load-bearing for the D-20 test. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `AnimatePresence` deferred unmount | Local `mounted` state + `setTimeout(duration)` in `Sheet` | Rejected by D-23, and correctly: it re-implements interruption handling, and a timer desyncs from the real animation under reduced motion / background tabs. |
| `useIsPresent()` for the close-start attributes | `AnimatePresence custom={…}` + `usePresenceData()` | `custom` exists precisely because exiting children cannot receive prop updates [CITED: motion.dev/docs/react-animate-presence], but it is an extra indirection for a boolean the child can read directly. Reach for `custom` only when the exiting node needs *data*, which it does not here. |
| JSX `inert` prop on chrome | The existing imperative `setRootInert` helper | The helper targets `#app-content` by id and is ref-counted for *sheet stacking*; chrome is a different concern with a different lifetime. Using it would also leave nothing attribute-assertable in jsdom (§Pitfall 7). |
| A `PENDING` symbol sentinel for CR-02 | Object-wrapping the querier (`async () => ({ row: await … })`) | Equivalent; the wrap needs no third argument and no union with a symbol type. Either is fine — pick one and be consistent. |

**Installation:** none. Any `npm install` in this phase is a constraint violation.

## Package Legitimacy Audit

**No packages are installed in this phase.** Every library named above is already in
`packages/app/package.json` and already in `node_modules` at the version stated, verified by
direct read of the installed files rather than a registry lookup. The Package Legitimacy Gate
(slopcheck / registry / postinstall checks) is therefore **not applicable** — there is no install
surface to audit.

| Package | Registry | Disposition |
|---------|----------|-------------|
| — | — | No new packages. CLAUDE.md "zero new runtime dependencies" holds. |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

If the planner finds itself reaching for a package (a focus-trap library, a `use-resize-observer`
hook, a `usehooks-ts` helper), that is a signal the mechanism section below was not read — every
one of those is already hand-owned in this codebase.

## Architecture Patterns

### System Architecture Diagram

```
                      ┌──────────────── user input ────────────────┐
                      │                                            │
              [tap chrome toggle]                         [tap sheet trigger]
                      │                                            │
                      ▼                                            ▼
        ┌──────────────────────────────┐            ┌──────────────────────────┐
        │ chromeVisibility store       │            │ consumer sets `open`     │
        │ (module, useSyncExternalStore│            │ (or mounts the surface)  │
        │  — the bottomOverlayInset    │            └────────────┬─────────────┘
        │  template, D-12)             │                         │
        └───────────┬──────────────────┘                         ▼
                    │                              ┌───────────────────────────┐
     ONE React commit, in this order:              │ <Sheet>                   │
                    │                              │  createPortal(body)       │  ← outer
       ┌────────────┼────────────┐                 │   └ AnimatePresence       │  ← inner (MUST)
       ▼            ▼            ▼                 │      └ <SheetSurface>     │  ← reads
 useBottomSpace  <header>     <BottomTabBar>       │         useIsPresent()    │    presence
 Vars(visible)   position:     (already fixed —    │         ├ motion.div scrim│
       │         absolute      no layout cost)     │         └ motion.div card │
       ▼         + inert                           └────────────┬──────────────┘
 setProperty(                                                   │
  --gz-chrome-                                      open=false  →  CLOSE-START
  reserve, …)                                         ├ release inert (ref-counted)
       │                                              ├ restore focus → trigger
       ▼                                              ├ aria-hidden  ← useIsPresent()
  ── browser layout (ONE pass) ──                     ├ pointer-events:none (card+scrim)
       │                                              └ drop scrim onClick
       ▼
 ResizeObserver "update the rendering"              exit animation runs (~200ms)
 delivers ONE entry                                          │
       │                                                     ▼
       ▼                                            AnimatePresence unmounts
 ConstellationCanvas setSize({w,h})                  (DOM removal — the ONLY thing
       │                                              that waits for the animation)
       ├─→ ForceGraph2D width/height (canvas resizes)
       └─→ spacing effect → d3ReheatSimulation()  ← FIRES; inert because fx/fy are pinned
                    │
                    ▼
             onEngineStop → firstSettleRef === false → zoomToFit NOT called  ✔ CHROME-05(b)

   ── transform animation runs ON TOP of the settled box; costs no layout ──
```

### Recommended Project Structure

```
packages/app/src/
├── components/
│   ├── Sheet.tsx                  # portal → AnimatePresence → <SheetSurface> (restructured)
│   ├── AppShell.tsx               # header out-of-flow + inert when hidden; passes chromeVisible
│   ├── BottomTabBar.tsx           # reads the NEW --gz-tab-bar-box, not --gz-chrome-reserve
│   └── a11y/
│       └── useFocusTrap.ts        # teardown split: release() is idempotent + layout-timed
├── layout/
│   ├── bottomSpace.ts             # + --gz-tab-bar-box; useBottomSpaceVars(chromeVisible)
│   └── chromeVisibility.ts        # NEW — useSyncExternalStore module (D-12)
├── explore/
│   ├── ExploreView.tsx            # renders the toggle FIRST; drives the store (D-03)
│   └── ChromeToggle.tsx           # NEW — the ≥44px always-rendered control (D-01/D-02)
├── pwa/
│   ├── bottomOverlayInset.ts      # + declared order + per-id cumulative offset (CR-01)
│   └── install/
│       └── installStore.ts        # NEW — module-load beforeinstallprompt singleton (D-33)
├── settings/
│   └── InstallSection.tsx         # NEW — bottom-of-Settings, three-way, gated (D-32)
└── dex/
    └── SetlistView.tsx            # pending-vs-missing split + escapable error state (CR-02)
```

---

### Pattern 1 — `AnimatePresence` MUST be inside `createPortal`, never outside it

**What:** The portal is the outer layer; `AnimatePresence` and the `motion.div`s are its children.

**Why (mechanism, verified from installed source):**

`node_modules/framer-motion/dist/es/components/AnimatePresence/utils.mjs`:

```js
function onlyElements(children) {
    const filtered = [];
    Children.forEach(children, (child) => {
        if (isValidElement(child)) filtered.push(child);   // ← the gate
    });
    return filtered;
}
```

`node_modules/react/cjs/react.development.js:268`:

```js
function isValidElement(object) {
  return "object" === typeof object && null !== object
      && object.$$typeof === REACT_ELEMENT_TYPE;   // Symbol.for("react.transitional.element")
}
```

and `REACT_PORTAL_TYPE = Symbol.for("react.portal")` is a **different symbol**. So a portal child
fails `isValidElement`, `presentChildren` is `[]`, and `AnimatePresence` renders an empty fragment.
Not a warning — silence. [VERIFIED: read from `node_modules`, react 19.2.7 / framer-motion 12.42.2]
[CITED: https://github.com/framer/motion/issues/2692 — "AnimatePresence only works when sent as
children to createPortal; it's not effective when it's the parent of createPortal"]

**Consequence for `Sheet.tsx`:** the `if (!open) return null` guard (V7 / T-08-04) must be
*replaced*, not merely moved — the component now always returns the portal, and emptiness is
expressed by `AnimatePresence` having no child.

```tsx
// Sheet.tsx — the shape (probe P1 ran exactly this and it works)
if (typeof document === "undefined") return null;   // SSR/jsdom guard STAYS

return createPortal(
  <AnimatePresence>
    {open && <SheetSurface key="sheet" … />}       {/* the child reads useIsPresent() */}
  </AnimatePresence>,
  document.body,
);
```

**The V7 test still passes unchanged.** `sheet.a11y.test.tsx` asserts `container.firstChild ===
null` (true — portal content never lands in the render container) and `queryByRole("dialog") ===
null` (true — no child rendered). A portal with no children creates **zero** DOM nodes; nothing is
added to `document.body`.

**The Phase-21 D-24 portal invariant still holds.** `layerOrder.test.tsx` / `sheet.a11y.test.tsx`
assert `dialog.parentElement === document.body`. With the shape above, the *scrim* becomes body's
direct child and the dialog is its child — **this changes `dialog.parentElement`**. Two options,
and the planner must pick deliberately:
  - (a) keep today's nesting (scrim wraps card) and update the D-24 assertion to
    `document.body.contains(dialog) && !container.contains(dialog)`; or
  - (b) render scrim and card as **siblings** under `AnimatePresence` (two keyed children), which
    keeps `dialog.parentElement === document.body` byte-identical and also lets the scrim and card
    animate on genuinely independent timelines — which D-24's "parallel cross-fade" wants anyway.

**(b) is the recommendation.** It preserves a shipped invariant rather than editing it, and it is
the more honest structure for two things that fade/translate in parallel. It does require the card
to own its own `justify-end` positioning (`fixed inset-x-0 bottom-0`) instead of inheriting the
scrim's flex column.

**A third reason for (b), from §Pitfall 4/14:** `pointer-events: none` on an ancestor does **not**
override a descendant that declares `pointer-events: auto` — and today's card carries exactly that
class. Under the nested shape the flag must be set in two places and silently half-works if one is
missed; as siblings, both elements set it explicitly and the rule is structural.

---

### Pattern 2 — the enter/exit prop shape, following the shipped `WaveToast` idiom

```tsx
const reduce = useReducedMotion() ?? false;      // typed `boolean | null` — the `?? false` matters
const isPresent = useIsPresent();                // ← inside SheetSurface, NOT in Sheet
const { SHEET_MS, SHEET_EASE_ENTER, SHEET_EASE_EXIT } = config.ui.motion;   // D-25: never a literal 0.2

// bottom-sheet card (D-24: slide + parallel scrim fade; D-26: fullscreen fades only)
<motion.div
  key="sheet-card"
  initial={reduce ? { opacity: 0 } : { y: "100%" }}
  animate={reduce ? { opacity: 1 } : { y: 0 }}
  exit={reduce    ? { opacity: 0 } : { y: "100%" }}
  transition={{ duration: SHEET_MS / 1000, ease: isPresent ? SHEET_EASE_ENTER : SHEET_EASE_EXIT }}
  onAnimationComplete={() => { if (isPresent) focusInitialTarget(); }}   // D-27, see Pitfall 12
/>
```

- `y: "100%"` (percentage) rather than a pixel value: the sheet's height is content-driven and
  varies per surface, so a fixed px translate under-shoots tall sheets. Percentage transforms
  resolve against the element's own box.
- The reduced path drops the translate and keeps opacity — the `WaveToast:164-166` idiom, so
  nothing reads as a different app.
- `variant === "fullscreen"` uses the opacity-only pair in **both** motion modes (D-26).
- **UI-SPEC conformance note:** `22-UI-SPEC.md` §Per-variant motion specifies the bottom-sheet card
  as `y: "100%" → 0`, **opacity unchanged**, with only the scrim cross-fading. The non-reduced card
  keyframes above therefore carry **no** `opacity` key. Adding `opacity: 0` to the card's
  non-reduced enter/exit (as an earlier draft did) is a deviation from the approved contract and
  also double-fades the card against the scrim.
- **The `ease` is presence-derived, not `open`-derived** — same reason as §Pitfall 14. A frozen
  `open` would keep the enter easing on the way out.

---

### Pattern 3 — splitting `useFocusTrap`'s teardown from unmount (D-19)

**The teardown already fires at close-start.** This is the single most useful thing to know before
planning this refactor, and it is easy to get wrong in the other direction (over-engineering it).

`useFocusTrap`'s effect is `useEffect(() => { if (!active) return; …; return cleanup }, [active,
ref, initialFocusRef])`. React runs the previous effect's cleanup **whenever a dep changes**, not
only on unmount. `Sheet` passes `active: open && modal`. So the instant `open` flips false, React
runs `cleanup` → `setRootInert(false)` + `restoreTo.current?.focus()`. That is close-start, today,
already. Nothing about deferred unmount changes it, because `active` is derived from `open`, never
from presence. **Confirmed by probe P1**: `#app-content.inert === false` and
`document.activeElement === trigger` were both true synchronously after the close, while the sheet
node was still in the DOM.

**So do NOT rewrite the hook to be presence-driven.** The invariant to preserve is: *`active` is a
function of `open`, never of "is this still in the DOM".* A source-level guard on that would be
cheap and would prevent a future regression.

**What is genuinely new (three things):**

1. **`aria-hidden` on the exiting card** and **`pointer-events: none` on card + scrim** — both a
   pure function of **`useIsPresent()`**, evaluated inside the child that `AnimatePresence` renders.
   **They must NOT be derived from `open`** (§Pitfall 14 — the exiting element's props are frozen):
   ```tsx
   // inside SheetSurface — the component AnimatePresence renders as its child
   const isPresent = useIsPresent();
   const closing = {
     "aria-hidden": isPresent ? undefined : true,
     style: { pointerEvents: isPresent ? undefined : ("none" as const) },
   };
   // scrim: drop the handler while exiting, see Pitfall 4b
   onClick={isPresent && backdrop ? onClose : undefined}
   ```
2. **Ordering** — the focus restore must complete *before* `aria-hidden` lands (see Pitfall 4).
   Probe P1 observed the correct ordering with a passive-effect cleanup, because React applies DOM
   mutations before running effect cleanups; §Pitfall 4 explains why a layout effect is still the
   safer contract to write down.
3. **`initialFocusRef` deferral to enter-complete** (D-27) — the hook must stop performing that
   focus move eagerly.

**Recommended hook API** (all 16 consumer files keep working unchanged, because they never call
`useFocusTrap` — only `Sheet.tsx` does):

```ts
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  { active, initialFocusRef }: { active: boolean; initialFocusRef?: RefObject<HTMLElement | null> },
): {
  /** D-27: focus the initialFocusRef target. Call from onAnimationComplete when present. */
  focusInitialTarget: () => void;
};
```

- On activate, focus **the container** (`tabIndex={-1}`) or the first focusable — never
  `initialFocusRef`. This keeps focus inside the trap from frame 0 (a 200ms window with focus
  parked on a now-`inert` trigger would strand keyboard/VO users), while avoiding D-27's
  input-focus-during-translate hazard.
- `focusInitialTarget()` is a no-op when no `initialFocusRef` was given, and is idempotent.
- Change the effect to **`useLayoutEffect`** so its destroy runs synchronously in the commit's
  mutation phase rather than after paint (Pitfall 4).
- **Pair `onAnimationComplete` with a `SHEET_MS` fallback timer**, cleared by whichever fires first.
  If the animation is interrupted, cancelled, or never scheduled (background tab, a future
  `MotionConfig skipAnimations`), the callback may not fire and the text input never gets focus.
  Focusing an already-focused element is a no-op, so a double-fire is harmless; a never-fire strands
  the user. Do not ship the callback alone.

**Ordering hazard with ref-counted `inert` under stacking (D-19 + stacked sheets):** `setRootInert`
is ref-counted and guards underflow only at zero (`if (inertCount === 0) return`). Consider sheet A
open and sheet B closing: count is 2, B releases → 1, background stays inert. Correct. **But if
the release runs twice for the same sheet** — once imperatively at close-start and again from the
effect cleanup at unmount — the count drops 2 → 0 while A is still open, and the background
becomes interactive underneath an open modal. **Guard `release()` with a per-hook-instance
`releasedRef` boolean, reset on activate.** This is the one concrete ordering hazard the deferred
unmount introduces, and it is invisible in a single-sheet test — it needs the existing
"stacked modals" case in `sheet.a11y.test.tsx` extended to cover a *closing* stacked sheet.

---

### Pattern 4 — the one-commit chrome collapse (D-07, D-09, CHROME-05)

**The mechanism question was:** does changing a CSS custom property produce a single layout pass
and therefore a single `ResizeObserver` entry, or can it batch differently?

**Answer:** `ResizeObserver` notifications are delivered from the HTML "update the rendering" step,
once per frame, and the spec tracks `lastReportedSizes` so a callback fires only when the *current*
size differs from the last reported one. Multiple style mutations inside one frame collapse to one
delivery per observed element. [CITED: https://drafts.csswg.org/resize-observer/ — "gather active
resize observations at depth" / "broadcast active resize observations" are invoked during "update
the rendering"; `lastReportedSizes` gates delivery]

So **one resize is guaranteed by keeping every layout-affecting mutation in one React commit**, not
by anything about custom properties specifically. Concretely, for one toggle these must all land in
the same commit:

| Mutation | Where | Layout cost |
|---|---|---|
| `--gz-chrome-reserve` collapses | `useBottomSpaceVars()` → `useLayoutEffect` on `documentElement` | `<main>`'s `padding-bottom` shrinks → stage `flex-1` grows |
| `<header>` leaves the flow | `AppShell` renders `position: absolute; top:0; left:0; right:0` | header's height is returned to the column → stage grows |
| `<main>` reserves the **top** safe-area inset | `AppShell` — `paddingTop: "env(safe-area-inset-top)"` while hidden | keeps the stage below the status bar (D-13). **See the trap below.** |
| `<header>` / `<nav>` get `inert` + `aria-hidden` | `AppShell` JSX props | none |
| transform animation starts | `motion` on header + nav | **none** — `transform` is composited and does not affect the content box a `ResizeObserver` reports |

`useBottomSpaceVars()` is already a **layout** effect (deliberately — see its own doc comment), so
the `setProperty` calls run synchronously after the mutation phase of the same commit, before
paint, before the frame's "update the rendering" step. One layout, one RO delivery.

**The trap this pattern exists to avoid:** if `<header>` is unmounted by `AnimatePresence` at
exit-complete (the natural reading of D-08's "unmount at end"), the header's height stays in the
flex column for the whole ~200ms exit and is only returned to `<main>` at unmount — producing a
**second** `ResizeObserver` callback 200ms later, and a visible second reflow of the constellation.
D-07's "the box collapses FIRST" is therefore an instruction about *flow participation*, not about
DOM presence: the header must go `position: absolute` at animation START and may unmount whenever.

**The second trap — the top inset disappears with the header.** `env(safe-area-inset-top)` is
reserved today *only* by the header's own `paddingTop: calc(env(safe-area-inset-top) + 12px)`
(`AppShell.tsx:48`). The instant the header leaves the flow, nothing reserves it and `<main>` starts
at viewport y=0 — **the constellation runs under the notch**, contradicting D-13. This is invisible
on desktop, where the inset is `0`. The minimal fix is a bare `env(safe-area-inset-top)` read on
`<main>` while chrome is hidden: no arithmetic, matching the shipped per-surface top-inset idiom
that `styles.css:30` explicitly places **out of scope** for the Phase-21 bottom-inset guard (there
are already 10 such reads in `src/`), and landing in the same commit so the one-resize claim holds.
Hoisting `env(safe-area-inset-top)` into a `--gz-safe-top` on `:root` (mirroring `--gz-safe-bottom`)
is the better long-term shape but touches ten surfaces including five device-verified sheets and can
change where the header's `bg-elevated` starts painting — **record it as a follow-on, do not do it
here.**

**Symmetry on show.** Restoring chrome re-inserts the header into the flow and restores the reserve
in one commit at animation START, then slides the chrome in on top. Accepted, named cost: for
~200ms the stage is shrunk while the chrome is still off-screen, so a thin band at the top/bottom
reads as empty. The alternative (restore flow at animation END) is a second resize and violates
CHROME-05. Take the band.

**`useBottomSpaceVars` signature change:** it must accept `chromeVisible` and include it in the
`useLayoutEffect` dep array. `applyBottomSpaceVars(root, overlayInset, chromeVisible)` already
takes the third argument — only the hook is missing it.

**Both halves must be driven by the SAME synchronous path.** `useSyncExternalStore` + the existing
layout effect gives that. If any part of the collapse is deferred to a passive `useEffect`, a second
`requestAnimationFrame`, or a second store hop, the box changes across two frames and CHROME-05
becomes false on device while still passing in jsdom.

---

### Pattern 5 — "first in tab order" is a DOM-order fact (CHROME-03)

The exit control must be **first in tab order**. Do **not** reach for a positive `tabIndex` — a
`tabIndex > 0` control jumps ahead of the entire document's natural order and is a well-known a11y
anti-pattern that also breaks as soon as a modal opens.

The mechanism that satisfies CHROME-03 literally: **while chrome is hidden, every other chrome
control is `inert`**, and the toggle is rendered *before* the constellation stage's interactive
content in DOM order within `ExploreView`. `inert` removes the header's menu button and all six tab
buttons from the tab order entirely, so the toggle is genuinely first with `tabIndex` untouched.
That makes the requirement a consequence of CHROME-04 rather than a second mechanism.

Assertion technique: query `document.querySelectorAll(FOCUSABLE_SELECTOR)` (the same selector
string `useFocusTrap` already exports the shape of), filter out anything inside an `[inert]`
ancestor, and assert index 0 is the toggle. That is a real positive assertion, not a source guard.

---

### Pattern 6 — `inert` on animating-out chrome (D-08, CHROME-04)

**Use the React 19 JSX boolean prop, not the imperative helper.**

React 19.2.7 lists `inert` in its boolean-attribute switch, so `inert={true}` renders `inert=""`
and `inert={false}` removes the attribute. [VERIFIED: `node_modules/react-dom/cjs/react-dom-client.development.js:3063`, `:3122`]

```tsx
<header inert={!chromeVisible} aria-hidden={chromeVisible ? undefined : true} …>
<nav    inert={!chromeVisible} aria-hidden={chromeVisible ? undefined : true} …>
```

Note these two are driven by the **store**, not by presence — the chrome elements are rendered by
`AppShell`, which re-renders on every store change, so §Pitfall 14 does not apply to them *provided
`AppShell` keeps rendering them while they exit*. If the chrome is instead wrapped in its own
`AnimatePresence` and removed from `AppShell`'s output at hide-time, the same frozen-props trap
applies and these props must come from `useIsPresent()` too. **Prefer keeping them in `AppShell`'s
output and driving `inert` from the store** — one fewer place for the trap to appear.

**Interaction with `components/a11y/inertRoot.ts`:** none, and that is the point. `setRootInert`
targets `#app-content` by id and ref-counts *sheet* stacking. `#app-content` is an ancestor of both
`<header>` and `<nav>`, so when a modal sheet is open the whole shell is already inert; adding
`inert` to a descendant is a harmless no-op (inertness is inherited and not un-settable by a
descendant). There is no counter to coordinate and no shared state — **do not fold the chrome's
`inert` into the ref-counted helper.** Two different lifetimes sharing one counter is precisely how
the underflow in §Pattern 3 happens.

**Browser support:** `inert` is **Baseline widely available since April 2023**, and it removes the
subtree from the accessibility tree, the tab order, pointer events, text selection and find-in-page
in one attribute. [CITED: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert]
The app already depends on it for every modal sheet (`inertRoot.ts` ships today and was
device-verified in Phase 8), so this phase adds no new platform risk. **`inert` is what actually
satisfies CHROME-04** — the D-08 unmount is belt-and-braces on top of it.

**`aria-hidden` alongside `inert` is belt-and-braces, not redundant-and-wrong**, because the header
and nav never contain focus while hidden (focus lives on the toggle, which is outside them). The
"aria-hidden on a focused subtree" violation described in Pitfall 4 applies to the *sheet*, not to
chrome.

---

### Pattern 7 — the `beforeinstallprompt` module-level singleton (D-33, D-36)

Template is `pwa/bottomOverlayInset.ts` (module state + `Set<listener>` + a cached `snapshot`
recomputed only in `notify()`). Shape:

```ts
// pwa/install/installStore.ts
interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<…>; }

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// D-36: evaluated ONCE at module load. A page cannot transition into standalone.
const installed = typeof window === "undefined" ? false : isStandalone();
const ios       = typeof window === "undefined" ? false : isIosSafari();

// ⚠ CACHED object — recreated ONLY in notify(). See Pitfall 9.
let snapshot: InstallSnapshot = { canInstall: false, isIos: ios, isInstalled: installed };

function notify(): void {
  snapshot = { canInstall: deferred != null, isIos: ios, isInstalled: installed };
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
}

export function subscribeInstall(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function getInstallSnapshot(): InstallSnapshot { return snapshot; }
export function getInstallServerSnapshot(): InstallSnapshot { return SERVER_SNAPSHOT; } // module const
export async function promptInstall(): Promise<void> {
  const d = deferred; if (!d) return;
  await d.prompt(); await d.userChoice;   // ⚠ NO await BEFORE prompt() — see below
  deferred = null; notify();          // ← every subscriber loses canInstall together (the D-33 bug fix)
}
export function __resetInstallStoreForTests(): void { … }   // mirrors bottomOverlayInset's escape hatch
```

`useInstallState()` becomes `useSyncExternalStore(subscribeInstall, getInstallSnapshot,
getInstallServerSnapshot)` spread with the still-component-local `dismissed`/`dismiss` (only
`InstallBanner` reads those; hoisting them would change behavior D-37 says not to touch).

**`prompt()` is gesture-bound.** The shipped `useInstallState.promptInstall` calls it with no
preceding `await` (`useInstallState.ts:59-66`) — **preserve that**. Inserting any `await` (an
analytics call, a Dexie read) before `prompt()` breaks the user-gesture chain on Chromium and the
prompt silently never appears, which is indistinguishable from the bug D-33 is fixing.

**Timing is safe.** `useInstallState.ts` is imported (transitively, via `App.tsx` →
`AppMenu`/`InstallBanner`) during initial bundle evaluation, i.e. before `createRoot().render()`.
`beforeinstallprompt` fires after the manifest and service worker are evaluated — strictly later.
The one-shot event cannot be missed. If any consumer is ever lazily imported, add an explicit
side-effect import in `main.tsx`.

**Three consumers converge:** `AppMenu` (D-34's single neutral row, gated on `!isInstalled`),
`InstallBanner` (unchanged code, D-37, gets the shared capture for free), and the new
`InstallSection` in Settings (D-32, same `!isInstalled` gate as the row so they cannot disagree).

---

### Pattern 8 — deep-link to a Settings section + focus move (D-35, NAV-05)

No fragment parsing, no new route, no change to `ROUTES` (`settings` is already a member —
`routing/useHashRoute.ts:9-18`). Use a **one-shot module flag**:

```ts
// settings/installSectionFocus.ts
let requested = false;
export function requestInstallSectionFocus(): void { requested = true; }
export function consumeInstallSectionFocus(): boolean { const r = requested; requested = false; return r; }
```

`AppMenu`'s row: `requestInstallSectionFocus(); navigate("settings"); onClose();`
`SettingsView`: a `useEffect` that calls `consumeInstallSectionFocus()` and, if true, does
`headingRef.current?.scrollIntoView?.({ block: "start" })` then `headingRef.current?.focus()`.
The heading carries `tabIndex={-1}`.

**Why an effect (not a layout effect) wins the ordering race against the sheet's focus restore:**
`AppMenu` closing restores focus to the header Menu button at close-**start** — in the *current*
commit. The route change re-renders `App`, mounting `SettingsView` in a **later** commit; its
effect therefore runs strictly after the restore. Any earlier timing (a `useLayoutEffect` in the
menu row's own click handler) would be clobbered.

**The section must exist in the DOM before the scroll/focus fires** — it does, because the effect
runs after `SettingsView`'s commit. But note the section is gated on `!isInstalled`; when installed
it renders nothing and the deep-link is unreachable, which is exactly D-34's shared-gate behavior
(the row is hidden too). No dangling focus target.

---

### Pattern 9 — ordered bottom-overlay stacking (CR-01)

The store already measures every height; it needs an *order* and a per-id **cumulative offset**.

```ts
// config.ui — declared order, bottom-most FIRST
BOTTOM_OVERLAY_ORDER: ["installBanner", "updateToast", "backupToast", "bingoCelebration", "waveToast"] as const,
```

```ts
// bottomOverlayInset.ts — new export, alongside the existing sum
export function offsetBelow(id: string): number {
  const order = config.ui.BOTTOM_OVERLAY_ORDER as readonly string[];
  const i = order.indexOf(id);
  const rank = i === -1 ? order.length : i;      // unknown id → topmost; never throw
  let total = 0;
  for (const [otherId, h] of heights) {
    const j = order.indexOf(otherId);
    if ((j === -1 ? order.length : j) < rank) total += h;
  }
  return total;
}
export function useBottomOverlayOffset(id: string): number { /* useSyncExternalStore, number snapshot */ }
```

Each overlay's style becomes `bottom: \`calc(var(--gz-chrome-reserve) + ${offset}px)\``.

Three properties that make this safe:

- **No feedback loop.** Offset change → re-render → `ResizeObserver` re-measure → same
  `offsetHeight` → `setBottomOverlayHeight` early-returns on an unchanged value → no notify.
- **`<main>` needs no change.** `--gz-content-reserve = chrome-reserve + sum(heights)` currently
  *over*-reserves because overlays overlap; once they genuinely stack, the sum **is** the occupied
  height. The shipped `"sums multiple simultaneously-registered overlays"` test stays valid and
  becomes newly *correct* rather than merely safe.
- **Returns a number, not an object** — sidesteps the `getSnapshot` caching footgun entirely
  (Pitfall 9). Keep it that way; do not return `{offset, total}`.

**Positive assertion required (the STATE.md lesson).** A pattern-matching source guard cannot catch
an overlay that simply omits its offset — that is exactly how the `ArchiveBrowser` bug shipped
(`61e0b90`). Write a guard that greps every `useBottomOverlayHeightRegistration("<id>", …)` literal
out of `src/` and asserts each one appears in `config.ui.BOTTOM_OVERLAY_ORDER` — that is an
*omission-detecting* guard (it fails when a new overlay is added and not ordered), which is the
class of guard Phase 21 lacked.

---

### Pattern 10 — CR-02: distinguishing "loading" from "no such row"

`dexie-react-hooks` 4.4.0 has a real pending sentinel. From the installed source
(`node_modules/dexie-react-hooks/src/useLiveQuery.ts` + `useObservable.ts`):

```ts
export function useLiveQuery<T, TDefault>(querier, deps: any[], defaultResult: TDefault): T | TDefault;
```

`useObservable` seeds `monitor.current.result = defaultResult` and only replaces it once the
observable emits. Dexie's `liveQuery` observable implements `hasValue()` (returns `false` until a
value exists — `node_modules/dexie/dist/modern/dexie.mjs:6149`), so the synchronous
"subscribe-and-unsubscribe to grab a current value" fast path is skipped and `defaultResult` really
is what renders during the pending window. [VERIFIED: read from installed dexie 4.4.4 /
dexie-react-hooks 4.4.0]

Two equivalent shapes; pick one:

```ts
// (a) sentinel via the third argument
const PENDING = Symbol("pending");
const cache = useLiveQuery(() => db.archiveShows.get(showId), [showId], PENDING);
const loading = cache === PENDING;
const missing = cache === undefined;          // resolved, no row
```

```ts
// (b) object-wrap — no third argument, no symbol in the type union
const wrapped = useLiveQuery(async () => ({ row: await db.archiveShows.get(showId) }), [showId]);
const loading = wrapped === undefined;
const missing = wrapped !== undefined && wrapped.row === undefined;
```

**Documented caveat (verified, and it matters):** `useObservable`'s `monitor` ref keeps
`hasResult: true` across a **deps change**, so on a `showId` change while mounted the hook returns
the *previous* result rather than reverting to pending. `DexView` conditionally mounts
`<SetlistView>`, so today `showId` is fixed for the mount's lifetime — but that is an accident of
the call site, not a guarantee. Add `key={openShow.showId}` to the `<SetlistView>` element in
`DexView.tsx:186` to make the remount structural.

**The permanent state needs a real exit** (the trap in the todo): a `role="dialog"` with a
non-misleading `aria-label` (not `copy.albumBack`), a visible ≥44px Back button wired to
`onClose`, and `useDialogDismiss(true, onClose)` so Escape works. New copy strings in
`config.copy.dex`. Model the tone on `ExploreView`'s `loadMatrix().ok === false` path — calm, blocks
only the view, never bricks navigation.

### Anti-Patterns to Avoid

- **`<AnimatePresence>{createPortal(…)}</AnimatePresence>`** — renders nothing. §Pattern 1.
- **Deriving the exiting sheet's `aria-hidden` / `pointer-events` / `onClick` / `ease` /
  `onAnimationComplete` guard from the `open` prop** — the exiting element's props are frozen, so
  every one of them keeps its *open* value for the whole exit. §Pitfall 14. This is the highest-risk
  mistake in the phase because it passes every naive test.
- **`initial={false}` on the sheet's `AnimatePresence`** — kills the enter animation for the nine
  instances that mount already-open. §Pitfall 3.
- **`mode="popLayout"`** — wraps the child in `PopChild`, which applies `position: absolute` and a
  measured width/height. For a `position: fixed` full-viewport scrim/sheet this destroys the
  geometry. `mode="wait"` is also wrong: it renders *only* exiting children until they finish,
  which delays a re-open. Keep the default `mode="sync"`.
- **`MotionConfig skipAnimations` in the D-20 test** — it is a real prop documented as "useful for
  E2E tests" [VERIFIED: `framer-motion/dist/index.d.ts:243-249`], and it collapses the exact window
  under test to zero. Correct for prop-shape tests; vacuous for the close-start test.
- **Animating the header/tab-bar with `height`, `display`, or `margin`** — every one of those is a
  layout property and every animated frame produces a `ResizeObserver` delivery. Transform only.
- **Asserting `d3ReheatSimulation` is not called** — it *is* called. §Pitfall 8.
- **A positive `tabIndex` on the chrome toggle** — §Pattern 5.
- **Returning a fresh object from any `getSnapshot`** — §Pitfall 9.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deferred unmount for the exit animation | `useState(mounted)` + `setTimeout(200)` | `AnimatePresence` (already a dep) | A timer desyncs from the real animation, ignores interruption (D-22), and double-fires when `open` toggles fast. `AnimatePresence` reverses from the current position for free. |
| Knowing an element is on its way out | A prop, a ref, or a context you own | `useIsPresent()` | Props are frozen on exiting children by design (§Pitfall 14). This is the sanctioned API and it is already a dependency. |
| Focus trap / restore / `inert` | Anything new | `components/a11y/useFocusTrap.ts` + `inertRoot.ts` | Shipped, device-verified in Phase 8. Re-time it; do not re-derive it. |
| Escape handling for the chrome toggle | A local `document` keydown listener | `useDialogDismiss` + `dialogStack` (D-04) | The LIFO discipline is why one Escape closes exactly one thing. A bespoke listener would close chrome *and* a sheet. **Pass a `useCallback`-stable handler** — `useDialogDismiss`'s deps are `[active, onClose]`, so an inline arrow re-pushes the stack on every render and can reorder LIFO. |
| Element size observation | A `window.resize` listener or polling | The existing `ResizeObserver` in `ConstellationCanvas` | `window.resize` does not fire for a container-box change caused by a padding collapse — the exact case here. |
| Cross-component chrome state | Context provider, zustand, prop threading | A `useSyncExternalStore` module (D-12), templated on `bottomOverlayInset.ts` | A provider silently gives nothing to anything portaled outside it (the D-33 rationale) — and the sheets are all portaled. |
| Reading `env(safe-area-inset-*)` from JS | `getComputedStyle(document.body)` | The shipped probe-element technique in `dev/LayoutProbe.tsx` | `env()` cannot be read directly; the probe-div technique is already written and already returns a truthful `0` under jsdom. |
| Distinguishing Dexie loading from missing | A `loaded` boolean + an extra effect | `useLiveQuery(…, deps, defaultResult)` | The library already models it. §Pattern 10. |

**Key insight:** every mechanism this phase needs already exists in this repository, at a verified
version, with a device-verified history. The phase's risk is entirely in **re-timing and
re-structuring** shipped code, not in acquiring new capability — which is exactly why the
regression surface is 19 sheet instances wide and the mitigation is atomic-commit revertibility
(D-17) rather than new abstraction.

## Common Pitfalls

### Pitfall 1 — Nine of nineteen `<Sheet>` instances cannot exit-animate (SHEET-01, SHEET-02)

**What goes wrong:** the phase ships, and roughly half the sheets still vanish instantly on close
— including three of the four surfaces D-21 names for the device session.

**Why it happens:** `AnimatePresence` animates *its own children* leaving. It cannot animate its
own unmount. Nine instances hard-code `open` and are removed by their **parent**, which unmounts
`Sheet` (and its `AnimatePresence`) synchronously. **Confirmed empirically** (probe P5): unmounting
the tree containing `AnimatePresence` removes the node at 0 ms — there is no exit frame at all.

**Full inventory** (verified by grep of `<Sheet` element openings — 19 across 16 files):

| `open` is a prop → **exit works** (10) | hard-coded `open` → **no exit, no close-start window** (9) |
|---|---|
| `IdentityAvatar.tsx:89` | `CompareView.tsx:77` (fullscreen) |
| `AppMenu.tsx:40` | `CompareView.tsx:100` (fullscreen) |
| `ReactionPalette.tsx:97` | `DexView.tsx:206` (fullscreen, self trophy case) |
| `ShareCardSheet.tsx:98` | `FriendDetail.tsx:122` (fullscreen) |
| `CatchUpSheet.tsx:166` | `FriendDetail.tsx:149` (fullscreen) |
| `SwapSheet.tsx:298` | `PinSheet.tsx:73` (**the `initialFocusRef` consumer**) |
| `AvatarSheet.tsx:23` | `PinSheet.tsx:115` |
| `SettingsView.tsx:334` (`namePrompt != null`, **has `initialFocusRef`**) | `TrailNodeSheet.tsx:89` |
| `EndShowDialog.tsx:102` | `WhyDetail.tsx:39` |
| `StartShowNudge.tsx:34` | |

Note `WhyDetail` and `PinSheet` are *always mounted* by their parent but `return null` early when
their state is null (`TrailNodeSheet.tsx:39`, `WhyDetail.tsx:29`) — same effect, the `<Sheet>`
element leaves the tree.

**Every `variant="fullscreen"` consumer is in the right-hand column.** So without a call-site
change, D-26's fullscreen *exit* fade has zero live consumers and cannot be device-verified at all.

**How to avoid:** decide this explicitly in the plan, do not discover it in review. Options:
  - **(A) Accept and record** (the D-16 `SearchSheet` shape): enter animates on all 19; exit and
    the close-start window apply to the 10. Cheapest, zero new blast radius, and consistent with
    D-17's "enter-only is an acceptable degraded ship" already being sanctioned.
  - **(B) Convert per surface**: each parent keeps the sheet mounted and passes
    `open={state != null}`, holding the last non-null payload in a ref so the exiting frame still
    has content to render. ~9 small, individually revertible edits — which is D-17/Phase-21-D-13's
    exact shape, so it is *structurally* affordable, but it touches nine shipped surfaces.
  - **(C) Convert only the D-21 device sample** so the on-device verification is meaningful.

**Conversion hazard for (B)/(C):** moving the guard from the parent into the `open` prop means the
component body now runs while closed. Any consumer whose body dereferences a prop the guard used to
protect will throw. Check each converted site for guard-dependent prop access — `DexView` (a single
`{selfCaseOpen && rarity != null && …}`) is the cheapest fullscreen conversion.

**Warning signs:** a device tester reporting "some sheets slide out and some just disappear"; a
close-start jsdom test that passes for `AppMenu` and is silently never written for `FriendDetail`.

**Consequence for D-21's sample, whichever option is chosen:** the `initialFocusRef` exemplar must
be **`SettingsView`'s name prompt**, not `PinSheet` (which is unmount-driven). The "opened from
inside a stacking context Phase 21 portaled" exemplar should be `SwapSheet` or `ShareCardSheet`.

---

### Pitfall 2 — `Sheet` must stop returning `null`, and the D-24 portal invariant moves

Covered in §Pattern 1. The failure mode if missed: `if (!open) return null` sits *above*
`createPortal`, so the whole subtree — `AnimatePresence` included — unmounts on close and nothing
ever exits. It looks like the animation "just doesn't work" and invites a hunt through `motion`
config that will find nothing.

Second-order: whichever nesting is chosen, run `layerOrder.test.tsx` and the `sheet.a11y.test.tsx`
portal-parity block. `expect(dialog.parentElement).toBe(document.body)` is asserted in **two**
files and will fail under the nested-scrim shape. Also re-read `layerOrder.test.tsx` §2 (the
structural ancestor walk) before writing the restructure commit and treat any needed change there as
part of the *same* atomic commit, not a follow-up.

---

### Pitfall 3 — `initial={false}` silently disables the enter for nine surfaces

**What goes wrong:** someone adds `initial={false}` (a common copy-paste from route-transition
tutorials, where it prevents an animation on first page load) and the nine hard-coded-`open`
sheets stop animating in — while the ten prop-driven ones still do, making it look random.

**Why:** from the installed source, `AnimatePresence` passes
`initial: !isInitialRender.current || initial ? undefined : false` to `PresenceChild`. For a sheet
that mounts already-open, `isInitialRender.current` is `true` on that first render, so
`initial={false}` resolves to `false` and suppresses the enter. For a prop-driven sheet the child
appears on a *later* render, `isInitialRender.current` is already `false`, and the flag never
applies. [VERIFIED: `AnimatePresence/index.mjs`]

**How to avoid:** leave `initial` at its default. Add a one-line comment saying why.

---

### Pitfall 4 — `aria-hidden` lands on a focused subtree for one frame (SHEET-02)

**(a) The ordering.** `useFocusTrap` currently uses a **passive** `useEffect`. React applies DOM
attribute updates (`aria-hidden="true"` on the exiting card) during the commit's mutation phase;
passive effect cleanups run **after paint**. So on close-start there is a frame in which
`aria-hidden="true"` is set on an element that still contains `document.activeElement` — the
classic axe `aria-hidden-focus` violation, and on real VoiceOver it can drop the AT cursor into
limbo, which is precisely the regression SHEET-02's device session exists to catch.

Probe P1 observed the *end state* of that commit as correct (`activeElement === trigger` **and**
`aria-hidden="true"`), because React had already flushed both by the time the assertion ran — jsdom
cannot observe the intra-commit frame. **So treat this as a contract to write down, not a bug to
reproduce.**

**Fix:** switch the hook's effect to `useLayoutEffect` so its destroy runs synchronously inside the
same commit. Verify the restore lands before or with the attribute; if uncertainty remains, take the
belt-and-braces route and set `aria-hidden` imperatively from the same layout effect *after*
`restoreTo.current?.focus()`.

**(b) The `pointer-events` assertion trap.** `fireEvent.click(el)` in
`@testing-library/dom` dispatches directly and **ignores `pointer-events: none`** (only
`user-event`, which is not installed here, enforces it). So a jsdom test cannot prove "a tap during
the exit window reaches the background" via `pointer-events` alone. Make the contract *provable*:
drop the scrim's `onClick` handler while closing (`onClick={isPresent && backdrop ? onClose : undefined}`)
so a dispatched click on the exiting scrim demonstrably does not call `onClose`, **and** assert the
inline `pointer-events: none` string. Two assertions, one contract.

**(c) Both elements, not one.** `pointer-events: none` on an ancestor does not override a
descendant that sets `pointer-events: auto` — and the shipped card carries exactly that class.
Assert the card **and** the scrim.

---

### Pitfall 5 — double-releasing the ref-counted `inert` un-inerts a live modal

Covered in §Pattern 3. `setRootInert(false)` guards underflow only at zero; with two sheets open,
one extra release drops 2 → 0 and makes the background interactive *underneath an open modal*. Guard
`release()` with an instance-scoped `releasedRef`. Extend the existing "stacked modals" test to
close the **bottom** sheet while the top stays open.

---

### Pitfall 6 — `BottomTabBar` sizes itself from the very variable that collapses (CHROME-01)

**What goes wrong:** the tab bar squashes to a bare safe-area strip on hide instead of sliding out,
and `translateY(100%)` of the squashed box no longer clears the viewport, so a sliver of bar stays
visible — visually broken *and* an accessibility problem, since it looks reachable.

**Why:** `BottomTabBar.tsx:42` is `height: "var(--gz-chrome-reserve)"`. That is correct today
(FOUND-02: "the bar's height IS the chrome reserve") and becomes wrong the moment the reserve means
"how much space the chrome occupies" rather than "how tall the bar is". Those two meanings diverge
exactly when chrome is hidden.

**How to avoid:** add one never-collapsing composition to the ladder and re-point the bar at it:

```ts
["--gz-tab-bar-box", "calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))"],
["--gz-chrome-reserve", chromeVisible ? "var(--gz-tab-bar-box)" : "var(--gz-safe-bottom)"],
```

Value-preserving when visible; only the *notation* changes. Note this **breaks two shipped
assertions** that pin exact strings, and the plan must update them deliberately:
- `bottomSpace.test.ts:99` — `expect(chrome).toBe("calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))")`
- `bottomSpace.test.ts` §D-16 — `expect(vars(0, false)["--gz-chrome-reserve"]).toBe("var(--gz-safe-bottom)")` (this one still passes)
- `bottomSpace.test.ts:~262` — `<nav>` style contains `var(--gz-chrome-reserve)` → becomes `var(--gz-tab-bar-box)`

Also add `--gz-tab-bar-box` to `BOTTOM_SPACE_VAR_NAMES` so the "writes every variable onto
`documentElement`" test covers it. This is **one more named composition inside the existing single
owner**, not a second layout state — D-12 and STATE.md's carried warning both still hold.

---

### Pitfall 7 — jsdom 29.1.1 implements neither `ResizeObserver`, `Element.animate`, nor `inert`

Probed directly against the installed jsdom (probe P8):

| API | jsdom 29.1.1 | Consequence |
|---|---|---|
| `window.ResizeObserver` | **undefined** | Every resize test must `vi.stubGlobal("ResizeObserver", MockResizeObserver)` — the shipped template is `test/explore/filterFabLift.test.tsx:165-173`. `clientWidth`/`clientHeight` must also be stubbed on `HTMLElement.prototype` (`:177-186`) or `ConstellationCanvas` never mounts `ForceGraph2D` at all. |
| `Element.prototype.animate` | **undefined** | `motion` falls back to its JS/rAF driver. rAF *does* exist under Vitest (jsdom env defaults `pretendToBeVisual: true`, verified in `vitest/dist/chunks/index.DC7d2Pf8.js:434`). **Probe P3 confirms the fallback runs to completion**: an exiting node is removed after its duration and `onAnimationComplete` fires. This is the opposite of what an earlier draft assumed and it simplifies the D-20 test — see §Code Examples. |
| `'inert' in HTMLElement.prototype` | **false** | `el.inert = true` sets a plain JS **expando** and reflects **no attribute**. |
| `Element.prototype.scrollIntoView` | **undefined** — *throws* `is not a function` | See Pitfall 11. |

**The `inert` consequence is subtle and important.** The shipped assertion
`expect(appContent()!.inert).toBe(true)` in `sheet.a11y.test.tsx:84` passes only because it reads
back the expando that `inertRoot.ts` wrote — it does **not** prove an `inert` attribute exists, and
`document.querySelector("[inert]")` would find nothing (verified). By contrast, React's JSX `inert`
prop renders a real `inert=""` attribute even in jsdom. **Therefore CHROME-04's jsdom assertion must
be `expect(header).toHaveAttribute("inert")`, which only works if the chrome uses the JSX prop
(§Pattern 6).** Record the existing expando limitation in the test file's limits header so nobody
later reads the two assertions as equivalent.

---

### Pitfall 8 — `d3ReheatSimulation` **is** called on a chrome toggle (CHROME-05)

**What goes wrong:** a test written straight from CHROME-05's wording — "never reheats the GizzVerse
simulation" — asserts `d3ReheatSimulation` was not called, and fails.

**Why:** `ConstellationCanvas.tsx:238-250`'s spacing effect has deps `[graphData, size.width,
size.height]` and calls `fg.d3ReheatSimulation()` unconditionally. A chrome toggle changes
`size.height`, so it reheats. That reheat is **inert** — `onEngineStop` (`:754-761`) pins `fx`/`fy`
on *every* stop, so the layout does not move — and `firstSettleRef` (`:184`, `:771`) gates
`zoomToFit` to the first settle per `graphData`, so the camera does not snap. This is the UX-04
design, and it is why D-09 defines the assertion as **(a) one resize callback, (b) `zoomToFit` not
re-called** rather than "no reheat".

**How to avoid:** assert exactly D-09's two things. If a stronger no-reheat guarantee is ever
wanted, that is a `ConstellationCanvas` change (splitting the force-configuration effect from the
size effect), which is out of this phase's scope and unnecessary given the pinned `fx`/`fy`.

---

### Pitfall 9 — React 19 loops on an uncached `getSnapshot` (NAV-06, CR-01)

React 19.2.7 detects this and reports **"The result of getSnapshot should be cached to avoid an
infinite loop"**; it also warns **"Missing getServerSnapshot, which is required for server-rendered
content."** [VERIFIED: `react-dom-client.development.js:8130`, `:8115`]

The install store's snapshot is an **object**, so it must be cached in a module variable and
recreated only inside `notify()` — never built inside `getSnapshot()`. Both existing stores in this
codebase already model this: `bottomOverlayInset.ts` caches `snapshot` in `notify()`, and
`useHashRoute.ts` returns a string primitive. Provide `getServerSnapshot` for consistency with both
(the app has no SSR, so it is defensive, not required).

For CR-01, keep every hook returning a **number**; the caching problem then cannot arise.

---

### Pitfall 10 — `navigate("settings")` while already on `#/settings` fires no `hashchange`

`navigate()` is `location.hash = "#/" + route`. Assigning the *same* hash does not dispatch
`hashchange`, so `useHashRoute`'s store never notifies and no re-render happens. The deep-link's
scroll+focus must therefore **not** be conditional on a route change. The one-shot module flag in
§Pattern 8 handles this only if `SettingsView` is already mounted and re-renders for some other
reason — which it may not.

**Robust fix:** have the menu row call `requestInstallSectionFocus()` *and* perform the
scroll+focus itself via a microtask/effect when `currentRoute() === "settings"` already, or have
`SettingsView` subscribe to the flag with its own tiny store rather than a mount-time effect. The
simplest version that always works: make `installSectionFocus` a real `useSyncExternalStore` module
(a counter that increments on request), so a *re-request while already on Settings* still notifies.

---

### Pitfall 11 — jsdom has no `scrollIntoView`

`el.scrollIntoView(...)` throws `TypeError: el.scrollIntoView is not a function` under jsdom 29.1.1
(probed, P8). Any deep-link test will crash unless the call is optional (`el.scrollIntoView?.({…})`)
or `Element.prototype.scrollIntoView` is stubbed in `test/setup.ts`. **Recommend the optional call in
product code** — it matches this codebase's never-throw display-helper convention (`formatMonYear`,
`wakeLock.ts`, `persist.ts`) and needs no test-only shim.

---

### Pitfall 12 — `onAnimationComplete` fires for the **exit** too (D-27)

`motion-dom`'s `animateVisualElement` ends with `animation.then(() => visualElement.notify(
"AnimationComplete", definition))` for *any* definition, exit included. [VERIFIED:
`node_modules/motion-dom/dist/es/animation/interfaces/visual-element.mjs:21-23`]

So the D-27 handler must be guarded. **Guard on `useIsPresent()`, not on `open`:**

```tsx
onAnimationComplete={() => { if (isPresent) focusInitialTarget(); }}
```

An `if (open)` guard is itself frozen on the exiting element (§Pitfall 14) — it evaluates `true`
during the exit and yanks focus back into a sheet that is already gone, which is exactly the bug the
guard was meant to prevent. Probe P4 confirms the enter completion reports `isPresent === true` with
definition `{ y: 0 }`, so presence is a sound discriminator.

**And pair it with a fallback timer** (§Pattern 3) — if the animation never completes, the callback
never fires and the `initialFocusRef` input is never focused.

---

### Pitfall 13 — install-mode evidence, and `apple-mobile-web-app-capable` is NOT a cosmetic no-op (NAV-06)

**(a) The bookmark trap.** Carried from Phase 21 and folded into this phase. On iOS a home-screen
icon can be a Safari *bookmark*: identical icon, identical title, browser chrome on launch, and
`env(safe-area-inset-bottom)` reads `0`. `?layoutProbe=1` reports `sab`, `standalone: nav=… mq=…`
and `innerH` — and an installed icon always relaunches at the URL it was added from, so **a second
icon must be added from the `?layoutProbe=1` URL** to see the probe in standalone (hash routing
preserves the query as the user navigates).

For **NAV-06 specifically (Android/Chromium)** the decisive tell is
`matchMedia("(display-mode: standalone)").matches === true` plus the fact that
`beforeinstallprompt` fired at all — Chromium does not fire it when already installed. `sab` is the
iOS tell, not the Android one; do not grade Android install-mode on `sab`.

**(b) The meta tag is a behavior change, not a tidy-up.** `index.html:9` already ships
`apple-mobile-web-app-status-bar-style="black-translucent"`. Apple's own reference states, verbatim:

> **This meta tag has no effect unless you first specify full-screen mode as described in
> apple-mobile-web-app-capable.** … If set to `black-translucent`, the web content is displayed on
> the entire screen, partially obscured by the status bar.

[CITED: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html]

So adding `capable` can **activate** a status-bar mode that pushes web content under the status bar
and changes what the top safe-area inset means — **in the phase whose exit control must be provably
inside the safe area (CHROME-03) and whose D-13 keeps the stage below the notch.** This project has
been bitten by top-inset math twice already.

**How to handle it:** land the tag as its **own atomic commit, before** the device session, and
capture `?layoutProbe=1` readings (`sab`, `standalone`, `innerH`, top inset) on a freshly
*reinstalled* iOS instance **both before and after**. Record both in `22-HUMAN-UAT.md`. Note the
manifest already sets `"display": "standalone"` (`vite.config.ts:98`), which iOS ≥15.4 honours for
*launch mode* — so the tag's live effect here is on the **status-bar style**, not on whether the app
launches standalone. Chromium logs a deprecation warning for the Apple tag, so add
`<meta name="mobile-web-app-capable" content="yes">` alongside to keep the console clean.

---

### Pitfall 14 — an exiting `AnimatePresence` child renders from FROZEN props (SHEET-02) ⚠ highest risk

**What goes wrong:** `aria-hidden` and `pointer-events: none` never appear on the exiting sheet.
D-19 items 3 and 4 silently do not happen. VoiceOver can read a sheet that is visually leaving, and
a tap in the exit window is swallowed by a ghost scrim — the exact failure SHEET-02 exists to
prevent. **Every test written against the open state still passes**, so nothing catches it.

**Why it happens:** `AnimatePresence` renders exiting children out of its own `renderedChildren`
state — those are the React elements **exactly as they were last created while present**. Motion's
docs say it in as many words: exiting children "cannot receive prop updates because when a component
is removed from the React tree … its props can no longer be updated."
[CITED: https://motion.dev/docs/react-animate-presence]
[VERIFIED: `framer-motion/dist/es/components/AnimatePresence/index.mjs` — `renderedChildren` is
component state; the exiting element is spliced back in unchanged]

So any object computed in `Sheet`'s render — the tempting
`const closingProps = { "aria-hidden": open ? undefined : true, style: { pointerEvents: open ? undefined : "none" } }`
— is baked into the element while `open === true` and stays that way for the whole exit.

**Probe P2 reproduced exactly this**: with the attributes derived from `open`, both stayed
`undefined` for the entire exit window. **Probe P1**, with the identical structure but the
attributes derived from `useIsPresent()` inside the child, produced `aria-hidden="true"` and
`pointer-events: none` synchronously.

**Why `useIsPresent()` works when props do not:** `PresenceChild` re-creates its context value
whenever `isPresent` changes (`useMemo(…, [isPresent, presenceChildren, onExitComplete])`), and
React re-renders every `useContext` consumer on a provider-value change regardless of whether the
parent re-rendered. [VERIFIED: `framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs`]

**How to avoid:** put everything presence-dependent inside the component `AnimatePresence` renders
as its child — a `SheetSurface` that calls `useIsPresent()`. That covers `aria-hidden`,
`pointer-events`, the scrim's `onClick`, the transition `ease`, and the `onAnimationComplete` guard.
`Sheet` itself keeps only the hooks whose `active` is a function of `open` (`useFocusTrap`,
`useDialogDismiss`) — those are correct precisely *because* `Sheet` is not the frozen element.

**Warning sign, and the reason this pitfall is ranked highest:** a hand-rolled `AnimatePresence`
test double that re-renders `children` fresh on every render will show the attributes flipping
correctly and **make the D-20 test pass against broken production code.** Use the real library
(§Code Examples).

---

## Code Examples

### The restructured `Sheet` (Pattern 1 + 2 + 3, sibling-scrim variant)

```tsx
// Source: derived from packages/app/src/components/Sheet.tsx + the WaveToast.tsx:158-168 idiom.
// Structure probed live in this repo (P1) — the close-start contract holds exactly as written.

export function Sheet({ open, onClose, ariaLabel, variant = "bottom-sheet",
                        modal = true, backdrop = modal, initialFocusRef, children }: SheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // `active` is a function of OPEN, never of presence (§Pattern 3). Its cleanup fires in the
  // same commit `open` flips false → D-19 items 1 (release inert) and 2 (restore focus).
  const { focusInitialTarget } = useFocusTrap(contentRef, { active: open && modal, initialFocusRef });
  useDialogDismiss(open, onClose);

  if (typeof document === "undefined") return null;   // SSR/jsdom guard — KEEP

  return createPortal(
    <AnimatePresence /* mode="sync" (default); NEVER initial={false} — Pitfall 3 */>
      {open && (
        <SheetSurface
          key="sheet"
          contentRef={contentRef}
          focusInitialTarget={focusInitialTarget}
          {...{ onClose, ariaLabel, variant, modal, backdrop }}
        >
          {children}
        </SheetSurface>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EVERYTHING presence-dependent lives HERE. Deriving any of it from `open` in
// Sheet's render silently no-ops for the whole exit window — §Pitfall 14.
// ─────────────────────────────────────────────────────────────────────────────
function SheetSurface({ contentRef, focusInitialTarget, onClose, ariaLabel,
                        variant, modal, backdrop, children }: SheetSurfaceProps) {
  const isPresent = useIsPresent();                 // ← false the instant the exit begins
  const reduce = useReducedMotion() ?? false;       // typed `boolean | null`
  const { SHEET_MS, SHEET_EASE_ENTER, SHEET_EASE_EXIT } = config.ui.motion;
  const duration = SHEET_MS / 1000;                 // motion takes SECONDS; config stays in ms
  const ease = isPresent ? SHEET_EASE_ENTER : SHEET_EASE_EXIT;

  // D-19 #3 and #4 — presence-derived, never prop-derived.
  const closing = {
    "aria-hidden": isPresent ? undefined : true,
    style: { pointerEvents: isPresent ? undefined : ("none" as const) },
  };

  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  // UI-SPEC §Per-variant motion: the bottom-sheet CARD translates with opacity UNCHANGED.
  const slide = { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };
  const cardMotion = variant === "fullscreen" || reduce ? fade : slide;

  return (
    <>
      {variant === "bottom-sheet" && backdrop && (
        <motion.div
          key="sheet-scrim"
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: config.ui.z.sheetScrim, ...closing.style }}
          aria-hidden="true"
          onClick={isPresent ? onClose : undefined}          /* Pitfall 4b — presence-derived */
          {...fade}
          transition={{ duration, ease }}
        />
      )}
      <motion.div
        key="sheet-card"
        ref={contentRef}
        role="dialog"
        aria-modal={modal}
        aria-label={ariaLabel}
        tabIndex={-1}
        {...closing}
        className={variant === "fullscreen"
          ? "fixed inset-0 overflow-y-auto bg-surface"
          : "fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"}
        style={{
          zIndex: config.ui.z.sheet,
          paddingBottom: variant === "fullscreen" ? undefined : "var(--gz-sheet-pad-bottom)",
          ...closing.style,
        }}
        {...cardMotion}
        transition={{ duration, ease }}
        onAnimationComplete={() => { if (isPresent) focusInitialTarget(); }}  /* D-27, Pitfall 12 */
      >
        {children}
      </motion.div>
    </>
  );
}
```

`{open && …}` renders `false` when closed; `onlyElements` filters non-elements, so `AnimatePresence`
sees zero children — the exit path, exactly as `WaveToast` does with `{shown && …}`.

**Note on the fragment:** `AnimatePresence` tracks *its direct children*. `SheetSurface` returning a
fragment of two `motion.div`s means `AnimatePresence` sees **one** child (`SheetSurface`) and waits
for **both** inner motion components to finish before unmounting — which is the documented behaviour
("If a child contains multiple `motion` components with `exit` props, it will only unmount the child
once all `motion` components have finished animating out"). That is exactly what is wanted: one
presence, two parallel timelines, one unmount.

### The D-20 close-start test — use the **real** `motion`, not a hand-rolled double

```tsx
// packages/app/test/sheet.closeStart.test.tsx
//
// USE THE REAL LIBRARY. Two mocks are both wrong here:
//   • the shipped pass-through mock (WaveToast.test.tsx:16-36) renders AnimatePresence as
//     `({children}) => children`, so the exiting child unmounts instantly and every assertion
//     below passes VACUOUSLY;
//   • a hand-rolled "retaining" double that re-renders `children` fresh would show aria-hidden
//     and pointer-events flipping correctly EVEN IF production derives them from `open` — i.e.
//     it makes the test pass against the §Pitfall 14 defect. That is worse than no test.
//
// Probe P3 verified the real library works end-to-end under this repo's jsdom: the exiting node
// is retained synchronously and removed after the duration (motion runs its rAF fallback because
// Element.prototype.animate is undefined). NO fake timers — they desynchronize that loop.

import { cleanup, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "../src/components/Sheet.tsx";

afterEach(() => { cleanup(); document.getElementById("app-content")?.remove(); });

it("releases inert, restores focus, hides and de-targets the sheet BEFORE unmount (D-20)", async () => {
  const trigger = mountAppContent();          // …as in sheet.a11y.test.tsx:44-52
  trigger.focus();
  const onClose = vi.fn();

  const { rerender } = render(
    <Sheet open onClose={onClose} ariaLabel="Modal"><button>inside</button></Sheet>,
  );
  const appContent = document.getElementById("app-content")!;
  expect(appContent.inert).toBe(true);

  const dialog = screen.getByRole("dialog");
  const scrim = document.querySelector<HTMLElement>(".bg-black\\/50")!;

  rerender(<Sheet open={false} onClose={onClose} ariaLabel="Modal"><button>inside</button></Sheet>);

  // ── ANTI-VACUITY FIRST: the node MUST still be mounted, or everything below
  //    passes trivially and the test proves nothing.
  expect(document.body.contains(dialog)).toBe(true);

  expect(appContent.inert).toBe(false);                     // D-19 #1
  expect(document.activeElement).toBe(trigger);             // D-19 #2
  expect(dialog.getAttribute("aria-hidden")).toBe("true");  // D-19 #3  ← catches Pitfall 14
  expect(dialog.style.pointerEvents).toBe("none");          // D-19 #4
  expect(scrim.style.pointerEvents).toBe("none");           // D-19 #4 — BOTH (Pitfall 4c)

  // fireEvent ignores pointer-events (Pitfall 4b) — so also prove the handler is gone.
  fireEvent.click(scrim);
  expect(onClose).not.toHaveBeenCalled();

  // D-19 #6 — the ONLY thing that waits.
  await waitForElementToBeRemoved(() => screen.queryByRole("dialog"), { timeout: 2000 });
});
```

**Do not assert intermediate geometry.** Probe P1 showed motion writes the exit target
(`translateY(100%)`) into inline style essentially immediately under jsdom, so the transform value is
not a trustworthy proxy for visual progress there. Assert attributes, presence and removal only.

**The prop-shape tests (`sheet.motion.test.tsx`) may keep the shipped pass-through mock** — timing is
noise there, and `data-initial` / `data-exit` assertions are exactly what it is good for.

### The one-resize assertion (CHROME-05 / D-09)

```tsx
// Source: harness pattern from test/explore/filterFabLift.test.tsx:14-49 and :162-192
const { zoomToFitSpy } = vi.hoisted(() => ({ zoomToFitSpy: vi.fn() }));
// …ForceGraph2D mock exposing zoomToFit: zoomToFitSpy…

let stageHeight = 600;                 // jsdom has no layout — drive the box by hand
let fireResize: () => void = () => {};
class MockResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() { this.cb([], this as unknown as ResizeObserver); fireResize = () => this.cb([], this as any); }
  unobserve() {} disconnect() {}
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => stageHeight });

// …render ExploreView, let it settle, clear the spies…
zoomToFitSpy.mockClear();
const setPropertySpy = vi.spyOn(document.documentElement.style, "setProperty");

act(() => { toggleChrome(); });         // one user action
stageHeight = 660;                      // the collapse the browser would have produced
act(() => { fireResize(); });           // ONE delivery — the RO spec's one-per-frame guarantee

// (a) exactly one chrome-reserve write per toggle
expect(setPropertySpy.mock.calls.filter(([n]) => n === "--gz-chrome-reserve")).toHaveLength(1);
// (b) the camera was not yanked
expect(zoomToFitSpy).not.toHaveBeenCalled();
// (c) structural: the header is out of flow for the whole exit, so no LATE second resize
expect(screen.getByRole("banner")).toHaveStyle({ position: "absolute" });
expect(screen.getByRole("banner")).toHaveAttribute("inert");
```

**Be honest about what this proves.** jsdom has no layout engine: `clientHeight` is stubbed and CSS
custom properties do not cascade into it, so the test cannot observe "collapsing the reserve made
the stage taller". What it *does* prove is the three things that actually determine the browser
outcome — one style write per toggle, the header out of flow for the whole exit (so no late second
resize), and `zoomToFit` untouched — layered on the `ResizeObserver` spec's own one-delivery-per-
frame guarantee. Say this in the test file's header rather than letting a reader over-read it.

**Optional reinforcement (non-circular, and cheap):** a `MutationObserver` on
`document.documentElement`'s `style` attribute that counts how many times `--gz-chrome-reserve`
resolves to a *different* value across one toggle. A correct implementation changes it once; an
implementation that animated the reserve would change it every frame. jsdom supports
`MutationObserver`, so this needs no stub at all.

## Runtime State Inventory

This is not a rename/migration phase, but D-11 makes "what state is created" load-bearing, so the
audit is worth one table.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data (Dexie) | **None new.** Chrome visibility is explicitly non-persisted (D-11) — no `db.meta` row, no new table, no schema version bump. `CR-02` reads `db.archiveShows` but writes nothing. | none |
| Live service config | **None.** Supabase is untouched; no new tables, RLS policies, realtime channels or edge functions. | none |
| OS-registered state | **None.** No scheduled tasks, no pm2 entries. The only OS-adjacent artifact is the home-screen install itself, which is user-created during NAV-06 UAT. | none |
| Secrets / env vars | **None.** No new `VITE_*` variables. `test/setup.ts` already stubs the two existing ones. | none |
| Build artifacts | `dist/sw.js` re-baselines on every install during UAT (the `UpdateToast` note in `[[ios-standalone-verification]]`). Adding `apple-mobile-web-app-capable` to `index.html` changes the built HTML, so **every device tester must uninstall and reinstall from a fresh build** or they will be testing the old shell — and per §Pitfall 13(b) the tag can change the top-inset behaviour, so the *pre-change* probe reading must be captured first. | rebuild + reinstall before NAV-06 grading; record before/after probe |
| In-memory state being re-timed | `inertRoot.ts`'s module `inertCount`; `dialogStack`'s LIFO array; `useFocusTrap`'s `restoreTo` ref | Code re-timing, not data migration — but the ref count now decrements while the closing sheet's node is still in the DOM. Extend the stacked-modals test (§Pitfall 5). |
| Browser storage | `sessionStorage`/`localStorage`: **none added** (D-11 is explicit). | none |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `aria-hidden` on the background to make a modal exclusive | native `inert` (removes tab order + pointer events + a11y tree in one) | **Baseline widely available April 2023** [CITED: MDN] | Already adopted here (`inertRoot.ts`); this phase extends the same primitive to chrome. `inert` is what actually satisfies CHROME-04. |
| `inert=""` string hack in JSX (React ≤18 rejected the boolean) | `inert={boolean}` first-class boolean attribute | React 19 | Lets CHROME-04 be a declarative prop **and** attribute-assertable in jsdom. |
| `vitest.workspace.ts` | `test.projects` in the root config | Vitest 4 | Already correct in this repo — do not follow pre-2025 tutorials. |
| `apple-mobile-web-app-capable` as the iOS standalone switch | manifest `display: standalone` | iOS 15.4+ | The manifest is already the mechanism for *launch mode*. The Apple tag's remaining live effect is **enabling `apple-mobile-web-app-status-bar-style`**, which is a behaviour change — §Pitfall 13(b). |
| `framer-motion` package name | `motion` package (same code, re-exported) | 2024 | This repo imports from `motion/react` — correct and current. The `framer-motion` directory in `node_modules` is the transitive implementation and the authoritative typings source; do not add it as a direct dependency. |

**Deprecated / outdated:**
- `apple-mobile-web-app-capable` — non-standard/deprecated in favour of `mobile-web-app-capable` +
  the manifest, but **still the only switch for the Apple status-bar style** (§Pitfall 13b).
- `AnimatePresence exitBeforeEnter` — removed; the modern spelling is `mode="wait"` (which this
  phase should not use anyway).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `motion` (incl. `useIsPresent`) | SHEET-01/02, CHROME-01 | ✓ | 12.42.2 | — |
| `lucide-react` `Maximize2`/`Minimize2`/`Smartphone` | ChromeToggle + install affordances | ✓ | 1.23.0 — all three verified as live exports (P7) | — |
| React 19 boolean `inert` | CHROME-04 | ✓ | 19.2.7 | imperative `el.inert = true` (loses jsdom attribute assertion) |
| `dexie-react-hooks` 3-arg `useLiveQuery` | CR-02 | ✓ | 4.4.0 | object-wrap the querier (§Pattern 10 shape b) |
| jsdom `ResizeObserver` | CHROME-05 test | ✗ | — | `vi.stubGlobal` — template already shipped in `filterFabLift.test.tsx` |
| jsdom `Element.animate` | motion tests | ✗ | — | **Not needed.** motion's rAF fallback runs to completion under Vitest's jsdom (P3); mock `motion/react` only for prop-shape tests |
| jsdom `inert` reflection | CHROME-04 test | ✗ | — | React's JSX `inert` prop renders a real attribute — assert that |
| jsdom `scrollIntoView` | NAV-05 test | ✗ | — | optional call `el.scrollIntoView?.()` in product code |
| jsdom `MutationObserver` | optional CHROME-05 reinforcement | ✓ | — | — |
| `@testing-library/user-event` | pointer-events enforcement | ✗ (not installed) | — | assert the style string + drop the handler (§Pitfall 4b). **Do not install it** — zero-new-deps. |
| cloudflared HTTPS tunnel | SHEET-02 + NAV-06 device UAT | ✓ (winget, not on PATH) | — | full path from Git Bash: `"/c/Program Files (x86)/cloudflared/cloudflared.exe"`, `--http-host-header localhost` |
| Real Android device | NAV-06 | owner-supplied | — | **none** — NAV-06 cannot be graded without it |
| Real iOS device + VoiceOver + external keyboard | SHEET-02 | owner-supplied | — | **none** — SHEET-02's re-verification cannot be graded without it |

**Missing dependencies with no fallback:**
- A physical Android device for NAV-06 and a physical iOS device with an external keyboard for
  SHEET-02. Both are named device items in CONTEXT (D-21, D-32) and both belong in `22-HUMAN-UAT.md`.

**Missing dependencies with fallback:** every jsdom gap above — all have a shipped in-repo template
or a verified workaround, and none requires a new package.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + `@testing-library/react` 16.3.2, jsdom 29.1.1 |
| Config file | `vitest.config.ts` (root) — `test.projects`, app project rooted at `packages/app`, `setupFiles: ["./test/setup.ts"]` |
| Quick run command | `npx vitest run --project @guezzer/app test/<file>.test.tsx` (paths are relative to the project root, `packages/app`) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHEET-01 | Enter/exit props carry translate under motion and opacity-only under reduced motion; `variant="fullscreen"` never translates (D-26); the card carries **no** opacity key in the non-reduced path (UI-SPEC) | unit (jsdom, mocked `motion`) | `npx vitest run --project @guezzer/app test/sheet.motion.test.tsx` | ❌ Wave 0 |
| SHEET-01 | Motion constants come from `config.ui`, not literals (D-25) | source guard | same file — grep `Sheet.tsx` for `duration: 0.` | ❌ Wave 0 |
| SHEET-01 | The primitive still portals to `document.body` and still renders nothing when closed (Phase-21 D-24 + V7) | unit | `npx vitest run --project @guezzer/app test/sheet.a11y.test.tsx` | ✅ (must be re-run and possibly amended — Pitfall 2) |
| **SHEET-02** | **Close-start contract (D-20):** with the sheet still in the DOM after `open→false` — background not `inert`, `document.activeElement === trigger`, **`aria-hidden="true"` on the card**, card and scrim carry `pointer-events: none`, and a click on the exiting scrim does **not** call `onClose` | unit (jsdom, **REAL `motion`**, no fake timers) | `npx vitest run --project @guezzer/app test/sheet.closeStart.test.tsx` | ❌ Wave 0 |
| SHEET-02 | The node is removed only *after* the duration (deferred unmount), asserted with `waitForElementToBeRemoved` | unit | same file | ❌ Wave 0 |
| SHEET-02 | Stacked release does not underflow: closing the **bottom** sheet while the top stays open leaves `#app-content` inert (Pitfall 5) | unit | extend `sheet.a11y.test.tsx`'s stacked-modals case | ✅ (extend) |
| SHEET-02 | `initialFocusRef` is focused only after `onAnimationComplete` **while present**, and not at all on exit (D-27, Pitfall 12); the fallback timer covers a non-firing animation | unit | `sheet.closeStart.test.tsx` | ❌ Wave 0 |
| CHROME-01 | `--gz-chrome-reserve` collapses to `var(--gz-safe-bottom)` when `chromeVisible === false`; `--gz-tab-bar-box` does **not** collapse; `<nav>` reads `--gz-tab-bar-box` (Pitfall 6) | unit (pure fn + render) | `npx vitest run --project @guezzer/app test/bottomSpace.test.ts` | ✅ (amend: three shipped string assertions change) |
| CHROME-01 | Toggling the store flips `AppShell`'s reserve, renders the header out of flow, **and adds `<main>`'s top safe-area reserve** (Pattern 4 second trap); the toggle's label swaps between the two `config.copy` strings (D-05) | unit | `npx vitest run --project @guezzer/app test/chromeToggle.test.tsx` | ❌ Wave 0 |
| CHROME-03 | Exit control is rendered in **both** states, has `min-h-11 min-w-11` (≥44px), and composes from the safe area | unit (positive assertion, not a source guard) | `chromeToggle.test.tsx` | ❌ Wave 0 |
| CHROME-03 | Exit control is **first** in the non-inert tab order while hidden (§Pattern 5); Escape restores chrome via the LIFO stack | unit | `chromeToggle.test.tsx` | ❌ Wave 0 |
| CHROME-04 | `<header>` and `<nav>` carry the `inert` attribute (React JSX prop — Pitfall 7) and `aria-hidden` while hidden, and neither while visible | unit | `chromeToggle.test.tsx` | ❌ Wave 0 |
| CHROME-04 | The hidden chrome is **not** merely translated: the header carries `position: absolute` (out of flow) for the whole exit | unit | `chromeToggle.test.tsx` | ❌ Wave 0 |
| **CHROME-05** | **Exactly one `--gz-chrome-reserve` write per toggle, and `zoomToFit` not re-called** (D-09) — see the §Code Examples harness and its stated jsdom limits | unit (stubbed `ResizeObserver` + mocked `ForceGraph2D`) | `npx vitest run --project @guezzer/app test/chromeResize.test.tsx` | ❌ Wave 0 |
| CHROME-05 / layering | `peek < chrome < page` and `chrome < fab` numeric guards (UI-SPEC §Layering Contract) | unit (amend) | `npx vitest run --project @guezzer/app test/layerOrder.test.tsx` | ✅ (extend) |
| NAV-05 | The install section renders below the three existing Settings sections, and renders nothing when `isInstalled` | unit | `npx vitest run --project @guezzer/app test/installSection.test.tsx` | ❌ Wave 0 |
| NAV-05 | The menu row is neutral (no `bg-accent`), navigates to `#/settings`, and hides when installed — sharing one gate with the section (D-34) | unit | `installSection.test.tsx` | ❌ Wave 0 |
| NAV-05 | The deep-link moves focus to the section heading (`tabIndex=-1`) after mount, and survives being already on `#/settings` (Pitfall 10) | unit | `installSection.test.tsx` | ❌ Wave 0 |
| NAV-06 | The store is a **singleton**: one captured `beforeinstallprompt` makes `canInstall` true for two independently-mounted consumers, and `promptInstall()` clears it for both (D-33) | unit | `npx vitest run --project @guezzer/app test/installStore.test.tsx` | ❌ Wave 0 |
| NAV-06 | `isStandalone()` is evaluated once and read from the shared store, so two consumers cannot disagree (D-36) | unit | `installStore.test.tsx` | ❌ Wave 0 |
| CR-01 | Two simultaneously-visible overlays get distinct offsets in declared order, and `<main>`'s sum equals the real occupied height | unit | `npx vitest run --project @guezzer/app test/bottomOverlayInset.test.tsx` | ✅ (extend) |
| CR-01 | **Omission guard:** every `useBottomOverlayHeightRegistration` id in `src/` appears in `config.ui.BOTTOM_OVERLAY_ORDER` | source guard (omission-detecting — §Pattern 9) | `bottomOverlayInset.test.tsx` | ❌ Wave 0 |
| CR-02 | `SetlistView` holds the frame while pending and renders a **labelled, escapable** error state when the row is genuinely absent; the `aria-label` is not `copy.albumBack`; Back calls `onClose`; Escape dismisses | unit (fake-indexeddb) | `npx vitest run --project @guezzer/app test/setlistView.test.tsx` | ✅ (extend) |
| Config mirror | New `config.ui.motion` / `config.ui.chrome` / `config.copy.*` keys present and mirrored | unit (amend) | `npx vitest run --project @guezzer/app test/configMirror.test.ts` | ✅ (extend) |

### Sampling Rate

- **Per task commit:** the single test file the task touches — e.g.
  `npx vitest run --project @guezzer/app test/sheet.closeStart.test.tsx` (< 5 s).
- **Per wave merge:** `npx vitest run --project @guezzer/app` (the whole app project — 74 test
  entries under `packages/app/test/`).
- **Phase gate:** `npx vitest run` (core + app) green, plus `npx tsc -b` and lint, before
  `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `packages/app/test/sheet.motion.test.tsx` — SHEET-01 prop shape + reduced motion + fullscreen.
      May use the shipped pass-through `motion` mock (timing is noise here).
- [ ] `packages/app/test/sheet.closeStart.test.tsx` — SHEET-02 (D-20). **Uses the REAL `motion`
      library, no fake timers, anti-vacuity assertion first.** Do *not* hand-roll a retaining
      `AnimatePresence` double: it would pass against the §Pitfall 14 defect.
- [ ] `packages/app/test/chromeToggle.test.tsx` — CHROME-01/03/04
- [ ] `packages/app/test/chromeResize.test.tsx` — CHROME-05 (D-09), needs the stubbed
      `ResizeObserver` + `ForceGraph2D` mock, with `zoomToFit` promoted from the anonymous
      `vi.fn()` at `filterFabLift.test.tsx:38` to a hoisted **named** spy
- [ ] `packages/app/test/installSection.test.tsx` — NAV-05
- [ ] `packages/app/test/installStore.test.tsx` — NAV-06 (module singleton; will need
      `vi.resetModules()` discipline and a `__resetInstallStoreForTests()` escape hatch mirroring
      `__resetBottomOverlayInsetForTests`)
- [ ] Amend `packages/app/test/bottomSpace.test.ts` — three shipped exact-string assertions change
      under `--gz-tab-bar-box` (Pitfall 6), plus `BOTTOM_SPACE_VAR_NAMES`
- [ ] Amend `packages/app/test/sheet.a11y.test.tsx` — portal-parity `parentElement` assertion under
      the new structure (Pitfall 2), stacked-release case (Pitfall 5), and the `inert`-expando
      limits note (Pitfall 7)
- [ ] Extend `packages/app/test/bottomOverlayInset.test.tsx`, `setlistView.test.tsx`,
      `layerOrder.test.tsx`, `configMirror.test.ts`, `components/WaveToast.test.tsx`
- [ ] No framework install needed.

### Provable by automated test vs. device vs. structural

**Automated (jsdom / Vitest) — everything in the table above.** Two deserve their technique named
explicitly because the brief asked:

- **CHROME-05's "exactly one resize callback" (D-09):** asserted as *exactly one
  `setProperty("--gz-chrome-reserve", …)` per toggle* plus *the header is `position: absolute` for
  the whole exit* plus *`zoomToFit` not re-called*, with a manually-driven `ResizeObserver` stub.
  jsdom has no layout engine, so the literal browser callback count is not observable there; what
  the test proves is the three structural facts that, combined with the `ResizeObserver` spec's
  one-delivery-per-frame rule, **make** the count one. State that limit in the file header.
  Optionally reinforce with a `MutationObserver` value-change counter (§Code Examples).
- **SHEET-02's close-start contract (D-20):** asserted while the exiting subtree is still queryable,
  using the **real** `motion` library — verified to retain the node synchronously and remove it after
  the duration under this repo's jsdom (P3). Five assertions: node still mounted (anti-vacuity),
  `#app-content` not inert, `document.activeElement === trigger`, `aria-hidden="true"` +
  `pointer-events: none` on card **and** scrim, and `onClose` **not** called by a click dispatched on
  the exiting scrim (because `fireEvent` ignores `pointer-events` — Pitfall 4b).

**Device-verified — belongs in `22-HUMAN-UAT.md`** (follow the
`.planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md` format: device model, OS
version, numbered pass/fail):

0. **Install-mode proof FIRST**, after the `apple-mobile-web-app-capable` commit lands, on a
   *freshly reinstalled* instance — and with a **pre-change** reading captured for comparison
   (§Pitfall 13b). No SHEET-02 or NAV-06 evidence counts until this reads clean.
1. **SHEET-02 VoiceOver + external-keyboard session (D-21)** across the four *prop shapes*, with
   the sample re-picked per Pitfall 1: a `fullscreen` variant (**only if one has been converted** —
   otherwise it has no exit to verify), a bottom-sheet with backdrop, the `initialFocusRef` case
   (**`SettingsView`'s name prompt**, not `PinSheet`), and one opened from a Phase-21-portaled
   stacking context (`SwapSheet` / `ShareCardSheet`). Plus the close-start tap test on each: tap a
   background control during the ~200ms exit and confirm it fires.
2. **D-30 observation:** a numbered, non-blocking note on whether `ShareCardSheet` (pre-builds a PNG
   `File` on open) and `CompareView` (re-runs `deriveDex`) visibly stutter now that the animation
   makes an existing hitch legible.
3. **NAV-06 Android install from the relocated Settings affordance**, **gated on install-mode
   proof** — record `standalone: mq=…`, and confirm the install actually produced a standalone
   launch, before grading. On iOS, record `sab` / `nav` / `mq` / `innerH` from `?layoutProbe=1`
   (added as a *second* home-screen icon from the probe URL). A bookmark launch is visually
   identical and reports `sab: 0`; this cost a full Phase-21 session.
4. **`ChromeToggle` never moves** — hide/show in portrait and landscape on the installed instance,
   confirming the toggle holds the same pixel and stays inside the safe area, and that the
   constellation genuinely gains the freed height without running under the notch (Pattern 4's
   second trap). `env(safe-area-inset-*)` is `0` in a desktop tab, so this is unobservable there.
   **Not** a CHROME-05 device item — D-09 is explicit that CHROME-05 gets none.

**Structural / by construction — do NOT write a test:**

- **CHROME-03's "a cold boot never starts hidden."** True by construction under D-11: the state is
  plain component/module state with no `sessionStorage`, no `db.meta` row and no storage key, so a
  fresh module evaluation *is* the visible state. A test would assert that a `useState(true)`
  initialises to `true`. Do not write it. If anything, add a one-line source guard that no storage
  API name appears in `chromeVisibility.ts` — and even that is arguably ceremony.
- **CHROME-01's "the control stays visible in the same place."** True by construction under D-01/
  D-02: it is one control at one fixed position whose only per-state change is its label and icon.
  Assert the label swap (that is real); do not attempt to assert screen position in a layout-free
  jsdom.
- **D-14's "an open `NodeSheet` settles into the freed space."** True by construction: `NodeSheet`
  is `fixed bottom-0` composing from `--gz-chrome-reserve`, which the toggle collapses. No new code,
  therefore no new test. (One cheap positive assertion is still worth it — that `NodeSheet` reads
  `--gz-chrome-reserve` and not a literal — but that is CR-01/FOUND-02 territory, already guarded.)
- **D-15's "a toast fires at the collapsed position."** Same reasoning: toasts compose from
  `--gz-chrome-reserve`. No special case, no test.
- **D-18's "no kill-switch."** Nothing to test; the absence of a flag is the deliverable.

### Carried limitation from Phase 21 — read before writing any guard

`bottomSpace.test.ts` is **pattern-matching over source text**. It catches a surface that writes the
*wrong* inset; it **cannot** catch a surface that omits the inset entirely — that gap shipped a real
bug in `ArchiveBrowser`, fixed in `61e0b90`. This phase adds several new surfaces that sit in this
blast radius: the **chrome toggle** (bottom-adjacent within the constellation stage), the
**Settings install section** (bottom of a scrolling `<main>`), and `SetlistView`'s **new error
state**. Each needs a **positive assertion that the thing is present and correct** — a rendered-DOM
check of the actual style/attribute — not merely silence from the pattern guard. The CR-01
omission-detecting guard in §Pattern 9 is the model: it *fails when something new is added and not
registered*, which is the only guard shape that catches an omission.

**The same lesson applies to §Pitfall 14.** A test that only asserts the *open* state cannot catch
the frozen-props defect. The D-20 test's `aria-hidden` assertion is the one that catches it, and its
anti-vacuity "node still mounted" check is what stops it degenerating into silence.

## Security Domain

ASVS level 1 (`security_enforcement: true`, `security_asvs_level: 1`). This phase adds no network
calls, no persistence, no user-supplied data path, and no new dependency.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Untouched — no auth surface changes. `IdentityAvatar` renders a `<Sheet>` but its contents are unchanged. |
| V3 Session Management | no | No session state added; D-11 forbids persistence outright. |
| V4 Access Control | no | No new routes; `ROUTES` stays a fixed allow-list and D-35 explicitly avoids adding fragment parsing (NAV-02's one live security control is untouched). |
| V5 Input Validation | yes (trivially) | The only new user-facing strings are `config.copy` constants rendered as escaped React text. **Never `dangerouslySetInnerHTML`** — the standing T-08-01 / T-16-10 / T-20-06 rule. `SetlistView`'s new error state renders only config copy, never a value derived from a Dexie row or an imported file. |
| V6 Cryptography | no | None. |
| V7 Error Handling & Logging | yes | CR-02's error state must be a *calm, never-throw* surface in the `formatMonYear` / `wakeLock.ts` / `persist.ts` house style — it must not leak a raw Dexie error object or a stack into the DOM. |
| V12 Files & Resources | no | `ShareCardSheet`'s PNG pre-build is explicitly not changed (D-30). |
| V14 Configuration | yes | `apple-mobile-web-app-capable` / `mobile-web-app-capable` are additive meta tags with no *security* effect — they alter neither CSP, SW scope, nor `start_url`. (They do have a layout effect — §Pitfall 13b.) Note `MotionConfigContext.nonce` exists if a strict `style-src` CSP is ever added; the app ships no CSP header today. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Focus/interaction trap — a user stranded behind an invisible or un-dismissable overlay | Denial of Service (availability, and the CR-02 bug literally) | Every blocking surface has Escape (`useDialogDismiss`) **and** a visible ≥44px exit control. CHROME-03 is the same requirement applied to chrome. |
| **Clickjacking-by-own-UI** — an invisible but still-present exiting sheet or scrim swallowing a tap aimed at the background | Tampering / Denial of Service (of the user's intent) | `pointer-events: none` on **both** scrim and card at close-start **plus** dropping the scrim's `onClick`, both presence-derived (§Pitfall 14). This is the security framing of SHEET-02 and the reason its window is the phase's hardest invariant. |
| `pointer-events`-only "disabled" state that is still keyboard-reachable | Elevation of Privilege (interaction with a control the UI claims is gone) | Pair `pointer-events: none` with `inert` / `aria-hidden` — never rely on `pointer-events` alone. This is exactly D-08/D-19's rule. |
| Untrusted string rendered into a new surface | Tampering / XSS | Escaped React text only; no `dangerouslySetInnerHTML`. Applies to the SetlistView error state and the install section. |
| Deep-link/hash injection | Tampering | `ROUTES` allow-list is unchanged and `location.hash` is still only used to *select* a view (T-03-02). D-35 deliberately adds no fragment parsing, which keeps this control intact. |
| Install-prompt abuse (prompting outside a user gesture) | Repudiation / UX abuse | `prompt()` stays in the direct click handler with **no preceding `await`** (§Pattern 7). One prompt per captured event. |
| A service worker swapping the app mid-show | Denial of Service (at a venue) | `registerType: "prompt"` is unchanged; D-15 explicitly refuses to let a chrome-hidden state suppress the update toast. |
| Third-party supply chain | Tampering | **Zero new packages.** The strongest available mitigation. |

**Security gate:** nothing in this phase should trip `security_block_on: high`. The one item worth
a reviewer's eye is CR-02's error state — confirm it renders config copy only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| ~~A1~~ | ~~`inert` browser support is adequate~~ — **CLOSED.** `inert` is Baseline widely available since April 2023 [CITED: MDN], and the app already ships it on every modal. | §Pattern 6 | — |
| ~~A2~~ | ~~iOS startup images still require `apple-mobile-web-app-capable`~~ — **SUPERSEDED by a stronger, primary-source finding.** Apple's reference states the *status-bar-style* tag (already shipped as `black-translucent`) has **no effect** without `capable`, so adding it is a top-inset behaviour change, not a cosmetic one. | §Pitfall 13b | — (now a HIGH-confidence pitfall with a before/after device capture) |
| ~~A3~~ | ~~motion runs its rAF fallback under jsdom (inferred)~~ — **CLOSED by probe P3**: exit animations complete and nodes are removed. | §Pitfall 7 | — |
| ~~A4~~ | ~~lucide glyph export names~~ — **CLOSED by probe P7**: `Maximize2`, `Minimize2`, `Smartphone` all present in 1.23.0. | §Standard Stack | — |
| A5 | Adding `--gz-tab-bar-box` is value-preserving when chrome is visible | §Pitfall 6 | LOW-MEDIUM — the composition is textually identical, but three shipped exact-string assertions pin the old notation and **will** fail; the plan must update them deliberately rather than treating the failure as a regression. |
| A6 | The header can be switched between static and `position: absolute` without a visual jump | §Pattern 4 | MEDIUM — it should be geometrically identical (`top: 0; left: 0; right: 0` inside a full-height flex column), but this is a layout claim jsdom cannot check, and it interacts with the top-inset reserve (Pattern 4's second trap). **Verify in a browser during the chrome slice, not at device-UAT time.** |
| A7 | Ten `open`-prop-driven vs nine unmount-driven is the complete `<Sheet>` inventory | §Pitfall 1 | LOW — enumerated by grep of `<Sheet` element openings (19 total across 16 files), each call site read, and the mechanism confirmed by probe P5; the planner should re-run the grep after any slice that adds a sheet. |
| A8 | `ResizeObserver` coalesces multiple same-frame box changes into one delivery in real browsers | §Pattern 4 | LOW — spec-backed [CITED: drafts.csswg.org/resize-observer]. Mitigated because the test asserts the *number of box changes*, which is the property under our control, rather than the platform's batching. |
| A9 | Static-import evaluation of `installStore.ts` happens before `beforeinstallprompt` fires on Android | §Pattern 7 | MEDIUM — if wrong, NAV-06 stays broken in exactly the way D-33 is meant to fix. The Android device test is the proof; verify the static import chain from `main.tsx` while planning. |
| A10 | Listening for `appinstalled` (to hide the section within the installing session) is compatible with D-36 | §Open Questions | LOW — raised as an open question, deliberately not assumed into the plan. |

## Open Questions (RESOLVED)

All six are settled. Each disposition below is restated in full, with its reasoning, in the
**Planner decisions** section of the owning plan — that is the authoritative copy; this table is the
index.

| # | Question | Disposition | Owning plan |
|---|----------|-------------|-------------|
| 1 | Convert the unmount-driven sheets, or record a seam? | **Convert three** — `DexView` (the `fullscreen` exemplar) plus `TrailNodeSheet` and `WhyDetail` (the bottom-sheet exemplars). Owner decision 2026-08-06 on escalation: shipping four bottom-sheet openings enter-only would miss ROADMAP criterion 1, and a module comment is documentation rather than delivery. `CompareView` ×2, `FriendDetail` ×2 and `PinSheet` ×2 stay a documented seam. | 22-04 (fullscreen), 22-10 (bottom sheets + the corrected seam list) |
| 2 | Sibling scrim/card, or nested? | **Siblings**, inside a `SheetSurface` fragment. Nesting would drag the card's opacity along with the scrim's cross-fade, contradicting `22-UI-SPEC.md`'s "card translates, opacity unchanged". Cost: one assertion in `layerOrder.test.tsx` changes deliberately. | 22-01 |
| 3 | Header out of flow via `position: absolute`, or a collapsing wrapper? | **`position: absolute` on the header itself** — one element, and `inert`/`aria-hidden` live on the element CHROME-04 asserts against. `22-UI-SPEC.md`'s "fixed" wording is superseded; `absolute` also avoids the Phase-21 D-28 transform-ancestor trap. The top-inset trap is handled by giving `<main>` a bare `env(safe-area-inset-top)` reserve while chrome is hidden; the `--gz-safe-top` hoist is a recorded follow-on, not this phase. | 22-05 |
| 4 | One `config.ui.motion` block or two? | **One.** Seven named constants per `22-UI-SPEC.md`. `WaveToast`'s `0.2` moves in 22-01; `BingoCelebration`'s twin moves in 22-08 (the plan that touches that file). | 22-01, 22-08 |
| 5 | Do the existing install tests survive a module-level singleton? | **Yes, both unmodified.** Audited: `platform.test.ts` calls the pure functions directly and `platform.ts` is untouched; `test/setup.ts` already installs `window.matchMedia` (`matches: false`) before any test-file import, so module-load `isStandalone()`/`isIosSafari()` resolve to the state `installBannerVersion.test.tsx` expects. New tests use `__resetInstallStoreForTests(overrides?)` instead of `vi.resetModules()`. | 22-03 |
| 6 | Should the install store also listen for `appinstalled`? | **Yes, add it.** A different event from the one D-36 rules on, three lines, and it is what lets the NAV-06 device test observe both gated surfaces closing without a reload. | 22-03 |

## Sources
### Primary (HIGH confidence) — executed in this repository

- **Live Vitest/jsdom probes P1–P7** (this session; temporary files created under
  `packages/app/test/` and deleted — tree is clean): close-start teardown ordering; the frozen-props
  defect and its `useIsPresent()` fix; deferred unmount completing under jsdom; enter
  `onAnimationComplete` firing with `{y:0}` / `isPresent: true`; whole-tree unmount skipping the
  exit; `transform: "none"` after settle; `lucide-react` export presence. See §Verification Addendum.
- **Standalone jsdom 29.1.1 probe P8**: `'inert' in HTMLElement.prototype === false`, no attribute
  reflection, `scrollIntoView === undefined`.

### Primary (HIGH confidence) — read directly from `node_modules` in this repository

- `node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs` — `initial` /
  `mode` / `onExitComplete` semantics, the diffing algorithm, `isInitialRender`, and
  `renderedChildren` (the frozen-element mechanism behind §Pitfall 14)
- `node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs` — the
  `PresenceContext` value is re-created when `isPresent` flips, which is why `useIsPresent()` works
- `node_modules/framer-motion/dist/es/components/AnimatePresence/utils.mjs` — `onlyElements` /
  `getChildKey`
- `node_modules/framer-motion/dist/index.d.ts` — `AnimatePresenceProps`; `usePresence` /
  `useIsPresent` / `useReducedMotion(): boolean | null`; `MotionConfigContext` (`reducedMotion`,
  `nonce`, `skipAnimations`)
- `node_modules/motion-dom/dist/es/animation/interfaces/visual-element.mjs` — `AnimationComplete`
  notify fires for any definition (exit included)
- `node_modules/react/cjs/react.development.js:268` — `isValidElement` accepts only
  `REACT_ELEMENT_TYPE`; `:613-614` — the two distinct symbols
- `node_modules/react-dom/cjs/react-dom-client.development.js:3063,3122` — `inert` in the boolean
  attribute set; `:8115,8130` — the `getServerSnapshot` / `getSnapshot`-caching warnings
- `node_modules/dexie-react-hooks/dist/useLiveQuery.d.ts` + `src/useObservable.ts` — the
  3-argument `defaultResult` overload and its deps-change retention behavior
- `node_modules/dexie/dist/modern/dexie.mjs:6149` — `observable.hasValue()`
- `node_modules/vitest/dist/chunks/index.DC7d2Pf8.js:434` — jsdom env `pretendToBeVisual: true`
- The Guezzer codebase itself: `Sheet.tsx`, `useFocusTrap.ts`, `inertRoot.ts`,
  `useDialogDismiss.ts`, `bottomSpace.ts`, `bottomOverlayInset.ts`, `AppShell.tsx`,
  `BottomTabBar.tsx`, `ConstellationCanvas.tsx`, `ExploreView.tsx`, `App.tsx`, `useHashRoute.ts`,
  `useInstallState.ts`, `platform.ts`, `AppMenu.tsx`, `SettingsView.tsx`, `SetlistView.tsx`,
  `TrailNodeSheet.tsx`, `WhyDetail.tsx`, `LayoutProbe.tsx`, `styles.css`, `index.html`,
  `vite.config.ts`, and the tests `sheet.a11y.test.tsx`, `bottomSpace.test.ts`,
  `bottomOverlayInset.test.tsx`, `layerOrder.test.tsx`, `explore/filterFabLift.test.tsx`,
  `components/WaveToast.test.tsx`, `test/setup.ts`, `vitest.config.ts`

### Primary (HIGH confidence) — specification and vendor documentation

- [CSS Resize Observer draft](https://drafts.csswg.org/resize-observer/) — callbacks are delivered
  from the HTML "update the rendering" step; `lastReportedSizes` gates delivery; one callback per
  frame per observation
- [MDN — the `inert` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)
  — Baseline widely available since April 2023; removes the subtree from the a11y tree, tab order,
  pointer events, text selection and find-in-page
- [Apple — Supported Meta Tags (Safari HTML Reference)](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html)
  — `apple-mobile-web-app-capable` semantics, and the explicit statement that
  `apple-mobile-web-app-status-bar-style` "has no effect unless you first specify full-screen mode"
- [Motion docs — AnimatePresence](https://motion.dev/docs/react-animate-presence) — `mode`,
  `initial`, `onExitComplete`, `custom`/`usePresenceData`, `useIsPresent`, and the explicit
  "exiting children cannot receive prop updates" statement behind §Pitfall 14

### Secondary (MEDIUM confidence)

- [motion issue #2692 — AnimatePresence exit animations not working with createPortal](https://github.com/framer/motion/issues/2692)
  — independently corroborates the `isValidElement` finding above
- Web search on `apple-mobile-web-app-capable` vs manifest `display: standalone` — sources agree the
  manifest route works on iOS ≥15.4 but disagree on whether the Apple tag is still needed. Resolved
  by making it a device-observable before/after item (§Pitfall 13b) rather than a claim.
- Project memory `[[ios-standalone-verification]]` and `[[device-uat-hosting]]` — the bookmark-vs-
  standalone trap, the decisive iPhone 16 Pro readings, and the cloudflared UAT recipe

### Tertiary (LOW confidence — flagged, not relied upon)

- Nothing remains in this tier. The two items previously listed here (A1 `inert` support, A4 lucide
  export names) were both closed this session — the first by MDN's Baseline statement, the second by
  a live export probe.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — nothing is added; every version was read from installed files and the
  three new icon exports were probed
- `AnimatePresence` / portal mechanism: **HIGH** — read from installed framer-motion and React
  sources, corroborated by the upstream issue, and executed as a live probe
- **Presence/frozen-props lifecycle (§Pitfall 14): HIGH** — reproduced both ways (broken and fixed)
  in this repo's own test environment
- Sheet-instance inventory (10 vs 9): **HIGH** — enumerated by grep, each call site read, mechanism
  confirmed by probe
- Chrome one-commit collapse: **HIGH** on the `ResizeObserver` rule, the `BottomTabBar` trap and the
  top-inset trap; **MEDIUM** on the header's static→absolute switch being visually identical (A6 —
  needs a browser check, not a device session)
- jsdom capability facts: **HIGH** — probed directly this session against jsdom 29.1.1, including
  the *positive* finding that motion's rAF fallback completes
- `beforeinstallprompt` singleton: **HIGH** on shape and React 19 constraints; **MEDIUM** on import
  timing on real Android (A9) and on how much the existing install tests will need reworking (Q5)
- `apple-mobile-web-app-capable`: **HIGH** on Apple's stated dependency between the two meta tags;
  **MEDIUM** on how current iOS behaves in practice — which is why it is a device item with a
  before/after capture rather than a claim
- CR-02 / CR-01 mechanisms: **HIGH** — read from installed dexie-react-hooks and the shipped store
- Pitfalls: **HIGH** — every one is traced to a line of installed source, a probe, or a primary
  vendor document

**Research date:** 2026-08-05 (initial pass; verification pass and §Pitfall 14 correction the same
day)
**Valid until:** 2026-09-05 (30 days — every load-bearing claim is pinned to an *installed*
version, so it stays true until a dependency is bumped; a `motion`, React, jsdom or
`dexie-react-hooks` upgrade invalidates the corresponding section)
