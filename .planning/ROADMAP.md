# Roadmap: Guezzer

## Milestones

- ✅ **v1.0 MVP** — Phases 1–7 (shipped 2026-07-17) — [archived roadmap](./milestones/v1.0-ROADMAP.md) · [requirements](./milestones/v1.0-REQUIREMENTS.md) · [audit](./milestones/v1.0-MILESTONE-AUDIT.md)
- ✅ **v1.1 Polish & Pre-Show Hardening** — Phases 8–10 (shipped 2026-07-19) — [archived roadmap](./milestones/v1.1-ROADMAP.md) · [requirements](./milestones/v1.1-REQUIREMENTS.md)
- ✅ **v1.2 Pre-Show Hardening** — Phases 11–16 (shipped 2026-07-22) — [archived roadmap](./milestones/v1.2-ROADMAP.md) · [requirements](./milestones/v1.2-REQUIREMENTS.md)

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

---
*Roadmap created: 2026-07-08*
*v1.0 MVP milestone archived: 2026-07-17 (7 phases, 46 plans, all shipped)*
*v1.1 Polish & Pre-Show Hardening milestone archived: 2026-07-19 (Phases 8–10, 12 plans, 9 requirements, all shipped)*
*v1.2 Pre-Show Hardening milestone archived: 2026-07-22 (Phases 11–16, 28 plans, 22 requirements — 13 bug fixes across Phases 11–13, Gizz Bingo across Phases 14–16)*
