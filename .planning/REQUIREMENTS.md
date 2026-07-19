# Requirements: Guezzer — v1.2 Pre-Show Hardening

**Defined:** 2026-07-19
**Core Value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.

Milestone theme: harden the live-show-critical paths (live sync, prediction correctness, data safety) before the Aug 14, 2026 residency, then ship the first casual engagement feature (Gizz Bingo). **Bug fixes land before Bingo.** Scope triage: `.planning/notes/v1.2-scope-triage.md`. Bingo research: `.planning/research/v1.2/SUMMARY.md`.

## v1.2 Requirements

### Live-Sync Correctness (LIVE) — Tier 1 show-critical

- [ ] **LIVE-01**: On night 2+ of a run, live editor suggestions and fill-hints never offer a previous show's songs (`latestRows` is date-guarded before feeding suggestions/placeholder resolution).
- [ ] **LIVE-02**: The live `latest` poll surfaces only King Gizzard rows — a side-project or other-artist show never enters suggestions or auto-bind.
- [ ] **LIVE-03**: Live sync survives additive kglw.net API schema changes — a new API field does not silently kill suggestions/auto-bind; drift is surfaced (SyncDot), not swallowed.

### Prediction Correctness (PRED) — Tier 1

- [ ] **PRED-01**: On night 2+ of a run, songs already played earlier in the run are down-weighted in live predictions — rotation suppression fires with real cross-night data.
- [ ] **PRED-02**: The era-prior signal down-weights long-retired songs as designed (unit mismatch fixed; the retired-song floor is reachable).
- [ ] **PRED-03**: User can reset the cross-night rotation state before a new run of shows, so songs played in a prior run/weekend are no longer down-weighted when the no-repeat window no longer applies (e.g. a separate weekend where the band may replay).

### Data Safety & Integrity (SAFE) — Tier 1/2

- [ ] **SAFE-01**: Ending a show then exporting a backup always records that show as finalized — the backup never resurrects an "active" show on restore.
- [ ] **SAFE-02**: Backup and share-card downloads complete reliably on iOS Safari — no same-tick `revokeObjectURL` aborting the download.
- [ ] **SAFE-03**: The "Backup saved" confirmation appears only after a backup actually succeeds, never while the End-Show dialog is still open.
- [ ] **SAFE-04**: Two shows attended on the same date are tracked and counted as distinct attendances across merge and dex derivation (doubleheaders not collapsed).

### Interface & Explore Polish (UX) — Tier 3

- [ ] **UX-01**: On a notched iPhone installed PWA, the top safe-area inset applies once (no doubled dead band); overlay headers align with the shell header.
- [ ] **UX-02**: The screen wake lock is reliably released after End Show even when release races an in-flight acquire.
- [ ] **UX-03**: Fill-hints name the correct song even after skipped or deleted trail entries (no off-by-N).
- [ ] **UX-04**: The constellation keeps the user's pan/zoom across container resizes (address-bar collapse, orientation) instead of snapping to fit-all.

### Gizz Bingo (BINGO) — feature

> **Phase gates (both must clear before the generator is built):** (1) the Tier-1 LIVE fixes land first — Bingo is a new consumer of the same `latest` feed and auto-marking is trust-by-design; (2) the fill-rate Monte-Carlo calibration (`.planning/research/questions.md` Q1) runs over the 241-show corpus and writes locked constants to `packages/core/src/config.ts`. Auto-mark catalog: opener, microtonal, marathon-jam, bust-out, never-caught, album-membership (variety engine), + song squares — **"segue" is excluded** (not trail-derivable; `TrackedEntry` is song-level). Marks are DERIVED, never stored (single deterministic `deriveMarks(card, trail)` fold with documented consume-once tie-break; live==replay==catch-up property test).

- [ ] **BINGO-01**: User can deal a 4×4 card in one tap with a vibe pick (Chill/Balanced/Glory-hunter) — never a blank grid.
- [ ] **BINGO-02**: User can reshuffle the whole card and swap any individual square from suggestions (album/event cards with catchability hints, model-bucketed song chips, search), guided by a live expected-fill/difficulty meter, until Start Show locks the card.
- [ ] **BINGO-03**: The locked card auto-marks itself (deterministic consume-once) as the show's setlist is logged — live in the GizzGames tab, with no manual daubing required.
- [ ] **BINGO-04**: User gets continuous "one away" feedback when a line is one square from completing.
- [ ] **BINGO-05**: Completing a line / four-corners / X / blackout triggers a celebration (per-square stamps throughout; a big supernova on first line + blackout only), reduced-motion aware.
- [ ] **BINGO-06**: User can "Catch me up" on a late-joined show (bulk-mark from the live `latest` feed) and manually mark/search squares the tracker missed.
- [ ] **BINGO-07**: User can view any past show's frozen card with its final marks and win state from GizzDex history.
- [ ] **BINGO-08**: User can share a bingo result-card image.

## Future Requirements

Deferred to a later milestone (backlog unchanged in `.planning/todos/pending/`).

### Engagement features (deferred)
- **GAME-V1.3-01**: Gizz Bingo shared-seed leaderboard — comparable cards + first-to-bingo across friends at the same show (seed: `.planning/seeds/gizz-bingo-shared-leaderboard.md`).
- Gizzle (daily song-guessing puzzle), Guezz League (pregame prediction game), Couch Mode (follow from home), Badge system, My Stats & Want List, Residency Mode (no-repeat pool UI), Shiny catches, Song Dossiers + lore codex, Know-Before-You-Go primer.

### UI polish (deferred)
- Directional-flow edge particles (GizzVerse), unified bottom-sheet up/down animation, app-wide "Mon D, YYYY" date format, final show share card uses GizzDex totals.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bingo leaderboard / multiplayer in v1.2 | Personal squares (never-caught) make cards non-comparable; deferred to a shared-seed variant post-v1 (GAME-V1.3-01). |
| Live duration / clock-timed bingo squares | Track durations do not exist in kglw.net data; replaced by a static "marathon jam" tag. |
| Any backend / accounts for Bingo | Hard project constraint — no backend; solo/personal only. |
| Real-time shared setlist state between friends | Reopens the "no backend" constraint (SOCL-V2-01, out of scope until explicitly reconsidered). |

## Traceability

Filled by the roadmapper during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIVE-01 | TBD | Pending |
| LIVE-02 | TBD | Pending |
| LIVE-03 | TBD | Pending |
| PRED-01 | TBD | Pending |
| PRED-02 | TBD | Pending |
| PRED-03 | TBD | Pending |
| SAFE-01 | TBD | Pending |
| SAFE-02 | TBD | Pending |
| SAFE-03 | TBD | Pending |
| SAFE-04 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |
| BINGO-01 | TBD | Pending |
| BINGO-02 | TBD | Pending |
| BINGO-03 | TBD | Pending |
| BINGO-04 | TBD | Pending |
| BINGO-05 | TBD | Pending |
| BINGO-06 | TBD | Pending |
| BINGO-07 | TBD | Pending |
| BINGO-08 | TBD | Pending |

**Coverage:**
- v1.2 requirements: 22 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 22 ⚠️

---
*Requirements defined: 2026-07-19 for milestone v1.2 Pre-Show Hardening*
*Last updated: 2026-07-19*
