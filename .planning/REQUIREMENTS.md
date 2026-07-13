# Requirements: Guezzer

**Defined:** 2026-07-08
**Core Value:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the setlist as it happens — fully offline once loaded.

**Legend:** 🎯 = show-#1 hard bar (must work before the first show, late Aug/Sep 2026). Unmarked v1 requirements ship within the milestone but may land after show #1.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Ingestion

- [x] **DATA-01** 🎯: Empirical schema documentation exists (from real endpoint samples) covering field names, song ordering, `transition_id` segue vocabulary, set/encore delimiting (`setnumber: "e"`), covers/teases, and multi-set representation — before any extraction code is written
- [x] **DATA-02** 🎯: One-command refresh script fetches the full historical corpus from kglw.net and writes a versioned static JSON artifact bundled with the app
- [x] **DATA-03** 🎯: Every ingestion path and the live poller filter to `artist_id === 1` (KGLW) and validate that filtered API responses actually match the requested filter (API silently ignores invalid filters)
- [x] **DATA-04** 🎯: Tuning-family tagging file (JSON/CSV) generated with album-derived defaults for the owner to hand-fill (~250 songs: standard / C# standard / microtonal)
- [x] **DATA-05** 🎯: Set-boundary and encore transitions are excluded from (or explicitly marked in) the transition matrix so they never poison within-set segue probabilities

### Prediction Model

- [x] **MODL-01** 🎯: Transition matrix is a serializable plain-JSON artifact with a frozen schema, consumed by predictor, backtest, and constellation alike
- [x] **MODL-02** 🎯: Matrix construction takes an as-of-date cutoff parameter (backtest leakage prevention built in, not bolted on)
- [x] **MODL-03** 🎯: Scoring uses first-order transition frequency P(next | current) as the core signal
- [x] **MODL-04** 🎯: Old shows decay exponentially with a tunable half-life; current + previous tour dominate
- [x] **MODL-05** 🎯: Notated hard segue pairs (`transition_id` 2/3, jamcharts) override the base model at very high confidence
- [x] **MODL-06** 🎯: Rotation suppression downweights songs played in the last 1–3 shows of the current tour, approaching hard exclusion within a same-venue/city multi-night run
- [x] **MODL-07** 🎯: Base play probability in the current era acts as a smoothing prior
- [x] **MODL-08** 🎯: Sparse-data backoff chain: transition model → same-tuning-family affinity → same-album/era affinity → base play probability; never a hard zero for a plausible song, never 100% except a notated hard segue
- [x] **MODL-09** 🎯: Tuning-family affinity is used ONLY in the backoff tier, never as a top-level multiplier
- [x] **MODL-10** 🎯: Predictions condition on the current show: already-played songs drop to near zero (sandwich/reprise-aware — repeats do occur)
- [x] **MODL-11** 🎯: All model constants (decay half-life, rotation penalty, backoff weights, thresholds) live in a single config file

### Evaluation

- [x] **EVAL-01** 🎯: Backtest holds out the most recent complete tour, trains on everything prior, and reports top-1/top-5/top-10 next-song hit rates, overall and split by hard-segue vs. free-choice
- [x] **EVAL-02** 🎯: Per-feature ablation report (accuracy with each signal toggled off) so any signal that doesn't earn its place gets deleted
- [x] **EVAL-03** 🎯: Backtest report runs from Node CLI with zero browser dependencies
- [x] **EVAL-04** 🎯: If free-choice top-5 accuracy < ~25%, the UI surfaces wider confidence framing rather than implying false precision
- [x] **EVAL-05** 🎯: Unit tests cover the scoring pipeline and dex derivation using small fixture setlists with known expected outputs

### Show Mode

- [x] **SHOW-01** 🎯: Current song sits at center; top 5–8 predicted next songs orbit as tappable orbs — size and distance scale with probability, colored by tuning family, percentage on the orb
- [x] **SHOW-02** 🎯: Radial layout is deterministic (no force simulation); tap targets never move on their own; ~44px minimum orb size regardless of probability
- [x] **SHOW-03** 🎯: Tapping a predicted orb recenters on it, appends the old song to the trail, and recomputes predictions
- [x] **SHOW-04** 🎯: An always-visible search button opens fuzzy search over the full catalog; selecting a song recenters on it — misses as fast as hits
- [x] **SHOW-05** 🎯: An always-visible "unknown song" button logs a ??? placeholder (renamable later) so tracking never stalls
- [x] **SHOW-06** 🎯: User can mark set breaks and the encore, and the tracked show serializes set structure (round-trips with kglw.net data)
- [x] **SHOW-07** 🎯: User can undo/edit a wrongly-logged song mid-show with one tap
- [x] **SHOW-08** 🎯: Comet trail shows the last ~4 songs as diminishing nodes with older history compressed into a tappable "+N"; each node wears a hit/miss ring; scales to 30+ song sets without crowding the prediction fan
- [x] **SHOW-09** 🎯: Running hit/miss tally for the night is persistently visible
- [x] **SHOW-10** 🎯: Each orb carries a one-line "why" explanation, with a tappable detail view
- [x] **SHOW-11** 🎯: Every confirmed song is written through to IndexedDB immediately; an interrupted session restores exactly on relaunch (iOS discards PWA state on app switch)
- [x] **SHOW-12** 🎯: Screen wake lock is held during an active show, reacquired on visibility change, with feature-detection fallback messaging *(code complete in 04-07 — verify-held guard + silent reacquire + calm WakeLockNotice fallback; on-device installed-PWA confirmation deferred to end-of-phase device gate, user approval 2026-07-13)*
- [x] **SHOW-13** 🎯: Dark theme, fat-thumb tap targets, accidental-gesture suppression — usable one-handed in a dark crowded venue by a possibly slightly drunk operator *(code complete in 04-07 — declarative gesture-suppression CSS on the non-scrolling stage/action bar; on-device confirmation deferred to end-of-phase device gate, user approval 2026-07-13)*
- [ ] **SHOW-14**: Post-show recap view: hit/miss tally, final setlist with set structure, and show rarity score

### Live Sync

- [x] **SYNC-01** 🎯: During an active show, the app polls the kglw.net `latest` endpoint at most once every 60 seconds — never the full `setlists` endpoint from client devices *(verified in 05-VERIFICATION.md — single self-scheduling setTimeout, 60s interval, no `setlists` endpoint referenced)*
- [x] **SYNC-02** 🎯: Editor-logged songs are offered as suggestions only (manual entry is primary); dedupe by song ID; no auto-merge into the user's trail *(verified in 05-VERIFICATION.md — dedupe by song_id, explicit tap/swipe adopt only, no auto-apply path)*
- [x] **SYNC-03** 🎯: The app is fully functional offline once loaded; polling resumes silently when signal returns *(code complete — verified in 05-VERIFICATION.md; on-device airplane-mode confirmation deferred to end-of-phase device gate, see 05-HUMAN-UAT.md)*

### PWA & Persistence

- [x] **PWA-01** 🎯: App is installable to the home screen on iOS and Android, with install onboarding (including manual iOS instructions, since `beforeinstallprompt` never fires there)
- [x] **PWA-02** 🎯: Service worker provides offline capability with a prompt-based update flow — the app never swaps versions mid-show
- [x] **PWA-03** 🎯: Personal data (attended shows, tracked setlists, dex) persists in IndexedDB with `navigator.storage.persist()` requested
- [x] **PWA-04** 🎯: All personal data exports/imports as JSON, surfaced prominently — losing a phone must not mean losing a dex

### Stats

- [ ] **STAT-01**: Song detail (orb detail view / Explore Mode) shows gap (shows since last played), play count, and last-played date
- [ ] **STAT-02**: Post-show recap includes a show rarity score (average gap of the night's songs)
- [ ] **STAT-03**: Pokédex shows personal gap ("N of your shows since you last saw this song")
- [ ] **STAT-04**: Songs with no live history (new-album material) are framed as "debut candidate" rather than shown with fake-precise low percentages

### Pokédex

- [x] **DEX-01** 🎯: Live-tracked shows automatically count as attended (show #1's dex credit must not be lost)
- [ ] **DEX-02**: User can retroactively mark attended shows from the full kglw.net archive, searchable by date/venue, keyed by stable show ID
- [ ] **DEX-03**: Per-song sighting counts are derived from attended shows — never hand-tallied
- [ ] **DEX-04**: Pokédex UI shows collection completion %, per-song sighting counts, rarest catch (lowest base-rate song seen), and never-seen list
- [ ] **DEX-05**: Pokédex state overlays the constellation: unseen songs as dimmed silhouettes, seen at full color, sighting count as badge/ring

### Explore Mode

- [ ] **EXPL-01**: Force-directed transition constellation: nodes = songs (size = play count, color = tuning family), directed edges = observed transitions (thickness = frequency), fed from the same matrix JSON as the predictor
- [ ] **EXPL-02**: Clicking a node shows its outgoing next-song probabilities as ranked bars with percentages and one-line "why" explanations
- [ ] **EXPL-03**: Default view renders only the current-era active rotation (songs in last N shows, tunable) with a toggle for the full catalog
- [ ] **EXPL-04**: Edges below a tunable transition-count/probability threshold are hidden (slider)
- [ ] **EXPL-05**: Clicking a node highlights its neighborhood and dims the rest (focus+context)
- [ ] **EXPL-06**: Physics settles and freezes; labels never jitter permanently

### Show History

- [ ] **HIST-01**: Past tracked shows are viewable as complete setlists with set structure

### Dex Sharing

- [ ] **SHAR-01**: Dex exports/imports as JSON for friend-group exchange (no backend, no synced state)
- [ ] **SHAR-02**: User can generate a shareable summary card (image or text) comparing-friendly: completion %, rarest catch, show count

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Model

- **MODL-V2-01**: Set-position awareness (opener/closer/encore distributions) as a scoring signal — set-structure data is captured in v1 (SHOW-06, DATA-01) so this is purely additive
- **MODL-V2-02**: Album-as-genre-proxy affinity experiment — only if backtest shows it beats tuning-family backoff
- **MODL-V2-03**: Tease/jam-notation awareness beyond segue pairs — needs schema evidence first

### Explore

- **EXPL-V2-01**: Era slider scrubbing the constellation through time (2010 → present)

### Social

- **SOCL-V2-01**: Real-time shared setlist state between friends during shows — conscious deferral; revisit only if the group demands it

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native apps / App Store / TestFlight | Pure overhead for <10 users on a deadline; PWA decision confirmed |
| HTML scraping of kglw.net | Free public JSON API exists; volunteer-run site deserves polite usage |
| Musical key signature signal | Not in the API; Spotify audio-features closed; audio detection garbage on microtonal catalog — tuning family replaces it |
| Time signature signal | No reliable data source, no causal mechanism |
| Black-box ML / neural nets / online training | Model must be inspectable, deterministic, backtestable |
| User accounts, community features, push notifications | Personal tool; kglw.net already hosts the community |
| Pre-show pick-N game with leaderboards (FantasyPhish clone) | Requires the entire out-of-scope backend; live hit/miss tally delivers the competitive fun |
| Full archive browser / bustout/debut/tease charts | kglw.net already does this well; deep-link out instead |
| Spotify/Apple playlist export | Off-mission; setlist.fm already does it |
| Photo/video/diary attachments | Storage-heavy, iOS-eviction-hostile, irrelevant to prediction |
| Full-setlist pre-show prediction | Compounding-error garbage beyond 1–2 songs; false precision destroys trust |
| Server-side anything | Dataset fits client-side; backend requires explicit justification |
| Supporting other bands | KGLW only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 2 | Complete |
| MODL-01 | Phase 2 | Complete |
| MODL-02 | Phase 2 | Complete |
| MODL-03 | Phase 2 | Complete |
| MODL-04 | Phase 2 | Complete |
| MODL-05 | Phase 2 | Complete |
| MODL-06 | Phase 2 | Complete |
| MODL-07 | Phase 2 | Complete |
| MODL-08 | Phase 2 | Complete |
| MODL-09 | Phase 2 | Complete |
| MODL-10 | Phase 2 | Complete |
| MODL-11 | Phase 2 | Complete |
| EVAL-01 | Phase 2 | Complete |
| EVAL-02 | Phase 2 | Complete |
| EVAL-03 | Phase 2 | Complete |
| EVAL-04 | Phase 4 | Complete |
| EVAL-05 | Phase 2 | Complete |
| SHOW-01 | Phase 4 | Complete |
| SHOW-02 | Phase 4 | Complete |
| SHOW-03 | Phase 4 | Complete |
| SHOW-04 | Phase 4 | Complete |
| SHOW-05 | Phase 4 | Complete |
| SHOW-06 | Phase 4 | Complete |
| SHOW-07 | Phase 4 | Complete |
| SHOW-08 | Phase 4 | Complete |
| SHOW-09 | Phase 4 | Complete |
| SHOW-10 | Phase 4 | Complete |
| SHOW-11 | Phase 4 | Complete |
| SHOW-12 | Phase 4 | Complete (device verification deferred to end-of-phase gate) |
| SHOW-13 | Phase 4 | Complete (device verification deferred to end-of-phase gate) |
| SHOW-14 | Phase 6 | Pending |
| SYNC-01 | Phase 5 | Complete |
| SYNC-02 | Phase 5 | Complete |
| SYNC-03 | Phase 5 | Complete (device verification deferred to end-of-phase gate) |
| PWA-01 | Phase 3 | Complete |
| PWA-02 | Phase 3 | Complete |
| PWA-03 | Phase 3 | Complete |
| PWA-04 | Phase 5 | Complete (05-06 gap closure — CR-01 import data loss fixed) |
| STAT-01 | Phase 6 | Pending |
| STAT-02 | Phase 6 | Pending |
| STAT-03 | Phase 6 | Pending |
| STAT-04 | Phase 6 | Pending |
| DEX-01 | Phase 4 | Complete |
| DEX-02 | Phase 6 | Pending |
| DEX-03 | Phase 6 | Pending |
| DEX-04 | Phase 6 | Pending |
| DEX-05 | Phase 7 | Pending |
| EXPL-01 | Phase 7 | Pending |
| EXPL-02 | Phase 7 | Pending |
| EXPL-03 | Phase 7 | Pending |
| EXPL-04 | Phase 7 | Pending |
| EXPL-05 | Phase 7 | Pending |
| EXPL-06 | Phase 7 | Pending |
| HIST-01 | Phase 6 | Pending |
| SHAR-01 | Phase 6 | Pending |
| SHAR-02 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 60 total
- Mapped to phases: 60
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-08*
*Last updated: 2026-07-13 — 04-07 marked SHOW-12/SHOW-13 code-complete (on-device confirmation deferred to end-of-phase device human-verify gate)*
