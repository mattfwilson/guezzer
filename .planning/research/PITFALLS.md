# Pitfalls Research

**Domain:** Offline-first PWA with client-side statistical prediction model (live-setlist tracker/predictor)
**Researched:** 2026-07-08
**Confidence:** HIGH for iOS/PWA/service-worker pitfalls (verified against WebKit bug tracker, webkit.org, MDN, multiple corroborating sources). MEDIUM-HIGH for modeling/evaluation pitfalls (established statistical practice + prior art in the Phish setlist-prediction space). MEDIUM for kglw.net-specific data quirks (API docs verified directly but are sparse — confirms the "verify schema empirically" requirement).

## Critical Pitfalls

### Pitfall 1: iOS discards the PWA's in-memory state every time the user switches apps

**What goes wrong:**
The single most dangerous failure mode for Show Mode. On iOS, a standalone (home-screen) PWA is discarded from memory when the user switches to another app — camera, texts, flashlight, all things people do constantly at a concert. When they return, the PWA cold-reloads from the start URL. If the in-progress setlist, hit/miss tally, and current-song state live in React state or memory, one Instagram story wipes the entire night's tracking. Compounding it: iOS home-screen PWAs historically don't reliably fire `visibilitychange`/`pagehide` at background time, so "save on exit" hooks cannot be trusted.

**Why it happens:**
Developers test on desktop Chrome and Android where tabs/apps survive backgrounding. iOS WebKit standalone mode has aggressively different lifecycle behavior that only shows up on a real device.

**How to avoid:**
- Treat IndexedDB as the source of truth for the live show, not a backup. Write-through on **every confirmed tap** (song logged, hit/miss recorded, ??? placeholder added) — never batch, never debounce past a tap boundary.
- On app load, check for an "active show in progress" record and restore straight into Show Mode at the exact state (current song, trail, tally). Cold-boot-to-restored-state should be < 2 seconds and require zero taps.
- Do not rely on `beforeunload`/`visibilitychange` on iOS for anything important.

**Warning signs:**
Any live-show state that exists only in a React store; restore logic that exists but has never been tested by force-killing the app mid-"show" on a real iPhone.

**Phase to address:**
Show Mode / live tracker phase (persistence design), verified again in a pre-show field-test phase.

---

### Pitfall 2: iOS 7-day storage eviction hits browser-tab users; install is the only real fix

**What goes wrong:**
Safari's Intelligent Tracking Prevention deletes all script-writable storage (IndexedDB, Cache Storage, localStorage) for sites not used within 7 days of Safari use — **when running in the Safari browser**. A friend who bookmarks the URL instead of installing to home screen, doesn't open it for a week between tour legs, and comes back finds their Pokédex gone. Installed home-screen PWAs are effectively exempt (the web-app has its own storage counter that resets on use), and since Safari 17 / iOS 17 `navigator.storage.persist()` is supported and exempts persisted origins from quota eviction — but persist() does not override the ITP 7-day rule for in-browser Safari usage, and Safari grants/denies it silently with no user prompt.

**Why it happens:**
Developers read "persist() prevents eviction" on MDN and assume it covers ITP deletion. These are two separate eviction mechanisms in WebKit. Also, iOS has **no `beforeinstallprompt`** — you cannot trigger an install dialog; users must manually Share → Add to Home Screen, and most won't unless walked through it.

**How to avoid:**
- Make home-screen install a first-run onboarding step with platform-detected illustrated instructions (iOS: Share sheet → Add to Home Screen; Android: browser install prompt). Detect standalone mode (`display-mode: standalone` media query / `navigator.standalone`) and nag until installed.
- Call `navigator.storage.persist()` on first meaningful data write anyway (helps quota-based eviction on both platforms; free to call).
- Treat JSON export as a first-class feature, not a settings-page afterthought: prompt to export after each tracked show and before long idle gaps. This is the actual data-loss insurance.
- Historical corpus and model must be rebuildable from the bundled static JSON — only *personal* data (attendance, tracked shows, tags) is irreplaceable, so scope export around that.

**Warning signs:**
Testing only in installed mode; no analytics/awareness of which friends are running in-browser; export flow that has never round-tripped on a real device.

**Phase to address:**
PWA shell/persistence phase (persist + export); onboarding/install UX before distributing to friends.

---

### Pitfall 3: Screen sleeps mid-show — Wake Lock is broken on older-iOS home-screen PWAs

**What goes wrong:**
The Screen Wake Lock API works in iOS Safari 16.4+, **but a WebKit bug (bug 254545) broke it specifically in home-screen web apps until iOS 18.4** (fixed March 2025). On an affected device the screen dims and locks mid-song; when unlocked, iOS may have discarded the app (Pitfall 1), turning a screen-sleep annoyance into a state-loss event. Wake locks are also silently released whenever the page loses visibility — every app switch requires reacquisition.

**Why it happens:**
`caniuse` shows green for Safari 16.4+ and developers stop reading; the standalone-mode regression is only in the WebKit bug tracker and PWA-community blogs.

**How to avoid:**
- Request the wake lock, and **reacquire it on every `visibilitychange` back to visible** — this is required on all platforms, not just iOS.
- Feature-detect and verify: if `navigator.wakeLock` is missing or `request()` rejects, show a visible one-time hint ("set Auto-Lock to Never for the show") rather than failing silently. A NoSleep.js-style looping-video fallback is a legitimate plan-B for pre-18.4 iOS but test its battery cost.
- Regardless of wake-lock success, Pitfall 1's restore-on-launch design is the true safety net.

**Warning signs:**
Wake lock requested once at startup with no reacquisition; no fallback messaging; never tested with the phone left untouched for 5 minutes in standalone mode.

**Phase to address:**
Show Mode phase; explicit item in pre-show device test matrix (check friends' iOS versions).

---

### Pitfall 4: Service worker update deadlock — users stuck on a stale app at show time

**What goes wrong:**
The classic offline-first failure: you fix a scoring bug or refresh the data corpus the day before a show, but friends' installed PWAs keep serving the old precached shell forever. Causes: cache-first strategy applied to the HTML/navigation request; new service worker sitting in `waiting` because the old one controls an open client (and installed PWAs are rarely "closed" on Android / are frozen-not-closed patterns on iOS); or the opposite over-correction — blind `skipWaiting()` mid-session swaps assets under a running app and breaks lazy-loaded chunks.

**Why it happens:**
The service worker lifecycle (install → waiting → activate, clients keep old SW until all closed) is genuinely counterintuitive, and hand-rolled SWs get it wrong in one direction or the other.

**How to avoid:**
- Don't hand-roll. Use Workbox / `vite-plugin-pwa` with `registerType` handling and hashed precache manifest.
- Network-first (with cache fallback) for navigation requests; cache-first only for hashed immutable assets.
- Implement the standard update-toast pattern: detect `waiting` SW → show "Update available — reload" → `SKIP_WAITING` message + `controllerchange` reload. Never auto-`skipWaiting` while a live show is being tracked.
- Version-stamp the app and data corpus, and display both somewhere reachable (settings/debug) so "are you on the new version?" is answerable over text message at a venue.
- Ship the data corpus as a **separately versioned, runtime-cached JSON artifact**, not baked into the JS bundle — so a data refresh doesn't require an app-code update and vice versa.

**Warning signs:**
"Works after I hard-refresh"; needing to tell friends to clear Safari data; no visible version indicator; SW code written by hand with custom cache names.

**Phase to address:**
PWA shell phase (initial SW architecture); update flow must be proven before first distribution to friends, not before show #1.

---

### Pitfall 5: Backtest leakage and holdout overfitting — the trust gate lies

**What goes wrong:**
The backtest reports 60% top-5 accuracy, everyone trusts the app, and it performs like a coin flip at the actual show. Leakage routes specific to this project:
1. **Training on the holdout tour's shows** — transition counts, recency decay, or base-rate priors computed over the full corpus including the tour being evaluated.
2. **Rotation-suppression leakage in the other direction:** rotation signal uses "last 1–3 shows of current tour." In backtest, for show *k* of the holdout tour, shows 1..k-1 of that tour are *legitimately* available (they'd have happened by showtime) — excluding them makes the backtest unfairly pessimistic and untested for the top-3 signal; including show *k* itself is leakage.
3. **Hyperparameter overfitting to the single holdout:** tuning half-life, rotation penalty, and backoff weights by repeatedly re-running against the same holdout tour turns the holdout into a training set. With one holdout tour (~15–30 shows) the variance is huge.
4. **Evaluation mixing:** per-transition accuracy is inflated by notated hard segues (KGLW plays long multi-song suites that are near-deterministic). Headline number must be split hard-segue vs free-choice — PROJECT.md already requires this; the pitfall is letting the blended number drive decisions anyway.

**Why it happens:**
Temporal data + a "recompute everything from the corpus" pipeline makes as-of-date discipline easy to skip; a single small holdout invites iterating until the number looks good.

**How to avoid:**
- Build the backtest as **walk-forward, as-of-date**: for each predicted transition, the model may only see data with show-date strictly before the current show, plus earlier songs of the current show for rotation/within-show conditioning. Make the "as-of" cutoff a parameter of matrix construction, not a filter bolted on after.
- Tune hyperparameters on an *earlier* tour, confirm once on the most recent tour, and stop. Report both numbers.
- Set expectations from prior art: Phish-world prediction work shows free-choice next-song prediction is genuinely hard (Markov-style top-5 in comparable sequence domains lands ~40–50% at best; openers/encores far worse). A free-choice top-5 of 25–40% is likely the realistic ceiling — the PROJECT.md "honest uncertainty" requirement (<25% → wider framing in UI) is the right instinct; don't chase a number the domain can't support.
- Include the trivial baselines in the ablation report: raw first-order Markov, and "most-played-recently" popularity. Every signal must beat what it's stacked on.

**Warning signs:**
Accuracy that jumps suspiciously when a signal is added; backtest code that filters the corpus *after* matrix construction; more than ~3 tuning iterations against the same holdout; a single blended accuracy number in the report.

**Phase to address:**
Model/backtest phase — the as-of-date matrix API is an architectural decision that must be made when the matrix builder is first written, not retrofitted.

---

### Pitfall 6: Set boundaries, encores, covers, and teases silently poison the transition matrix

**What goes wrong:**
The extraction code treats a setlist as one flat song sequence. Then: (a) the last song of set 1 → first song of set 2 becomes a "transition" even though 20 minutes of silence separates them and the choice dynamics are completely different (set openers are drawn from an opener distribution, not from the previous song); (b) encore breaks likewise; (c) teases/quotes notated inside a song's footnotes get parsed as extra songs, creating phantom transitions; (d) one-off covers (KGLW does full cover sets and one-off tribute covers) inject transitions that will never recur; (e) `>` vs `->` vs comma segue notation is guessed rather than verified, so the "hard segue" signal — the model's highest-confidence feature — is built on a misread. The kglw.net API docs **do not document segue/transition representation at all** (verified 2026-07-08), so any assumption is unverified.

**Why it happens:**
Setlist data looks like a simple ordered list; the domain semantics (sets, encores, notation conventions, editorial footnotes) live in undocumented conventions that vary across 15 years of volunteer editing.

**How to avoid:**
- PROJECT.md already mandates empirical schema documentation first — enforce it: pull 20+ raw setlists spanning 2012/2017/2022/2025, diff notation conventions across eras, and write the findings into a schema doc *before* the extractor exists.
- Model set/encore boundaries explicitly: either exclude boundary transitions from the matrix or tag them as a distinct transition type. Feed opener/encore distributions to Signal 7 instead.
- Keep teases/quotes out of the song sequence; keep a covers flag on songs so they can be down-weighted or excluded from prediction candidates.
- Unit-test the extractor against hand-verified fixture setlists (one per era, one with encore, one with covers, one with teases, one with `???`/unknown entries) — this is where the mandated fixture tests earn their keep.
- Check for notation drift over time: if hard-segue frequency per show changes sharply at some year, suspect editorial convention change, not band behavior, and consider restricting the hard-segue signal to the era where notation is consistent.

**Warning signs:**
The constellation shows strong edges between songs that are never musically adjacent (classic set-boundary contamination); hard-segue signal derived from pairs observed 1–2 times; extractor written before the schema doc.

**Phase to address:**
Data ingestion phase — schema doc is the phase's first deliverable and a gate for extractor code.

---

### Pitfall 7: Live sync clobbers or duplicates the manual setlist (late/corrected editor data)

**What goes wrong:**
kglw.net's `latest` endpoint is updated live by volunteer editors — which means entries arrive minutes late, out of order, get corrected retroactively (wrong song swapped, missed song inserted mid-list), and occasionally a whole entry is deleted. Naive auto-fill logic that appends whatever's new in `latest` will: duplicate songs the user already logged manually (fuzzy name mismatch → no dedupe), insert corrections in the wrong position, or overwrite the user's `???` placeholder and hit/miss annotations. Meanwhile the user's manual log is the thing driving predictions — corrupting it mid-show corrupts the night.

**Why it happens:**
"Merge two independently-edited ordered lists in real time" is a sync problem disguised as a convenience feature, and it gets designed as `if (newSongs) append()`.

**How to avoid:**
- Manual entry is primary (already decided) — make sync **suggest-only**: show a non-blocking "kglw.net logged: Song X — add?" chip; never mutate the user's trail automatically.
- Match remote songs by song ID against the local trail; treat anything unmatched (including the user's `???` placeholders) as a suggestion to reconcile, with a one-tap "this is my ???" resolution.
- Keep the user's log and the remote log as two separate arrays reconciled in the UI, not one merged structure — a post-show "reconcile with kglw.net" step can do the authoritative merge calmly, after the show, when corrections have settled.
- Poll failure is the normal case at a venue: `latest` requests must have short timeouts, silent failure, and zero UI jank when offline; the 60s poll must not queue up retries that burst-fire when signal returns.

**Warning signs:**
Sync code that writes into the same array the tap handlers write into; no song-ID-based dedupe; testing sync only against a static fixture, never against a mid-show corrected sequence.

**Phase to address:**
Live sync phase (explicitly after core manual tracking is solid); design the trail data structure for two-source reconciliation in the Show Mode phase so sync doesn't force a refactor.

---

### Pitfall 8: Debut songs and unknown entries crash or silently distort the model

**What goes wrong:**
KGLW debuts unreleased songs mid-tour constantly. A debut appears in `latest` with a song ID (or name) absent from the bundled songs catalog and the transition matrix. Failure modes: prediction code throws on an unknown ID; the orbit renders an orb with `undefined` name; tuning-family lookup returns nothing and the backoff tier NPEs; the Pokédex derivation counts it inconsistently; the `???` placeholder gets treated as a real song and enters the transition history, teaching the model garbage.

**Why it happens:**
The catalog is bundled at build time and assumed closed-world; live shows are open-world.

**How to avoid:**
- Make "unknown song" a first-class model input: prediction conditioned on an unknown current song falls straight to the backoff tiers (era base rates), never throws.
- `???` and unknown-song entries participate in the trail and rotation suppression (they occupy a slot) but are excluded from transition-matrix conditioning.
- Fuzzy search must allow free-text entry that creates a local provisional song record (renamable/mergeable later when kglw.net catalogs it).
- Fixture test: a show containing a debut, a `???`, and a cover, run through the full predict → track → Pokédex pipeline.

**Warning signs:**
Any `songById[id].name` access without a fallback; Pokédex totals that change when a provisional song is renamed; no test with an out-of-catalog song.

**Phase to address:**
Model phase (backoff handles unknowns) + Show Mode phase (provisional song UX).

---

### Pitfall 9: Explore-Mode force graph is a janky hairball on phones

**What goes wrong:**
250 nodes is fine; the **edges** are the problem — a 15-year transition corpus can produce thousands of observed transitions, and force-directed layouts degrade noticeably around 300–400 nodes-plus-dense-edges, far sooner on mobile. Symptoms: multi-second initial layout stutter, simulation that never visually settles (labels jittering forever), the default view an unreadable hairball, and — if the simulation runs through React state — a re-render per tick that kills the frame rate entirely.

**Why it happens:**
d3-force demos are desktop SVG with a few dozen nodes; default `alphaDecay`/random initialization plus per-tick React reconciliation is the naive integration everyone writes first.

**How to avoid:**
- Default view = active-rotation subset + edge threshold (already planned) — treat "full historical catalog" as a deliberately degraded power view, and keep the default under ~80 nodes / ~300 edges.
- Render on canvas, not SVG, for the graph (labels included); keep React out of the tick loop — d3 owns the canvas, React owns the controls.
- Seed node positions deterministically (e.g., by tuning-family cluster angle) instead of random init — faster convergence, stable layout across visits, less jitter.
- Run the simulation to completion, then **freeze** (`simulation.stop()`, pin `fx/fy`); interactions (drag, focus) reheat locally with low `alphaTarget` and re-freeze. "Physics settles and freezes" is already a requirement — the pitfall is implementing it as "wait for alpha to decay" instead of an explicit stop-and-pin.
- Consider computing the layout off the main thread (web worker) or precomputing at build time for the default view since the matrix is static between data refreshes.

**Warning signs:**
Graph feels fine in desktop dev, choppy on an actual mid-tier Android; CPU/battery drain while the graph idles (simulation never actually stopped); default view where edge count > ~1000.

**Phase to address:**
Explore Mode phase (safely post-show-#1); the edge-threshold config belongs in the central config file from the matrix-design phase.

---

### Pitfall 10: Touch UI punishes the exact user it was built for

**What goes wrong:**
Standard mobile UI patterns fail the "dark venue, one thumb, jostled elbow, three beers in" operator: orbs sized by probability drop below tappable size for low-probability songs; a mistap logs the wrong song with **no undo**, corrupting the trail, the rotation-suppression input, and the night's hit/miss tally simultaneously; confirmation dialogs added to prevent mistaps make every correct tap slower (30+ times a night); accidental edge-swipes trigger iOS back navigation out of the app; pull-to-refresh in standalone mode wipes state (see Pitfall 1); the fuzzy-search keyboard covers half the screen at the exact moment the next song is starting.

**Why it happens:**
Designed and tested sober, seated, in a lit room, with two hands.

**How to avoid:**
- 44px minimum orb regardless of probability is already specced — extend the principle: minimum *spacing* between orbs matters as much as size (a big orb adjacent to another big orb still mistaps).
- **Undo is non-negotiable:** a persistent "undo last" affordance (and tap-to-edit any trail node) is cheaper and faster than confirmations. Logging a song should be one tap; unlogging it should be one tap.
- Suppress browser gestures in Show Mode: `overscroll-behavior: none` (kills pull-to-refresh), `touch-action: manipulation` (kills 300ms delay/double-tap zoom), `user-select: none`, viewport `maximum-scale=1`.
- Optimistic instant visual feedback on every tap (<100ms) — at a loud show, if nothing visibly happens the user taps again, double-logging.
- Field-test drill before show #1: track a full recorded show from a livestream video, one thumb, screen brightness low, walking around. This single exercise surfaces more UX failures than any review.

**Warning signs:**
Any destructive or state-changing action without undo; tap targets that pass a spec check but fail the walking-one-thumb test; pinch-zoom still enabled in Show Mode.

**Phase to address:**
Show Mode UI phase; the livestream field-test is the phase's exit criterion.

---

### Pitfall 11: Volunteer-API abuse by accident (build pipelines and N phones)

**What goes wrong:**
kglw.net is volunteer-run with **no documented rate limits and no auth** (verified) — meaning nothing stops you from accidentally hammering it, and nothing but etiquette protects the resource everyone depends on during the tour. Accident vectors: the "fetch corpus at build time" step running on every CI deploy (dozens of full-corpus pulls per week during heavy development); dev hot-reload loops that re-trigger fetches; 10 friends' phones each polling — fine at 1/60s each, but a retry-storm bug (e.g., retrying on every failed request with no backoff when signal flickers) multiplies it; and schema drift — a volunteer-maintained API can change field names or add fields without notice or versioning announcements.

**Why it happens:**
"Fetch at build time" gets implemented as "fetch during `npm run build`" rather than "fetch via explicit refresh script, commit artifact."

**How to avoid:**
- The corpus fetch is a **manually-run script** (`npm run refresh-data`) whose output JSON is committed to the repo; CI/deploy never touches the live API. Document the one-command refresh (already required).
- Set a descriptive `User-Agent` (project name + contact email) on all requests — standard fan-API courtesy (phish.net-style ecosystems expect it).
- Live polling: single timer, 60s interval, no retry-on-failure (just wait for the next tick), short timeout, and stop polling entirely when no show is active or the tab is hidden.
- Schema-drift armor: validate API responses against a lightweight runtime schema (zod or hand-rolled guards) at the ingestion boundary; on mismatch, fail loudly in the refresh script and *degrade gracefully* in live polling (suggestions stop; manual tracking unaffected). Keep raw fetched samples committed alongside the schema doc so drift is diffable.

**Warning signs:**
API calls appearing in build logs; fetch code with automatic retries; ingestion code that dot-accesses response fields with no validation layer.

**Phase to address:**
Data ingestion phase (refresh script + validation boundary); live-sync phase inherits the polling discipline.

---

### Pitfall 12: Recency decay tuned to feel right instead of tested — and era shifts break it silently

**What goes wrong:**
Exponential decay half-life is the model's most sensitive knob. Too short: the model effectively trains on ~10 shows, probabilities get spiky and high-variance, and one unusual show (a covers set, a no-repeat marathon) dominates predictions. Too long: 2014-era transitions outvote the current tour's actual rotation. Worse, KGLW's regime shifts (marathon 3-hour sets, no-repeat residency runs, album-cycle rotations) mean a half-life that backtested well on one tour can be wrong for the next — and the failure is silent: the app still produces confident-looking percentages.

**Why it happens:**
Decay constants get set by eyeballing output ("these predictions look reasonable") — the human doing the eyeballing has the same recency bias as the model.

**How to avoid:**
- Half-life and rotation penalty are chosen by ablation sweep in the backtest (grid over 3–5 values each), tuned on an earlier tour, confirmed on the latest (Pitfall 5's protocol). Report the sensitivity: if accuracy is flat across the sweep, the knob doesn't matter — say so and pick the middle.
- Guard against effective-sample-size collapse: log the effective number of shows contributing weight (sum of decay weights); if it drops below ~20 shows, the backoff tiers should be carrying more mass — assert this in tests.
- Smoothing floor is already specced ("never a hard zero") — additionally cap the top: nothing except a notated hard segue exceeds ~70–80%, because the backtest will show free choices simply aren't that predictable.

**Warning signs:**
Predictions that swing wildly between consecutive shows; a single recent show's setlist visibly dominating the orbit; confidence percentages the backtest hit-rate doesn't support.

**Phase to address:**
Model/backtest phase — the ablation sweep and sensitivity report are deliverables, not options.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hand-rolled service worker instead of Workbox/vite-plugin-pwa | No new dependency, "simple" | Update deadlock, cache-name bugs, stale-app-at-showtime | Never — SW lifecycle bugs are the highest-severity failure class here |
| Baking the data corpus into the JS bundle | One artifact, no fetch logic | Every data refresh forces a full app update; precache churn; can't hotfix data | MVP only if corpus is separately cached before first tour leg |
| Skipping the as-of-date parameter in matrix construction | Simpler matrix builder API | Backtest leakage is unfixable without rewriting the builder | Never — costs a day now, a rewrite later |
| React state as source of truth, IndexedDB as "backup" | Familiar pattern, fast to build | Total state loss on every iOS app switch | Never for Show Mode; fine for Explore Mode view state |
| Auto-merging `latest` poll results into the user's trail | Feels magical when it works | Corrupted setlists mid-show, duplicate/misordered songs | Never — suggest-only is barely more work |
| Confirmation dialogs instead of undo | Trivial to implement | Every correct tap slower × 30 songs × dark venue | Never in Show Mode |
| Skipping runtime validation of API responses | Less code at ingestion | Volunteer-API schema drift crashes ingestion or silently corrupts the matrix | Acceptable for the committed static corpus (validated once by refresh script); never for live polling |
| Testing PWA behavior only in desktop DevTools "offline" mode | Fast iteration | iOS-specific eviction/lifecycle/wake-lock failures ship undetected | Fine day-to-day, but real-iPhone test gates each phase exit |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| kglw.net setlists | Assuming segue/set/encore representation (docs don't specify it — verified) | Empirical schema doc from 20+ raw samples across eras, committed to repo, before extractor code |
| kglw.net at build time | Fetching full corpus in CI on every deploy | Manual `refresh-data` script; artifact committed; CI never calls the API |
| kglw.net `latest` | Retry-on-failure polling that burst-fires when venue signal returns | Single 60s timer, no retries, short timeout, stop when hidden/no active show |
| kglw.net song catalog | Closed-world assumption (every ID resolvable) | Provisional-song records for debuts; all lookups have unknown-song fallbacks |
| iOS Add to Home Screen | Waiting for `beforeinstallprompt` (never fires on iOS) | Detect iOS + non-standalone; show manual Share→Add instructions in onboarding |
| Screen Wake Lock | Request once at startup | Reacquire on every visibility regain; feature-detect; visible fallback hint for iOS < 18.4 |
| IndexedDB (iOS) | Trusting writes without transaction completion; assuming persistence without persist() | Await transaction `complete`; call `navigator.storage.persist()`; prominent JSON export as the real insurance |
| JSON export/import | Export without schema version; import as blind replace | Version field in export; import offers merge-vs-replace with preview; round-trip test in CI |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| d3-force through React state per tick | Choppy graph, phone heats up | d3 owns a canvas; React owns controls; sim runs outside React | Immediately on mobile with 100+ nodes |
| Unfiltered edge rendering | Hairball; multi-second layout; scroll jank | Edge threshold in config; default view = active rotation (~80 nodes) | ~1000+ rendered edges on mobile |
| Simulation never stopped | Battery drain while graph idles; labels jitter forever | Explicit `stop()` + pin `fx/fy` after settle; localized reheat on interaction | Always, eventually — it's a battery bug not a scale bug |
| Recomputing full matrix on every prediction | Laggy tap-to-repredict in Show Mode | Matrix built once per data load; prediction = row lookup + rescoring, O(candidates) | Noticeable if scoring walks all 900 shows per tap |
| Precache manifest includes multi-MB corpus JSON | Slow first install; full re-download on any change | Corpus as runtime-cached versioned artifact outside precache | First install on venue-grade cell signal |
| Fuzzy search re-indexing per keystroke | Search lags exactly when speed matters most | Build search index once at load (250 songs is tiny — just don't rebuild it) | Only if implemented naively, but it's the hot path |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Importing dex JSON without validation | Malformed friend export corrupts IndexedDB state; app boot-loops on bad data | Schema-validate imports; import into staging structure; never crash on parse failure |
| Rendering imported strings (song names, show notes) as HTML | Stored XSS via a friend's crafted export | React default escaping everywhere; no `dangerouslySetInnerHTML` on imported data |
| Serving over HTTP in any environment | Service worker and persistence APIs simply don't work | HTTPS everywhere including LAN testing (Vercel/Netlify/Pages all fine) |

Low overall risk (no accounts, no secrets, no backend) — the import path is the only real attack/corruption surface.

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Probability-scaled orbs shrinking below thumb size | Can't tap the correct prediction in the dark | 44px floor (specced) + minimum inter-orb spacing |
| No undo on song logging | One mistap corrupts trail, predictions, and tally for the night | Persistent one-tap undo + tap-to-edit trail nodes |
| Confirmation dialogs on every log | 30+ extra taps per show, rage-inducing | Optimistic log + undo instead |
| Pull-to-refresh / edge-swipe active in Show Mode | Accidental reload = state loss on iOS | `overscroll-behavior: none`, gesture suppression, restore-on-launch anyway |
| Percentages implying false precision | Users over-trust, then distrust the whole app after misses | Confidence framing tied to backtested free-choice accuracy (specced); consider bands over point percentages |
| Miss path slower than hit path | Tracking stalls exactly when the model is wrong (the common case) | Always-visible search + `???` button (specced); measure taps-to-log for a miss (target ≤3) |
| Export buried in settings | Phone dies/lost → dex gone → the tool's whole point defeated | Post-show export prompt; visible "last backup" age indicator |
| Install nag skippable and never repeated | Browser-tab friends lose data to 7-day eviction | Persistent (but polite) non-standalone banner until installed |

## "Looks Done But Isn't" Checklist

- [ ] **Offline mode:** Works in DevTools offline — verify on a real iPhone in Airplane Mode, cold-launched from home screen, after 24h idle.
- [ ] **Live-show persistence:** Trail survives refresh — verify it survives iOS app-switch → memory discard → relaunch (force-quit test), restoring to exact state in <2s.
- [ ] **SW updates:** New deploy visible on your device — verify a friend's installed, un-refreshed PWA receives the update toast without clearing data.
- [ ] **Backtest:** Accuracy number exists — verify it's walk-forward as-of-date, split hard-segue vs free-choice, with ablations and trivial baselines beaten.
- [ ] **Wake lock:** `request()` succeeds — verify screen stays on for 10 idle minutes in standalone mode on the *oldest* iOS in the friend group, and reacquires after app-switch.
- [ ] **Extractor:** Parses recent setlists — verify against fixtures from 2012/2017/2022/2025 including encores, covers, teases, `???`, and a debut song.
- [ ] **Export/import:** Buttons exist — verify a full round-trip (export on iPhone → import on Android) preserves attendance, tracked shows, provisional songs, and Pokédex counts exactly.
- [ ] **Live sync:** Fills songs in testing — verify against a simulated mid-show correction (song replaced, song inserted mid-list) without touching manual entries.
- [ ] **Show Mode UX:** Passes design review — verify by tracking a full 3-hour livestream one-thumbed at low brightness, and count mistaps.
- [ ] **Unknown songs:** `???` button works — verify prediction, trail, rotation suppression, and Pokédex all behave with a provisional song in the mix.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| iOS state loss mid-show (no write-through) | HIGH at showtime | Re-enter setlist from memory/kglw.net `latest`; post-show reconcile; then fix write-through before next night |
| Stale SW on friends' phones | MEDIUM | Text friends: iOS — delete home-screen app + Safari site data, re-add; Android — clear site storage. Painful, hence prevention |
| Backtest leakage discovered late | HIGH | Rebuild matrix constructor with as-of-date parameter; rerun all tuning; re-derive confidence framing — budget days, not hours |
| Poisoned matrix (set-boundary transitions) | MEDIUM | Matrix is derived data: fix extractor, rerun build, redeploy artifact; no user data touched |
| 7-day eviction wiped a friend's dex | LOW-MEDIUM | Restore from their last JSON export (if the export-prompt habit exists) or re-mark attendance from kglw.net archive |
| Live-sync corrupted a trail | MEDIUM | Post-show reconcile view against kglw.net final setlist; requires trail edit UI to exist |
| d3 graph unusable on phones | LOW (post-show-#1 feature) | Tighten default filters; precompute layout at build time; worst case ship ranked-bars view only (which is the model debugger anyway) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Set-boundary/segue/notation matrix poisoning (P6) | Data ingestion (schema doc gates extractor) | Fixture tests across eras; constellation spot-check for impossible edges |
| Volunteer-API abuse + schema drift (P11) | Data ingestion | No API calls in CI logs; refresh script validates + commits artifact; UA header set |
| Backtest leakage / holdout overfitting (P5) | Model & backtest | As-of-date is a builder parameter; split metrics; baselines + ablation in report |
| Recency-decay mis-tuning (P12) | Model & backtest | Sensitivity sweep in report; effective-sample-size assertion in tests |
| Unknown/debut song handling (P8) | Model + Show Mode | Out-of-catalog fixture through full pipeline; `???` UX test |
| SW update deadlock (P4) | PWA shell | Friend-device update-toast test before any wide distribution |
| 7-day eviction / install friction (P2) | PWA shell + onboarding | persist() called; standalone detection; install instructions; export prompt cadence |
| iOS state discard (P1) | Show Mode (persistence architecture) | Force-quit-and-restore test on real iPhone |
| Wake lock regression (P3) | Show Mode | 10-min idle screen test on oldest friend-group iOS, standalone mode |
| Touch UX for impaired operator (P10) | Show Mode UI | Livestream full-show one-thumb drill as phase exit criterion |
| Live-sync clobbering (P7) | Live sync (last Show Mode sub-phase) | Simulated correction/insertion test; manual trail untouched |
| Force-graph jank/hairball (P9) | Explore Mode (post-show-#1 safe) | Mid-tier Android frame-rate check; sim provably stopped at idle |

## Sources

- iOS 7-day storage eviction & home-screen exemption: [Apple Developer Forums — Safari iOS PWA Data Persistence Beyond 7 Days](https://developer.apple.com/forums/thread/710157), [Search Engine Land — Safari's 7-day cap on script-writeable storage](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519), [MagicBell — PWA iOS Limitations and Safari Support](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — MEDIUM-HIGH (Apple's own documentation is sparse; behavior corroborated across sources)
- Storage API / persist() on iOS 17+: [WebKit blog — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [MDN — StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist), [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — HIGH
- Wake Lock broken in iOS home-screen web apps until 18.4: [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545), [caniuse — Screen Wake Lock](https://caniuse.com/wake-lock) — HIGH
- iOS standalone PWA memory discard / lifecycle gaps: [Maximiliano Firtman — iOS PWA behavior](https://medium.com/@firt/iphone-11-ipados-and-ios-13-for-pwas-and-web-development-5d5d9071cc49), [firt.dev — PWA design tips](https://firt.dev/pwa-design-tips/) — HIGH (Firtman is the canonical iOS-PWA reference)
- SW update handling: [Chrome for Developers — Handling service worker updates with immediacy (Workbox)](https://developer.chrome.com/docs/workbox/handling-service-worker-updates), [What Web Can Do — Handling Service Worker updates](https://whatwebcando.today/articles/handling-service-worker-updates/), [skipWaiting + StaleWhileRevalidate pitfall](https://allanchain.github.io/blog/post/pwa-skipwaiting/) — HIGH
- d3-force jitter/convergence/performance: [d3-force docs](https://d3js.org/d3-force), [Stamen — Forcing Functions (d3 v4 forces)](https://stamen.com/forcing-functions-inside-d3-v4-forces-and-layout-transitions-f3e89ee02d12/), [d3-force-reuse (performance research)](https://github.com/twosixlabs/d3-force-reuse) — HIGH for mechanisms, MEDIUM for exact mobile thresholds
- Setlist-prediction difficulty prior art (Phish ecosystem): [Andrew Reed — Predicting Phish setlists with deep learning](https://medium.com/data-science/predicting-what-song-phish-will-play-next-with-deep-learning-947ccce3824d), [callingit.live](https://callingit.live/), [phish.net forum discussions](https://forum.phish.net/forum/show/1340332277) — MEDIUM (directional evidence on realistic accuracy ceilings)
- kglw.net API: [official docs](https://kglw.net/api/docs.php) fetched 2026-07-08 — confirms no auth, no rate-limit guidance, and **no documentation of segue/set/transition representation** — HIGH for what the docs do/don't say
- Backtest leakage / walk-forward evaluation / touch-target guidance (44px, undo-over-confirm): established statistical and HIG/Material practice — HIGH

---
*Pitfalls research for: offline-first PWA + client-side setlist prediction (Guezzer)*
*Researched: 2026-07-08*
