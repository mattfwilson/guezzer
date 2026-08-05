# Phase 22: Surface Motion & the Chrome Mechanism - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05
**Phase:** 22-surface-motion-the-chrome-mechanism
**Areas discussed:** Chrome-hide trigger & the way back, What counts as "chrome" and how sticky, Sheet motion feel & blast radius, Install move: Settings contents & menu row

---

## Todo folding

| Option | Description | Selected |
|--------|-------------|----------|
| Sheet animation todo (2026-07-17) | The animation half of the bottom-sheets todo, tagged `resolves_phase: 22`; layering half shipped in Phase 21 | ✓ |
| apple-mobile-web-app-capable meta (2026-08-05) | One line in index.html so iOS installs land standalone rather than degrading to a Safari bookmark | ✓ |
| SetlistView aria-modal trap (CR-02) | Full-viewport `role="dialog"` with no close, no Escape, no scrim; permanent when the show is in neither bundle nor cache | ✓ |
| Simultaneous bottom-overlay stacking (CR-01) | Two visible bottom overlays overlap while the reserve sums both heights | ✓ |

**User's choice:** All four folded.
**Notes:** All four sit in the surface area this phase touches; the owner chose to close them here rather than leave them accumulating in `pending/`.

---

## Chrome-hide trigger & the way back

### Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| A dedicated toggle button | One control, same pixel both states; trivially satisfies CHROME-03's ≥44px / safe-area / first-in-tab-order bar | ✓ |
| Tap on empty canvas | Most immersive, but canvas single-tap is already spent on node focus and filter-panel collapse | |
| Double-tap the canvas | Avoids the single-tap collision but competes with react-force-graph pinch/zoom; undiscoverable | |

**User's choice:** A dedicated toggle button.

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right of the constellation stage | Clear of ExploreFilterFab (bottom-right) and the ~40% NodeSheet peek | ✓ |
| Bottom-left, mirroring the filter FAB | Best thumb reach, but lands under NodeSheet when a node is focused | |
| A second item inside the existing filter FAB | No new floating surface, but buries the escape hatch behind a tap | |

**User's choice:** Top-right of the constellation stage.

### Hide motion

| Option | Description | Selected |
|--------|-------------|----------|
| Slide out over the stage, box collapses first | Canvas gets full height immediately (one resize); chrome slides away as a pure transform; reduced-motion falls back to instant | ✓ |
| Instant — no motion at all | Safest CHROME-05 reading, but abrupt in the phase named "Surface Motion" | |
| Cross-fade only | Softer than instant, no transform stacking-context risk | |

**User's choice:** Slide out over the stage, box collapses first.

### A11y-tree timing

| Option | Description | Selected |
|--------|-------------|----------|
| At animation start; unmount at end | `inert` + `aria-hidden` immediately; mirrors SHEET-02's close-start rule so the phase has one timing principle | ✓ |
| Unmount immediately, animate a visual ghost | Strictest CHROME-04 reading but requires a duplicate render of the chrome | |
| Keep it live until the slide finishes | Simplest, but leaves a ~200ms window where a keyboard user can Tab into a control that's visually gone | |

**User's choice:** At animation start; unmount at end.

---

## What counts as "chrome", and how sticky

### Scope

| Option | Description | Selected |
|--------|-------------|----------|
| App chrome only — header + bottom tabs | Exactly what CHROME-01 names; ExploreFilterFab stays so density tuning remains reachable | ✓ |
| Everything floating, filter FAB included | Maximum viewing area, but makes "chrome" view-specific and forces a redefinition in Phase 23 | |
| Header + tabs hide, filter FAB dims | Nicest-looking, but adds a third visual state to test | |

**User's choice:** App chrome only.

### Stickiness

| Option | Description | Selected |
|--------|-------------|----------|
| Resets on leaving GizzVerse | Plain component state; "cold boot never starts hidden" becomes true by construction | ✓ |
| Remembered across tab switches, reset on reload | Reopens as you left it, but adds app-level state Phase 23 inherits | |
| Remembered across reloads via sessionStorage | Survives refresh, but a reload in an installed PWA reads as a cold boot to the user | |

**User's choice:** Resets on leaving GizzVerse.

### Shared vs local mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Build it shared now; GizzVerse is consumer #1 | Phase 23 wires ShowView to it rather than refactoring a device-verified surface; matches the roadmap's stated reason for debuting on the easier surface | ✓ |
| GizzVerse-local now, generalize in Phase 23 | Smallest diff now, but invariants get proven against a mechanism that changes shape afterwards | |
| You decide | — | |

**User's choice:** Build it shared now.

### Top safe-area inset

| Option | Description | Selected |
|--------|-------------|----------|
| No — keep the top safe-area inset | No new top-inset arithmetic; toggle sits inside the safe area with no special offset | ✓ |
| Yes — edge-to-edge under the status bar | Most immersive, but reintroduces the arithmetic that has misfired here twice | |
| Edge-to-edge canvas, toggle keeps the inset | Best of both visually, but adds one hand-written top-inset expression | |

**User's choice:** No — keep the top safe-area inset.

### NodeSheet behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Stays open, settles down into the freed space | Free from the Phase-21 D-16 seam; no special case, no new code | ✓ |
| Closes — hiding chrome means "show me the sky" | Cleanest immersive result but discards the node detail being read | |
| Stays pinned exactly where it is | Nothing shifts under the thumb, but requires exempting one surface from the reserve | |

**User's choice:** Stays open, settles down.

### CHROME-05 proof

| Option | Description | Selected |
|--------|-------------|----------|
| Automated test only | jsdom: one resize callback, `zoomToFit` not re-called. Simulation already structurally safe via `onEngineStop` fx/fy pinning + `hasFitRef` | ✓ |
| Automated test + device battery/frame observation | Strongest evidence, but a third device item in a phase budgeting two | |
| Test now, device check folded into Phase 23 | Defers the empirical half to where battery actually matters | |

**User's choice:** Automated test only.

### Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing — the icon carries it | Zero cost of missing it; avoids a second onboarding nag | ✓ |
| A one-time hint on first GizzVerse visit | Guarantees discovery but adds a persisted flag and dismissal path | |
| Mention it in the filter panel | No new surface, but only seen by users who open the panel | |

**User's choice:** Nothing — the icon carries it.

### Toggle accessible naming

| Option | Description | Selected |
|--------|-------------|----------|
| Two accessible names describing the next action | "Hide bars" / "Show bars"; matches the shipped `aria-label="Menu"` / `"Close menu"` idiom; wording in `config.copy` | ✓ |
| One name plus `aria-pressed` | More correct toggle semantic, but a new idiom with no existing consumer | |
| You decide | — | |

**User's choice:** Two names describing the next action.

### Who renders the toggle

| Option | Description | Selected |
|--------|-------------|----------|
| The view opts in — GizzVerse renders it | Shared module owns state and layout consequence; Phase 23's trigger is different (auto-hide, no button) | ✓ |
| AppShell renders it everywhere | Consistent, but a capability CHROME-01 doesn't ask for on four other tabs | |
| AppShell renders it, views declare eligibility | One control, explicit surface list, but placement must suit every future opting-in view | |

**User's choice:** The view opts in.

### Escape / back gesture

| Option | Description | Selected |
|--------|-------------|----------|
| Escape yes, back gesture no | Escape hooks the shipped `useDialogDismiss` LIFO stack; back gesture needs a history entry in a router-less app | ✓ |
| Both — Escape and back gesture | Strongest escapability and matches Phase 23's INSHOW-02, but that mechanism deserves its own deliberate build | |
| Neither — the toggle is the only way out | Minimal; CHROME-03 satisfied by the button alone, but a keyboard user's instinct is Escape | |

**User's choice:** Escape yes, back gesture no.

### Toasts while hidden

| Option | Description | Selected |
|--------|-------------|----------|
| Toast shows, chrome stays hidden | Toasts compose from the collapsed reserve and simply sit lower; no code | ✓ |
| Toast forces chrome back | Guarantees visibility, but yanks the user out of a state they entered, on an event they didn't cause | |
| Suppress toasts while hidden | Purest immersion, but the update prompt is a safety surface | |

**User's choice:** Toast shows, chrome stays hidden.

---

## Sheet motion feel & blast radius

### Blast radius

| Option | Description | Selected |
|--------|-------------|----------|
| The `<Sheet>` primitive only — 15 files | Honors Phase-21 D-22; zero shipped VoiceOver-verified surfaces rewritten. Accepted cost: SearchSheet won't animate | ✓ |
| Primitive + migrate the five hand-rolled sheets | Everything animates and D-22's deferral resolves, but two large changes at once on the highest-risk item | |
| Primitive now, then copy the motion into the five | Consistent UX without migrating, but duplicates animation logic in six places | |

**User's choice:** The `<Sheet>` primitive only.

### Exit-risk structure

| Option | Description | Selected |
|--------|-------------|----------|
| Both in one slice, exit isolated in its own commit | One device session on finished behavior; exit reverts atomically to the sanctioned enter-only ship. Phase-21 D-13 shape | ✓ |
| Enter-only first, exit as a later gated slice | Always shippable, but splits or defers the SHEET-02 verification the roadmap wants inside this phase | |
| Exit first — front-load the risk | Proves the hard half early, but the first shippable state animates out and not in | |

**User's choice:** Both in one slice, exit isolated.

### Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| `AnimatePresence` + `motion.div` | The app's existing WaveToast/BingoCelebration idiom; `motion` already a dep; owns the deferred-unmount timing SHEET-02 hinges on | ✓ |
| CSS transitions plus a hand-rolled exit-delay state | No new import, but re-implements the one mechanism the a11y contract depends on | |

**User's choice:** `AnimatePresence` + `motion.div`.

### Feel

| Option | Description | Selected |
|--------|-------------|----------|
| Match the shipped toast: ~200ms, scrim fades in parallel | Same vocabulary as existing toasts; short close-start window; reduced motion drops the translate | ✓ |
| Slower and springier, ~300ms with a spring curve | More polished on big surfaces, but triples the exit window and adds a new motion vocabulary | |
| Scrim leads on enter, lags on exit | Most cinematic, but the scrim outlives the sheet and needs an easily-regressed `pointer-events` rule | |

**User's choice:** Match the shipped toast.
**Notes:** Constants land in `config.ui` either way — `WaveToast`'s hard-coded `duration: 0.2` is the scattered magic number CLAUDE.md forbids.

### Close-start sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Everything but unmount happens at close-start | Release `inert`, restore focus, `aria-hidden` the sheet, `pointer-events: none` on sheet + scrim. Mirrors the chrome a11y-tree decision | ✓ |
| Release `inert` at start, restore focus at end | Smoother mid-sentence for a screen-reader user, but leaves focus inside an `aria-hidden` element | |
| Keep today's behavior, just add the animation | Smallest diff, but is exactly the swallowed-tap failure SHEET-02 prevents | |

**User's choice:** Everything but unmount at close-start.

### Device UAT coverage

| Option | Description | Selected |
|--------|-------------|----------|
| A named representative sample, chosen by shape | ~4 sheets spanning fullscreen / no-backdrop / `initialFocusRef` / portaled-from-stacking-context, plus close-start tap on each | ✓ |
| Every sheet, abbreviated | Highest confidence, but a long single-sitting session with real fatigue cost | |
| The two highest-stakes sheets only | Fastest, but leaves the prop variants unexercised on-device | |

**User's choice:** A named representative sample.

### CR-02 fix shape

| Option | Description | Selected |
|--------|-------------|----------|
| Tell the two states apart and render a real error state | Resolves the `useLiveQuery` loading-vs-missing ambiguity; labelled error state with working Back; fixes the misleading `albumBack` label | ✓ |
| Just add a close control and Escape | Two lines, removes the harm, but leaves a blank modal and the ambiguity in place | |
| Migrate SetlistView onto `<Sheet>` | Structural fix, but contradicts the blast-radius decision | |

**User's choice:** Tell the two states apart.

### Regression guard

| Option | Description | Selected |
|--------|-------------|----------|
| A jsdom test asserting the close-start contract | Durable half of SHEET-02; same instinct as Phase-21 D-12/D-24 | ✓ |
| Test plus a source guard on the primitive | Stronger, but Phase 21 learned pattern-matching guards can't catch an omission | |
| Device verification only | Cheapest, but nothing stops a future refactor moving teardown back to unmount | |

**User's choice:** jsdom close-start contract test.

### Fullscreen variant

| Option | Description | Selected |
|--------|-------------|----------|
| Fade only for fullscreen, slide for bottom sheets | SHEET-01 names "every bottom sheet"; a full-bleed overlay travelling the viewport reads as a page transition | ✓ |
| Same slide-up for both | One code path, nothing to branch on, but heavier than it should be | |
| Fullscreen gets no animation at all | Zero risk on a surface SHEET-01 doesn't name, but three behaviors instead of two | |

**User's choice:** Fade only for fullscreen.

### Stacked sheet scrims

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it — each sheet owns its own scrim | Shipped, verified, unreported behavior; animating doesn't change the stacking | ✓ |
| Suppress the second scrim | Closer to native, but the primitive must track open-sheet count | |
| Flag it and check on-device first | Costs nothing since the session is happening, but defers a real decision | |

**User's choice:** Leave it.

### Swipe-to-dismiss

| Option | Description | Selected |
|--------|-------------|----------|
| No — explicitly out, recorded as a non-goal | INSHOW-03 rules it out by name; the primitive deliberately owns no drag geometry | ✓ |
| Yes — natural partner to a sliding sheet | Most thumb-friendly, but gesture/velocity/cancel state on the file backing 15 surfaces | |
| Defer as a future idea | Keeps the option open but leaves the INSHOW-03 tension unresolved | |

**User's choice:** No — explicit non-goal.

### `initialFocusRef` timing

| Option | Description | Selected |
|--------|-------------|----------|
| After the enter animation completes | Input stationary when focused; iOS keyboard opens against a settled layout (Phase-21 D-17 risk area) | ✓ |
| Immediately on open, as today | No delay, but two layout changes race on the platform where viewport math has misfired | |
| Immediately, and skip the slide for these two sheets | Preserves instant focus, but two sheets visibly behave differently for an invisible reason | |

**User's choice:** After the enter animation completes.

### Heavy-content sheets

| Option | Description | Selected |
|--------|-------------|----------|
| Ship as-is, observe on-device, fix only what stutters | Animation adds no work; `ShareCardSheet`'s pre-build is deliberate (Phase-6 Pitfall 7) | ✓ |
| Defer the heavy work until the animation finishes | Guarantees a clean 200ms but delays a pre-build that exists to be ready early | |
| Skip the animation on those two sheets | Cheapest guarantee, but a permanent inconsistency chosen against a hypothetical | |

**User's choice:** Ship as-is, observe on-device.

### Interrupted enter

| Option | Description | Selected |
|--------|-------------|----------|
| Close immediately, reversing from wherever it is | Input never ignored; close-start teardown fires as normal, so one rule not two | ✓ |
| Ignore input until the enter completes | Animation always plays fully, but swallows a tap for ~200ms | |
| Close instantly, no exit animation, when interrupted | Snappiest, but a vanishing sheet reads as a glitch and adds a third behavior | |

**User's choice:** Close immediately, reversing.

### Back-out mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Clean revert only — no flag | Restates Phase-21 D-13; a flag ships two paths and the off path rots | ✓ |
| A `config.ui` flag that disables sheet motion | Venue-night escape hatch without a rebuild, but doubles the primitive's states | |
| No flag, but keep `prefers-reduced-motion` as the escape hatch | Effectively a user-controlled kill switch at zero cost, though it disables all app motion | |

**User's choice:** Clean revert only.

### Dead `modal={false}` props

| Option | Description | Selected |
|--------|-------------|----------|
| Keep them, correct the stale doc comment | Zero code risk; the "NodeSheet variant" claim no consumer backs gets corrected | ✓ |
| Remove them | Shrinks the animation's state space, but Phase 23 may need it back | |
| Keep them and add test coverage | Thorough, but test investment in a configuration nothing renders | |

**User's choice:** Keep them, correct the comment.

---

## Install move: Settings contents & menu row

### Settings section shape

| Option | Description | Selected |
|--------|-------------|----------|
| One install section that adapts to the platform | Android button / iOS steps / fallback copy in one section, hidden once installed. Same three-way shape AppMenu already implements | ✓ |
| iOS illustrated steps only; Android keeps its button in the menu | Smallest move, but leaves install in two places and wouldn't satisfy NAV-06 | |
| Section with both, always visible even when installed | Can't be wrong about installed-ness, but NAV-05 says it hides and a permanent "install me" reads as broken | |

**User's choice:** One platform-adaptive section.

### `beforeinstallprompt` hoist

| Option | Description | Selected |
|--------|-------------|----------|
| Module-level singleton capture, hooks subscribe | Works regardless of mount order; also fixes AppMenu and InstallBanner disagreeing about `canInstall` | ✓ |
| React context provider at the App root | Idiomatic, but anything portaled outside it silently gets nothing | |
| Register in App.tsx, pass down as props | Visible where the app starts, but grows the prop surface this milestone is simplifying | |

**User's choice:** Module-level singleton.

### Menu row

| Option | Description | Selected |
|--------|-------------|----------|
| One neutral "Add to Home Screen" row, hidden once installed | Names its destination honestly; retires the gold accent fill; iOS steps leave the menu entirely | ✓ |
| Neutral row that's always shown | Never wrong about installed-ness, but deep-links to a hidden section | |
| Keep "Install" wording, drop to neutral styling | Preserves muscle memory, but a row labelled Install that navigates is a small lie | |

**User's choice:** One neutral "Add to Home Screen" row, hidden once installed.

### Install-mode determinism

| Option | Description | Selected |
|--------|-------------|----------|
| Add the meta tag and prove install mode during the NAV-06 device pass | Reuses `?layoutProbe=1`; a bookmark launch is visually identical to a real install and cost a full Phase-21 session | ✓ |
| Add the meta tag only | The todo's stated fix, but leaves NAV-06's evidence resting on the same unverified assumption | |
| Also check the iOS install path on-device | Most complete, but NAV-06 names Android and this would be a fourth device item | |

**User's choice:** Meta tag + prove install mode during the NAV-06 pass.

### InstallBanner

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it as-is | NAV-05 doesn't name it; it's the discovery path to the relocated section; gets a free correctness win from the hoist | ✓ |
| Point its CTA at the Settings section too | One install path everywhere, but adds a tap on the conversion surface and re-opens Phase-6 D-22 gating | |
| Retire the banner | Removes an overlay, but deletes the only proactive install prompt on the platform with eviction risk | |

**User's choice:** Leave it as-is.

### CR-01 fix shape

| Option | Description | Selected |
|--------|-------------|----------|
| Give overlays a declared stack order and offset each by what's below it | The store already measures every height; it just has no ordering concept. Keeps the single-owner model intact | ✓ |
| Guarantee only one bottom overlay at a time | Sidesteps the geometry, but InstallBanner is persistent and would have to fight every toast | |
| Keep it captured, fix it after this phase | Over-reserving is the safe failure, but leaves known-wrong arithmetic in the new single owner | |

**User's choice:** Declared stack order.

### NAV-03 boundary

| Option | Description | Selected |
|--------|-------------|----------|
| No — leave it as Phase 21's recorded gap | Belongs to Phase 21's requirements; needs two devices on two different builds; folding it in is scope widening | ✓ |
| Yes — fold it into this phase's device session | Closes a named gap before the shows and the `visibleEpoch` recheck rides on the same test | |
| Schedule it as its own device task, outside this phase | Keeps scope clean and gives it a real slot, but means a third device session | |

**User's choice:** No — leave it as Phase 21's recorded gap.

### Deep-link mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to `#/settings`, scroll the section in and move focus to its heading | No new routing concept; focus move is what makes the deep-link real for keyboard/VoiceOver | ✓ |
| Just navigate to `#/settings` | Zero new mechanism, but the user lands at the top of a three-section page | |
| Add a real hash fragment (`#/settings#install`) | Addressable and reload-safe, but the router has no fragment parsing | |

**User's choice:** Navigate + scroll + move focus.

### Installed detection liveness

| Option | Description | Selected |
|--------|-------------|----------|
| Once at load is enough, but read it from the shared store | A page can't transition into standalone; what matters is both gated surfaces reading the same value | ✓ |
| Live via a `display-mode` media query listener | Belt-and-braces, but `navigator.standalone` isn't a media query so the halves differ in liveness | |
| Re-check whenever the app regains visibility | Reuses an existing pattern, but the original tab is a different instance and would still report not-standalone | |

**User's choice:** Once at load, from the shared store.

---

## Claude's Discretion

- The chrome toggle's icon and the Settings install section's visual styling — the phase carries
  a **UI hint: yes**, so `/gsd-ui-phase 22` can produce a UI-SPEC before planning.
- The exact easing curve and `config.ui` constant names for the sheet transition, within the
  ~200ms / parallel-scrim envelope.
- The internal shape of the chrome-visibility module, provided it composes with
  `layout/bottomSpace.ts`'s `chromeVisible` parameter rather than duplicating it.
- Slice ordering within the phase, subject to the sheet animation landing first and staying
  backable-out.

## Deferred Ideas

- Migrating the five hand-rolled sheets onto the `<Sheet>` primitive (deferred twice now:
  Phase-21 D-22, and again here).
- Swipe-down-to-dismiss on sheets — explicit non-goal, in tension with INSHOW-03.
- OS back-gesture handling as a general mechanism — build it once in Phase 23 for INSHOW-02.
- Suppressing nested sheet scrims so the background darkens only once.
- Chrome-hide on tabs beyond GizzVerse and Phase 23's in-show case.
- `aria-pressed` toggle semantics — correct in the abstract, no existing consumer.
- A `config.ui` runtime kill-switch for sheet motion.
