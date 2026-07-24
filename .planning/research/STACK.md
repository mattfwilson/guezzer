# Stack Research — v2.1 "UX/UI Polish"

**Domain:** Mobile-first offline PWA UI/motion polish (React 19 + Vite 8 + Tailwind 4, installed iOS standalone as the primary target)
**Researched:** 2026-07-24
**Confidence:** HIGH

> Scope note: The existing shipped stack (Vite 8.1.3, React 19.2.7, TS 6.0.3, Tailwind 4.3.2,
> vite-plugin-pwa 1.3.0, Dexie 4.4.4 + `dexie-react-hooks`, react-force-graph-2d 1.29.1,
> fuse.js, zod, Vitest 4.1.10, `@supabase/supabase-js` 2.110.8, npm workspaces with a pure
> `packages/core`) is **validated and out of scope — do NOT re-research or replace it.**
> This file covers ONLY what v2.1's UI/motion features need. The v2.0 stack research it
> replaces is archived under `.planning/milestones/v2.0-*`.

---

## Headline: add nothing

**Recommendation: ZERO new runtime dependencies for v2.1.** Every one of the six feature
areas is covered by something already installed, already used in this codebase, and already
device-verified on the iPhone 16 Pro. Net bundle delta: **0 bytes**.

The premise that `motion` is "already a dependency but currently barely used" is
**understated** — verified by reading the source, `motion/react` is already imported and
load-bearing in four shipped modules:

| File | What it uses |
|------|--------------|
| `packages/app/src/components/WaveToast.tsx` | `AnimatePresence`, `motion.div`, `useReducedMotion` |
| `packages/app/src/components/BingoCelebration.tsx` | `AnimatePresence`, `motion`, `useReducedMotion` |
| `packages/app/src/show/OrbitStage.tsx` | `motion`, `useReducedMotion` |
| `packages/app/src/show/ShowView.tsx` | `useReducedMotion` |

So `motion`'s ~34 kB is **already in the shipped bundle and already paid for**. Every new
`motion` usage in v2.1 costs literally nothing incremental. That single fact resolves most
of the "library vs. native CSS" tension: the question is no longer "is it worth the bytes"
but "which tool produces the better result per use case" — and the answer differs per case
(see the verdict table below).

The one genuinely *new* thing v2.1 needs is **not a library** — it is a shared
chrome-visibility store, a one-line CSS deletion, and a z-tier invariant test.

---

## Recommended Stack

### Core Technologies (all already installed — v2.1 roles)

| Technology | Version | Purpose in v2.1 | Why Recommended |
|------------|---------|-----------------|-----------------|
| `motion` | **12.42.2** (pin — see Installation) | Sheet enter/exit, full-screen overlay enter/exit, reaction fly-up | Already the codebase's animation idiom (4 shipped files). `AnimatePresence` is the only clean way to run an **exit** animation on a component whose contract is `if (!open) return null` + `createPortal`. `useReducedMotion()` is already the app-wide reduced-motion gate. Marginal cost: 0 bytes. **Verified 12.42.2 is the current npm `latest`** (published 2026-06-30) — already newest. |
| CSS transitions (Tailwind 4.3.2 + `styles.css`) | — | Chrome hide/show (top bar + bottom tabs) | For a two-state, always-mounted, interruptible toggle on a canvas-heavy screen, a composited `transform`/`opacity` transition beats a JS-driven animation: interruption-from-current-value is free, the compositor does the work, and the GizzVerse main thread stays available for `react-force-graph-2d`. The codebase already has the `@media (prefers-reduced-motion: no-preference)` idiom in `styles.css` (6 existing blocks). |
| Existing `<Sheet>` primitive | in-repo | Full-screen bingo deal + bingo board overlays; animated bottom sheets | `variant="fullscreen"` already exists and already delivers portal-to-body + `useFocusTrap` + `useDialogDismiss` + LIFO `dialogStack` + ref-counted `inertRoot`, VoiceOver-verified in Phase 8 (A11Y-01). A second overlay primitive would fork a11y behaviour that was expensively validated. |
| `config.ui.z` tier scale | in-repo | Z-layer guarantee | Already the single source of truth. The v2.1 fix is a **test**, not a dependency (see §Z-layer). |
| `lucide-react` | 1.23.0 (installed) | Bingo deal-type icons (Chill / Balanced / Glory-hunter) | **Verified against the installed `dist/lucide-react.d.ts`**: `Leaf`, `Coffee`, `Scale`, `Flame`, `Trophy`, `Crown`, `Sparkles`, `Skull`, `Zap`, `Maximize`, `Maximize2`, `Minimize`, `Minimize2`, `Expand`, `Shrink` all exist in 1.23.0. Per-icon tree-shaken. No upgrade needed (latest is 1.26.0). |
| `Intl.DateTimeFormat` (ECMA-402, platform) | — | The shared "Mon D, YYYY" helper | No library. The repo **already has the exact idiom** at `packages/app/src/dex/formatMonYear.ts` (module-level memoized formatter, `"en-US"`, `timeZone: "UTC"`). v2.1 extends it rather than reinventing it. |
| `useSyncExternalStore` (React 19) | 19.2.7 | The shared chrome-hidden store | Mirrors the shipped `usePresence` / `progressSync` singleton-engine + pure-reader pattern (D-16). No state library. |

### Supporting Libraries

**None.** This section is intentionally empty. Nothing in the v2.1 backlog requires a
capability that isn't already installed.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 4.1.10 (already) | Z-tier ordering invariant test; date-helper fixtures; chrome-store transitions | jsdom **cannot** verify CSS transitions or `env()` resolution — those are device-UAT items, not unit-test items. Test the *state machine* and the *config invariants*; UAT the motion. |
| A `#/dev/insets` diagnostic route | Measure the real iOS standalone bottom gap before/after the fix | Follows the shipped `#/dev/orb-fit` precedent (Phase 8). Print resolved `env(safe-area-inset-*)`, `window.innerHeight`, `visualViewport.height`, `document.documentElement.clientHeight`, `navigator.standalone`. Zero deps; dev-gated or deleted after the fix. |
| cloudflared HTTPS tunnel (existing runbook) | Device UAT | Already the established device-UAT hosting path for this repo. |

## Installation

```bash
# Core: nothing to install.

# Supporting: nothing to install.

# Dev dependencies: nothing to install.

# ONE recommended housekeeping change (not an addition):
#   packages/app/package.json — pin motion exactly, matching every other runtime dep.
#   "motion": "^12.42.2"   ->   "motion": "12.42.2"
```

**Why the pin matters now:** `motion` is the only runtime dependency in
`packages/app/package.json` carrying a `^` range (`dexie`, `react`, `react-dom`,
`react-force-graph-2d`, `@supabase/supabase-js`, `lucide-react` are all pinned exact). v2.1
promotes `motion` from "used in 4 places" to "load-bearing for four user-visible features
shipped weeks before live shows." A silent minor bump during a pre-show `npm install` is
exactly the class of surprise this project's constraints exist to prevent.

---

## Per-Use-Case Verdict: `motion` vs. CSS vs. Native Platform

This is the central question. **There is no blanket answer** — here is the per-case call.

| # | Use case | Verdict | Why |
|---|----------|---------|-----|
| 1 | **Bottom-sheet up/down + scrim cross-fade** | **`motion` (`AnimatePresence`)** | The *exit* animation is the hard part. `<Sheet>`'s contract is `if (!open) return null` inside a `createPortal`. A pure-CSS exit requires the node to stay mounted and toggle `display` via `@starting-style` + `transition-behavior: allow-discrete` — which *is* supported (Safari 17.4/17.5, Baseline 2024) but forces the portal, focus trap, and `inert` refcount to stay mounted while closed, breaking the V7/T-08-04 "closed sheet renders nothing, never throws" invariant. `AnimatePresence` defers *only the visual subtree's* unmount while the a11y hooks stay keyed on `open`. Already installed. |
| 2 | **Full-screen bingo overlays (deal screen + board)** | **Existing `<Sheet variant="fullscreen">` + the same `AnimatePresence` as #1** | Not a new primitive, not a new library. Inherits focus trap, Escape, LIFO stack, `inert`, and the `z.sheet` tier for free. |
| 3 | **Chrome hide/show (top bar + bottom tabs)** | **CSS transitions — NOT `motion`** | Both bars stay mounted (they must be re-showable and layout-stable). It's a two-state interruptible toggle, which CSS transitions handle from the current computed value with zero code. Critically, the debut surface is **GizzVerse**, where `react-force-graph-2d` owns the main thread — a composited `transform: translateY()` costs ~0 main-thread work; a `motion` spring drives a per-frame JS loop on exactly the screen that can least afford it. `motion` buys nothing here. |
| 4 | **Reaction fly-up (emoji + name)** | **`motion` (`AnimatePresence`, concurrent instances)** | Multiple simultaneous ephemeral elements with randomized trajectories and unmount-after-exit. `AnimatePresence` + per-instance `initial`/`animate`/`exit` is the direct expression, and `WaveToast.tsx` — the file being replaced — is already exactly this shape. **Honest caveat:** pure CSS `@keyframes` + `onAnimationEnd` cleanup is a fully legitimate 0-JS alternative here and would be the pick if `motion` weren't already installed. Since it is, consistency with the existing host idiom wins. |
| 5 | **Scrim cross-fade specifically** | **`motion` (same element tree as #1)** | Splitting the scrim onto CSS while the card is on `motion` invites desync. Animate both inside one `AnimatePresence`. |

### Explicit "native platform" verdicts

| Native feature | Verdict for v2.1 | Reason |
|----------------|------------------|--------|
| **View Transitions API** | **No** | Supported (Safari/iOS **18.0**, cross-doc **18.2**) so availability isn't the blocker — *fit* is. VT is for discrete, non-interruptible state swaps; chrome-hide must be interruptible mid-flight and the sheet needs an interruptible bidirectional transition. VT also snapshots the page, which is hostile to a live `<canvas>` (GizzVerse) and to `position: fixed` overlays. Nothing in v2.1's scope is a route change. |
| **Popover API** | **No** | `<Sheet>` already delivers strictly more (focus trap + LIFO + `inert` + focus restore), device-verified with VoiceOver. Popover's light-dismiss + top-layer would *duplicate*, not replace it, and iOS Safari support only landed at **18.3** (desktop Safari 17). Migrating a validated a11y primitive for zero user-visible gain is pure risk before a show. |
| **`<dialog>` + `showModal()`** | **No** (same reasoning) | Widely available since Safari 15.4, but `<Sheet>` already solved this and iOS `<dialog>` still has scroll-locking and backdrop-styling rough edges. Not worth relitigating a shipped, UAT-passed primitive. |
| **`@starting-style` + `transition-behavior: allow-discrete`** | **No, but keep in the back pocket** | Genuinely available (Safari **17.4** / **17.5**, Baseline 2024). It's the right tool *if* `<Sheet>` is ever refactored to stay mounted while closed. Loses today only on that contract conflict. |
| **CSS anchor positioning** | **No** | Shipped in Safari 26.0, but web-features Baseline is still `limited` (partial across engines) — and the reaction anchor doesn't need it: the sender is on **another device**, so there is no local DOM element to anchor to. Anchor to the tab index arithmetically (`(tabIndex + 0.5) / TABS.length` of viewport width) — deterministic, testable, dep-free. |
| **`interpolate-size` / `calc-size()`** | **Not available** | Chrome/Edge 129+ only. **No Safari, no Firefox** implementation as of mid-2026 (verified: webstatus.dev lists Chromium implementations only; Baseline `limited`). Do not plan any auto-height animation on it. |
| **Scroll-driven animations** | **Available, but not needed** | Shipped Safari **26.0** (2025-09-15), Chrome 115+. Baseline still `limited`. Nothing in v2.1 is scroll-progress-driven. Note Safari 26.5 shipped several scroll-driven-animation bug fixes — a signal the implementation is still settling. Don't be first to lean on it before a live show. |
| **Fullscreen API / `screenfull`** | **Impossible on the target device** | **Verified via webstatus.dev: `safari_ios` has NO implementation entry for the Fullscreen API** (desktop Safari 16.4 only). `Element.requestFullscreen` does not work on iPhone. Additionally, in an *installed standalone* PWA there is no browser chrome left to hide. Backlog item #9's "fullscreen toggle" is therefore **necessarily** an in-app chrome-hide, not a platform fullscreen call. This is the single most important native-API finding in this research. |

---

## Web Platform Support Matrix (verified)

All rows verified 2026-07-24 against the **webstatus.dev API** (`api.webstatus.dev/v1/features/*`),
which sources MDN browser-compat-data. Confidence: **HIGH**.

| Feature | Safari / iOS Safari | Chrome / Android | Baseline status | Usable on iOS 26.x? |
|---------|---------------------|------------------|-----------------|---------------------|
| `env(safe-area-inset-*)` | **11.3** (2018-03) | 69 | widely (2022-07) | ✅ |
| Small/large/dynamic viewport units (`svh`/`lvh`/`dvh`) | **15.4** (2022-03) | 108 | widely (2025-06) | ✅ |
| `<dialog>` | **15.4** | 37 | widely | ✅ |
| `inert` | **15.5** | 102 | widely | ✅ (already used) |
| `transition-behavior: allow-discrete` | **17.4** (2024-03) | 117 | newly (2024-08) | ✅ |
| `@starting-style` | **17.5** (2024-05) | 117 | newly (2024-08) | ✅ |
| Popover API | desktop 17.0 / **iOS 18.3** (2025-01) | 116 | newly (2025-01) | ✅ |
| View Transitions (same-document) | **18.0** (2024-09) | 111 | newly (2025-10) | ✅ |
| Cross-document view transitions | **18.2** (2024-12) | 126 | limited | ✅ (not needed) |
| Scroll-driven animations | **26.0** (2025-09) | 115 | limited | ✅ (not needed) |
| CSS anchor positioning | 26.0 (WebKit blog) | 125 | **limited** | ⚠️ partial — avoid |
| `interpolate-size` / `calc-size()` | **none** | 129 | limited | ❌ |
| Viewport meta `interactive-widget` | **none** | Chrome 108 / FF 132 | n/a | ❌ |
| Fullscreen API | **iPhone: none** (desktop 16.4) | 71 | limited | ❌ |

---

## The iOS Installed-Standalone Bottom Gap — Diagnosis and Fix

**Verdict: this is a CSS bug in this repo, not a platform quirk. One-line fix, zero deps.**

### Root cause (structural analysis of the current source — HIGH confidence)

Three facts combine:

1. `packages/app/src/styles.css` sets `html, body, #root { height: 100% }` **and**
   `body { padding-bottom: env(safe-area-inset-bottom) }`.
2. Tailwind 4 preflight applies `box-sizing: border-box` globally, so `body`'s
   `height: 100%` is a **border-box** height — the 34 px bottom padding is subtracted from
   the *content* box. Therefore `#root` (and `AppShell`'s `h-full` column) is
   **`viewportHeight − 34px`** tall.
3. `BottomTabBar` is `position: fixed; bottom: 0` — **fixed positioning ignores body
   padding** — so the bar correctly occupies the true bottom `calc(4rem + 34px)` of the
   viewport, with its own internal `padding-bottom: env(safe-area-inset-bottom)`.

Meanwhile `AppShell`'s `<main>` reserves `calc(4rem + env(safe-area-inset-bottom))` of
bottom padding for that bar. Net result:

```
content bottom edge = (viewportH − 34) − (64 + 34)  = viewportH − 132
tab bar top edge    =  viewportH − (64 + 34)        = viewportH −  98
                                                      ──────────────
                                        DEAD GAP    =           34 px
```

The 34 px is `env(safe-area-inset-bottom)` applied **twice** — once by `body`, once by the
tab bar / `<main>` reservation. In a browser tab `env(safe-area-inset-bottom)` is `0`, so
the gap vanishes; in the **installed standalone PWA** it is 34 px on a home-indicator
iPhone. That precisely matches the reported symptom ("gap only in the installed PWA").

**This is the exact mirror image of the already-shipped UX-01 fix.** Phase 13 deleted the
body-level `padding-top` for the same double-application reason and documented it at
`styles.css:217-219` — but left `padding-bottom` in place. v2.1 finishes that job.

### The fix

```css
/* packages/app/src/styles.css — body { } */
- padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
```

Safe because **every** bottom-anchored surface already self-applies the inset (verified by
grep): `BottomTabBar`, `Sheet` (bottom-sheet variant), `NodeSheet`, `CometTrail`,
`BackupToast`, `UpdateToast`, `InstallBanner`, `ExploreFilterFab`, `FabMenu`, and
`show/fabLayout.ts`. Extend the existing `styles.css` comment to cover both axes so the
next person doesn't re-add it.

### What NOT to change while fixing this

| Don't | Why |
|-------|-----|
| Remove `viewport-fit=cover` | Without it **every** `env(safe-area-inset-*)` resolves to `0px` and iOS letterboxes the app. It is correctly present in `packages/app/index.html`. |
| Swap `height: 100%` → `100dvh` | In installed standalone there is no dynamic browser toolbar, so `dvh == svh == lvh == screen height` — `dvh` buys **nothing** here and reintroduces the browser-tab variance the `html/body/#root { height:100% }` chain was deliberately chosen to avoid. `AppShell.tsx:29-37` documents a real shipped bug caused by `100vh`; don't reopen it. |
| Add `interactive-widget=resizes-content` | Chrome/Firefox only — **Safari ignores it entirely** (verified). It would be dead config. If keyboard overlap ever becomes a problem on the search sheet, the iOS answer is `window.visualViewport`, not a meta tag. |
| Assume without measuring | iOS 26's "liquid glass" chrome caused a real WebKit viewport regression (bug 301108, `viewport-fit=cover` / `height=device-height`), reported partially fixed by Jan 2026. The structural double-inset above explains the standalone-only symptom cleanly, but **measure on the actual iPhone 16 Pro / iOS 26.x, installed, before and after** via the `#/dev/insets` route. |

**Confidence:** HIGH on the structural mechanism (read directly from source). MEDIUM on
"this is the *only* contributor to the gap the owner observed" — an on-device measurement
is a required gate, not optional.

---

## Date Formatting: no library, and pin the locale

**Verdict: `Intl.DateTimeFormat` is more than sufficient. Adding `date-fns`/`dayjs`/`luxon`
would be strictly worse.**

The repo already ships the correct pattern at `packages/app/src/dex/formatMonYear.ts`:
a module-level memoized `new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric",
timeZone: "UTC" })`. v2.1 adds a `day: "numeric"` sibling and consolidates.

### Two non-obvious correctness requirements

1. **The locale MUST be the literal `"en-US"`, never `undefined`.** With `undefined` the
   runtime uses the *device* locale: an `en-GB` friend's phone renders `24 Jul 2026` — the
   "Mon D, YYYY" requirement silently fails on someone else's device. This is a real bug
   class in a multi-user friend-group app; the existing `formatMonYear` already gets it right.
2. **`timeZone: "UTC"` is mandatory** — corpus dates are date-only `YYYY-MM-DD` strings,
   which `new Date()` parses as UTC midnight. Without the UTC formatter, every user west of
   Greenwich sees the previous day. Again, `formatMonYear` already documents this.

### Where it should live — and a stronger option

`Intl` is **ECMA-402, part of the JS language runtime, not a DOM API** — it is available in
Node and passes `packages/core/test/purity.test.ts`. So the helper *can* live in
`packages/core` and be reused by the CLI reports (`backtest`, `bingo-calibrate`).

**Preferred implementation — pure string formatting, no `Date`, no `Intl`:**

```ts
// packages/core/src/format/showDate.ts   (DOM-free, CLI-safe, purity-test-safe)
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "2026-08-14" -> "Aug 14, 2026". Returns the input unchanged if unparseable. */
export function formatShowDate(iso: string): string { /* split on "-", index MONTHS */ }
```

Rationale: the inputs are already canonical `YYYY-MM-DD` strings. Skipping `Date` and `Intl`
entirely removes *all* timezone surface, *all* ICU-version variance (ICU has historically
changed separators between releases), and makes the helper trivially fixture-testable with
byte-exact expectations — this project's established standard. It is ~6 lines.

Use `Intl` instead only if a format needing real locale/calendar logic appears (none does in
v2.1). Either way: **zero new dependencies**, and migrate `formatMonYear` alongside the new
helper so there is one date module rather than two.

---

## Integration Points Against Existing Primitives

### `<Sheet>` (`packages/app/src/components/Sheet.tsx`)

- The a11y hooks (`useFocusTrap`, `useDialogDismiss`) already run **before** the
  `if (!open) return null` guard and are keyed on `open`. Restructure so
  `<AnimatePresence>{open && …}</AnimatePresence>` lives **inside** the `createPortal` while
  the hooks stay keyed on `open`. Result: focus restore, `dialogStack` pop, and `inertRoot`
  decrement all fire at close-**start** (correct), while only the pixels linger for the exit.
- **Escape must not be captured during the exit.** Because `useDialogDismiss(open, …)` is
  already `open`-keyed this is free — but assert it in a test, because it is exactly the
  thing an `AnimatePresence` refactor tends to break.
- The exiting scrim must be `pointer-events: none` so a fast re-tap during exit isn't eaten.
- Keep the exit short (~180–220 ms). A long exit reads as lag when the user reopens
  immediately, which is the venue behaviour pattern.
- `variant="fullscreen"` is the vehicle for backlog items #1/#2/#3 (bingo deal + board
  overlays). It portals to body at `z.sheet` (50) — **above** the FAB (30) and the peek strip
  (12), which is exactly what "overlay on top of tracking, dismiss back to tracking"
  requires. No new tier needed.
- **Android hardware back:** a full-screen overlay that the back button exits the *app* from
  is a bad venue experience. A `history.pushState` trap is the dep-free answer, but it must
  not corrupt the existing hash route. Flag as a design decision for planning, not a stack
  decision.

### `config.ui.z` — the "nothing paints over an open sheet" guarantee

Current tiers (`config.ts:251-297`): `content 10 < peek 12 < page 15 < celebration 18 <
toast 20 < fabScrim 25 < fab 30 < sheetScrim 40 < sheet 50`, plus the sanctioned
`focusedFab 60` exception (D-03).

**Finding: the numbers are already almost correct.** `toast` (20) and `fab` (30) are already
below `sheetScrim` (40). The only tier that can paint over an open sheet is the deliberate
`focusedFab: 60`. So the v2.1 work is *not* renumbering — it is:

1. An **ordering invariant test** (`config.z.test.ts`) asserting the full chain and
   documenting `focusedFab` as the single sanctioned exception with its D-03 rationale. This
   converts a comment-enforced rule into a build-enforced one. Zero deps.
2. A `dialogStack`-derived **`useAnyDialogOpen()`** reader that suppresses/parks the transient
   bottom overlays (`InstallBanner`, `UpdateToast`, `BackupToast`, the new reaction fly-ups)
   and the FAB while a modal sheet is open. The real defect today isn't paint order — it's
   that `useBottomOverlayHeightRegistration` shifts layout *underneath* an open sheet, and a
   50%-opacity scrim leaves a toast visibly showing through. `dialogStack.ts` already tracks
   the LIFO stack; expose a subscribe + `useSyncExternalStore` reader, matching the shipped
   singleton-engine idiom.
3. **One tier for the reaction fly-ups.** They are decorative and `pointer-events-none` and
   must sit **strictly below `sheetScrim` (40)**. Either reuse `celebration` (18) or add
   `reaction: 19` between `celebration` and `toast`. Add it to the invariant test.

### Chrome-hidden mechanism (backlog #4 + #9 — one mechanism)

- **State:** a module-level store + `useSyncExternalStore` reader, or a small React context.
  Mirrors `usePresence` / `progressSync`. **Not** zustand, **not** Redux.
- **Two independent inputs, one output:** an explicit user toggle (GizzVerse) and an automatic
  condition (a show is being tracked). Model as a set of named "hide requests" with a derived
  boolean, so the automatic in-show hide doesn't fight the user's manual toggle.
- **Animate `transform`/`opacity` on the bars only.** Do **not** transition `<main>`'s
  `padding-bottom` or the flex column's height.
  **Why this is load-bearing:** `ConstellationCanvas.tsx` measures its container with a
  `ResizeObserver` and feeds width/height into `ForceGraph2D`. A transitioned padding fires
  that observer ~60 times across a 300 ms animation, re-rendering the canvas each frame and
  risking simulation reheats. Instead: translate the bars (composited, zero observer traffic)
  and flip `<main>`'s reserved padding in **one discrete step** — immediately on hide, on
  `transitionend` when revealing. Exactly one `ResizeObserver` callback. The shipped UX-04
  `firstSettleRef` guard already prevents that one resize from stealing the user's camera.
- **Hidden chrome must leave the a11y tree.** Apply `inert` (Safari 15.5+, already used via
  `inertRoot`) or `visibility: hidden` at `transitionend`, so a translated-off tab bar is not
  reachable by VoiceOver or Tab.
- **Reduced motion:** a `@media (prefers-reduced-motion: reduce) { transition-duration: 0s }`
  block in `styles.css`, matching the six existing reduced-motion blocks. Instant swap, same
  end state.
- **Escape / exit affordance:** chrome-hidden is **not** a dialog — do **not** push it onto
  `dialogStack`, or it will swallow Escape from a sheet opened on top of it. Give it its own
  key handler and a persistent floating exit control at `config.ui.z.fab`.

### Reaction fly-up (backlog #6)

- **The sender is on another device**, so there is no local element to measure. The anchor
  comes from presence's existing coarse tab-level activity → map tab → x position. Compute it
  as `(tabIndex + 0.5) / TABS.length` of viewport width — deterministic and unit-testable.
  This is why CSS anchor positioning is irrelevant here.
- **Cross-feature seam to resolve in planning:** when chrome is hidden (in-show, backlog #4)
  there is no tab bar to fly up from. Define the fallback (bottom-centre) explicitly — this is
  a genuine interaction between two v2.1 features that will otherwise be discovered on a
  device at a show.
- Keep the security posture from `WaveToast.tsx` verbatim: sender name re-resolved from the
  trusted `getSyncState().friends` store, **never** read off the payload; all text as escaped
  React text.
- Change the FIFO drain to **concurrent-with-cap** (overlapping reactions are the whole point),
  but keep a hard simultaneous cap in `config.presence` — the existing `QUEUE_CAP` over-cap
  DROP discipline still applies. `pointer-events-none` throughout.
- Reduced-motion path: static fade in/out at the anchor, no translate — the established
  `useReducedMotion() ?? false` gate from `BingoCelebration`/`WaveToast`.

### Core purity

Nothing in v2.1 touches `packages/core` **except** the optional `formatShowDate` helper,
which is a pure string function with no DOM, no `Intl`, no imports — it passes
`packages/core/test/purity.test.ts` by construction. All motion, CSS, and chrome-state code
lives in `packages/app`. No new fences needed.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `motion` for sheet enter/exit | `@starting-style` + `transition-behavior: allow-discrete` (native, 0 kB) | If `<Sheet>` is ever refactored to stay mounted while closed. Genuinely available (Safari 17.4/17.5). Loses today only on the `if (!open) return null` contract conflict. |
| `motion` for the reaction fly-up | CSS `@keyframes` + `onAnimationEnd` cleanup | If you want the reaction layer to run with zero JS animation work during a show. Perfectly viable; loses only on codebase consistency since `motion` is already there. |
| Full `motion` bundle (~34 kB) | `LazyMotion` + `domAnimation` + `m` (~6 kB initial, per motion's own docs) | If bundle size ever becomes the binding constraint. Requires converting all `motion.*` → `m.*` across the 4 existing files plus the new ones. The app uses **no** layout animations, so `domAnimation` would suffice. **Not recommended for v2.1** — a cross-cutting refactor of shipped, device-verified code for a saving nobody has asked for, weeks before a show. |
| Existing `<Sheet variant="fullscreen">` | Popover API / `<dialog>` top-layer | If a future surface needs true top-layer stacking above `z.focusedFab` without config coordination. Not v2.1. |
| Pure-string `formatShowDate` | `Intl.DateTimeFormat("en-US", …)` memoized (the `formatMonYear` idiom) | If a format needing real locale or calendar logic appears. Both are zero-dependency; pick one and use it everywhere. |
| `useSyncExternalStore` chrome store | React context + provider | If the chrome state only ever needs to be read inside one subtree. The external store matches the shipped `usePresence`/`progressSync` idiom and works from `App.tsx`-level hosts, so it's the better fit here. |
| Keep `lucide-react` 1.23.0 | Upgrade to 1.26.0 | Only if a specific icon you want doesn't exist in 1.23.0. All plausible deal-type icons were verified present. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `vaul`, `react-modal-sheet`, `react-spring-bottom-sheet` | Would fork the Phase-8 A11Y-01 `<Sheet>` primitive that was VoiceOver + external-keyboard verified on iOS. Each ships its own focus/scroll-lock model that would conflict with `dialogStack` / `inertRoot`. | Existing `<Sheet>` + `AnimatePresence` |
| `@radix-ui/react-dialog`, `react-aria-components`, `@headlessui/react` | Same reason, plus tens of kB for a11y this repo already implements and has UAT'd. | Existing `<Sheet>` |
| `framer-motion` as a direct dependency | **Verified: `motion@12.42.2` already depends on `framer-motion@^12.42.2`** (both resolve to 12.42.2 in the lockfile). Adding it directly invites two copies of the animation engine and version skew. | Import from `motion/react` only |
| `react-spring`, `gsap`, `anime.js`, `lottie-react` | A second animation engine alongside `motion`. Pure bundle duplication in an offline-first PWA. | `motion` (installed) or CSS |
| `screenfull` / `Element.requestFullscreen()` | **The Fullscreen API does not exist on iPhone Safari** (verified: no `safari_ios` implementation), and an installed standalone PWA has no chrome to hide. It cannot deliver backlog item #9. | The in-app chrome-hidden mechanism |
| `react-hot-toast`, `sonner`, `notistack` | The app already has four purpose-built, layout-aware toast hosts wired into `useBottomOverlayHeightRegistration` and the z-tier scale. A generic toast lib knows nothing about the "never cover the live logging loop" rule (D-17). | Existing hosts |
| `date-fns`, `dayjs`, `luxon`, `moment`, `@js-temporal/polyfill` | 6–70 kB to format one date string that `Intl` (or 6 lines of string code) already handles, with UTC and locale correctness already solved in `formatMonYear.ts`. | `formatShowDate` in `packages/core` |
| `react-router`, TanStack Router, `wouter` | Already an explicit project-level "what NOT to use". The v2.1 overlays are deliberately **overlays, not routes** — routing them would reintroduce the tab-jump this milestone exists to eliminate. | Hash routing + `<Sheet>` overlays |
| `zustand`, Redux, Jotai, Valtio for chrome state | One boolean derived from two inputs. `useSyncExternalStore` + a module store matches the shipped D-16 singleton pattern. | Module store + `useSyncExternalStore` |
| `body-scroll-lock`, `react-remove-scroll` | `inertRoot` + the existing overflow handling already cover this; these libraries are notorious for iOS-specific regressions. | Existing `inertRoot` |
| `react-use-measure`, `usehooks-ts`, `@react-hook/*` | The codebase already hand-rolls `ResizeObserver` measurement in `ConstellationCanvas` and `OrbitStage` with documented iOS-specific behaviour. | Existing patterns |
| `interpolate-size` / `calc-size()` for auto-height animation | **No Safari implementation.** Would silently do nothing on the primary device. | Fixed/measured heights, or `motion`'s height animation |
| Viewport meta `interactive-widget=resizes-content` | **Safari ignores it entirely** (Chrome/Firefox only). Dead config. | `window.visualViewport` if keyboard overlap ever surfaces |
| `100vh` / `min-h-screen` anywhere | Already caused a shipped bug (documented in `AppShell.tsx:29-37`) — on mobile Safari `100vh` is the *large* viewport. | The `html/body/#root { height: 100% }` chain (or `dvh` where genuinely needed, as `SignInScreen` does) |
| Upgrading Vite 8.1.3→8.1.5, Tailwind 4.3.2→4.3.3, lucide 1.23→1.26 during v2.1 | Toolchain churn with zero user-visible benefit, weeks before live shows. Nothing in v2.1 needs any of these. | Stay pinned; revisit after the residency |

---

## Stack Patterns by Variant

**If the on-device measurement shows the bottom gap persists after removing `body { padding-bottom }`:**
- Suspect the iOS 26 `viewport-fit=cover` regression (WebKit bug 301108) rather than app CSS.
- Capture `visualViewport.height` vs `documentElement.clientHeight` vs `innerHeight` on the
  `#/dev/insets` route and compare installed vs. Safari-tab.
- Fallback pattern: publish the measured inset as a CSS custom property from JS
  (`--app-safe-bottom`) once at boot and on `visualViewport` resize, then consume that
  variable instead of `env()` directly. Zero deps — but only adopt it if `env()` is *proven*
  wrong on-device; a JS-driven inset is strictly worse than the CSS one when the CSS works.

**If the reaction fly-up measurably drops frames on the constellation:**
- Move the reaction layer to CSS `@keyframes` + `onAnimationEnd` (0 JS per frame) and keep
  `motion` only for sheets/overlays, which never animate concurrently with the canvas.
- Or hard-cap concurrency to 3 and drop over-cap emits (the existing `QUEUE_CAP` discipline).

**If bundle size becomes a real constraint later:**
- `LazyMotion` + `domAnimation` + `m` across all `motion` call sites. The app uses no layout
  animations, so `domAnimation` is sufficient. Deferred, not recommended for v2.1.

**If a chrome-hidden section is later added that needs the top bar hidden but tabs visible (or vice versa):**
- Design the store from day one as `{ hideTopBar, hideTabs }` derived from named hide-requests,
  not a single `immersive: boolean`. The backlog explicitly asks for modularity ("the same
  capability will be reused in other sections") — getting the shape right now is free; getting
  it wrong means a rewrite the second time it's used.

---

## Version Compatibility

All rows verified 2026-07-24 via `npm view` against the live registry and against
`package-lock.json`. Confidence: **HIGH**.

| Package | Installed (lockfile) | npm `latest` | Compatible with | Notes |
|---------|----------------------|--------------|-----------------|-------|
| `motion` | 12.42.2 | **12.42.2** (2026-06-30) | react `^18 \|\| ^19`, react-dom `^18 \|\| ^19` | Already current. Peer-verified against React 19.2.7. Depends on `framer-motion@^12.42.2` + `tslib`. Unpacked 682 kB; **~34 kB in-bundle** per motion's docs. Recommend pinning `12.42.2` exact. |
| `framer-motion` | 12.42.2 (transitive) | 12.42.2 | — | Present only as `motion`'s dependency. Do **not** add directly. |
| `react` / `react-dom` | 19.2.7 | — | `motion` 12.x ✅ | Unchanged. |
| `lucide-react` | 1.23.0 | 1.26.0 (2026-07-23) | React 19 ✅ | All candidate deal-type icons verified present in the **installed** 1.23.0 `.d.ts`. No upgrade required. |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.2 | 4.3.3 (2026-07-16) | Vite 8 ✅ | Preflight's global `box-sizing: border-box` is load-bearing in the bottom-gap diagnosis. No upgrade needed. |
| `vite` | 8.1.3 | 8.1.5 (2026-07-22) | vitest 4.1.10, vite-plugin-pwa 1.3.0 ✅ | No upgrade needed for v2.1. |
| `react-force-graph-2d` | 1.29.1 | 1.29.1 (2026-02-04) | React 19 ✅ | Untouched by v2.1 except that chrome-hide resizes its container — see the discrete-resize pattern above. |
| `dexie` / `dexie-react-hooks` | 4.4.4 / 4.4.0 | 4.4.4 (2026-06-16) | ✅ | Untouched by v2.1. |
| Vitest | 4.1.10 | — | ✅ | New tests: z-tier invariants, date fixtures, chrome-store transitions. CSS transitions and `env()` are **not** jsdom-testable → device UAT. |

**Unverifiable / flagged:**
- The `~34 kB` (full) and `~6 kB` (LazyMotion) figures are **motion's own published numbers**
  fetched via Context7, not independently measured against this bundle. Measure with
  `vite build` output if the number ever matters. — MEDIUM confidence.
- CSS anchor positioning shipping in Safari 26.0 comes from the WebKit blog; webstatus.dev
  still reports the feature group as Baseline `limited` with no per-browser implementation
  entry, implying partial coverage. Since the recommendation is *don't use it*, the ambiguity
  is not load-bearing. — MEDIUM confidence.
- The claim that the double-applied `env(safe-area-inset-bottom)` is the **whole** cause of
  the observed gap is a structural deduction from source, not a device measurement.
  — HIGH on the mechanism, MEDIUM on completeness. On-device gate required.

---

## Sources

- **npm registry** (`npm view`, 2026-07-24) — `motion` 12.42.2 latest + peerDependencies +
  dependencies + unpackedSize; `lucide-react` 1.26.0; `tailwindcss` 4.3.3; `vite` 8.1.5;
  `dexie` 4.4.4; `react-force-graph-2d` 1.29.1 — **HIGH**
- **`package-lock.json`** (read directly) — installed resolutions incl. the transitive
  `framer-motion` 12.42.2 — **HIGH**
- **`api.webstatus.dev/v1/features/*`** (MDN browser-compat-data) — per-browser version and
  date for `view-transitions`, `cross-document-view-transitions`, `starting-style`,
  `transition-behavior`, `popover`, `dialog`, `inert`, `anchor-positioning`,
  `scroll-driven-animations`, `calc-size`, `safe-area-inset`, `viewport-unit-variants`,
  `fullscreen` — **HIGH**
- [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
  — anchor positioning + scroll-driven animations shipped; installed web apps changes — **HIGH**
- [WebKit Features for Safari 26.5](https://webkit.org/blog/17938/webkit-features-for-safari-26-5/)
  — scroll-driven-animation bug fixes (signal the impl is still settling) — **MEDIUM**
- [WebKit bug 301108 — REGRESSION (iOS 26): `<meta name="viewport">` viewport-fit=cover](https://bugs.webkit.org/show_bug.cgi?id=301108)
  — iOS 26 viewport regression, partially fixed by Jan 2026 — **MEDIUM**
- [Designing Websites for iPhone X | WebKit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
  — `viewport-fit=cover` required for any non-zero `env(safe-area-inset-*)` — **HIGH**
- [Apple Developer Forums #716552](https://developer.apple.com/forums/thread/716552) —
  Safari-tab vs. home-indicator `safe-area-inset-bottom` reporting differences — **MEDIUM**
- [MDN `interpolate-size`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size)
  / [`calc-size()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/calc-size)
  — Chromium-only — **HIGH**
- [`interactive-widget` — HTMHell](https://www.htmhell.dev/adventcalendar/2024/4/) —
  Chrome 108+/Firefox 132+, no WebKit support — **MEDIUM-HIGH** (cross-checked with the W3C
  standards-position issue)
- **Context7 `/websites/motion_dev`** — `AnimatePresence` exit semantics, `LazyMotion` +
  `domAnimation` + `m` bundle-size guidance, `usePresence`/`useAnimate` exit pattern — **HIGH**
- **This repository, read directly** — `packages/app/src/components/Sheet.tsx`, `config.ts`
  (`ui.z` tiers 251-297), `styles.css` (html/body chain 15-19, body insets 205-223),
  `components/AppShell.tsx`, `components/BottomTabBar.tsx`, `components/WaveToast.tsx`,
  `dex/formatMonYear.ts`, `explore/ConstellationCanvas.tsx`, `index.html`, both
  `package.json` files, `node_modules/lucide-react/dist/lucide-react.d.ts` — **HIGH**

---
*Stack research for: v2.1 UX/UI Polish (mobile-first PWA motion + chrome + surface polish)*
*Researched: 2026-07-24*
