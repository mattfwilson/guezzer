# Requirements: Guezzer — v1.1 Polish & Pre-Show Hardening

**Defined:** 2026-07-17
**Core Value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.

**Milestone goal:** Close the v1.0 audit's non-blocking gaps and prove the app show-ready on real hardware before show #1 (late Aug/Sep 2026). No new user-facing features — a low-risk hardening pass.

## v1.1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### UI Polish

- [x] **POLISH-01**: On a small phone screen, prediction-orb and center-node song names render fully legible — no truncation, overflow, or oversizing. Verify the Phase-6 `orbLabelFit`/`ORB_LABEL` helpers on-device and fix any residual. (Closes the 2026-07-11 orb-text todo.)
- [x] **POLISH-02**: The Show-Mode FAB speed-dial (D-20) and once-per-version InstallBanner (D-22) are verified against their originating todos and the todos are formally moved to resolved — confirm implemented behavior matches intent (both landed in Phase 6).

### Accessibility

- [x] **A11Y-01**: Every bottom sheet and modal dialog (NodeSheet, AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, the "Whose dex is this?" prompt, CompareView) can be dismissed with the Escape key and manages focus — focus is trapped while open and restored to the trigger on close.
- [x] **A11Y-02**: While a constellation node is focused, the NodeSheet does not occlude the Explore FilterFab (both remain usable).
- [x] **A11Y-03**: Resizing the viewport while a constellation node is focused keeps the camera framed on the focused node (no snap-off).

### Data Integrity

- [ ] **DATA-06**: `shownotes` is carried verbatim through ingestion AND normalization into the domain model, matching `docs/SCHEMA.md` §12, with an automated test asserting it survives normalization — so a future show-level-prose feature needs no full re-normalize. (Resolves audit WR-01.)

### Data Safety

- [ ] **PWA-05**: On a fresh/evicted DB (owner name unset), typing your own owner name into the "Whose dex is this?" prompt restores (merges) your backup — the name-match path reaches the merge path, not only the explicit "It's mine, restore it" button. (Polishes the WARNING-1 fix from quick 260716-vw2.)

### Pre-Show Validation

- [ ] **VALID-01**: The owner completes the tuning-family tag spot-check (DATA-04) — ~10 well-known songs verified musically sensible and the `needsReview` subset hand-filled as needed, so predictions aren't skewed by silent tuning misclassification.
- [ ] **VALID-02**: A full show-loop dry-run on a real device passes before show #1 — start → predictions → log hits/misses → set break → encore → End Show → recap → dex credit → JSON export/import round-trip — with Android exercised if a device is available.

## Future Requirements (deferred to v2+)

Tracked, not in this milestone.

- **MODL-V2-01**: Set-position awareness (opener/closer/encore distributions) as a scoring signal — set-structure data captured in v1
- **MODL-V2-02**: Album-as-genre-proxy affinity experiment — only if it beats tuning-family backoff in backtest
- **MODL-V2-03**: Tease/jam-notation awareness beyond segue pairs — needs schema evidence first
- **EXPL-V2-01**: Era slider scrubbing the constellation through time (2010 → present)
- **SOCL-V2-01**: Real-time shared setlist state between friends during shows — reopens the "no backend" constraint; revisit only if the group demands it
- **iOS <18.4 Wake Lock fallback path** — exercise the pre-18.4 false-positive fallback on-device if such a device becomes available (unit-covered today)

## Out of Scope

Explicitly excluded for v1.1 (same product-level exclusions as v1.0 carry forward: native apps, HTML scraping, key/time-signature signals, black-box ML, user accounts, server-side anything, supporting other bands).

| Feature | Reason |
|---------|--------|
| Any new user-facing feature | v1.1 is a hardening milestone — polish and de-risk before show #1, don't expand surface area |
| Backend / real-time sync | "No backend" constraint holds; shared-setlist social is a v2 decision |
| New model signals | Set-position / album-genre experiments are v2 — must beat the backtest to earn a place |

## Traceability

Which phases cover which requirements. Filled by the roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POLISH-01 | Phase 8 | Planned |
| POLISH-02 | Phase 8 | Planned |
| A11Y-01 | Phase 8 | Planned |
| A11Y-02 | Phase 8 | Planned |
| A11Y-03 | Phase 8 | Planned |
| DATA-06 | Phase 9 | Planned |
| PWA-05 | Phase 9 | Planned |
| VALID-01 | Phase 10 | Planned |
| VALID-02 | Phase 10 | Planned |

**Coverage:**

- v1.1 requirements: 9 total
- Mapped to phases: 9 (Phase 8: 5, Phase 9: 2, Phase 10: 2)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-17 for milestone v1.1 Polish & Pre-Show Hardening*
*Traceability filled: 2026-07-17 — all 9 requirements mapped across Phases 8–10*
