# Requirements: Guezzer / "Gizz With Friends" — v2.1 "UX/UI Polish"

**Defined:** 2026-07-24
**Core Value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.
**Scope source:** `.planning/v2.1-ux-polish-backlog.md` (12 owner items) + `.planning/research/SUMMARY.md`

> **Milestone character.** v2.1 adds **zero new domain capability**. Every requirement below modifies a
> shared surface that 7+ already-device-verified features depend on. All four researchers converged:
> **the dominant risk is regression, not build difficulty.** The way this milestone fails is not "the new
> thing is wrong" but "the new thing silently unpicks a stitch in something that passed device UAT."
> Net new runtime dependencies: **zero.**

---

## v2.1 Requirements

### Layout & Layering Foundations

The bottom-space arithmetic is currently duplicated across 7–9 sites in four notations that
*already disagree with each other by one safe-area inset*. Three separate v2.1 features consume it.
Doing this after them means doing it twice, in two layout states.

- [x] **FOUND-01**: In the installed home-screen PWA, body content sits flush with the top of the bottom tab bar — no dead gap — in both portrait and landscape
- [x] **FOUND-02**: Every bottom-anchored surface (tab bar, FAB, FAB scrim, toasts, peek strip, suggestion strip) derives its offset from one shared reserved-bottom-height source, so a search for the tab-bar height returns exactly one owner
- [x] **FOUND-03**: Nothing paints over an open modal sheet, locked by an automated layer-ordering test
- [x] **FOUND-04**: All full calendar dates render as "Mon D, YYYY" (e.g. `Jan 2, 2026`) across every app surface, from one shared UTC-safe helper — ShowView header, ShowsList, SetlistView, ArchiveBrowser, RecapView subline
- [x] **FOUND-05**: The share-card PNG draws the show date in the same "Mon D, YYYY" format, verified on-device at the widest realistic venue name without truncation or overflow

### Chrome Visibility

One mechanism, two consumers. The Fullscreen API **does not exist on iPhone Safari** (verified against
browser-compat data), and an installed PWA has no browser chrome to hide — so the "fullscreen toggle"
is *necessarily* an in-app chrome-hide. Backlog items #9 and #4 are the same feature.

- [ ] **CHROME-01**: In GizzVerse, a user can hide the top bar and bottom tabs with one tap for more constellation viewing area, and restore them with a control that stays visible in the same place
- [ ] **CHROME-02**: While tracking a show on the Live tab, the bottom tabs auto-hide for immersion and return the moment the user navigates to another tab
- [ ] **CHROME-03**: A user can always escape chrome-hidden state — the exit control is always rendered, ≥44px, inside the safe area, and first in tab order; the hidden state never persists across a cold boot
- [ ] **CHROME-04**: Hidden chrome is removed from the accessibility tree, not merely translated off-screen, so VoiceOver and keyboard users cannot tab into invisible controls
- [ ] **CHROME-05**: Hiding or showing chrome never reheats the GizzVerse simulation or degrades battery — exactly one resize callback fires, asserted by test

### Sheet Motion

The highest-regression-risk item in the milestone relative to its user value: one primitive backs 11+
VoiceOver- and keyboard-verified surfaces.

- [ ] **SHEET-01**: Every bottom sheet animates smoothly up on open and down on close with a scrim cross-fade, honoring `prefers-reduced-motion`
- [ ] **SHEET-02**: Sheet accessibility behavior is unchanged by the animation — focus returns to the trigger and the background becomes interactive at close-*start*, never after the exit finishes (a tap during that window must never be swallowed), re-verified on-device with VoiceOver and an external keyboard

### Immersive In-Show Experience

The milestone's headline live-value.

- [ ] **INSHOW-01**: When prompted to deal a bingo card during a tracked show, the user deals it from a full-screen overlay on top of tracking — never navigating away to the Games tab, never losing the tracking session
- [ ] **INSHOW-02**: A user can open the in-show bingo board full-screen from the FAB, view progress, and dismiss back to tracking exactly where they left off
- [ ] **INSHOW-03**: Bingo overlays dismiss via a visible, labelled, ≥44px "Back to show" control, via Escape, and via the OS back gesture — and never via a swipe-down that could land a spurious tap on the orbit stage
- [ ] **INSHOW-04**: A bingo celebration toast offers a button that jumps straight to the bingo overlay, with the board also reachable by a permanent path
- [ ] **INSHOW-05**: The deal and board renderers are shared between the Games tab and the in-show overlay as one pipeline, and every control reachable mid-show performs its action or explains why — no button silently does nothing on a locked card

### Reactions

Replaces the *presentation* of the shipped Phase-20 `WaveToast`. The send surface, `validateWave`,
and the `gizz-room` transport are unchanged. This deliberately reverses shipped decision D-10 (the
FIFO one-at-a-time drain) — recorded here so it is not later rediscovered as a regression.

- [ ] **REACT-01**: When a friend sends a reaction, the emoji and their name fly upward from the section of the app that friend is currently on
- [ ] **REACT-02**: When the sender's section cannot be anchored — tabs hidden, unknown or stale activity — the reaction still appears via a defined fallback position, never silently dropped and never spawned in a wrong corner
- [ ] **REACT-03**: A user who sends a reaction sees their own immediately, without waiting for the round trip
- [ ] **REACT-04**: Reactions arriving at once from up to 5 friends stay legible — concurrent reactions are capped and per-sender bursts coalesce, with over-cap reactions dropped rather than queued into a delayed backlog
- [ ] **REACT-05**: Under `prefers-reduced-motion` the shipped toast presentation is used instead of the fly-up, and reactions are announced on a throttled screen-reader channel
- [ ] **REACT-06**: During a tracked show, reactions never cross the orbit and can never intercept a song-logging tap

### Navigation & Install

- [x] **NAV-01**: The bottom tabs read **Live · GizzVerse · Map · Me · Games**
- [x] **NAV-02**: The rename changes display labels only — routes, file paths, and saved data keys are untouched, so no saved dex is orphaned and no navigation breaks
- [x] **NAV-03**: Friend presence activity keeps working across mixed app builds — a friend on an older build still shows a correct, readable activity label rather than a blank or a raw internal token
- [ ] **NAV-04**: The Me tab icon shows a badge when friends are online, so the friends surface is discoverable without opening the tab
- [ ] **NAV-05**: The add-to-home-screen instructions live at the bottom of Settings and are hidden once the app is installed; the top-right menu keeps a single neutral row that deep-links there
- [ ] **NAV-06**: Installing from the relocated Settings affordance works on Android, confirmed on-device

### Visual Polish

- [ ] **POLISH-03**: Each bingo deal difficulty (Chill / Balanced / Glory-hunter) carries a distinct icon that conveys its order without relying on color alone

---

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Casual features (captured 2026-07-19, `.planning/todos/pending/`)

- **FEAT-01**: Residency Mode — no-repeat run awareness + songs-remaining pool
- **FEAT-02**: Guezz League — pregame 5-pick prediction game, rarity-weighted, live scoring
- **FEAT-03**: Gizzle — daily clue-based song-guessing puzzle, date-seeded, offline
- **FEAT-04**: Couch Mode — read-only follow-from-home
- **FEAT-05**: My Stats & Want List
- **FEAT-06**: Shiny catches — special-version variant tiers
- **FEAT-07**: Badge system with visible unearned badges
- **FEAT-08**: Song Dossiers + unlockable lore codex
- **FEAT-09**: Know-Before-You-Go primer + predicted-setlist playlist

### Carried model / explore stretch work

- **MODL-V2-01**: Set-position awareness (opener/closer/encore distributions) as a scoring signal
- **MODL-V2-02**: Album-as-genre-proxy affinity experiment
- **EXPL-V2-01**: Explore era slider (2010 → present)
- **SOCL-V2-01**: Full real-time shared setlist co-tracking between friends

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep and re-litigation.

| Feature | Reason |
|---------|--------|
| Swipe-down-to-dismiss on in-show overlays | Owner decision 2026-07-24. Not the full-screen convention, fights scrolling the board, unreliable on device (React touch handlers are passive by default), and a half-dismissed drag landing on the orbit stage logs a spurious song |
| Fullscreen API (`requestFullscreen`) | Does not exist on iPhone Safari — verified against browser-compat data. An installed PWA has no browser chrome to hide anyway |
| Edge-swipe to reveal hidden chrome | Collides with the OS back gesture on both iOS and Android |
| Timed auto-re-hide of chrome | Moves a tap target under a reaching thumb — violates the founding "tap targets never move on their own" rule |
| Persisting chrome-hidden state across launches | A user who cold-boots into a stripped UI has no model for how they got there |
| Renaming the presence wire tokens | Those strings are the `gizz-room` broadcast vocabulary, validated against an allow-list. Because the service worker is prompt-to-update, mixed builds are the *designed* state — renaming silently blanks friend activity across versions |
| Speculatively renumbering the z-index tier scale | Two documented regression guards and a shipped accessibility requirement depend on the current ordering. Capture a device repro first; write the invariant, not a renumber |
| Deleting `WaveToast` | Retaining it supplies the reduced-motion fallback, the rollback path, and a battery kill-switch in one decision |
| Reaching the bingo board via tab navigation | Defeats the entire point of items #1/#2 — the user must never lose their place in tracking |
| Sound on reactions or celebrations | A live venue is already loud; a phone making noise in a crowd is user-hostile |
| Color-coded difficulty tiers (color alone) | Fails color-blind safety; the project already established that a tier word or ordinal shape always accompanies hue |
| GizzVerse directional-flow edge particles | Dropped outright 2026-07-24 — conflicts with the EXPL-06 settle-and-freeze battery design. Todo deleted, not deferred |
| New runtime dependencies | Everything needed is already installed: `motion` 12.42.2 is already load-bearing, `<Sheet variant="fullscreen">` already ships on 4 surfaces |
| New domain capability of any kind | This is a polish milestone before the August 2026 shows; the app is already show-ready |

---

## Verification Notes

Items that **cannot** be verified in a desktop browser tab, and must be budgeted inside their phase:

| What | Why |
|------|-----|
| FOUND-01 inset measurement, before and after | `env(safe-area-inset-bottom)` reports `0` when the Safari toolbar is visible — the whole bug class is invisible except on an **installed** home-screen instance. Portrait *and* landscape. Do not reach for `dvh` (iOS 26.0 shipped a `100dvh` bottom-gap regression of its own) |
| SHEET-02 accessibility re-verification | The animation invalidates the shipped A11Y-01 verification. VoiceOver + external keyboard on iOS, inside the phase, not after |
| NAV-03 cross-build presence | Requires two devices on *different* app builds — the failure mode is silent |
| NAV-06 Android install | The `beforeinstallprompt` event is one-shot and currently captured in component-local state; the relocated affordance is dead on Android unless that capture is hoisted |
| REACT-04 motion parameters and battery cost | Reasoned from convention, **not measured** — no published spec exists for any live-reaction implementation. Instrument and tune on device |

Open items for phase planning (implementation-level, not scope-level): whether the wave payload gains
an optional sender-tab field to close the presence/broadcast ordering race; whether Escape exits
chrome-hidden state; whether the deterministic core PRNG is barrel-exported so fly-up drift is
unit-testable. A device repro naming the surface that paints over an open sheet resolves the one
genuine disagreement between researchers (structural stacking-context capture vs. an already-consistent
tier ladder).

---

## Traceability

Populated during roadmap creation (2026-07-24). Phase numbering **continues** from the v2.0
milestone, which ended at Phase 20 — v2.1 runs Phases 21–24.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 21 | Complete |
| FOUND-02 | Phase 21 | Complete |
| FOUND-03 | Phase 21 | Complete |
| FOUND-04 | Phase 21 | Complete |
| FOUND-05 | Phase 21 | Complete |
| CHROME-01 | Phase 22 | Pending |
| CHROME-02 | Phase 23 | Pending |
| CHROME-03 | Phase 22 | Pending |
| CHROME-04 | Phase 22 | Pending |
| CHROME-05 | Phase 22 | Pending |
| SHEET-01 | Phase 22 | Pending |
| SHEET-02 | Phase 22 | Pending |
| INSHOW-01 | Phase 23 | Pending |
| INSHOW-02 | Phase 23 | Pending |
| INSHOW-03 | Phase 23 | Pending |
| INSHOW-04 | Phase 23 | Pending |
| INSHOW-05 | Phase 23 | Pending |
| REACT-01 | Phase 24 | Pending |
| REACT-02 | Phase 24 | Pending |
| REACT-03 | Phase 24 | Pending |
| REACT-04 | Phase 24 | Pending |
| REACT-05 | Phase 24 | Pending |
| REACT-06 | Phase 24 | Pending |
| NAV-01 | Phase 21 | Complete |
| NAV-02 | Phase 21 | Complete |
| NAV-03 | Phase 21 | Complete |
| NAV-04 | Phase 24 | Pending |
| NAV-05 | Phase 22 | Pending |
| NAV-06 | Phase 22 | Pending |
| POLISH-03 | Phase 24 | Pending |

**Coverage:**

- v2.1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓ (100% coverage, no orphans, no duplicates)

**By phase:**

| Phase | Requirements | Count |
|-------|--------------|-------|
| 21 — Layout & Layering Foundations | FOUND-01..05, NAV-01, NAV-02, NAV-03 | 8 |
| 22 — Surface Motion & the Chrome Mechanism | SHEET-01, SHEET-02, CHROME-01, CHROME-03, CHROME-04, CHROME-05, NAV-05, NAV-06 | 8 |
| 23 — Immersive In-Show Experience | INSHOW-01..05, CHROME-02 | 6 |
| 24 — Reactions & Small Polish | REACT-01..06, NAV-04, POLISH-03 | 8 |

**Note on the CHROME split.** CHROME-01 (GizzVerse toggle) and CHROME-02 (in-show tab hiding) are
two consumers of one mechanism. The mechanism's own safety invariants — CHROME-03 (always escapable,
never persisted), CHROME-04 (removed from the a11y tree), CHROME-05 (one resize, no simulation
reheat) — are mapped to **Phase 22 with the first consumer**, not deferred to Phase 23 with the
second. Phase 22 is the first phase in which a user can enter chrome-hidden state, so deferring the
escape hatch or the a11y-tree removal would leave a phase boundary at which a user can strand
themselves in an installed PWA; and CHROME-05 names the GizzVerse simulation explicitly, so its
verification surface *is* the Phase-22 surface. Full reasoning in `ROADMAP.md` § Coverage.

**Device-verification budget** (owned inside the phase, never a trailing cleanup): FOUND-01 +
FOUND-05 + NAV-03 in Phase 21; SHEET-02 + NAV-06 in Phase 22; REACT-04 in Phase 24.

---
*Requirements defined: 2026-07-24*
*Last updated: 2026-07-24 after v2.1 roadmap creation — all 30 requirements mapped to Phases 21–24 (100% coverage)*
