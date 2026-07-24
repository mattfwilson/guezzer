# Architecture Research — v2.1 "UX/UI Polish"

**Domain:** UI/motion/chrome integration into a shipped, mature offline-first PWA (React 19 + Vite 8 + Tailwind 4, npm-workspace monorepo, pure `core` + fenced Supabase app layer)
**Researched:** 2026-07-24
**Confidence:** HIGH on every structural claim (each is grounded in a file read this session, cited `path:line`). MEDIUM where a claim is a *root-cause hypothesis* for an owner-reported symptom that has not been device-reproduced — those are marked inline.

> **Scope note.** This is not a greenfield architecture. Every v2.1 item is an *integration* into shipped code. This document answers "where does each item attach, what is NEW vs MODIFIED, and in what order" — it does not re-derive the app's architecture. Everything below was verified by reading the actual source; no path is inferred from planning notes. The v2.0 edition of this file is preserved at `.planning/research/v2.0/ARCHITECTURE.md`.

---

## How To Read This Document

| Marker | Meaning |
|--------|---------|
| **NEW** | A file/component that does not exist today |
| **MODIFIED** | A shipped file that must change (with the exact lines) |
| ⚠️ **TRAP** | A shipped behaviour that will silently break the naive implementation |
| 🚩 **VIOLATION RISK** | A tempting approach that forks a single pipeline / breaks a stated project constraint |

---

## Part 0 — The Shipped Architecture (verified)

### System overview

```
┌───────────────────────────────────────────────────────────────────────┐
│ App.tsx  — the ONLY place singleton engines + overlay hosts mount      │
│  engines (render nothing):  useBingoCelebrations() :31                 │
│                             useProgressSync()      :41                │
│                             usePresence()          :50                │
│  hosts   (module-emitter):  InstallBanner UpdateToast BackupToast      │
│                             BingoCelebration WaveToast AppMenu :119-124│
├───────────────────────────────────────────────────────────────────────┤
│ <div id="app-content" style={{display:contents}}>  App.tsx:92          │
│   └─ AppShell  :98-101   (header + <main scroll?> + BottomTabBar)      │
│        └─ route switch  :102-116   show|explore|map|settings|dex|games │
├───────────────────────────────────────────────────────────────────────┤
│ Portal escape hatch: <Sheet> createPortal(document.body)  Sheet.tsx:77 │
│   → open sheets land OUTSIDE #app-content so inert works              │
├───────────────────────────────────────────────────────────────────────┤
│ Module stores (useSyncExternalStore) — the established engine→reader   │
│   bottomOverlayInset.ts:22-73   presenceSync.ts:151-190                │
│   progressSync.ts (getSyncState)  dialogStack.ts:15   inertRoot.ts:21  │
├───────────────────────────────────────────────────────────────────────┤
│ Dexie (single source of truth) ← useLiveQuery ← useShowSession.ts:66   │
│ @guezzer/core (pure, DOM-free — purity.test.ts:37-49 enforces)         │
└───────────────────────────────────────────────────────────────────────┘
```

### The five invariants v2.1 must not break

1. **Core purity.** `packages/core/src` may not contain `document.` / `localStorage` / `navigator.` / `WebSocket` / `@supabase/` — statically scanned (`packages/core/test/purity.test.ts:37-49`). Note the scan bans *specific* globals; a bare `window.` ban was deliberately NOT added (`:23-29`).
2. **Single config file.** `packages/app/src/config.ts` is the sole home of app constants + copy (`config.ts:1-11`); `packages/core/src/config.ts` mirrors for core, with `packages/app/test/configMirror.test.ts` guarding drift.
3. **One pipeline per artifact.** Bingo marks are derived, never stored (`GamesView.tsx:16-19`); the constellation and predictor read the same matrix. Forking a surface into two renderers is a stated architecture violation.
4. **Singleton engines mounted once at the shell**, readers are pure (`App.tsx:33-50`; PROJECT.md D-16/D-19).
5. **Display labels are decoupled from routes/storage keys.** The v2.0 rebrand guard test (`packages/app/test/rebrand.test.ts:48-52`) exists precisely to stop a rename touching persisted keys.

### The chrome layout math, as shipped

Three files independently hardcode the bottom-tab-bar height, and a fourth encodes it as a Tailwind class:

| Site | Literal | Purpose |
|------|---------|---------|
| `AppShell.tsx:75-77` | `calc(4rem + env(safe-area-inset-bottom) [+ overlayInset])` | `<main>` bottom reservation |
| `BottomTabBar.tsx:24-27` | `height: calc(4rem + env(safe-area-inset-bottom))`, `paddingBottom: env(...)` | the bar itself |
| `fabLayout.ts:10-14` | `calc(env(safe-area-inset-bottom) + 64px + 16px)` | FAB + weak-fan hint offset |
| `bottom-16` class | `WaveToast.tsx:168`, `BackupToast.tsx:71`, `UpdateToast.tsx:33`, `InstallBanner.tsx:90`, `BingoCelebration.tsx:206` | every bottom toast |

**This is the most consequential finding for v2.1:** the "chrome hidden" mechanism has *nine* consumers of one number currently written in four different notations. Unifying it into `config.ui.TAB_BAR_HEIGHT_PX` is a prerequisite, not a nicety.

---

## Part 1 — Full-screen bingo overlays on top of tracking

### 1.1 The seam: `<Sheet variant="fullscreen">` already exists — use it

`Sheet.tsx:36` declares `variant?: "bottom-sheet" | "fullscreen"`, and `:75-87` renders the fullscreen branch: `createPortal(<div role="dialog" className="fixed inset-0 overflow-y-auto bg-surface" style={{zIndex: config.ui.z.sheet}}>…, document.body)`. It is in production on four surfaces (`CompareView.tsx:77,100`; `FriendDetail.tsx:122,149`; `DexView.tsx:206-212`), each supplying its own safe-area header + close control (`DexView.tsx:213-228` is the canonical example).

**Recommendation: no new primitive, no App-level portal.** Use `<Sheet variant="fullscreen">`. Rationale:

- It already portals to `document.body`, which is **load-bearing here** — see the stacking-context trap in §4.2. A hand-rolled `fixed` overlay rendered inside `ShowView` would be trapped under `config.ui.z.content`.
- It already wires focus trap + `inert` + LIFO Escape (`Sheet.tsx:60-61`), so the overlay is Escape-dismissible and the orbit behind it goes inert — exactly right for a modal board.
- A "new sibling primitive" would duplicate the a11y layer the project explicitly consolidated in v1.1 (PROJECT.md Key Decision: "One shared `<Sheet>` primitive for a11y"). 🚩 **VIOLATION RISK.**

The one Sheet gap for this use: the fullscreen branch does **not** apply `env(safe-area-inset-top)` (`Sheet.tsx:80`) — each consumer does it in its own header. Keep that convention (UX-01 fixed a *doubled* top inset by making surfaces self-apply exactly once; PROJECT.md v1.2 Phase 13).

### 1.2 Sharing the deal/board UI without forking it

Today `GamesView.tsx:171-247` inlines the entire bingo state machine as a local `editor` variable:

- `:244-247` → `<DealScreen/>` when there is no card for the active session
- `:173-243` → the draft board (`FillMeter` + `BingoBoard` + `SwapSheet`) or the locked live board (`deriveLiveBoard` + `nearMiss` one-away glow)

`DealScreen.tsx` is already standalone with zero GamesView coupling (it self-sources context via `getBingoContext()` and `useDexStats()`, and auto-starts a session at `:44`). The board branch is **not** extracted.

**Recommendation:**

| Component | Status | Detail |
|-----------|--------|--------|
| `packages/app/src/games/BingoSessionPanel.tsx` | **NEW** | Lift `GamesView.tsx:171-247` verbatim into one presentational component. Props: the active show, the card row, the derived ctx/snapshot/entries, and the `onApplySwap`/`onReshuffle` callbacks (`GamesView.tsx:144-169`). Contains the deal-vs-draft-vs-live branch — i.e. it *is* the state machine. |
| `packages/app/src/games/GamesView.tsx` | **MODIFIED** | Becomes: heading + `<BingoSessionPanel/>` + the replay list (`:258-293`) + `<ShareCardSheet/>` (`:297-301`). Net deletion. |
| `packages/app/src/show/InShowBingoOverlay.tsx` | **NEW** | `<Sheet variant="fullscreen">` + safe-area header (title + X, mirroring `DexView.tsx:213-228`) wrapping the same `<BingoSessionPanel/>`. |
| `packages/app/src/games/DealScreen.tsx` | **unchanged** | Already standalone; renders inside the panel in both hosts. |

One renderer, two hosts. 🚩 Copy-pasting the board JSX into a show-side component is the forbidden fork.

⚠️ **TRAP — data ownership.** `BingoSessionPanel` needs `activeShow`, `cards`, `trackedEntries`, `stats` (`GamesView.tsx:60-85`). Do **not** re-query them ad hoc in the overlay: `ShowView` already holds the session (`useShowSession()`, `ShowView.tsx:92`) and the card row (`ShowView.tsx:316-322`). Either pass them down, or let the panel self-source via `useLiveQuery` exactly once — identity-scoped per `GamesView.tsx:53-57`, since a borrowed phone must not surface another identity's cards. Self-sourcing is the lower-coupling option and keeps both hosts thin.

### 1.3 Where the open/close state lives

Three producers want to open this overlay, and they live in **three different React trees**:

| Producer | Location | Tree |
|----------|----------|------|
| FAB "Bingo" action (backlog #2) | `FabMenu.tsx:84-92` actions array | inside `ShowView` |
| Start-Show nudge `[Deal]` (backlog #1) | `ShowView.tsx:655-662` — today `navigate("games")` at `:659` | inside `ShowView` |
| Bingo celebration toast deep-link (backlog #3) | `BingoCelebration.tsx:196-219` | **App-level host**, outside `ShowView` |
| (bonus) peek-strip tap | `BingoPeekStrip.tsx:84` — today `navigate("games")` | inside `ShowView` |

Because one producer is an App-level toast host, **App-level `useState` will not do without prop-drilling through `AppShell`**, and show-session (Dexie) state is wrong — the overlay is ephemeral UI, and persisting it would resurrect an open overlay after a crash restore, contradicting the "per-session UI state, no persistence" precedent (`ShowView.tsx:98-101` for the nudge, D-09).

**Recommendation: a module store + `useSyncExternalStore`**, matching the established idiom (`bottomOverlayInset.ts:22-73` is the closest structural twin: module map + notify + reader hook).

```ts
// packages/app/src/show/showOverlay.ts  (NEW)
export type ShowOverlay = null | "bingo";
export function openShowOverlay(o: Exclude<ShowOverlay, null>): void
export function closeShowOverlay(): void
export function useShowOverlay(): ShowOverlay      // useSyncExternalStore reader
```

Render site: **inside `ShowView`** (it owns the session + card and is the "on top of tracking" context). The App-level toast deep-link therefore does two things: `navigate("show")` (`routing/useHashRoute.ts:37`) then `openShowOverlay("bingo")`. Because `#/show` stays mounted across the show lifecycle (`ShowView.tsx:286-290` documents this), the ordering is safe.

⚠️ **TRAP — the celebration toast is `pointer-events-none`.** `BingoCelebration.tsx:206` sets `pointer-events-none` deliberately: D-17 says the live logging loop is sacred and a celebration must never intercept a tap. A deep-link button requires `pointer-events-auto` on **the button only**, keeping the container non-interactive. Note the toast sits at `bottom-16` full-width — directly over the `SuggestionStrip` slot (`config.ui.SUGGESTION_STRIP_HEIGHT`, `config.ts:232`) — so an interactive region there can steal an adopt/dismiss tap. Constrain it to a right-aligned chip and keep `MARK_TOAST_MS`/`BADGE_TOAST_MS` short (`config.ts:311-313`).

### 1.4 Files touched — item 1

| File | Status |
|------|--------|
| `games/BingoSessionPanel.tsx` | **NEW** |
| `show/InShowBingoOverlay.tsx` | **NEW** |
| `show/showOverlay.ts` | **NEW** |
| `games/GamesView.tsx:171-255` | **MODIFIED** (extract) |
| `show/ShowView.tsx:598-607, 655-662` | **MODIFIED** (FAB prop, nudge target, render overlay) |
| `show/FabMenu.tsx:40-92` | **MODIFIED** (new `onBingo` prop + action row) |
| `show/BingoPeekStrip.tsx:84` | **MODIFIED** (`navigate("games")` → `openShowOverlay("bingo")`) |
| `components/BingoCelebration.tsx:196-219` | **MODIFIED** (deep-link chip) |
| `config.ts` (`copy.games.bingo`, `copy.show`) | **MODIFIED** (overlay title/close/FAB labels) |

---

## Part 2 — The modular "chrome hidden" mechanism

### 2.1 Store shape: a reason SET, not a boolean

Two independent producers (explicit GizzVerse toggle, automatic in-show hide) can both want chrome hidden, and each must release independently. A boolean races; the project already solved the identical problem for `inert` with **ref counting** (`inertRoot.ts:21-38`, written specifically because "a single boolean toggle would clear `inert` too early when modals stack").

**Recommendation:** a module store keyed by reason.

```ts
// packages/app/src/chrome/chromeHidden.ts  (NEW)
export type ChromeReason = "fullscreen" | "inShow";
const reasons = new Set<ChromeReason>();          // hidden === reasons.size > 0
export function setChromeHidden(r: ChromeReason, hidden: boolean): void
export function useChromeHidden(): boolean                                  // reader
export function useHideChromeWhile(r: ChromeReason, active: boolean): void  // registration
```

`useHideChromeWhile` is a direct clone of `useBottomOverlayHeightRegistration`'s contract (`bottomOverlayInset.ts:81-116`): a component declares intent, and the effect cleanup **always** releases on unmount. That auto-release is what makes the in-show producer correct for free (§2.3).

**Why not context?** A provider would have to wrap `#app-content` (`App.tsx:92`) and would re-render the whole route tree on toggle. The module store keeps the app's established engine→reader shape (PROJECT.md D-16/D-19), is testable without a renderer, and lets non-React call sites (e.g. `fabLayout.ts`) read it if needed. **Why not props through AppShell?** `App.tsx` does not know a show is active — `ShowView` does, via `useShowSession()` — so props would force lifting Dexie state into `App`, duplicating the query `usePresence.ts:76-79` already runs.

### 2.2 AppShell consumption + the layout math

`AppShell` (**MODIFIED**) reads `useChromeHidden()` and:

1. Header (`AppShell.tsx:40-60`) — hide (slide up under motion-safe; instant under reduced motion).
2. `<BottomTabBar/>` (`AppShell.tsx:83`) — hide (slide down).
3. `<main>` padding (`AppShell.tsx:75-77`) — the `4rem` term becomes `0`. Keep the `env(safe-area-inset-bottom)` term and the `overlayInset` term (`AppShell.tsx:27`, `bottomOverlayInset.ts:71`) — a toast can still appear with chrome hidden.
4. The `scroll` prop (`App.tsx:100`) is **orthogonal** — it selects `flex-1 overflow-y-auto` vs `flex min-h-0 flex-1 flex-col overflow-hidden` (`AppShell.tsx:63-67`). Hiding chrome changes only the *reservation*, never the overflow mode. Do not couple them. The three non-scrolling routes (`show`/`explore`/`map`) get a taller `flex-1` stage automatically — exactly the GizzVerse ask.

**Prerequisite refactor (same plan):** introduce `config.ui.TAB_BAR_HEIGHT_PX = 64` and route all nine consumers from §0 through it, including replacing the `bottom-16` class on the five toasts with an inline `bottom: chromeHidden ? 0 : TAB_BAR_HEIGHT_PX`. Tailwind v4 resolves arbitrary values at author-time from static strings, so a JS-config value *must* go through inline style — already documented policy at `config.ts:243-248`. Without this, hiding the tab bar leaves every toast floating 64 px above nothing and parks the FAB (`fabLayout.ts:12-13`) over empty space.

⚠️ **TRAP — `useVisibleViewportHeight` will not fire.** `explore/useVisibleViewportHeight.ts:24-37` subscribes to `window resize` + `visualViewport resize/scroll`. Hiding the tab bar changes an *element box*, not the visual viewport, so `NodeSheet`'s peek height and the `ExploreFilterFab` lift (`ExploreFilterFab.tsx:93-101`) will **not** recompute on a chrome toggle. `ConstellationCanvas` is safe — it measures its container with a `ResizeObserver` (`ConstellationCanvas.tsx:216-226`), and the UX-04 `firstSettleRef` gate keeps the user's pan/zoom across resizes (PROJECT.md v1.2 Phase 13 UX-04). Verify NodeSheet/FilterFab geometry with the toggle on device, or give them a `chromeHidden` dependency.

### 2.3 Producers

| Producer | Where | Implementation |
|----------|-------|----------------|
| In-show auto-hide | `show/ShowView.tsx` **MODIFIED** | `useHideChromeWhile("inShow", session.active != null)` — mount it above the early returns (`ShowView.tsx:360-389`) so hook order stays stable, the same discipline as the wake-lock effect (`:300-308`). |
| GizzVerse toggle | `explore/ExploreView.tsx` **MODIFIED** + a toggle control (**NEW**, standalone or a row inside `ExploreFilterFab.tsx`) | local `const [fullscreen, setFullscreen] = useState(false)` → `useHideChromeWhile("fullscreen", fullscreen)`. |

Putting the in-show producer in `ShowView` (not `App`) is deliberate: `ShowView` unmounts on navigation away from `#/show`, and the registration hook's cleanup releases the reason automatically — so **the tabs return the moment the user leaves LiveGizz**, which is the only safe semantics.

🚩 **DESIGN FLAG for requirements.** The backlog says "when a show is being tracked, the bottom tabs should not be visible" (`v2.1-ux-polish-backlog.md:36-37`). Interpreted app-wide, that traps the user on whatever tab they are on — including no route back to GizzMap at a venue, a real functional regression. The `ShowView`-scoped producer above reads it as "hidden **while on LiveGizz** during a tracked show". Additionally, an explicit reveal affordance is mandatory in both cases (chrome is the only navigation): for GizzVerse an exit-fullscreen FAB beside `ExploreFilterFab`; for in-show an edge-tap/chevron. Confirm the intended scope with the owner.

### 2.4 Interaction with `config.ui.z` and `dialogStack` when chrome is hidden

**Nothing structural changes, and that is the point:**

- Sheets portal to `document.body` (`Sheet.tsx:77,90`), i.e. **outside** the hidden chrome's subtree, so hiding the header/tab bar cannot affect an open sheet's layout or paint order.
- `Sheet`'s own bottom padding is `calc(env(safe-area-inset-bottom) + 32px)` (`Sheet.tsx:104`) — it never reserved tab-bar height, so a bottom sheet already sits correctly with or without the tab bar. ✅ no change needed.
- `dialogStack` (`dialogStack.ts:15-40`) is a LIFO of dismiss callbacks behind one shared `document` keydown listener; chrome visibility is not a dialog and must **not** push onto it. Escape while chrome is hidden closes the topmost *sheet* only.
- `inertRoot` (`inertRoot.ts:29-38`) toggles `inert` on `#app-content`, which contains `AppShell` including the tab bar — so when a modal sheet opens the tab bar is already inert. Hiding it is orthogonal and composes cleanly.

**One decision to record:** should exiting fullscreen bind to Escape? If yes it must go through `dialogStack` to preserve LIFO ordering (Escape closes the topmost sheet first, then un-hides chrome). Recommend **yes** for desktop parity, via `useDialogDismiss` (`useDialogDismiss.ts:13-19`) while `fullscreen === true` — the one legitimate non-dialog use of the stack, and it inherits correct ordering for free.

### 2.5 Files touched — item 2

| File | Status |
|------|--------|
| `chrome/chromeHidden.ts` | **NEW** |
| `components/AppShell.tsx:38-85` | **MODIFIED** |
| `components/BottomTabBar.tsx:20-27` | **MODIFIED** (motion wrapper + config height) |
| `show/fabLayout.ts:10-14` | **MODIFIED** (config height + chrome-aware) |
| `components/{WaveToast,BackupToast,UpdateToast,InstallBanner,BingoCelebration}.tsx` | **MODIFIED** (`bottom-16` → config/chrome-aware inline) |
| `show/ShowView.tsx` | **MODIFIED** (producer) |
| `explore/ExploreView.tsx` + toggle control | **MODIFIED** / **NEW** |
| `config.ts` (`ui.TAB_BAR_HEIGHT_PX`, `ui.chrome.*`, `copy.explore.fullscreen*`) | **MODIFIED** |

---

## Part 3 — Reaction fly-up replacing `WaveToast`

### 3.1 What stays, exactly

Verified unchanged surface: the `gizz-room` channel + broadcast wiring (`presenceSync.ts:72-89`), `WavePayload` `{from,to,emoji}` (`:39-43`), `validateWave` (`:131-140`), the bound sender (`:194-215`), and `ReactionPalette` (`ReactionPalette.tsx:96-166`). **No wire-format change is needed** — see §3.2.

### 3.2 Section → spawn coordinate (the key mechanism)

The sender's current section is **already on the receiving device**: presence publishes `activityByUser: Map<userId, {tab, atShow?}>` (`presenceSync.ts:51-54,108-116`), and the `Tab` union is the five brand tokens plus `idle` (`presenceActivity.ts:25-31`).

So the receive path becomes: `usePresence.ts:115-125` validates the wave (unchanged), then reads `getPresenceState().activityByUser.get(wave.from)?.tab` and passes it into the emitter. This *extends the existing trusted-store resolution pattern* — `WaveToast.tsx:85-91` already resolves the sender **name** from the trusted store rather than the payload (V5/T-20-02). Resolving the tab the same way preserves that security property. 🚩 Adding `tab` to the broadcast payload instead would be both a wire change **and** a new untrusted field in the render path — reject it.

Fallbacks (all must be handled): sender not in `activityByUser` (transient join window), `tab === "idle"` (sender backgrounded — `presenceActivity.ts:80`), or an empty presence store → spawn at bottom-centre.

**Tab → x:** the tab bar is five `flex-1` buttons (`BottomTabBar.tsx:29-47`), so lane `i` of `n` centres at `(i + 0.5) / n` of the viewport width, with the tab order defined by `BottomTabBar.tsx:4-13`. The emoji then visibly rises **from the sender's tab icon**, which is the whole point of the feature and reads instantly even when the receiver is on a different tab.

⚠️ **TRAP:** when chrome is hidden (§2) there is no tab bar to rise from. Rule: `chromeHidden → bottom-centre spawn`. The fly-up host must read `useChromeHidden()`.

### 3.3 Pure geometry module — app, not core

```ts
// packages/app/src/sync/reactionSpawn.ts  (NEW — pure, no DOM, no React)
export function spawnLaneFor(tab: Tab | null, laneCount: number): number  // 0..1 x-fraction
export function driftFor(seed: string, i: number): { dx: number; rotate: number }
```

**Recommendation: keep it in the app layer, beside `presenceActivity.ts`.** That file is the exact precedent — "DELIBERATELY pure — no Supabase, no React, no DOM… the structural analog of a pure core projector" (`presenceActivity.ts:1-8`), living in the app because it depends on `Route`, which is chrome. Spawn geometry depends on the **tab-bar ordering**, which is chrome too. Putting it in core would technically pass the purity scan (`purity.test.ts:37-49` bans DOM globals, not `Intl`/math) but would drag presentation ordering into the domain package for no benefit.

**PRNG:** reuse core's `xmur3` + `mulberry32` (`packages/core/src/bingo/prng.ts:19-42`) rather than `Math.random`. Reasons: (a) the repo already declares one PRNG and a second implementation is a duplicate-pipeline smell; (b) seeding on `${from}:${emoji}:${seq}` makes drift deterministic and unit-testable with no `Math.random` mocking; (c) it is dependency-free and erasable-syntax-only. **Cost:** `prng.ts` is not exported — `packages/core/package.json` exposes only `"."` and `"./config"`, and `index.ts` does not re-export it. This needs a one-line additive barrel export (`packages/core/src/index.ts` **MODIFIED**) — trivially safe and strictly better than a second RNG. If the owner prefers zero core churn, `Math.random` in the app is acceptable; accept untestable drift.

### 3.4 Host ownership

| Component | Status | Notes |
|-----------|--------|-------|
| `components/ReactionFlyUp.tsx` | **NEW** | App-level host, mounted at `App.tsx:123` in place of `<WaveToast/>`. Same module-emitter idiom (`WaveToast.tsx:58-77`), same trusted-name resolution (`:85-91`), same `useReducedMotion()` gate (`:94`). Difference: multiple concurrent items (a fly-up wants overlap; a toast wanted a queue). |
| `components/WaveToast.tsx` | **REPLACED** | Its emitter (`showWaveToast`) and payload type move into the new host; `usePresence.ts:35,119` imports update. |
| `sync/usePresence.ts:115-125` | **MODIFIED** | Resolve `tab` from the store; emit the enriched payload. Transport/validation untouched. |
| `sync/reactionSpawn.ts` | **NEW** | pure geometry |
| `packages/core/src/index.ts` | **MODIFIED** (optional) | export `xmur3`/`mulberry32` — see §3.3 |

⚠️ **TRAP — drop the bottom-overlay height registration.** `WaveToast.tsx:100` registers its measured height into `bottomOverlayInset` so `<main>` reserves space. A fly-up is transient, `pointer-events-none`, and travels *up* the screen — registering it would make `<main>` jump every time a friend reacts, mid-show. **Do not port `useBottomOverlayHeightRegistration` to the new host.**

**Layering:** the fly-up must never paint over an open sheet. Give it `config.ui.z.toast` (20), or a new tier strictly below `sheetScrim` (40) — and it **must** portal to `document.body`, for the reason in §4.2.

**Config additions** (`config.presence.flyUp`): `TRAVEL_PX`, `DURATION_MS`, `MAX_CONCURRENT`, `DRIFT_PX`, `STAGGER_MS`. The existing `QUEUE_CAP` / `TOAST_MS` / `DRAIN_GAP_MS` (`config.ts:804-813`) describe FIFO-toast semantics that no longer apply — repurpose or replace them deliberately, and update the block's prose at `:794-803`, which documents the old behaviour verbatim.

**Reduced motion (hard requirement, PROJECT.md 2026-07-24):** `useReducedMotion()` path = a static fade in/out at the spawn anchor — no translate, no drift — mirroring `BingoCelebration.tsx:202-204,246-247`.

---

## Part 4 — Bottom-sheet animation + the z-layer guarantee

### 4.1 Animating the ONE primitive — and why "all 7+ surfaces for free" is only half-true

Adding enter/exit motion inside `Sheet.tsx` is straightforward: `motion` is already a dependency and `AnimatePresence` is in use (`BingoCelebration.tsx:196`, `WaveToast.tsx:158`). The shape:

```tsx
// Sheet.tsx — remove the `if (!open) return null` early return (:64) and instead:
return createPortal(
  <AnimatePresence>{open && <motion.div … />}</AnimatePresence>,
  document.body,
);
```

This preserves the V7/T-08-04 "closed sheet renders nothing" invariant asserted at `packages/app/test/sheet.a11y.test.tsx:36-45` (that test checks `container.firstChild` and `queryByRole("dialog")`, both still null when closed).

⚠️ **TRAP 1 — parent-gated sheets never play an exit.** Exit animation requires the `<Sheet>` element to stay mounted while `open` flips false. These call sites unmount it outright, so an in-Sheet `AnimatePresence` never runs:

| Call site | Line |
|-----------|------|
| `DexView.tsx` self trophy case — `{selfCaseOpen && <Sheet open …>}` | `:205-212` |
| `DexView.tsx` friend detail — `{openFriend != null && <FriendDetail/>}` with `<Sheet open>` hardcoded inside | `:199-200` / `FriendDetail.tsx:122,149` |
| `GamesView.tsx` swap sheet — `{unlocked && swapIndex != null && <SwapSheet open …>}` | `:229-241` |
| `CompareView.tsx` — `<Sheet open …>` hardcoded | `:77,100` |

Fix: convert these to always-mounted-with-`open`, the pattern already used by `AppMenu.tsx:40`, `CatchUpSheet.tsx:166`, `AvatarSheet.tsx:23`, `MapView.tsx:523`, `IdentityAvatar.tsx:89`, and explicitly by `ReactionPalette` per its WR-01 note (`ReactionPalette.tsx:60-70`). Budget **per-surface work on 4 surfaces**; the "no per-surface work" goal holds for the other 13 import sites.

⚠️ **TRAP 2 — seven sheets do not use the primitive at all.** These render their own `fixed` overlays with the z tokens and would gain nothing from animating `Sheet`:

| Surface | Line | Tier used |
|---------|------|-----------|
| `show/SearchSheet.tsx` | `:95-101` | `z.sheet` |
| `explore/NodeSheet.tsx` | `:144-156` | `z.sheet` (non-modal, drag-resizable) |
| `show/CometTrail.tsx` (FullSetlistSheet) | `:221-233` | `z.sheetScrim` |
| `dex/ArchiveBrowser.tsx` | `:270`, `:374` | `z.sheet` / `z.sheetScrim` |
| `dex/AlbumDetail.tsx` | `:48` | `z.sheet` |
| `dex/SetlistView.tsx` | `:119-131` | `z.sheet` |
| `dex/RecapView.tsx` | `:211-212`, `:253` | `z.page` |

Requirements should state which of these are in scope. `SearchSheet` and `CometTrail`'s sheet matter most (both are in the live show loop) and both are also the two most affected by §4.2.

⚠️ **TRAP 3 — focus restore fires at exit start.** `useFocusTrap` restores focus in its cleanup (`useFocusTrap.ts:74-79`), keyed on `active`. If `active` stays `open && modal`, focus returns to the trigger while the sheet is still visibly animating out. That is acceptable (arguably correct), but `sheet.a11y.test.tsx:74-94` may need a `waitFor`/act adjustment. Do **not** delay the `inert` clear past the exit — a lingering `inert` background is the T-08-03 failure the ref-count exists to prevent.

**Config:** `config.ui.sheetAnim = { ENTER_MS, EXIT_MS, SCRIM_FADE_MS }`, honored behind `useReducedMotion()` (opacity-only when reduced), matching `config.ui.celebration` (`config.ts:310-325`) as the precedent block.

### 4.2 The z-layer fix: a tier scale is NOT enough — this is structural

The tier scale itself is sound and every explicit `z-index` already reads a token (verified: 30 `config.ui.z.*` call sites, zero raw `z-NN` literals outside `dev/OrbFitHarness.tsx:147`). Its invariants are documented at `config.ts:240-297`. **The tier scale is not the bug.**

The real mechanism is **stacking-context capture**. `ShowView.withBackground` wraps every Show-Mode state in:

```tsx
<div className="relative flex h-full …">                              // ShowView.tsx:174
  <ShowBackground … />
  <div className="relative …" style={{ zIndex: config.ui.z.content }}>  // :176-179
    {content}
  </div>
</div>
```

A `position: relative` element with `z-index: 10` **creates a stacking context**. Every `fixed`-positioned descendant is painted *within* that context — its own `z-index` only orders it against siblings inside, and the whole group composites at **z = 10** against the root. Everything `ShowView` renders is that `content`: `FabMenu` (z 30), `BingoPeekStrip`'s expanded panel (z 12), `SearchSheet` (z 50), `CometTrail`'s FullSetlistSheet (z 40), `OrbitStage`'s weak-fan hint (z 12, `OrbitStage.tsx:338-339`).

Consequences, all currently shipped:

- The **BingoCelebration supernova** (root context, z 18, `BingoCelebration.tsx:229`) paints **over** the FAB speed-dial (locally 30, effectively 10) — and over an open `SearchSheet` (locally 50, effectively 10).
- Any App-level **toast** (root z 20) paints over an open `SearchSheet` and over the FullSetlistSheet.
- `<Sheet>`-based surfaces are immune **only because they portal to `document.body`** (`Sheet.tsx:77,90`), escaping into the root stacking context at z 40/50.

**Confidence:** HIGH that this is the mechanism (plain CSS stacking rules over verified markup). MEDIUM that it is the *specific* symptom the owner reported — not device-reproduced this session.

**Recommendation — structural, not numeric:**

1. **NEW `components/OverlayLayer.tsx`** — a one-line portal primitive (`createPortal(children, document.body)`, optionally taking the z-tier). Every `fixed`-positioned overlay renders through it, so all overlays live in **one** stacking context (the root) where `config.ui.z` actually means something. `<Sheet>` already does this internally and needs no change; `FabMenu`, `SearchSheet`, `CometTrail`'s sheet, and the new `ReactionFlyUp` route through it.
2. **Add a regression guard test** in the `rebrand.test.ts` spirit (that file is the precedent for a static discipline test): scan `packages/app/src/**/*.tsx` and fail on a `className` containing `fixed ` in a file that imports neither `OverlayLayer`/`Sheet` nor `createPortal`. Crude, but this is exactly the drift class that otherwise costs a device-UAT cycle to find.
3. **Keep the tier scale**, and add the invariant "no `fixed` overlay may be rendered inside a z-indexed positioned ancestor" to the `config.ts:240-249` comment block — that block is where a future contributor will look.

Alternative considered and rejected: dropping `zIndex: config.ui.z.content` from `ShowView.tsx:178`. It would remove the stacking context and "fix" the symptom, but that wrapper exists to sit above `ShowBackground` (`ShowView.tsx:170-179`) — removing it risks the ambient cover painting over the orbit, and it leaves every future positioned wrapper free to re-introduce the trap. Portal-everything is the durable fix.

---

## Part 5 — Tab rename + install-affordance relocation

### 5.1 The rename: display/route decoupling exists in the tab bar — and nowhere else

`BottomTabBar.tsx:4-13` holds `{ route, label, Icon }` triples, so `label` is already fully decoupled from `route` and from Dexie/storage keys. ✅ Renaming there is a pure copy edit. (Move the labels into `config.copy.tabs` while doing it — the single-config rule at `config.ts:1-11` says no component should hardcode a copy string, and the tab bar is currently an exception. `Icon` component refs stay local: those are code, not constants.)

**Every other user-facing occurrence of the long names** (exhaustive, from a repo-wide scan):

| Site | Line | User-facing? | Action |
|------|------|--------------|--------|
| `components/BottomTabBar.tsx` labels | `:5-12` | **YES** — the tabs | rename |
| `config.copy.games.sectionHeading: "GizzGames"` | `config.ts:1201` | **YES** — rendered as the `<h1>` at `GamesView.tsx:251-253` | rename |
| `sync/presenceActivity.ts` `Tab` union | `:25-31` | **YES, indirectly** — see below | ⚠️ do NOT rename |
| `sync/presenceActivity.ts` `ROUTE_TO_TAB` | `:48-55` | wire values | ⚠️ do NOT rename |
| `sync/presenceActivity.ts` `TABS` allow-list | `:58-65` | wire validation | ⚠️ do NOT rename |
| `dex/FriendRow.tsx` renders `activity.tab` verbatim | `:72` | **YES** — the friend presence label | **MODIFIED** — render through a label map |
| Code comments (`BingoPeekStrip.tsx:6`, `StartShowNudge.tsx:8`, `App.tsx:37,97`, `config.ts` prose) | — | no | optional cleanup |
| Tests: `test/sync/presenceActivity.test.ts:21-25,32-49`, `test/sync/presenceSync.test.ts:117-271`, `test/sync/usePresence.test.tsx:133-214`, `test/dex/friendPresence.test.tsx:136-174` | — | — | update to the label map; keep token assertions |

🚩 **THE RENAME TRAP.** `presenceActivity.ts:20-24` documents: *"The presence tab tokens. These ARE the display labels… so no separate label map is needed."* Those tokens are **broadcast over the `gizz-room` Realtime channel** (`usePresence.ts:131,156` → `.track(activity)`) and validated against a fixed allow-list on receipt (`presenceActivity.ts:100`). Renaming them:

- changes the wire format, so a friend still on the previous build broadcasts `"GizzDex"`, the new allow-list rejects it, and their activity label silently disappears (`reduceActivity` skips unknown tabs, `:100`);
- directly contradicts the owner's own rule for this change ("display labels only — routes, file paths, and Dexie/storage keys stay untouched", PROJECT.md Key Decisions).

**Fix:** freeze the tokens; add `config.copy.presence.tabLabels: Record<Tab, string>` and render `tabLabels[activity.tab]` at `FriendRow.tsx:72` — the same display/route decoupling the tab bar already has, applied to presence. Add a guard test asserting the wire tokens are unchanged, mirroring `rebrand.test.ts:48-52`.

**Share-card output is clean.** The share/trophy card copy (`config.ts:1474-1502`) contains only `"Gizz With Friends"` and generic labels — no `GizzX` tab names reach `shareCard.ts`. ✅ nothing to change.

🚩 **SPEC CONFLICT to resolve at kickoff:** the backlog says `GizzDex → **Dex**` (`v2.1-ux-polish-backlog.md:41`); PROJECT.md says `GizzDex → **Me**` (PROJECT.md line 40). Pick one before writing copy.

### 5.2 Install-affordance relocation — and the coupling that will break it

**Current home:** `AppMenu.tsx` — the accent Install button (`:55-61`, `config.copy.installCta` = `config.ts:843`), the iOS illustrated steps (`:74-78` → `IosInstallInstructions`), and the "can't auto-install here" fallback (`:80-84`, `config.ts:844-845`). All three come from `useInstallState()` (`AppMenu.tsx:20`).

**Target:** the bottom of `SettingsView`, after the `Backup & data` section (`SettingsView.tsx:185-320`), as a new `<section>` inside the existing `max-w-md` column (`:160`).

⚠️ **TRAP — `useInstallState` is per-instance, and `beforeinstallprompt` fires once.** `useInstallState.ts:41-57` stores the deferred event in a **component-local** `useRef` and attaches its own `window` listener in an effect. Only instances mounted *when the event fires* capture it. Today that works because both consumers are effectively always mounted (`InstallBanner` at `App.tsx:119`; `AppMenu` at `App.tsx:124` — mounted even when closed, since `Sheet` returns null internally). `SettingsView` is mounted **only on `#/settings`** (`App.tsx:108-109`), long after boot. Moving the button there without changing anything else yields `canInstall === false` forever on Android and a dead button.

**Fix (matching the app's own precedent):** hoist the capture into a module-level store — a listener registered at module import, plus `useSyncExternalStore` readers — exactly the shape of `bottomOverlayInset.ts:22-73` and `presenceSync.ts:151-190`.

| File | Status |
|------|--------|
| `pwa/install/installPrompt.ts` | **NEW** — module store: capture `beforeinstallprompt` once, expose `canInstall` + `promptInstall()` |
| `pwa/install/useInstallState.ts:40-78` | **MODIFIED** — becomes a reader over the store; `isIos`/`isInstalled` keep delegating to `platform.ts` |
| `settings/SettingsView.tsx` (after `:320`) | **MODIFIED** — new install section |
| `components/AppMenu.tsx:22-30,55-61,74-84` | **MODIFIED** — remove the install rows (keep the Settings entry + VersionStamp) |
| `components/InstallBanner.tsx` | **unchanged** — the once-per-build banner (D-22, `:22-33`) is a separate affordance, not in scope |
| `config.copy.settings` | **MODIFIED** — install section heading |
| `test/installBannerVersion.test.tsx`, `test/platform.test.ts` | check for coupling |

---

## Part 6 — Cross-cutting: dates and the installed-PWA bottom gap

### 6.1 UTC-safe "Mon D, YYYY" helper

**Mirror to follow:** `dex/formatMonYear.ts:7-16` — a module-level `Intl.DateTimeFormat` with `timeZone: "UTC"` and an explicit note that UTC parsing stops `"2025-01-01"` becoming `"Dec 2024"` in a negative-offset zone. Only two importers today: `dex/SongRow.tsx`, `show/WhyDetail.tsx`.

**Recommendation:** **NEW** `packages/app/src/format/date.ts` exporting `formatShowDate(iso)` ("Mon D, YYYY") **and** the relocated `formatMonYear`, keeping one date module. `formatMonYear.ts` becomes a re-export or is deleted with its two importers updated — cheap, and it stops a second date module appearing later. Keep the `Intl` options inside the module (following the shipped precedent) rather than in `config.ts`; they are a format spec, not a tunable.

**Raw-ISO render sites to convert:**

| Site | Line |
|------|------|
| `show/ShowView.tsx` show-header date | `:513-516` |
| `dex/ShowsList.tsx` row date | `:234` |
| `dex/SetlistView.tsx` header date | `:148` |
| `dex/RecapView.tsx` subline (`copy.subline(show?.date …)`) | `:219` |
| `games/GamesView.tsx` `cardSubline` (falls back to `card.showDate`) | `:44-47`, `:265` |
| `dex/FriendsList.tsx` uses `toLocaleTimeString` (a *time*, not a date) | `:41` — out of scope |

Also check `dex/shareCard.ts`: it draws a date onto the PNG from `ShareCardData` — the owner's item says "app-wide", so decide whether the card follows the same format.

### 6.2 The installed-PWA bottom viewport gap — root-cause hypothesis

The bottom safe-area inset is applied **twice**:

1. `styles.css:220` — `body { padding-bottom: env(safe-area-inset-bottom); }`
2. `BottomTabBar.tsx:24-27` — `height: calc(4rem + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom);`
3. `AppShell.tsx:75-77` — `<main>` reserves `calc(4rem + env(safe-area-inset-bottom) …)`

With Tailwind's `box-sizing: border-box` and the `html,body,#root { height:100% }` chain (`styles.css:15-19`), body's padding shortens the app column by one inset, while the `fixed` tab bar (viewport-anchored, `BottomTabBar.tsx:20`) re-adds it — so the content column and the tab bar disagree by exactly `env(safe-area-inset-bottom)`: ~34 px on a home-indicator iPhone, **0 px in a browser tab**, matching "installed-PWA only".

**This is structurally identical to UX-01**, the shipped fix that deleted a body-level *top* inset because seven surfaces each applied it themselves (`styles.css:217-219` documents that decision; PROJECT.md v1.2 Phase 13 records it). The symmetric fix is to delete `styles.css:220` and let the tab bar remain the single bottom-inset applier — but **every non-tab-bar bottom-anchored surface must then self-apply it**, which `Sheet.tsx:104`, `InstallBanner.tsx:93`, and `BottomTabBar` already do (`BingoCelebration.tsx:207-211` explicitly documents *not* applying it, for the same reason).

**Confidence:** HIGH on the double-application; MEDIUM that it accounts for the whole reported gap. Follow the UX-01 discipline: measure on device first (the repo's cloudflared HTTPS-tunnel workflow), then delete exactly one line, then re-verify. Do this in the **same plan** as the chrome mechanism (§2) — both rewrite the same three files' bottom math, and two separate passes would collide.

---

## Part 7 — Anti-patterns for this milestone

### AP-1: A second bingo renderer for the overlay
**What people do:** copy the board JSX from `GamesView.tsx:171-247` into a show-side overlay.
**Why it's wrong:** two pipelines over one derived artifact — precisely what the "marks derived, never stored / `live == replay == catch-up`" decision exists to prevent (PROJECT.md Key Decisions).
**Instead:** extract `BingoSessionPanel` once, host it twice (§1.2).

### AP-2: A second "chrome hidden" boolean per consumer
**What people do:** a local `useState` in `ExploreView` plus a separate conditional in `AppShell` for in-show.
**Why it's wrong:** the owner explicitly asked for one modular mechanism; two implementations drift, and a boolean races between producers — the reason `inertRoot.ts:21-38` is ref-counted.
**Instead:** one reason-set store (§2.1).

### AP-3: Renaming the presence `Tab` tokens
**What people do:** rename the union in `presenceActivity.ts:25-31` because "the tokens ARE the labels".
**Why it's wrong:** it is a Realtime wire-format change that silently blanks older builds' activity, and it violates the owner's display-labels-only rule.
**Instead:** freeze tokens, add a label map (§5.1).

### AP-4: A new `fixed` overlay rendered inside `ShowView`
**What people do:** add the bingo overlay or the fly-up as a plain `fixed inset-0` div with a high `config.ui.z` value.
**Why it's wrong:** it is captured by the `z.content` stacking context at `ShowView.tsx:176-179`, so its z-index is meaningless against root-level toasts and celebrations (§4.2).
**Instead:** portal to `document.body` (`<Sheet>` or the new `OverlayLayer`).

### AP-5: A parallel date formatter
**What people do:** inline `toLocaleDateString()` at each of the five render sites.
**Why it's wrong:** local-timezone parsing of a date-only ISO string is exactly the bug `formatMonYear.ts:1-6` documents; five copies means five chances to get it wrong.
**Instead:** one `format/date.ts` (§6.1).

### AP-6: Porting `useBottomOverlayHeightRegistration` to the fly-up
**Why it's wrong:** it makes `<main>` re-layout on every inbound reaction, mid-show (§3.4).

---

## Part 8 — Recommended Build Order

```
    ┌──────────────────────────────────────────────┐
    │ A. Layout & layering foundations              │  ← everything else depends on this
    │   A1 config.ui.TAB_BAR_HEIGHT_PX + 9 consumers│
    │   A2 chromeHidden store + AppShell wiring     │
    │   A3 bottom safe-area double-inset fix        │
    │   A4 OverlayLayer portal + z-context audit    │
    └───────────┬───────────────────┬───────────────┘
                │                   │
    ┌───────────▼─────────┐  ┌──────▼─────────────────┐
    │ B. Sheet animation   │  │ C. Chrome consumers     │
    │   (needs A4 portal)  │  │   C1 tab rename (indep.)│
    │   + 4 call-site      │  │   C2 GizzVerse toggle   │
    │     conversions      │  │   C3 install → Settings │
    └───────────┬──────────┘  └──────┬─────────────────┘
                │                    │
    ┌───────────▼────────────────────▼──────────────┐
    │ D. In-show bingo overlays (needs A2, A4, B)   │
    │   D1 BingoSessionPanel extraction              │
    │   D2 showOverlay store + Sheet-fullscreen host │
    │   D3 FAB action + nudge/peek retarget          │
    │   D4 celebration deep-link chip                │
    └───────────┬───────────────────────────────────┘
                │
    ┌───────────▼───────────────┐  ┌────────────────────────┐
    │ E. Reactions fly-up        │  │ F. Small visual polish  │
    │   (needs A2 chrome, A4)    │  │   F1 deal-type icons    │
    │                            │  │   F2 app-wide dates     │
    └────────────────────────────┘  └────────────────────────┘
```

### Why this order

**A first, and as one unit.** A1–A4 all rewrite the same bottom-layout math and the same overlay-mounting question across `AppShell`, `BottomTabBar`, `fabLayout`, and five toasts. Splitting them means touching those files twice and reconciling two half-migrations. A3 (the safe-area fix) belongs here rather than in "polish" for the same reason. A4 must precede anything that adds an overlay, or the new overlay inherits the stacking trap and the fix becomes a retrofit.

**B before D.** The in-show bingo overlay is a `<Sheet variant="fullscreen">`; if `Sheet` gains enter/exit animation afterwards, the overlay must be re-verified anyway. Landing the animation first means the overlay is built against the final primitive. B also surfaces the four parent-gated call sites (§4.1) — knowledge D needs to avoid repeating the mistake.

**C is mostly parallel-safe.** C1 (rename) touches only copy + `FriendRow` + tests; it can land any time and is the lowest-risk item in the milestone (a good early confidence win). C2 (GizzVerse toggle) is the *first consumer* of A2 and therefore validates the mechanism on the easier surface — a single view with its own FAB affordance — before D depends on it in the live-show path. C3 (install) is independent of A/B entirely; its only real work is the `installPrompt` store hoist (§5.2).

**D after A2 + A4 + B.** It consumes the chrome mechanism (tabs hidden in-show), the portal fix (the overlay must escape `z.content`), and the animated `Sheet`. D3/D4 must follow D2 — the FAB action, the nudge retarget, the peek retarget, and the toast deep-link are all producers of the store D2 creates. This matches the backlog's own "do #3 after #2" sequencing note (`v2.1-ux-polish-backlog.md:35`).

**E after A2/A4, independent of D.** The fly-up needs `useChromeHidden()` for its spawn fallback and the portal for correct layering, but has zero coupling to the bingo overlays — so E can run in parallel with D once A lands. E is the item that rewrites shipped, device-verified Phase-20 code (`usePresence`, `WaveToast`), so it wants its own focused verification pass.

**F last.** F1 (deal icons) touches `DealScreen.tsx:68-83` only — but that is the file D1 extracts around, so sequencing it after D avoids a conflict. F2 (dates) is broad but shallow and conflicts with nothing.

### Suggested phase grouping (4 phases, matching the backlog's shape)

| Phase | Content | Rationale |
|-------|---------|-----------|
| 21 — Chrome & Layering Foundations | A1–A4 + C1 (rename) | The prerequisite everything else consumes; ships one visible win early |
| 22 — Surface Motion & Chrome Consumers | B + C2 + C3 | Sheet animation + first chrome consumer + install relocation |
| 23 — Immersive In-Show Experience | D1–D4 | Highest live-value item; depends on 21 + 22 |
| 24 — Reactions & Polish | E + F1 + F2 | Motion-forward reactions (own device UAT) + small visual items |

---

## Part 9 — Open Questions for Requirements

1. **In-show tab hiding scope** — app-wide while a show is active, or only while on `#/show`? App-wide strands the user with no navigation (§2.3). **Recommend `#/show`-scoped, plus an explicit reveal affordance.**
2. **`GizzDex → "Dex"` or `→ "Me"`?** The backlog and PROJECT.md disagree (§5.1).
3. **Which non-`<Sheet>` surfaces are in scope for the animation?** Seven hand-rolled overlays exist; `SearchSheet` and the `CometTrail` full-setlist sheet are the two in the live loop (§4.1 Trap 2).
4. **Escape-to-exit fullscreen?** If yes, it goes through `dialogStack` (§2.4).
5. **Core barrel export for the PRNG** — acceptable one-line additive change to `packages/core/src/index.ts`, or `Math.random` in the app with untestable drift? (§3.3)
6. **Does the share card follow the new date format?** (§6.1)
7. **Fly-up concurrency semantics** — how many simultaneous reactions before dropping, and does `QUEUE_CAP` (`config.ts:806`) still mean anything? (§3.4)
8. **Bottom-gap verification** — device measurement before deleting `styles.css:220`, per the UX-01 precedent (§6.2).

---

## Sources

All findings are grounded in files read directly from this working tree on 2026-07-24 — HIGH confidence:

- `packages/app/src/App.tsx`; `components/{AppShell,BottomTabBar,Sheet,WaveToast,BingoCelebration,AppMenu,InstallBanner}.tsx`; `components/a11y/{dialogStack,inertRoot,useFocusTrap,useDialogDismiss}.ts`
- `packages/app/src/show/{ShowView,FabMenu,BingoPeekStrip,StartShowNudge,SearchSheet,CometTrail,fabLayout,useShowSession}.tsx|ts`
- `packages/app/src/games/{GamesView,DealScreen}.tsx`
- `packages/app/src/sync/{presenceActivity,presenceSync,usePresence,usePresenceReaders}.ts`
- `packages/app/src/dex/{DexView,FriendRow,ReactionPalette,CompareView,FriendDetail,formatMonYear,ShowsList,SetlistView}.tsx|ts`
- `packages/app/src/explore/{ExploreView,NodeSheet,useVisibleViewportHeight,ConstellationCanvas}.tsx|ts`
- `packages/app/src/{config.ts,styles.css,routing/useHashRoute.ts,pwa/bottomOverlayInset.ts,pwa/install/useInstallState.ts,settings/SettingsView.tsx}`
- `packages/core/src/bingo/prng.ts`; `packages/core/src/config.ts`; `packages/core/package.json`; `packages/core/test/purity.test.ts`
- `packages/app/test/{rebrand,sheet.a11y,configMirror}.test.*`; `packages/app/test/sync/*`; `packages/app/test/dex/friendPresence.test.tsx`
- `.planning/PROJECT.md`; `.planning/v2.1-ux-polish-backlog.md`

MEDIUM-confidence items (mechanism verified, symptom not device-reproduced): §4.2 stacking-context capture as the cause of the reported paint-over bug; §6.2 double bottom inset as the cause of the installed-PWA gap. Both should be confirmed on device before their fix plan is written — the same discipline UX-01/UX-04 followed.

---
*Architecture research for: v2.1 "UX/UI Polish" integration into the shipped Guezzer / Gizz With Friends PWA*
*Researched: 2026-07-24*
