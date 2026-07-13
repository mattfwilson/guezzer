# Guezzer

## What This Is

A mobile-friendly PWA that predicts the next song King Gizzard and the Lizard Wizard will play during a live show. Given the current song, it shows the top 5–10 most likely next songs with confidence scores, tracks the running setlist as the show progresses, and doubles as a personal "Pokédex" of songs caught live. Built for the owner and fewer than 10 friends attending multiple shows (several consecutive nights of the same tour) in summer 2026. A personal tool, not a product — no accounts, no monetization, no App Store distribution.

## Core Value

At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.

## Requirements

### Validated

**Data ingestion (Validated in Phase 1: Corpus Ingestion & Schema Foundation):**
- [x] Empirical schema documentation FIRST: fetched samples from kglw.net endpoints and documented field names, song ordering, segue/transition notation, set/encore delimiting, covers/teases in `docs/SCHEMA.md` — written before any extraction code existed
- [x] Fetch historical corpus ONCE at build time; bundled as static JSON artifact (`data/raw/`, `data/normalized/corpus.json` — 738 shows, 264 songs). One-command refresh script (`npm run refresh`) documented for pre-tour-leg rebuilds

**App shell & PWA foundation (Validated in Phase 3: App Shell & PWA Foundation):**
- [x] PWA: installable to home screen on iOS (confirmed live on real iPhone Safari) and Android (code-level: `beforeinstallprompt` capture + unit-tested detection; live device confirmation deferred, no Android device available), offline-capable via service worker (confirmed live: real-device airplane-mode reload)
- [x] Prompt-based update flow: waiting service worker surfaces a non-blocking toast; the running version only swaps on an explicit user tap, never automatically (confirmed live: two sequential builds, Refresh/Later both verified)
- [x] IndexedDB persistence foundation (Dexie v1 schema) with `navigator.storage.persist()` requested silently on first interaction; a real write survives force-quit/relaunch (confirmed live on installed iPhone PWA). JSON export/import and the attended-show list UI itself are Phase 5+ scope, not yet built

**Prediction model (Validated in Phase 2: Transition Matrix, Model & Backtest):**
- [x] Weighted Markov transition model — inspectable, deterministic, backtestable; recomputes on new data ingestion (no online training, no neural nets)
- [x] Signal 1: first-order transition frequency P(next | current) from historical setlists
- [x] Signal 2: recency/era exponential decay (tunable half-life); current + previous tour dominate
- [x] Signal 3: hard segue pairs from segue notation (`>` / `->`) and jamcharts — override base model at very high confidence
- [x] Signal 4: rotation suppression — songs played in the last 1–3 shows of the current tour heavily downweighted
- [x] Signal 5: base play probability in current era as smoothing prior
- [x] Signal 6: tuning-family affinity — hand-tagged via `data/tuning-tags.json`; used only in the sparse-data backoff tier, not as a top-level multiplier
- [x] Sparse-data backoff: transition model → same-tuning-family affinity → same-album/era affinity → base play probability. Never a hard zero for a plausible song; never 100% except a notated hard segue
- [x] Backtest: hold out most recent complete tour, train on prior; reports top-1/top-5/top-10 hit rate, overall and split by hard-segue vs. free-choice; per-feature ablation (report-only, no go/no-go gate); paired `.md`/`.json` CLI report (`data/backtest-report.md`, `data/backtest.json`)

**Show Mode (Validated in Phase 4: Show Mode — code-complete, 181 tests green; on-device device gate `04-HUMAN-UAT.md` pending before show #1):**
- [x] Orbit view: center current song, adaptive 5–8 tappable prediction orbs (radial layout scaled by probability, tuning-family color, honest % on orb); tap a played prediction to recenter and repredict (deterministic `layoutOrbs`, ≥56px targets)
- [x] Deterministic radial layout — no force simulation; tap targets never move on their own
- [x] Miss path is one persistent tap: always-visible fuzzy search (core `searchCatalog`/fuse.js) over the full 264-song catalog; selecting recenters. Always-visible ??? button logs a renamable placeholder miss with zero confirmation friction
- [x] Prediction explanations: tappable per-orb "why" detail (Info control never logs)
- [x] Live show tracker with crash-proof persistence: confirmed songs append to the setlist trail via Dexie v2 write-through; within-show rotation drops already-played songs; force-quit/relaunch restores the exact active session (code-level; live-device confirm deferred to `04-HUMAN-UAT.md`)
- [x] Comet trail: last ~4 diminishing nodes with hit/miss rings, "+N" compression at 30+ songs; persistent running hit/miss tally; trail-node edit/delete/rename (edit re-classifies hit/miss honestly)
- [x] Dark-venue survivability: Wake Lock (verify-held + reacquire on visibilitychange + calm pre-iOS-18.4 fallback), gesture suppression on the stage, weak-fan softening on low-confidence moments, End Show finalize (device-perceptual confirmation deferred to `04-HUMAN-UAT.md`)
- [x] Provisional dex attendance recorded at Start Show (the tracked-show row itself)

### Active

**Show Mode (core loop validated in Phase 4 — see Validated; remaining open items):**
- [ ] Live sync from kglw.net: poll `latest` every 60s during an active show, offer to auto-fill editor-logged songs; manual entry is primary; fully offline once loaded, syncs when signal returns (Phase 5)
- [ ] On-device confirmation of the dark-venue survivability layer (Wake Lock hold/fallback, silent reacquire, gesture suppression, force-quit restore, End Show) on the oldest installed-PWA iOS device — tracked in `04-HUMAN-UAT.md`, run before show #1

**Prediction model (core scoring validated in Phase 2; UI surfacing is Show Mode's job):**
- [ ] Signal 7 (nice-to-have): set-position awareness (opener/closer/encore distributions) if the data supports it cleanly — not attempted in Phase 2, still open
- [ ] Honest uncertainty: if free-choice top-5 accuracy < ~25%, surface it in the UI (wider confidence framing), don't imply false precision — Phase 2 backtest measured free-choice top-5 at 68.6% (well above the floor), but the UI surfacing itself is unbuilt

**Data ingestion:**
- [ ] Live polling limited to lightweight `latest` endpoint, ≤ once per 60s. Never hammer full `setlists` from client devices

**Explore Mode (may ship after show #1; matrix must feed it from day one):**
- [ ] Force-directed transition constellation: nodes = songs (size = play count, color = tuning family), directed edges = observed transitions (thickness = frequency)
- [ ] Click a node → outgoing next-song probabilities as ranked bars with percentages and one-line "why" explanations (doubles as the model debugger during development)
- [ ] Default view: current-era active rotation only (songs in last N shows, tunable); toggle for full historical catalog
- [ ] Edge filtering below tunable transition-count/probability threshold
- [ ] Focus+context: clicking a node highlights its neighborhood, dims the rest
- [ ] Physics settles and freezes; labels never jitter permanently
- [ ] Era slider (2010 → present) — v1.5 stretch, not MVP

**Show history & Pokédex:**
- [ ] Past tracked shows viewable as complete setlists
- [ ] Pokédex: per-song sighting counts DERIVED (never hand-tallied) from attended shows; user marks attendance including retroactively from the full kglw.net archive (searchable by date/venue); live-tracked shows auto-count
- [ ] Pokédex UI: collection completion %, per-song sighting count, rarest catch (lowest base-rate song seen), never-seen list
- [ ] Pokédex overlays the constellation: unseen songs as dimmed silhouettes, seen at full color, sighting count as badge/ring
- [ ] Dex sharing (no backend): JSON export/import + shareable summary card (image or text) for friend-group comparison

**Persistence & platform:**
- [x] PWA installable, offline-capable — validated in Phase 3 (see Validated section above); shareable via URL still open (no sharing UI built yet)
- [ ] Attended-show list and live-tracked setlists in IndexedDB (persistence mechanism validated in Phase 3); JSON export/import as backup/transfer; export surfaced prominently (losing a phone must not mean losing a dex; iOS Safari eviction risk makes this extra important)

### Out of Scope

- **Native apps (React Native / Flutter / App Store / TestFlight)** — pure overhead for <10 users on a deadline; PWA decision is confirmed, do not relitigate
- **HTML scraping of kglw.net** — free public JSON API exists; use it exclusively
- **Musical key signature as a model signal** — not in the kglw.net API; Spotify audio-features closed to new apps; third-party key sites are repackaged Spotify data; audio-based detection produces garbage on the microtonal catalog. Tuning family replaces it with a mechanically causal, hand-taggable feature
- **Time signature as a model signal** — no reliable data source, no causal mechanism (transition matrix already captures groove/energy from actual behavior)
- **Genre tendencies** — album-as-genre-proxy is a v2 experiment only, and only if backtest shows it beats tuning-family backoff
- **Black-box ML / neural nets / online training** — model must be inspectable, deterministic, backtestable
- **User accounts, social features beyond dex export/import, push notifications** — personal tool
- **Supporting other bands** — KGLW only
- **Server-side anything** — dataset (~900 shows, ~250 songs) is small enough to run the model client-side; if planning believes a backend is genuinely required, it must state why before assuming one
- **Real-time shared state between friends** — conscious v2 decision if the group demands it

## Context

- **Data source:** kglw.net free public JSON API, base URL `https://kglw.net/api/v2`, no auth. Methods: `setlists`, `latest` (updated LIVE during shows by site editors), `shows`, `songs`, `venues`, `jamcharts`, `albums`. Append `.json`; patterns: `/[method].json` (all rows), `/[method]/[ID].json` (one row), `/[method]/[column]/[value].json` (filtered); supports `order_by` and other GET params. Docs: `https://kglw.net/api/docs.php`. Data spans 900+ shows, 2010–present. Volunteer-run fan site — be polite (see Constraints)
- **Tuning families:** the band batches songs by guitar tuning to minimize instrument swaps — roughly standard, C# standard (metal material), microtonal (dedicated quarter-tone guitars: Flying Microtonal Banana, K.G., L.W., etc.). Owner will hand-tag ~250 songs given a simple tagging file
- **Usage pattern:** several friends attend consecutive nights of the same tour, making rotation suppression a top-3 signal
- **Devices:** mixed iOS/Android — both first-class. iOS Safari PWA quirks (IndexedDB eviction when not installed to home screen) drive install prompts and prominent export
- **Venue reality:** unreliable cell service, dark, crowded, one-thumb operation, possibly slightly drunk operator — offline-first and fat tap targets are functional requirements, not polish

### Open questions to resolve during planning (ask, don't assume)

1. Decay half-life and rotation penalty defaults — propose values, justify from the backtest
2. Constellation default-view scope: how many recent shows define "active rotation," and what edge threshold keeps the default graph readable — propose after seeing real data density

**Resolved in Phase 1** (`docs/SCHEMA.md`, `data/census-report.md`):
- Setlist/segue notation schema — documented empirically from real endpoint samples
- Tour boundaries — explicit `tour_id` field; `tour_id: 1` is a reserved "Not Part of a Tour" sentinel, not a real tour
- `show_id` (10-digit integer) is a stable, permanent identifier — confirmed suitable as the Pokédex attendance-marking key

## Constraints

- **Timeline**: Usable before the first show, late August/September 2026 (~6–8 weeks) — bias every decision toward shipping a working core over completeness. Features 1–4 (full Show Mode loop incl. live sync) are the show-#1 bar; backtest report is a non-negotiable trust gate before relying on it live
- **Tech stack**: TypeScript throughout; Next.js or Vite + React, static-export deployable to Vercel/Netlify/GitHub Pages; no backend
- **Architecture**: Strict core/UI separation — all domain logic (API ingestion, transition-matrix construction, prediction scoring, backtesting, Pokédex derivation) in a pure TypeScript `core/` module with zero React/DOM/browser dependencies; UI imports from core, never the reverse; entire core runnable/testable from Node CLI including the backtest report
- **Data structure**: Transition matrix is a clean, serializable plain-JSON structure consumed by BOTH the predictor and the constellation renderer — no entanglement with scoring or rendering code
- **Rendering**: Constellation via d3-force (or equivalent) in a single component; graph data derived from the same matrix JSON, never a second pipeline
- **Configuration**: All model constants (decay half-life, rotation penalty, backoff weights, constellation edge thresholds) in a single config file — no scattered magic numbers
- **Testing**: Unit tests for the scoring pipeline AND dex derivation using small fixture setlists with known expected outputs
- **API etiquette**: Historical corpus fetched once at build time and bundled as static JSON; live polling only `latest`, ≤ 1/60s; volunteer-run fan site
- **Compatibility**: Mixed iOS/Android; PWA installable on both

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA, not native | App Store/TestFlight are pure overhead for <10 users on a deadline; URL-shareable, home-screen installable | — Pending |
| kglw.net JSON API exclusively, no scraping | Free public API exists; volunteer-run site deserves polite usage | Validated Phase 1 — paced fetcher (2s delay, no retries, descriptive User-Agent) pulled the full 2010–2026 corpus |
| Weighted Markov model, not black-box ML | Must be inspectable, deterministic, backtestable; fancier approaches must beat it in backtest to displace it | Validated Phase 2 — `buildMatrix`/`predict` are pure, deterministic, config-driven; backtest top-5 66.9% overall / 68.6% free-choice on the held-out tour |
| Tuning family replaces key signature | Key data unavailable/garbage for microtonal catalog; tuning is mechanically causal (instrument swaps) and hand-taggable | Validated Phase 2 — `tuningAffinity` backoff tier consumes `MatrixNode.tuningFamily` baked at build time |
| Tuning family only in backoff tier | Transition matrix already encodes tuning clustering implicitly for observed pairs | Validated Phase 2 — `predict.ts` reads `tuningFamily` only inside the sparse-data backoff blend, never as a top-level multiplier |
| No force simulation in Show Mode | Tap targets must never move on their own in a live-venue context | — Pending |
| Client-side model, no backend | ~900 shows / ~250 songs fits client-side; backend requires explicit justification during planning | — Pending |
| Pokédex counts derived, never hand-tallied | Attendance marking is the single source of truth; sighting counts computed from it | — Pending |
| Schema verification before extraction code | Segue notation/set delimiting must be documented empirically, not assumed | Validated Phase 1 — `docs/SCHEMA.md` committed before any normalize/extraction code existed (git history confirms ordering) |
| Show-#1 bar = MVP features 1–4 | Full Show Mode loop incl. live sync; Explore Mode may ship after show #1 but matrix feeds it from day one | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-13 after Phase 4: Show Mode*
