# Phase 22: Surface Motion & the Chrome Mechanism - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Animate the one shared `<Sheet>` primitive — enter, exit, and scrim cross-fade — without
losing a single accessibility guarantee; debut the chrome-hide mechanism on GizzVerse with
its escapability, accessibility-tree and no-reheat invariants proven on the surface where a
stranded user costs least; and relocate the add-to-home-screen path to the bottom of
Settings with the Android install confirmed on a real device.

**Requirements:** SHEET-01, SHEET-02, CHROME-01, CHROME-03, CHROME-04, CHROME-05, NAV-05, NAV-06

**Not in this phase:** in-show tab auto-hide (CHROME-02, Phase 23), the bingo deal/board
full-screen overlays (INSHOW-01..05, Phase 23), reaction fly-ups (Phase 24), migrating the
five hand-rolled sheets onto the primitive (deliberately deferred, see D-14), and NAV-03's
un-run mixed-build presence check (stays Phase 21's recorded gap, see D-38).

</domain>

<decisions>
## Implementation Decisions

### The chrome mechanism — trigger and escape (CHROME-01, CHROME-03)

- **D-01: A dedicated toggle button, not a canvas gesture.** One visible control that flips
  between hide and show and never moves — the same pixel in both states, which satisfies
  CHROME-01's "a control that stays visible in the same place" literally and makes CHROME-03's
  ≥44px / inside-the-safe-area / first-in-tab-order bar trivially provable. Canvas tap was
  rejected: `ExploreView` already spends single-tap on node focus + chain-hop AND on
  collapsing the filter panel (`filterOpen` is owned in `ExploreView` specifically "so a canvas
  tap can collapse it without a scrim"), so a third meaning for the same gesture is a
  mis-fire waiting to happen while panning.
- **D-02: Top-right of the constellation stage.** Clear of both existing bottom surfaces:
  `ExploreFilterFab` sits bottom-right, and a focused `NodeSheet` peeks ~40% up from the
  bottom (`ConstellationCanvas` deliberately centers the focused node in the upper 60% to
  clear it — see `FOCUS_TARGET_TOP_FRACTION`). A bottom-anchored toggle would be buried under
  `NodeSheet` exactly when the user is deepest in the view, which breaks CHROME-03's
  "always rendered, always visible".
- **D-03: The view opts in — GizzVerse renders the button, the shared module owns the state.**
  Do NOT render a global toggle from `AppShell`: chrome-hide on four other tabs is a
  capability CHROME-01 does not ask for, and each would then need its own escapability and
  a11y verification. Phase 23's consumer (CHROME-02) has a different trigger entirely —
  auto-hide while tracking, no button — which is the proof that control and mechanism must be
  separable.
- **D-04: Escape restores chrome; the Android back gesture does not.** Escape hooks the app's
  shipped LIFO dismiss stack (`components/a11y/useDialogDismiss.ts`), so a keyboard user gets
  the same out they get from every sheet. The OS back gesture is deliberately left alone —
  hijacking it means pushing a history entry, and this app has hash-only navigation with no
  router; a spurious entry would make back-out-of-the-app unpredictable mid-show. Phase 23's
  INSHOW-02 wants the back gesture for the bingo overlay — that mechanism should be built
  once, deliberately, there, not debuted on a chrome toggle.
- **D-05: Two accessible names describing the next action.** "Hide bars" while chrome is
  visible, "Show bars" while hidden — the label always names what the tap will do. Matches the
  app's shipped idiom (`aria-label="Menu"` / `"Close menu"`). Rejected `aria-pressed`: it is
  the more correct toggle-button semantic in the abstract, but the app has no existing
  `aria-pressed` control, and introducing a new idiom on the one control that must never
  confuse anyone is the wrong place to start. **Wording lives in `config.copy`.**
- **D-06: No discovery affordance.** A recognizable expand/collapse icon carries it; the cost
  of missing it is zero (the app works exactly as it does today). No once-per-build hint flag,
  no dismissal state. The app already carries one onboarding nag (`InstallBanner`) whose
  gating logic took two rounds to settle (Phase-6 D-22) — do not add a second.

### The chrome mechanism — motion, a11y tree, and the resize contract (CHROME-04, CHROME-05)

- **D-07: The box collapses FIRST, then the chrome slides out over the stage.** The canvas
  gets its full height immediately — **exactly one resize**, so CHROME-05's assertion stays
  trivially true — while the header and tab bar slide away on top of it as a pure transform
  that costs no layout. This ordering is the whole point: animating the box would produce a
  continuous stream of `ResizeObserver` callbacks. `prefers-reduced-motion` falls back to
  instant.
- **D-08: Hidden chrome leaves the a11y tree at animation START; unmount at end.** `inert` +
  `aria-hidden` the instant the toggle is tapped, DOM removal when the slide finishes. A
  keyboard or VoiceOver user can never reach a control that is visually on its way out. **This
  is deliberately the same close-start principle as D-19** — the phase has one timing rule for
  both halves, not two. The app already has a ref-counted `inert` helper in
  `components/a11y/useFocusTrap.ts`.
- **D-09: Automated proof only for CHROME-05 — no device item.** A jsdom test that toggles
  chrome and asserts (a) the container resize callback fires exactly once and (b) `zoomToFit`
  is not re-called. The requirement's own wording is "asserted by test", and the simulation is
  already structurally safe: `ConstellationCanvas` pins `fx`/`fy` at `onEngineStop` so later
  reheats are inert, and `hasFitRef` already gates the camera against resize snaps (UX-04).
  This phase already budgets two device items (SHEET-02, NAV-06); a third has real cost.

### What "chrome" means, and how sticky (CHROME-01, CHROME-03)

- **D-10: App chrome only — header + `BottomTabBar`. The `ExploreFilterFab` stays.** Exactly
  what CHROME-01 names. The edge slider and top-K declutter stay reachable in immersive mode,
  which is when density tuning matters most. It is also the only version where "chrome" means
  the same thing in Phase 23's live-show use — a view-specific definition would have to be
  redefined there.
- **D-11: Nothing is persisted. Hidden state resets on leaving GizzVerse.** Plain component
  state — no `sessionStorage`, no `db.meta` row, no storage key. CHROME-03's "a cold boot never
  starts hidden" becomes true *by construction* rather than by a rule someone must maintain,
  and escapability is unconditional. Accepted cost: switching to Map and back is one extra tap
  to re-hide.
- **D-12: Build the shared mechanism now; GizzVerse is consumer #1.** One small
  chrome-visibility module that `AppShell` consumes and any view can drive — the same
  `useSyncExternalStore` registry shape as `pwa/bottomOverlayInset.ts`, and the natural partner
  to `layout/bottomSpace.ts`'s already-pinned `chromeVisible` seam (Phase-21 D-16). Phase 23
  then wires `ShowView` to it instead of refactoring a shipped, device-verified surface. This
  IS the roadmap's stated reason for debuting on the easier surface. **Flip `chromeVisible`;
  do not build a second layout state.**
- **D-13: The top safe-area inset stays — the constellation does NOT run under the notch.**
  Only the header bar disappears; the stage still starts below the status bar. No new
  top-inset arithmetic, and the toggle sits inside the safe area with no special offset. This
  project has been bitten by top-inset math twice (the doubled-inset bug UX-01/D-01, and the
  Phase-21 bookmark-vs-standalone confusion), and CHROME-03 requires the exit control be
  provably inside the safe area.
- **D-14 (chrome/NodeSheet): An open `NodeSheet` stays open and settles down into the freed
  space.** It is `fixed bottom-0` composing from `--gz-chrome-reserve`, so collapsing that
  reserve moves it for free — the Phase-21 D-16 seam doing exactly what it was built for, with
  no special case and no new code. It is non-modal, so nothing about focus or Escape changes.
  Rejected pinning it in place: that requires deliberately exempting one surface from the
  reserve, i.e. re-introducing a hand-written offset in the one place Phase 21 just finished
  eliminating them.
- **D-15: A toast firing while chrome is hidden shows at the collapsed position; chrome stays
  hidden.** Toasts compose from `--gz-chrome-reserve`, which has collapsed to bare safe-area,
  so they simply sit lower. No special case, no code. Forcing chrome back was rejected — it
  yanks the user out of a state they deliberately entered, triggered by an event they did not
  cause, and one of those events is the update-available prompt, which must never
  surprise-swap the app mid-show. Suppressing toasts was rejected — the update prompt is a
  safety surface and hiding it is the wrong failure direction.

### Sheet motion — scope and structure (SHEET-01)

- **D-16: The `<Sheet>` primitive only — the 15 importing files. The five hand-rolled sheets
  stay static.** Honors Phase-21 D-22, which kept `SearchSheet`, `AlbumDetail`,
  `ArchiveBrowser`, `SetlistView` and `NodeSheet` off the primitive precisely so this phase's
  blast radius stayed at 15 surfaces, not 20. Zero shipped VoiceOver-verified surfaces get
  rewritten. **Named, accepted cost:** `SearchSheet` is the one-thumb, in-the-dark surface
  used most at a show, and it will visibly not animate while everything else does. Do not
  "fix" this by copying the animation into the five — that recreates the scattered-duplication
  pattern Phase 21 spent thirteen plans eliminating.
- **D-17: Enter and exit land in one slice, with the exit isolated in its own atomic commit.**
  The device session then verifies the finished behavior once, and a failed VoiceOver/keyboard
  check reverts the exit commit alone, leaving a clean enter-only build — the degraded ship
  SHEET-02 explicitly sanctions. This is Phase-21 D-13's shape ("per-surface revertibility, no
  compatibility shim"), which held across thirteen plans.
- **D-18: "Backable-out" means clean revert — NO runtime kill-switch and NO feature flag.**
  Restates Phase-21 D-13 for this milestone. A flag ships both code paths, both need testing,
  and the un-animated path rots unexercised until the night it matters. `prefers-reduced-motion`
  remains a genuine user-controlled no-motion mode at zero extra cost.

### Sheet motion — the a11y contract (SHEET-02)

- **D-19: Everything but unmount fires at close-START.** The instant close is requested:
  release `inert` on the background, restore focus to the trigger, `aria-hidden` the exiting
  sheet, and set both sheet and scrim to `pointer-events: none`. Only DOM removal waits for
  the animation. A tap landing anywhere in the exit window reaches the real background — which
  is literally what SHEET-02 demands. **Same rule as D-08**; the phase has one timing
  principle. Note `useFocusTrap` today ref-counts `inert` and restores focus on deactivate,
  all at once — that teardown must be split from unmount, not merely delayed with it.
- **D-20: A jsdom test asserts the close-start contract on every commit.** Open a sheet,
  request close, and before the exit completes assert: background not `inert`, focus back on
  the trigger, sheet and scrim `pointer-events: none`. The device check proves it once on real
  VoiceOver; this keeps it true forever. Same instinct as Phase-21 D-12/D-24, which is how the
  bottom-space and portal invariants stay honest. A *source* guard was considered and rejected
  as low-value — Phase 21 learned that pattern-matching guards cannot catch a surface that
  simply omits the thing (the ArchiveBrowser bug, `61e0b90`).
- **D-21: The SHEET-02 device session covers a named sample chosen by PROP SHAPE, not by
  surface count.** Roughly four sheets spanning the distinct configurations: a `fullscreen`
  variant (`CompareView` / `FriendDetail` / `DexView`), a bottom-sheet with backdrop, one with
  `initialFocusRef` (`SettingsView`'s name input or `PinSheet`'s label input), and one opened
  from inside a stacking context Phase 21 portaled. Plus the close-start tap test on each. The
  primitive is shared, so a primitive defect appears in all 15 — what actually varies is the
  prop combination.
- **D-22: Interrupting the enter closes immediately, reversing from the current position.**
  `AnimatePresence` interrupts and animates out from wherever it is — no queueing, no waiting.
  Input is never ignored, which matters most in the dark at a venue. The D-19 close-start
  teardown fires as normal, so there is one rule rather than an interrupted-open special case.

### Sheet motion — mechanism and feel (SHEET-01)

- **D-23: `AnimatePresence` + `motion.div` — the app's existing idiom.** `WaveToast` and
  `BingoCelebration` already do exactly this (`initial`/`animate`/`exit` with
  `useReducedMotion()` swapping the transform for opacity-only). `motion` 12.42 is already a
  dependency, so **zero new runtime deps** (a standing milestone constraint). Critically, it
  owns the deferred-unmount timing that `Sheet`'s current `if (!open) return null` guard makes
  impossible — and that timing is exactly what D-19 hinges on. Hand-rolling it with CSS +
  a timer was rejected: it re-implements the one mechanism SHEET-02 depends on.
- **D-24: ~200ms, sheet translates up while the scrim cross-fades in PARALLEL.** Same duration
  and curve family the app's toasts already use, so nothing reads as a different app. Fast
  enough that the close-start window a stray tap can land in stays short. Reduced motion drops
  the translate and keeps opacity, exactly as `WaveToast` does. Staged timing (scrim leading on
  enter, lagging on exit) was rejected — it leaves the scrim painted after the sheet is gone,
  requiring `pointer-events: none` from the first exit frame as a subtle, easily-regressed rule.
- **D-25: Constants go in `config.ui`.** `WaveToast`'s hard-coded `transition={{ duration: 0.2 }}`
  is exactly the scattered magic number CLAUDE.md forbids — do not copy it, and prefer moving
  it to config if touched.
- **D-26: `variant="fullscreen"` fades; only bottom sheets slide.** A full-bleed overlay
  sliding the whole viewport height reads as a page transition, not a sheet, and feels slow at
  200ms. SHEET-01's wording is specifically "every bottom **sheet**", so a quieter treatment
  for the fullscreen variant is consistent rather than inconsistent. Live fullscreen consumers:
  `CompareView` (×2), `DexView`, `FriendDetail` (×2).
- **D-27: `initialFocusRef` focus fires AFTER the enter animation completes.** `SettingsView`
  and `PinSheet` focus a text input on open, which opens the iOS keyboard; focusing a
  translating element means two layout changes racing on the platform where this app's viewport
  math has misfired before. Phase-21 D-17 already flagged keyboard-up arithmetic as a live risk
  left un-fixed absent a reproduction — focusing mid-flight is the most likely way to create
  one. Accepted cost: ~200ms before the user can type.
- **D-28: Stacked-sheet scrims are left exactly as they ship.** Two open sheets both paint a
  scrim and the background reads darker; that is shipped, verified, unreported behavior.
  Animating changes nothing about the stacking — only that the second scrim fades in.
  Suppressing a nested scrim requires the primitive to track how many sheets are open, and
  getting that count wrong leaves either a permanently dark background or an un-dismissable
  sheet — real new state on the phase's highest-risk file for a cosmetic gain.
- **D-29: No swipe-down-to-dismiss — an explicit, recorded NON-GOAL.** Phase 23's INSHOW-03
  already rules it out by name ("never via a swipe-down that could land a spurious tap on the
  orbit stage"), and `Sheet`'s own doc says it deliberately owns no drag geometry. Recorded
  here so it is not re-proposed as the obvious follow-on to "we added motion".
- **D-30: Heavy-content sheets ship as-is; observe on-device and fix only what stutters.**
  `ShareCardSheet` pre-builds a PNG `File` on open and `CompareView` re-runs `deriveDex` over a
  friend envelope — the animation adds no work, it only makes an existing hitch legible. The
  `ShareCardSheet` pre-build is deliberate (Phase-6 Pitfall 7: the share tap must have no async
  before `navigator.share`) and must not be deferred to "fix" a jank nobody has seen. Add a
  numbered observation to the device session.
- **D-31: Keep `modal={false}` / `backdrop={false}`; correct the stale doc comment.** Every
  current `<Sheet>` consumer passes `modal` — `NodeSheet`, the variant those props were written
  for, is hand-rolled and never used them, so the path has **zero live consumers**. The prop
  doc still says "the NodeSheet variant, D-02", a claim no consumer backs — the same shape of
  stale comment Phase 21 had to correct in `presenceActivity.ts`. Keep the capability (Phase
  23's overlays may want it) but say plainly that the path is currently unexercised, so nobody
  reads it as verified.

### Install relocation (NAV-05, NAV-06)

- **D-32: One platform-adaptive install section at the bottom of Settings, hidden once
  installed.** It renders the Android install button when `beforeinstallprompt` was captured,
  the illustrated iOS steps on detected iOS Safari, and the existing "can't auto-install here"
  fallback otherwise. One section, one heading. This is the same three-way shape `AppMenu`
  implements today, relocated and gated on installed-ness. It must go BELOW the existing
  sections (owner identity → data/export → rotation reset).
- **D-33: Hoist `beforeinstallprompt` capture to a module-level singleton; hooks subscribe.**
  REQUIREMENTS §Verification Notes already flags this as blocking NAV-06: the event is one-shot
  and fires early, but `useInstallState()` captures it in component-local state, so a Settings
  section mounted later never sees it. One listener at module load stashes the event;
  `useInstallState()` becomes a `useSyncExternalStore` subscriber — same shape as
  `pwa/bottomOverlayInset.ts`. **This also fixes a latent bug:** `AppMenu` and `InstallBanner`
  each register their own listener with their own `deferredRef` today, so they can disagree
  about `canInstall`. A context provider was rejected — anything portaled outside it silently
  gets nothing, the hardest failure mode to notice.
- **D-34: The menu keeps ONE neutral "Add to Home Screen" row that navigates, and it hides
  once installed.** It replaces the current gold-accent "Install Gizz With Friends" button AND
  the inline iOS steps, which leave the menu entirely rather than living in two places. Naming
  the destination is honest — the row navigates, it does not install. Retiring the accent fill
  here matters: the app deliberately keeps accent for one primary CTA per surface. The row and
  the Settings section share one gate so they can never disagree.
- **D-35: The deep-link navigates to `#/settings`, scrolls the section into view, and moves
  focus to its heading.** No new routing concept — hash routes stay a validated allow-list, as
  NAV-02 requires. Scrolling alone is a sighted-user affordance; the focus move is what makes
  the deep-link real for keyboard and VoiceOver users, which matters in the phase that
  re-verifies both. A real hash fragment (`#/settings#install`) was rejected: the router has no
  fragment parsing, and nobody will ever type the link.
- **D-36: `isStandalone()` is evaluated once at load, but read from the shared store.** A page
  cannot transition into standalone mode — an install opens a new instance — so re-evaluating
  buys nothing. What matters is that both gated surfaces read the SAME value; today
  `isStandalone()` is called independently per `useInstallState()` instance, the same
  divergence D-33 fixes for `canInstall`. Fold it into the same store.
- **D-37: `InstallBanner` is left as-is.** NAV-05 names the instructions and the menu row, not
  the banner — and the banner is what gets a new user to the relocated section. It gets a free
  correctness win from D-33's shared capture with no change of its own. Retiring it was
  rejected: it is the only proactive install prompt, and an uninstalled iOS PWA is exactly the
  IndexedDB-eviction risk this project has flagged repeatedly.

### Scope boundary held

- **D-38: NAV-03's un-run mixed-build presence check stays Phase 21's recorded gap.** It
  belongs to Phase 21's requirements; folding another phase's unmet verification in is scope
  widening on a phase already carrying SHEET-02's VoiceOver/keyboard session plus NAV-06's
  Android install. It is not free either — it needs two devices on two *different* builds with
  the harness base at `e92d4a8`. STATE.md's warning is that no later phase should read it as
  closed; that remains true and this phase does not.

### Claude's Discretion

- The exact icon for the chrome toggle and the visual styling of the Settings install section.
  This phase carries a **UI hint: yes** in ROADMAP.md — `/gsd-ui-phase 22` is available to
  produce a UI-SPEC before planning.
- The precise easing curve and the exact `config.ui` constant names for the sheet transition,
  within the ~200ms / parallel-scrim envelope of D-24.
- The internal shape of the chrome-visibility module (D-12), provided it composes with
  `layout/bottomSpace.ts`'s `chromeVisible` parameter rather than duplicating it.
- Slice ordering within the phase, subject to the roadmap's own constraint that the sheet
  animation lands as the first slice and stays backable-out.

### Folded Todos

- **`.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`**
  (tagged `resolves_phase: 22`) — the *animation* half; its always-on-top layering half already
  shipped as Phase-21 FOUND-03 (D-20…D-30). This phase's SHEET-01/02 work IS that half, so
  **this todo closes here.** Its recommendation of a centralized z-tier scale is already done
  (`config.ui.z`); its cited `ExploreFilterFab` z-30 vs `AppMenu` z-20 instance is retired.
- **`.planning/todos/pending/2026-08-05-add-apple-mobile-web-app-capable-so-ios-installs-are-determi.md`**
  — add `apple-mobile-web-app-capable` to `packages/app/index.html` beside the existing Apple
  meta tags, AND prove install mode (`sab` / `standalone` / `innerH`) via the Phase-21
  `?layoutProbe=1` harness before grading the NAV-06 Android install. This is the direct lesson
  from Phase 21: a bookmark-mode launch is visually identical to a real install, reports
  `sab: 0`, and silently invalidated four tests and a whole session. NAV-06's evidence is only
  worth something if install mode is proven first.
- **`.planning/todos/pending/2026-08-05-setlistview-loading-state-is-an-unrecoverable-aria-modal-trap.md`**
  (CR-02) — **fix by distinguishing the two states, not by adding a close button.**
  `useLiveQuery(() => db.archiveShows.get(showId))` returns `undefined` both while resolving
  and when no row exists, and `SetlistView.tsx:137`'s comment ("hasn't resolved *yet*") encodes
  the assumption that the second case cannot happen. Resolve that ambiguity: keep a brief
  hold-the-frame for genuine loading, render a labelled error state with a working Back control
  for the permanent case. Also fix `aria-label={copy.albumBack}`, which makes VoiceOver
  announce this blank blocker as "Back" — the one thing it does not offer. Migrating it onto
  `<Sheet>` is explicitly NOT the fix (contradicts D-16).
- **`.planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md`** (CR-01) —
  give bottom overlays a **declared stack order** and offset each by the summed height of the
  visible overlays beneath it. Registrations become keyed by name with a fixed order in
  `config.ui` (banner bottom-most, toasts above); each overlay composes from
  `--gz-chrome-reserve` plus what is below it. The store already measures every height — it
  simply has no ordering concept, which is why two visible overlays overlap while `<main>`
  over-reserves the sum. Keeps the Phase-21 single-owner model intact and makes the reserve
  correct rather than merely safe. Enforcing one-overlay-at-a-time was rejected:
  `InstallBanner` is persistent, not transient, so it would have to suppress or be suppressed
  by every toast including the update prompt.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and standing constraints
- `.planning/ROADMAP.md` §"Phase 22: Surface Motion & the Chrome Mechanism" — the five success
  criteria this phase is judged against, including the "enter-only animation is an explicitly
  acceptable degraded ship" clause.
- `.planning/ROADMAP.md` §Coverage note on the CHROME split — why CHROME-03/04/05 were moved
  from the proposed Phase 23 into this phase (they are mechanism invariants, and Phase 22 is
  the first phase in which a user can ENTER chrome-hidden state).
- `.planning/REQUIREMENTS.md` §"Chrome & Immersion" + §"Sheets" + §"Navigation & Install" —
  CHROME-01/03/04/05, SHEET-01/02, NAV-05/06 verbatim.
- `.planning/REQUIREMENTS.md` §"Verification Notes" — **the `beforeinstallprompt` one-shot
  capture note that D-33 resolves**, and the SHEET-02 note that the animation invalidates the
  shipped A11Y-01 verification.
- `.planning/v2.1-ux-polish-backlog.md` — the 12 owner items this milestone derives from.
- `.planning/research/SUMMARY.md` — v2.1 research synthesis (source of the regression-risk
  findings that make the sheet primitive the first slice).
- `CLAUDE.md` §Constraints — single-config-file rule (no scattered magic numbers, see D-25),
  strict core/UI separation, **zero new runtime dependencies** (D-23 satisfies this).

### Prior decisions this phase must not unpick
- `.planning/phases/21-layout-layering-foundations/21-CONTEXT.md` — **read in full.**
  Especially D-07 (sheet-pad vs chrome-reserve split), D-13 (per-surface revertibility, no
  flag), D-16 (the `chromeVisible` seam this phase flips), D-22 (why the five hand-rolled
  sheets are off the primitive), D-24 (the structural portal invariant), D-26 (the modal-only
  invariant and the named non-modal exceptions).
- `.planning/STATE.md` §"Carried into Phase 22 — read before planning" — the five carried
  warnings, including that `bottomSpace.test.ts` is pattern-matching and CANNOT catch a surface
  that omits the inset entirely (a gap that shipped a real bug in `ArchiveBrowser`, fixed in
  `61e0b90`). **New bottom-anchored surfaces need a positive assertion, not guard silence.**
- `.planning/phases/21-layout-layering-foundations/21-VERIFICATION.md` and `21-HUMAN-UAT.md`
  (`status: partial`) — NAV-03 is an accepted override, not a pass. Do not read it as closed
  (D-38).
- `.planning/phases/21-layout-layering-foundations/21-UI-SPEC.md` — the shipped visual contract
  the toggle button and Settings section must sit inside.
- `.planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md` — the device-UAT
  format `22-HUMAN-UAT.md` should follow (device model, OS version, numbered pass/fail).

### Folded todos (full context + the owner's own constraints)
- `.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`
  (animation half — **closes in this phase**)
- `.planning/todos/pending/2026-08-05-add-apple-mobile-web-app-capable-so-ios-installs-are-determi.md`
- `.planning/todos/pending/2026-08-05-setlistview-loading-state-is-an-unrecoverable-aria-modal-trap.md`
- `.planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md`

### Code the phase rewrites (read before planning)
- `packages/app/src/components/Sheet.tsx` — the primitive. Note its `if (!open) return null`
  guard (V7 / T-08-04) is what currently makes an exit animation impossible, and its stale
  `modal={false}` "NodeSheet variant" doc comment (D-31).
- `packages/app/src/components/a11y/useFocusTrap.ts` — the ref-counted `inert` + focus-restore
  teardown that D-19 must split from unmount.
- `packages/app/src/components/a11y/useDialogDismiss.ts` — the LIFO Escape stack D-04 hooks.
- `packages/app/src/components/WaveToast.tsx:158-168` and
  `packages/app/src/components/BingoCelebration.tsx` — the shipped `AnimatePresence` +
  `useReducedMotion` idiom D-23/D-24 follow (including the hard-coded `duration: 0.2` D-25
  says not to copy).
- `packages/app/src/layout/bottomSpace.ts` — the single owner; the `chromeVisible` parameter
  (Phase-21 D-16) is the ONE source D-12 flips.
- `packages/app/src/components/AppShell.tsx` — header, `<main>` reserve, `BottomTabBar`; the
  three things that hide, and the caller of `useBottomSpaceVars()`.
- `packages/app/src/explore/ExploreView.tsx` — owns `focusId`/`view`/`topK`/`filterOpen`;
  where the toggle and the hidden-state ownership land (D-03).
- `packages/app/src/explore/ConstellationCanvas.tsx:176-260, 654-780` — the `ResizeObserver`
  → `setSize` → `ForceGraph2D` chain, `hasFitRef`, `cooldownTicks`/`onEngineStop`. The exact
  surface D-07/D-09 assert against.
- `packages/app/src/explore/NodeSheet.tsx:148-180` — `fixed bottom-0`, `aria-modal={false}`;
  the D-14 rider.
- `packages/app/src/pwa/install/useInstallState.ts` — the component-local `beforeinstallprompt`
  capture D-33 hoists.
- `packages/app/src/pwa/install/platform.ts` — `isStandalone()` / `isIosSafari()`, both
  best-effort (Pitfall 3); D-36 shares the former.
- `packages/app/src/pwa/bottomOverlayInset.ts` — the `useSyncExternalStore` registry that is
  both the template for D-12/D-33 and the module CR-01 modifies.
- `packages/app/src/components/AppMenu.tsx` — the gold Install CTA + inline iOS steps D-34
  replaces with one neutral row.
- `packages/app/src/components/IosInstallInstructions.tsx` — the illustrated steps that move
  into Settings.
- `packages/app/src/settings/SettingsView.tsx:159-330` — the three existing sections the
  install section goes below (D-32), and one of the two `initialFocusRef` consumers (D-27).
- `packages/app/src/map/PinSheet.tsx:77` — the other `initialFocusRef` consumer (D-27).
- `packages/app/src/dex/SetlistView.tsx:90-140` — the CR-02 trap.
- `packages/app/index.html:5-11` — where `apple-mobile-web-app-capable` goes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`motion` 12.42 is already a dependency** and `AnimatePresence`/`useReducedMotion` are
  already the app's idiom in `WaveToast`, `BingoCelebration` and `OrbitStage`. D-23 adds no
  dependency and no new pattern.
- **`pwa/bottomOverlayInset.ts`** — a `useSyncExternalStore` height registry with a
  `ResizeObserver` and a jsdom fallback. It is the structural template for BOTH the
  chrome-visibility module (D-12) and the install-state singleton (D-33), and the module CR-01
  extends with an ordering concept.
- **`layout/bottomSpace.ts`'s `chromeVisible` parameter** — already written, already tested,
  ships pinned `true` with no caller passing `false`. Flipping it is the entire layout half of
  CHROME-01.
- **`components/a11y/useFocusTrap.ts` + `useDialogDismiss.ts`** — ref-counted `inert`, focus
  restore, and a LIFO Escape stack. D-04 reuses the Escape stack; D-19 re-times the teardown.
- **`ConstellationCanvas`'s `hasFitRef` gate (UX-04)** — already prevents the camera snapping
  to zoom-to-fit on container resize, and `onEngineStop` already pins `fx`/`fy` so later
  reheats are inert. CHROME-05 is largely satisfied structurally; the work is asserting it.
- **`?layoutProbe=1` and `?layerRepro=1`** (Phase-21 plan 21-01) — shipped dev harnesses. The
  layout probe is what D-32/NAV-06 use to prove install mode before grading.
- **`config.ui.z`** — the tier ladder with its INVARIANT comment, the D-03 `focusedFab`
  exception, and the WR-01/CR-01 numeric guards. No tier is renumbered in this phase.

### Established Patterns
- **All z-index goes through `config.ui.z` as an inline `style`, never a Tailwind class** —
  `config.ts:242-250` explains why. Production has zero `z-*` utility classes.
- **Guard tests over source text and over invariants** — `configMirror.test`, the cover-art
  budget guard, `bottomSpace.test.ts`, the Phase-21 portal invariant. D-20 follows this shape.
  Note the shipped limitation recorded in STATE.md: pattern-matching guards cannot catch an
  omission.
- **Never-throw display helpers and calm error states** — `formatMonYear`, `wakeLock.ts`,
  `persist.ts`, and `ExploreView`'s `loadMatrix().ok === false` path which blocks only the view
  and never bricks navigation. The CR-02 fix should read like these.
- **User-facing wording lives in `config.copy`** — D-05's toggle labels and D-34's row label
  both belong there.
- **Device-verified items are recorded in a phase `-HUMAN-UAT.md`** with device model, OS
  version and numbered pass/fail. This phase needs one for SHEET-02 (D-21) and NAV-06 (D-32).
- **Reduced motion is honored per-surface via `useReducedMotion()`**, swapping transforms for
  opacity rather than disabling the transition outright (`WaveToast:164-166`).

### Integration Points
- `AppShell.tsx` → `useBottomSpaceVars()` → `layout/bottomSpace.ts` — where `chromeVisible`
  must become a real input rather than a pinned default (D-12).
- `AppShell.tsx`'s `<header>` and `<BottomTabBar />` — the two elements D-07/D-08 animate,
  `inert` and unmount.
- `ExploreView` → `ConstellationCanvas` container `ResizeObserver` → `ForceGraph2D`
  `width`/`height` — the chain D-09 asserts fires exactly once per toggle.
- `Sheet.tsx` → `useFocusTrap` / `useDialogDismiss` → the 15 importing surfaces — the blast
  radius of D-16/D-19.
- `useInstallState()` → `AppMenu` + `InstallBanner` (+ the new Settings section) — the three
  consumers D-33's singleton unifies.
- `AppMenu` → `navigate("settings")` → `SettingsView` — the existing navigation D-35 extends
  with scroll + focus.

</code_context>

<specifics>
## Specific Ideas

- **One timing rule for the whole phase.** Both halves use the same principle: the thing
  becomes un-reachable at the START of its exit, and only leaves the DOM at the end (D-08 for
  chrome, D-19 for sheets). If a planner finds themselves writing two different rules, one of
  them is wrong.
- **Collapse the box first, then animate over it.** This is what makes CHROME-05's one-resize
  assertion true by construction rather than by careful debouncing.
- **"Add to Home Screen" should name where it goes, not what it does.** The menu row navigates;
  calling it "Install" would be a small lie now that install lives one screen further in.
- **A bookmark launch looks exactly like an install.** Prove install mode before grading any
  NAV-06 evidence — this cost a full Phase-21 session.
- **`SearchSheet` not animating is a known, accepted seam,** not an oversight. It is recorded
  in D-16 so the first person to notice it finds the reason instead of "fixing" it.

</specifics>

<deferred>
## Deferred Ideas

- **Migrating `SearchSheet` / `AlbumDetail` / `ArchiveBrowser` / `SetlistView` / `NodeSheet`
  onto the shared `<Sheet>` primitive.** Deferred once already in Phase-21 D-22 and again here
  in D-16. After Phase 22 ships and the animated primitive is device-verified, this becomes a
  much smaller decision — revisit then. It would also make CR-02's fix structural rather than
  local.
- **Swipe-down-to-dismiss on sheets.** Explicitly ruled out (D-29), in tension with Phase 23's
  INSHOW-03. If it is ever wanted, it needs its own decision, not a follow-on to this phase.
- **OS back-gesture handling as a general mechanism.** D-04 leaves it alone; Phase 23's
  INSHOW-02 genuinely needs it for the bingo overlay. Build it there, once, deliberately.
- **Suppressing nested sheet scrims so the background darkens only once** (D-28) — cosmetic,
  needs open-sheet counting in the primitive.
- **Chrome-hide on tabs other than GizzVerse** beyond Phase 23's in-show case (D-03) — not
  requested by any requirement.
- **`aria-pressed` toggle semantics** (D-05) — correct in the abstract, but the app has no
  existing consumer to be consistent with.
- **A `config.ui` runtime kill-switch for sheet motion** (D-18) — rejected here; would be worth
  revisiting only if a venue-night emergency ever actually needs one.

### Reviewed Todos (not folded)

- **Badge system, Couch Mode, Gizzle, Guezz League, Residency Mode, Shiny catches, Song
  Dossiers, My Stats & Want List, Know-Before-You-Go** (score 0.6 keyword matches from
  `todo.match-phase`) — feature ideas, not surface motion or chrome. No overlap with this
  phase's scope.

</deferred>

---

*Phase: 22-Surface Motion & the Chrome Mechanism*
*Context gathered: 2026-08-05*
