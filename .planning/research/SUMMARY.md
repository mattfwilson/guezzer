# Project Research Summary

**Project:** Guezzer — offline-first KGLW setlist-prediction PWA
**Domain:** Live-venue companion app: client-side statistical prediction, setlist tracking, fan-stats collection (no backend)
**Researched:** 2026-07-08
**Confidence:** HIGH (stack versions and kglw.net API schema verified empirically; feature landscape and pitfalls corroborated across multiple sources)

## Executive Summary

Guezzer occupies genuinely unoccupied territory: live, mid-show, conditional next-song prediction with one-thumb tracking in a dark venue. The adjacent ecosystem is well mapped — setlist databases (kglw.net already provides the archive, gap/bustout/debut charts, and "My Stats"), pre-show prediction games (callingit.live publicly discloses a 26% backtest hit rate, validating Guezzer's honest-uncertainty stance), and concert diary apps — but nobody predicts *during* the show. The build recipe is a build-time ETL pipeline: a Node script politely fetches the kglw.net corpus once (committed to the repo, never fetched in CI), pure-TypeScript core code normalizes it into a versioned `TransitionMatrix` JSON artifact, and a Vite/React PWA ships that artifact statically. The matrix artifact is the contract: predictor, backtester, and constellation all consume it and nothing else.

The recommended stack is Vite 8 + React 19 + TypeScript 6.0.3 (not 7 — typescript-eslint caps at <6.1.0), vite-plugin-pwa with `registerType: 'prompt'`, Dexie for IndexedDB (its `liveQuery` reactivity eliminates a hand-rolled state-sync layer), fuse.js behind a swappable `searchCatalog()` core function, and react-force-graph-2d for the post-show-#1 constellation. A two-package workspace (`core` + `app`) makes core purity a compile error rather than a convention: core's tsconfig has no DOM lib and its package.json has no React.

The two highest-severity risk clusters are (1) **iOS PWA lifecycle**: standalone PWAs are discarded from memory on every app switch, Safari's 7-day ITP eviction wipes browser-tab users' data, and wake lock was broken in home-screen apps until iOS 18.4 — mitigated by write-through IndexedDB persistence on every tap, restore-on-launch, install onboarding, and first-class JSON export; and (2) **model trust**: backtest leakage (as-of-date discipline must be a parameter of matrix construction, not a retrofit) and a transition matrix silently poisoned by set boundaries, teases, and side-project shows (the API is multi-artist — `latest.json` verifiably returns Stu Mackenzie solo sets; every layer must filter `artist_id === 1`). Both clusters are fully avoidable if addressed at design time in the right phase; both are expensive rewrites if retrofitted.

## Key Findings

### Recommended Stack

Vite (not Next.js — everything Next charges overhead for is dead weight under static export, and its PWA story is third-party) with a pnpm two-package workspace enforcing the core/app boundary mechanically. All versions verified against the npm registry 2026-07-08 with peer-dependency compatibility checked directly.

**Core technologies:**
- Vite 8.1.3 + vite-plugin-pwa 1.3.0: build + PWA — first-class Workbox integration; `registerType: 'prompt'` (never `autoUpdate` — a SW swapping the app mid-show is the exact failure mode this project exists to avoid)
- React 19.2.7 + TypeScript 6.0.3: constraint-confirmed; TS 6 not 7 because typescript-eslint 8.63 peer range is `<6.1.0`
- Dexie 4.4.4 + dexie-react-hooks: IndexedDB — `useLiveQuery` makes attendance/trail/dex reactive for free; the only mutable state in the system
- fuse.js 7.4.2 behind `searchCatalog()` in core: fuzzy search over ~250 songs; swappable to uFuzzy if drunk-thumb match quality disappoints
- react-force-graph-2d 1.29.1: constellation (canvas, settle-and-freeze via `cooldownTicks`/`onEngineStop`); import the `-2d` package specifically, not the three.js-laden umbrella
- zod 4.4.3: runtime validation of the volunteer-run API at the ingestion boundary — schema drift fails loudly at build time
- Node ≥24.12: native TS execution for core CLI scripts (`erasableSyntaxOnly: true`); no build step for fetch/build-model/backtest
- Orbit view: plain SVG + CSS, no d3 — ≤15 elements, native 44px hit targets, layout is a pure core function

**One conflict to resolve:** STACK.md recommends inlining `model.json` into the JS bundle (auto-precached, atomically versioned, avoids the Workbox globPatterns-doesn't-include-JSON footgun); PITFALLS.md prefers a separately versioned runtime-cached artifact so data refreshes don't force app updates. **Recommendation: start with the JSON-module bundle** — the normalized artifact is small (est. tens–hundreds of KB), atomic versioning is a safety feature for a live-venue tool, and the escape hatch (`?url` import + `json` in globPatterns) is documented and cheap if the artifact grows past ~1 MB or data-refresh cadence becomes painful.

### Expected Features

Guezzer must never rebuild what kglw.net does well (archive, charts, community); it does what kglw.net cannot: live prediction, offline operation, Pokédex framing. The audience is stats-literate — gap, bustout, debut, and rarity are vocabulary they arrive with.

**Must have (table stakes / before show #1):**
- Show Mode loop: orbit predictions, one-tap logging, miss path via fuzzy search, `???` placeholder, comet trail, hit/miss tally
- **Set-break/encore marker in the tracker** — identified gap in current scope; cheap now, unfixable retroactively (Signal 7 and honest serialization depend on it)
- Live `latest.json` sync (suggest-only) + offline-first operation
- Backtest report as trust gate — transparency is the domain norm (callingit.live publishes its hit rate)
- Attendance auto-marking from live-tracked shows — show #1's dex credit is lost forever without it
- JSON export — the real insurance against iOS eviction, from day one

**Should have (differentiators, v1.x between shows):**
- Prediction explanations ("why") — novel in this space; doubles as the model debugger
- Pokédex UI: completion %, rarest catch, never-seen list
- Personal gap stat and show-rarity recap — near-zero marginal cost once gap computation exists (one core function feeds four features)
- Run-aware rotation suppression sharpened to near-exclusion within same-city runs (KGLW verifiably plays no-repeat residencies)
- Explore Mode constellation and dex share card

**Defer (v2+):**
- Pre-show pick-game with leaderboards (requires the out-of-scope backend; live tally gives the same dopamine)
- Real-time shared state between friends; era slider; tease-level notation awareness
- Anything kglw.net already does: archive browser, charts, community features — deep-link out instead

### Architecture Approach

Build-time ETL → static artifact ("bake, don't fetch"). Owner-run Node scripts fetch the corpus (per-year, courtesy-delayed, committed raw to `data/`), core ingestion normalizes through an anti-corruption layer (the only module that knows raw API field names), and the matrix builder emits a versioned JSON artifact consumed by three independent consumers. The app is a pure projection: UI never computes counts, core never imports from app. The kglw.net API schema was verified empirically (11 live fetches) — ARCHITECTURE.md Part 1 is the authoritative reference for extraction code, including: multi-artist database (filter `artist_id === 1` everywhere), global `position` across sets, `setnumber === "e"` for encores (not `settype`), `transition_id` semantics (2/3 = hard segue, 5/6 = terminal; never string-parse), silent filter-ignore gotcha (a typo'd filter path returns the whole table), and sandwiches (same song twice per show, `isreprise` unreliable).

**Major components:**
1. `core/ingest` — raw rows → domain types; owns all schema knowledge; zod-validated
2. `core/matrix` — normalized shows → versioned `TransitionMatrix` artifact with **as-of-date as a construction parameter** (backtest correctness depends on this)
3. `core/predict` + `core/backtest` — signals as composable, ablatable pure functions; walk-forward holdout eval split hard-segue vs free-choice
4. `core/dex` + `core/graph` — Pokédex and constellation both derived on read from artifact + attendance (never stored counts)
5. `app/services` — live-poll (60s, jittered, suggest-only, silent offline backoff), idb-store (Dexie), export/import
6. `app` UI — Show Mode (SVG orbit), Explore Mode (canvas graph), Dex screens

### Critical Pitfalls

1. **iOS discards PWA memory on every app switch** — IndexedDB is the source of truth, write-through on every tap, restore-on-launch to exact state in <2s; never trust `visibilitychange` on iOS. Verified by force-quit testing on a real iPhone.
2. **Backtest leakage makes the trust gate lie** — as-of-date must be a matrix-builder parameter from day one; tune on an earlier tour, confirm once on the latest; report split metrics; realistic free-choice top-5 ceiling is ~25–40%, don't chase more.
3. **Set boundaries, side projects, and notation poison the matrix** — empirical schema doc gates the extractor; group by `setnumber` before emitting edges; `crossesSetBreak` as a distinct edge type; fixture tests spanning 2012/2017/2022/2025 eras.
4. **SW update deadlock / stale app at show time** — Workbox via vite-plugin-pwa, prompt-to-update toast, visible version stamp, update flow proven on a friend's device before wide distribution.
5. **Touch UX punishes the intended operator** — one-tap undo instead of confirmations (non-negotiable), 44px floor plus inter-orb spacing, gesture suppression (`overscroll-behavior: none`), and a full-livestream one-thumb drill as the Show Mode exit criterion.
6. **7-day ITP eviction + no `beforeinstallprompt` on iOS** — install onboarding with illustrated instructions, `navigator.storage.persist()`, and post-show export prompts as the real backstop.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Corpus Ingestion & Schema Foundation
**Rationale:** Everything downstream depends on correct extraction; PITFALLS P6/P11 are only preventable here; the full corpus pull is where schema surprises surface (multi-set shows, `transition_id: 4`, covers).
**Delivers:** Workspace scaffolding (core + app packages), raw API types from verified schema, normalizer with artist filter and transition semantics, zod validation, fetch-corpus script, committed raw corpus, era-spanning fixture tests.
**Addresses:** kglw.net corpus ingestion (root of the feature dependency tree).
**Avoids:** P6 (matrix poisoning — schema doc gates extractor), P11 (volunteer-API abuse — manual refresh script, committed artifacts, no CI fetches).

### Phase 2: Transition Matrix, Prediction Model & Backtest
**Rationale:** The matrix artifact is the contract that unblocks predictor, backtest, AND constellation simultaneously; as-of-date discipline is an architectural decision that cannot be retrofitted; the backtest is the trust gate for everything after.
**Delivers:** Versioned `TransitionMatrix` artifact + build-model script, signals 1–7 as ablatable units, `config.ts` with all constants, walk-forward backtest CLI with split metrics, baselines, ablation, and sensitivity sweeps.
**Uses:** Pure core package, Node-native TS execution, zod.
**Implements:** `core/matrix`, `core/predict`, `core/backtest`.
**Avoids:** P5 (leakage — as-of-date parameter), P12 (decay mis-tuning — ablation sweep is a deliverable), P8 (unknown-song backoff as first-class model input).

### Phase 3: App Shell & PWA Foundation
**Rationale:** SW update flow must be proven before any distribution to friends; install onboarding and persistence infrastructure are prerequisites for Show Mode's write-through design; can start once Phase 2 freezes the artifact schema (parallelizable with late Phase 2).
**Delivers:** Vite/React shell consuming the bundled artifact, vite-plugin-pwa with prompt-update flow and version stamp, Dexie store, install onboarding (iOS manual instructions), `storage.persist()`, offline-complete first load.
**Uses:** Vite 8, vite-plugin-pwa (`generateSW`, `registerType: 'prompt'`), Dexie, Tailwind.
**Implements:** `app/services/idb-store`, PWA shell.
**Avoids:** P4 (update deadlock — friend-device update-toast test), P2 (eviction — install nag + persist).

### Phase 4: Show Mode
**Rationale:** The hard deadline bar per PROJECT.md; the highest concentration of critical pitfalls (P1, P3, P10) lives here; the trail data structure must be designed for two-source reconciliation now so Phase 5 sync doesn't force a refactor.
**Delivers:** SVG orbit view (pure core layout function), one-tap logging with persistent undo, fuzzy-search miss path, `???`/provisional songs, set-break/encore marker, comet trail, hit/miss tally, write-through persistence with restore-on-launch, wake lock with reacquisition, gesture suppression, attendance auto-marking.
**Addresses:** Show Mode loop, set-structure capture, attendance auto-mark (all P1 features).
**Avoids:** P1 (state discard — force-quit restore test), P3 (wake lock), P10 (touch UX — full-livestream one-thumb drill is the exit criterion).

### Phase 5: Live Sync & Data Safety
**Rationale:** Explicitly after manual tracking is solid; suggest-only reconciliation depends on Phase 4's trail structure; export must exist before show #1 because eviction risk exists from day one.
**Delivers:** 60s `latest.json` poll (artist + show_id filtered, jittered, no retries, silent offline backoff), suggest-only auto-fill chips, post-show reconcile view, versioned JSON export/import with round-trip test, post-show export prompt.
**Avoids:** P7 (sync clobbering — manual trail never mutated automatically), P11 (polling discipline).

### Phase 6: Pokédex & Post-Show Stats
**Rationale:** Downstream of everything, blocks nothing; safe after show #1 since attendance auto-marking already preserves the data; gap computation built once here feeds four features.
**Delivers:** Dex UI (completion %, rarest catch, never-seen), retroactive attendance marking, gap/last-played/play-count stats, post-show recap with rarity score, personal gap, debut flagging.
**Addresses:** The entire P2 feature tier from FEATURES.md.

### Phase 7: Explore Mode Constellation
**Rationale:** Explicitly post-show-#1 per PROJECT.md; pure consumer of the existing artifact (`core/graph` is a projection — no second pipeline); highest UI risk (mobile canvas performance) isolated last.
**Delivers:** Constellation via react-force-graph-2d, edge-thresholded active-rotation default view, settle-and-freeze, tuning-family colors, dex overlay, focus+context, ranked-bars panel; dex share card.
**Avoids:** P9 (hairball/jank — canvas, deterministic seeding, explicit stop-and-pin, default under ~80 nodes).

### Phase Ordering Rationale

- **Data before model before UI:** the feature dependency tree in FEATURES.md is rooted at corpus ingestion; the matrix artifact (Phase 2) is the contract that lets app work (Phases 3–4) proceed in parallel once frozen.
- **Unretrofittable decisions front-loaded:** as-of-date matrix construction (Phase 2), set-structure capture (Phase 4), and two-source trail design (Phase 4) are each cheap at design time and rewrites later — research is unanimous on all three.
- **Trust gate before venue use:** the backtest (Phase 2) determines confidence framing for the entire UI; building Show Mode before knowing realistic accuracy invites false-precision UX.
- **Everything after Phase 5 can slip past show #1 safely** — attendance auto-marking and export in Phases 4–5 guarantee no data is lost while Pokédex and constellation ship between shows.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** ARCHITECTURE.md's open items must be resolved during full corpus ingest — multi-set `setnumber` representation, `transition_id: 4` meaning, `showyear` filter reliability (silent-ignore gotcha), soundcheck/settype variants, tease notation location. Plan the ingest to instrument and log these.
- **Phase 4:** iOS PWA lifecycle behavior is device- and version-specific; plan a real-iPhone spike early (force-quit restore, wake-lock on the oldest iOS in the friend group) rather than trusting documentation.
- **Phase 7:** canvas label rendering quality at ~250 nodes on small screens needs a spike (STACK.md flags this as the one MEDIUM-confidence stack choice); mitigation patterns are known.

Phases with standard patterns (skip research-phase):
- **Phase 2:** pure TypeScript statistical code against a verified schema; the discipline requirements are fully documented in PITFALLS.md P5/P12.
- **Phase 3:** vite-plugin-pwa and Dexie are well-documented ecosystem defaults; the exact Workbox config is already specified in STACK.md.
- **Phase 5–6:** straightforward consumers of existing structures; patterns fully specified in ARCHITECTURE.md data flows.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions and peer-dependency compatibility verified against npm registry 2026-07-08; only fuzzy-match quality (MEDIUM, empirical) and canvas labels (MEDIUM-HIGH, spike planned) are soft |
| Features | MEDIUM-HIGH | kglw.net, callingit.live, FantasyPhish verified by direct fetch; phish.net/elgoose.net search-verified (direct fetches 403'd); r/KGATLW bingo culture unverified but non-load-bearing |
| Architecture | HIGH | API schema verified empirically with 11 live fetches — the load-bearing section; architecture patterns MEDIUM-HIGH (standard practice, low risk) |
| Pitfalls | HIGH | iOS/PWA/SW pitfalls verified against WebKit bug tracker, webkit.org, MDN; modeling pitfalls MEDIUM-HIGH (established practice + Phish-ecosystem prior art) |

**Overall confidence:** HIGH

### Gaps to Address

- **Multi-set show representation (`setnumber` "2"/"3") and `transition_id: 4`:** unverified in sample window — instrument Phase 1's full corpus ingest to confirm; 2022 Red Rocks marathons are the test case.
- **Tease notation:** believed to live in `footnote`/`footnotes` (MEDIUM confidence) — confirm during full ingest; recommendation is to exclude teases from the matrix in v1 regardless.
- **Fuzzy-match quality for impaired one-thumb typing:** empirical — fixture test with realistic typos in Phase 4; uFuzzy swap is a one-file change behind `searchCatalog()`.
- **Model artifact size:** estimated tens–hundreds of KB but unverified until Phase 2 builds it; the ~1 MB escape hatch (with the globPatterns caveat) is documented.
- **TypeScript 7 upgrade:** blocked on typescript-eslint supporting ≥7.0; watch release notes — a free 10x typecheck speedup when it lands.
- **Realistic accuracy ceiling:** ~25–40% free-choice top-5 per prior art; the roadmap should treat honest-uncertainty UI framing as a requirement, not chase numbers the domain can't support.

## Sources

### Primary (HIGH confidence)
- npm registry (2026-07-08) — all versions, peerDependencies, publish dates verified via `npm view`
- kglw.net API: docs + 11 live sample fetches (2026-07-08) — envelope, schemas, multi-artist gotcha, transition vocabulary, set delimiting, silent filter-ignore
- kglw.net, callingit.live, fantasyphish.com — direct fetches: feature landscape, 26% backtest disclosure, game mechanics
- WebKit bug 254545, webkit.org storage-policy blog, MDN StorageManager — wake lock regression, persist() semantics, eviction criteria
- Node.js TypeScript docs — type stripping stable in 24.12+
- KGLW no-repeat residency press coverage — validates rotation-suppression signal

### Secondary (MEDIUM confidence)
- phish.net Gap Chart / My Shows / forum culture, elgoose.net charts — search-verified (direct fetches 403'd)
- Phish LSTM prediction study (21.8% top-1 on 876-song catalog) — accuracy-ceiling prior art
- iOS 7-day eviction behavior — Apple docs sparse; corroborated across Apple forums, Firtman, community sources
- Workbox runtime-caching patterns, d3-force mobile performance thresholds — training knowledge cross-checked against current versions

### Tertiary (LOW confidence)
- r/KGATLW setlist-bingo culture — could not verify; non-load-bearing (Phish prediction-game culture confirmed instead)

---
*Research completed: 2026-07-08*
*Ready for roadmap: yes*
