# Roadmap: Guezzer

## Milestones

- ✅ **v1.0 MVP** — Phases 1–7 (shipped 2026-07-17) — [archived roadmap](./milestones/v1.0-ROADMAP.md) · [requirements](./milestones/v1.0-REQUIREMENTS.md) · [audit](./milestones/v1.0-MILESTONE-AUDIT.md)
- ✅ **v1.1 Polish & Pre-Show Hardening** — Phases 8–10 (shipped 2026-07-19) — [archived roadmap](./milestones/v1.1-ROADMAP.md) · [requirements](./milestones/v1.1-REQUIREMENTS.md)
- ▶ **v1.2 Pre-Show Hardening** — Phases 11–16 (in progress, started 2026-07-19) — 22 requirements (13 bug fixes + Gizz Bingo). Bugs land before Bingo (show-#1 trust gate). See `.planning/notes/v1.2-scope-triage.md`.

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

### ▶ v1.2 Pre-Show Hardening (Phases 11–16) — IN PROGRESS

**Bug fixes land before Gizz Bingo.** The bugs are the show-#1 trust gate for the Aug 14, 2026 residency (3-night no-repeat runs); Bingo is not. Gizz Bingo carries TWO hard upstream gates: (1) the Phase 11 live-sync correctness fixes must land first — Bingo is a new consumer of the same `latest` feed and auto-marking is trust-by-design; (2) a fill-rate Monte-Carlo calibration pre-plan task must run and write locked constants to `packages/core/src/config.ts` before the Bingo generator is built.

- [ ] **Phase 11: Live-Sync & Prediction Correctness** — Tier-1 show-critical: no wrong-show/wrong-artist leakage, drift-tolerant sync, rotation suppression fires on night 2+ (LIVE-01/02/03, PRED-01/02/03)
- [ ] **Phase 12: Data Safety & Integrity** — the exported backup is always honest and complete; same-date doubleheaders survive (SAFE-01/02/03/04)
- [ ] **Phase 13: Interface & Explore Polish** — safe-area inset, wake-lock release race, fill-hint accuracy, constellation camera (UX-01/02/03/04)
- [ ] **Phase 14: Gizz Bingo — Core Marking & Generation** — deterministic consume-once `deriveMarks` fold + seeded generator, behind the calibration gate (BINGO-03)
- [ ] **Phase 15: Gizz Bingo — Persistence, Lock & Replay** — Dexie v5 `bingoCards` + lock-on-Start-Show + export/import + catch-up + GizzDex replay (BINGO-06/07)
- [ ] **Phase 16: Gizz Bingo — Build, Live Marking & Celebrations** — deal + vibe + swap + fill meter, "one away" tension, celebrations, share card (BINGO-01/02/04/05/08)

## Phase Details

### Phase 11: Live-Sync & Prediction Correctness
**Goal**: On night 2+ of a no-repeat residency, tonight's live suggestions and predictions are trustworthy — no previous-show or wrong-artist songs leak in, live sync survives kglw.net API drift, and cross-night rotation suppression actually fires.
**Depends on**: v1.1 complete (Phase 10) — first v1.2 phase
**Requirements**: LIVE-01, LIVE-02, LIVE-03, PRED-01, PRED-02, PRED-03
**Success Criteria** (what must be TRUE):
  1. On night 2+ of a run, live editor suggestions and fill-hints never offer a previous show's song — `latestRows` is date-guarded before feeding suggestions and placeholder resolution (LIVE-01).
  2. The live `latest` poll surfaces only King Gizzard rows — a side-project or other-artist show never enters suggestions or auto-bind (LIVE-02).
  3. An additive kglw.net API field does not silently kill suggestions/auto-bind — schema drift is surfaced on the SyncDot rather than swallowed (LIVE-03).
  4. On night 2+ of a run, songs already played earlier in the run are visibly down-weighted in live predictions — rotation suppression fires with real cross-night data (PRED-01).
  5. Long-retired songs sink as designed (the era-prior floor is reachable), and the user can reset cross-night rotation state before a new run/weekend so prior-run songs are no longer suppressed when the no-repeat window no longer applies (PRED-02, PRED-03).
**Plans**: TBD

### Phase 12: Data Safety & Integrity
**Goal**: The exported JSON backup — the iOS-eviction backstop — is always honest and complete, and same-date doubleheaders survive as distinct attendances through merge and dex derivation.
**Depends on**: None technically (independent bug cluster); sequenced after Phase 11 per Tier-1 → Tier-3 ordering
**Requirements**: SAFE-01, SAFE-02, SAFE-03, SAFE-04
**Success Criteria** (what must be TRUE):
  1. Ending a show then exporting a backup always records that show as finalized — a restored backup never resurrects an "active" show (SAFE-01).
  2. Backup and share-card downloads complete reliably on iOS Safari — no same-tick `revokeObjectURL` aborts the download (SAFE-02).
  3. The "Backup saved" confirmation appears only after a backup actually succeeds, never while the End-Show dialog is still open (SAFE-03).
  4. Two shows attended on the same date are tracked and counted as two distinct attendances across merge and dex derivation — doubleheaders are not collapsed (SAFE-04).
**Plans**: TBD

### Phase 13: Interface & Explore Polish
**Goal**: The remaining low-severity live-venue UI/model rough edges are smoothed — safe-area inset, wake-lock release, fill-hint accuracy, and constellation camera behavior.
**Depends on**: None technically (independent bug cluster); lowest severity — last of the bug phases, before Bingo
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. On a notched iPhone installed PWA, the top safe-area inset applies once (no doubled dead band); overlay headers align with the shell header (UX-01).
  2. The screen wake lock is reliably released after End Show even when release races an in-flight acquire (UX-02).
  3. Fill-hints name the correct song even after skipped or deleted trail entries — no off-by-N (UX-03).
  4. The constellation keeps the user's pan/zoom across container resizes (address-bar collapse, orientation) instead of snapping to fit-all (UX-04).
**Plans**: TBD
**UI hint**: yes

### Phase 14: Gizz Bingo — Core Marking & Generation
**Goal**: A pure, DOM-free `packages/core/src/bingo/` module exists — a deterministic consume-once `deriveMarks` fold and a seeded card generator — proven correct headless and passing the fill-rate calibration gate before any UI or DB is built. This is the third derivation over the tracked-show trail, sibling to `deriveTally` and `deriveDex`.
**Depends on**: **GATE 1** — Phase 11 (live-sync correctness; auto-marking consumes the same `latest` feed, so wrong-show/wrong-artist marks must be impossible first). **GATE 2** — the Monte-Carlo fill-rate calibration pre-plan task (`.planning/research/questions.md` Q1) must run over the 241-show corpus using the real fold and write locked constants (mix weights, `bustOutGapShows`, `jamVehicleSongIds`, `freeIndex`, `specificityRank`) to `packages/core/src/config.ts`. Both gates precede all Bingo work.
**Requirements**: BINGO-03
**Success Criteria** (what must be TRUE):
  1. `deriveMarks(card, trail)` produces byte-identical marks across the live incremental path, full post-show replay, and bulk catch-up — pinned by a `live == replay == catch-up` property test.
  2. Consume-once holds: a single logged song satisfying three squares marks exactly one (documented tie-break), and 15 logged songs never produce more than 15 marks.
  3. A seeded deal always produces a complete 4×4 card (never blank), and the same seed reproduces an identical card. The v1 auto-mark catalog is opener + microtonal + marathon-jam + bust-out + never-caught + album-membership + song squares — **"segue" is excluded** (not trail-derivable; `TrackedEntry` is song-level).
  4. The Monte-Carlo calibration CLI reports P(line) / P(blackout) / dark-square share per vibe over the 241-show corpus, enforces a per-square fire-rate floor, and writes the locked constants to config (GATE 2 cleared — the Bingo equivalent of the backtest trust gate).
**Plans**: TBD

### Phase 15: Gizz Bingo — Persistence, Lock & Replay
**Goal**: Freeze the card artifact and its backup round-trip, wire the GizzGames tab, and make past cards replayable — before the delight layer is built on top. Marks stay derived, never stored; only the card definition + resolved square defs + seed + lock timestamp persist.
**Depends on**: Phase 14 (the frozen `BingoCard` JSON contract + deterministic fold)
**Requirements**: BINGO-06, BINGO-07
**Success Criteria** (what must be TRUE):
  1. Starting a show locks the active card and freezes its RESOLVED square definitions into the Dexie row, so a later corpus/config change can never silently re-deal a locked historical card; reshuffle is rejected on a non-active session.
  2. User can "Catch me up" on a late-joined show — bulk-mark from the live `latest` feed (reusing the shipped adopt-suggestion path) and manually mark/search squares the tracker missed (BINGO-06).
  3. User can view any past show's frozen card with its final marks and win state from GizzDex history — a pure re-derivation, not stored marks (BINGO-07).
  4. A populated v4 database upgrades to Dexie `version(5)` preserving all prior tables, and bingo cards round-trip through JSON export/import (envelope `SCHEMA_VERSION` bumped, `MIGRATIONS` added, `bulkPut` by stable `cardId`).
**Plans**: TBD
**UI hint**: yes

### Phase 16: Gizz Bingo — Build, Live Marking & Celebrations
**Goal**: Ship the playable, fun surface — the two anti-boredom pillars (build agency + near-miss tension) plus celebrations and a shareable result. Fun lives in the build, the "one away" tension, and the reveal — not the marking act itself.
**Depends on**: Phase 15 (persisted, lockable card + GizzGames tab)
**Requirements**: BINGO-01, BINGO-02, BINGO-04, BINGO-05, BINGO-08
**Success Criteria** (what must be TRUE):
  1. User can deal a complete 4×4 card in one tap with a vibe pick (Chill / Balanced / Glory-hunter) — never a blank grid (BINGO-01).
  2. User can reshuffle the whole card and swap any individual square from suggestions (album/event cards with catchability hints, model-bucketed song chips, search), guided by a live expected-fill/difficulty meter, until Start Show locks the card (BINGO-02).
  3. As the setlist is logged, the locked card visibly auto-marks square-by-square (per-square stamp + "which song lit it"), and the user gets continuous "one away" feedback when a line is one square from completing (BINGO-04).
  4. Completing a line / four-corners / X / blackout triggers a reduced-motion-aware celebration — per-square stamps throughout, a big supernova on first line + blackout only (at most two big moments per show) (BINGO-05).
  5. User can share a bingo result-card image (BINGO-08).
**Plans**: TBD
**UI hint**: yes

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
| 11. Live-Sync & Prediction Correctness | v1.2 | 0/— | Not started | - |
| 12. Data Safety & Integrity | v1.2 | 0/— | Not started | - |
| 13. Interface & Explore Polish | v1.2 | 0/— | Not started | - |
| 14. Gizz Bingo — Core Marking & Generation | v1.2 | 0/— | Not started | - |
| 15. Gizz Bingo — Persistence, Lock & Replay | v1.2 | 0/— | Not started | - |
| 16. Gizz Bingo — Build, Live Marking & Celebrations | v1.2 | 0/— | Not started | - |

---
*Roadmap created: 2026-07-08*
*v1.0 MVP milestone archived: 2026-07-17 (7 phases, 46 plans, all shipped)*
*v1.1 Polish & Pre-Show Hardening milestone archived: 2026-07-19 (Phases 8–10, 12 plans, 9 requirements, all shipped)*
*v1.2 Pre-Show Hardening roadmap added: 2026-07-19 (Phases 11–16, 22 requirements — 13 bug fixes across Phases 11–13, Gizz Bingo across Phases 14–16)*
