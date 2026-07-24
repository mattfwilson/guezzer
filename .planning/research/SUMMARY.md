# Project Research Summary

**Project:** Guezzer / "Gizz With Friends"
**Milestone:** v2.1 "UX/UI Polish"
**Domain:** UI/motion/chrome polish inside a shipped, device-verified, offline-first mobile PWA (React 19 + Vite 8 + Tailwind 4), used one-thumb, in the dark, at live shows
**Researched:** 2026-07-24
**Confidence:** HIGH (four independent researchers converged; every structural claim is grounded in a file read this session)

## Executive Summary

v2.1 adds **zero new domain capability**. Every one of the 12 backlog items is a modification to a shared surface that seven-plus already-verified features depend on. All four researchers reached the same conclusion independently: **the dominant risk is regression, not build difficulty.** The app is already show-ready and device-verified; the way v2.1 fails is not "the new thing is wrong" but "the new thing silently unpicks a stitch in something that passed device UAT" (VoiceOver + external keyboard a11y, the installed-PWA safe-area math, the cross-device presence wire protocol).

The stack answer is unusually clean: **add nothing.** `motion` 12.42.2 is already installed *and already load-bearing* in four shipped modules (`WaveToast`, `BingoCelebration`, `OrbitStage`, `ShowView`), so its ~34 kB is already paid for - every new use costs 0 bytes. `<Sheet variant="fullscreen">` already ships in production on four surfaces with focus trap, `inert`, LIFO Escape, and portal-to-body. The date helper is six lines. The z-fix is a test. Net new dependencies: **zero**; the only recommended package change is pinning `motion` exact (it is the sole caret-ranged runtime dep). The tool split is per-use-case, not blanket: `motion`/`AnimatePresence` for sheets, full-screen overlays, and the reaction fly-up (the exit animation on a `if (!open) return null` + portal contract is the hard part, and `AnimatePresence` is the only clean answer); **CSS transitions only** for the chrome hide/show, because its debut surface is GizzVerse where `react-force-graph-2d` owns the main thread and a composited `translateY` costs ~0 while a JS spring costs frames.

Two findings reshape the milestone's structure. First, **the Fullscreen API does not exist on iPhone Safari** (verified: no `safari_ios` implementation entry), and an installed standalone PWA has no browser chrome to hide anyway - so backlog item #9's "fullscreen toggle" is *necessarily* an in-app chrome-hide, collapsing #9 and #4 (hide tabs in-show) into one mechanism. Second, **that shared chrome mechanism is the milestone keystone and the backlog's phase order inverts its dependency**: the tab-bar-height / bottom-inset arithmetic is hard-coded in seven-to-nine independent places in four different notations that *already disagree with each other by one safe-area inset*, and three separate consumers (in-show tab hiding, the GizzVerse toggle, and the reaction fly-up's spawn anchor) all depend on it - yet the backlog schedules it in Phase C, after both consumers. Three of four researchers independently recommended a **foundation phase first**. That same arithmetic is where the installed-PWA bottom-gap bug lives (a double-counted `env(safe-area-inset-bottom)`, the exact structural twin of the shipped Phase-13 UX-01 top-inset fix), so fixing it inside the foundation phase is strictly cheaper than fixing it twice in two layout states.

## Key Findings

### Recommended Stack - "add nothing"

See `.planning/research/STACK.md`.

**Core technologies (all already installed):**
- **`motion` 12.42.2** - sheet enter/exit, full-screen overlay enter/exit, reaction fly-up. Already the codebase idiom in 4 shipped files; `AnimatePresence` is the only clean exit-animation path for the portal + closed-renders-null contract. **Pin exact** (currently the only caret-ranged runtime dep).
- **CSS transitions (Tailwind 4.3.2 + `styles.css`)** - chrome hide/show only. Two-state, always-mounted, interruptible, composited; the repo already has the `@media (prefers-reduced-motion: no-preference)` idiom in 6 blocks.
- **Existing `<Sheet variant="fullscreen">`** - the bingo deal + board overlays. Already portals to body, traps focus, wires LIFO Escape and ref-counted `inert`, sits at `z.sheet` (50). A second overlay primitive would fork expensively-validated a11y.
- **`useSyncExternalStore` + module store** - the chrome-hidden state, the show-overlay state, the hoisted `beforeinstallprompt` capture. Mirrors the shipped `usePresence`/`progressSync`/`bottomOverlayInset` engine-to-reader idiom (D-16). Not zustand, not context.
- **Pure-string date helper (no `Date`, no `Intl`)** - inputs are canonical `YYYY-MM-DD`; skipping both removes all timezone and ICU-version surface. Can live in `packages/core` (passes the purity scan) and be reused by the CLI reports.
- **`lucide-react` 1.23.0 (installed)** - all candidate deal-type icons verified present in the installed `.d.ts`. No upgrade needed.

**Explicitly rejected native platform APIs** (all availability-verified against webstatus.dev): Fullscreen API (**impossible on iPhone**), View Transitions (not interruptible; hostile to a live canvas), Popover API and `<dialog>` (duplicate a validated primitive for zero gain), `@starting-style`/`allow-discrete` (available, but conflicts with `<Sheet>`'s closed-renders-nothing contract - keep in the back pocket), CSS anchor positioning (Baseline `limited`, and the sender is on *another device* so there is no local element to anchor to), `interpolate-size`/`calc-size()` (**no Safari implementation at all**), `interactive-widget` meta (Safari ignores it entirely).

### Expected Features

See `.planning/research/FEATURES.md`.

**Must have (table stakes):**
- Shared `useChromeVisibility` / `chromeHidden` mechanism exposing the reserved bottom height - **the keystone; L complexity; 4 consumers.**
- Every bottom-anchored surface reads the reserved height instead of a `4rem`/`bottom-16`/`64px` literal.
- Bingo board + bingo deal as full-screen overlays, `ShowView` never unmounting; view-state, **never a route**.
- A visible, labelled, >=44px close control that is always on screen; Escape; back-gesture dismissal via a pushed history entry (Android back *and* iOS standalone edge-swipe both exist).
- Tabs auto-hide during a tracked show **with a persistent reveal affordance that latches open for the session** - a mode must be escapable; the user must reach Map without ending the show.
- Hidden chrome removed from the accessibility tree (`inert`/`hidden`, not just translated off).
- GizzVerse toggle whose exit control is in the same place as the entry, always visible, never auto-faded.
- Presence-anchored reaction fly-up with an explicit anchor fallback ladder, receive-side concurrency cap + per-sender burst coalescing, optimistic local echo, and a throttled `aria-live` announcement (position carries the payload and position is invisible to a screen reader).
- Tab display rename with **wire tokens frozen** + a `TAB_DISPLAY_LABEL` map.
- Toast deep-link action on badge/supernova tiers only, dwell extended to 6-8s, timer paused on focus/pointer, gated on a permanent path existing.
- Sheet enter/exit animation in the ONE primitive; z-tier ordering invariant test; UTC-safe "Mon D, YYYY" helper; ordinal (never color-coded) difficulty icons; install instructions moved to Settings, hidden when installed.

**Should have (differentiators):** a labelled "Back to show" close chip instead of a bare X; suppressing bingo toasts while the bingo overlay is open; the in-show spatial rule (reactions confined to the outer 25% margins at <=0.85 opacity so nothing crosses the orbit); a sender-identity-colored name pill; a brief pulse on the sender's tab icon; chrome state resetting on tab change and cold boot; a neutral one-line "Install to home screen" row kept in `AppMenu` deep-linking to Settings (preserves the 1-tap fallback at near-zero cost).

**Anti-features (actively harmful - do not build):** swipe-down-to-dismiss on the in-show overlays; edge-swipe to reveal chrome (collides with the OS back gesture on both platforms); timed auto-re-hide (moves a tap target under a reaching thumb - violates the founding "targets never move on their own" rule); persisting the chrome-hidden flag across launches; reaching the board via `navigate("games")`; a bottom sheet for the deal flow (produces sheet-on-sheet with `SwapSheet`); auto-presenting the deal overlay; an action button on mark-toasts or a whole-toast tap target; queuing over-cap reactions; sound; renaming the presence wire tokens; color-coded difficulty tiers; renumbering the z ladder speculatively.

### Architecture Approach

See `.planning/research/ARCHITECTURE.md`. Every v2.1 item is an *integration* into shipped code, not greenfield. The five invariants that must not break: core purity (statically scanned), the single-config rule, one pipeline per artifact, singleton engines mounted once at the shell with pure readers, and display labels decoupled from routes/storage keys.

**Major new components:**
1. **`chrome/chromeHidden.ts`** - a module store keyed by a **reason set** (`"fullscreen" | "inShow"`), not a boolean. Two independent producers must release independently; the project already solved the identical race with ref-counting in `inertRoot.ts`. Ships with a `useHideChromeWhile(reason, active)` registration hook whose cleanup auto-releases on unmount - which makes the in-show producer correct for free (tabs return the moment the user leaves LiveGizz).
2. **`config.ui.TAB_BAR_HEIGHT_PX` + a bottom-offset hook** - one source for the reservation, consumed by `AppShell`, `BottomTabBar`, `fabLayout`, and five `bottom-16` toasts. Tailwind v4 resolves arbitrary values at author-time, so a JS-config value *must* go through inline style (already documented policy).
3. **`games/BingoSessionPanel.tsx`** (extracted from `GamesView`) + **`show/InShowBingoOverlay.tsx`** + **`show/showOverlay.ts`** - one renderer, two hosts. The open/close state must be a module store because one producer (the celebration toast deep-link) lives in an App-level host outside `ShowView`'s tree.
4. **`components/ReactionFlyUp.tsx`** + a pure `sync/reactionSpawn.ts` geometry module - app layer, beside `presenceActivity.ts` (the exact precedent for "deliberately pure, but chrome-dependent, so not core"). The sender's tab is resolved from the **trusted presence store**, never read off the payload - extending the existing `WaveToast` security posture.
5. **`components/OverlayLayer.tsx`** (proposed) - a one-line portal primitive so every `fixed` overlay lives in the root stacking context.
6. **`pwa/install/installPrompt.ts`** - hoist the one-shot `beforeinstallprompt` capture to a module singleton, or the relocated Settings affordance is dead on Android forever.

### Critical Pitfalls

See `.planning/research/PITFALLS.md` (20 pitfalls, each code-grounded).

1. **The bottom-space arithmetic is duplicated across seven sites and already disagrees.** The four `bottom-16` toasts carry *no* safe-area term while `fabLayout` uses `env(...) + 64px` - they already differ by one inset (~34px) in standalone today. Hiding the chrome without collapsing this first leaves overlays and the FAB floating 64px above nothing. Fix: collapse to one source in the foundation phase; a grep must return exactly one owner.
2. **The installed-PWA bottom gap is a double-counted `env(safe-area-inset-bottom)`** - `body`'s border-box padding shortens `#root` by one inset while the `fixed` tab bar re-adds it. Invisible in a Safari tab (where the inset reports `0`), visible only in the installed instance. The structural twin of UX-01. Fix: delete `styles.css:220`; **do not reach for `dvh`** (iOS 26.0 shipped a `100dvh` bottom-gap regression, and `AppShell` already carries a hard-won comment about `100vh` breaking Start Show). Measure on an installed home-screen instance before *and* after.
3. **The tab rename edits an inter-device wire protocol.** `presenceActivity.ts` states outright that the `Tab` tokens ARE the display labels - and they are broadcast over `gizz-room` and validated against a fixed allow-list on receipt. Because the SW is `registerType: 'prompt'`, **mixed builds are the designed state**, so renaming tokens makes cross-version friend pairs show online with silently blank activity. Nothing crashes, nothing logs. Fix: freeze the tokens forever as wire vocabulary; add a `tabLabel` map consumed by the tab bar *and* every presence surface; make `reduceActivity` forward-tolerant (unknown maps to a neutral known label, never render the received string); extend `rebrand.test.ts` to guard the union byte-for-byte.
4. **The reaction fly-up's anchor is deleted by the feature that hides the tabs** - and a live show is exactly when reactions matter most. Plus a genuine race: `broadcast` and `presence` diffs are independent messages with no ordering guarantee, so a friend who reacts right after switching tabs launches from their *previous* section. Fix: define the fallback ladder in requirements (sender's tab, then screen-bottom-centre, then nothing; never a silent `x=0`); read from an anchor registry, not a DOM query at animation time. *(The researchers split on whether to add an optional `tab?` to `WavePayload` to kill the race - ARCHITECTURE rejects it as a new untrusted field, PITFALLS allows it if additive-optional and allow-list-validated. Owner/planner call.)*
5. **Animating the chrome via a container `transform` breaks every `position: fixed` descendant** - a non-`none` `transform`/`filter`/`will-change` becomes the containing block, so the tab bar, FAB, FAB scrim, `ExploreFilterFab`, and the peek panel jump *only while animating* and settle at rest. Fix: animate the `header` and `nav` elements themselves; never `height`/`padding`/`<main>`'s reservation.
6. **A chrome-hide animation fires `ResizeObserver` ~60x and calls `d3ReheatSimulation()` every frame** on the one screen whose entire design driver is settle-and-freeze battery life. Not a correctness bug (nodes are pinned) - a battery and jank bug. Fix: make the chrome `fixed` so it stops occupying layout on frame 1: one resize, one reheat. Instrument the counter and assert **1, not fifteen**.
7. **Animating the shared `<Sheet>` regresses 11+ VoiceOver/keyboard-verified surfaces at once.** Deferring unmount defers focus restore *and* the `inert` release - the background stays non-interactive through the exit, and a tap during that window is a lost song log. Fix: decouple the a11y lifecycle from the visual lifecycle - drive `useFocusTrap`/`useDialogDismiss` from the logical `open` prop so `inert` clears and focus restores at close-*start* while only pixels linger. Any `waitFor` newly required in `sheet.a11y.test.tsx` is a signal that a11y *timing* changed. Device re-verification is a phase exit criterion; enter-only animation is an acceptable interim fallback.
8. **`useDialogDismiss` re-pushes on every render** (it depends on `onClose` by identity), and v2.1 makes the latent bug live - the bingo overlay will subscribe to `useLiveQuery` and re-render on every logged song, while a `SwapSheet`/`SearchSheet` sits on top. Escape then closes the wrong dialog. Reproducible **only during active logging - i.e. only at a real show.** Fix: make `pushDialog` order-preserving on re-push; `useCallback`-stable `onClose`; add the re-render-the-lower-dialog test case.
9. **`DealScreen` throws on a locked card.** `saveDraftCard` throws if `lockedAt != null`, `handleDeal` has no try/catch, and the card is locked at Start Show - so a naively hoisted deal overlay presents three big buttons that do **nothing** when tapped, mid-show, in the dark. Fix: port the *state machine*, not the component; wrap every newly-reachable `db.ts` write.
10. **Chrome-hidden with no escape hatch** in an installed PWA (no address bar, no back button, overlays are view-state so the OS gesture does nothing) strands the user with force-quit as the only recovery - costing the wake lock and ~20 seconds. Fix: always-rendered >=44px exit control inside the safe area, first in tab order; do not persist the flag; Escape restores chrome via `dialogStack` so LIFO holds.

## Implications for Roadmap

The four researchers independently converged on **four phases with a foundation phase first** - which reorders the backlog's proposed A/B/C/D. ARCHITECTURE and PITFALLS produced nearly identical groupings; the one below merges them.

### Phase 1: Layout & Layering Foundations
**Rationale:** Everything else consumes this, and doing it later means doing it twice in two layout states. All four sub-items rewrite the *same* bottom math across `AppShell`, `BottomTabBar`, `fabLayout`, and five toasts - splitting them means touching those files twice and reconciling two half-migrations. The portal fix must precede anything that adds an overlay, or the new overlay inherits the stacking trap and the fix becomes a retrofit.
**Delivers:** `config.ui.TAB_BAR_HEIGHT_PX` + all 7-9 consumers migrated; the `chromeHidden` reason-set store + `AppShell` wiring; the installed-PWA bottom double-inset fix (measured on device before and after); the z-tier ordering invariant test; the `<Sheet variant="fullscreen">` safe-area contract decided and documented; the UTC-safe date helper. **Consider folding in the tab rename** - it is the lowest-risk item in the milestone and a good early confidence win.
**Addresses:** the chrome-visibility keystone; reserved-bottom-height threading; the z ordering assertion; the date helper.
**Avoids:** Pitfalls 1, 2, 13, 17a, 19.

### Phase 2: Surface Motion & Chrome Consumers
**Rationale:** The overlays must be built against the *final* `<Sheet>` primitive, not retrofitted after it gains animation. This phase also surfaces the four parent-gated call sites (`DexView` x2, `GamesView` swap, `CompareView`) that unmount `<Sheet>` outright and would never play an exit - knowledge the overlay phase needs. The GizzVerse toggle is the *first consumer* of the chrome mechanism and validates it on the easier surface (one view, its own FAB affordance) before the live-show path depends on it.
**Delivers:** `<Sheet>` enter/exit via `AnimatePresence` with the a11y/visual lifecycle split (**first slice, so there is room to back it out**); the 4 call-site conversions; the GizzVerse chrome toggle; the install-affordance relocation with the hoisted `beforeinstallprompt` module store.
**Uses:** `motion` (already installed), CSS transitions for the chrome, `useSyncExternalStore`.
**Avoids:** Pitfalls 7, 8, 14, 18, 20.

### Phase 3: Immersive In-Show Experience
**Rationale:** The milestone's headline live-value, and it depends on all of the above (the chrome mechanism, the portal fix, the animated primitive). The producers of the overlay store - FAB action, nudge retarget, peek retarget, toast deep-link - must follow the store's creation, matching the backlog's own "do #3 after #2" note.
**Delivers:** `BingoSessionPanel` extraction; `showOverlay` store + the fullscreen overlay host; FAB action + nudge/peek retarget; the celebration deep-link chip (with `pointer-events-auto` on the *button only*); in-show tab hiding + the reveal affordance; back-gesture dismissal.
**Avoids:** Pitfalls 5, 6, 9, 10, 11, 12.

### Phase 4: Reactions & Small Polish
**Rationale:** The fly-up needs the chrome mechanism for its fallback anchor and the portal for correct layering, but has zero coupling to the bingo overlays - so it can run in parallel with Phase 3 once Phase 1 lands. It is the item that rewrites shipped, device-verified Phase-20 code, so it wants its own focused device UAT. The deal icons touch the file Phase 3 extracts around, so sequencing them after avoids a conflict.
**Delivers:** the presence-anchored fly-up (retargeting `WaveToast` as the reduced-motion path, **not deleting it**); receive-side concurrency cap + burst coalescing + drop-on-hidden; the throttled `aria-live` channel; deal-type icons; app-wide date conversion.
**Avoids:** Pitfalls 4, 15, 16.

### Phase Ordering Rationale

- **The backlog's A-then-B-then-C order puts the reaction anchor's dependency after its consumer.** Three researchers independently flagged this. The chrome mechanism must land before both #4 (in-show tab hiding) and #6 (fly-up anchor fallback).
- **The bottom-gap bug and the chrome mechanism rewrite the same three files' bottom math** - two separate passes would collide, so they belong in one plan.
- **The tab rename is fully parallel-safe** and the lowest-risk item; land it early for a visible win, but write the token/label split as an explicit requirement rather than leaving it to executor judgment.
- **The `<Sheet>` animation is the highest-regression-risk item in v2.1 relative to its user value.** Make it the first slice of its phase so it can be backed out; enter-only animation is an explicitly acceptable degraded ship.

### Research Flags

Phases likely needing deeper research or a device spike during planning:
- **Phase 1** - the bottom-gap root cause is HIGH-confidence on the *mechanism* but MEDIUM on *completeness*. Needs an on-device measurement gate (a `#/dev/insets` diagnostic route, following the shipped `#/dev/orb-fit` precedent) before and after, on an **installed** instance, portrait *and* landscape.
- **Phase 4** - the fly-up motion parameters (travel, duration, drift, rotation, jitter) and the concurrency/coalescing caps are LOW confidence: reasoned from observed convention, no published spec exists. Instrument and tune on device; do not treat the numbers as established.

Phases with standard patterns (skip `--research-phase`):
- **Phase 2 and Phase 3** - every mechanism is an existing in-repo primitive with a documented precedent (`<Sheet variant="fullscreen">` on four shipped surfaces, the `bottomOverlayInset` module-store idiom, `AnimatePresence` in two shipped files). The work is composition and contract, not discovery.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Every version, peer range, and publish date verified via `npm view` + `package-lock.json`; every web-platform claim verified against the webstatus.dev API (MDN BCD). MEDIUM only on motion's self-published ~34 kB bundle figure. |
| Features | **MEDIUM-HIGH** | Platform conventions (iOS HIG, Material 3, Android immersive, NN/g overlay research, WCAG 2.2.1/2.3.3/2.5.3, web.dev) verified against primary or near-primary sources. Fly-up motion parameters and tab-label discoverability are LOW - flagged inline. |
| Architecture | **HIGH** | Every structural claim is cited path:line from a file read this session; no path inferred from planning notes. MEDIUM on two root-cause *hypotheses* not yet device-reproduced. |
| Pitfalls | **HIGH** code-grounded / **MEDIUM-HIGH** iOS | Repo-grounded items are HIGH; iOS Safari behavior rests on dated Apple Developer Forums threads + spec-level CSS. Three items explicitly flagged as reasoning-from-spec, not device-verified. |

**Overall confidence:** HIGH on what to build and in what order; MEDIUM on two device-observable symptoms whose *mechanism* is understood but whose *completeness* needs a measurement.

### Gaps to Address

**Resolved since research (record and correct the source):**
- **GizzDex becomes "Me", not "Dex".** The backlog (`v2.1-ux-polish-backlog.md:41`) says "Dex"; PROJECT.md line 40 says "Me". **The owner has confirmed "Me".** The backlog file needs correcting. FEATURES flags a real consequence: "Me" does not signal that *friends* live behind that tab (post-v2.0 `DexView` holds Dex + Albums + Friends). Recommendation carried forward: pair "Me" with a friends-presence badge on the tab icon, which both fixes the discoverability hole and finally pays off the presence layer.

**Genuine disagreement between researchers - resolve before writing the z-layer requirement:**
- **Is the z-layer problem structural or numeric?** ARCHITECTURE finds a `position: relative; z-index: 10` stacking context in `ShowView.withBackground` that captures *every* `fixed` descendant - so `FabMenu` (nominally 30), `SearchSheet` (50), and the FullSetlistSheet (40) all composite at 10, and any root-level toast (20) or the supernova (18) paints over them. HIGH confidence on the CSS mechanism, MEDIUM that it is the owner's reported symptom. PITFALLS finds the opposite framing: every z-index is config-sourced (zero raw literals), the tier ordering is internally consistent, toasts and celebrations are *already* below `sheetScrim`, and the only above-sheet tier is the deliberate, device-verified, unit-locked `focusedFab: 60` exception - so the real observed defect is **unidentified**, and renumbering risks silently reverting two documented regression guards (`page < sheetScrim`, `fabScrim < fab`) or an A11Y-02 requirement.
- **These two findings are in TENSION. What resolves it:** a device repro of "something paints over an open sheet" naming the actual offending surface. If the offender is inside `ShowView`'s subtree, ARCHITECTURE is right and the fix is portal-everything; if it is a root-level toast over a *modal* sheet, the tier list needs one addition. Both researchers agree on the safe common ground: **write the invariant test first, renumber nothing speculatively**, and phrase the requirement as *"nothing paints over an open modal sheet"* so the non-modal `focusedFab` exception survives.

**Open, needing an owner decision or a repro:**
- **Swipe-down-to-dismiss on the in-show overlays** - recommended **against** by both FEATURES and PITFALLS, on four independent grounds (not the full-screen convention; collides with scrolling the board; `touch-action: manipulation` does not disable panning, and React's synthetic `onTouchMove` is passive by default so `preventDefault()` is a silent no-op on device; a half-dismissed drag landing on the stage logs a spurious song). Does the owner accept the recommendation? If not, the safe thresholded spec exists (grab-handle only, `scrollTop === 0`, >=25% travel or >0.5px/ms, non-passive listener via a ref).
- **In-show tab-hiding scope** - app-wide while a show is active, or only while on `#/show`? App-wide strands the user with no route to GizzMap at a venue. Recommendation: show-route-scoped, plus an explicit reveal affordance that latches open for the session.
- **Does the share card adopt the new date format?** `shareCard.ts` draws the date into a fixed-width canvas PNG tuned against the ISO string; the formatted string has different metrics. Recommendation: yes for consistency, but verify the rendered PNG on device at the widest realistic venue name and check the truncation path. Roughly 6 test files seed/assert ISO dates and will need budgeted updates - each scrutinized, since a test loosened to pass is worse than a failing one.
- **Fly-up motion parameters and battery cost are reasoned, not measured.** Tune and instrument on device. The mitigation is already decided: **retarget `WaveToast` rather than delete it**, which supplies the mandated reduced-motion fallback, the rollback path, and a battery kill-switch in one decision.
- **Should the wave payload carry the sender's tab?** ARCHITECTURE says no (a wire change AND a new untrusted field in the render path); PITFALLS says yes-if (additive, optional, allow-list-validated, tolerant of old builds) because it kills the presence/broadcast ordering race outright.
- **Escape-to-exit chrome-hidden?** If yes it must route through `dialogStack` so Escape closes the topmost sheet first - the one legitimate non-dialog use of the stack.
- **Core barrel export for the PRNG** (a one-line additive change so the fly-up drift is deterministic and unit-testable) vs. `Math.random` in the app with untestable drift.

**Must be verified on device, not in a browser tab:**
- Every viewport/inset check must run on an **installed home-screen instance** - the whole bug class is invisible in Safari by construction (`env(safe-area-inset-bottom)` reports `0` with the toolbar visible).
- The `<Sheet>` animation invalidates the A11Y-01 verification (VoiceOver + external keyboard on iOS). Budget the re-verification *inside* the phase, not after.
- Cross-build two-device presence test for the tab rename.
- Android: confirm the relocated Settings install button actually installs.

## Sources

### Primary (HIGH confidence)
- **This repository, read directly (2026-07-24)** - `Sheet.tsx`, `AppShell.tsx`, `BottomTabBar.tsx`, `WaveToast.tsx`, `BingoCelebration.tsx`, `config.ts` (z tiers 251-297), `styles.css`, `presenceActivity.ts`, `presenceSync.ts`, `usePresence.ts`, `ConstellationCanvas.tsx`, `GamesView.tsx`, `DealScreen.tsx`, `db.ts`, `useInstallState.ts`, `fabLayout.ts`, `useHashRoute.ts`, `formatMonYear.ts`, `shareCard.ts`, both `package.json` files, `package-lock.json`, and the test suite (`rebrand`, `sheet.a11y`, `configMirror`, `filterFabLift`)
- **npm registry** (`npm view`, 2026-07-24) - all versions, peer ranges, publish dates
- **api.webstatus.dev/v1/features** (MDN browser-compat-data) - per-browser availability for Fullscreen, view transitions, starting-style, transition-behavior, popover, dialog, inert, anchor positioning, scroll-driven animations, calc-size, safe-area insets, viewport units
- [Android - Hide system bars for immersive mode](https://developer.android.com/develop/ui/views/layout/immersive)
- [web.dev - Patterns for promoting PWA installation](https://web.dev/articles/promote-install) - explicitly provides **no** conversion-rate data
- [NN/g - Accidental Dismissal of Overlays](https://www.nngroup.com/articles/accidental-overlay-dismissal/)
- [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/); [Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [MDN - BeforeInstallPromptEvent.prompt()](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt); [WebKit/standards-positions#619](https://github.com/WebKit/standards-positions/issues/619) - no iOS beforeinstallprompt

### Secondary (MEDIUM confidence)
- [Apple Developer Forums 716552](https://developer.apple.com/forums/thread/716552) - safe-area-inset-bottom reports 0 with the Safari toolbar visible (grounds *why the gap is standalone-only*)
- [Apple Developer Forums 803987](https://developer.apple.com/forums/thread/803987) - iOS 26.0 100dvh overlays leave a bottom gap (grounds *do not reach for dvh*)
- [WebKit bug 301108](https://bugs.webkit.org/show_bug.cgi?id=301108) - iOS 26 viewport-fit=cover regression
- Material Design 3 (Bottom sheets / Dialogs) and Apple HIG (Sheets) - primary pages are JS-rendered; accessed via secondary summaries
- WCAG 2.2.1 actionable-toast guidance (Atomic Accessibility, Scott O'Hara, w3c/wcag#976); WCAG 2.3.3 reduced-motion
- Bottom-navigation label conventions (Smashing, UX Planet); pushState/popstate modal dismissal
- iOS body-scroll-lock footgun (Jay Freestone, CSS-Tricks) - the bug this app architecturally *does not have* and must not acquire

### Tertiary (LOW confidence - validate on device)
- **All floating-reaction motion parameters** (travel, duration, easing, drift amplitude, rotation, scale, jitter) - no published spec found for any live-reaction implementation; inferred from observed behavior and sized against existing constants (`SUPERNOVA_ORB_COUNT: 12`, `SUPERNOVA_ORB_TRAVEL_PX: 180`, `MARK_TOAST_MS: 1800`)
- Reaction concurrency cap, per-sender coalescing threshold, global rate cap - derived from a 5-user group plus the `QUEUE_CAP` precedent
- "Me" vs "Dex" vs "You" tab-label discoverability - no comparative research exists; the recommendation rests on a structural argument
- "Don't persist fullscreen state across sessions" - a widely understood failure mode, no citable study
- iOS timer throttling in backgrounded PWAs - consistent with the device-verified visibleEpoch behavior, but inferred rather than measured

---
*Research completed: 2026-07-24*
*Ready for roadmap: yes*
