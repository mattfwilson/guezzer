# Feature Research

**Domain:** Mobile-first PWA UX/UI polish — immersive overlays, chrome hiding, presence-anchored motion, navigation naming. Binding context: one-thumb, in the dark, in a crowded venue, possibly-drunk operator, on a phone where an accidental gesture that loses tracking state is a catastrophic failure.
**Milestone:** v2.1 "UX/UI Polish" (subsequent milestone — no new domain capability)
**Researched:** 2026-07-24
**Confidence:** MEDIUM-HIGH — platform conventions (iOS HIG sheets, Material 3 sheets/dialogs/snackbars, Android immersive mode, WCAG 2.2.1 / 2.3.3 / 2.5.3, NN/g overlay research, web.dev install promotion) are verified against primary or near-primary sources. Motion parameters for the floating-reaction pattern and tab-label naming are **reasoned from observed convention** — no published spec exists and I found none; those are flagged inline as LOW confidence and should be tuned on-device.

---

## How to read this document

Sections **§1–§6** are the behavioral pattern briefs (the "what does a user assume" answer). Each ends with the concrete features it implies, tagged **[TS]** table stakes / **[D]** differentiator / **[AF]** anti-feature.

The consolidated **Feature Landscape** tables (with complexity S/M/L and dependencies on shipped features) come after the briefs. Read the briefs for the behavioral spec; read the tables for roadmap input.

**Complexity key:** S = under a day, contained in one component. M = a few days, touches 2–4 shipped surfaces. L = a week+, or introduces a shared mechanism other features depend on.

---

## §1. Immersive / full-screen overlays layered on a live task

### What "full-screen overlay" means concretely vs. a tall bottom sheet

These are two different primitives with different user contracts, and the app already has both.

| | Tall bottom sheet | Full-screen overlay |
|---|---|---|
| Coverage | Leaves a visible strip (≥ 56–88px) of the task above it | Opaque, edge-to-edge, through both safe areas |
| Scrim | Yes — dims and blocks the visible task behind | None (nothing to see behind) |
| Drag handle | Yes (the affordance that says "drag me down") | No |
| Dismissal | Drag-down, scrim tap, Escape, back gesture, explicit close | Explicit close control (primary), Escape, back gesture |
| Own top bar | No (a title row at most) | Yes — with the close control living in it |
| Tab bar | Covered by the scrim but visually still "there" | Fully covered; the app reads as one task |
| User's mental model | "This is temporary; my task is still right there" | "I have gone somewhere; I will come back" |

Material 3's own guidance is the deciding heuristic: **start with a bottom sheet and escalate to full screen when the content needs the vertical space or the task is complex**; full-screen dialogs exist specifically to "enable complex layouts" and to "minimize the appearance of stacked sheets of material (dialogs above dialogs)." Apple's HIG makes the same split: a sheet "slides up from the bottom and partially covers previous content, communicating temporary overlay status," while a full-screen modal is "appropriate when immersive focus is needed."

**Applied to this app:**

- **Bingo BOARD from the FAB → full-screen overlay.** A 4×4 grid with per-square captions, the one-away banner, and tap-to-reveal is a read-and-scan task that wants every pixel. Nothing behind it is useful while you're reading it.
- **Bingo DEAL from the in-show prompt → full-screen overlay too.** This is the decisive argument: the deal flow already opens `SwapSheet` and `CatchUpSheet` on top of itself. If the deal screen were a bottom sheet, swapping a square would produce **sheet-on-sheet**, which is the exact stacked-overlay failure NN/g documents ("Never stack multiple overlays" — a Google Maps participant expecting to return to a restaurant list instead closed the entire stack). A full-screen page with one sheet above it is **one** overlay level. That's clean.
- Keep the existing `<Sheet variant="bottom-sheet">` for everything it already does. This brief is only about the two new in-show surfaces.

**The primitive already exists.** `Sheet` supports `variant="fullscreen"` (portal to body, `role="dialog"`, `aria-modal`, focus trap, `inert` background, Escape via the shared LIFO `dialogStack`, focus restore). `CompareView` and `FriendDetail` already use it. **This drops the cost of items #1/#2 from L to M** — the work is composition and the back-gesture / z-tier / state contract, not a new primitive.

### Entry conventions

- **Explicit tap only.** The FAB speed-dial gains a "Bingo card" row (an 8th item — see the tap-target warning below), and the deal prompt is a tap on the existing `StartShowNudge` / deal invitation.
- **Never auto-present an overlay over a tracked show.** An overlay that appears on its own while the user is reaching for an orb intercepts the tap. The app's own founding rule ("tap targets must never move on their own" — the reason Show Mode has no force simulation) generalizes directly: nothing may appear over the logging loop uninvited. This is the same discipline that made the supernova celebration `pointer-events-none`.
- Entry animation: slide up + fade, 200–250ms, ease-out. Under `prefers-reduced-motion`, opacity-only crossfade ≤150ms — the app's existing idiom (`BingoCelebration`'s reduced path is a static crossfade; `WaveToast`'s is opacity-only).

### Dismissal — the layered contract (in priority order)

1. **A visible close control in the overlay's own top bar. ≥44×44px, high contrast, always on screen (never scrolled away).** This is the one a drunk thumb uses. NN/g is unambiguous: "Include a visible 'Close' button for all overlays, including bottom sheets," and a modal dismissible only by a small corner icon "creates frustration that makes users abandon a task altogether." Label it, don't rely on a bare glyph: an `X` with `aria-label="Close bingo card"` at minimum; a labelled `‹ Back to show` chip is better in this context because it names the destination, which is precisely the reassurance the feature exists to give.
2. **Escape key** — free from `useDialogDismiss`. Desktop obligation (the milestone requires desktop correctness).
3. **System back gesture → dismiss the overlay, never navigate away.** Push a history entry on open, `history.back()` on explicit close, and close on `popstate`. This matters on both platforms: Android's back gesture is universal, and iOS standalone PWAs *do* have edge-swipe back navigation (since iOS 12.2) even though they have no visible back button. Without this, an iOS edge-swipe or an Android back while the board is open would leave `#/show` entirely — the exact "tab jump that loses their place" the milestone exists to prevent. NN/g explicitly recommends supporting "the device's native Back button/gesture for overlay dismissal."
4. **Backdrop tap — not applicable.** A full-screen overlay has no backdrop. This is a *benefit*: tap-outside is the single largest accidental-dismissal vector NN/g identifies on mobile, and choosing full-screen removes it structurally.
5. **Swipe-down-to-dismiss — recommended AGAINST for these two overlays.** Reasons, in order of weight: (a) it is not the convention for full-screen presentations — iOS's `.fullScreenCover` has no interactive dismissal by default; drag-to-dismiss is the *sheet* convention; (b) the bingo board is scrollable on small phones, and drag-vs-scroll disambiguation is exactly where accidental dismissal happens; (c) NN/g found users routinely pick the wrong dismissal method when several compete, and lose work doing it. If the owner insists on it as a nicety, the safe spec is: engage only when the scroll container is at `scrollTop === 0`, only from a drag starting in the top 32px header strip, and commit only past **25% of viewport height OR >0.5px/ms release velocity** — otherwise snap back. Anything looser is a mis-trigger generator in a dark venue.

### Preserving the underlying task state — the load-bearing requirement

**The overlay is view state, not a route.** Concretely: `const [bingoOverlay, setBingoOverlay] = useState<null | "deal" | "board">(null)` owned by `ShowView`, rendered through the portal. `ShowView` must not unmount.

What survives because of this: `useShowSession` (the active session + trail), the wake lock (a re-acquire race is exactly the class of bug UX-02 already fixed), `useLatestPoll`'s ≤1/60s cadence and its dedupe state, the deterministic orbit layout, the FAB's open/closed state, and any half-typed query in `SearchSheet`.

This also matches the app's own established rule — "view-state switching, never a route" (the Friends segment inside `DexView`, `FriendDetail`, `CompareView`, the deliberate no-router decision). Nothing new is being invented; the risk is only that an implementer reaches for `navigate("games")` because that is what `BingoPeekStrip` does today.

**Z-tier:** the overlay must sit at `config.ui.z.sheet` (50), above `toast` (20) and `celebration` (18). Consequence: bingo mark-toasts fired while the board is open are hidden behind it — which is **correct**, because the board itself shows the mark. Better still, suppress them at the source while the overlay is open (see §3).

### Accessibility obligations (§1)

- `role="dialog"` + `aria-modal="true"` + an accessible name naming the *specific* surface ("Bingo card", not "Dialog"). Provided by `Sheet`.
- Focus moves into the overlay on open (its heading with `tabIndex={-1}`, or the close button), background `inert`, focus restored to the FAB item that opened it. Provided by `useFocusTrap`.
- The overlay's own scroll container must be reachable by keyboard (desktop obligation).
- `prefers-reduced-motion`: entry/exit becomes an opacity crossfade. No slide, no scale.

### Features implied by §1

- **[TS]** Shared `<FullScreenOverlay>` composed from the existing `Sheet variant="fullscreen"`, with a mandatory top bar + labelled close control. **M**
- **[TS]** Bingo board as a full-screen overlay launched from the FAB, `ShowView` never unmounting. **M**
- **[TS]** Bingo deal as a full-screen overlay launched from the in-show prompt. **M**
- **[TS]** History-entry back-gesture dismissal for overlays (`pushState` on open / `popstate` closes). **S**
- **[D]** A labelled `‹ Back to show` close chip rather than a bare `X` — names the destination, which is the whole reassurance. **S**
- **[AF]** Swipe-down-to-dismiss on a full-screen in-show overlay.
- **[AF]** Auto-presenting the deal overlay when a show starts.
- **[AF]** Reaching the board via `navigate("games")` and a "back" button.
- **[AF]** Bottom sheet for the deal flow (produces sheet-on-sheet with `SwapSheet`).

---

## §2. Hiding app chrome for immersion

Two distinct modes with different rules. Android's own guidance frames the tradeoff correctly: *"use immersive mode only when the benefit to the user experience goes beyond simply using extra screen space"* — and, critically, *"The user should still be able to tap to reveal system bars."* A pannable/zoomable canvas (GizzVerse) is squarely in the sanctioned list (games, image galleries, maps). An in-show tracking screen is a *mode*, which is a different problem.

### (a) User-toggled fullscreen — GizzVerse

**The single most important rule: the way out is where the way in was.** A persistent control at a fixed position, same place, icon flipped (`Maximize2` → `Minimize2`), `aria-pressed` reflecting state. This is the YouTube / Photos / Maps convention and it is the difference between "immersive" and "stranded."

- **Placement:** NOT bottom-right — `ExploreFilterFab` owns that corner and Phase-8 A11Y-02 already spent effort guaranteeing it is never occluded. Put the fullscreen toggle top-right of the canvas (where the header bar used to be — it visually replaces what it hid) or bottom-left. It must stay ≥44×44 and must keep a visible chip/border in fullscreen: a bare glyph over the dark constellation with no background will disappear against bright star clusters.
- **Discoverability of the exit:** the toggle stays visible. Do **not** auto-fade it. Video players can fade controls because tapping anywhere brings them back; here, tap-on-canvas is already bound (background tap clears node focus in `ExploreView`), so there is no free "tap anywhere to reveal" gesture. Losing the button = stranded.
- **Do NOT use edge swipe to reveal.** On Android and iOS the left/right screen edges are the system back gesture and the bottom edge is the home indicator. Any app-level edge-swipe affordance either loses the race with the OS or trains the user into a gesture that sometimes exits the app. Android can do this only because it *is* the OS.
- **Do NOT persist the preference across sessions or across tabs.** Reset to chrome-visible when the user leaves GizzVerse and on cold boot. A user relaunching into a chrome-less app with no tabs concludes the app is broken. *(Reasoning from convention — I found no citable study; the failure mode is well known but I am not sourcing it.)*
- **Animation:** header slides up / tab bar slides down, 200ms ease-out, with the content area growing in the same tick so nothing jumps twice. Reduced motion → instant. The constellation must not re-`zoomToFit` on the resulting resize — UX-04 already installed `firstSettleRef` precisely to stop that; the chrome toggle is a container resize and will hit that path.

### (b) Automatic — hide the tabs while a show is tracked

This is a **mode**, and modes must be visible and escapable. The show screen is already unmistakably itself (orbit + comet trail + tally), so legibility is satisfied. Escapability is not.

- **[TS] There must be a way to reach the other tabs without ending the show.** A friend asks what venue is next; the user wants Map. Today that is one tap. Post-change it must not be zero taps. The correct shape is: **auto-hide is a default, not a lock.**
- **Recommended affordance:** a slim persistent grab-pill centered on the bottom edge — visually ~4×36px, but with a ≥44×44px hit area, sitting above `env(safe-area-inset-bottom)`, `aria-label="Show navigation tabs"`, `aria-expanded={false}`. One tap slides the tabs back. **Once revealed manually, they stay revealed for the rest of that show.** Do not re-hide.
- **[AF] Auto-re-hide on a timer** (Android's `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` sticky behavior). That is right for video and wrong here: a user glancing at the Map mid-show would have the tab bar vanish *under their thumb mid-reach*, and the target they were aiming at moves. That is a direct violation of the project's founding constraint that tap targets never move on their own. Video players get away with it because a mis-tap costs nothing; here a mis-tap during a show costs setlist state.
- **[AF] Edge-swipe to reveal** — same OS-collision reason as (a).
- **[AF] Changing chrome state while the FAB speed-dial is open** — the FAB's bottom offset is computed from the tab-bar height (`showBottomFabOffset`); toggling chrome with the menu expanded moves seven action rows under an open thumb.

### Where apps get this wrong (the strand list)

1. Hidden chrome with **no visible affordance at all**, relying on an undiscoverable gesture.
2. The reveal gesture **colliding with a system gesture** (edge swipes).
3. **Auto-hiding while the user is mid-reach**, so the target moves.
4. Hiding the chrome but **leaving its reserved space** — a 64px dead gap at the bottom. This app is already primed for that failure: `AppShell` hard-codes `calc(4rem + env(safe-area-inset-bottom))`, `FabMenu`/`fabLayout.ts` computes off the 64px bar, and `bottomOverlayInset` layers transient overlay heights on top of it. **The chrome-hidden mechanism must expose the reserved bottom height as a value that all call sites read — that is the actual engineering content of items #4 and #9, and it is why this is the L-complexity item in the milestone.** It is also adjacent to the separately-listed "installed-PWA bottom viewport gap" bug; fixing them together is cheaper than fixing them apart.
5. **Persisting hidden state across launches**, so the app boots looking broken.
6. Visually hiding but leaving the chrome **in the accessibility tree** — VoiceOver still announces five tabs a sighted user cannot see, and a swipe-navigating user lands focus on an invisible control. The bar must be unmounted (or `hidden` / `inert`), not just translated off-screen or `opacity: 0`.

### Accessibility obligations (§2)

- Hidden chrome must leave the a11y tree entirely. Unmount after the exit transition completes, or apply `hidden`.
- The reveal affordance needs a real accessible name and `aria-expanded`.
- Focus management: if focus was inside the tab bar when it hides, move focus to the reveal affordance — never orphan it.
- `prefers-reduced-motion`: no slide. Chrome appears/disappears instantly, or with a ≤120ms opacity change.
- The GizzVerse toggle is a state control: `aria-pressed` (toggle button) is the cleanest semantic.

### Features implied by §2

- **[TS]** Shared `useChromeVisibility()` hook/context — the single mechanism serving both #4 and #9, exposing `{ chromeHidden, hideChrome, showChrome, reservedBottomPx }`. **L** (it is the dependency, not a leaf feature).
- **[TS]** `AppShell` / `fabLayout` / `bottomOverlayInset` / `SuggestionStrip` all read `reservedBottomPx` instead of the 4rem literal. **M**
- **[TS]** GizzVerse fullscreen toggle with a fixed, persistent, always-visible exit in the same position. **S** (once the hook exists)
- **[TS]** Tabs auto-hide at Start Show, with a persistent reveal pill that latches open for the session. **M**
- **[TS]** Hidden chrome removed from the accessibility tree. **S**
- **[D]** Chrome state resets on tab change and on cold boot (no sticky immersion). **S**
- **[AF]** Edge-swipe-to-reveal.
- **[AF]** Timed auto-re-hide.
- **[AF]** Persisting fullscreen preference across sessions.
- **[AF]** Two separate implementations for #4 and #9 (they will drift; the owner already called for one mechanism).

---

## §3. Notification deep-links from a transient toast

The governing convention is Material's snackbar rule and it fits this case exactly: **a snackbar carries at most ONE action, as a text button at the trailing edge, and that action must be non-essential — because the snackbar auto-dismisses, anything only reachable there is effectively unreachable.**

Here the action is genuinely redundant: the FAB "Bingo card" row and the in-flow `BingoPeekStrip` both reach the same overlay. That is what makes this safe to build.

### Concrete spec

- **Which tier gets the button.** Only the **badge** and **supernova** tiers (four-corners / X / another-line / first-line / blackout). **Not the mark-toast.** Mark-toasts fire on every lit square — several times a show, in the bottom overlay zone directly above the logging loop and the FAB. Growing a 44px button there means repeatedly spawning a fresh tap target under a reaching thumb. That is the mis-trigger scenario the project treats as catastrophic.
- **Dwell time.** Material's default is 4s short / 10s long. The current tiers are 1.8s (mark) / 2.0s (badge) / 2.7s (supernova) — all too short to notice, aim at, and hit a button one-handed in the dark. **Extend the actionable tier to 6–8s** and put the value in `config.ui.celebration` alongside the existing constants (the single-config rule).
- **Tap target.** An explicit labelled button inside the toast — "View card" — ≥44×44, on the trailing edge, with **the rest of the toast staying `pointer-events-none`**. Do not make the whole toast tappable: a full-width ephemeral tap surface appearing over the FAB / suggestion-strip zone is precisely the accidental-activation trap the app's D-17 rule exists to prevent.
- **Missed toast = nothing lost.** The mark is already on the board; the peek strip still shows the one-away state; the FAB row is permanent. State this explicitly as the acceptance criterion.
- **Suppress while redundant.** If the bingo overlay is already open, do not fire the deep-link toast at all (the user is looking at the thing). Same for the mark-toast — the board shows the mark.
- **One at a time.** Reuse the existing single-slot discipline. Never let a second actionable toast arrive and move the button under a thumb. The `WaveToast` FIFO drain already models this.

### Accessibility obligations (§3)

- **WCAG 2.2.1 (Timing Adjustable)** is the live constraint: auto-dismissing content with an interactive control is a documented accessibility problem — "If any actions are included within a toast, then it can't be set to auto-dismiss." The pragmatic, defensible resolution here is (a) the action is redundant (a permanent path exists), (b) **pause the dismiss timer while focus or a pointer is inside the toast**, and (c) never auto-move focus into the toast (that would steal focus mid-show).
- Text announced via `role="status"` / `aria-live="polite"` — the existing pattern. The button needs a self-sufficient accessible name ("View bingo card", not "View").
- `prefers-reduced-motion`: the toast is opacity-only already; adding a button changes nothing about motion.

### Features implied by §3

- **[TS]** "View card" action button on badge/supernova celebration toasts only, opening the overlay. **S**
- **[TS]** Extended dwell (6–8s) for actionable toasts, timer paused on focus/pointer. **S**
- **[TS]** The action's destination also reachable permanently (FAB row) — a hard gate on shipping the toast action. **S** (satisfied by §1)
- **[D]** Suppress bingo toasts while the bingo overlay is open. **S**
- **[AF]** An action button on mark-toasts.
- **[AF]** Whole-toast tap target.
- **[AF]** An action reachable *only* from the toast.

---

## §4. Presence-anchored reaction fly-ups

The reference pattern is Facebook Live / Instagram Live / Periscope floating hearts: emoji spawn near the bottom, rise, drift, scale, fade. This app crosses it with presence — the emoji flies from *the section the sender is on*. I found **no published spec** for any of these implementations; everything below is reasoned from observed behavior and from this app's own constraints. Treat the numbers as **starting values to tune on-device**, not as verified facts.

### Spawn position

- **Anchor = the sender's tab.** `presenceActivity.ts` already gives you `Activity.tab` for every peer, and `ROUTE_TO_TAB` already maps routes to tokens. Spawn at the horizontal center of that tab's button, just above the tab bar. This is a computable, already-shipped signal — the feature composes with presence rather than inventing a channel.
- **Degradation when the tab bar is not rendered** (in-show hiding per §2, GizzVerse fullscreen): fall back to a *proportional* x — `(tabIndex + 0.5) / 5 × viewportWidth` — at a fixed y above the safe-area inset. The "different friends fly from different places" signal survives without the bar. **This is a hard dependency on §2 and must be specified, not discovered.**
- `tab: "idle"` (sender backgrounded) or an unresolvable sender → center-bottom, no section claim.
- **"Sender is on a section the viewer can't see":** in this app that case does not exist — all five tabs exist for every user, and the fly-up host is app-global (mounted once in `App.tsx`, like `WaveToast` / `BingoCelebration`), so it plays over whatever tab the viewer is on. It anchors to where the **sender** is, not the viewer. The only genuinely unmappable case is `idle`, handled above. Do not gate the animation on the viewer being on the same tab — that would silently swallow most reactions in a 5-person group.

### Motion parameters (LOW confidence — tune on-device)

| Parameter | Value | Why |
|---|---|---|
| Vertical travel | 35–55% of viewport height, randomized | Enough to read as "rising", short enough not to reach the header |
| Duration | 1.8–2.8s, randomized per particle | Below ~1.5s reads as a glitch; above ~3s lingers |
| Y easing | ease-out (decelerating rise) | Straight linear reads mechanical |
| Opacity | 1 → 0 over the final 40% | Never a hard cut |
| Scale | 0.7 → 1.0 in the first 15% (a small pop), then hold; final size jitter ±15% | The pop is what makes it feel like it *launched* |
| Horizontal drift | shallow sine, amplitude 12–28px, ~1–1.5 periods | The single biggest "alive vs. mechanical" lever |
| Rotation | ±8–12° total, randomized sign | Beyond ~15° reads cartoonish |
| Start jitter | 0–150ms random delay | Stops simultaneous reactions moving in lockstep |
| Composition | Emoji + a small name pill rigidly attached beneath it, sharing one transform | Two independently-wobbling elements read as noise; one object reads as a thing |
| Name legibility | ≥13px, semibold, with a solid or blurred chip behind it | It flies over the constellation and the orbit — bare text over stars is unreadable |

Use the sender's deterministic identity color (already shipped via `IdentityGlyph`) on the name pill — free identity reinforcement.

### Throughput: throttle and coalesce

With ~5 users the natural rate is low; the real risk is one friend spamming the palette. The scope freezes the send surface (`ReactionPalette`, `validateWave`, `gizz-room`), so **all throttling must be receive-side**.

- **Hard concurrency cap: 12 simultaneously animating particles.** Beyond that, drop (drop-newest is simpler; drop-oldest looks better). 12 matches the existing `SUPERNOVA_ORB_COUNT` precedent, so it is a defensible house number.
- **Per-sender burst coalescing:** same sender + same emoji, ≥3 within 2s → render ONE particle carrying a `×N` badge. This is the standard burst→count collapse and it is what stops a spammer from owning the screen.
- **Global emit rate cap: ≤6 spawns/second app-wide.** Excess is **dropped, never queued** — a reaction that lands 20 seconds late is a lie about presence.
- **This deliberately replaces the shipped D-10 FIFO one-at-a-time drain.** The `QUEUE_CAP` + `DRAIN_GAP_MS` design exists to make waves read as *distinct sequential pings*; the fly-up's whole value is *concurrency*. Note the reversal explicitly in the requirements so it is not later rediscovered as a regression.
- **In-show spatial rule (project-specific, and the one I would defend hardest):** while a show is actively tracked, constrain spawn x to the outer 25% margins (left and right) so particles never cross the orbit center where the current-song node and the highest-probability orbs live. Cap particle opacity ≈0.85 over the show screen so an orb's honest-% label stays readable underneath. The logging loop is sacred; a rising emoji must never obscure the number a user is deciding on.
- Every particle is `pointer-events-none` and must **not** register with `useBottomOverlayHeightRegistration` (it reserves no layout — registering would shove the FAB around on every reaction).

### The sender seeing their own reaction

**Table stakes.** Optimistic local echo the instant the palette is tapped — do not wait for the round trip. Instagram and Facebook both do this, and it is what makes the button feel connected to the effect. Anchor it at the sender's own current tab, which is by definition the tab they are looking at, so it flies out from under their thumb. De-duplicate the echo when the broadcast returns (either `self: false` on the Supabase broadcast subscription, or filter `from === myUserId` at the receive boundary).

### Reduced motion — hard requirement

**Recommendation: under `prefers-reduced-motion`, render the existing shipped `WaveToast` host instead of the fly-up.** It is opacity-only, already tested, already accessible, and already sized/positioned to never cover the logging loop. This is the cheapest possible compliant fallback and it means zero new reduced-motion surface to design or verify.

If the owner prefers visual continuity, the alternative is a **static** anchored presentation: emoji + name fade in *at the anchor position*, hold ~1.5s, fade out — opacity only, no travel, no drift, no rotation, no scale. This preserves the section signal without any vestibular trigger. (WCAG 2.3.3 is AAA, but the app has already committed to reduced-motion handling on every animated surface — `BingoCelebration`, `WaveToast`, `BingoPeekStrip`'s glow, `FabMenu` — so this is house policy regardless of conformance level.)

### Other accessibility obligations (§4)

- **Position carries meaning, and position is invisible to a screen reader.** There must be a parallel `aria-live="polite"` announcement that puts the section into words: *"Matt reacted 🔥 from GizzVerse."* Without it, the entire "which section" payload is sighted-only.
- **Throttle the live region hard** — at most one announcement per ~2s, coalescing the rest ("3 reactions"). An unthrottled live region during a reaction flurry is worse than silence: it will talk over the user for a minute.
- Particles themselves must be `aria-hidden` (the live region is the accessible channel). Never both.
- Never move focus. Never play sound.

### Alive vs. spam

| Feels alive | Feels like spam |
|---|---|
| Randomized duration / drift / scale / rotation per particle | Identical trajectories |
| Staggered start jitter | Lockstep launch |
| Your own reaction echoing instantly | Round-trip delay before you see your own tap land |
| Sender-color name pill (you know *who*) | Anonymous emoji |
| Concurrency capped and bursts coalesced | Unbounded particle count |
| Particles hug the margins during a show | Particles crossing the orbit |
| Silent, `pointer-events-none`, no layout impact | Sound, blocking taps, shoving the FAB |
| A brief pulse on the sender's tab icon | A persistent counter badge that accumulates |

### Features implied by §4

- **[TS]** Presence-anchored fly-up host replacing the `WaveToast` presentation, mounted once in `App.tsx`. **M**
- **[TS]** Anchor derivation from `Activity.tab`, with the chrome-hidden proportional fallback. **S** (depends on §2)
- **[TS]** Optimistic local echo of your own reaction. **S**
- **[TS]** Concurrency cap + per-sender burst coalescing + global rate cap, receive-side. **M**
- **[TS]** Reduced-motion fallback (recommend: fall back to the shipped `WaveToast`). **S**
- **[TS]** Throttled `aria-live` announcement naming the sender, emoji, and section. **S**
- **[D]** In-show margin constraint + opacity cap so particles never cross the orbit. **S**
- **[D]** Brief pulse/tint on the sender's tab icon as the particle launches — makes the section legible even for a single reaction. **S**
- **[D]** Sender-identity-colored name pill (reuses shipped `IdentityGlyph` color derivation). **S**
- **[AF]** Queuing over-cap reactions for later playback.
- **[AF]** Only playing the fly-up when the viewer is on the sender's tab.
- **[AF]** Sound.
- **[AF]** A persistent accumulating reaction counter.
- **[AF]** Registering particles with the bottom-overlay inset system.

---

## §5. Tab-label naming

**Plan:** Live / GizzVerse / Map / Me / Games.

### Conventions

- 3–5 destinations is the ceiling; **five is the max** — more and "targets [get] too close to each other and hurts usability, potentially causing users to accidentally trigger the wrong option." The app is at exactly five, so labels must not push toward six.
- One word ideally, two maximum; a noun or noun-phrase naming a *place*, not a verb.
- Always paired with an icon — icons alone are "hard to memorize and often highly inefficient."
- **Never truncate, never ellipsize, never wrap to two lines.** A wrapped tab label is the classic five-tab failure.

### The concrete sizing risk

At five tabs on a 390pt iPhone each tab is ~78px; on a 375pt iPhone SE/mini, ~75px. "GizzVerse" at 14px semibold measures right at that boundary. Shortening the other four does not help the one that was already tightest.

**Spec:** verify GizzVerse renders on one line at 375px width with the current 14px semibold. If it does not, drop the label size to 12–13px **for all five tabs**, never for one — mixed label sizes read as a rendering bug.

### The mixed-register risk

Live / Map / Me / Games are generic nouns; GizzVerse is a proper brand name. Four plain + one branded is an inconsistency a designer will notice. It is nonetheless defensible — GizzVerse names a *place* rather than a category, which is exactly the owner's stated rationale — so keep it, but hold the icon set rigorously consistent (all lucide line icons, same 22px, same stroke) so the inconsistency lands on one axis only.

### "Me" specifically

- **Convention check:** "Me" is idiomatic (LinkedIn "Me", YouTube "You", Instagram uses a bare avatar, Spotify "Your Library"). It is short and reads as personal. No discoverability research comparing these labels turned up in search; this is convention, not evidence.
- **The real problem: "Me" does not signal that *friends* live there.** After v2.0, `DexView` holds Dex + Albums + **Friends** (live shared progress, presence dots, head-to-head compare). A user looking for a friend's progress will not think "Me." This is a genuine discoverability regression risk introduced by the rename — the current "GizzDex" is no better, but the rename is the moment to fix it.
- **Recommendation:** keep **"Me"** *only if* paired with a friends-presence badge on the tab icon (a small online-count dot or avatar stack when ≥1 friend is online). That badge does double duty: it advertises that other people are behind this tab, and it rewards presence — the payoff v2.0's presence layer currently under-delivers. Without the badge, **"Dex"** is the better label: it is the app's own domain word, already saturated in copy ("your dex", "Whose dex is this?"), and more accurately describes the primary content. **Flag as an owner decision** — the backlog said "Dex", the milestone says "Me"; the badge is the tiebreaker.
- **Additionally:** ensure the segmented control (Dex / Albums / Friends) at the top of `DexView` is visible above the fold on a small phone. A one-word tab plus an off-screen segment control is how a whole feature goes undiscovered.
- **Accessibility — WCAG 2.5.3 Label in Name:** the accessible name must *contain* the visible label. So `aria-label="Me — your dex and friends"` is compliant and richer; `aria-label="Profile"` on a tab labelled "Me" is a violation. Apply the same pattern to the others: `"Live — track tonight's show"`, `"Games — Gizz Bingo"`. `aria-current="page"` is already present and correct.

### The rename's hidden cross-feature bug

`presenceActivity.ts` uses the brand tokens (`"LiveGizz"`, `"GizzVerse"`, `"GizzMap"`, `"GizzDex"`, `"GizzGames"`) as **both the wire value broadcast over `gizz-room` AND the display label** — its own comment says so: *"These ARE the display labels."*

Consequences the rename must handle:

1. Renaming display labels without touching the wire tokens leaves a friend's presence chip reading **"LiveGizz"** while the tab reads **"Live"**. Guaranteed inconsistency.
2. Renaming the *wire* tokens breaks presence between friends on different builds — in a 5-person group where not everyone refreshes on the same day, that is a real interop break. `ROUTE_TO_TAB`, the `TABS` allow-list, and `reduceActivity`'s validation all key on those exact strings.
3. **Correct fix:** freeze the wire tokens, add a display map (`TAB_DISPLAY_LABEL: Record<Tab, string>`) consumed by every presence-facing surface (`FriendRow`, `FriendsList`, `SelfRow`, and the new fly-up's `aria-live` text).
4. Also sweep `config.copy` for user-facing references to the long names — `BingoPeekStrip` already names "GizzGames" in its routing behavior, which signals copy that names tabs.

This is exactly the kind of thing a "rename five strings" task misses. It belongs in the requirement, not the implementation.

### Features implied by §5

- **[TS]** Display-label rename with wire tokens frozen + a `TAB_DISPLAY_LABEL` map. **S**
- **[TS]** One-line label verification at 375px; uniform font-size change if needed. **S**
- **[TS]** `aria-label` on each tab containing the visible label plus a clarifier (WCAG 2.5.3). **S**
- **[TS]** Copy sweep for long-name references. **S**
- **[D]** Friends-presence badge on the "Me" tab icon (online count / avatar stack). **S–M**
- **[AF]** Renaming the presence wire tokens.
- **[AF]** Shrinking only the GizzVerse label.
- **[AF]** An `aria-label` that does not contain the visible label.

---

## §6. Small polish

### Difficulty-tier iconography (Chill / Balanced / Glory-hunter)

Two dominant conventions:
- **Ordinal / cumulative marks** — 1/2/3 filled pips, bars, stars, flames, chili peppers, signal bars. Quantity encodes difficulty. Scans instantly, communicates *order*.
- **Distinct metaphors** — leaf / mountain / skull; the ski-trail green-circle / blue-square / black-diamond system. More personality, but order must be learned.

**Recommendation: ordinal, with personality.** The three vibes are an ordered scale, so the glyph must encode order — one flame / two flames / three flames (the chili-pepper convention), or lucide's `SignalLow` / `SignalMedium` / `SignalHigh` if a cooler register is wanted. A non-ordinal metaphor trio (`Leaf` / `Scale` / `Trophy`) looks better in isolation and communicates less.

**Accessibility:**
- Icons are **decorative only** — `aria-hidden`, sitting beside the existing text labels which already carry the meaning. Never icon-only.
- **Never encode the tier in color.** "Never rely on color alone to convey information" is the base rule, and this app has a second reason: `UI-SPEC §Color` reserves accent/gold for Start Show and focus rings, and the `DealScreen` buttons are deliberately neutral `bg-elevated`. Introducing green/amber/red tiering would break both rules at once.
- The icon must not contradict the honest `FillMeter` number that already sits above the board.

**Complexity: S.** Pure `DealScreen` change.

### PWA install affordance relocation

**Does moving it out of the top-right menu hurt install rate?**

Honest answer: **no citable evidence either way.** web.dev's install-promotion guidance lists "navigation menu (below other items)" as a legitimate simple pattern and stresses only that promotions be non-disruptive and outside the main journey flow — it provides *no* conversion-rate data at all. Anyone claiming a number here is inventing it.

**Practical assessment for this app:**

- Install conversion here is driven overwhelmingly by the **`InstallBanner`** — auto-shown once per build, accent CTA, iOS 3-step instructions inline, dismissible, with a persisted `installBannerSeenVersion` gate. That is the primary funnel and item #8 does not touch it.
- The `AppMenu` install row is documented as the *always-available fallback after banner dismissal* (D-03). Moving that fallback from 1 tap (header menu) to 3 taps (menu → Settings → scroll to bottom) is a real, if small, regression in the fallback path.
- The stakes are higher than "install rate" suggests: an **uninstalled** iOS user is exposed to IndexedDB eviction, which this project already treats as a first-class hazard (it is why the export CTA is the one gold button). Losing a dex is the failure being prevented, not a missed metric.

**Recommendation:** move the 3-step instructions to the bottom of Settings as the owner wants — a reference/how-to belongs there and it declutters the menu — **but keep a single neutral one-line row in `AppMenu` ("Install to home screen ›") that deep-links to that Settings section.** Near-zero cost, preserves the fallback path, satisfies the intent.

**Additional specs:**
- The Settings install section must **hide itself entirely when `isInstalled` is true** (`useInstallState` already exposes it). An installed user at a show reading dead instructions is confusing chrome.
- The Settings install row/section must be **neutral, not accent** — the accent Export CTA already lives in Settings and two competing gold CTAs on one screen is the anti-pattern.
- Android/Chromium `canInstall` (a captured `beforeinstallprompt`) should still surface a real Install *button* in Settings, not just iOS instructions — the branch already exists in `useInstallState`.

**[AF]** Compensating for the relocation by showing the `InstallBanner` more often. web.dev is explicit that disruptive promotion "reduces the usability of your PWA and negatively impacts your engagement metrics," and the once-per-build gate is a deliberate shipped decision (D-22).

### Sheet up/down animation + z-layer fix (in-scope surface polish; a §1/§2 dependency)

- **Convention:** modal bottom sheets slide in from below (200–250ms ease-out) and out downward (180–200ms ease-in), with the scrim crossfading 0 → 0.5 over the same duration. Under `prefers-reduced-motion`: opacity-only, ≤150ms, no translate.
- `Sheet.tsx` currently has **zero** animation. Adding it in the ONE primitive means all 7+ surfaces inherit it — including the two new full-screen overlays. Do it before §1, not after. `motion` is already a dependency.
- **Z-ladder as shipped:** `content 10 → peek 12 → page 15 → celebration 18 → toast 20 → fabScrim 25 → fab 30 → sheetScrim 40 → sheet 50 → focusedFab 60`. The invariant "nothing paints over an open sheet" is *already* satisfied for toasts and celebrations (20, 18 < 40). The one documented exception is `focusedFab` (60 > 50), which is deliberate (D-03, FilterFab above the non-modal NodeSheet).
  - **Open question for the phase:** identify the actual offending surface before changing tiers. Prime suspects are elements with no explicit z (the `BottomTabBar` has none) or a surface rendered in-tree rather than through the portal. Do not renumber the ladder speculatively — the comments record two prior regression guards (`page < sheetScrim`, `fabScrim < fab`) that a renumber could silently break.
  - The new full-screen overlay should occupy `z.sheet` (50) via the existing `variant="fullscreen"` — no new tier needed.
- **[TS]** Add an ordering assertion test over `config.ui.z` so the documented invariants (`page < sheetScrim`, `fabScrim < fab`, everything-except-`focusedFab` `< sheet`) are enforced rather than commented. **S**

### App-wide "Mon D, YYYY" via one UTC-safe helper

Table stakes, **S**. The UTC-safety point is real and worth stating: `new Date("2026-08-14")` parses as UTC midnight and renders as **Aug 13** for anyone west of Greenwich. Shows are keyed by date string throughout (`attendanceKey()` uses `date#session`); a display helper that shifts the date by one day at a US venue would be a visible correctness bug at exactly the moment the app is used. One helper, parsed from the string parts, formatted without `Date` timezone involvement, unit-tested with fixtures at UTC-5 and UTC+11.

---

## Feature Landscape

### Table Stakes (a user will feel the absence)

| Feature | Why expected | Cx | Depends on (shipped) |
|---|---|---|---|
| Shared `useChromeVisibility()` mechanism exposing `reservedBottomPx` | Both #4 and #9 are "hide chrome"; two implementations drift. Every bottom-anchored surface computes off the 64px tab bar today. | **L** | `AppShell`, `BottomTabBar`, `fabLayout.ts`, `bottomOverlayInset`, `SuggestionStrip` |
| All bottom-anchored surfaces read `reservedBottomPx` instead of the 4rem literal | Otherwise hiding the tabs leaves a 64px dead gap and the FAB floats mid-air | **M** | `AppShell`, `FabMenu`, `BingoPeekStrip`, `SuggestionStrip`, `InstallBanner`, `UpdateToast`, `BackupToast`, `WaveToast` |
| `<FullScreenOverlay>` from `Sheet variant="fullscreen"` + mandatory top bar with a labelled ≥44px close | NN/g: every modal needs a visible close control plus Escape, both returning exactly where the user was | **M** | `Sheet`, `useFocusTrap`, `useDialogDismiss`, `dialogStack` |
| Bingo board overlay from the FAB, `ShowView` never unmounting | The stated core of the milestone: never a tab jump that loses their place | **M** | `FabMenu`, `useShowSession`, `bingoReplay`, `BingoBoard`, wake lock |
| Bingo deal overlay from the in-show prompt | Same; and full-screen avoids sheet-on-sheet with `SwapSheet` | **M** | `DealScreen`, `SwapSheet`, `bingoContext`, `saveDraftCard` |
| Back-gesture dismissal via a pushed history entry | Android back and iOS standalone edge-swipe both exist; without this they exit `#/show` | **S** | `useHashRoute` |
| Tabs auto-hide at Start Show + a persistent reveal pill that latches open | A mode must be escapable; the user must reach Map without ending the show | **M** | `useChromeVisibility`, `useShowSession`, `BottomTabBar` |
| GizzVerse fullscreen toggle, persistent exit in the same position, icon flipped | The way out is where the way in was — the difference between immersive and stranded | **S** | `useChromeVisibility`, `ExploreView`, `ExploreFilterFab`, UX-04 `firstSettleRef` |
| Hidden chrome removed from the a11y tree | Visually-hidden-but-focusable tabs strand screen-reader users | **S** | `BottomTabBar` |
| "View card" action on badge/supernova toasts only, dwell 6–8s, timer paused on focus | Material: one action, trailing edge, must be non-essential; WCAG 2.2.1 on timing | **S** | `BingoCelebration`, `config.ui.celebration`, §1 overlay |
| Presence-anchored fly-up replacing the `WaveToast` presentation | The milestone's headline reactions change | **M** | `usePresence`, `presenceActivity`, `IdentityGlyph`, `getSyncState`, `App.tsx` host slot |
| Anchor from `Activity.tab` + proportional fallback when chrome is hidden | Without the fallback, every in-show reaction spawns at a phantom tab bar | **S** | `presenceActivity.ROUTE_TO_TAB`, `useChromeVisibility` |
| Optimistic local echo of your own reaction | Instagram/FB both do this; without it the palette feels disconnected | **S** | `ReactionPalette`, `presenceSync` |
| Receive-side concurrency cap (12) + per-sender burst coalescing + ≤6/s global rate cap | Send surface is frozen by scope; one spammer must not own the screen | **M** | `usePresence` wave listener (replaces D-10 FIFO) |
| Reduced-motion fallback (recommend: render the shipped `WaveToast`) | Hard milestone requirement; cheapest compliant path with zero new surface | **S** | `WaveToast`, `useReducedMotion` |
| Throttled `aria-live` naming sender + emoji + section | Position carries the payload and position is invisible to a screen reader | **S** | new fly-up host |
| Tab display rename with **wire tokens frozen** + `TAB_DISPLAY_LABEL` map | Renaming the wire tokens breaks presence across builds; not renaming them leaves "LiveGizz" chips beside a "Live" tab | **S** | `BottomTabBar`, `presenceActivity`, `FriendRow`, `FriendsList`, `SelfRow`, `config.copy` |
| One-line label check at 375px; uniform size change if needed | Wrapped/truncated tab labels are the classic five-tab failure | **S** | `BottomTabBar` |
| `aria-label` containing the visible label plus a clarifier | WCAG 2.5.3 Label in Name; a one-word "Me" is thin for AT | **S** | `BottomTabBar` |
| Ordinal difficulty icons, `aria-hidden`, never color-coded | An ordered scale needs ordered glyphs; color-alone violates both a11y and the accent-reservation rule | **S** | `DealScreen`, `config.copy.games.bingo` |
| 3-step install instructions moved to Settings, hidden when `isInstalled` | Owner scope; and a dead how-to for an installed user is confusing chrome | **S** | `SettingsView`, `IosInstallInstructions`, `useInstallState`, `AppMenu` |
| Sheet up/down animation in the ONE primitive, reduced-motion opacity-only | 7+ surfaces inherit it; it is also the entry animation the new overlays need | **S** | `Sheet`, `motion` |
| `config.ui.z` ordering assertion test | Two prior regression guards live only in comments | **S** | `config.ts` |
| UTC-safe "Mon D, YYYY" helper, fixture-tested at UTC-5 and UTC+11 | `new Date("2026-08-14")` renders as Aug 13 in a US venue | **S** | all date-rendering surfaces |

### Differentiators (makes it feel crafted)

| Feature | Value | Cx | Depends on |
|---|---|---|---|
| `‹ Back to show` labelled close chip instead of a bare `X` | Names the destination — precisely the reassurance the feature exists to give | **S** | `<FullScreenOverlay>` |
| Suppress bingo toasts while the bingo overlay is open | Redundant information that would otherwise paint over the thing it describes | **S** | §1 overlay, `BingoCelebration` |
| In-show spatial rule: reactions spawn only in the outer 25% margins, opacity ≤0.85 | A rising emoji never obscures the honest % a user is deciding on. The logging loop stays sacred. | **S** | fly-up host, `useShowSession` |
| Brief pulse/tint on the sender's tab icon as the particle launches | Makes the "which section" signal legible even for a single reaction | **S** | fly-up host, `BottomTabBar` |
| Sender-identity-colored name pill on the particle | Free identity reinforcement; reuses shipped deterministic color derivation | **S** | `IdentityGlyph` |
| Friends-presence badge on the "Me" tab (online count / avatar stack) | Fixes the discoverability hole "Me" opens, and finally pays off the presence layer | **S–M** | `usePresenceReaders`, `BottomTabBar` |
| Chrome state resets on tab change and cold boot | Prevents "the app booted with no tabs, it's broken" | **S** | `useChromeVisibility` |
| Neutral one-line "Install to home screen ›" row kept in `AppMenu`, deep-linking to Settings | Preserves the 1-tap fallback path at near-zero cost | **S** | `AppMenu`, `SettingsView` |

### Anti-Features (actively harmful)

| Feature | Why requested | Why harmful | Instead |
|---|---|---|---|
| Swipe-down-to-dismiss on the in-show full-screen overlays | "iOS sheets do it" | Not the full-screen convention (`.fullScreenCover` has no drag dismiss); collides with scrolling the board; NN/g finds accidental dismissal a top mobile usability problem and users lose work to it | Explicit close + Escape + back gesture. If insisted on: top-32px-only, `scrollTop===0`, ≥25% travel or >0.5px/ms |
| Edge-swipe to reveal hidden chrome | Mirrors Android immersive mode | Left/right edges are the OS back gesture on both platforms; bottom is the home indicator. Android can do this because it *is* the OS | Persistent visible toggle / reveal pill |
| Timed auto-re-hide of revealed chrome | "Sticky immersive is what Android does" | Moves a tap target under a reaching thumb mid-show — direct violation of the project's "targets never move on their own" founding rule | Latch open for the session once manually revealed |
| Persisting fullscreen state across sessions | "Remember my preference" | User cold-boots into a chrome-less app and concludes it is broken | Reset on tab change and cold boot |
| Reaching the bingo board via `navigate("games")` + a back button | It is what `BingoPeekStrip` does today | Unmounts `ShowView`: drops wake-lock state, re-derives the orbit, makes system-back ambiguous. This is exactly the failure the milestone exists to fix | Portal overlay as view state inside `ShowView` |
| Bottom sheet for the bingo deal flow | Lighter-weight than a full screen | `SwapSheet` / `CatchUpSheet` open on top → sheet-on-sheet, the stacked-overlay confusion NN/g documents | Full-screen overlay with one sheet above it |
| Auto-presenting the deal overlay at Start Show | "Prompt them at the right moment" | An overlay appearing over the logging loop intercepts a tap the user has already committed to | A dismissible in-flow nudge that *offers* the overlay |
| Action button on bingo **mark**-toasts | Consistency with the other tiers | Mark-toasts fire several times a show in the bottom overlay zone above the FAB — a fresh 44px target spawning repeatedly under a reaching thumb | Badge/supernova tiers only |
| Whole-toast tap target | "Bigger target = easier to hit" | A full-width ephemeral tap surface over the FAB / suggestion zone is an accidental-activation trap | Explicit trailing button; rest stays `pointer-events-none` |
| Toast action as the *only* path to a destination | "Fewer places to build" | Auto-dismissing content cannot be the sole route; miss it and the feature is gone | FAB row is the permanent path (gate on this) |
| Queuing over-cap reactions for later playback | "Don't lose anyone's reaction" | A reaction arriving 20s late is a lie about presence | Drop excess; coalesce bursts into `×N` |
| Playing the fly-up only when the viewer is on the sender's tab | "Only show what's relevant" | Swallows most reactions in a 5-person group; the point is cross-app awareness | App-global host, anchored to the *sender's* section |
| Sound on reactions | "More alive" | Live venue; phone in a pocket; zero value, real annoyance | Silent |
| Persistent accumulating reaction counter | "See total engagement" | Turns an ephemeral moment into a scoreboard and permanent chrome | Ephemeral particles only |
| Registering reaction particles with `useBottomOverlayHeightRegistration` | "Every overlay registers" | Particles reserve no layout; registering shoves the FAB on every reaction | Explicitly exclude |
| Renaming the presence **wire** tokens along with the display labels | "Rename it everywhere" | Breaks presence interop between friends on different builds; invalidates the `TABS` allow-list and `reduceActivity` validation | Freeze wire tokens, add a display map |
| Shrinking only the GizzVerse label to fit | "Only that one is too long" | Mixed label sizes read as a rendering bug | Uniform size change for all five |
| Color-coded difficulty tiers (green/amber/red) | Instantly readable | Color-alone violates a11y and breaks the `UI-SPEC` accent reservation | Ordinal glyph count + text label |
| Showing the `InstallBanner` more often to offset the relocation | "Don't lose installs" | web.dev: disruptive promotion reduces usability and hurts engagement; contradicts shipped D-22 | Keep the once-per-build gate; keep the `AppMenu` fallback row |
| Renumbering the `config.ui.z` ladder to "fix" the layering bug | Fastest apparent fix | Two documented regression guards (`page < sheetScrim`, `fabScrim < fab`) could silently break | Identify the actual offending surface first; add the ordering test |

---

## Feature Dependencies

```
useChromeVisibility()  [the keystone]
    ├──required by──> Hide tabs in-show (#4)
    ├──required by──> GizzVerse fullscreen toggle (#9)
    ├──required by──> reservedBottomPx consumers (AppShell, FabMenu, strips, toasts)
    └──required by──> Reaction anchor fallback (#6, when the tab bar isn't rendered)

Sheet up/down animation + z-tier verification
    └──required by──> <FullScreenOverlay>
                          ├──required by──> Bingo board overlay (#2)
                          │                     └──required by──> Bingo toast deep-link (#3)
                          └──required by──> Bingo deal overlay (#1)

Back-gesture history handling
    └──required by──> <FullScreenOverlay>   (dismiss, not tab-jump)

TAB_DISPLAY_LABEL map (wire tokens frozen)
    ├──required by──> Tab rename (#5)
    └──required by──> Reaction fly-up aria-live section naming (#6)

presenceActivity.Activity.tab  [shipped]
    └──required by──> Reaction spawn anchor (#6)

FAB "Bingo card" row  [permanent path]
    └──gates──> Bingo toast deep-link (#3)   // Material: a toast action must be non-essential

Reaction fly-up ──replaces──> WaveToast presentation (reverses shipped D-10 FIFO drain)
Reaction fly-up ──reduced-motion-falls-back-to──> WaveToast (keep the component)

Timed chrome auto-re-hide ──conflicts──> "tap targets never move on their own" (founding constraint)
Edge-swipe chrome reveal ──conflicts──> OS back gesture (both platforms)
Bottom-sheet deal flow ──conflicts──> SwapSheet / CatchUpSheet (sheet-on-sheet)
```

### Dependency notes

- **`useChromeVisibility` is the keystone and should land first.** Four features consume it, and one of them (the reaction anchor) will otherwise be built against a tab bar that may not exist. Its real cost is not the hook — it is threading `reservedBottomPx` through `AppShell`, `fabLayout.ts`, `bottomOverlayInset`, and every fixed-bottom overlay. That threading is also the natural place to fix the separately-listed installed-PWA bottom-gap bug.
- **Sheet animation + z verification before the overlays.** The overlays need an entry animation and a correct tier; doing the primitive work first means they inherit both rather than hand-rolling.
- **The toast deep-link is gated on the FAB path existing.** Build #2 before #3 (the owner's backlog already sequences it this way, for the same reason).
- **The fly-up depends on the chrome mechanism for its fallback anchor**, so the reactions phase should not precede the chrome phase — this contradicts the backlog's proposed A→B→C ordering (which puts reactions in phase B and chrome in phase C). **Recommend reordering to: chrome mechanism → immersive overlays → reactions → small polish**, or at minimum landing `useChromeVisibility` in phase A alongside the overlays.
- **Keep `WaveToast.tsx`.** It is the recommended reduced-motion fallback. Deleting it and re-implementing a static fallback is strictly more work for a worse-tested result.

---

## Prioritization matrix

| Feature | User value | Cost | Priority |
|---|---|---|---|
| `useChromeVisibility` + `reservedBottomPx` threading | HIGH (enables 4 features; fixes a real gap bug) | HIGH | **P1** |
| `<FullScreenOverlay>` + bingo board/deal overlays | HIGH (the milestone's headline live-value) | MEDIUM | **P1** |
| Back-gesture dismissal | HIGH (prevents the catastrophic "lost my place") | LOW | **P1** |
| Sheet animation + z ordering test | MEDIUM (app-wide feel; unblocks overlays) | LOW | **P1** |
| Hide tabs in-show + reveal pill | HIGH | MEDIUM | **P1** |
| Reaction fly-up + caps + reduced-motion fallback | HIGH (the "feels alive" payoff) | MEDIUM | **P1** |
| Tab rename with frozen wire tokens | MEDIUM (clarity; avoids a presence bug) | LOW | **P1** |
| Toast deep-link action | MEDIUM | LOW | **P2** |
| GizzVerse fullscreen toggle | MEDIUM | LOW | **P2** |
| Install relocation + `AppMenu` fallback row | LOW-MEDIUM | LOW | **P2** |
| UTC-safe date helper | MEDIUM (correctness, visible at a US venue) | LOW | **P2** |
| Friends badge on the "Me" tab | MEDIUM (fixes a discoverability hole) | LOW-MEDIUM | **P2** |
| In-show reaction margin constraint | MEDIUM (protects the sacred loop) | LOW | **P2** |
| Difficulty icons | LOW (delight) | LOW | **P3** |
| Sender tab-icon pulse | LOW (delight) | LOW | **P3** |

---

## Open questions for the owner

1. **"Me" vs "Dex".** The backlog said Dex; the milestone says Me. "Me" is the standard convention but does not signal that Friends live there. Recommendation: **Me + a friends-presence badge**, or **Dex** without one. Needs a call.
2. **Swipe-down on the in-show overlays.** Recommended against with reasons. If the owner wants it anyway, the thresholded spec in §1 is the safe version.
3. **Reduced-motion reaction fallback.** Recommendation is to render the shipped `WaveToast`. The alternative (static anchored fade) is prettier and costs a new surface plus its own verification.
4. **Which surface actually paints over an open sheet?** The z-ladder as shipped already satisfies the stated invariant for toasts and celebrations. The real bug needs to be reproduced before any tier is changed — two prior regression guards are encoded only in comments.
5. **Phase ordering.** The backlog's A(overlays) → B(reactions) → C(chrome) order puts the reaction anchor's dependency after its consumer. Recommend chrome-mechanism-first, or fold it into phase A.

---

## Sources

**HIGH confidence (primary / near-primary, fetched directly):**
- [Android — Hide system bars for immersive mode](https://developer.android.com/develop/ui/views/layout/immersive) — `BEHAVIOR_SHOW_BARS_BY_SWIPE` vs `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`; "use immersive mode only when the benefit to the user experience goes beyond simply using extra screen space"; users must retain a way to reveal bars.
- [web.dev — Patterns for promoting PWA installation](https://web.dev/articles/promote-install) — placement patterns (simple / contextual / inline), "keep promotions outside of the flow of your user journeys", dismissal + remembering preference, and explicitly **no** conversion-rate data.
- [NN/g — Accidental Dismissal of Overlays](https://www.nngroup.com/articles/accidental-overlay-dismissal/) — causes of accidental dismissal, lost work, stacked-overlay confusion; "Include a visible 'Close' button for all overlays, including bottom sheets"; "Never stack multiple overlays"; support the native back gesture.
- Codebase inspection (`Sheet.tsx`, `WaveToast.tsx`, `BottomTabBar.tsx`, `AppShell.tsx`, `FabMenu.tsx`, `presenceActivity.ts`, `BingoPeekStrip.tsx`, `BingoCelebration.tsx`, `GamesView.tsx`, `DealScreen.tsx`, `AppMenu.tsx`, `InstallBanner.tsx`, `useInstallState.ts`, `SettingsView.tsx`, `config.ts` z + celebration tiers) — every dependency, z-ladder, and constant claim above is verified against source.
- [Vaul (Context7 `/websites/vaul_emilkowal_ski`)](https://vaul.emilkowal.ski/) — drawer dismissal surface (`dismissible={false}` disables outside-click, Escape, and drag-down together), scrollable-content drawers, snap points, drag handle as the explicit affordance.

**MEDIUM confidence (secondary summarizing a primary spec; the primary pages are JS-rendered and could not be fetched directly):**
- [Material Design 3 — Bottom sheets](https://m3.material.io/components/bottom-sheets/guidelines) and [Dialogs](https://m3.material.io/components/dialogs/guidelines) — modal vs standard sheets; full-screen dialogs for complex layouts and to "minimize the appearance of stacked sheets of material"; "start with a bottom sheet, and escalate to full screen if the user expands or requires more space."
- [Apple HIG — Sheets](https://developers.apple.com/design/human-interface-guidelines/components/presentation/sheets/) — sheet partially covers and communicates temporary status; full-screen modals for immersive focus; interactive swipe-down dismissal and when to disable it (`isModalInPresentation`).
- [Atomic Accessibility — Toast/snackbar](https://www.atomica11y.com/accessible-web/toast-snackbar/), [Scott O'Hara — A toast to a11y toasts](https://www.scottohara.me/blog/2019/07/08/a-toast-to-a11y-toasts.html), [w3c/wcag issue #976](https://github.com/w3c/wcag/issues/976) — WCAG 2.2.1 Timing Adjustable and actionable toasts; "If any actions are included within a toast, then it can't be set to auto-dismiss"; 4s default; manual dismissal required.
- [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [Atomic Accessibility — Animation & motion](https://www.atomica11y.com/accessible-design/animation/) — WCAG 2.3.3 (AAA); replace transform-based motion with opacity; scaling/panning are vestibular triggers.
- [Smashing — Golden Rules of Bottom Navigation](https://www.smashingmagazine.com/2016/11/the-golden-rules-of-mobile-navigation-design/), [UX Planet — Bottom Tab Bar Best Practices](https://uxplanet.org/bottom-tab-bar-design-best-practices-ef3ee71de0fc) — 3–5 destinations; more than five puts targets too close and causes mis-taps; short meaningful labels; icons need labels.
- [Access Guide — Don't use color alone](https://www.accessguide.io/guide/colorblind), [NN/g — Visual Treatments that Improve Accessibility](https://www.nngroup.com/articles/visual-treatments-accessibility/) — never encode meaning in color alone; pair with icon + text.
- [Progressier — PWA display modes](https://intercom.help/progressier/en/articles/7999596-understanding-pwa-display-modes), [firt.dev — What's new on iOS 12.2 for PWAs](https://medium.com/@firt/whats-new-on-ios-12-2-for-progressive-web-apps-75c348f8e945) — iOS standalone PWAs have no back button but do have edge-swipe back navigation across client-side routes.
- `pushState` + `popstate` for back-button modal dismissal in web apps ([Ionic](https://daviddalbusco.medium.com/how-to-close-ionic-modals-using-the-hardware-back-button-aaddeb23dd35), [DEV](https://dev.to/maikmichel/closing-dialogs-by-going-back-46pe)) — the pattern is uncontroversial and consistently described across sources.

**LOW confidence — reasoning from observed convention, no verifiable source found. Tune on-device:**
- All floating-reaction motion parameters in §4 (travel, duration, easing, drift amplitude, rotation, scale, jitter). Searches for published specs or engineering write-ups on Facebook / Instagram / Twitch reaction rendering returned only stock motion-graphics assets and unrelated data-pipeline material. Values are inferred from observed behavior and sized against this app's existing constants (`SUPERNOVA_ORB_COUNT: 12`, `SUPERNOVA_ORB_TRAVEL_PX: 180`, `MARK_TOAST_MS: 1800`).
- Reaction concurrency cap, per-sender coalescing threshold, and global rate cap — no source; derived from a 5-user group size plus the existing `QUEUE_CAP` precedent.
- "Me" vs "Dex" vs "You" tab-label discoverability — searches surfaced general tab-bar guidance but **no comparative research** on these specific labels. The recommendation rests on the structural argument (the tab now contains other people's data) rather than evidence.
- "Don't persist fullscreen state across sessions" — a widely understood failure mode; I found no citable study.

---
*Feature research for: v2.1 UX/UI Polish — Gizz With Friends (Guezzer)*
*Researched: 2026-07-24*
