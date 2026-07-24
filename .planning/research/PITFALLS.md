# Pitfalls Research

**Domain:** Adding immersive overlays, chrome-hiding, and motion-forward UI to a mature, device-verified mobile-first React 19 PWA used live at concerts (Guezzer / "Gizz With Friends", v2.1 "UX/UI Polish")
**Researched:** 2026-07-24
**Confidence:** HIGH for code-grounded pitfalls (read directly from this repo); MEDIUM-HIGH for iOS Safari behavior (verified against Apple Developer Forums + spec-level CSS behavior); flagged inline where reasoning is from convention only.

> Prior milestone research archived at `.planning/research/v2.0/PITFALLS.md`.

---

## How to read this document

Every pitfall below is scoped to **this** codebase. Where a claim is grounded in a file I read, the file and the mechanism are named so a planner can verify it in 30 seconds. Where a claim rests on external browser behavior, the source and confidence are stated.

**The organizing risk:** v2.1 adds zero new domain capability. Every requirement is a *modification to a shared surface that 7+ verified features already depend on*. The dominant failure mode is not "the new thing is wrong" — it is "the new thing silently unpicks a stitch in something that passed device UAT."

**Proposed phase labels** used throughout (from `.planning/v2.1-ux-polish-backlog.md`, with one addition):

| Label | Scope |
|-------|-------|
| **Phase 0 — Layout & Layer Foundation** | *(recommended addition)* installed-PWA bottom gap, the single-source bottom-inset math, the z-tier invariant test, the shared UTC date helper |
| **Phase A** | Immersive in-show overlays (#1 bingo deal, #2 bingo board via FAB, #3 toast deep-link, #4 hide tabs in-show) |
| **Phase B** | Reactions fly-up (#6) |
| **Phase C** | Navigation & chrome (#5 rename, #9 modular fullscreen toggle, #8 install relocation) |
| **Phase D** | Surface polish (shared `<Sheet>` enter/exit animation, bingo deal icons) |

**The single biggest roadmap implication in this document:** items #4 and #9 (chrome hiding) and the bottom viewport gap all mutate the *same* bottom-space arithmetic, which is currently duplicated across **seven** hard-coded sites. Doing them in separate phases without first collapsing that arithmetic into one source guarantees a "content under the tab bar" or "dead gap" regression. Hence the recommended **Phase 0**.

---

## Critical Pitfalls

### Pitfall 1: The bottom-space arithmetic is duplicated across seven sites — chrome-hiding silently breaks five of them

**What goes wrong:**
`4rem` (64px) — the BottomTabBar's button-area height — is hard-coded independently in seven places:

| Site | Form |
|------|------|
| `components/BottomTabBar.tsx:26` | `height: calc(4rem + env(safe-area-inset-bottom))` |
| `components/AppShell.tsx:75-77` | `paddingBottom: calc(4rem + env(safe-area-inset-bottom) + ${overlayInset}px)` |
| `components/InstallBanner.tsx:90` | `fixed inset-x-0 bottom-16` |
| `components/UpdateToast.tsx:33` | `fixed inset-x-0 bottom-16` |
| `components/BackupToast.tsx:71` | `fixed inset-x-0 bottom-16` |
| `components/WaveToast.tsx:168` | `fixed inset-x-0 bottom-16` |
| `show/fabLayout.ts:12-13` | `calc(env(safe-area-inset-bottom) + 64px + 16px)` |

When the chrome-hidden mechanism (#4 / #9) removes the tab bar, only the first two are obvious. The four `bottom-16` overlays and the FAB then float **64px above nothing** — a dead band at the bottom of a fullscreen constellation or a chrome-hidden show. Conversely, if you fix only the overlays and forget `AppShell`, `<main>` keeps reserving 64px and the orbit stage / constellation is 64px shorter than the screen for no reason.

Note also that the four toasts use `bottom-16` (**no** safe-area term) while `fabLayout` uses `env(safe-area-inset-bottom) + 64px`. These already disagree by one inset (~34px on a home-indicator iPhone) — the toasts overlap the top of the tab bar in standalone today.

**Why it happens:**
The number was correct and static for the whole life of the app, so no one had reason to centralize it. `bottomOverlayInset.ts` centralizes the *variable* part (transient overlay heights) but explicitly leaves the *static* tab-bar term to each call site.

**How to avoid:**
In **Phase 0**, before any chrome-hiding work: introduce a single source for the bottom reservation — e.g. `config.ui.BOTTOM_CHROME_PX = 64` plus a `useBottomChromeOffset()` hook that returns the CSS `calc` string, and returns `env(safe-area-inset-bottom)` alone when chrome is hidden. Migrate all seven sites to it. Do **not** add a `--bottom-chrome` CSS custom property *and* keep the JS constant — that recreates the drift in a new form; pick one (the JS-config route matches the existing `config.ui.z` idiom and the CLAUDE.md single-config rule).

**Warning signs:**
- After hiding chrome, the FAB or a toast sits with visible empty space beneath it.
- Content on a scrolling route (`dex`, `games`, `settings`) can be scrolled to a position where the last row sits under the tab bar, or stops ~64px short of it.
- `grep -rn "bottom-16\|4rem\|64px" packages/app/src` still returns more than one owner after the refactor.

**Phase to address:** **Phase 0** (must precede Phase A and Phase C).

---

### Pitfall 2: The installed-PWA bottom gap is a *double-counted* safe-area inset — and the "obvious" `dvh` fix is a documented iOS regression

**What goes wrong (diagnosis, HIGH confidence — arithmetic traced through the repo):**
The layout chain is:

- `styles.css:15-19` — `html, body, #root { height: 100% }`
- `styles.css:220` — `body { padding-bottom: env(safe-area-inset-bottom) }`
- Tailwind preflight applies `box-sizing: border-box` to `*`, including `body`.

Therefore `body`'s *border box* = viewport height, but its *content box* = `viewportH − inset`. `#root` (`height: 100%`) inherits `viewportH − inset`, and so does `AppShell`'s `h-full` root.

Meanwhile `BottomTabBar` is `position: fixed; bottom: 0` — fixed elements resolve against the **viewport**, not `body`'s content box. So its button area occupies `[viewportH − inset − 64px, viewportH − inset]`.

But `<main>` reserves `4rem + env(safe-area-inset-bottom)` *inside* a box that already ends at `viewportH − inset`. Content therefore ends at `viewportH − 64px − 2×inset`.

**Gap = exactly one `env(safe-area-inset-bottom)` (~34px portrait on a home-indicator iPhone).**

This appears in the **installed standalone PWA** and not in-browser because in Safari with its toolbar visible, `env(safe-area-inset-bottom)` reports `0` — [confirmed on Apple Developer Forums thread 716552](https://developer.apple.com/forums/thread/716552) (iOS 15+ changed this from iOS 14; unresolved as of last activity). In standalone there is no toolbar, so the inset is the real 34px and the double-count becomes visible.

This is the **exact structural twin** of UX-01, the doubled *top* inset fixed in Phase 13 (see `styles.css:217-219`, which documents "a body-level top inset would double it"). The bottom half of the same bug was never removed.

**The trap in the fix:** the instinctive modern answer is `h-dvh` / `100dvh`. Do not reach for it here:
1. `AppShell.tsx:28-37` already carries a hard-won comment explaining that `min-h-screen` (`100vh`) broke Start Show on-device, and that the `height: 100%` chain is deliberately the grounding mechanism.
2. iOS 26.0 shipped a regression where **`100dvh` full-screen overlays leave a gap at the bottom** — [Apple Developer Forums thread 803987](https://developer.apple.com/forums/thread/803987), reported fixed in the 26.1 beta, with no official resolution note. Swapping to `dvh` to fix a bottom gap can therefore *reintroduce* a bottom gap on some iOS builds. MEDIUM-HIGH confidence (single authoritative forum thread, multiple reporters, version-dated).

**How to avoid:**
Fix the double-count, not the unit. Pick **one** owner of the bottom safe-area inset and delete the other:
- **Recommended:** remove `padding-bottom: env(safe-area-inset-bottom)` from `body` (mirroring exactly what UX-01 did for `padding-top`), and let `BottomTabBar` (which already adds it at `BottomTabBar.tsx:27`) plus each fixed-bottom overlay self-apply it once. This keeps `height: 100%` grounded to the true viewport and preserves the `AppShell` reasoning verbatim.
- Keep `viewport-fit=cover` in `index.html` (already present, lines 5-8) — without it, `env(safe-area-inset-*)` is `0` everywhere and the whole scheme collapses.

Verify with a device screenshot on an **installed home-screen instance**, not in Safari — the bug is invisible in-browser by construction.

**Warning signs:**
- The gap measures ~34px in portrait and ~21px in landscape (matching the home-indicator inset) rather than an arbitrary value — that is the signature of an inset double-count.
- The gap disappears when the app is opened in Safari rather than from the home screen.
- The orbit stage / constellation canvas measures ~34px shorter than the visible screen in `ConstellationCanvas`'s `ResizeObserver` (`ConstellationCanvas.tsx:216-229`).

**Phase to address:** **Phase 0.** Must land before Phase A/C — chrome-hiding changes which element owns the bottom inset, so fixing the gap afterwards means fixing it twice, in two states.

---

### Pitfall 3: Renaming the tab labels breaks the **presence wire protocol** between friends on different builds

**What goes wrong:**
`sync/presenceActivity.ts` states it outright at lines 20-31:

> *"The presence tab tokens. These ARE the display labels (the brand names shown on a friend's presence dot), so no separate label map is needed."*

```ts
export type Tab = "LiveGizz" | "GizzVerse" | "GizzMap" | "GizzDex" | "GizzGames" | "idle";
export const ROUTE_TO_TAB: Record<Route, Tab> = { show: "LiveGizz", explore: "GizzVerse", map: "GizzMap", dex: "GizzDex", games: "GizzGames", settings: "idle" };
const TABS: ReadonlySet<Tab> = new Set([...]);          // the allow-list
```

These tokens are **broadcast over the `gizz-room` Supabase Realtime channel** and validated on receipt against the fixed `TABS` allow-list (`reduceActivity`, line 100: `if (!TABS.has(rec.tab as Tab)) continue`).

The app ships `registerType: 'prompt'` (never auto-update, by design — `vite.config.ts`). **Friends will therefore be on mixed builds during a residency run, which is the whole point of the prompt-based flow.** If item #5 renames these strings:

- A friend on the old build sends `{ tab: "GizzDex" }`. The new build's allow-list rejects it → `reduceActivity` returns `null` → **that friend shows online but with no activity**, silently.
- A friend on the new build sends `{ tab: "Me" }`. The old build rejects it identically.
- Nothing crashes, nothing logs. Presence degrades to blank for cross-version pairs — the exact class of "works on my device, mysteriously wrong on theirs" bug that took two quick-tasks and a two-device UAT to close at v2.0 close.

Note also: the backlog file says `GizzDex → Dex`; PROJECT.md line 40 says `GizzDex → Me`. **Resolve that discrepancy before writing requirements.**

**Why it happens:**
The rebrand precedent (`260716-wwj`) established "display labels only; routes, file paths, and Dexie keys stay untouched" — and `presenceActivity.ts` looks like neither a route nor a storage key, so it reads as safe to a find-and-replace. It is in fact a *third* category the precedent never named: **an inter-device wire value that happens to be rendered.**

**How to avoid:**
Split the token from the label — this is the change item #5 actually requires:
1. Keep `Tab` tokens **frozen forever** as the wire vocabulary (`"LiveGizz" | "GizzVerse" | ...`). Add a comment saying so.
2. Add `config.copy.presence.tabLabel: Record<Tab, string>` mapping token → display string; render through it in `FriendRow`/`FriendsList`.
3. Have `BottomTabBar` read the same label map, so the tab bar and the presence dot can never disagree (today they agree only by coincidence of using the same literals).
4. Make `reduceActivity`'s allow-list **forward-tolerant**: an unknown `tab` string should reduce to a neutral "online" activity, not be dropped — so the *next* rename is a non-event.

**Warning signs:**
- Two-device test: friend A on build N, friend B on build N−1 → one side's presence row shows the online dot but no activity text.
- `grep -rn "GizzDex\|GizzMap\|GizzGames\|LiveGizz" packages/app/src` returns a hit under `sync/` after the rename.

Extend `test/rebrand.test.ts` (which already guards `config.DB_NAME` against exactly this class of mistake) with an assertion that the `Tab` union in `presenceActivity.ts` is byte-unchanged.

**Phase to address:** **Phase C** — but the token/label split must be written as an explicit requirement, not left to the executor's judgment.

---

### Pitfall 4: The reaction fly-up needs an *anchor* that item #4 deletes

**What goes wrong:**
Item #6 says the emoji "flies up from whatever section the sender is currently on." On the *receiver's* screen, the only thing representing "the sender's section" is the bottom tab for that section. So the natural implementation anchors the fly-up's launch point to a tab-bar button's x-position.

But item #4 **hides the tab bar while a show is being tracked** — and a live show is precisely when reactions matter most. During tracking, every fly-up has no anchor: it launches from `x=0`, from a stale cached position, or from the centre, and the "conveys where they are" value proposition evaporates.

Second collision: the anchor data is `activityByUser` from presence. There is a race — a `broadcast` wave and a `presence` diff are independent messages on the same channel with no ordering guarantee. A friend who taps a reaction immediately after switching tabs will frequently have their wave arrive *before* their new presence state, so the emoji launches from the **previous** section.

Third collision: `deriveActivity` returns `{ tab: "idle" }` whenever the sender's tab is hidden (`presenceActivity.ts:80`, D-02). A sender whose phone locks between palette tap and send has no section at all.

**How to avoid:**
Decide the anchor semantics *in requirements*, not in code:
- Define an explicit fallback ladder: sender's tab anchor → the receiver's own screen-bottom-centre → nothing. Never a silent `x=0`.
- When chrome is hidden, do **not** animate from an invisible tab. Anchor to a fixed screen-bottom point and let the sender's *name* carry the "where" (the name is the load-bearing part; the x-position is decoration).
- Read the anchor from an **anchor-position registry** the tab bar publishes (same external-store idiom as `bottomOverlayInset.ts`), not from a DOM query at animation time — the tab bar may be mid-animation or unmounted.
- Better: piggyback the sender's tab **on the wave payload itself** rather than joining against presence. `WavePayload` is `{ from, to, emoji }` (`sync/presenceSync.ts:39-43`); an optional `tab?: Tab` removes the race entirely. **But** it must be validated in `validateWave` against the same allow-list (untrusted input), and must be *optional* so old builds still work — see Pitfall 3.

**Warning signs:**
- Reactions received during a tracked show launch from the same spot every time.
- Two-device test: switch tabs, immediately react → the emoji flies from the old tab.
- `validateWave` gains a field that isn't in its rejection list.

**Phase to address:** **Phase B**, with a hard dependency on Phase A's chrome-hidden state being queryable. If Phase B runs first, write the anchor ladder anyway and stub the chrome-hidden branch.

---

### Pitfall 5: A fullscreen overlay implemented as a hash route destroys three invariants at once

**What goes wrong:**
`routing/useHashRoute.ts` is a 39-line allow-list router. The tempting implementation of items #1/#2 is `navigate("bingo")` — add a route, render fullscreen. That breaks:

1. **The stated requirement itself.** The backlog says "keep the user *inside* the tracking experience instead of sending them to the GizzGames tab" and "never a tab jump" (PROJECT.md line 38). A route change unmounts `<ShowView/>`.
2. **Presence.** `deriveActivity` maps route → tab. A bingo route would either derive to `idle` (unmapped) or need a new `Tab` token — and every friend would see the user leave LiveGizz mid-show. Worse, `atShow: true` requires `route === "show"` (`presenceActivity.ts:82`), so friends would see them stop being at a show.
3. **Show state.** Unmounting `<ShowView/>` means `useShowSession` remounts on return. The wake-lock module's `showActive` flag is module-level and survives, but component-local tracking state does not.

`location.hash = "#/x"` also pushes a history entry, reachable in an installed standalone PWA only by the undiscoverable left-edge back swipe — not a control you want between a user and their setlist in a dark venue.

**How to avoid:**
Render the overlays as **view-state, never a route** — already the app's established precedent, used three times: the Friends segment in `DexView` (PROJECT.md Phase 19: *"a third `Friends` segment in `DexView` (view-state, never a route)"*), `SetlistView` (*"no new hash route"*), and `FriendDetail`. Reuse `<Sheet variant="fullscreen">` (`Sheet.tsx:75-87`), which already portals to `document.body`, sets `role="dialog"`, traps focus, wires Escape through the LIFO stack, and sits at `config.ui.z.sheet`.

**Warning signs:**
- `ROUTES` in `useHashRoute.ts` grows an entry during Phase A.
- `ROUTE_TO_TAB` grows an entry.
- A second device sees the tracking user's presence flip away from LiveGizz when they open the bingo board.

**Phase to address:** **Phase A.**

---

### Pitfall 6: `DealScreen` throws on a locked card — as an in-show overlay its buttons become silently dead

**What goes wrong:**
`games/DealScreen.tsx:35-58` does:

```ts
const show = (await getActiveShow()) ?? (await startShow());
...
await saveDraftCard({ sessionId: show.sessionId, card, ... });
```

and `db/db.ts:691-704` — `saveDraftCard` **throws** if `existing?.lockedAt != null` or the show is finalized. `handleDeal` has no `try/catch` and is called from an `onClick`, so the rejection is an unhandled promise rejection: **nothing happens on screen, no error, no toast.**

Today this is unreachable because `GamesView` is a state machine that renders `<DealScreen/>` only when the active session has *no* card (`GamesView.tsx:4-11`). Item #1 lifts `DealScreen` out of that state machine and onto the tracking UI. Since the card is locked at Start Show (BINGO-07), **during a tracked show the card is always locked** — so a naively-hoisted DealScreen overlay presents three big buttons that do nothing when tapped, in a dark venue, mid-show.

Secondary hazard: `startShow()` **throws** if a show is already active (`db.ts:528-532`). Two rapid taps pre-show race the `getActiveShow() ?? startShow()` sequence and the second throws identically.

**How to avoid:**
- Port the **state machine**, not the component. The overlay must reproduce `GamesView`'s draft / locked / no-card branching, or reuse `GamesView`'s top region directly.
- Wrap `handleDeal` in `try/catch` and surface a calm reason ("Card locked for tonight") rather than a dead tap. Every `db.ts` write helper that can throw and becomes newly reachable from a live-show surface needs this treatment.
- Disable the vibe buttons while a deal is in flight.

**Warning signs:**
- Tapping a deal vibe during a tracked show does nothing and logs nothing.
- Console shows `Unhandled promise rejection: Bingo card for session … is locked`.
- Two sessions appear for one night in `trackedShows`.

**Phase to address:** **Phase A.**

---

### Pitfall 7: Animating the chrome away with `transform` breaks every `position: fixed` descendant

**What goes wrong:**
The obvious implementation of "animates away the top bar + bottom tab bar" (#9) is `transform: translateY(...)` on `AppShell`'s root, or `will-change: transform` on a wrapper.

Per CSS spec, an element with a non-`none` `transform`, `filter`, `perspective`, `backdrop-filter`, `contain: paint/layout`, or a `will-change` naming any of those becomes the **containing block for `position: fixed` descendants**. The moment that property is non-`none`, every fixed child re-resolves against the transformed box instead of the viewport.

Inside `AppShell` that means: `BottomTabBar` (`fixed bottom-0`), and — via `<ShowView/>`/`<ExploreView/>` children — the Show-Mode FAB and its full-viewport scrim (`config.ui.z.fabScrim`), `ExploreFilterFab`, and the bingo peek strip's expanded panel. They will all jump, rescale, or clip at the instant the animation starts and again when it ends (because `transform: none` at rest vs. `translateY(0)` mid-animation are *different* in this respect — producing the very confusing "it only breaks while animating" symptom).

Portaled `<Sheet>` content is immune (it lives on `document.body`), which makes the bug look inconsistent and hard to attribute.

**How to avoid:**
- Animate the **chrome elements themselves** (`header`, `nav`), not their container. Both are leaf-ish; neither contains a `fixed` descendant.
- Animate `transform: translateY(±100%)` + `opacity` on those two elements only — compositor-only, no reflow.
- Do **not** animate `height`, `margin`, `padding`, or `max-height` on the header/nav, or `<main>`'s `paddingBottom`. Those are layout properties: on the show route `<main>` is a non-scrolling flex column whose `flex-1` child is the orbit stage, so animating its padding reflows and re-measures the stage every frame (see Pitfall 8).
- If a container-level transform is genuinely unavoidable, enumerate every `fixed` descendant before merging.

**Warning signs:**
- The tab bar or FAB visibly jumps/rescales at animation start and settles at the end.
- The FAB scrim no longer covers the full viewport during the transition.
- Symptoms appear only mid-animation and vanish at rest.

**Phase to address:** **Phase C** (item #9 owns the mechanism); **Phase A** consumes it.

---

### Pitfall 8: A chrome-hide animation fires `ResizeObserver` ~60×, reheating the constellation every frame

**What goes wrong:**
`ConstellationCanvas.tsx:216-229` measures its container with a `ResizeObserver` and pushes `{width, height}` into React state, passed to `<ForceGraph2D>`. A separate effect keyed on `[graphData, size.width, size.height]` (lines 228-250) re-applies charge/link forces and **explicitly calls `fg.d3ReheatSimulation()`**.

The GizzVerse fullscreen toggle (#9) is *specifically* about giving the constellation more area. If the chrome hides over a 200-300ms animation and the container grows over that interval, `ResizeObserver` fires every animation frame → ~15-20 React state updates → ~15-20 `d3ReheatSimulation()` calls → canvas re-renders on a mid-tier phone, mid-transition.

The layout is not destroyed (`onEngineStop` pinned every node's `fx/fy`, so reheats are positionally inert — the comment at line 236 confirms this), and `firstSettleRef` prevents a camera re-fit. So this is not a correctness bug. It is a **battery and jank** bug, in the one view where "settle and freeze / battery life at a multi-hour show" is the stated design driver (EXPL-06) — and directly adjacent to why directional-flow edge particles were dropped outright.

**How to avoid:**
- Do not let the constellation container's size change *continuously*. Two viable shapes:
  - **(a) Instant resize, animated chrome.** The chrome becomes `position: fixed` and slides out over the stage, so it stops occupying layout on frame 1. One `ResizeObserver` fire, one reheat. (Composes with Pitfall 7's "animate the chrome elements themselves.")
  - **(b) Debounce the measure.** Add a trailing debounce (~150ms, config-driven) inside the `ResizeObserver` callback so mid-animation frames coalesce into one settle. This also improves the existing address-bar-collapse path.
- Prefer (a).

**Warning signs:**
- Instrument `d3ReheatSimulation` with a counter in a dev build: toggling fullscreen should produce **1**, not fifteen.
- Visible stutter in the constellation during the toggle on mid-tier hardware.
- CPU stays elevated for the duration of the transition.

**Phase to address:** **Phase C.** Add the reheat-count assertion to Phase C's verification criteria.

---

### Pitfall 9: `useDialogDismiss` re-pushes on every render — an overlay that re-renders steals Escape from the sheet on top of it

**What goes wrong:**
`components/a11y/useDialogDismiss.ts`:

```ts
useEffect(() => {
  if (!active) return;
  pushDialog(onClose);
  return () => removeDialog(onClose);
}, [active, onClose]);
```

The effect depends on `onClose` **by identity**. If a caller passes an inline arrow (`onClose={() => setOpen(false)}`), the effect tears down and re-pushes on *every render* — moving that dialog to the **top** of the LIFO stack.

Today this is latent, because the app's dialogs are mostly leaf-ish and don't re-render while a second dialog is open. v2.1 makes it live:

- The Phase A bingo-board overlay will subscribe to `useLiveQuery(trackedEntries)` and re-render on **every logged song** — while a `SwapSheet` / `CatchUpSheet` / `SearchSheet` may be open on top of it.
- The Phase B fly-up layer causes app-level re-renders on every inbound reaction.

Result: **Escape closes the wrong dialog**, and `useFocusTrap`'s cleanup restores focus to the wrong trigger — regressing the A11Y-01 behavior verified with VoiceOver + external keyboard on iOS (PROJECT.md, Phase 8).

**How to avoid:**
- Harden `dialogStack.pushDialog` to be **order-preserving on re-push**: if the callback is already in the stack, leave it where it is. Cheap, local, makes every current and future caller correct by construction.
- *And* require `useCallback`-stable `onClose` for the new overlays (belt and suspenders).
- Extend `test/sheet.a11y.test.tsx` — which already has `"stacked modals: one Escape closes only the topmost"` — with a case that **re-renders the lower dialog** while the upper one is open, then presses Escape.

**Warning signs:**
- Escape (external keyboard) closes the bingo overlay rather than the search sheet on top of it.
- After closing the top sheet, focus lands somewhere unexpected.
- Only reproducible while a show is actively logging songs — i.e. only at a real show.

**Phase to address:** **Phase A** (harden the stack as its first slice, since Phase A is what makes it reachable).

---

### Pitfall 10: Focus restore targets an element that chrome-hiding just unmounted

**What goes wrong:**
`useFocusTrap` captures `document.activeElement` on open and calls `restoreTo.current?.focus?.()` on cleanup (`useFocusTrap.ts:45, 77`). If the captured trigger has since been **unmounted or `display:none`**, `.focus()` on a detached node is a silent no-op and the browser drops focus to `document.body`. A VoiceOver user is dumped to the top of the document; an external-keyboard user's next Tab starts from the beginning.

v2.1 creates three new ways for the trigger to vanish while a dialog is open:
1. The bingo overlay is opened from the FAB (#2). Hiding chrome, or the overlay unmounting `<ShowView/>`'s FAB, removes the trigger.
2. The bingo **toast** deep-link (#3) opens the overlay from a transient toast that auto-dismisses after `config.celebration.*_MS` — the trigger is gone within ~2s **by design**.
3. The install affordance moves from the top-right `AppMenu` (which unmounts on close) into Settings (#8).

**How to avoid:**
Add a restore fallback ladder to `useFocusTrap`: on cleanup, check `restoreTo.current?.isConnected`; if false (or `.focus()` leaves `document.activeElement === document.body`), fall back to an explicitly-supplied `restoreFocusRef`, then to a stable landmark (the app header, or `<main>`) — never to nothing. Expose `restoreFocusRef` as a new optional `SheetProps` field so the toast deep-link can name a durable target.

**Warning signs:**
- With an external keyboard: close the bingo overlay, press Tab — focus starts from the top of the document instead of near where you were.
- VoiceOver reads the app header on close instead of the trigger.

**Phase to address:** **Phase A** (deep-link case, #3); the Settings-relocation case is **Phase C**.

---

### Pitfall 11: Reaching for a body scroll lock — importing the classic iOS bug into an app that architecturally never had it

**What goes wrong:**
The standard reflex when adding a fullscreen overlay is `document.body.style.overflow = 'hidden'` or the `position: fixed` + saved-`scrollY` trick. The `position: fixed` variant is the well-known iOS Safari footgun: it resets scroll position, and restoring it on close is jumpy and unreliable ([jayfreestone](https://www.jayfreestone.com/writing/locking-body-scroll-ios/), [CSS-Tricks](https://css-tricks.com/prevent-page-scrolling-when-a-modal-is-open/)).

**This app does not have that bug, and must not acquire it.** `body` never scrolls: `html, body, #root { height: 100% }` plus `body { overscroll-behavior-y: none }` (`styles.css:15-19, 40-43`), and the scroll container is `<main class="flex-1 overflow-y-auto">` inside `AppShell`. Background non-interactivity is handled by `inert` on `#app-content` (`inertRoot.ts`) plus a `fixed inset-0` scrim — a strictly better mechanism, already verified with VoiceOver.

On the show/explore/map routes `<main>` doesn't even scroll (`scroll={false}`, `App.tsx:100`), so there is nothing to lock at all.

**How to avoid:**
Write it into the phase brief as a prohibition: **no `body`/`html` overflow or position mutation for overlays.** Overlays go through `<Sheet variant="fullscreen">`, which portals to `document.body` and relies on `inert` + scrim. If a new overlay needs internal scrolling, put `overflow-y-auto` + `overscroll-behavior: contain` on the overlay's own content box (the fullscreen variant already has `overflow-y-auto`).

Note: `overscroll-behavior` is supported in Safari 16+; search-result advice claiming otherwise is stale. The app already relies on it in production, device-verified.

**Warning signs:**
- Any diff touching `document.body.style`.
- The page visibly jumps to the top when an overlay opens or closes on iOS.
- The dex/games lists lose their scroll position after closing an overlay.

**Phase to address:** **Phase A** (state as a constraint in the phase brief).

---

### Pitfall 12: The gesture-suppressed orbit stage and a dismiss gesture will fight

**What goes wrong:**
`.orbit-stage` (and `.action-bar`, `.fab-menu`) carry `touch-action: manipulation; overscroll-behavior: none; user-select: none; -webkit-touch-callout: none` (`styles.css:29-37`), and `OrbitStage.tsx:212` additionally sets `touch-none`. This is a *functional* requirement — an accidental gesture that loses tracking state is a catastrophic, unrecoverable-in-the-moment failure.

Adding a swipe-down-to-dismiss gesture to the new fullscreen overlays (a natural bottom-sheet affordance, and a natural pairing with the Phase D sheet animation) puts a pan-gesture handler directly over that surface. Three specific collisions:

1. `touch-action: manipulation` does **not** disable panning. A vertical drag on the overlay will be interpreted by the UA as a scroll of whatever ancestor can scroll. On the show route nothing can, so the drag reads as nothing — but on `dex`/`games` (`<main>` scrolls) it will scroll the background *behind* the overlay while the user thinks they're dismissing it.
2. A `preventDefault()`-based drag handler requires a **non-passive** `touchmove` listener. React's synthetic `onTouchMove` is passive-by-default for `touchmove`/`wheel`; `preventDefault()` there is a silent no-op. Classic "works in the desktop emulator, does nothing on device."
3. A swipe-down that *misses* the overlay (because it dismissed mid-gesture) lands on the stage, where a tap is a **song log**. Half-dismissed + fat thumb = a spurious logged song.

**How to avoid:**
- **Simplest and safest for v2.1: do not add a swipe-dismiss gesture.** The requirement is "dismissible back to tracking," not "swipe-dismissible." A large, always-visible, thumb-reachable Close control satisfies it with zero gesture surface, matches the app's existing `<Sheet>` dismissal model (scrim tap + Escape + explicit control), and matches the dark-venue one-thumb reality.
- If swipe-dismiss is insisted upon: Pointer Events with `touch-action: none` on a **grab handle only** (not the whole overlay), `touchmove` attached via a `ref` + `addEventListener(..., { passive: false })`.
- Either way: the dismiss animation must not leave the overlay `pointer-events: auto` while transparent, or a tap intended for "close" passes through to the stage. Set `pointer-events: none` on the exit transition.

**Warning signs:**
- On device, a downward drag on the overlay scrolls the list behind it.
- `preventDefault` in an `onTouchMove` handler warns about a passive listener, or simply has no effect.
- A song appears in the trail immediately after dismissing an overlay.

**Phase to address:** **Phase A** for the overlays; **Phase D** for the shared `<Sheet>` enter/exit animation.

---

### Pitfall 13: "Nothing ever paints over an open sheet" directly contradicts a device-verified exception

**What goes wrong:**
The z scale (`config.ts:251-298`) is disciplined — every layer is config-sourced, and a grep for non-config `zIndex`/`z-[...]` in `packages/app/src` returns **zero** hits. It documents two hard-won regression guards inline (`page < sheetScrim` from WR-01; `fabScrim < fab` from CR-01).

It also documents **one deliberate above-sheet exception**:

```
focusedFab: 60   // D-03 exception: FilterFab lifted ABOVE the NodeSheet when a node is focused
```

This exists because A11Y-02 required "FilterFab never occluded by the NodeSheet peek." It is device-verified (Phase 8 UAT) and unit-locked by `test/explore/filterFabLift.test.tsx` — including a test literally named *"keeps focusedFab strictly above the sheet tier (no occlusion)."*

Implementing the "nothing ever paints over an open sheet" guarantee by demoting `focusedFab` below `sheet` will **fail that test** (good) — but the risk is that someone "fixes" the failing test instead, silently reverting a verified accessibility requirement.

**How to avoid:**
Write the requirement precisely: *nothing paints over an open **modal** sheet.* The `focusedFab` exception applies only to the **non-modal** NodeSheet (`modal={false}` — no scrim, no inert; `Sheet.tsx:38-40`). Encode it as an invariant test rather than prose:

```
every tier except focusedFab  <  sheetScrim
focusedFab                    >  sheet          // documented non-modal exception
page                          <  sheetScrim     // WR-01
fabScrim                      <  fab            // CR-01
celebration                   <  sheetScrim
toast                         <  sheetScrim
<every new v2.1 tier>         <  sheetScrim
```

Put it next to `test/configMirror.test.ts` (which already establishes the "assert a config invariant" idiom). Every new v2.1 layer (chrome-animation layer, fly-up layer, fullscreen overlay) must be added to the enumerated list, so forgetting to register a tier is a test failure, not a visual bug found at a show.

**Warning signs:**
- A diff that changes `focusedFab` or edits `filterFabLift.test.tsx`.
- A new overlay component with an inline `zIndex` literal or a Tailwind `z-*` class.
- Anything above `sheetScrim: 40` that isn't `sheet` or `focusedFab`.

**Phase to address:** **Phase 0** (write the invariant test) → enforced through **Phases A/B/C/D**.

---

### Pitfall 14: Chrome-hidden mode with no route, no browser chrome, and no escape hatch

**What goes wrong:**
In an installed standalone iOS PWA there is no address bar, no back button, no tab strip. The app has no routing library, and the overlays are (correctly, per Pitfall 5) view-state rather than routes, so the OS back gesture does nothing for them either. If the chrome-hidden state can be entered but its exit control is hidden by the animation itself, placed under the notch / home indicator, hover-only, or dependent on a gesture the stage suppresses (Pitfall 12), the user is stranded, in the dark, mid-show, with force-quit as the only recovery. Force-quit is survivable (crash-proof persistence restores the session, SHOW-11) but costs 10-20 seconds and the wake lock — exactly the failure class this app exists to prevent.

Two additional strandings specific to v2.1:
- **Screen reader / keyboard.** Hiding the tab bar removes the app's only navigation landmark. A VoiceOver user in chrome-hidden mode has no way to reach another section. `inert` is not involved — the nav is genuinely gone from the tree.
- **Persistence.** If the chrome-hidden flag is persisted (localStorage/Dexie) and the exit control has a bug, the user relaunches into the broken state permanently.

**How to avoid:**
- The exit control must be **always rendered, never animated out, ≥44px, inside the safe area** — e.g. a floating "exit fullscreen" chevron pinned top-right below `env(safe-area-inset-top)`. Give it an `aria-label` and make it the first focusable element in chrome-hidden mode.
- **Do not persist the chrome-hidden flag** across launches in v2.1. Session-scoped React state only — the same reasoning as `useInstallState.dismissed` being deliberately session-only (`useInstallState.ts:23-31`).
- For item #4, chrome-hiding is *derived* from `showActive`, not toggled — so the exit is End Show, an already-verified control. Ensure the derived and manual mechanisms compose: manually re-showing chrome during a show must be possible and must not re-hide on the next re-render.
- Provide a **keyboard/AT escape**: Escape in chrome-hidden mode restores chrome. Route it through the existing `dialogStack` so it respects LIFO (Escape must close an open sheet first, and only restore chrome when no dialog is open).

**Warning signs:**
- A hidden-chrome screenshot with no visible affordance in the top ~120px.
- VoiceOver rotor in chrome-hidden mode lists no navigation landmark.
- The chrome-hidden flag appears in `db.meta` or `localStorage`.

**Phase to address:** **Phase C** (mechanism), consumed by **Phase A**.

---

### Pitfall 15: `prefers-reduced-motion` bolted on afterwards — and the two ways it half-works

**What goes wrong:**
The reduced-motion fallback is a **hard requirement** for item #6 (PROJECT.md line 46). Two failure shapes are common, and the codebase already demonstrates the correct antidote to both:

1. **Default-animated, motion stripped conditionally.** Writing `animation: fly-up 1s` as the base rule and then `@media (prefers-reduced-motion: reduce) { animation: none }` means every keyframe added later is animated-by-default and must be *remembered* in the reduce block. The repo's established idiom is the inverse — **default is static; motion is added only inside `@media (prefers-reduced-motion: no-preference)`** — used consistently for `.show-bg-fade-layer`, `.orb-breathe`, `.orb-float`, `.orb-ripple`, `.bingo-oneaway-glow`, `.explore-bg-bloom` (`styles.css:51-203`). `.orb-ripple` even documents the subtle bit: it defaults to `opacity: 0` so the reduced path doesn't render the ring as a static border.
2. **JS-side motion that ignores the media query.** `useReducedMotion()` from `motion/react` is the app's JS-side idiom (`WaveToast.tsx:94`, `BingoCelebration`). It returns `boolean | null` — the app correctly writes `?? false`. A new call site that mishandles the `null`, or that reduces only the *distance* rather than the *duration*, still animates.

Additional trap specific to item #6: a fly-up whose reduced-motion fallback is "fade in place" may still be *positioned* by the anchor logic and therefore still convey nothing. Decide what the reduced path actually communicates.

**How to avoid:**
- CSS: use the `no-preference` gating idiom exclusively. Add a test that greps `styles.css` for `@media (prefers-reduced-motion: reduce)` and fails — the repo has zero today.
- JS: the reduced path must change **duration to ~0 AND remove translation**, matching `WaveToast.tsx:164-166` (`initial={reduce ? {opacity:0} : {opacity:0, y:8}}`).
- For #6 specifically: **the reduced-motion fallback should be the existing `WaveToast`.** Do not delete `WaveToast.tsx` — retarget it as the reduced-motion presentation. This de-risks the whole item: if the fly-up disappoints on device, the fallback is a one-line flip, and it doubles as a battery kill-switch.
- Test with `matchMedia` stubbed both ways. `test/components/WaveToast.test.tsx` and `test/explore/filterFabLift.test.tsx` (`"uses no transition under prefers-reduced-motion"`) already establish the pattern.

**Warning signs:**
- Any new `@media (prefers-reduced-motion: reduce)` block.
- A new animation with no corresponding reduced-motion test case.
- `WaveToast.tsx` deleted rather than repurposed.

**Phase to address:** **Phase B** (owns #6); **Phase D** for the sheet enter/exit animation.

---

### Pitfall 16: The fly-up layer runs per-frame JS all show, or floods on foreground

**What goes wrong:**
Three distinct hazards in one feature:

1. **Per-frame JS.** A fly-up implemented with `requestAnimationFrame` position updates, or a physics/particle library, runs main-thread JS for the duration of every reaction. During a multi-hour show with 5 friends that is continuous main-thread work on a screen that is *held awake by a wake lock and cannot idle*. The app's own precedent is explicit: `ExploreBackground`'s ambient bloom is documented as "a pure compositor layer: it runs **NO per-frame JS** and never touches/reheats the d3 sim" (`styles.css:177-179`), and directional-flow particles were **dropped outright** in v2.1 for exactly this reason (PROJECT.md, Key Decisions).
2. **Timer throttling on background → flood on foreground.** `WaveToast`'s FIFO drain is a `setTimeout` chain (`WaveToast.tsx:110-148`). iOS suspends/throttles timers in a backgrounded PWA. Reactions received while backgrounded queue up and the drain resumes on foreground — potentially replaying a burst of stale reactions minutes later. (Same class as the `visibleEpoch` Realtime staleness fixed at v2.0 close.) `QUEUE_CAP` bounds it but doesn't make it *timely*.
3. **No coalescing across senders.** `QUEUE_CAP` bounds the buffer, but 5 friends spamming the palette (there is deliberately **no send-rate limit** — D-08) still produce a serialized queue of `TOAST_MS + DRAIN_GAP_MS` each. A fly-up layer that runs them concurrently solves the queueing but replaces it with N simultaneous animations.

**How to avoid:**
- **Compositor-only motion.** CSS keyframes on `transform` + `opacity`, `will-change: transform`, spawned as N short-lived DOM nodes that self-remove on `animationend`. No `rAF` loop, no per-frame React state. This is the `.orb-float` / `.explore-bg-bloom` idiom, already proven on-device.
- **Clear the queue on `hidden`.** Drop the pending buffer on `visibilitychange → hidden` — a reaction is ephemeral presence, not a message; replaying it 20 minutes late is worse than dropping it. Reuse the `useVisibilityHidden` hook already in `sync/`.
- **Cap concurrency, not just the queue.** Add `config.presence.MAX_CONCURRENT_FLYUPS` (3-4) with over-cap drop, alongside `QUEUE_CAP`. Both in `config.ts` — no magic numbers (CLAUDE.md).
- **Do not** mount the fly-up layer inside the constellation's React subtree, or anywhere that re-renders `<ConstellationCanvas/>`. Mount it once at `App.tsx` alongside `<WaveToast/>` (the established D-11 app-level-host idiom) so a reaction can never trigger a `graphData` rebuild or a `d3ReheatSimulation()`.

**Does this interfere with the frozen simulation or the Wake Lock?**
- **Simulation:** No — *if* the fly-up layer is a sibling of `<AppShell>` at `App.tsx` and uses CSS-only motion. `react-force-graph-2d` re-renders only when its props change, and `d3ReheatSimulation()` is called from exactly one effect keyed `[graphData, size.width, size.height]`. A sibling compositor animation touches none of those. It *would* interfere if the layer were rendered inside `<ExploreView/>` and caused a container resize, or if it used an `rAF` loop competing with the canvas draw loop for frame budget. (MEDIUM-HIGH confidence — grounded in component code, not device-measured.)
- **Wake Lock:** No direct interaction. `wakeLock.ts` is entirely event-driven (`visibilitychange` + sentinel state), with no timers or frame dependency; animation cannot release it. The real coupling is indirect and worth stating plainly: **the wake lock guarantees the screen never sleeps, so any CPU your animation burns is burned for the entire show with no idle recovery.** That is the actual battery argument, and it is why compositor-only is non-negotiable here.

**Warning signs:**
- `requestAnimationFrame` appears in the fly-up implementation.
- React DevTools shows renders in `<ExploreView/>` or `<ConstellationCanvas/>` when a reaction arrives.
- Background the app 5 minutes, foreground it → a burst of old reactions plays.
- Safari Web Inspector Timeline shows JS activity during a fly-up rather than pure compositing.

**Phase to address:** **Phase B.**

---

### Pitfall 17: Safe-area insets under a fullscreen overlay and under hidden chrome

**What goes wrong:**
`env(safe-area-inset-*)` is a property of the **viewport**, not of any element. It does not change when you hide the app's own chrome or open a fullscreen overlay. Two symmetric mistakes follow:

1. **Overlay ignores the insets.** `<Sheet variant="fullscreen">` currently renders `fixed inset-0 overflow-y-auto bg-surface` with **no safe-area padding at all** (`Sheet.tsx:78-82`) — it relies on the consuming view (`CompareView`) to supply its own header padding. A new bingo-board overlay that doesn't do the same will put its close button under the Dynamic Island and its bottom row under the home indicator. The `bottom-sheet` variant *does* handle it (`paddingBottom: calc(env(safe-area-inset-bottom) + 32px)`, line 104) — so the two variants have different contracts, and only one is documented.
2. **Double-counting after chrome hides.** The UX-01 rule is "each top-anchored surface applies `env(safe-area-inset-top)` **once**" (`styles.css:217-219`). Today `AppShell`'s `<header>` is the single top-inset owner on most routes (`AppShell.tsx:42`). When the header animates away, whatever becomes the new topmost element must take over the inset — and give it back when the header returns. If both apply it during the transition you get the doubled-inset bug Phase 13 fixed, but only for ~250ms, which reads as a "jump" rather than a layout bug.

Also relevant: in **Safari (non-standalone)** with the toolbar visible, `env(safe-area-inset-bottom)` is `0` and only becomes non-zero when the toolbar hides ([Apple Forums 716552](https://developer.apple.com/forums/thread/716552)). Any layout tuned in Safari will be wrong in standalone, and vice versa. **All viewport/inset verification for v2.1 must be done on an installed home-screen instance.**

**How to avoid:**
- Give `<Sheet variant="fullscreen">` an explicit, documented safe-area contract — either it applies all four insets itself (preferred; the bottom-sheet variant sets the precedent) or its prop docs state loudly that the consumer must. Pick one and make `CompareView` conform.
- Own the top inset in exactly one place per state. The cleanest shape: the header keeps `env(safe-area-inset-top)` and, when hidden, is `transform`-translated out — its box still exists and still owns the inset, it just isn't visible — so no other element ever needs to take over. This composes with Pitfall 7.
- Add to Phase C's UAT: rotate to landscape in chrome-hidden mode with an overlay open. Landscape moves the insets to left/right; `body` already pads `env(safe-area-inset-left/right)` (`styles.css:221-222`), but a `fixed inset-0` overlay bypasses `body` padding entirely.

**Warning signs:**
- Close button partially under the Dynamic Island on an installed instance.
- The header appears to "jump down then settle" when chrome is restored.
- Landscape: overlay content clipped by the notch on the left edge.

**Phase to address:** **Phase 0** (fullscreen-variant contract) → **Phase A** (overlays) → **Phase C** (chrome states).

---

### Pitfall 18: Relocating the install affordance strands the one-shot `beforeinstallprompt` event — and there is no iOS equivalent

**What goes wrong:**
`pwa/install/useInstallState.ts` captures `beforeinstallprompt` in a `useEffect` and stashes it in a `useRef` **local to each hook instance** (lines 41, 48-57). Every component that calls `useInstallState()` gets its own ref. Whichever instance is mounted when the browser fires the event is the only one that can ever call `prompt()`.

Chromium fires `beforeinstallprompt` **once**, early, on page load — long before the user opens Settings. Today this works because `<InstallBanner/>` is mounted unconditionally in `App.tsx:119` and captures it at boot. Move the affordance into `SettingsView` (which mounts only on `#/settings`) and:
- The Settings instance's `deferredRef` is **always `null`** — the event fired before it mounted.
- `canInstall` is `false`, so the Android install button either never renders or renders and does nothing.

Second hazard: `prompt()` **requires transient user activation** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt), [w3c/manifest#691](https://github.com/w3c/manifest/issues/691)). It must be called from a click handler; any `await` before `prompt()` can consume or expire the activation. The current `promptInstall` is clean (`await deferred.prompt()` first) — keep it that way.

Third: **iOS has no `beforeinstallprompt` at all.** WebKit has not implemented it ([WebKit/standards-positions#619](https://github.com/WebKit/standards-positions/issues/619)). The iOS path is and remains **instructional only** — the 3-step Share → Add to Home Screen sequence, already implemented as `IosInstallInstructions.tsx` + `IosShareGlyph.tsx`. There is no way to trigger the sheet programmatically. So relocating to Settings is *fine for iOS* (static copy) and *broken for Android* unless the event capture is hoisted.

Fourth: `isStandalone()` gating means the whole affordance renders nothing once installed — so after the owner installs, the new Settings section will look empty. Decide whether that's intended (probably: show a calm "Already installed" line rather than nothing).

**How to avoid:**
- Hoist the `beforeinstallprompt` capture to a **module-level singleton** registered at app boot (the same "capture at boot into a module store" shape as `dialogStack.ts` / `bottomOverlayInset.ts`), and make `useInstallState` a `useSyncExternalStore` reader over it. Then any surface — banner, menu, Settings — can consume it whenever it mounts.
- Keep `promptInstall` free of pre-`prompt()` awaits.
- Keep the iOS path purely instructional; never render a fake "Install" button on iOS.
- Preserve `<InstallBanner/>`'s once-per-build gate (`installBannerSeenVersion` meta, guarded by `test/installBannerVersion.test.tsx`) — item #8 removes the *menu* entry, not the banner.

**Warning signs:**
- On Android, Settings shows no install button even though Chrome's own menu offers "Install app."
- `test/installBannerVersion.test.tsx` or `test/platform.test.ts` starts failing.
- A console warning about `prompt()` requiring user activation.

**Phase to address:** **Phase C.**

---

### Pitfall 19: The shared date helper changes share-card PNG text and six test fixtures

**What goes wrong:**
The v2.1 item replaces raw-ISO renders with "Mon D, YYYY". The raw-ISO render sites are:

| Site | Context |
|------|---------|
| `dex/ArchiveBrowser.tsx:209` | list row |
| `dex/ArchiveBrowser.tsx:249` | **`aria-label`** on the unmark confirm |
| `dex/SetlistView.tsx:129` | **`aria-label`** on the view container |
| `dex/SetlistView.tsx:148` | header |
| `dex/ShowsList.tsx:234` | list row |
| `show/ShowView.tsx:515` | active-show header |
| `dex/RecapView.tsx:219` | `copy.subline(show.date, venue)` |
| `dex/shareCard.ts:193, 424` | **rendered into a canvas PNG** |
| `dex/bingoShareCard.ts` | same, via the bingo trophy card |

Three consequences:

1. **Canvas overflow.** `shareCard.ts` composes `${date} · ${venue}` onto a fixed-width galaxy canvas with measured layout, tuned against the ISO format. `"2026-08-14 · Red Rocks Amphitheatre"` becomes `"Aug 14, 2026 · Red Rocks Amphitheatre"` — marginally longer with different font metrics. Share cards are a shipped, device-verified feature (BINGO-08, DEX share card).
2. **Test fixtures break.** `test/showsList.test.tsx:130-131` asserts `getByText("2025-05-01")` literally. `test/archiveBrowser.test.tsx`, `test/recapView.test.tsx`, `test/shareCard.test.tsx`, and `test/dex/bingoShareCard.test.ts` all seed and assert ISO dates. Expect ~6 test files to need updating — fine, but it must be **budgeted**, and each change scrutinized: a test updated to match a wrong output is worse than a failing test.
3. **`aria-label` semantics.** Two sites use the raw date as an accessible name. Changing them changes what VoiceOver announces — arguably an improvement, but it must be a deliberate decision, not a side effect.

Also: **`attendanceKey()` keys unbound sessions by `date#session`** (SAFE-04, in `packages/core`) and `ShowsList.tsx:64` builds `date:${date}` keys. A date *formatting* change must never touch these. Blind find-and-replace on `.date` is the hazard.

**How to avoid:**
- Put the helper next to `dex/formatMonYear.ts` (or in core) and **copy its exact discipline**: `new Intl.DateTimeFormat("en-US", { ..., timeZone: "UTC" })` with a NaN guard returning the input unchanged (`formatMonYear.ts:7-16`). The UTC pinning is the whole point — `new Date("2026-08-14")` parses as UTC midnight, which renders as **Aug 13** in any negative-offset timezone. `formatMonYear`'s doc comment already records this exact failure ("a `2025-01-01` never slips to `Dec 2024`").
- Change **display only**. Add a test asserting `attendanceKey`, `ShowsList`'s row key, and the Dexie `showDate` field still carry raw ISO — mirroring `test/rebrand.test.ts`'s `DB_NAME` guard.
- **Decide explicitly** whether share-card PNGs adopt the new format. Recommendation: yes for consistency, but verify the rendered PNG on device at the widest realistic venue name, and check the truncation path.
- Consider using the formatted string for both the visible text and the `aria-label` so they match.

**Warning signs:**
- A date renders one day earlier than the setlist says (timezone slip — the UTC guard is missing).
- Share-card footer text clips or overlaps the wordmark.
- A test was "fixed" by loosening an assertion rather than updating the expected string.

**Phase to address:** **Phase 0** (helper + display-only guard test). Prefer Phase 0 so the helper exists before any new surface renders a date.

---

### Pitfall 20: Animating the shared `<Sheet>` regresses seven-plus verified surfaces at once

**What goes wrong:**
`<Sheet>` currently has `if (!open) return null` (line 63), documented as a preserved V7/T-08-04 guard. Adding an exit animation requires the sheet to **stay mounted while animating out** — i.e. deleting or deferring that early return. That single change ripples into every a11y guarantee:

- **Focus-trap cleanup fires late.** `useFocusTrap`'s cleanup restores focus on unmount. Defer unmount by 250ms and focus restoration is deferred 250ms — during which the background is *still* `inert` (the ref-count hasn't decremented) and focus is inside an element animating away. A keyboard user pressing Tab in that window is in an undefined state.
- **`inert` release is deferred.** `setRootInert(false)` runs in the same cleanup. The background is non-interactive for the whole exit animation — taps during the exit are swallowed. In a live-venue context that is a lost song log.
- **Escape double-fire.** The dismissing sheet is still on the `dialogStack` during the exit; a second Escape re-invokes `onClose`, and combined with the re-push bug (Pitfall 9) the stack ordering during an exit animation is genuinely hard to reason about.
- **The `!open` guard was load-bearing.** It is annotated as a robustness guard ("a closed or error sheet renders nothing and never throws"). Whatever replaces it must preserve that.

The dependent surfaces — all verified with VoiceOver + external keyboard on iOS (A11Y-01) — now number more than the original seven: SearchSheet, TrailNodeSheet, EndShowDialog, NodeSheet (non-modal), AppMenu, SwapSheet, CatchUpSheet, PinSheet, AvatarSheet, ShareCardSheet, FriendDetail.

**How to avoid:**
- Use `AnimatePresence` from `motion/react` (already a dependency, already the idiom in `WaveToast`/`BingoCelebration`), and **decouple the a11y lifecycle from the visual lifecycle**: drive `useFocusTrap`/`useDialogDismiss`'s `active` from the *logical* `open` prop, not from mounted-ness. Then `inert` releases, focus restores, and the dialog leaves the stack **immediately on close**, while the DOM lingers for the animation with `pointer-events: none` and `aria-hidden`.
- Keep exits short (≤200ms) and `motion-safe`-gated.
- **Re-run the full `test/sheet.a11y.test.tsx` suite plus a device re-verification of A11Y-01 as an explicit phase exit criterion.** This is the single change in v2.1 most likely to silently regress verified accessibility, and unit tests around `AnimatePresence` are prone to passing because the test environment collapses timings.

**Warning signs:**
- Any test in `sheet.a11y.test.tsx` needs a `waitFor` added where it previously ran synchronously — that is the signal that a11y *timing* changed, not just rendering timing.
- Tapping the background immediately after closing a sheet does nothing.
- Focus restoration visibly lags the close.

**Phase to address:** **Phase D** — and it should be the phase's *first* slice, so there is room to back it out.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code `64px` again in each new chrome-aware surface | No refactor needed to ship #4 | Eight sites instead of seven; the next chrome change is worse | **Never** — Phase 0 exists to prevent this |
| Make the bingo overlay a hash route | Free back-gesture, free deep-link for #3 | Breaks presence `atShow`, unmounts `ShowView`, violates the stated "never a tab jump" requirement | Never |
| Fix the standalone bottom gap with `h-dvh` | One line, "modern" | Contradicts the `AppShell` reasoning; iOS 26.0 `dvh` gap regression; leaves the real double-count in place | Never — fix the double-count |
| Rename `Tab` tokens in `presenceActivity.ts` directly | One file, done | Cross-build presence silently degrades for the friend group | Never |
| Delete `WaveToast.tsx` when shipping the fly-up | Cleaner diff | Loses the ready-made reduced-motion path, the rollback, and the battery kill-switch | Never — retarget it |
| Persist the chrome-hidden flag | "Remembers my preference" | A bug in the exit control becomes permanent across launches | Only after the exit control is device-verified; not in v2.1 |
| Swipe-down-to-dismiss on overlays | Feels native | Fights `touch-action`, passive-listener trap, risks spurious song logs | Only with a dedicated grab handle + non-passive listener; prefer an explicit Close control |
| Update failing date tests to the new string without inspecting | Fast green suite | A wrong format gets locked in; a timezone slip ships | Only after checking each expected string against the seeded ISO |
| Skip the installed-standalone device check because it "looks fine in Safari" | Saves a tunnel setup | The whole bottom-inset bug class is invisible in Safari by construction | Never for viewport/inset work |
| Keep `<Sheet>`'s `if (!open) return null` and animate only the enter | Zero a11y risk | Asymmetric motion reads slightly unfinished | **Acceptable** as an interim if Phase D runs short — ship enter-only rather than a risky exit |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Realtime `gizz-room` (presence) | Renaming `Tab` tokens as if they were display labels | Freeze the tokens as wire vocabulary; add a separate `tabLabel` map; make `reduceActivity` forward-tolerant to unknown tabs |
| Supabase Realtime `gizz-room` (waves) | Adding a *required* field to `WavePayload` for the fly-up anchor | Additive **optional** field, validated in `validateWave`, with a fallback for old builds that omit it |
| Service worker (`registerType: 'prompt'`) | Assuming all friends run the same build | Every wire-format change must be forward- and backward-tolerant; mixed builds are the *designed* state |
| Dexie (`bingoCards`, `trackedShows`) | Calling `saveDraftCard`/`startShow` from a new surface without handling their `throw` | Wrap every newly-reachable write helper; surface a calm reason, never a dead tap |
| `beforeinstallprompt` (Chromium) | Capturing it in a component that mounts late (`SettingsView`) | Capture once at app boot into a module store; read via `useSyncExternalStore` |
| iOS install | Building an "Install" button that does nothing on iOS | Instructional-only path (`IosInstallInstructions`); WebKit has not implemented `beforeinstallprompt` |
| Screen Wake Lock | Assuming an animation layer can affect it | It cannot — but it *does* mean the screen never idles, so animation CPU is spent for the whole show |
| `react-force-graph-2d` | Letting an animated container drive `ResizeObserver` frame-by-frame | Resize once (chrome goes `fixed` immediately) or debounce the measure |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `d3ReheatSimulation()` per animation frame during the fullscreen toggle | Stutter during the toggle; elevated CPU for the transition | Instant container resize, or debounce the `ResizeObserver` callback | Immediately on mid-tier hardware; worse on the full catalog (~264 nodes) |
| `rAF`-driven fly-up animations | Main-thread work every frame a reaction is on screen; battery drain across a 3-hour show that cannot idle (wake lock held) | CSS keyframes on `transform`/`opacity`, self-removing nodes on `animationend` | At 2+ concurrent reactions on mid-tier hardware; compounds over show duration |
| `setTimeout`-driven queue drain while backgrounded | Reactions replay minutes late on foreground | Drop the pending buffer on `visibilitychange → hidden` | Any time the phone is pocketed — i.e. constantly at a show |
| No concurrency cap on fly-ups | 5 friends spamming produce a screen full of emoji or a long serialized queue | `MAX_CONCURRENT_FLYUPS` (3-4) with over-cap drop, in `config.ts` | At 5 friends × repeated taps — the exact designed usage |
| Fly-up layer mounted inside `ExploreView`/`ShowView` | A reaction re-renders the constellation or the orbit stage | Mount once at `App.tsx` (the D-11 host idiom) | Immediately, on any tab with a heavy canvas mounted |
| Animating `height`/`padding` for chrome hide | Layout thrash; orbit stage re-measures each frame | `transform: translateY` on the header/nav elements only | Immediately on mid-tier hardware |
| Bingo overlay subscribing to `useLiveQuery` while a sheet is open on top | Dialog-stack ordering churn (Pitfall 9) | Order-preserving `pushDialog` + `useCallback`-stable `onClose` | Only during active logging — i.e. only at a real show |

---

## Security Mistakes

v2.1 is presentation work; the meaningful security surface is unchanged. Three remain live:

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering a sender-supplied name/emoji in the fly-up instead of re-resolving from the trusted store | A peer could inject arbitrary display text app-wide | Copy `WaveToast.tsx:85-91` exactly: resolve `displayName` from `getSyncState().friends` by `from` userId; never read a name off the payload. Escaped React text only, never `dangerouslySetInnerHTML` |
| Adding an anchor field to `WavePayload` without extending `validateWave` | Untrusted string reaches layout/animation code | Validate the new field against the same fixed `Tab` allow-list; malformed → drop the field, never the whole wave, never a throw |
| Making `reduceActivity` forward-tolerant and then *rendering* the unknown token | A peer could inject arbitrary text into the presence row | Forward-tolerant means "map unknown → a neutral known label," never "render the received string" |
| Adding a route for the overlays | `useHashRoute`'s allow-list is documented as the phase's one live security control (T-03-02) | Keep overlays as view-state; do not grow `ROUTES` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Chrome-hidden mode with a subtle or auto-hiding exit control | Stranded in the dark mid-show; force-quit costs the wake lock and ~20s | Always-rendered ≥44px exit control, top-right inside the safe area, first in tab order |
| Overlay dismiss control only at the top of a fullscreen sheet | Unreachable one-thumb on a large phone | Mirror the FAB's thumb zone: dismiss reachable in the bottom third, or duplicated |
| Fly-up motion over the orbit stage during logging | Distracts from / obscures the prediction orbs at the moment of decision | Bound the fly-up to a band (e.g. upper third), `pointer-events: none`, below the `sheet` tier. Consider suppressing broadcast (non-targeted) reactions entirely while `atShow` |
| Tab rename that leaves long names in copy elsewhere | "Live" in the tab bar, "GizzGames" in a heading — reads unfinished | Sweep `config.copy` as part of #5: `games.sectionHeading: "GizzGames"` (`config.ts:1201`), the peek-strip aria-label (`config.ts:1293`) |
| Bingo overlay opened from a toast that already auto-dismissed | Tap lands on nothing | Keep the toast alive while its action is on screen, or extend the toast duration for *actionable* toasts specifically |
| Hiding tabs during a show with no visual acknowledgement | User thinks the app broke | Animate out (not cut); make the return on End Show equally animated so the state reads as intentional |
| "Install" section in Settings that renders nothing once installed | Looks like a broken/empty section | Render a calm "Already installed" confirmation instead of `null` |
| Date format changed in-app but not on share cards | Friend-group screenshots disagree with the app | Change both; verify the PNG on device |

---

## "Looks Done But Isn't" Checklist

- [ ] **Fullscreen bingo overlay:** often missing the *state machine* (deal vs. draft vs. locked) — verify tapping a deal vibe during a **locked, actively-tracked** show produces a calm message, not a dead tap
- [ ] **Fullscreen bingo overlay:** often missing safe-area padding (the `fullscreen` Sheet variant supplies none) — verify the close button clears the Dynamic Island on an **installed** instance
- [ ] **Bingo toast deep-link:** often missing the case where the toast auto-dismisses before the tap, and the focus-restore target that vanishes with it
- [ ] **Hide tabs in-show:** often missing 4 of the 7 bottom-offset sites — verify the FAB, InstallBanner, UpdateToast, BackupToast and WaveToast all sit flush with the bottom when chrome is hidden
- [ ] **Hide tabs in-show:** often missing the AT path — verify VoiceOver has *some* navigation affordance in chrome-hidden mode
- [ ] **Chrome-hidden toggle:** often missing the `fixed`-descendant containing-block check — verify the FAB and tab bar don't jump *during* the transition, not just at rest
- [ ] **Chrome-hidden toggle (GizzVerse):** often missing the reheat count — verify one `d3ReheatSimulation()` per toggle, not fifteen
- [ ] **Reactions fly-up:** often missing the reduced-motion path as a *real* path — verify with `matchMedia` forced to `reduce` that a genuinely static presentation renders
- [ ] **Reactions fly-up:** often missing the backgrounded case — verify a 5-minute background does not produce a burst on foreground
- [ ] **Reactions fly-up:** often missing the anchor fallback — verify a reaction received during a tracked show (tabs hidden) launches from a sane point
- [ ] **Sheet enter/exit animation:** often missing the a11y/visual lifecycle split — verify `inert` clears and focus restores at *close*, not at unmount, and that a background tap immediately after close registers
- [ ] **Sheet enter/exit animation:** often missing device re-verification — A11Y-01 was verified with VoiceOver + external keyboard; a mount-lifecycle change invalidates that verification
- [ ] **Tab rename:** often missing `presenceActivity.ts` (wire tokens) and `config.copy` headings — verify with a cross-build two-device presence test
- [ ] **Install relocation:** often missing the boot-time event capture — verify on Android that the Settings install button actually installs
- [ ] **Date helper:** often missing UTC pinning and the persisted-key guard — verify a `2026-01-01` show renders as *Jan 1, 2026* in a negative-offset timezone, and that `attendanceKey`/Dexie keys still carry raw ISO
- [ ] **Bottom viewport gap:** often "fixed" in Safari where the bug doesn't exist — verify on an **installed home-screen** instance, portrait *and* landscape
- [ ] **Every new layer:** often missing a `config.ui.z` tier — verify the z-invariant test enumerates it

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bottom-offset drift after chrome hide | LOW | Collapse to the single source retroactively; the seven sites are all one-liners |
| Standalone bottom gap "fixed" with `dvh` | LOW-MEDIUM | Revert to the `height: 100%` chain, remove the body `padding-bottom`, re-verify on device |
| `Tab` tokens renamed and shipped to some devices | MEDIUM | Add the token↔label split *and* forward-tolerance, then have every friend accept the update prompt. Until then presence is degraded, not broken — no data loss |
| Overlay shipped as a hash route | MEDIUM | Convert to view-state; `ROUTES`/`ROUTE_TO_TAB` revert cleanly, but every deep-link/back-gesture affordance built on it must be rebuilt |
| `<Sheet>` animation regressed a11y | MEDIUM-HIGH | Reverting to `if (!open) return null` (enter-only) is cheap. The *detection* is expensive — it needs a VoiceOver + keyboard device session. Budget the device re-verification as part of the phase, not after |
| Fly-up drains battery at a real show | HIGH (discovered at the worst moment) | Ship the reduced-motion `WaveToast` path as a runtime kill-switch (a Settings toggle or a `config` flag), so recovery is one setting, not a rebuild at a venue |
| Focus stranded after chrome-hide | MEDIUM | Add the restore fallback ladder to `useFocusTrap`; affects all sheets, so re-run `sheet.a11y.test.tsx` |
| Date format broke share cards | LOW | Share cards are regenerated on demand; revert the formatter at the two `shareCard.ts` call sites only |
| Chrome-hidden flag persisted with a broken exit | HIGH | Requires a build to clear. **Prevention is the only real strategy** — do not persist it in v2.1 |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Seven-site bottom-offset drift | **Phase 0** | `grep` returns exactly one owner; chrome-hidden screenshot shows no dead band under any overlay |
| 2. Standalone bottom-inset double-count | **Phase 0** | Installed home-screen instance, portrait + landscape; gap measures 0 |
| 13. Z-tier invariant | **Phase 0** | New invariant test enumerating every tier; `filterFabLift.test.tsx` still green and unmodified |
| 17a. `fullscreen` Sheet safe-area contract | **Phase 0** | Prop docs state the contract; `CompareView` conforms |
| 19. Date helper (UTC + display-only) | **Phase 0** | Negative-offset TZ test; persisted-key guard test mirroring `rebrand.test.ts` |
| 5. Overlay-as-route | **Phase A** | `ROUTES` unchanged; two-device presence shows `atShow` held while the overlay is open |
| 6. `DealScreen` throws on locked card | **Phase A** | Device: tap each deal vibe during a locked tracked show → calm message |
| 9. Dialog-stack re-push | **Phase A** | New `sheet.a11y.test.tsx` case: re-render the lower dialog, Escape closes the upper |
| 10. Focus restore to a vanished trigger | **Phase A** / **C** | Keyboard: close the toast-deep-linked overlay, Tab lands near where you were |
| 11. Body scroll lock | **Phase A** | No diff touches `document.body.style`; dex scroll position survives an overlay round-trip |
| 12. Dismiss-gesture collision | **Phase A** | Device: drag on the overlay does not scroll the background and never logs a song |
| 4. Fly-up anchor vs. hidden chrome | **Phase B** | Reaction received during a tracked show launches from the defined fallback point |
| 15. Reduced-motion afterthought | **Phase B** / **D** | `matchMedia` forced to `reduce`: static presentation renders; zero `@media (prefers-reduced-motion: reduce)` blocks in `styles.css` |
| 16. Per-frame JS / queue flood / spam | **Phase B** | No `rAF` in the diff; 5-min background → no foreground burst; concurrency cap in `config.ts` |
| 3. Tab rename breaks the wire protocol | **Phase C** | Cross-build two-device presence test; `rebrand.test.ts` extended to guard the `Tab` union |
| 7. `transform` breaks `fixed` descendants | **Phase C** | Device: FAB and tab bar do not jump *during* the transition |
| 8. ResizeObserver reheat storm | **Phase C** | Instrumented reheat counter reads 1 per toggle |
| 14. Stranded in chrome-hidden mode | **Phase C** | Screenshot shows the exit control; VoiceOver has a navigation affordance; flag is not persisted |
| 17b. Safe-area ownership across chrome states | **Phase C** | Header does not "jump" on restore; landscape overlay clears the notch |
| 18. `beforeinstallprompt` stranded | **Phase C** | Android: Settings install button actually installs |
| 20. `<Sheet>` animation regresses 7+ surfaces | **Phase D** (first slice) | Full `sheet.a11y.test.tsx` green **without** added `waitFor`s; VoiceOver + external-keyboard device re-verification of A11Y-01 |

---

## Roadmap Implications

1. **Add a Phase 0.** Five pitfalls (1, 2, 13, 17a, 19) are shared-foundation work that Phases A and C both consume. Doing them inside A or C means doing them twice, in two layout states. Phase 0 is small — bottom-inset single source, z-invariant test, fullscreen-Sheet safe-area contract, UTC date helper — and de-risks everything after it.
2. **Item #9 (modular chrome-hide) must land before item #4 (hide tabs in-show).** The backlog's phase shape has them reversed (A before C). Either move #9 into Phase A or move #4 into Phase C. The owner already decided they are one mechanism (PROJECT.md, Key Decisions) — the phase shape should reflect that.
3. **Item #5 (rename) is not a cosmetic change.** It touches an inter-device wire protocol under a deliberately-mixed-build deployment model. Requirements must call out the token/label split explicitly.
4. **Item #6 should retarget `WaveToast`, not replace it.** That single decision supplies the mandated reduced-motion fallback, a rollback path, and a battery kill-switch for free.
5. **Every viewport/inset acceptance check must run on an installed home-screen instance.** The bug class is invisible in Safari by construction; the existing cloudflared HTTPS tunnel setup already supports this.
6. **Phase D's sheet animation is the highest-regression-risk item in v2.1 relative to its user value.** Consider shipping enter-only animation if the phase runs short — asymmetric-but-safe beats a deferred `inert` release at a show.

---

## Sources

**Codebase (HIGH confidence — read directly, 2026-07-24):**
- `packages/app/src/components/{AppShell,BottomTabBar,Sheet,WaveToast,InstallBanner,UpdateToast,BackupToast}.tsx`
- `packages/app/src/components/a11y/{dialogStack,useDialogDismiss,useFocusTrap,inertRoot}.ts`
- `packages/app/src/{App.tsx,config.ts,styles.css,wakeLock.ts}`
- `packages/app/src/sync/{presenceActivity,presenceSync}.ts`
- `packages/app/src/pwa/{bottomOverlayInset.ts,install/useInstallState.ts}`
- `packages/app/src/{routing/useHashRoute.ts,show/fabLayout.ts,show/OrbitStage.tsx,explore/ConstellationCanvas.tsx,explore/useVisibleViewportHeight.ts}`
- `packages/app/src/{games/DealScreen.tsx,games/GamesView.tsx,db/db.ts,dex/formatMonYear.ts,dex/shareCard.ts}`
- `packages/app/{index.html,vite.config.ts}`
- `packages/app/test/{rebrand,sheet.a11y,configMirror,showsList,archiveBrowser,explore/filterFabLift}.test.*`
- `.planning/PROJECT.md`, `.planning/v2.1-ux-polish-backlog.md`

**iOS Safari / PWA behavior (MEDIUM-HIGH confidence — dated, authoritative-forum evidence):**
- [Apple Developer Forums 716552 — `safe-area-inset-bottom` returns 0 when the Safari toolbar is hidden (iOS 15+ change from iOS 14; unresolved)](https://developer.apple.com/forums/thread/716552) — grounds *why the bottom gap appears in standalone but not in-browser*
- [Apple Developer Forums 803987 — post-Oct-2025 iOS: `100dvh` full-screen overlays leave a gap at the bottom; reported fixed in the 26.1 beta](https://developer.apple.com/forums/thread/803987) — grounds *do not reach for `dvh` to fix a bottom gap*
- [MDN — `BeforeInstallPromptEvent.prompt()`](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt) and [w3c/manifest#691 — circumstances in which `prompt()` may be called](https://github.com/w3c/manifest/issues/691) — transient-activation requirement
- [WebKit/standards-positions#619 — `BeforeInstallPromptEvent`](https://github.com/WebKit/standards-positions/issues/619) — WebKit has not implemented it; iOS install is instructional-only
- [Locking body scroll for modals on iOS — Jay Freestone](https://www.jayfreestone.com/writing/locking-body-scroll-ios/) and [Prevent Page Scrolling When a Modal is Open — CSS-Tricks](https://css-tricks.com/prevent-page-scrolling-when-a-modal-is-open/) — the `position: fixed` scroll-restore bug this app must not acquire
- [The Large, Small, and Dynamic Viewports — Bram.us](https://www.bram.us/2021/07/08/the-large-small-and-dynamic-viewports/) — `svh`/`lvh`/`dvh` semantics

**Reasoning from spec/convention (flagged, MEDIUM confidence — verify on device before relying on it):**
- `transform`/`filter`/`will-change` creating a containing block for `position: fixed` descendants (Pitfall 7) — CSS Transforms spec behavior, universally implemented; not device-verified in this app
- React synthetic `touchmove`/`wheel` handlers being passive by default (Pitfall 12) — well-established React behavior
- iOS timer throttling in backgrounded PWAs (Pitfall 16) — consistent with the `visibleEpoch` WebSocket-suspension behavior already device-verified in this repo, but the specific timer behavior is inferred, not measured

---
*Pitfalls research for: immersive-overlay / chrome-hiding / motion-forward additions to a shipped live-venue PWA (Guezzer v2.1)*
*Researched: 2026-07-24*
