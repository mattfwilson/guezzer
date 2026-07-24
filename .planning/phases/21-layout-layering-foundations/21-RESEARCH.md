# Phase 21: Layout & Layering Foundations - Research

**Researched:** 2026-07-24
**Domain:** CSS layout arithmetic (safe-area insets, viewport units, stacking contexts) in an installed PWA; UTC-safe date formatting; presence label mapping across mixed builds
**Confidence:** HIGH on the mechanisms (derived from actual source + CSS spec), MEDIUM on the device-specific inset magnitudes (verified against Apple developer forums, must be measured in the phase's own device pass)

---

## Summary

`21-CONTEXT.md` (44 locked decisions) and `21-UI-SPEC.md` already resolve every scope and design
question. This research does **not** re-derive them. It grounds the four empirical gaps the planner
needs — the actual gap arithmetic, the actual call-site inventory, the actual stacking-context defect
surface, and the actual label-resolution path — in the shipped codebase, and it corrects or sharpens
three things CONTEXT/UI-SPEC state approximately.

**The FOUND-01 dead gap is fully explained by arithmetic and equals exactly `env(safe-area-inset-bottom)`.**
Tailwind preflight sets `box-sizing: border-box` on `*` (verified: `node_modules/tailwindcss/preflight.css:8-16`).
So `body { height: 100%; padding-bottom: env(safe-area-inset-bottom) }` (`styles.css:214-220`) gives body a
**border box** of the full viewport but a **content box** of `viewport − inset`. `#root { height: 100% }`
resolves against that content box, so the entire React tree is one inset short of the viewport — while
`BottomTabBar` is `position: fixed; bottom: 0` and therefore anchored to the **viewport**, not to body's
padding box. `<main>`'s `calc(4rem + env(safe-area-inset-bottom))` reservation then lands one inset too
high. **D-15's lead hypothesis is confirmed by construction, not just by suspicion.** In a Safari tab the
inset is `0` and the arithmetic is exactly flush — which is precisely why the bug is invisible there.

**Three surfaces carry real behavior change; everything else converts byte-identically.** Walking the
arithmetic for every bottom-anchored surface (§Bottom-Space Call-Site Inventory) shows `FabMenu`,
`ExploreFilterFab`, `Sheet`, `ArchiveBrowser`, `CometTrail`, `RecapView` and `BottomTabBar` are all
already *numerically correct* — they are `fixed`/`absolute` and compose `env()` explicitly, so they never
saw the body double-count. Only `<main>` (the gap), `BingoCelebration` and `WaveToast` (one-inset overlap)
misbehave. This sharpens **D-09**, which asserts all five `bottom-16` overlays overlap: the other three
(`InstallBanner`, `UpdateToast`, `BackupToast`) set `paddingBottom: env(safe-area-inset-bottom)` and are
accidentally flush — which means converting them to `bottom: var(--gz-chrome-reserve)` requires **also
deleting that now-redundant padding**, or 34px of dead space appears inside each toast.

**The FOUND-03 layering defect is deterministic CSS, reproducible in a desktop browser, and scoped
tighter than CONTEXT assumes.** `ShowView.tsx:173-183` wraps the show column in `position: relative` +
`zIndex: 10` — a stacking context by spec. Every surface rendered inside `withBackground(...)`
(`SearchSheet`, `CometTrail`, `FabMenu`, `CatchUpSheet`, `EndShowDialog`, `WhyDetail`) paints at level 10
in the root context, losing to the `toast: 20` siblings at `App.tsx:118-122`. But `AlbumDetail`,
`ArchiveBrowser` and `SetlistView` live in `DexView`, whose wrapper (`DexView.tsx:99`) has **no z-index
and no transform** — they compete at root level and win today. `NodeSheet` in `ExploreView` is a fragment
child of `<main>` — likewise unaffected. **The blast radius is the ShowView column only.**

**Primary recommendation:** Land D-30's ordering (repro → bottom-space → portals). Write the `--gz-*`
ladder into `document.documentElement`, **not** `#root` — portaled sheets are not `#root` descendants and
would not inherit it. Declare `--gz-safe-bottom: env(safe-area-inset-bottom)` **statically in
`styles.css :root`** and write only the config-derived numbers from JS, because the CSS-authored form is
the documented-working one and the JS-`setProperty`-with-`env()` round-trip is unverified. Ship the
FOUND-01 diagnostic readout first and record its numbers before touching `styles.css:220`.

---

## Project Constraints (from CLAUDE.md)

Directives the planner must not contradict:

- **Strict core/UI separation.** `packages/core` is pure TypeScript, zero React/DOM/browser deps,
  `"lib": ["ES2023"]`, `erasableSyntaxOnly: true` (no `enum`, no `namespace`). — *Relevant: D-31
  correctly places `formatFullDate` in `packages/app/src/dex/`, not core. Confirmed appropriate: core has
  no display-formatting layer (verified — no `Intl` usage anywhere in `packages/core/src`).*
- **Single config file, no scattered magic numbers.** All model/layout constants in `config.ts`. —
  *Relevant: D-01's numbers-in-config split; the D-12 guard is the enforcement.*
- **Testing:** Vitest 4 `test.projects`, core in `node`, app in `jsdom`. Tests live in
  `packages/app/test/**/*.test.{ts,tsx}` (verified: root `vitest.config.ts` `include`).
- **Mobile-first, one-thumb, dark venue, mixed iOS/Android, PWA installable on both.**
- **Zero new runtime dependencies** (standing v2.1 constraint, `ROADMAP.md`).
- **All z-index goes through `config.ui.z` as an inline `style`, never a Tailwind class** —
  *verified true: production has exactly zero `z-*` utility classes; the only one in the repo is
  `dev/OrbFitHarness.tsx:147` (`sticky top-0 z-10`, dev-only route). This is load-bearing for the
  FOUND-03 test design (§Layer-Ordering Test).*

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All 44 decisions D-01…D-44 in `.planning/phases/21-layout-layering-foundations/21-CONTEXT.md` are
locked and are **not** re-litigated here. The planner must read that file in full. Summarised by group:

- **Bottom-space single owner (D-01…D-13):** hybrid `config.ts` numbers → CSS custom properties; two
  named compositions (`chrome reserve` = tab bar only, `content reserve` = tab bar + measured overlays);
  runtime overlay heights fold into the content reserve; `rem` is the source unit (`4rem`, retire `64px`);
  the FAB does not move when a strip appears (partly reverses shipped `fabLayout.ts`); measure only
  genuinely variable overlays (SuggestionStrip stays a fixed 112px); modal-sheet bottom padding gets its
  own owned value; audit every bottom-anchored surface; fix the `bottom-16` one-inset overlap; peek strip
  is out of scope; landscape gets correct math not a new layout; a source-scanning guard test locks the
  single owner; per-surface revertibility, **no compatibility shim, no feature flag**.
- **Installed-PWA dead gap (D-14…D-19):** diagnose on device before fixing via a temporary on-device
  readout; lead hypothesis is the double-counted body-level bottom inset; build the chrome-collapse hook
  now wired to always-visible; keyboard behavior checked during the device pass, fixed only if broken;
  proof is numbers + screenshots in `21-HUMAN-UAT.md`; **a non-reproduction still satisfies FOUND-01**.
  **Do not reintroduce `100vh`/`min-h-screen`. Do not reach for `dvh`.**
- **Layer ordering (D-20…D-30):** structural is the lead hypothesis, get the repro first; fix by
  portaling, **not renumbering**; portal only — keep the five surfaces hand-rolled; audit and re-apply
  what each portaled surface loses; the invariant test is structural; plus two named numeric guards
  (WR-01 `page < sheetScrim`, CR-01 `fabScrim < fab`); modal-only invariant with `NodeSheet` and
  `focusedFab: 60` exempt by name; FabMenu included in the repro; audit transform-created stacking
  contexts too; repro via a URL-flag harness; **order — repro first, then bottom-space, then portals**.
- **Date format (D-31…D-38):** `formatFullDate` is a sibling of `formatMonYear` in
  `packages/app/src/dex/` (renamed to `formatDate.ts`); convert full dates only, coarse Mon-Year stays
  coarse; convert the two accessible names too; format at the call site, copy templates stay
  strings-only; **display-only — formatted dates never reach stored or exported data**; share-card
  overflow ellipsizes the venue, never the date; check the footer baseline in the same device pass;
  helper unit tests plus a source guard.
- **Tab rename & presence labels (D-39…D-44):** token → label map, wire tokens frozen; two label voices
  off one token; unknown token → generic readable fallback (`in the app`); NAV-03 verified old-build vs
  new-build over the HTTPS tunnel; tab strip only — in-page headings keep the brand names; "Me" is a
  name change only, contents untouched.

### Claude's Discretion

**None** — `21-CONTEXT.md` records *"None — every question in this discussion was answered explicitly."*

Consequently every recommendation in this document is either (a) an empirical finding about the existing
code, (b) an implementation mechanism serving an already-locked decision, or (c) an explicitly flagged
correction where a locked decision's *premise* does not match what the code actually does. Category (c)
appears three times and is called out inline as **SHARPENS D-xx** or **CORRECTS D-xx**.

### Deferred Ideas (OUT OF SCOPE)

- Simultaneous bottom-overlay stacking (the store sums heights; two visible at once over-reserves —
  over-reserving is the safe failure). Capture as a todo.
- Migrating `SearchSheet` / `AlbumDetail` / `ArchiveBrowser` / `SetlistView` / `NodeSheet` onto the shared
  `<Sheet>` primitive (D-22 — keeps Phase 22's animation blast radius at 11 surfaces, not 16).
- Reordering the "Me" tab so the personal/friends surface leads (a layout change, not a rename).
- Full landscape safe-area gutter treatment beyond the body-level `inset-left`/`inset-right` already in
  `styles.css:221-222` — only if the D-11 measurement shows a defect.
- Renaming internal code identifiers to match the brand names — NAV-02 forbids it regardless.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Installed PWA: body content flush with the tab bar, no dead gap, portrait and landscape | §The Installed-PWA Dead Gap — the gap equals exactly `env(safe-area-inset-bottom)`, derived from the actual box model; §Measuring On Device gives the probe technique and the readout contents |
| FOUND-02 | Every bottom-anchored surface derives from one shared source; a search for the tab-bar height returns exactly one owner | §Bottom-Space Call-Site Inventory (all 16 sites, with the arithmetic each currently produces); §Single-Owner Mechanism (write to `documentElement`, static `env()` in `:root`); §The D-12 Guard's Real Enemy (`bottom-16` vs `pb-16` false positives) |
| FOUND-03 | Nothing paints over an open modal sheet, locked by an automated layer-ordering test | §The Stacking-Context Defect (blast radius = ShowView column only, proven from source); §Layer-Ordering Test Design (jsdom ancestor-walk is *complete* for this codebase because all z-index is inline) |
| FOUND-04 | All full calendar dates render "Mon D, YYYY" from one shared UTC-safe helper | §Date Formatting — the hazard demonstrated numerically, every call site located, storage format confirmed ISO `YYYY-MM-DD` |
| FOUND-05 | Share-card PNG draws the date in the same format, verified on-device at the widest venue name | §Share-Card Footer — `centerText` has no width param; `truncateToWidth` exists; the mock `measureText` makes the ellipsize logic fully unit-testable |
| NAV-01 | Bottom tabs read Live · GizzVerse · Map · Me · Games | §Tab Labels — labels are currently **hardcoded in `BottomTabBar.tsx:4-13`**, not in `config.copy`; moving them is part of the work |
| NAV-02 | Display labels only — routes, file paths, saved data keys untouched | §Tab Labels; the `rebrand.test.ts` precedent is the exact guard shape to extend |
| NAV-03 | Presence works across mixed builds — never blank, never a raw token | §Presence Label Resolution — resolution is **receiver-side at render time**, which determines what is and is not fixable retroactively |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bottom-space numeric constants | App config (`packages/app/src/config.ts`) | — | CLAUDE.md single-config rule; unit-testable; no DOM dependency. Not core — these are presentation constants with no domain meaning. |
| Bottom-space composition → CSS vars | Browser/Client (`packages/app/src/layout/bottomSpace.ts`) | — | Requires `document.documentElement.style.setProperty` and the `useBottomOverlayInset` React store. Inherently DOM. |
| Safe-area inset resolution | Browser (CSS `env()`) | — | Only the UA knows the inset. Never computable in JS ahead of layout; only readable *after* via a probe element. |
| Layer/stacking-tier values | App config (`config.ui.z`) | — | Already shipped there. Unchanged this phase. |
| Layer *nesting* correctness | Browser/Client (React `createPortal`) | — | A stacking context is a DOM-tree property, not a value property. This is why a numeric test cannot satisfy FOUND-03. |
| Full-date formatting | App presentation (`packages/app/src/dex/formatDate.ts`) | — | `Intl.DateTimeFormat` is ES2023-available and would technically run in core, but core has **no display layer at all** (verified: zero `Intl` usage in `packages/core/src`). Putting a first formatter there would invent a new core responsibility. D-31 is correct. |
| Date *storage* format | App data layer (Dexie) + core join keys | — | ISO `YYYY-MM-DD` always. The date is a join key in `attendance-key.ts`'s unbound branch — a formatted date leaking in silently breaks dex derivation (D-35). |
| Presence wire tokens | App sync (`sync/presenceActivity.ts`) | Supabase Realtime transport | Frozen vocabulary. Pure module, no Supabase import — already correctly structured. |
| Presence display labels | App copy (`config.copy`) | App presentation (`FriendRow`/`SelfRow`) | Resolution is receiver-side; the map must live where both `BottomTabBar` and the rows read it. |

---

## The Installed-PWA Dead Gap (FOUND-01)

### The box model, step by step

Facts established from the actual repo (all verified, file:line given):

| Fact | Source |
|------|--------|
| `viewport-fit=cover` is present | `packages/app/index.html:5-8` |
| `apple-mobile-web-app-status-bar-style: black-translucent` | `packages/app/index.html:10` |
| `display: "standalone"` in the manifest | `packages/app/vite.config.ts` (VitePWA `manifest.display`) |
| `box-sizing: border-box` applies to `*` including `html`/`body` | `node_modules/tailwindcss/preflight.css:8-16` — `*, ::after, ::before, ::backdrop, ::file-selector-button { box-sizing: border-box; … }` |
| `html, body, #root { height: 100% }` | `packages/app/src/styles.css:14-18` |
| `body { padding-bottom: env(safe-area-inset-bottom) }` | `packages/app/src/styles.css:220` |
| `<main>` reserves `calc(4rem + env(safe-area-inset-bottom) [+ overlayInset])` | `packages/app/src/components/AppShell.tsx:75-77` |
| `BottomTabBar` is `fixed bottom-0`, `height: calc(4rem + env(...))`, `paddingBottom: env(...)` | `packages/app/src/components/BottomTabBar.tsx:20-27` |
| `#root` is the React mount; `AuthGate`→`App`→`AppShell` are all inside it | `packages/app/src/main.tsx:6-19` |

Let `V` = viewport height, `S` = `env(safe-area-inset-bottom)`, `1rem` = 16px.

```
html      border box = V,          content box = V            (no padding)
body      border box = V,          content box = V − S        (border-box + padding-bottom: S)
#root     height:100% of body's CONTENT box                 = V − S
AppShell  h-full of #root                                   = V − S      spans [0, V−S]
<main>    padding-bottom = 4rem + S = 64 + S
          → content bottom edge at (V − S) − (64 + S)        = V − 64 − 2S
BottomTabBar  position:fixed ⇒ containing block is the VIEWPORT, NOT body's padding box
          height = 64 + S, bottom = 0                        spans [V − 64 − S, V]
          button area (border box minus its own S padding)   spans [V − 64 − S, V − S]
          → button-area TOP edge at                          V − 64 − S
```

**Dead gap = (tab-bar button top) − (main content bottom) = (V − 64 − S) − (V − 64 − 2S) = `S`.**

| Context | `S` | Dead gap |
|---------|-----|----------|
| Safari tab, iOS 15+ (bottom toolbar visible) | **0** | **0 — flush by construction** |
| Installed, iPhone with home indicator, **portrait** | **~34px** | **~34px** |
| Installed, iPhone with home indicator, **landscape** | **~21px** | **~21px** |
| Installed, iPhone SE / no home indicator | 0 | 0 |
| Installed, Android Chrome (gesture nav) | varies, often 0–24px | equal to `S` |

`S = 34` portrait / `21` landscape is the widely-reported value for home-indicator iPhones and matches
the table in the Apple Developer Forums thread on this exact env var. [CITED: developer.apple.com/forums/thread/716552]
The same thread documents the *other* half of the story: **on iOS 15+ Safari returns `0` for
`safe-area-inset-bottom` when the bottom toolbar is visible** — the toolbar itself occupies the
home-indicator area. That is the mechanism behind `REQUIREMENTS.md` §Verification Notes' claim that "the
whole bug class is invisible except on an installed home-screen instance." Confirmed independently.

**Confidence:** the *mechanism* is HIGH (deterministic from the CSS box model + the repo's own source;
no browser quirk required). The *magnitudes* are MEDIUM — 34/21 are community/forum-reported, and the
owner's device may differ. **The device pass must record the actual numbers**; the arithmetic above
predicts gap ≡ measured inset, and that identity is the single strongest thing the before-measurement
can confirm.

### Why this also explains the owner's report exactly

The todo (`2026-07-20-fix-bottom-viewport-gap-in-installed-standalone-pwa.md`) reports the gap on the
**orbit stage, the constellation, and the Gizzdex**. Orbit and constellation are non-scrolling routes
(`AppShell scroll={false}`, `App.tsx:100`); Gizzdex scrolls. Both branches of `AppShell.tsx:75-77` share
the `4rem + env(...)` base, so the gap is identical on all three. The owner's own hypothesis ("sized for
the shorter address-bar-present viewport") predicts a gap that varies with the toolbar; the double-count
predicts a gap that equals the inset exactly and is identical across routes. **The readout distinguishes
them in one screenshot** — record `S` and the gap side by side.

### Why the alternatives in the todo are dead ends

| Candidate | Verdict |
|-----------|---------|
| "`height:100%` chain broken by an intermediate element" | **Ruled out by inspection.** The chain is `html → body → #root → AppShell(h-full) → main(flex-1)`, all present, all `height:100%`/`flex-1`. Verified `styles.css:14-18`, `AppShell.tsx:39`, `AppShell.tsx:62-67`. |
| `100dvh` / `100svh` / `100lvh` | **Forbidden by D-14** and independently risky: iOS 26 shipped viewport/safe-area regressions in this family (iOS 26.1 returned a wrong `safe-area-inset-top` in landscape, fixed in 26.2 beta 3) [CITED: WebSearch, iOS 26 safe-area regression reports]. Also unnecessary — the gap is not a viewport-height problem. **Note the repo already has one `min-h-dvh`: `auth/SignInScreen.tsx:125`.** It is outside `AppShell` (pre-auth full-screen) and out of scope, but the planner should be aware it exists so a `dvh` grep does not read as a new violation. |
| JS-measured `--vh` from `visualViewport` | Speculative mechanism with no reproduced defect; D-17's discipline applies. Not needed. |
| "`env(safe-area-inset-bottom)` double-counted" | **This is it.** Exactly the todo's third candidate. |

### The fix, and what it does to every other surface

Remove `padding-bottom: env(safe-area-inset-bottom)` from `body` (`styles.css:220`). Keep
`padding-left`/`padding-right` (`:221-222` — no per-surface duplicate exists for those). Then `#root = V`,
main content bottom = `V − 64 − S` = tab-bar button top. Flush. This is the **exact structural mirror of
the UX-01/D-01 top-inset fix whose comment sits three lines above the offending line** (`styles.css:217-219`).

**Every `position: fixed` surface is unaffected by this change** — fixed elements are already anchored to
the viewport, never to body's padding box. That is why the FAB, the tab bar, the sheets and the toasts
all have arithmetically correct offsets today despite the bug (see the inventory below). The change moves
exactly one thing: the height of the in-flow document.

**One consequence to check in the device pass:** with body's bottom padding gone, an in-flow element that
scrolls to the very bottom of a scrolling route now ends at `V`, under the tab bar — but `<main>`'s
`padding-bottom` already reserves `64 + S` for precisely that, so no content lands under the home
indicator. Verify on the Dex tab (the longest scroller) as part of test #1.

### Measuring on device (the FOUND-01 deliverable)

`env()` values cannot be read directly from JS. Two documented techniques, both usable:

1. **Probe element (most robust).** Create an element with the inset as a *padding*, read the computed
   padding back:
   ```
   const probe = document.createElement("div");
   probe.style.paddingBottom = "env(safe-area-inset-bottom)";
   document.body.appendChild(probe);
   const inset = parseFloat(getComputedStyle(probe).paddingBottom);
   probe.remove();
   ```
   [CITED: benfrain.com/how-to-get-the-value-of-phone-notches-environment-variables-env-in-javascript-from-css/]
2. **Custom property + `getComputedStyle`.** Declare `:root { --sab: env(safe-area-inset-bottom) }` in
   the stylesheet, then read `getComputedStyle(document.documentElement).getPropertyValue("--sab")`.
   Same source. This is the CSS-authored form — see §Single-Owner Mechanism for why that matters.

**Recommended readout contents** (the D-14 temporary harness, gated behind a URL flag exactly like
`?mockLatest=1`, `live/mockLatest.ts:97-100`):

| Field | Why |
|-------|-----|
| `env(safe-area-inset-*)` all four, via probe | The independent variable. Landscape must be captured separately. |
| `display-mode` — `navigator.standalone === true` **and** `matchMedia("(display-mode: standalone)").matches` | iOS uses the legacy `navigator.standalone`; Android Chrome uses the media query. Capture both. [CITED: web.dev/learn/pwa/detection] |
| `window.innerHeight`, `document.documentElement.clientHeight`, `visualViewport.height` | Distinguishes a viewport-sizing story from the box-model story. |
| `offsetHeight` of `html`, `body`, `#root`, `main`, and the orbit stage | **Predicts `body.offsetHeight − #root.offsetHeight === S` if D-15 holds.** This single equality is the whole diagnosis. |
| `getBoundingClientRect().bottom` of `main`'s last child, and `.top` of the tab bar's first button | **The gap itself, in one subtraction.** This is the number that goes in `21-HUMAN-UAT.md`. |
| Device model, iOS/Android version, orientation | D-18 requires them. |
| `devicePixelRatio` and computed `font-size` of `html` | So a `rem`-based reading is interpretable, and so the largest-Dynamic-Type run (test #3) is comparable. |

Render it as selectable text in a fixed overlay so a screenshot captures it. **The harness pays for
itself twice** (D-14): it is both the diagnosis and the before/after evidence, and it makes D-19's
"a non-reproduction still satisfies FOUND-01" mechanically checkable.

---

## Bottom-Space Call-Site Inventory (FOUND-02)

Complete enumeration. Every occurrence of `env(safe-area-inset-bottom)`, `4rem`, `64px` and `bottom-16`
in `packages/app/src`, with the offset each currently produces on an installed instance (`S` = inset).

### Group A — the surfaces that are actually wrong today

| # | Site | Current expression | Installed behavior | Fix |
|---|------|--------------------|--------------------|-----|
| A1 | `styles.css:220` | `body { padding-bottom: env(safe-area-inset-bottom) }` | Shortens `#root` by `S` → **the FOUND-01 gap** | Remove (D-15) |
| A2 | `AppShell.tsx:76` (scroll) | `calc(4rem + env(...) + ${overlayInset}px)` | Correct *value*, applied inside an already-shortened box | `var(--gz-content-reserve)` |
| A3 | `AppShell.tsx:77` (no-scroll) | `calc(4rem + env(...))` | Same | `var(--gz-chrome-reserve)` |
| A4 | `BingoCelebration.tsx:206` | `fixed … bottom-16`, **no** `paddingBottom` | Content bottom at `V−64`; tab-bar button top at `V−64−S` → **overlaps the tab buttons by `S`** | `bottom: var(--gz-chrome-reserve)` |
| A5 | `WaveToast.tsx:168` | `fixed … bottom-16`, **no** `paddingBottom` | Same overlap | `bottom: var(--gz-chrome-reserve)` |

> **SHARPENS D-09.** D-09 states all five `bottom-16` overlays "overlap the top of the tab bar by exactly
> one inset." Only **two** do. `InstallBanner.tsx:93`, `UpdateToast.tsx:36` and `BackupToast.tsx:74` each
> set `paddingBottom: env(safe-area-inset-bottom)`, which pushes their *content* up to `V−64−S` — exactly
> flush with the tab-bar button top. Their **boxes** overlap; their **content** does not.
>
> Two consequences the plan must carry:
> 1. Converting those three to `bottom: var(--gz-chrome-reserve)` **must also delete their
>    `paddingBottom: env(...)`** — otherwise `S` of dead padding appears *inside* each toast. This is not
>    a byte-identical conversion; it is a visible improvement, and it needs the same before/after shot.
> 2. `useBottomOverlayHeightRegistration` measures `el.offsetHeight`, which today **includes** that `S` of
>    padding. So `--gz-overlay-inset` currently over-reserves by `S` on scrolling routes whenever one of
>    those three is visible. Removing the padding fixes the reserve too. Note the direction: this makes
>    the reserve *smaller*, so the device pass must confirm nothing becomes covered.
>
> `BingoCelebration.tsx:207-211` carries a comment reasoning that adding `paddingBottom: env(...)`
> "only made the bottom padding smaller than `py-4`'s top — the text read as cut off." That is a
> **Safari-tab-only observation** (`env() = 0` there replaces `py-4`'s 16px with 0). Installed, `S = 34 > 16`
> and the reasoning inverts. Correct the comment (D-09 already says so — this is the mechanism behind it).

### Group B — arithmetically correct today; convert for single-ownership only (byte-identical)

All of these are `position: fixed` (or `absolute` in a viewport-anchored container), so they never saw
the body double-count.

| # | Site | Current | Resolves to (installed) | After |
|---|------|---------|--------------------------|-------|
| B1 | `BottomTabBar.tsx:25-26` | `height: calc(4rem + env(...))`, `paddingBottom: env(...)` | `[V−64−S, V]`, buttons `[V−64−S, V−S]` ✓ | `height: var(--gz-chrome-reserve)`, `paddingBottom: var(--gz-safe-bottom)` |
| B2 | `show/fabLayout.ts:13` (resting) | `calc(env(...) + 64px + 16px)` | `V−80−S` → 16px above the tab buttons ✓ | `var(--gz-fab-offset)` = `calc(var(--gz-chrome-reserve) + 16px)` — **identical** |
| B3 | `show/fabLayout.ts:12` (strip up) | `calc(env(...) + 64px + 112px + 16px)` | 16px above the reserved strip ✓ | `calc(var(--gz-chrome-reserve) + 112px + 16px)` — **identical value**, but the *trigger* changes (D-05, below) |
| B4 | `ExploreFilterFab.tsx:73` | `calc(env(...) + 64px + 8px)` | 8px above the tab buttons ✓ | `calc(var(--gz-chrome-reserve) + 8px)` — identical |
| B5 | `Sheet.tsx:104` | `calc(env(...) + 32px)` | ✓ | `var(--gz-sheet-pad-bottom)` |
| B6 | `ArchiveBrowser.tsx:379` | `calc(env(...) + 32px)` | ✓ | `var(--gz-sheet-pad-bottom)` |
| B7 | `CometTrail.tsx:231` | `calc(env(...) + 32px)` | ✓ | `var(--gz-sheet-pad-bottom)` |
| B8 | `RecapView.tsx:442` | `calc(env(...) + 16px)` | ✓ | `calc(var(--gz-safe-bottom) + 16px)` (page footer, not a sheet — D-07/UI-SPEC) |
| B9 | `NodeSheet.tsx:153` | `paddingBottom: env(...)` | Sheet sits `fixed bottom-0`, own inset ✓ | `var(--gz-safe-bottom)` — **not** tab-bar-relative (it covers the bar) |
| B10 | `InstallBanner.tsx:93` / `UpdateToast.tsx:36` / `BackupToast.tsx:74` | `paddingBottom: env(...)` | See Group A note | **Delete** alongside the `bottom-16` conversion |

**This is the phase's biggest de-risking finding:** ten of the fifteen conversions are provably
value-preserving. D-13's "one commit establishes the owner with behavior byte-identical to today" is
achievable for Group B; Group A carries the only intended behavior deltas, and each has a device shot.

### Group C — audit targets, likely no change

| # | Site | Note |
|---|------|------|
| C1 | `MapView.tsx:468` | `absolute bottom-0 … pb-3` status-chip strip, `zIndex: z.content`, inside the MapView stage container — **not viewport-anchored, not tab-bar-relative**. Its `absolute` parent is the map stage, which itself sits inside `<main>`'s reserved area. Recommend: leave, with a comment (D-08's escape hatch). |
| C2 | `BingoPeekStrip` | In-flow, never `fixed`. **Confirmed out of scope** (D-10) — grep shows no bottom offset of any kind. |
| C3 | `SuggestionStrip.tsx:151` | `config.ui.SUGGESTION_STRIP_HEIGHT` (112) inline height, `reserveSpace \|\| hasContent`. Stays a fixed constant (D-06). It is in-flow inside the show column, not bottom-anchored. |

### D-05: what actually changes in `fabLayout.ts`

Current signature: `showBottomFabOffset(stripHasContent: boolean)`. Call site is `FabMenu`/the weak-fan
hint. The **value** for each branch is unchanged after conversion (B2/B3 above). What changes is the
**argument**: `stripHasContent` → `stripSlotReserved`, fed the same `openerSeeded` signal that drives
`<SuggestionStrip reserveSpace>` (`ShowView.tsx:489` region).

Because the reserved slot height (112px) is always ≥ the rendered row height (the 56→112px correction
from the Phase-10 VALID-02 rehearsal, `config.ts:225-232` comment), **the FAB still clears every rendered
suggestion row** — the `a60d5e2` lift is re-expressed, not undone (D-05's explicit cross-check). The plan
should state this in the commit message so a future reader does not read it as a regression.

`packages/app/test/fabMenu.test.tsx` already exists and asserts against this offset — read it before
changing the signature; it is the existing regression net.

### Single-Owner Mechanism — two implementation details that will bite

**1. Write to `document.documentElement`, not `#root`.**

`Sheet.tsx:77/90` calls `createPortal(…, document.body)`. A portaled node is a child of `<body>`, **not**
of `#root`. CSS custom properties inherit down the DOM tree — so a variable set on `#root` is invisible
to every portaled sheet, including `--gz-sheet-pad-bottom`, which is *specifically for sheets*. After
D-21 portals five more surfaces, this would silently break all six.

> Set every `--gz-*` on `document.documentElement` (`:root`). Everything — `#root` subtree and
> `document.body` portals alike — inherits from `html`.

**2. Declare `--gz-safe-bottom` statically in CSS; write only the numbers from JS.**

Recommended split:
```
/* styles.css  —  the ONE permitted raw env(), whitelisted by the D-12 guard */
:root { --gz-safe-bottom: env(safe-area-inset-bottom); }
```
```
// layout/bottomSpace.ts  —  writes config-derived numbers + the measured overlay inset
root.style.setProperty("--gz-tab-bar-h", `${config.ui.bottomSpace.TAB_BAR_HEIGHT_REM}rem`);
root.style.setProperty("--gz-overlay-inset", `${overlayInset}px`);
root.style.setProperty("--gz-chrome-reserve", "calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))");
// …etc
```

**Why:** the `:root { --x: env(...) }` form is the documented, widely-deployed pattern
[CITED: benfrain.com/css-environment-variables-iphonex/, MDN "Using environment variables"]. Whether
`element.style.setProperty("--x", "env(safe-area-inset-bottom)")` survives the JS round-trip and still
resolves is **not** documented in any source found this session — the spec says it should (custom
properties accept arbitrary token streams; `env()` substitutes at computed-value time) but Safari has a
history of `env()` edge cases. This is a MEDIUM-confidence risk with a zero-cost mitigation: author that
one line in CSS. It still satisfies D-01/D-12 — `env(safe-area-inset-bottom)` appears exactly once in the
codebase, the guard whitelists `styles.css`'s `:root` block, and the *numbers* still live in `config.ts`.

If the planner prefers strict D-01 wording (everything from `layout/bottomSpace.ts`), add an explicit
browser smoke-check task: set the property from JS, then assert via the probe technique that
`--gz-chrome-reserve` resolves to a non-zero value greater than `4rem` on an installed instance.

**Bonus:** the search record shows `env()` **directly inside `calc()`** is itself a reported Safari
failure mode, with "assign to a custom property first, then use the custom property in `calc()`" as the
standard workaround [CITED: WebSearch — multiple sources incl. developer.apple.com/forums/thread/717296].
The codebase currently uses `calc(env(...) + …)` in **eight** places (A2, A3, B1–B8). This phase removes
all of them. That is a second, independent reason the D-01 design is right — worth a line in the commit
message.

### The D-12 Guard's Real Enemy

D-12 specifies a source scan failing on `4rem`, `64px`, or a bare `env(safe-area-inset-bottom)` outside
the owner. Two concrete hazards found by grepping:

**Hazard 1 — the literal is `bottom-16`, not `4rem`.** The five toast overlays never write `4rem` or
`64px`; they write the Tailwind class `bottom-16`. A guard on `4rem|64px|env(safe-area-inset-bottom)`
**would pass while all five are still unconverted.** The guard must include `bottom-16` (and
`inset-y-16`, `h-16`, `bottom-\[.*\]`) in its pattern.

**Hazard 2 — `pb-16` / `pt-16` are legitimate and everywhere.** Verified sites that must **not** trip the
guard:

```
auth/SignInScreen.tsx:125      pb-16    dex/CompareView.tsx:120       pb-16
components/PlaceholderView.tsx:13  pt-16 dex/DexView.tsx:84,229        pt-16, pb-16
dex/AlbumDetail.tsx:79         pb-16    dex/FriendDetail.tsx:193       pb-16
dex/AlbumGrid.tsx:60           pb-16    dex/FriendsList.tsx:90         pt-16 pb-16
dex/SetlistView.tsx:159        pb-16    dex/ShowsList.tsx:210          pt-16 pb-16
games/GamesView.tsx:250        pb-16    settings/SettingsView.tsx:160  pb-16
```
Twelve sites. A loose `-16\b` pattern produces twelve false positives. **Anchor the pattern on
`bottom-16` / `inset-y-16` specifically.**

**Hazard 3 — comments mention the numbers.** `AppShell.tsx:22`, `BottomTabBar.tsx:21`,
`ExploreFilterFab.tsx:27,70-71`, `FabMenu.tsx:101`, `bottomOverlayInset.ts:6` all contain `64px`/`4rem`/
`h-16` in prose. Either strip `//` and `/* */` comments before scanning (recommended — a small regex,
same approach the cover-art budget guard could use) or require the plan to rewrite those comments. The
comments should be rewritten anyway (several are now wrong), so either path works — but the guard test
must state which discipline it enforces or it will fail confusingly.

**Precedents to copy:** `packages/app/test/rebrand.test.ts` (reads `index.html` and `vite.config.ts` via
`readFileSync` + `fileURLToPath(import.meta.url)` path resolution) and
`packages/app/test/coversManifest.test.ts`. Both already in the app project, both passing.

---

## The Stacking-Context Defect (FOUND-03)

### Confirmed from source — and narrower than CONTEXT assumes

`ShowView.tsx:173-183`:
```
const withBackground = (content: ReactNode) => (
  <div className="relative flex h-full min-h-0 flex-1 flex-col">
    <ShowBackground coverUrl={targetCover} />
    <div className="relative flex h-full min-h-0 flex-1 flex-col"
         style={{ zIndex: config.ui.z.content }}>   // ← position:relative + z-index:10
      {content}
    </div>
  </div>
);
```
A positioned element with `z-index != auto` **creates a stacking context** (CSS Positioned Layout spec).
Everything inside paints as a single unit at level 10 within its parent context. `App.tsx:117-123` renders
the toasts as **siblings of `AppShell`**, so they land in the root stacking context at `toast: 20`.
`20 > 10` ⇒ **a toast paints over everything in the show column, regardless of that surface's own
z-index.** This is deterministic CSS, not a browser quirk — HIGH confidence, and reproducible in a desktop
browser (which is what makes D-29's harness cheap and D-30's ordering correct).

**Surfaces captured by the `content: 10` context** (all rendered inside `withBackground(...)` at
`ShowView.tsx:506`):

| Surface | Its z-tier | Effective paint level | Loses to `toast: 20`? |
|---------|-----------|----------------------|----------------------|
| `SearchSheet.tsx:100` | `sheet: 50` | 10 | **Yes** |
| `CometTrail.tsx:226` scrim | `sheetScrim: 40` | 10 | **Yes** |
| `FabMenu.tsx` scrim / rows | `fabScrim: 25` / `fab: 30` | 10 | **Yes — and this is the mid-show tap-eater (D-27)** |
| `CatchUpSheet`, `EndShowDialog`, `WhyDetail` | via `<Sheet>` → `createPortal(document.body)` | **root level** | **No** — portaled, immune |

**Surfaces NOT captured** — verified, and this narrows the work:

| Surface | Container | Verdict |
|---------|-----------|---------|
| `AlbumDetail.tsx:48` | `DexView.tsx:99` — `mx-auto flex w-full max-w-md … flex-col`, **no z-index, no transform, not positioned** | Competes at root; `50 > 20` ✓ **correct today** |
| `ArchiveBrowser.tsx:270/374` | Same | ✓ correct today |
| `SetlistView.tsx:120/131` | Same | ✓ correct today |
| `NodeSheet.tsx:150` | `ExploreView` returns a `<>` fragment; parent is `<main>` (unpositioned) | Competes at root ✓ correct today |

> **SHARPENS D-20/D-21/D-22.** CONTEXT lists five surfaces to portal (`SearchSheet`, `AlbumDetail`,
> `ArchiveBrowser`, `SetlistView`, `NodeSheet`). Only **`SearchSheet`** is actually defective; the other
> four are already at root level. Portaling all five is still defensible — it makes the D-24 structural
> invariant uniformly true and removes a latent trap (adding `z-index` to `DexView`'s wrapper later would
> silently break three sheets). But the planner should know that **four of the five are prophylactic, one
> is a live bug fix**, and size/sequence the risk accordingly: `SearchSheet` is both the only necessary
> conversion and (per UI-SPEC) the highest-risk one. If schedule pressure appears, the four prophylactic
> conversions are the droppable part — the live fix and the invariant test are not.
>
> Also note the D-27 addition (`FabMenu`) is **not** fixed by portaling a sheet — it needs its own
> portal, or it needs the toasts to stop being able to reach it. It is the same root cause and the worse
> symptom (it eats taps in the live-logging loop, `fabScrim: 25` scrim + `fab: 30` rows both at effective
> level 10 under a `toast: 20`). Treat `FabMenu` as a first-class target, not a footnote.

### Transform-created contexts (D-28)

Grep results for `transform` / `filter` / `backdrop-filter` / `opacity` / `will-change` on potential
ancestors:

| Site | Assessment |
|------|------------|
| `ShowBackground.tsx:40-41` — `filter: blur(...)`, `transform: scale(1.2)` | **Sibling** of the content column inside `withBackground`, not an ancestor of any sheet. No capture. |
| `ExploreBackground.tsx:120-121` — `transform: translate3d(...)`, `willChange: transform`; `:157` `filter: blur(...)` | Background layer, sibling of the canvas. Verify it is not an ancestor of `NodeSheet` (it is not — `NodeSheet` is a later fragment child, `ExploreView.tsx:218-228`). No capture. |
| `MapView.tsx:213` — `transform: translate(...) scale(...)` on the pan/zoom stage | Ancestor of map pins only. `MapView.tsx:468`'s chip strip is `absolute`, not `fixed`, and is outside the transformed stage. Confirm during audit. |
| `ExploreFilterFab.tsx:97` — `transform: translateY(-liftPx)` | On the FAB's own root. Creates a context containing only its own children. Not a capture risk, but it **does** make the FAB a stacking context — relevant only if something inside it needs to escape. |

None of these currently capture a sheet. **Grep for them in the repro pass; fix only what reproduces
(D-28's own wording).**

### Layer-Ordering Test Design (D-24)

D-24 requires a *structural* assertion, and correctly rules out a pure config-value comparison (which
passes today despite the defect). Three candidate forms, evaluated against this codebase:

| Form | Tractable? | Genuinely satisfies FOUND-03? |
|------|-----------|-------------------------------|
| **(a) Source scan:** every file containing `config.ui.z.sheet` must also contain `createPortal(` | Trivial. Mirrors D-12/`rebrand.test.ts`. | Partially. Catches the enumerated surfaces; blind to a *new* ancestor gaining a `z-index`. |
| **(b) jsdom render + parent-chain walk:** render the surface, walk from its root to `document.body`, fail if any ancestor creates a stacking context | Very tractable **in this codebase specifically** — see below. | Yes. Directly encodes "its z-index competes at the top level." |
| **(c) Visual/pixel test** | Needs a real browser + Playwright — a new runtime dependency, forbidden. | Overkill. |

**Recommend (b), backed by (a).**

**Why (b) is complete here and would not be in a typical app:** *all* z-index in production goes through
inline `style={{ zIndex: config.ui.z.X }}` — never a Tailwind class. Verified: the only `z-*` utility in
the entire repo is `dev/OrbFitHarness.tsx:147`, a dev-only route. The transform-based contexts
(`ShowBackground`, `ExploreBackground`, `MapView`, `ExploreFilterFab`) are **also** inline styles. jsdom
does not load or cascade the Tailwind stylesheet, so class-derived computed styles are invisible there —
but in this codebase **there are none to miss**. An `element.style.*` walk is therefore a *complete*
detector. Record that reasoning in the test's doc comment, because the moment someone adds a `z-*` class
the test silently loses coverage.

Sketch of the assertion:

```
function createsStackingContext(el: HTMLElement): boolean {
  const s = el.style;                       // inline only — see doc comment above
  if (s.zIndex !== "" && s.zIndex !== "auto" &&
      (s.position === "relative" || s.position === "absolute" ||
       s.position === "fixed"   || s.position === "sticky" ||
       el.className.includes("relative") || el.className.includes("absolute") ||
       el.className.includes("fixed")    || el.className.includes("sticky"))) return true;
  if (s.transform && s.transform !== "none") return true;
  if (s.filter && s.filter !== "none") return true;
  if (s.backdropFilter && s.backdropFilter !== "none") return true;
  if (s.willChange.includes("transform") || s.willChange.includes("opacity")) return true;
  if (s.opacity !== "" && Number(s.opacity) < 1) return true;
  if (s.isolation === "isolate") return true;
  return false;
}
```
(The `className.includes` fallbacks are needed because `position` comes from Tailwind classes —
`relative`, `fixed` — while `zIndex` comes from inline style. That mixed idiom is exactly what
`ShowView.tsx:177-179` does.)

Then, per modal sheet-tier surface: render it open in a realistic tree, find the dialog root, and assert
`ancestorsUpToBody(root).every(el => !createsStackingContext(el))`.

**Modal-only scope, exceptions by name (D-26):**
```
// Exempt by name, with reasons — NOT oversights:
//  • NodeSheet  — aria-modal={false} (NodeSheet.tsx:147). Non-modal peek; FOUND-03
//    says "open MODAL sheet". Its coexistence with a lifted FAB is the point.
//  • focusedFab: 60 > sheet: 50 — deliberate (config.ts, D-03): the FilterFab lifts
//    ABOVE the non-modal NodeSheet so a keyboard/VoiceOver user can still reach the
//    filter while a node is focused. Renumbering it would be an a11y regression.
```
Drive the modal/non-modal split off the surface's own `aria-modal` attribute rather than a hand-kept
list — the DOM already carries the distinction, and it cannot drift.

**Plus the two named numeric guards (D-25):**
```
expect(config.ui.z.page).toBeLessThan(config.ui.z.sheetScrim);   // WR-01
expect(config.ui.z.fabScrim).toBeLessThan(config.ui.z.fab);      // CR-01
```
Both currently protected only by prose comments in `config.ts:255-297`. Two named assertions, **not** a
full ladder pin (a full pin would fight D-26's deliberate `focusedFab` inversion).

**Repro harness (D-29):** copy `live/mockLatest.ts`'s exact safety shape — `if (typeof location ===
"undefined") return null;` then an explicit `URLSearchParams(location.search).get("layerRepro") !== "1"`
early return, with a header comment stating it is inert on normal loads
(`mockLatest.ts:16-19, 97-100`). Force-show a toast so a sheet or the FabMenu can be opened over it.

---

## Date Formatting (FOUND-04, FOUND-05)

### The hazard, demonstrated

Show dates are stored as ISO date-only strings (`YYYY-MM-DD`) throughout — `session.active.date`,
`row.date`, `resolved.date`, `show.date`, and `db.ts`'s `todayIso` (`mockLatest.ts:23-28` mirrors its
device-local `YYYY-MM-DD` semantics). Per ECMAScript, a date-only ISO string is parsed as **UTC
midnight**; a formatter without an explicit `timeZone` then renders it in the **local** zone. Executed in
this session:

```
new Date("2026-08-15")
  → Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",year:"numeric", timeZone:"UTC"})
      = "Aug 15, 2026"     ← correct
  → same options with timeZone:"America/New_York"
      = "Aug 14, 2026"     ← THE BUG: the show slides a day earlier for every US user
```
[VERIFIED: executed via `node -e` in this session]

For a tool used at King Gizzard shows in the US, **every full date would render one day early** without
the `timeZone: "UTC"` guard. `formatMonYear.ts:7-11` already has it and documents exactly this
(`"a 2025-01-01 never slips to Dec 2024 in a negative-offset timezone"`). `formatFullDate` must mirror it
verbatim.

Invalid input: `new Date("not-a-date").getTime()` → `NaN` [VERIFIED: executed]. So the shipped
`Number.isNaN(date.getTime()) ? iso : FMT.format(date)` never-throw pattern (`formatMonYear.ts:14-15`)
transfers directly.

### Every full-date call site (complete)

| Site | Current | Type |
|------|---------|------|
| `ShowView.tsx:514-515` | `{session.active.date}`, `tabular-nums text-[14px] text-text-muted` | Visible |
| `ShowsList.tsx:233-234` | `{row.date}`, `tabular-nums text-[14px] font-semibold text-text-primary` | Visible |
| `SetlistView.tsx:147-148` | `{resolved.date}`, `tabular-nums text-[20px] font-semibold` | Visible |
| `SetlistView.tsx:129` | `aria-label={resolved.date}` | **Accessible name** (D-33) |
| `ArchiveBrowser.tsx:208-209` | `{show.date}`, `tabular-nums text-[14px] font-semibold` | Visible |
| `ArchiveBrowser.tsx:249` | `` aria-label={`${copy.unmarkConfirm} ${show.date}`} `` | **Accessible name** (D-33) |
| `RecapView.tsx:219` | `copy.subline(show?.date ?? "", venue)` → rendered at `:279` | Visible via template |
| `shareCard.ts:193-194` | `` const line = footer.venue ? `${footer.date} · ${footer.venue}` : footer.date `` | Canvas |
| `shareCard.ts:424-426` | Same shape, bingo trophy branch | Canvas |

`config.ts:1141-1144` `recap.subline(date, venue)` composes `{date} · {venue}` — keeps composing whatever
string it is given (D-34); the caller at `RecapView.tsx:219` formats first.

**Coarse Mon-Year stays** at `SongRow.tsx:39` and `WhyDetail.tsx:69` (D-32). Renaming the module to
`dex/formatDate.ts` requires updating those two importers.

`RecapView.tsx:219` passes `show?.date ?? ""` — **the empty-string path must be preserved.**
`new Date("")` is `Invalid Date` → `NaN` → the never-throw branch returns `""`. Then
`subline("", venue)` renders `" · Venue"`. That is today's behavior and the helper keeps it byte-identical.
Worth an explicit unit test so nobody "improves" it into `"Invalid Date · Venue"`.

### Share-Card Footer (FOUND-05)

`centerText(ctx, text, cx, y, size, color)` — **no `maxWidth` parameter** (`shareCard.ts:185-200` region;
both footer draws at `:194` and `:426` pass a 44px size and no constraint). Canvas is 1080×1350;
`shareCard.ts:417` already uses `width * 0.9` = **972px** as the badge-row max width — the natural value
to reuse (UI-SPEC specifies exactly this).

`truncateToWidth(ctx, text, maxWidth)` at `shareCard.ts:252-258` already ships and does exactly what
D-36 needs. `wrapLabel` at `:260-295` also ships. **No new drawing code is required** — only threading a
width through and splitting the measure.

**Order of operations that satisfies "truncate the venue, never the date":**
1. Set `ctx.font` to the 44px footer font (so `measureText` is honest).
2. Measure `` `${formattedDate} · ` ``.
3. `venueBudget = 972 − dateWidth`.
4. `truncateToWidth(ctx, venue, venueBudget)`.
5. Compose and draw.
6. Venue-`null` path: draw the date alone, no truncation possible (unchanged).

**This is fully unit-testable.** `packages/app/test/shareCard.test.tsx:95-113` builds a mock context whose
`measureText(text)` returns `{ width: text.length * 12 }` — deterministic and linear. At 972px that is
81 characters; `"Aug 14, 2026 · "` is 15, leaving a 66-character venue budget. A test can assert the
exact ellipsized string. **FOUND-05's overflow logic does not need a device to be verified — only its
real-font rendering does.** (Note the mock ignores font size, so the test verifies the *algorithm*, not
the real pixel fit. The device shot is still required, and the widest-venue choice matters — pick from
the actual archive, e.g. a long festival/amphitheatre name.)

**D-37 footer baseline:** both footers draw at `height * 0.99` = **1336.5px** on a 1350px canvas with a
44px font. Whether descenders clip depends on `textBaseline` — check what `centerText` sets. If it is
`alphabetic` (canvas default; the mock declares `textBaseline: "alphabetic"` at
`shareCard.test.tsx:102`), the baseline is at 1336.5 and descenders extend ~9-10px below it → **~1346px,
inside the canvas but with ~4px to spare.** Tight but probably fine; "Mon D, YYYY" has no descenders in
the date itself (digits and `Aug`/`Sep` — `g` and `p` **do** descend). Look during the device pass; fix
only if it clips (D-37). A `height * 0.97` nudge is the cheap fix if needed.

### D-35 storage boundary — where formatted dates must never reach

Verified surfaces that must stay ISO: Dexie rows, the backup/export envelope, export filenames, the
`show_id`/date join keys, and `attendance-key.ts`'s **unbound** branch (`date:${date}#${sessionId}`).
The date genuinely **is** a join key there — a formatted date leaking in would silently break dex
derivation and merge. Recommended guard: a unit test asserting `attendanceKey(...)` output still matches
`/^date:\d{4}-\d{2}-\d{2}#/`, plus the D-38 source check that no component renders a bare ISO show date.

---

## Tab Labels & Presence (NAV-01, NAV-02, NAV-03)

### Tab labels are hardcoded, not in `config.copy`

`BottomTabBar.tsx:4-13`:
```
const TABS: { route: Route; label: string; Icon: typeof Music }[] = [
  { route: "show",    label: "LiveGizz",  Icon: Music },
  { route: "explore", label: "GizzVerse", Icon: Compass },
  { route: "map",     label: "GizzMap",   Icon: Map },
  { route: "dex",     label: "GizzDex",   Icon: BookOpen },
  { route: "games",   label: "GizzGames", Icon: Gamepad2 },
];
```
The labels are **local string literals**, not `config.copy` reads. UI-SPEC requires both maps to live in
`config.copy` so `BottomTabBar` and `FriendRow`/`SelfRow` read one source (D-39). So NAV-01 is a *move*
plus a rename, not just a rename. Routes stay `show`/`explore`/`map`/`dex`/`games` (`useHashRoute.ts:9-17`),
icons stay, order stays, `aria-current` stays.

**NAV-02 guard:** extend `packages/app/test/rebrand.test.ts` — it already encodes the exact discipline
("the rebrand touched DISPLAY strings only; `config.DB_NAME` is unchanged") and already asserts
`config.DB_NAME === "guezzer"`. Add: `ROUTES` unchanged, `ROUTE_TO_TAB` unchanged, the `Tab` union
unchanged, and the five new labels present. Same file, same idiom, zero new infrastructure.

### Presence Label Resolution — where the label is produced (the NAV-03 crux)

**Resolution is receiver-side, at render time.** Traced end to end:

```
sender:   deriveActivity(route, hidden, atShowActive)  →  { tab: "GizzDex" }
          (presenceActivity.ts:75-84 — writes the TOKEN to the wire)
transport: gizz-room Supabase Realtime presence
receiver: reduceActivity(entries)                       (presenceActivity.ts:95-109)
            · validates each entry against the TABS allow-list
            · SKIPS any entry whose tab is not in the list
            · returns null when nothing valid remains
receiver: PresenceActivitySlot (FriendRow.tsx:~71-73)
            text = label ?? (activity == null ? null
                           : activity.atShow ? copy.presence.atShow
                           : activity.tab)             ← RAW TOKEN TO SCREEN
```

Three consequences that decide the whole NAV-03 design:

1. **Old builds cannot be fixed retroactively.** The label is chosen by the *receiver's* code. A friend on
   a pre-Phase-21 build will always render whatever its own code says. The only way NAV-03's
   two-direction test passes is if the **wire tokens are frozen** — which is exactly D-39. This makes D-39
   not a stylistic choice but *the* mechanism that satisfies NAV-03. Record that in the plan.
2. **Today's unknown-token behavior is `null` → blank, not a raw token.** `reduceActivity` *skips*
   unrecognized tabs (`:100`), and `PresenceActivitySlot` renders nothing for `null` (`FriendRow.tsx:~72`).
   So a *future* build sending a new token to a *today* build produces a **blank label** — NAV-03's
   explicit failure mode, and permanently unfixable for already-shipped builds. **D-41's fallback added
   now is therefore forward protection only** (it protects Phase 22+ builds from Phase 25+ tokens). The
   plan should state this honestly rather than implying it fixes both directions.
3. **The fallback must go in *two* places, not one.** Adding a label map with an `in the app` default only
   helps if the token *reaches* the map. `reduceActivity` drops unknown tokens before that. Two options:
   - **(i)** Relax `reduceActivity` to keep an unknown-but-string `tab` and let the label map resolve it
     to `in the app`. **Security note:** the allow-list is a real input-validation control over untrusted
     peer data. If relaxed, the raw token must never be rendered — the map's fallback must be a *constant
     string*, never `?? activity.tab`. That preserves the control's actual purpose (no attacker-supplied
     text reaches the DOM) while satisfying NAV-03.
   - **(ii)** Keep `reduceActivity` strict and make `PresenceActivitySlot` render the fallback for
     `activity == null` **when the friend's presence dot says online**. Narrower change, keeps the
     allow-list untouched, and `SelfRow.tsx:67-71` already distinguishes online/offline for exactly this
     slot.

   **Recommend (ii)** — it satisfies "never blank, never a raw token" without loosening a security
   control, and it is a smaller diff on a Phase-20-verified path. Whichever is chosen, the plan must
   name it, because it is the difference between NAV-03 being met and being nominally met.

**Two label voices (D-40):** UI-SPEC fixes the strings — presence uses `on LiveGizz` / `on GizzVerse` /
`on GizzMap` / `on GizzDex` / `on GizzGames`, `idle` unchanged, `At a show 🎸` unchanged (wins over the
tab), `offline` unchanged, unknown → `in the app`. Width check: `on GizzGames` (12 chars) vs the shipped
`At a show 🎸` — no new truncation risk in the `shrink-0` `presence-activity` slot.

**Correct the stale comment** at `presenceActivity.ts:20-23` (*"These ARE the display labels … so no
separate label map is needed"*) — NAV-01 falsifies it.

**NAV-03 device test (D-42):** two devices, two identities, **different builds**, over the HTTPS
cloudflared tunnel (`--http-host-header localhost` — see the project memory note on device UAT hosting),
label checked in both directions. Because tokens are frozen, the expected result is *no visible change* —
which is the point, and which is also why a unit test cannot substitute (the project has learned twice,
quick tasks `260724-hqu` / `260724-lgo`, that a unit-proven realtime path is not a verified one).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading safe-area insets in JS | A hardcoded 34/21 table, or UA sniffing | Probe element + `getComputedStyle` | Insets vary by device, orientation, and OS version; the 34/21 figures are community-reported, not spec |
| Detecting installed/standalone | `navigator.standalone` alone | `navigator.standalone === true \|\| matchMedia("(display-mode: standalone)").matches` | `navigator.standalone` is iOS-only and non-standard; the media query is the cross-platform form [CITED: web.dev/learn/pwa/detection] |
| Escaping a stacking context | Renumbering z-tiers | `createPortal(node, document.body)` | Renumbering cannot fix nesting — a 50 inside a 10 loses to a 20 at any number. Explicitly forbidden by `ROADMAP.md` §Coverage. |
| Canvas text ellipsis | A new truncation routine | `truncateToWidth` (`shareCard.ts:252`) | Already ships, already used for square labels and badges, already unit-tested against the mock ctx |
| UTC-safe date formatting | Manual `slice`/`split` string surgery on the ISO string, or a date library | `Intl.DateTimeFormat` with `timeZone: "UTC"` | Zero deps (a hard constraint), locale-correct, and `formatMonYear.ts` is the shipped template |
| Reactive overlay-height measurement | A new store | `pwa/bottomOverlayInset.ts` | `useSyncExternalStore` + `ResizeObserver` + a jsdom fallback already ship (D-03 folds it in, does not replace it) |
| A URL-flag dev harness | A new pattern | `live/mockLatest.ts`'s shape | Inert-unless-explicit guard, documented in a header comment, precedent set by `260713-wjd` |
| Cross-build presence safety | A version-negotiation protocol | Freeze the wire vocabulary + a receiver-side constant fallback | The receiver decides the label; old builds are immutable. Only a frozen vocabulary makes both directions correct. |

**Key insight:** this phase adds no capability. Every mechanism it needs already ships somewhere in the
repo. The risk is not "can we build it" — it is "does the conversion preserve behavior on surfaces that
were verified on-device in earlier phases." That is why D-13's per-surface revertibility and the
byte-identical Group B classification (§Bottom-Space Call-Site Inventory) matter more than any technique.

---

## Common Pitfalls

### Pitfall 1: Setting the `--gz-*` ladder on `#root`
**What goes wrong:** every portaled sheet loses `--gz-sheet-pad-bottom` and falls back to `0`.
**Why:** `createPortal(…, document.body)` places nodes outside `#root`; custom properties inherit down
the DOM tree.
**How to avoid:** set on `document.documentElement`.
**Warning sign:** sheets lose their 32px bottom padding — visible in a desktop browser immediately, so
this is caught free by the D-29 harness pass.

### Pitfall 2: Converting the three padded toasts without deleting their `paddingBottom`
**What goes wrong:** `S` (~34px) of dead space appears inside `InstallBanner`, `UpdateToast`,
`BackupToast` on installed instances — a *new* gap in the phase whose whole point is removing one.
**Why:** those three set `paddingBottom: env(safe-area-inset-bottom)` to compensate for `bottom-16`; once
`bottom` becomes `var(--gz-chrome-reserve)` the compensation is double-counted.
**How to avoid:** treat the `bottom` change and the `paddingBottom` deletion as one edit per file.
**Warning sign:** measured `offsetHeight` in the overlay store grows instead of shrinking.

### Pitfall 3: A D-12 guard that passes while the toasts are unconverted
**What goes wrong:** the guard scans for `4rem`/`64px` and finds none, because the toasts write
`bottom-16`.
**How to avoid:** include `bottom-16` / `inset-y-16` in the pattern; exclude `pb-16` / `pt-16` (12 legit
sites); strip comments before scanning (7 sites mention the numbers in prose).
**Warning sign:** the guard passes on the first commit, before any surface is converted.

### Pitfall 4: A "structural" layer test that only compares numbers
**What goes wrong:** it passes today despite the live defect (D-24 says this explicitly, and it is true —
the ladder *is* correctly ordered).
**How to avoid:** assert the ancestor chain, not the values. §Layer-Ordering Test Design.
**Warning sign:** the test is green before the portal fix lands.

### Pitfall 5: Portaling `SearchSheet` and losing SHOW-13 gesture suppression
**What goes wrong:** `styles.css:27-35` scopes `touch-action: manipulation`,
`overscroll-behavior: none`, `-webkit-touch-callout: none` to `.orbit-stage`, `.action-bar`, `.fab-menu`.
A portaled node has none of those ancestors. Double-tap zoom and the iOS long-press callout return on
**the** one-thumb-in-the-dark surface.
**How to avoid:** apply the needed classes directly on the portaled root (D-23), and re-run the SHOW-13
gesture checks.
**Warning sign:** none in a unit test — this is a device-only regression. Budget it explicitly.

### Pitfall 6: Assuming `formatFullDate` in core
**What goes wrong:** `packages/core` has `"lib": ["ES2023"]` and zero display layer. `Intl` is in
ES2023's lib so it would *compile* — but it would invent a presentation responsibility in a module whose
entire contract is purity, and CLAUDE.md's "UI imports from core, never the reverse" is about domain
logic, not string formatting.
**How to avoid:** D-31 already places it in `packages/app/src/dex/formatDate.ts`. Follow it.

### Pitfall 7: A formatted date reaching storage
**What goes wrong:** `attendance-key.ts`'s unbound branch uses the date as a **join key**. A formatted
date silently breaks dex derivation and backup merge — no error, wrong counts.
**How to avoid:** format at the call site only (D-34); add the regex guard on `attendanceKey` output.
**Warning sign:** dex counts change after the date conversion. Test the export/import round-trip
(`exportImportRoundtrip.test.ts` already exists).

### Pitfall 8: Reading `env()` back after a JS `setProperty`
**What goes wrong:** unverified whether `element.style.setProperty("--x", "env(safe-area-inset-bottom)")`
resolves in Safari. If it silently yields an invalid value, every composed reserve collapses — and it
collapses to `0` in a Safari tab too, so it might look fine in dev.
**How to avoid:** author that one declaration in `styles.css :root`. §Single-Owner Mechanism.
**Warning sign:** `--gz-chrome-reserve` resolves to `4rem` exactly on an installed device (the `env()`
term dropped).

---

## Runtime State Inventory

This phase is a refactor/rename, so the inventory is required. **Every category was checked.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | **None.** The tab rename touches display labels only. Dexie keys, `config.DB_NAME` (`"guezzer"`, asserted by `rebrand.test.ts:51`), and route strings (`ROUTES` in `useHashRoute.ts:9-17`) are untouched. Verified: `BottomTabBar.tsx` writes no storage; `navigate(route)` writes `location.hash` only. | None — and the `rebrand.test.ts` assertion is the standing guard |
| **Live service config** | **Supabase `gizz-room` Realtime presence payloads.** These are ephemeral (never persisted — spike-findings skill: "ephemeral activity rides Realtime and is never persisted"), but they are **in flight on other devices' builds**. The `Tab` union is the wire vocabulary. **Frozen by D-39 — no migration needed, and that is precisely why NAV-03 passes.** No Supabase table, RLS policy, or SQL migration is touched by this phase. | None — verified frozen |
| **OS-registered state** | **None.** No Task Scheduler entries, no pm2 processes, no launchd/systemd units. The PWA manifest `name`/`short_name` (`"Gizz With Friends"`) is **not** changed by NAV-01 — the tab labels are in-app chrome, so no home-screen icon label changes and no re-install is required. | None |
| **Secrets / env vars** | **None.** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are untouched. No new env var is introduced (the `?layerRepro=1` flag is a URL query param, not an env var). | None |
| **Build artifacts / installed packages** | **`packages/app/dist/` is stale and committed-adjacent** — `grep` found `mockLatest` inside `dist/assets/index-an4shMDo.js`, i.e. a previous build output is present on disk. It will be regenerated by `vite build`; it is not a correctness risk, but source-scanning guard tests **must not scan `dist/`**. The D-12 and D-38 guards scan `packages/app/src` only — keep it that way, or a stale bundle fails the build. | Scope guards to `packages/app/src`; no package reinstall needed (zero dependency changes) |

**One live-instance consideration not in the categories above:** under `registerType: "prompt"`
(`vite.config.ts`), users on an old service worker keep running the old build until they accept an
update. **Mixed builds are the designed state** (D-41 says so). The FOUND-01 fix is CSS-only and
self-contained per build, so there is no cross-build layout interaction — but the NAV-03 presence
interaction is real, and is exactly what D-42's two-device test exercises.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest **4.1.10** (verified: root `package.json` devDependencies) |
| Config file | `vitest.config.ts` (repo root) — `test.projects` with two explicit entries: `@guezzer/core` (`node`) and `@guezzer/app` (`jsdom`, `setupFiles: ["./test/setup.ts"]`) |
| App test location | `packages/app/test/**/*.test.{ts,tsx}` — **not** co-located with source |
| Quick run command | `npx vitest run --project @guezzer/app <file>` |
| Full suite command | `npm test` (= `vitest run`) |
| **Measured baseline** | **125 test files, 954 tests, all passing, 7.74s wall clock** [VERIFIED: executed in this session] |
| Lint / typecheck | **None configured.** No ESLint, no `typecheck` script — verified: root `package.json` has only `test`/`refresh`/`build:*`/`db:*`/`seed:*`; no `eslint.config.*` exists. TypeScript 6.0.3 is installed but never invoked by a script. **The test suite is the entire automated gate.** |

Because the full suite runs in under 8 seconds, **use `npm test` as both the per-task and per-wave gate** —
there is no reason to sample a subset. That makes the Nyquist rate trivially satisfied.

### Phase Requirements → Test Map

| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| FOUND-01 | Body flush with the tab bar on an installed instance, portrait + landscape | **Manual — device only** | — | ❌ **Un-automatable.** `env(safe-area-inset-bottom)` is `0` in every headless/jsdom/desktop context and non-zero only on an installed home-screen instance. Recorded in `21-HUMAN-UAT.md` (D-18) |
| FOUND-01 | Body-level bottom padding is gone from `styles.css` | unit (source scan) | `npx vitest run --project @guezzer/app test/bottomSpace.test.ts` | ❌ Wave 0 |
| FOUND-01 | `AppShell` `<main>` reads `var(--gz-content-reserve)` / `var(--gz-chrome-reserve)` per `scroll` prop | unit (jsdom render, inline style) | same file | ❌ Wave 0 |
| FOUND-02 | The composed ladder resolves from `config.ui.bottomSpace` (no drift between config and CSS var) | unit | same file | ❌ Wave 0 |
| FOUND-02 | Source guard: `bottom-16`, `4rem`, `64px`, bare `env(safe-area-inset-bottom)` appear nowhere in `packages/app/src` except the owner | unit (source scan, comment-stripped) | same file | ❌ Wave 0 — **the D-12 guard** |
| FOUND-02 | `--gz-*` are set on `document.documentElement`, not `#root` | unit (jsdom) | same file | ❌ Wave 0 |
| FOUND-02 | `showBottomFabOffset` takes `stripSlotReserved` and its two branch values are unchanged | unit | `test/fabMenu.test.tsx` (**extend**) | ✅ exists |
| FOUND-02 | Overlay-inset store still feeds the content reserve only (not the chrome reserve) | unit | `test/bottomOverlayInset.test.tsx` (**extend**) | ✅ exists |
| FOUND-03 | No ancestor of an open **modal** sheet creates a stacking context, up to `document.body` | unit (jsdom ancestor walk) | `npx vitest run --project @guezzer/app test/layerOrder.test.tsx` | ❌ Wave 0 — **the FOUND-03 invariant** |
| FOUND-03 | `NodeSheet` (non-modal) and `focusedFab: 60` are exempt **by name, with comments** | unit | same file | ❌ Wave 0 |
| FOUND-03 | WR-01 `page < sheetScrim`; CR-01 `fabScrim < fab` | unit | same file | ❌ Wave 0 |
| FOUND-03 | Every portaled surface keeps its a11y contract (focus trap, focus return, Escape, `aria-modal`) | unit (jsdom) | `test/sheet.a11y.test.tsx` (**extend/mirror per surface**) | ✅ exists — 8 cases incl. stacked modals |
| FOUND-03 | `SearchSheet`'s portaled root carries the gesture-suppression classes (D-23) | unit (className assertion) | `test/layerOrder.test.tsx` | ❌ Wave 0 |
| FOUND-03 | Actual paint order over a real toast | **Manual — desktop browser via `?layerRepro=1`** | — | Reproducible, not automatable without a browser runner (forbidden: zero new deps) |
| FOUND-04 | `formatFullDate("2026-01-01")` → `"Jan 1, 2026"` under a **negative-offset TZ** (`TZ=America/New_York`) | unit | `npx vitest run --project @guezzer/app test/formatDate.test.ts` | ❌ Wave 0 |
| FOUND-04 | Invalid input returns the raw string, never `"Invalid Date"`; `""` returns `""` | unit | same file | ❌ Wave 0 |
| FOUND-04 | `formatMonYear` behavior unchanged after the module rename | unit | `test/songRow.test.tsx` (**existing, must still pass**) | ✅ exists |
| FOUND-04 | Each of the 5 visible call sites renders `Mon D, YYYY` | unit (render) | `test/showsList.test.tsx`, `test/archiveBrowser.test.tsx`, `test/recapView.test.tsx` (**extend**) — plus new coverage for `ShowView` header and `SetlistView` | ✅ 3 exist / ❌ 2 gaps |
| FOUND-04 | The two accessible names read the formatted date (D-33) | unit (`getByLabelText`) | `test/archiveBrowser.test.tsx` (**extend**) + SetlistView | ✅/❌ |
| FOUND-04 | **Display-only boundary:** `attendanceKey` output still matches `/^date:\d{4}-\d{2}-\d{2}#/`; export round-trip unchanged | unit | `test/exportImportRoundtrip.test.ts` (**extend**) | ✅ exists |
| FOUND-05 | Footer draws `Mon D, YYYY`; venue ellipsized to the remaining budget; **date never truncated** | unit (mock ctx, `measureText = len*12`) | `test/shareCard.test.tsx` (**extend**) | ✅ exists |
| FOUND-05 | Venue-`null` path draws the date alone | unit | same | ✅ exists |
| FOUND-05 | Real PNG at the widest realistic venue name — no truncation of the date, no overflow, footer baseline not clipping | **Manual — device only** | — | ❌ Real canvas metrics + real share sheet. `21-HUMAN-UAT.md` test #5 |
| NAV-01 | Tab labels read `Live · GizzVerse · Map · Me · Games`, sourced from `config.copy` | unit (render) | `test/rebrand.test.ts` (**extend**) | ✅ exists |
| NAV-02 | `ROUTES`, `ROUTE_TO_TAB`, the `Tab` union, and `config.DB_NAME` all unchanged | unit | same file | ✅ exists — already asserts `DB_NAME` |
| NAV-02 | In-page headings keep the brand names (`sectionHeading: "GizzGames"`) | unit | same file | ✅ exists |
| NAV-03 | Every known token maps to a non-empty presence label | unit | `npx vitest run --project @guezzer/app test/presenceLabels.test.ts` | ❌ Wave 0 |
| NAV-03 | Unknown/absent token → `in the app`; **never blank, never the raw token** | unit | same file | ❌ Wave 0 |
| NAV-03 | `At a show 🎸` still wins over the tab; `offline` unchanged | unit | `test/sync/*` presence tests (**extend**) | ✅ likely — `test/sync/` dir exists |
| NAV-03 | Two devices, **different builds**, both directions, over the HTTPS tunnel | **Manual — device only** | — | ❌ Requires real Realtime + two builds. Precedent: `260724-hqu` / `260724-lgo` |

### Sampling Rate

- **Per task commit:** `npm test` (full suite, 7.7s — no reason to subset)
- **Per wave merge:** `npm test` + `npm run build --workspace packages/app` (catches TS errors, since no
  standalone typecheck script exists)
- **Phase gate:** full suite green **plus** `21-HUMAN-UAT.md` complete with all 6 device tests recorded

### Wave 0 Gaps

- [ ] `packages/app/test/bottomSpace.test.ts` — FOUND-01 / FOUND-02, incl. the D-12 source guard
- [ ] `packages/app/test/layerOrder.test.tsx` — FOUND-03 structural invariant + WR-01/CR-01 + D-23 classes
- [ ] `packages/app/test/formatDate.test.ts` — FOUND-04 helper, UTC boundary + never-throw
- [ ] `packages/app/test/presenceLabels.test.ts` — NAV-03 label map + fallback
- [ ] Extend: `fabMenu.test.tsx`, `bottomOverlayInset.test.tsx`, `sheet.a11y.test.tsx`,
      `shareCard.test.tsx`, `rebrand.test.ts`, `exportImportRoundtrip.test.ts`,
      `archiveBrowser.test.tsx`, `recapView.test.tsx`, `showsList.test.tsx`
- [ ] New coverage: `ShowView` header date, `SetlistView` header date + `aria-label`
- [ ] Framework install: **none needed** — Vitest 4.1.10, jsdom 29.1.1, `@testing-library/react` 16.3.2
      all installed and green

### Genuinely un-automatable (must be carried as explicit plan tasks, not assumptions)

| # | What | Why no test can cover it |
|---|------|--------------------------|
| 1 | **FOUND-01 gap, before + after, portrait + landscape, installed** | `env(safe-area-inset-bottom)` is `0` in every automatable environment. The bug is invisible by construction outside an installed instance. |
| 2 | The `bottom-16` overlay overlap (D-09) | Same reason |
| 3 | Tab strip at the **largest Dynamic Type** setting (D-04's whole justification for `rem`) | Requires the OS text-size control |
| 4 | `SearchSheet` with the **soft keyboard up** (D-17) | jsdom has no `visualViewport` resize; fix only if it misbehaves |
| 5 | **FOUND-05** real PNG at the widest venue | Real font metrics; the mock `measureText` is linear-in-length, not real |
| 6 | **NAV-03** two devices on different builds | Real Realtime, real mixed vocabulary, silent failure mode |
| 7 | **FOUND-03** live paint order over a toast | Needs a real compositor; `?layerRepro=1` makes it a 30-second desktop check, but not an automated one |
| 8 | `SearchSheet` gesture suppression after portaling (SHOW-13) | Double-tap zoom / long-press callout are device behaviors |

**D-19 note:** if the FOUND-01 before-measurement shows flush, **the measurement is the evidence** and no
code change is required to close it. The plan must be able to end there without looking incomplete.
Given the arithmetic in §The Installed-PWA Dead Gap, a non-reproduction is unlikely — but if it happens,
it falsifies D-15 and the plan must fall back to the open investigation (D-14), so keep the diagnostic
harness task independent of the fix task.

---

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control in this phase |
|---------------|---------|--------------------------------|
| V2 Authentication | no | Untouched. Supabase auth is not in scope. |
| V3 Session Management | no | Untouched |
| V4 Access Control | no | No RLS policy, table, or SQL migration is touched |
| **V5 Input Validation** | **yes** | Two live controls: (a) `useHashRoute.ts:19-26` validates `location.hash` against a fixed allow-list and only ever *selects* a view — **NAV-02 forbids touching routes, so this is preserved by construction**; (b) `presenceActivity.ts:95-109` `reduceActivity` validates untrusted peer presence entries against the `TABS` allow-list. **NAV-03's fallback design must not weaken (b)** — see the recommendation in §Presence Label Resolution: prefer the receiver-side `null → "in the app"` render fallback over relaxing the allow-list, and if the allow-list is relaxed, the fallback must be a **constant string**, never `?? activity.tab`. |
| V6 Cryptography | no | None used or added |
| V7 Error Handling / Logging | yes (low) | Every helper stays never-throw: `formatFullDate` returns the raw string on unparseable input; an unrecognized presence token resolves to a constant; a malformed presence entry is skipped at the read boundary as it ships today |
| V12 Files / Resources | yes (low) | The `?layerRepro=1` harness is a new URL-parameter surface. Mirror `mockLatest.ts:97-100`'s inert-unless-explicit guard exactly. It must not accept arbitrary values, must not render any query-string content, and must only toggle a boolean |
| V14 Configuration | yes (low) | No new env vars, no new secrets, no manifest change, **zero new npm packages** |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status |
|---------|--------|---------------------|--------|
| Untrusted peer presence text rendered to the DOM | Tampering / Spoofing | Allow-list validation at the read boundary + escaped React text; the label is a **constant** chosen by a map, never peer-supplied | Shipped; must survive the NAV-03 change — this is the phase's one real security-relevant edit |
| DOM XSS via URL fragment | Tampering | `location.hash` allow-list, never `innerHTML`/`eval` (`useHashRoute.ts:3-7`) | Shipped; untouched by NAV-02 |
| Dev/test flag reachable in production | Elevation | Inert-unless-explicit query check, boolean-only effect | Precedent: `mockLatest.ts`. New `?layerRepro=1` must copy it |
| Formatted display data leaking into a join key | Tampering (data integrity) | D-35's display-only boundary + the `attendanceKey` regex guard | New guard needed |
| Supply-chain (new dependency) | Tampering | **Zero new packages this phase** — see below | N/A |

---

## Package Legitimacy Audit

**This phase installs no external packages.** `21-UI-SPEC.md` §Registry Safety states "Zero new npm
packages — a standing v2.1 constraint (`ROADMAP.md`: zero new domain capability, zero new runtime deps)."
Verified independently: every mechanism this phase needs (`createPortal` from `react-dom`,
`Intl.DateTimeFormat`, `ResizeObserver`, `CSSStyleDeclaration.setProperty`, Vitest's `readFileSync`
source scanning) is either a platform API or an already-installed dependency.

| Package | Registry | Disposition |
|---------|----------|-------------|
| — | — | **No packages added, removed, or upgraded.** Audit not applicable. |

**Packages removed due to slopcheck `[SLOP]`:** none — none proposed.
**Packages flagged `[SUS]`:** none — none proposed.

If the planner discovers a genuine need for a new package, that is a **scope change** requiring a
decision, not a plan detail — it contradicts a standing milestone constraint.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vitest, Vite | ✓ | (repo requires ≥ 24.12 per CLAUDE.md) | — |
| npm workspaces | Monorepo install | ✓ | Installed with **npm, not pnpm** (project memory) | — |
| Vitest | All automated validation | ✓ | 4.1.10 — **954 tests green in 7.74s** | — |
| jsdom | App test environment | ✓ | 29.1.1 | — |
| `@testing-library/react` | Render assertions | ✓ | 16.3.2 | — |
| `fake-indexeddb` | Dexie tests | ✓ | 6.2.5 | — |
| ESLint / typecheck script | Static checks | ✗ | — | **None.** No `eslint.config.*`, no `typecheck` script. Use `vite build` as the type gate |
| `canvas` npm package | Real canvas in jsdom | ✗ | — | **By design** — `shareCard.test.tsx` uses a recorded mock ctx (`shareCard.ts` header documents this). No change needed |
| Real iOS device, installed PWA | FOUND-01, FOUND-05, NAV-03, Dynamic Type, keyboard | **owner-dependent** | — | **No fallback — these are the un-automatable items.** Blocks phase closure, not implementation |
| HTTPS cloudflared tunnel (`--http-host-header localhost`) | NAV-03 two-device test, all device UAT | Documented in project memory (`device-uat-hosting`) | — | — |
| Two devices + two identities + two builds | NAV-03 (D-42) | owner-dependent | — | No fallback — the failure mode is silent |

**Missing with no fallback:** the device pass. Six numbered tests (`21-UI-SPEC.md` §Device Verification)
must be budgeted **inside** this phase, not deferred. Two of them (FOUND-01 before-measurement, and the
`?layerRepro=1` repro) gate the implementation work that follows them (D-30's ordering), so they are not
end-of-phase checks — they are **sequencing dependencies**.

**Missing with fallback:** ESLint/typecheck → `npm run build --workspace packages/app`.

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|--------------|------------------|--------------|-------------|
| `100vh` for full-height mobile layouts | `height: 100%` chain grounded to the ICB, or `dvh`/`svh` | iOS 15.4 shipped `dvh`/`svh`/`lvh` | **This repo deliberately uses neither** for the app shell — `h-full` off the `html/body/#root` chain, because `100vh` caused a real tap-interception bug (`AppShell.tsx:29-37`) and `dvh` has its own iOS 26 regressions. Correct call; keep it. |
| `constant(safe-area-inset-*)` | `env(safe-area-inset-*)` | iOS 11.2 renamed it | Repo already uses `env()` exclusively. `constant()` is dead and needs no fallback in 2026. |
| `env()` directly inside `calc()` | Assign `env()` to a custom property, use the property in `calc()` | Long-standing Safari workaround | **This phase adopts the current approach across all 8 sites**, as a side effect of D-01. Second independent justification for the design. |
| `vitest.workspace.ts` | `test.projects` in `vitest.config.ts` | Vitest 4 | Repo already on `test.projects` (verified, with a comment explaining why the glob form was avoided) |
| Sheets as in-tree overlays with high z-index | Portal to `document.body` | Long-standing React pattern | `Sheet.tsx` already does it; D-21 extends it to the five hand-rolled surfaces |

**Deprecated / outdated:**
- `constant(safe-area-inset-*)` — superseded by `env()`; no polyfill needed.
- `navigator.standalone` alone as an installed-mode check — iOS-only, non-standard; pair it with
  `matchMedia("(display-mode: standalone)")`.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `env(safe-area-inset-bottom)` is ~34px portrait / ~21px landscape on the owner's iPhone | The Installed-PWA Dead Gap | **Low.** The arithmetic derives *gap ≡ inset* regardless of magnitude. Only the expected numbers in `21-HUMAN-UAT.md` would change. The device pass measures the real value. |
| A2 | `element.style.setProperty("--x", "env(safe-area-inset-bottom)")` resolves correctly in Safari | Single-Owner Mechanism | **Medium.** If wrong, every composed reserve collapses on device — and looks fine in a desktop tab where `env()` is `0`. **Mitigated by recommending the CSS-authored form**, which is documented-working. If the planner takes the JS form, add an explicit device verification task. |
| A3 | `centerText` uses `textBaseline: "alphabetic"` | Share-Card Footer | **Low.** Only affects the D-37 descender-clip prediction; D-37 is already "look, fix only if it clips." Read `shareCard.ts:185-200` during planning to confirm. |
| A4 | No ancestor of `DexView`'s sheet surfaces will gain a stacking context later | The Stacking-Context Defect | **Low today, and the reason to portal all five anyway.** Portaling makes the assumption unnecessary. |
| A5 | `MapView.tsx:468`'s pin/chip strip is not tab-bar-relative | Bottom-Space Call-Site Inventory Group C | **Low.** D-08 already requires an audit with a comment either way. |
| A6 | The `sync/` presence tests cover the `atShow`/`offline` precedence and can simply be extended | Validation Architecture | **Low.** `packages/app/test/sync/` exists; the planner should list its contents before assuming coverage. |
| A7 | iOS 26.x safe-area regressions (26.1 top-inset-in-landscape, fixed 26.2b3) do not affect the **bottom** inset | The Installed-PWA Dead Gap | **Medium.** Reported regressions were about `safe-area-inset-top`. If the owner's device is on an affected iOS 26.x, record the OS version in `21-HUMAN-UAT.md` (D-18 already requires it) so an anomalous landscape reading is attributable. |

---

## Open Questions

1. **Which NAV-03 fallback placement?**
   - Known: resolution is receiver-side; `reduceActivity` currently drops unknown tokens → `null` →
     `PresenceActivitySlot` renders nothing.
   - Unclear: whether the plan relaxes the allow-list (option i) or adds an online-but-null render
     fallback (option ii).
   - Recommendation: **option (ii)** — smaller diff, does not weaken a real input-validation control,
     and `SelfRow.tsx:67-71` already branches on `presence.online` for this exact slot. Whichever is
     chosen must be *named* in the plan, because it is the difference between NAV-03 met and nominally met.

2. **`--gz-safe-bottom` in CSS or in JS?**
   - Known: the `:root { --x: env(...) }` CSS form is documented and widely deployed.
   - Unclear: whether the JS `setProperty` round-trip preserves `env()` in Safari (A2).
   - Recommendation: CSS-authored, guard whitelists that one `:root` block. Costs nothing, removes the
     risk. If the planner insists on the strict D-01 reading, add a device verification task.

3. **Portal all five sheet surfaces, or only `SearchSheet`?**
   - Known: only `SearchSheet` is actually captured by a stacking context today; the other four are at
     root level (verified from `DexView.tsx:99` and `ExploreView.tsx`).
   - Unclear: whether the prophylactic value justifies touching four VoiceOver-verified surfaces.
   - Recommendation: portal all five (it makes the D-24 invariant uniformly true and removes a latent
     trap), but **sequence `SearchSheet` first as its own commit** and treat the other four as a second,
     independently revertible group. If schedule pressure appears, the four are the droppable part.

4. **Is `FabMenu` portaled too?**
   - Known: D-27 includes it in the repro; it is at effective level 10 under a `toast: 20`, and it is the
     worse symptom (eats taps mid-show).
   - Unclear: CONTEXT never says whether the *fix* extends to it, only the repro.
   - Recommendation: if it reproduces, portal it. But note it is a `fixed` surface whose class-scoped
     `.fab-menu` gesture suppression (`styles.css:27-35`) must be re-applied on the portaled root — the
     same D-23 hazard as `SearchSheet`, on the surface that owns the live-logging loop. This may deserve
     its own commit and its own device check.

5. **How many device sessions does the phase need?**
   - Known: D-30 orders repro → bottom-space → portals, and D-14 wants the diagnosis **before** the fix.
   - Unclear: whether the before-measurement and after-measurement can share one session.
   - Recommendation: assume **two** device sessions (before/diagnose, and after/verify-all-six). Plan the
     first as an early gating task, not an end-of-phase check.

---

## Sources

### Primary (HIGH confidence)

- **The repository itself** — every file:line citation in this document was read in this session:
  `packages/app/index.html`, `vite.config.ts`, `src/styles.css`, `src/main.tsx`, `src/App.tsx`,
  `src/config.ts`, `src/components/{AppShell,BottomTabBar,Sheet,InstallBanner,UpdateToast,BackupToast,BingoCelebration,WaveToast}.tsx`,
  `src/show/{ShowView,FabMenu,fabLayout,SearchSheet,CometTrail,ShowBackground}.{ts,tsx}`,
  `src/dex/{DexView,ShowsList,SetlistView,ArchiveBrowser,AlbumDetail,RecapView,FriendRow,SelfRow,formatMonYear,shareCard}.{ts,tsx}`,
  `src/explore/{ExploreView,NodeSheet,ExploreFilterFab,ExploreBackground}.tsx`, `src/map/MapView.tsx`,
  `src/sync/presenceActivity.ts`, `src/pwa/bottomOverlayInset.ts`, `src/routing/useHashRoute.ts`,
  `src/live/mockLatest.ts`, `vitest.config.ts`, `packages/app/test/{setup,rebrand,configMirror,shareCard,sheet.a11y}.ts(x)`
- `node_modules/tailwindcss/preflight.css:8-16` — `box-sizing: border-box` on `*` (the load-bearing fact
  behind the gap arithmetic)
- **Executed in this session:** `npx vitest run` → 125 files / 954 tests / 7.74s, all green;
  `node -e` UTC vs local date formatting demonstration
- [MDN — Using environment variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Environment_variables/Using) — `env()` semantics
- [MDN — `env()` CSS function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
- [web.dev — PWA Detection](https://web.dev/learn/pwa/detection) — `navigator.standalone` + `display-mode` media query

### Secondary (MEDIUM confidence)

- [Apple Developer Forums 716552 — "Safari returns 0 for --safe-area-inset-bottom when the toolbar is hidden"](https://developer.apple.com/forums/thread/716552) — the 34/21 portrait/landscape table and the iOS 15+ `0`-in-a-tab behavior. Corroborates `REQUIREMENTS.md` §Verification Notes independently.
- [Ben Frain — How to get the value of `env()` in JavaScript](https://benfrain.com/how-to-get-the-value-of-phone-notches-environment-variables-env-in-javascript-from-css/) — probe-element and custom-property read-back techniques
- [Ben Frain — CSS Environment variables](https://benfrain.com/css-environment-variables-iphonex/) — the `:root { --sab: env(...) }` pattern
- [Apple Developer Forums 717296 — "env(safe-area-inset-bottom) not working in CSS"](https://developer.apple.com/forums/thread/717296) — `env()`-inside-`calc()` failure reports and the custom-property workaround
- [MUI issue 46953 — iOS 26 Drawer bottom gap](https://github.com/mui/material-ui/issues/46953) — iOS 26 viewport/safe-area interaction reports
- [Polypane — Using safe-area-inset](https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts/) — inset magnitudes

### Tertiary (LOW confidence — flagged, not relied on)

- Community reports of the exact iOS 26.1 → 26.2b3 `safe-area-inset-top` landscape regression window
  (A7). Recorded so an anomalous landscape reading is attributable; **no decision depends on it.**
- `100dvh` cold-start bug reports on iOS. Not relied on — `dvh` is forbidden by D-14 regardless.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| FOUND-01 mechanism | **HIGH** | Derived from the CSS box model plus the repo's own source; every input verified at file:line. Predicts a falsifiable equality (`body.offsetHeight − #root.offsetHeight === S`) the device readout will confirm or refute in one screenshot. |
| FOUND-01 magnitudes | MEDIUM | 34/21 are forum/community figures. The arithmetic is magnitude-independent; only the expected numbers in the UAT doc depend on them. |
| Bottom-space inventory | **HIGH** | Exhaustive grep across `packages/app/src` for all four notations; each site's resolved offset computed by hand and cross-checked against the tab bar's own geometry. Group B's byte-identical claim is arithmetic, not assertion. |
| FOUND-03 defect + blast radius | **HIGH** | Deterministic CSS painting order; container chains read directly (`ShowView.tsx:173-183`, `DexView.tsx:99`, `ExploreView.tsx:218-228`, `App.tsx:117-123`). Reproducible in a desktop browser. |
| FOUND-03 test design | MEDIUM-HIGH | The jsdom ancestor-walk is *complete for this codebase* because production has zero `z-*` utility classes — verified, but it is a property of today's code, not a permanent guarantee. The test's doc comment must say so. |
| FOUND-04/05 | **HIGH** | Hazard demonstrated numerically in this session; every call site located; the storage boundary and the mock-ctx testability both verified in shipped test code. |
| NAV-01/02 | **HIGH** | Labels read directly from `BottomTabBar.tsx:4-13`; `rebrand.test.ts` read in full as the guard precedent. |
| NAV-03 | **HIGH** on the mechanism (the full token→screen path was traced through four files), MEDIUM on the recommended fallback placement (two viable options, one open question). |
| Validation architecture | **HIGH** | Full suite executed and timed in this session; every "extend this file" claim is against a file confirmed to exist. |
| Package legitimacy | **HIGH** | Zero packages proposed; every mechanism is a platform API or an installed dep. |

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (30 days) — the codebase findings are stable while the branch is; the iOS
version-specific notes (A7) should be re-checked if the owner's device updates before the device pass.
