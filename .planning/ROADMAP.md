# Roadmap: Guezzer

## Milestones

- ✅ **v1.0 MVP** — Phases 1–7 (shipped 2026-07-17) — [archived roadmap](./milestones/v1.0-ROADMAP.md) · [requirements](./milestones/v1.0-REQUIREMENTS.md) · [audit](./milestones/v1.0-MILESTONE-AUDIT.md)
- ✅ **v1.1 Polish & Pre-Show Hardening** — Phases 8–10 (shipped 2026-07-19) — [archived roadmap](./milestones/v1.1-ROADMAP.md) · [requirements](./milestones/v1.1-REQUIREMENTS.md)
- ✅ **v1.2 Pre-Show Hardening** — Phases 11–16 (shipped 2026-07-22) — [archived roadmap](./milestones/v1.2-ROADMAP.md) · [requirements](./milestones/v1.2-REQUIREMENTS.md)
- ✅ **v2.0 Multi-User Foundation** — Phases 17–20 (shipped 2026-07-24) — [archived roadmap](./milestones/v2.0-ROADMAP.md) · [requirements](./milestones/v2.0-REQUIREMENTS.md) · [audit](./milestones/v2.0-MILESTONE-AUDIT.md)
- 🚧 **v2.1 UX/UI Polish** — Phases 21–24 (in progress, started 2026-07-24) — Make the app feel immersive and alive in the venue: keep the user inside tracking, hide chrome when it's in the way, and give reactions a presence-aware physical feel. Zero new domain capability.

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–7) — SHIPPED 2026-07-17</summary>

- [x] Phase 1: Corpus Ingestion & Schema Foundation (5/5 plans) — completed 2026-07-08
- [x] Phase 2: Transition Matrix, Model & Backtest (5/5 plans) — completed 2026-07-09
- [x] Phase 3: App Shell & PWA Foundation (4/4 plans) — completed 2026-07-09
- [x] Phase 4: Show Mode (7/7 plans) — completed 2026-07-13
- [x] Phase 5: Live Sync & Data Safety (6/6 plans) — completed 2026-07-14
- [x] Phase 6: Pokédex, History & Stats (12/12 plans) — completed 2026-07-16
- [x] Phase 7: Explore Mode Constellation (7/7 plans) — completed 2026-07-16

Full phase detail, success criteria, and plan breakdowns: [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Polish & Pre-Show Hardening (Phases 8–10) — SHIPPED 2026-07-19</summary>

Small, low-risk hardening milestone — no new user-facing features. Closed the v1.0 audit's non-blocking gaps (UI legibility, accessibility, data integrity, restore UX) and proved the app show-ready on real hardware before show #1 (late Aug/Sep 2026).

- [x] Phase 8: On-Device UI Polish & Accessibility (8/8 plans) — completed 2026-07-18
- [x] Phase 9: Data Integrity & Restore UX (2/2 plans) — completed 2026-07-18
- [x] Phase 10: Pre-Show Validation & Device Dry-Run (2/2 plans) — completed 2026-07-18

Full phase detail, success criteria, and plan breakdowns: [milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Pre-Show Hardening (Phases 11–16) — SHIPPED 2026-07-22</summary>

Hardened the show-critical paths (live sync, prediction correctness, data safety) before the Aug 14, 2026 residency, then shipped the first casual engagement feature — Gizz Bingo. Bugs landed before Bingo (the show-#1 trust gate); Gizz Bingo cleared two hard upstream gates (Phase 11 live-sync correctness + the Monte-Carlo fill-rate calibration that wrote locked constants to config). All 22 requirements delivered; all human UAT confirmed on-device.

- [x] Phase 11: Live-Sync & Prediction Correctness (5/5 plans) — completed 2026-07-19
- [x] Phase 12: Data Safety & Integrity (3/3 plans) — completed 2026-07-19
- [x] Phase 13: Interface & Explore Polish (4/4 plans) — completed 2026-07-20
- [x] Phase 14: Gizz Bingo — Core Marking & Generation (6/6 plans) — completed 2026-07-20
- [x] Phase 15: Gizz Bingo — Persistence, Lock & Replay (4/4 plans) — completed 2026-07-21
- [x] Phase 16: Gizz Bingo — Build, Live Marking & Celebrations (6/6 plans) — completed 2026-07-21

Full phase detail, success criteria, and plan breakdowns: [milestones/v1.2-ROADMAP.md](./milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Multi-User Foundation (Phases 17–20) — SHIPPED 2026-07-24</summary>

"Gizz With Friends" — gave the ~5-friend group distinct identities and lightweight awareness of each other, backed by a hosted Supabase (auth + Postgres + Realtime), **without breaking offline-first**. The prediction model + all v1 derivations stay client-side and pure; every Supabase import is fenced into the app layer (`packages/app/src/sync/` + `db/`), enforced by `packages/core/test/purity.test.ts`. Not a show-#1 gate — the core app was already show-ready for Aug 14, 2026; this milestone targets the residency run. Ships the "Gizz With Friends" rebrand.

Milestone audit **PASSED** — 27/27 requirements, 4/4 phases verified, all cross-phase seams wired, all device UATs passed. At close, the one open code gap (mobile Realtime foreground-staleness) was fixed on both channels and two-device device-verified (quick 260724-hqu + 260724-lgo).

- [x] Phase 17: Backend Foundation & Secrets (4/4 plans) — completed 2026-07-22
- [x] Phase 18: Accounts & Offline-Safe Identity (7/7 plans) — completed 2026-07-22
- [x] Phase 19: Shared Dex Progress (4/4 plans) — completed 2026-07-24
- [x] Phase 20: Presence & Interactions (5/5 plans) — completed 2026-07-24

Full phase detail, success criteria, and plan breakdowns: [milestones/v2.0-ROADMAP.md](./milestones/v2.0-ROADMAP.md)

</details>

### 🚧 v2.1 UX/UI Polish (Phases 21–24) — IN PROGRESS

Make the app feel immersive and alive in the venue — keep the user inside the tracking experience, hide chrome when it's in the way, and give reactions a presence-aware physical feel — **without adding new domain capability**. Net new runtime dependencies: zero.

**The dominant risk is regression, not build difficulty.** Every requirement modifies a shared surface that seven-plus already-device-verified features depend on. The way this milestone fails is not "the new thing is wrong" but "the new thing silently unpicks a stitch in something that passed device UAT" — VoiceOver + external keyboard a11y, the installed-PWA safe-area math, the cross-device presence wire protocol. **The app is already show-ready for the August 2026 shows: no phase may leave the live-tracking loop (start → predict → log → recenter → End Show) broken at a phase boundary.**

Ordering is dependency-driven and deliberately **reorders the owner's original backlog A/B/C/D shape**. The backlog scheduled the chrome-visibility mechanism (its Phase C) *after* its own consumers (Phases A and B); three of four researchers independently flagged this. The bottom-space arithmetic is duplicated across 7–9 sites in four notations that already disagree with each other by one safe-area inset, and three separate v2.1 features consume it — so it goes **first**, in one pass, together with the installed-PWA bottom-gap bug that lives in that same arithmetic. Phase 22 then debuts the chrome mechanism on the *easier* surface (GizzVerse) and proves its safety invariants there, before the live-show path in Phase 23 depends on it. Phase 24 is parallel-safe with Phase 23 once Phase 21 lands.

- [x] **Phase 21: Layout & Layering Foundations** - One owner for the bottom-space arithmetic, no installed-PWA dead gap, one date format, and the short tab names (completed 2026-08-05)
- [ ] **Phase 22: Surface Motion & the Chrome Mechanism** - Animate the one shared sheet primitive without losing an a11y guarantee; debut chrome-hide on GizzVerse with its escape and a11y invariants proven
- [ ] **Phase 23: Immersive In-Show Experience** - Bingo dealing and the bingo board become full-screen overlays on top of tracking; tabs get out of the way while tracking
- [ ] **Phase 24: Reactions & Small Polish** - Reactions fly up from the sender's actual section, never crossing the orbit; friends-online tab badge and deal-type icons

## Phase Details

### Phase 21: Layout & Layering Foundations

**Goal**: The app's bottom-space and layering arithmetic has exactly one owner, the installed PWA has no dead bottom gap, calendar dates read the same everywhere, and the bottom tabs carry their short names — so every later v2.1 surface is built on settled ground instead of rewriting it. Everything downstream consumes this phase; doing it later means doing it twice, in two layout states.
**Depends on**: Nothing (first phase of the milestone)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):

  1. On an **installed** home-screen PWA, body content sits flush against the top of the bottom tab bar with no dead gap — measured on-device before and after the fix, in portrait **and** landscape (FOUND-01). *This is invisible in a Safari tab by construction; the measurement is a phase deliverable, not a follow-up.*
  2. Every bottom-anchored surface — tab bar, FAB, FAB scrim, toasts, peek strip, suggestion strip — sits at the correct offset in both a browser tab and an installed instance, and a search for the tab-bar height returns exactly one owner (FOUND-02).
  3. An automated layer-ordering test fails if any surface can paint over an open **modal** sheet, and it is written against the current tier ordering — the deliberate non-modal `focusedFab` exception survives, and no tier is renumbered without a device repro naming the offending surface (FOUND-03).
  4. Every full calendar date in the app — ShowView header, ShowsList, SetlistView, ArchiveBrowser, RecapView subline — and the share-card PNG read "Mon D, YYYY" from one shared UTC-safe helper, with the PNG verified on-device at the widest realistic venue name without truncation or overflow (FOUND-04, FOUND-05).
  5. The bottom tabs read **Live · GizzVerse · Map · Me · Games** while every route, file path, and saved data key is untouched — and a two-device test across *different* app builds shows a friend on an older build with a correct, readable activity label, never a blank and never a raw internal token (NAV-01, NAV-02, NAV-03).

**Plans**: 13 plans in 8 waves
Plans:
**Wave 1**

- [x] 21-01-PLAN.md — Dev harnesses (?layerRepro=1, ?layoutProbe=1) + 21-HUMAN-UAT scaffold
- [x] 21-02-PLAN.md — formatDate.ts helper module + rename + importers
- [x] 21-03-PLAN.md — Tab + presence label maps (NAV-01/02/03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-04-PLAN.md — Device session #1 — layering repro + FOUND-01 before-measurement
- [x] 21-05-PLAN.md — Full-date call sites + display-only storage boundary
- [x] 21-06-PLAN.md — Share-card footer — formatted date + width-constrained venue

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 21-07-PLAN.md — Bottom-space single owner — config + bottomSpace.ts + styles.css + AppShell + BottomTabBar

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 21-08-PLAN.md — FAB family conversion + D-05 stripSlotReserved
- [x] 21-09-PLAN.md — Sheet-pad / page-footer conversions + D-08 audit

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 21-10-PLAN.md — Toast family conversion + D-12 source guard

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 21-11-PLAN.md — Layer-order invariant test + portal SearchSheet & FabMenu

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 21-12-PLAN.md — Portal the four root-level sheet surfaces + a11y re-verify

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 21-13-PLAN.md — Device session #2 — final UAT, all 8 manual verifications closed

**UI hint**: yes

### Phase 22: Surface Motion & the Chrome Mechanism

**Goal**: The one shared `<Sheet>` primitive animates without losing a single accessibility guarantee, and the chrome-hide mechanism debuts on GizzVerse — proven escapable, accessible, and cheap on the surface where a stranded user costs the least — before the live-show path depends on it. The overlays of Phase 23 must be built against the *final* sheet primitive, not retrofitted onto it afterwards.
**Depends on**: Phase 21
**Requirements**: SHEET-01, SHEET-02, CHROME-01, CHROME-03, CHROME-04, CHROME-05, NAV-05, NAV-06
**Success Criteria** (what must be TRUE):

  1. Every bottom sheet animates smoothly up on open and down on close with a scrim cross-fade, and under `prefers-reduced-motion` appears and disappears without motion (SHEET-01).
  2. Sheet accessibility is unchanged by the animation — focus returns to the trigger and the background becomes interactive at close-**start**, so a tap during the exit window is never swallowed — re-verified on-device with VoiceOver and an external keyboard **inside this phase**. Enter-only animation is an explicitly acceptable degraded ship if the exit cannot meet that bar (SHEET-02). *This is the highest-regression-risk-per-user-value item in the milestone: one primitive backs 11+ verified surfaces, so it lands as the first slice and stays backable-out.*
  3. In GizzVerse, one tap hides the top bar and bottom tabs for more constellation viewing area and a control that stays visible in the same place restores them — and hiding or showing fires exactly **one** resize callback, never reheating the simulation or degrading battery, asserted by test (CHROME-01, CHROME-05).
  4. Chrome-hidden state is always escapable and never sticky: the exit control is always rendered, ≥44px, inside the safe area, and first in tab order; a cold boot never starts hidden; and the hidden chrome is removed from the accessibility tree rather than translated off-screen, so VoiceOver and keyboard users cannot tab into an invisible control (CHROME-03, CHROME-04).
  5. The add-to-home-screen instructions live at the bottom of Settings and hide once the app is installed, the top-right menu keeps a single neutral row that deep-links there, and installing from that relocated affordance is confirmed working on a real Android device (NAV-05, NAV-06).

**Plans**: 9 plans in 5 waves

**Wave 1** — the sheet slice lands first and stays backable-out

- [ ] 22-01-PLAN.md — Config/motion tokens + animated <Sheet> primitive (enter only)

**Wave 2**

- [ ] 22-02-PLAN.md — Sheet close-start contract + exit animation (one revertible commit)
- [ ] 22-03-PLAN.md — beforeinstallprompt module singleton + shared isStandalone

**Wave 3** *(blocked on Wave 2)*

- [ ] 22-04-PLAN.md — CR-02 SetlistView loading-vs-missing + the one fullscreen sheet conversion
- [ ] 22-05-PLAN.md — Chrome-visibility store + --gz-tab-bar-box ladder + AppShell collapse
- [ ] 22-06-PLAN.md — Settings install section + neutral menu row + focus-moving deep link

**Wave 4** *(blocked on Wave 3)*

- [ ] 22-07-PLAN.md — ChromeToggle control + escapability + the one-resize assertion
- [ ] 22-08-PLAN.md — CR-01 ordered bottom-overlay stacking + omission guard

**Wave 5** *(blocked on Wave 4)*

- [ ] 22-09-PLAN.md — Capability meta tags (own commit) + 22-HUMAN-UAT.md device script

**UI hint**: yes

### Phase 23: Immersive In-Show Experience

**Goal**: Bingo happens *on top of* tracking, never instead of it — the deal flow and the board are full-screen overlays over a live show, the bottom tabs get out of the way while tracking, and the tracking session is never lost, never navigated away from, and never interrupted. This is the milestone's headline live-value.
**Depends on**: Phase 22 (the chrome mechanism proven on the easier surface; the overlays built against the final animated `<Sheet>` and the Phase-21 portal/layering fix)
**Requirements**: INSHOW-01, INSHOW-02, INSHOW-03, INSHOW-04, INSHOW-05, CHROME-02
**Success Criteria** (what must be TRUE):

  1. Prompted to deal a bingo card during a tracked show, the user deals it from a full-screen overlay on top of tracking and returns to the exact tracking state — never navigating away to the Games tab, never losing the tracking session (INSHOW-01).
  2. The FAB opens the in-show bingo board full-screen to view progress, and it dismisses back to tracking exactly where the user left off via a visible, labelled, ≥44px "Back to show" control, via Escape, and via the OS back gesture — and never via a swipe-down that could land a spurious tap on the orbit stage (INSHOW-02, INSHOW-03).
  3. A bingo celebration toast offers a button that jumps straight to the bingo overlay, and the board is also reachable by a permanent path that does not depend on catching a toast in time (INSHOW-04).
  4. The Games tab and the in-show overlay render the deal and the board from one shared pipeline, and every control reachable mid-show either performs its action or explains why — no button silently does nothing on a locked card (INSHOW-05).
  5. While tracking a show on the Live tab the bottom tabs auto-hide for immersion and return the moment the user navigates to another tab — the user can still reach Map without ending the show, and the live-tracking loop (log → predict → recenter → End Show) is unaffected throughout (CHROME-02).

**Plans**: TBD
**UI hint**: yes

### Phase 24: Reactions & Small Polish

**Goal**: A friend's reaction reads as a person in a place — emoji and name flying up from the section they are actually on — without ever crossing the orbit, costing a logged song, or stranding a reduced-motion user; plus the two remaining small visual items. This phase rewrites shipped, device-verified Phase-20 code, so it carries its own focused device UAT.
**Depends on**: Phase 21 (the chrome/reserved-height mechanism supplies the spawn anchor and its fallback). Parallel-safe with Phase 23 — zero coupling to the bingo overlays.
**Requirements**: REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REACT-06, NAV-04, POLISH-03
**Success Criteria** (what must be TRUE):

  1. When a friend sends a reaction, the emoji and their name fly upward from the section of the app that friend is currently on; when that section cannot be anchored — tabs hidden, unknown or stale activity — the reaction still appears via a defined fallback position, never silently dropped and never spawned in a wrong corner (REACT-01, REACT-02).
  2. A user who sends a reaction sees their own immediately without waiting for the round trip, and reactions arriving at once from up to 5 friends stay legible — concurrent reactions capped, per-sender bursts coalesced, over-cap reactions dropped rather than queued into a delayed backlog, with the motion parameters and battery cost **instrumented and tuned on-device**, not assumed from convention (REACT-03, REACT-04).
  3. Under `prefers-reduced-motion` the shipped toast presentation is used instead of the fly-up (the toast is retained, not deleted — it is the reduced-motion path, the rollback path, and the battery kill-switch), and reactions are announced on a throttled screen-reader channel (REACT-05).
  4. During a tracked show, reactions never cross the orbit and can never intercept a song-logging tap (REACT-06).
  5. The Me tab icon shows a badge when friends are online so the friends surface is discoverable without opening the tab, and each bingo deal difficulty (Chill / Balanced / Glory-hunter) carries a distinct icon that conveys its order without relying on color alone (NAV-04, POLISH-03).

**Plans**: TBD
**UI hint**: yes

## Coverage

All 30 v2.1 requirements map to exactly one phase — no orphans, no duplicates.

| Category | Requirements | Phase |
|----------|--------------|-------|
| Layout & Layering Foundations | FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05 | 21 |
| Navigation (rename + wire tolerance) | NAV-01, NAV-02, NAV-03 | 21 |
| Sheet Motion | SHEET-01, SHEET-02 | 22 |
| Chrome mechanism + first consumer | CHROME-01, CHROME-03, CHROME-04, CHROME-05 | 22 |
| Install affordance | NAV-05, NAV-06 | 22 |
| Immersive In-Show Experience | INSHOW-01, INSHOW-02, INSHOW-03, INSHOW-04, INSHOW-05 | 23 |
| Chrome second consumer | CHROME-02 | 23 |
| Reactions | REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REACT-06 | 24 |
| Tab badge | NAV-04 | 24 |
| Visual Polish | POLISH-03 | 24 |

**Deliberate deviation from the research proposal (CHROME-03/04/05).** Research suggested CHROME-02/03/04/05 all land in Phase 23. CHROME-03 (always escapable, never persists), CHROME-04 (removed from the a11y tree) and CHROME-05 (one resize, no reheat) are properties of the **mechanism**, not of the in-show consumer:

- Phase 22 is the first phase in which a user can *enter* chrome-hidden state. Shipping CHROME-01 without CHROME-03 ends a phase at a state where a user in an installed PWA (no address bar, no back button) can strand themselves with force-quit as the only escape — which at a show also costs the wake lock. A phase boundary may not leave that open.
- CHROME-04 is an accessibility invariant against a shipped, VoiceOver-verified baseline (A11Y-01). Hidden-but-focusable chrome would be an a11y regression sitting at a phase boundary.
- CHROME-05 names GizzVerse explicitly ("never reheats the GizzVerse simulation"). Its verification surface *is* the Phase-22 surface; asserting it in Phase 23 would be testing a Phase-22 behavior one phase late.

This is the research's own stated rationale followed through: validating the mechanism on the easier surface first means validating its **invariants** there, not only its happy path. Phase 23 then owns CHROME-02 alone — the second consumer, inheriting invariants already proven.

**Device-verification budget (inside the owning phase, never a trailing cleanup):** FOUND-01 installed-instance inset measurement before/after, portrait + landscape (Phase 21) · FOUND-05 share-card PNG at the widest venue name (Phase 21) · NAV-03 two devices on *different* builds (Phase 21) · SHEET-02 VoiceOver + external keyboard re-verification (Phase 22) · NAV-06 Android install from the relocated affordance (Phase 22) · REACT-04 motion parameters and battery cost instrumented on device (Phase 24).

**Standing constraint on FOUND-03:** the requirement is *"write the invariant test, renumber nothing."* Two researchers disagree on whether the z-layer defect is structural (a `position: relative; z-index: 10` stacking context capturing every `fixed` descendant) or numeric (an already-consistent tier ladder with an unidentified real offender); a device repro naming the offending surface resolves it. No phase may promise a renumbering of the z-tier scale — two documented regression guards and a shipped accessibility requirement depend on the current ordering.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Corpus Ingestion & Schema Foundation | v1.0 | 5/5 | Complete | 2026-07-08 |
| 2. Transition Matrix, Model & Backtest | v1.0 | 5/5 | Complete | 2026-07-09 |
| 3. App Shell & PWA Foundation | v1.0 | 4/4 | Complete | 2026-07-09 |
| 4. Show Mode | v1.0 | 7/7 | Complete | 2026-07-13 |
| 5. Live Sync & Data Safety | v1.0 | 6/6 | Complete | 2026-07-14 |
| 6. Pokédex, History & Stats | v1.0 | 12/12 | Complete | 2026-07-16 |
| 7. Explore Mode Constellation | v1.0 | 7/7 | Complete | 2026-07-16 |
| 8. On-Device UI Polish & Accessibility | v1.1 | 8/8 | Complete | 2026-07-18 |
| 9. Data Integrity & Restore UX | v1.1 | 2/2 | Complete | 2026-07-18 |
| 10. Pre-Show Validation & Device Dry-Run | v1.1 | 2/2 | Complete | 2026-07-18 |
| 11. Live-Sync & Prediction Correctness | v1.2 | 5/5 | Complete | 2026-07-19 |
| 12. Data Safety & Integrity | v1.2 | 3/3 | Complete | 2026-07-19 |
| 13. Interface & Explore Polish | v1.2 | 4/4 | Complete | 2026-07-20 |
| 14. Gizz Bingo — Core Marking & Generation | v1.2 | 6/6 | Complete | 2026-07-20 |
| 15. Gizz Bingo — Persistence, Lock & Replay | v1.2 | 4/4 | Complete | 2026-07-21 |
| 16. Gizz Bingo — Build, Live Marking & Celebrations | v1.2 | 6/6 | Complete | 2026-07-21 |
| 17. Backend Foundation & Secrets | v2.0 | 4/4 | Complete | 2026-07-22 |
| 18. Accounts & Offline-Safe Identity | v2.0 | 7/7 | Complete | 2026-07-22 |
| 19. Shared Dex Progress | v2.0 | 4/4 | Complete | 2026-07-24 |
| 20. Presence & Interactions | v2.0 | 5/5 | Complete | 2026-07-24 |
| 21. Layout & Layering Foundations | v2.1 | 13/13 | Complete    | 2026-08-05 |
| 22. Surface Motion & the Chrome Mechanism | v2.1 | 0/? | Not started | - |
| 23. Immersive In-Show Experience | v2.1 | 0/? | Not started | - |
| 24. Reactions & Small Polish | v2.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-07-08*
*v1.0 MVP milestone archived: 2026-07-17 (7 phases, 46 plans, all shipped)*
*v1.1 Polish & Pre-Show Hardening milestone archived: 2026-07-19 (Phases 8–10, 12 plans, 9 requirements, all shipped)*
*v1.2 Pre-Show Hardening milestone archived: 2026-07-22 (Phases 11–16, 28 plans, 22 requirements — 13 bug fixes across Phases 11–13, Gizz Bingo across Phases 14–16)*
*v2.0 Multi-User Foundation milestone archived: 2026-07-24 (Phases 17–20, 20 plans, 27 requirements — SETUP×4 / AUTH×8 / PROG×8 / PRES×7, 100% delivered; audit PASSED)*
*v2.1 UX/UI Polish roadmap added: 2026-07-24 (Phases 21–24, 30 requirements — FOUND×5 / CHROME×5 / SHEET×2 / INSHOW×5 / REACT×6 / NAV×6 / POLISH×1 — 100% coverage; continue-numbering from Phase 20; foundation-first ordering reverses the backlog's A/B/C/D shape)*
