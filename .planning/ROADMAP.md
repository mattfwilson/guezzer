# Roadmap: Guezzer

## Milestones

- ✅ **v1.0 MVP** — Phases 1–7 (shipped 2026-07-17) — [archived roadmap](./milestones/v1.0-ROADMAP.md) · [requirements](./milestones/v1.0-REQUIREMENTS.md) · [audit](./milestones/v1.0-MILESTONE-AUDIT.md)
- 🚧 **v1.1 Polish & Pre-Show Hardening** — Phases 8–10 (planned 2026-07-17) — close the v1.0 audit's non-blocking gaps and prove the app show-ready on real hardware before show #1

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

### 🚧 v1.1 Polish & Pre-Show Hardening (Phases 8–10)

Small, low-risk hardening milestone — no new user-facing features. Close the v1.0 audit's non-blocking gaps (UI polish, accessibility, data integrity, restore UX) and prove the app show-ready on real hardware before show #1 (late Aug/Sep 2026). Bias toward shipping the hardening quickly.

- [ ] **Phase 8: On-Device UI Polish & Accessibility** — Legible labels + Escape/focus-managed sheets and dialogs across Show and Explore
- [ ] **Phase 9: Data Integrity & Restore UX** — `shownotes` survives normalization; owner can always recover their own backup
- [ ] **Phase 10: Pre-Show Validation & Device Dry-Run** — Owner tuning-tag spot-check + full real-device show-loop rehearsal before show #1

## Phase Details

### Phase 8: On-Device UI Polish & Accessibility
**Goal**: Every on-screen label is legible and every sheet/dialog is keyboard- and focus-accessible on real phone hardware — closing the v1.0 audit's UI-polish and accessibility gaps.
**Depends on**: v1.0 MVP (Phases 1–7, shipped)
**Requirements**: POLISH-01, POLISH-02, A11Y-01, A11Y-02, A11Y-03
**Success Criteria** (what must be TRUE):
  1. On a small phone screen, every prediction-orb and center-node song name renders fully — no truncation, overflow, or oversizing (POLISH-01).
  2. The Show-Mode FAB speed-dial (D-20) and once-per-version InstallBanner (D-22) behave as their originating todos intended, and those todos are formally moved to resolved (POLISH-02).
  3. Every bottom sheet and modal dialog (NodeSheet, AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, "Whose dex is this?" prompt, CompareView) dismisses with Escape, traps focus while open, and restores focus to its trigger on close (A11Y-01).
  4. While a constellation node is focused, the NodeSheet and the Explore FilterFab are both fully usable — no occlusion (A11Y-02).
  5. Resizing the viewport with a node focused keeps the camera framed on that node — no snap-off (A11Y-03).
**Plans**: 7 plans
  - [ ] 08-01-PLAN.md — a11y foundation: shared `<Sheet>` primitive + useFocusTrap/useDialogDismiss/dialogStack/inertRoot, config.ui.z tier scale, #app-content inert target, matchMedia test stub (A11Y-01, A11Y-02)
  - [ ] 08-02-PLAN.md — migrate Show-area modals (EndShowDialog, TrailNodeSheet, WhyDetail) onto `<Sheet>` (A11Y-01)
  - [ ] 08-03-PLAN.md — migrate Menu/Dex/Settings modals (AppMenu, ShareCardSheet, CompareView fullscreen, "Whose dex is this?" prompt) onto `<Sheet>` (A11Y-01)
  - [ ] 08-04-PLAN.md — Explore a11y: NodeSheet Escape/focus-restore (non-modal), FilterFab lift above sheet, shared visible-viewport source, resize reframe (A11Y-02, A11Y-03)
  - [ ] 08-05-PLAN.md — migrate all remaining raw z-* literals onto config.ui.z; annotate the folded bottom-sheets todo (A11Y-01, A11Y-02)
  - [ ] 08-06-PLAN.md — orb-label legibility: retune fitOrbLabel/ORB_LABEL, real-catalog test, on-device dev harness (POLISH-01)
  - [ ] 08-07-PLAN.md — verify D-20 FabMenu + D-22 InstallBanner, move todos to resolved (POLISH-02)
**UI hint**: yes

### Phase 9: Data Integrity & Restore UX
**Goal**: Ingested show data preserves everything a future feature will need, and an owner can never fail to recover their own backup on a fresh or evicted database.
**Depends on**: v1.0 MVP (Phases 1–7, shipped)
**Requirements**: DATA-06, PWA-05
**Success Criteria** (what must be TRUE):
  1. `shownotes` is carried verbatim through ingestion AND normalization into the domain model per `docs/SCHEMA.md` §12, so a future show-level-prose feature needs no full re-normalize (DATA-06).
  2. An automated test asserts `shownotes` survives normalization end-to-end (DATA-06).
  3. On a fresh/evicted DB with the owner name unset, typing your own owner name into the "Whose dex is this?" prompt reaches the merge/restore path — not only the explicit "It's mine, restore it" button — and merges the backup without dropping local data (PWA-05).
**Plans**: TBD

### Phase 10: Pre-Show Validation & Device Dry-Run
**Goal**: The owner has hands-on proof the app is show-ready before show #1 — the tuning model is musically sane and the full show loop survives a real-device rehearsal.
**Depends on**: Phase 8, Phase 9 (validation exercises the polished, hardened app)
**Requirements**: VALID-01, VALID-02
**Success Criteria** (what must be TRUE):
  1. The owner completes the tuning-family tag spot-check (DATA-04) — ~10 well-known songs verified musically sensible and the `needsReview` subset hand-filled as needed, so predictions aren't skewed by silent tuning misclassification (VALID-01).
  2. A full show-loop dry-run passes on a real device: start → predictions → log hits/misses → set break → encore → End Show → recap → dex credit → JSON export/import round-trip (VALID-02).
  3. Android is exercised in the dry-run if a device is available (VALID-02).
**Plans**: TBD

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
| 8. On-Device UI Polish & Accessibility | v1.1 | 0/7 | Not started | - |
| 9. Data Integrity & Restore UX | v1.1 | 0/? | Not started | - |
| 10. Pre-Show Validation & Device Dry-Run | v1.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-07-08*
*v1.0 MVP milestone archived: 2026-07-17 (7 phases, 46 plans, all shipped)*
*v1.1 Polish & Pre-Show Hardening added: 2026-07-17 (Phases 8–10, 9 requirements)*
