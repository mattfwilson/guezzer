# Guezzer

## What This Is

A mobile-friendly PWA that predicts the next song King Gizzard and the Lizard Wizard will play during a live show. Given the current song, it shows the top 5–10 most likely next songs with confidence scores, tracks the running setlist as the show progresses, and doubles as a personal "Pokédex" of songs caught live. Built for the owner and fewer than 10 friends attending multiple shows (several consecutive nights of the same tour) in summer 2026. A personal tool, not a product — no accounts, no monetization, no App Store distribution.

## Core Value

At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Show Mode (must work at show #1 — hard deadline):**
- [ ] Orbit view: current song at center, top 5–8 predicted next songs as tappable orbs (size/orbit distance scale with probability, colored by tuning family, percentage on orb); tap a played prediction to recenter and repredict
- [ ] Deterministic radial layout — no force simulation in Show Mode; tap targets never move on their own; ~44px minimum orb size regardless of probability
- [ ] Miss path is one persistent tap: always-visible fuzzy search over the full catalog; selecting recenters. Misses as fast as hits
- [ ] Always-visible "unknown song" button logs a ??? placeholder (renamable later) so tracking never stalls
- [ ] Prediction explanations: one-line "why" on each orb / tappable detail (e.g., "notated segue 14/15 times since 2024")
- [ ] Live show tracker: confirmed songs append to the setlist trail; predictions condition on within-show rotation (already-played songs drop to near zero)
- [ ] Comet trail: last ~4 songs as diminishing nodes flowing into current song, older history compressed into tappable "+N"; each node wears a hit/miss ring; must scale to 30+ song sets
- [ ] Running hit/miss tally for the night shown persistently (live backtest metric)
- [ ] Live sync from kglw.net: poll `latest` every 60s during an active show, offer to auto-fill editor-logged songs; manual entry is primary; fully offline once loaded, syncs when signal returns
- [ ] Dark theme, fat-thumb-friendly, optimized for a dark crowded venue and a possibly slightly drunk operator

**Prediction model (backtest is a non-negotiable trust gate before show #1):**
- [ ] Weighted Markov transition model — inspectable, deterministic, backtestable; recomputes on new data ingestion (no online training, no neural nets)
- [ ] Signal 1: first-order transition frequency P(next | current) from historical setlists
- [ ] Signal 2: recency/era exponential decay (tunable half-life); current + previous tour dominate
- [ ] Signal 3: hard segue pairs from segue notation (`>` / `->`) and jamcharts — override base model at very high confidence
- [ ] Signal 4: rotation suppression — songs played in the last 1–3 shows of the current tour heavily downweighted (top-3 signal for consecutive-night attendance)
- [ ] Signal 5: base play probability in current era as smoothing prior
- [ ] Signal 6: tuning-family affinity (standard / C# standard / microtonal) — hand-tagged via a simple JSON/CSV file the owner fills in (~250 songs, mostly derivable from album membership); used ONLY in the sparse-data backoff tier, not as a top-level multiplier
- [ ] Signal 7 (nice-to-have): set-position awareness (opener/closer/encore distributions) if the data supports it cleanly
- [ ] Sparse-data backoff: transition model → same-tuning-family affinity → same-album/era affinity → base play probability. Never a hard zero for a plausible song; never 100% except a notated hard segue
- [ ] Backtest: hold out most recent complete tour, train on prior; report top-1/top-5/top-10 hit rate, overall and split by hard-segue vs. free-choice; per-feature ablation so any signal that doesn't earn its place gets deleted; CLI report and/or debug screen
- [ ] Honest uncertainty: if free-choice top-5 accuracy < ~25%, surface it in the UI (wider confidence framing), don't imply false precision

**Data ingestion:**
- [ ] Empirical schema documentation FIRST: fetch a sample from each kglw.net endpoint and document field names, song ordering within sets, segue/transition notation, set/encore delimiting, covers/teases representation — before writing transition-extraction code
- [ ] Fetch historical corpus ONCE at build time (or manual refresh action); bundle as static JSON artifact. One-command refresh script documented for pre-tour-leg rebuilds
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
- [ ] PWA: installable to home screen on iOS and Android, shareable via URL, offline-capable via service worker
- [ ] Attended-show list and live-tracked setlists in IndexedDB; JSON export/import as backup/transfer; export surfaced prominently (losing a phone must not mean losing a dex; iOS Safari eviction risk makes this extra important)

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

1. Exact schema of setlist/segue notation in the API — verify empirically first
2. Whether tour boundaries are explicit in the shows data or need inferring from date gaps
3. Decay half-life and rotation penalty defaults — propose values, justify from the backtest
4. Constellation default-view scope: how many recent shows define "active rotation," and what edge threshold keeps the default graph readable — propose after seeing real data density
5. Whether the `shows` endpoint provides stable show IDs suitable as the attendance-marking key for the Pokédex (it should — verify)

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
| kglw.net JSON API exclusively, no scraping | Free public API exists; volunteer-run site deserves polite usage | — Pending |
| Weighted Markov model, not black-box ML | Must be inspectable, deterministic, backtestable; fancier approaches must beat it in backtest to displace it | — Pending |
| Tuning family replaces key signature | Key data unavailable/garbage for microtonal catalog; tuning is mechanically causal (instrument swaps) and hand-taggable | — Pending |
| Tuning family only in backoff tier | Transition matrix already encodes tuning clustering implicitly for observed pairs | — Pending |
| No force simulation in Show Mode | Tap targets must never move on their own in a live-venue context | — Pending |
| Client-side model, no backend | ~900 shows / ~250 songs fits client-side; backend requires explicit justification during planning | — Pending |
| Pokédex counts derived, never hand-tallied | Attendance marking is the single source of truth; sighting counts computed from it | — Pending |
| Schema verification before extraction code | Segue notation/set delimiting must be documented empirically, not assumed | — Pending |
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
*Last updated: 2026-07-08 after initialization*
