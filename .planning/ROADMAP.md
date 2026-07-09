# Roadmap: Guezzer

## Overview

Guezzer ships along a strict pipeline: verify the kglw.net schema empirically and bake the corpus into a static artifact, build the transition matrix and prediction model with the backtest as a non-negotiable trust gate, stand up the PWA shell so the app survives a dark venue with no signal, then deliver the full Show Mode loop plus live sync and data safety before show #1 (late Aug/Sep 2026). Everything after that — Pokédex, stats, and the Explore Mode constellation — consumes structures the earlier phases already froze, so it can ship safely between shows without losing any data from show #1.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Corpus Ingestion & Schema Foundation** - Verified schema docs, one-command corpus fetch, KGLW-only normalization, tuning-family tagging file (completed 2026-07-08)
- [x] **Phase 2: Transition Matrix, Model & Backtest** - Versioned matrix artifact, all scoring signals, and the CLI backtest trust gate with ablation (completed 2026-07-09)
- [x] **Phase 3: App Shell & PWA Foundation** - Installable offline-first shell with prompt-based updates and persistent IndexedDB storage (completed 2026-07-09)
- [ ] **Phase 4: Show Mode** - The full one-thumb live loop: orbit predictions, logging, trail, tally, crash-proof persistence, wake lock
- [ ] **Phase 5: Live Sync & Data Safety** - Polite 60s `latest` polling with suggest-only auto-fill, and prominent JSON export/import
- [ ] **Phase 6: Pokédex, History & Stats** - Derived dex, retroactive attendance, gap/rarity stats, post-show recap, dex sharing
- [ ] **Phase 7: Explore Mode Constellation** - Force-directed transition graph fed from the same matrix artifact, with dex overlay

## Phase Details

### Phase 1: Corpus Ingestion & Schema Foundation

**Goal**: The full KGLW historical corpus is fetched, validated, and normalized into clean domain data — with every schema assumption documented from real endpoint samples before extraction code exists
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):

  1. A schema document exists, built from real endpoint samples, covering field names, song ordering, `transition_id` segue vocabulary, set/encore delimiting, covers/teases, and multi-set representation — and it was written before any extraction code
  2. Running one documented command fetches the full historical corpus from kglw.net and writes a versioned static JSON artifact bundled with the repo
  3. Every ingestion path filters to `artist_id === 1` and validates that filtered API responses actually match the requested filter (the API silently ignores invalid filters)
  4. A tuning-family tagging file (JSON/CSV) exists with album-derived defaults for ~250 songs, ready for the owner to hand-fill
  5. Era-spanning fixture tests (2012/2017/2022/2025-style shows) pass against the normalizer, proving set structure, segues, and sandwiches parse correctly

**Plans:** 5/5 plans complete

Plans:

- [x] 01-01-PLAN.md — Workspace scaffold, SCHEMA.md v1 (before extraction code), census-mode zod schemas + filter assertion
- [x] 01-02-PLAN.md — Walking Skeleton: normalizer + one-command CLI writes the versioned artifact from committed samples
- [x] 01-03-PLAN.md — Paced fetcher, one-time full corpus pull committed to data/raw, full-corpus census report
- [x] 01-04-PLAN.md — Enum lock from census evidence, SCHEMA.md unknowns resolved, final full-corpus artifact, era fixture tests
- [x] 01-05-PLAN.md — Tuning-family tagging file: album-derived defaults + append-only merge

### Phase 2: Transition Matrix, Model & Backtest

**Goal**: A deterministic, inspectable prediction model exists as a frozen JSON artifact, and the backtest proves (or honestly disproves) that it can be trusted at a live show
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-05, MODL-01, MODL-02, MODL-03, MODL-04, MODL-05, MODL-06, MODL-07, MODL-08, MODL-09, MODL-10, MODL-11, EVAL-01, EVAL-02, EVAL-03, EVAL-05
**Success Criteria** (what must be TRUE):

  1. Running the build-model script emits a versioned, serializable `TransitionMatrix` JSON artifact with a frozen schema and an as-of-date cutoff parameter, with set-boundary/encore transitions excluded or explicitly marked
  2. Given a current song and show state, the predictor returns ranked next-song candidates combining transition frequency, recency decay, hard-segue overrides, rotation suppression, era prior, and the tuning-family backoff chain — already-played songs drop to near zero, nothing plausible is ever hard-zero, and only notated hard segues reach 100%
  3. The backtest runs from Node CLI with zero browser dependencies, holds out the most recent complete tour, and reports top-1/top-5/top-10 hit rates overall and split by hard-segue vs. free-choice
  4. A per-feature ablation report shows accuracy with each signal toggled off, so any signal that doesn't earn its place gets deleted
  5. All model constants live in a single config file, and unit tests on fixture setlists with known expected outputs pass for the scoring pipeline

**Plans:** 5/5 plans complete

Plans:

- [x] 02-01-PLAN.md — Config + type contracts + matrix builder + build-model CLI (frozen TransitionMatrix artifact)
- [x] 02-02-PLAN.md — Predictor core: interpolated backoff base + ranked prediction with rich breakdown
- [x] 02-03-PLAN.md — Scoring signals: decay toggle, rotation, already-played, era prior, hard-segue override
- [x] 02-04-PLAN.md — Backtest: holdout tour + walk-forward top-1/5/10 metrics with hard-segue/free-choice split
- [x] 02-05-PLAN.md — Leave-one-signal-out ablation + paired .md/.json backtest report CLI

### Phase 3: App Shell & PWA Foundation

**Goal**: A friend can install Guezzer to their home screen on iOS or Android and trust it to load fully offline, never swap versions mid-show, and never silently lose their data
**Mode:** mvp
**Depends on**: Phase 2 (matrix artifact schema frozen; can start in parallel with late Phase 2)
**Requirements**: PWA-01, PWA-02, PWA-03
**Success Criteria** (what must be TRUE):

  1. User can install the app to the home screen on both iOS and Android, guided by install onboarding that includes manual iOS instructions
  2. After first load, the app works fully offline; updates arrive only via a user-confirmed prompt with a visible version stamp — never an automatic mid-session swap
  3. Personal data written to IndexedDB persists across relaunches, with `navigator.storage.persist()` requested

**Plans:** 4/4 plans complete

Plans:

- [x] 03-01-PLAN.md — Scaffold + installable/offline/navigable shell + Vitest harness (PWA-01/02)
- [x] 03-02-PLAN.md — Install onboarding: banner + iOS illustrated instructions + permanent menu entry (PWA-01)
- [x] 03-03-PLAN.md — Prompt-based update toast + build-time version stamp (PWA-02)
- [x] 03-04-PLAN.md — Dexie v1 persistence + navigator.storage.persist() (PWA-03)

**UI hint**: yes

### Phase 4: Show Mode

**Goal**: At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the entire setlist without the app ever stalling, moving a tap target, or losing state
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: SHOW-01, SHOW-02, SHOW-03, SHOW-04, SHOW-05, SHOW-06, SHOW-07, SHOW-08, SHOW-09, SHOW-10, SHOW-11, SHOW-12, SHOW-13, EVAL-04, DEX-01
**Success Criteria** (what must be TRUE):

  1. The current song sits at center with the top 5–8 predictions as tappable orbs — sized and placed by probability via a deterministic radial layout (never a force simulation), colored by tuning family, showing percentage and a one-line "why" with tappable detail, and never smaller than ~44px
  2. Tapping an orb recenters and repredicts; the always-visible fuzzy search logs misses as fast as hits; the always-visible "???" button means tracking never stalls; a wrong entry is undone/edited in one tap
  3. User can mark set breaks and the encore, the comet trail shows recent songs with hit/miss rings and compresses older history into a tappable "+N" at 30+ songs, and the running hit/miss tally stays visible all night
  4. Force-quitting the app mid-show and relaunching restores the exact session state (every confirmed song write-through to IndexedDB), and the screen wake lock is held and reacquired on visibility change with fallback messaging
  5. The whole loop is usable one-handed in a dark venue (dark theme, fat targets, gesture suppression), confidence framing honestly reflects the backtest's free-choice accuracy, and the live-tracked show automatically counts as attended

**Plans:** 4/7 plans executed
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Dexie v2 persistence + write helpers + config.show + hit/miss + tally substrate (SHOW-11/06/07/09/03, DEX-01)
- [x] 04-02-PLAN.md — Core fuzzy searchCatalog wrapping fuse.js (SHOW-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — Orbit render: layoutOrbs + confidence + matrix loader + OrbitStage/orb/why (SHOW-01/02/10, EVAL-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — Slice 1 loop: useShowSession + ShowView + Start Show + tap→log→recenter→restore (SHOW-03/11, DEX-01)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 04-05-PLAN.md — Slice 2 miss paths: ActionBar + SearchSheet + ??? (SHOW-04/05)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 04-06-PLAN.md — Set structure + comet trail + tally + undo/edit (SHOW-06/07/08/09)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 04-07-PLAN.md — Wake lock + gesture suppression + weak-fan softening + End Show + device spike (SHOW-12/13, EVAL-04)

**UI hint**: yes

### Phase 5: Live Sync & Data Safety

**Goal**: The app politely borrows kglw.net's live editors as a second set of eyes without ever clobbering manual tracking, and losing a phone can never mean losing a dex
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: SYNC-01, SYNC-02, SYNC-03, PWA-04
**Success Criteria** (what must be TRUE):

  1. During an active show, the app polls only the `latest` endpoint at most once every 60 seconds — never the full `setlists` endpoint from client devices
  2. Editor-logged songs appear as dismissible suggestions only, deduped by song ID, never auto-merged into the user's trail
  3. With airplane mode on, the app remains fully functional; polling resumes silently when signal returns
  4. All personal data (attended shows, tracked setlists, dex) round-trips through prominently surfaced JSON export/import

**Plans**: TBD

### Phase 6: Pokédex, History & Stats

**Goal**: The user's live-show history becomes a browsable collection — every sighting count derived from attendance, every stat honest about sparse data, and the whole dex shareable with friends
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: SHOW-14, STAT-01, STAT-02, STAT-03, STAT-04, DEX-02, DEX-03, DEX-04, HIST-01, SHAR-01, SHAR-02
**Success Criteria** (what must be TRUE):

  1. The Pokédex shows collection completion %, per-song sighting counts derived from attended shows (never hand-tallied), rarest catch, and the never-seen list
  2. User can retroactively mark attended shows from the full kglw.net archive, searchable by date/venue and keyed by stable show ID
  3. Song detail shows gap, play count, and last-played date; the Pokédex shows personal gap; songs with no live history are framed as "debut candidates" instead of fake-precise percentages
  4. After a show, a recap view shows the hit/miss tally, final setlist with set structure, and a show rarity score — and past tracked shows remain viewable as complete setlists
  5. The dex exports/imports as JSON for friend exchange, and the user can generate a shareable summary card (completion %, rarest catch, show count)

**Plans**: TBD
**UI hint**: yes

### Phase 7: Explore Mode Constellation

**Goal**: The user can wander the band's entire transition graph as a living constellation — the same matrix artifact the predictor uses, now visible, filterable, and overlaid with their personal dex
**Mode:** mvp
**Depends on**: Phase 2 (matrix artifact), Phase 6 (dex overlay)
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-06, DEX-05
**Success Criteria** (what must be TRUE):

  1. A force-directed constellation renders from the same matrix JSON as the predictor — nodes sized by play count and colored by tuning family, directed edges thickened by transition frequency
  2. The default view shows only the current-era active rotation with a toggle for the full catalog, and a slider hides edges below a tunable threshold
  3. Clicking a node shows its outgoing next-song probabilities as ranked bars with percentages and one-line "why" explanations, and highlights its neighborhood while dimming the rest
  4. Physics settles and freezes; labels never jitter permanently
  5. The dex overlays the constellation: unseen songs as dimmed silhouettes, seen songs at full color with sighting-count badges

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

**Deadline note:** Phases 1–5 cover every 🎯 (show-#1 hard bar) requirement and must complete before the first show (late Aug/Sep 2026). Phases 6–7 can safely slip past show #1 — attendance auto-marking (Phase 4) and JSON export (Phase 5) guarantee no data is lost in the meantime.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Corpus Ingestion & Schema Foundation | 5/5 | Complete    | 2026-07-08 |
| 2. Transition Matrix, Model & Backtest | 5/5 | Complete    | 2026-07-09 |
| 3. App Shell & PWA Foundation | 4/4 | Complete    | 2026-07-09 |
| 4. Show Mode | 4/7 | In Progress|  |
| 5. Live Sync & Data Safety | 0/TBD | Not started | - |
| 6. Pokédex, History & Stats | 0/TBD | Not started | - |
| 7. Explore Mode Constellation | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-08*
*Phase 1 planned: 2026-07-08 (5 plans)*
*Phase 2 planned: 2026-07-08 (5 plans)*
*Phase 3 planned: 2026-07-09 (4 plans)*
*Phase 4 planned: 2026-07-09 (7 plans)*
