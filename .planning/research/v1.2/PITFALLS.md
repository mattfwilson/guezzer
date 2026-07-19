# Pitfalls Research — Gizz Bingo (v1.2)

**Domain:** Live auto-marking 4×4 setlist bingo added to an existing offline-first PWA (pure-core/React split, Dexie single-source-of-truth, kglw.net live sync), operated one-thumb-in-the-dark at a real show.
**Researched:** 2026-07-19
**Confidence:** HIGH for architecture-fit pitfalls (grounded in the actual codebase: `packages/core/src/{live,model,dex}`, `packages/app/src/db/db.ts`), the empirical corpus findings (`gizz-bingo-design-vetting.md`), and reuse of the v1.0 PWA/iOS pitfalls. MEDIUM for exact fill-rate/calibration thresholds (gated on the Monte-Carlo pre-plan task — this doc says WHAT it must prove, not the final numbers).

**Scope note:** This is feature-scoped and does NOT re-derive the v1.0 pitfalls (iOS state discard, 7-day eviction, wake lock, SW deadlock, touch-target floor, undo, gesture suppression). Those in `.planning/research/PITFALLS.md` apply unchanged to the GizzGames live surface — the bingo card is live-show state and inherits every one of them. This doc covers what is NEW or DIFFERENT when adding THIS game to THIS system.

---

## Critical Pitfalls

### Pitfall 1: Consume-once marking is non-deterministic, so replay and live diverge

**What goes wrong:**
The core rule is "each logged song marks the ONE best-matching unmarked square (greedy assignment)." Done naively this is order- and iteration-dependent: a song that qualifies for square A *and* square B (e.g. a microtonal song off *Flying Microtonal Banana* that is ALSO a segue) marks whichever square the code happens to visit first. If square iteration order, tie-breaking, or a `Set`/object-key ordering differs between the live incremental path (mark-as-you-log) and the post-show re-derivation path (replay the whole trail), the same trail produces two different final cards. The design explicitly promises "past shows show the frozen card + final marks + win state (pure re-derivation)" — if live≠replay, the GizzDex history card silently contradicts what the user watched light up live, and win-state (line/blackout) can flip.

**Why it happens:**
Greedy assignment over a many-to-many qualification relation has real ambiguity, and "mark the best square" hides a scoring/tie-break decision that must be *total and deterministic*. Developers implement the live path first (incremental, one song at a time) and the replay path second (batch fold), and never assert the two produce byte-identical marks.

**How to avoid:**
- Make marking a **single pure fold**: `deriveMarks(card, trail) → MarkState`, computed left-to-right over the trail in position order. The live path calls the SAME function on the growing trail — never a separate incremental mutator. (This mirrors how tally/comet-trail are already pure derivations over the trail; bingo is "a third derivation alongside" per the design.)
- Define a **total, documented square-preference order** for the consume-once tie-break (e.g. rarer/harder square first, then lowest square index) so "best-matching" is deterministic. Put the ordering rule in config, not inline.
- Assign against squares in a **fixed canonical order** derived from the frozen card, never from a hash-map iteration.
- Property test: `deriveMarks(card, trail) === deriveMarks(card, trail)` for shuffled qualification orders, and `deriveMarks(card, fullTrail) === foldLeft(trail, markOne)` (live path == replay path) on fixture setlists with deliberately overlapping squares.

**Warning signs:**
Any incremental "mark on log" code that mutates a stored mark-set instead of recomputing; a tie-break that falls through to `Object.keys()`/`Set` order; a fixture where a single song legitimately satisfies two squares and no test pins which one it takes.

**Phase to address:**
Core marking phase (the pure `deriveMarks` fold + tie-break) — this is an architectural decision made when the function is first written, exactly like the as-of-date matrix decision in v1.0. Verified by the live==replay property test as phase exit.

---

### Pitfall 2: One song lights multiple squares (consume-once not actually enforced)

**What goes wrong:**
The whole 4×4 sizing math assumes "consume-once caps marks at the song count" (15 songs → at most 15 marks → blackout is a genuine crown). If a single logged song is allowed to mark *every* square it qualifies for, one segue-microtonal-albumX song can light 3 squares, a 15-song show trivially blacks out by song 6, and every winnability guarantee from the vetting collapses. The vetting calls this out explicitly ("consume-once stays — prevents 1 song = 3 marks").

**Why it happens:**
"Mark every square this song matches" is the obvious, one-line implementation and *feels* generous/fun. The consume-once constraint is a non-obvious global invariant, not a per-square check.

**How to avoid:**
- Enforce consume-once structurally in `deriveMarks`: a logged trail entry can claim **at most one** square; once a square is claimed it is removed from the candidate pool for later songs, AND once a song has claimed a square it stops matching.
- Unit test the exact vetting scenario: a fixture song that qualifies for segue + microtonal + album-membership marks exactly ONE square; a 15-song fixture never exceeds 15 marks.
- Surface the invariant in the difficulty meter math so a mis-implementation shows up as "expected fill 40/15" nonsense during dev.

**Warning signs:**
Marks count exceeds trail length on any fixture; the expected-fill meter reads > number of fillable squares; a show visibly blacks out far too early in playtesting.

**Phase to address:**
Core marking phase (same `deriveMarks` fold). This is the invariant the Monte-Carlo calibration (Pitfall 4) *depends on* being correct — calibrate only after consume-once is test-locked.

---

### Pitfall 3: Placeholder (`???`) and later-rename break marking idempotence

**What goes wrong:**
The trail already contains `???` placeholders (`isPlaceholder`) and provisional/unknown songs that get renamed later when kglw.net catalogs them or the user resolves a fill-hint (`renameEntry`). Bingo interactions with this:
- A `???` at position 4 shouldn't mark a *song* square (it has no `songId`), but it CAN legitimately satisfy an *event* square (opener, segue, "a song you've never caught") based on position/context alone — get this wrong in either direction and the card is either stuck-dark or falsely lit.
- When a `???` is later renamed to a real song (via the existing fill-hint/`renameEntry` path), re-deriving marks can now claim a DIFFERENT square than the placeholder did, retroactively un-lighting a square the user saw stamped — a jarring "my square went dark" moment mid-show.
- A provisional song renamed to merge into a real catalog song changes album-membership qualification after the fact.

**Why it happens:**
The trail is mutable in ways bingo doesn't control (rename, fill-hint adoption, edit). Marking treats each derivation as fresh, so a rename legitimately changes the greedy assignment. This is the bingo-specific face of v1.0 Pitfall 8 (debut/unknown songs).

**How to avoid:**
- Define, in the event catalog, which square types a placeholder-without-`songId` CAN satisfy (position-based events: opener; sequence-based: segue) and which it CANNOT (any album-membership or specific-song square). Make this an explicit property of each square type in config, not implicit.
- Marking must **degrade gracefully on unknown/placeholder songs** (reuse the v1.0 rule: unknowns occupy a slot, participate where position/context suffices, never throw on `songById[id].name`).
- Accept that rename can re-assign, but make the visible behavior **monotonic where it matters**: a rename should only ever add or move a mark, never leave the user with fewer lit squares than before, for the same trail length. If a clean re-derive would remove a mark, prefer keeping the prior claim (sticky assignment) OR make the recompute visibly "settle" so it doesn't look like a bug. Decide this explicitly and test it.
- Fixture test: a show containing a `???` that is later renamed to (a) a song matching a different square, (b) a debut absent from the catalog — assert final marks and win-state are correct and no square un-lights.

**Warning signs:**
A square that lights then goes dark after a fill-hint is adopted; a crash/`undefined` when marking a provisional song; placeholder marking a specific-song square.

**Phase to address:**
Core marking phase (placeholder/rename rules baked into `deriveMarks`); verified in the same fixture suite as Pitfalls 1–2. Depends on the existing `renameEntry`/fill-hint path (already shipped in Phase 5 live sync).

---

### Pitfall 4: Card recipe locked before the Monte-Carlo proves winnability — dead cards or trivial cards ship

**What goes wrong:**
The empirical core risk from the vetting: on a median-15-song show with consume-once, a mis-sized recipe produces either **dark-all-night cards** (blackout impossible, card tops out at a sad fraction lit) or **trivial instant lines** (four high-frequency event squares in a row that always fill by song 5). The specific landmines the corpus already exposed: any square built on a **dead event type** (cover 2%, encore 0%, Set-2 2%) is a guaranteed dark square all night; a card of the 12 most-*likely specific songs* marks only ~3 per show (no song > 34%); filling all 15 from the ~4 reliably-firing event types reads monotonously.

**Why it happens:**
Card-recipe constants get chosen to "feel balanced" by eyeballing one or two hand-dealt cards — the exact recency/availability bias that poisons the decay tuning in v1.0 Pitfall 12. Winnability is a distributional property over hundreds of shows; you cannot see it from a handful of examples.

**How to avoid — what the Monte-Carlo pre-plan MUST verify before the recipe is locked (this is `questions.md` Q1, and it GATES the bingo phase per the scope triage):**
- Deal plausible cards from each vibe recipe (Chill / Balanced / Glory-hunter) and **replay every recent-era show (2022+, 241 shows)** through the real `deriveMarks` (not an approximation — reuse the shipped pure fold so the sim matches production).
- Report per recipe: **P(≥1 line)**, **P(blackout)**, **P(four-corners)**, **P(X)**, distribution of **squares-lit** (min/median/max), and **share of shows that produce a dark-all-night card** (target: ~zero).
- Assert **no square type can be individually dark-all-night**: every event square in the catalog must clear a minimum per-show fire-rate floor (covers/encore/Set-2 are already excluded — the sim must fail loudly if any re-creep in).
- Assert **no recipe yields a trivial line** (e.g. P(line by song 5) below a ceiling) and **no recipe yields P(line) too low** (a line should be *likely* over median 15).
- Confirm the **album-membership variety engine** does the work: enough distinct album squares (measured 53–80% each) that cards don't read "segue/segue/microtonal."
- Output the calibration constants (event/song mix, album roster, jam-vehicle list) **into core config** — no scattered magic numbers.

**Warning signs:**
Recipe constants committed before the sim runs; a sim that approximates marking instead of calling the real `deriveMarks`; any square whose per-show fire-rate is unmeasured; P(blackout) that is exactly 0 (card can't be won — the 5×5 trap) or near 1 (trivial).

**Phase to address:**
**Monte-Carlo pre-plan task — GATES the bingo phase** (scope triage line 39; questions.md Q1). Recipe constants + curated lists (jam-vehicles, album roster) land in `packages/core/src/config.ts` as the sim's output. Re-run the corpus scripts before locking (design note "Reproducing the numbers").

---

### Pitfall 5: Card not frozen at Start Show — it reshuffles to match songs already played

**What goes wrong:**
The card must be **FROZEN at Start Show** (design: "unlocked until Start Show, then FROZEN"). If the card artifact (square defs + seed) is regenerated or re-seeded from the live trail after the show starts — or if it's derived from anything mutable rather than a persisted snapshot — then songs already played will influence which squares appear, or a reshuffle mid-show hands the user a fresh (easier or different) card. Both destroy the game: bingo is only meaningful if the board is fixed before the balls are drawn.

**Why it happens:**
The card is derived data (square defs from a seed), and "just re-derive it" is the reflex everywhere else in this codebase (tally, comet, dex are all recomputed live). Bingo inverts that for the card DEFINITION: squares are frozen, only *marks* recompute. Conflating "recompute marks" (correct) with "recompute card" (fatal) is the trap.

**How to avoid:**
- Persist the card as an **immutable artifact** in Dexie at freeze time: `{ squareDefs[], seed, lockTimestamp, sessionId }`, tied to the tracked-show session. After lock, `deriveMarks` reads square defs from the stored artifact — the generator is never called again for that session.
- The generator (`dealCard`) is pure and seed-driven so reshuffle-before-lock is reproducible, but the **freeze writes the resolved squareDefs**, not just the seed, so a later config/catalog change can't silently re-deal a locked card (see Pitfall 10).
- Gate the reshuffle/re-deal UI on `status !== "active"` — reshuffle is unlocked "anytime" *before* the show, disabled once frozen.
- Test: freeze a card, log songs, assert square defs are byte-identical before and after; assert reshuffle is rejected on an active session.

**Warning signs:**
Card squares that change after Start Show; a reshuffle button still live during tracking; card defs derived on-the-fly from the trail instead of read from a stored artifact.

**Phase to address:**
Card persistence + lock phase. The freeze-writes-resolved-defs decision is architectural (like Pitfall 10) — make it when the artifact schema is designed.

---

### Pitfall 6: Late-join "Catch me up" replays wrong marks / breaks lock semantics

**What goes wrong:**
Late joiners use one-tap "Catch me up" which **bulk-adopts from the live `latest` feed** (reuses the adopt-suggestion path). Failure modes: (a) if the card locks at *Start Show* but the user starts the session late (mid-show), what's the freeze reference — the moment they hit Start, or show position 1? If squares like "the opener" or position-sensitive events are marked against a trail that starts at song 8, the opener square can never fire, silently darkening it. (b) Bulk-adopting 8 songs at once must run through the SAME pure `deriveMarks` fold in position order, or the consume-once assignment differs from a user who logged them one at a time (re-surfacing Pitfall 1). (c) The adopted songs come from `latest`, which carries every live-sync bug (next pitfall).

**Why it happens:**
Late-join is treated as "just replay a bunch of songs fast," but it stresses both the ordering-determinism invariant (batch vs incremental) and the lock/position semantics simultaneously.

**How to avoid:**
- Bulk-adopt must build the trail in correct position order, then call the **one** `deriveMarks` fold — never a fast-path incremental marker. (Directly reuses the Pitfall 1 "live==replay" guarantee; if that property test passes, catch-up is correct for free.)
- Decide and document the freeze/position reference for a late-started session: recommended — the card is dealt against the FULL expected show and "the opener" is judged against the actual show's position-1 song from `latest`, so a late joiner who catches up still gets the opener square marked. This requires catch-up to import prior positions, not just from-now-on.
- Preserve consume-once across the bulk import exactly as for incremental logs.
- Test: a fixture where the user joins at song 8 and catches up — final card == the card of a user who logged all 15 live.

**Warning signs:**
"The opener" (or other position-1 event) permanently dark for late joiners; catch-up card differs from live-logged card on the same show; catch-up uses a separate marking code path.

**Phase to address:**
Card marking + late-join phase; reuses the shipped adopt-suggestion path (Phase 5). Verified by the late-join fixture in the marking test suite.

---

### Pitfall 7: Live-sync bugs feed bad marks — bingo inherits the v1.2 Tier-1 defects (HARD DEPENDENCY)

**What goes wrong:**
"Catch me up" and any auto-marking driven by `latest` pull from the **same live feed** that the v1.2 Tier-1 bugs are about to fix. Until those land, bad feed data auto-marks a bingo card with false stamps that look authoritative:
- **`fix-wrong-show-editor-suggestions-stale-latest-rows` (#1, HIGH):** on night 2 of a residency, `latest` can still serve last night's songs → catch-up marks squares from the WRONG SHOW. On a bingo card this is worse than in the tracker: the user sees squares light up for songs that aren't being played, and may "win" on a phantom show.
- **`verify-artist-filter-on-latest-poll` (#2):** a Stu solo set feeds wrong-ARTIST songs; album-membership squares mark off non-King-Gizzard songs. (poll-latest.ts already filters `artist_id === 1` — this bug is about verifying that holds; bingo depends on it holding.)
- **`guard-live-sync-against-strict-schema-drift` (#3):** kglw just upgraded their software; a new/renamed field can make live sync die silently mid-tour → catch-up returns nothing → card never auto-marks and the +1 sees a dead board (the exact failure the feature exists to prevent).
- **`wire-rotation-suppression-into-live-predictions` (#4):** less direct, but the song-square base-rate seeding should reflect no-repeat residency reality.

**Why it happens:**
Bingo is a NEW consumer of an existing feed and silently assumes the feed is clean. The feature amplifies feed defects because auto-marking is trust-by-design ("+1 who knows zero songs just watches squares light up") — the user has no independent knowledge to catch a wrong mark.

**How to avoid:**
- **Sequence the bingo phase AFTER all Tier-1 live-sync fixes land** (the scope triage already mandates "land all bug fixes first, then Gizz Bingo" — this pitfall is the concrete reason, not just tidiness). Do not build catch-up against the unfixed feed.
- Bingo consumes `latest` ONLY through the already-hardened `pollLatest` + `suggest` path (artist filter, schema validation, `[]`-on-failure) — never a second, unvalidated fetch. No new sync plumbing (design: "reuses adopt-suggestion path... No new sync plumbing").
- Keep auto-marking **suggest-then-confirm at the boundary** consistent with v1.0 Pitfall 7 (sync is suggest-only): "Catch me up" is a user-initiated bulk adopt, not a silent background auto-mark, so a wrong-show burst is a reviewable action, not an invisible corruption.
- On schema-drift/empty feed, the card must **degrade to manual marking** cleanly (tap-to-mark, search fallback per design) — never a blank frozen board with no way to play.

**Warning signs:**
A bingo phase planned or built before bugs #1–#3 are closed; any `fetch` to `latest` inside bingo code instead of reusing `pollLatest`; catch-up that marks without the artist/schema guards; no manual-mark fallback when the feed is empty.

**Phase to address:**
**Cross-dependency: Tier-1 bug phases (#1 #2 #3, and #4) MUST precede the bingo phase.** Bingo's live-marking phase inherits the polling discipline; verified by a wrong-show / wrong-artist / schema-drift fixture fed through catch-up asserting NO false marks.

---

## Moderate Pitfalls

### Pitfall 8: Celebration fatigue on a friendly card

**What goes wrong:**
A 4×4 card with 15 fillable squares over a 15-song show fires a LOT of marks. If every square stamp triggers a big animation, and every line triggers a supernova, the celebration becomes noise within one show — and actively annoying by night 2 of a 3-night residency. The design already tempers this ("big moments on FIRST LINE + BLACKOUT only; per-square = small orb stamp") — the pitfall is drift back toward "celebrate everything" during implementation.

**How to avoid:** Reserve the big supernova + share-card for FIRST LINE and BLACKOUT only; per-square marks get the lightweight orb "stamp" (reuse orb renderer). Make celebration tiers config constants so they can be dialed down after the first real show. No celebration on catch-up bulk-adopt (would fire 8 at once).

**Warning signs:** Full-screen animation more than ~twice per show; a bulk catch-up triggering a stampede of celebrations.

**Phase to address:** Bingo celebration/UX phase.

---

### Pitfall 9: Reduced-motion path forgotten on the new celebration surface

**What goes wrong:** `useReducedMotion` is already threaded through the app, but the bingo supernova/orb-stamp/share-card canvas is NEW animation surface. It's easy to reuse the orb renderer's happy path and forget the reduced-motion branch, shipping a full particle supernova to a user who set reduce-motion (accessibility regression, and a battery/perf cost mid-show — v1.0 Pitfall 3 territory).

**How to avoid:** Thread `useReducedMotion` into every new bingo animation from the first commit; reduced-motion path = instant state change / static stamp, no particle sim. Add it to the phase exit checklist alongside the existing reduced-motion checks.

**Warning signs:** Any new animation component in the bingo tree that doesn't read `useReducedMotion`; supernova plays with reduce-motion enabled in test.

**Phase to address:** Bingo celebration/UX phase (accessibility is a phase exit criterion).

---

### Pitfall 10: Card artifact drifts from stored trail (versioning / catalog drift)

**What goes wrong:** The card is a persisted artifact (square defs + seed + lock timestamp). If squares store only the SEED (not resolved defs) and rely on re-derivation, then a later change to the song catalog, album roster, jam-vehicle list, or generator code **re-deals a historical locked card differently** — the GizzDex history now shows a card the user never played, with different marks and possibly a different win-state. Same failure class as v1.0's matrix-artifact drift, but here it corrupts *personal history*, which (unlike the derivable matrix) is irreplaceable.

**How to avoid:**
- **Freeze resolved square definitions**, not just the seed. The stored artifact is self-contained: each square carries its concrete predicate/label/album-id so re-derivation is pure over the trail alone, independent of current config.
- Version the card artifact schema (add a `cardVersion` field) so a future recipe change is additive, not a silent reinterpretation of old cards.
- Include the frozen card in the JSON export/import (v1.0 export insurance) so residency history survives iOS eviction — with schema-version field per v1.0 export/import gotcha.

**Warning signs:** A past show's card changing after a config/catalog update or app deploy; card defs stored as seed-only; card absent from the export round-trip.

**Phase to address:** Card persistence + lock phase (artifact schema decision); export coverage in the persistence phase.

---

### Pitfall 11: Dexie migration mistakes when adding bingo tables

**What goes wrong:** The DB is at `version(4)` with a strict **additive-only** migration discipline (db.ts: "Grow the shape via `this.version(N).stores({...})`... never by rewriting version(N)"). Adding bingo storage by editing an existing `version()` block, or adding a new table without a fresh `version(5)`, corrupts every friend's existing Pokédex/attendance/tracked-show data on upgrade — the irreplaceable personal data the whole export-insurance story exists to protect.

**How to avoid:**
- Add bingo storage as **`this.version(5).stores({ bingoCards: "&sessionId, ..." })`** — a NEW version, NEW table(s), leaving v1–v4 byte-identical. A new table needs no `.upgrade` (no rows to backfill), exactly as `version(4)` did for `archiveShows`.
- Tie the card to the tracked-show session (`&sessionId`) so it lives/dies with the show and re-derivation has a stable join key.
- If bingo needs a field on an existing table, add it via a `version(5).upgrade` that backfills a default (the v3 pattern), never by mutating a prior version's schema string.
- Test the migration from a v4 DB snapshot with real data → v5, asserting all prior tables intact.

**Warning signs:** Any edit to `version(1..4)` blocks; a new table added without bumping the version number; upgrade tested only on an empty DB.

**Phase to address:** Card persistence phase (schema migration is the first task, gated by a populated-DB upgrade test).

---

### Pitfall 12: Canvas/animation perf on older iPhones mid-show

**What goes wrong:** The bingo surface reuses the constellation galaxy backdrop + share-card canvas + per-square orb stamps. Running a particle supernova over a galaxy backdrop on the oldest iPhone in the friend group, mid-show, while the wake lock holds the screen on and the live poller ticks every 60s, can drop frames or heat the device — a distant cousin of v1.0 Pitfall 9 (force-graph jank). The +1's phone may be the oldest of the group.

**How to avoid:** Cap concurrent animation (celebration tiers, Pitfall 8); freeze/stop any looping animation when idle (v1.0 "simulation never stopped" lesson); test the supernova on the oldest target device, not desktop; reduced-motion path (Pitfall 9) is also the low-end fallback. The 4×4 grid itself is trivial (16 cells) — the risk is purely the celebration/backdrop layers.

**Warning signs:** Frame drops or device heat during a celebration on a real older iPhone; a backdrop animation still running while the card is idle between songs.

**Phase to address:** Bingo celebration/UX phase (oldest-device perf check as exit criterion).

---

### Pitfall 13: The +1 gets a dead or empty card (the feature's whole point, defeated)

**What goes wrong:** The feature exists so a knowledge-free +1 "just watches squares light up." Ways that silently fails: (a) they never dealt a card (no auto-deal / blank state); (b) the feed died (schema drift, Pitfall 7) and no manual fallback, so the board sits dark all night; (c) a mis-calibrated recipe (Pitfall 4) hands them a dark-all-night card; (d) they joined late and the opener/position squares are permanently unreachable (Pitfall 6). Any of these turns the anchor feature into a dead tab in front of the exact casual user it was built to delight.

**How to avoid:** "Deal my card" is one tap and **never produces a blank card** (design). Auto-deal a Balanced card if none exists at Start Show so a +1 who taps nothing still has a live board. Always provide the manual tap-to-mark + search fallback so a dead feed still gives a playable game. The Monte-Carlo (Pitfall 4) guarantees no dark-all-night recipe. Late-join marks the opener (Pitfall 6).

**Warning signs:** Any path that shows an empty grid; no auto-deal fallback; no manual-mark when feed is empty; playtesting where a card ends the show mostly dark.

**Phase to address:** Bingo build/UX phase + Monte-Carlo pre-plan (calibration) + Tier-1 live-sync dependency (feed health).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Incremental "mark on log" mutator instead of a pure re-derive fold | Feels efficient; fewer recomputes | Live≠replay divergence; GizzDex history contradicts what user saw; win-state flips | Never — recompute is cheap (16 squares) and correctness is the point |
| Store card as seed-only, re-derive squares on read | Smaller artifact | Catalog/config change silently re-deals locked historical cards; corrupts personal history | Never — freeze resolved defs |
| Ship recipe constants tuned by eyeballing a few dealt cards | Fast; "looks balanced" | Dark-all-night or trivial cards over the real show distribution | Never — the Monte-Carlo gate is non-negotiable |
| Build catch-up against the current (unfixed) `latest` feed | Unblocks bingo sooner | Wrong-show/wrong-artist false marks; phantom wins | Never — sequence after Tier-1 fixes |
| New Dexie table by editing an existing `version()` block | One fewer version bump | Corrupts all existing personal data on upgrade | Never — additive `version(5)` only |
| Celebrate every square + every line | Feels rewarding in a 5-min demo | Fatigue by song 6, rage by residency night 2 | Never — big moments = first line + blackout only |
| Skip reduced-motion on the new supernova | Ships the fun path faster | Accessibility regression + low-end perf hit | Never — thread `useReducedMotion` from commit 1 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| kglw.net `latest` (via catch-up) | New unvalidated `fetch` in bingo code | Reuse shipped `pollLatest` + `suggest` (artist filter, schema validation, `[]`-on-fail); no new sync plumbing |
| Existing trail (tally/comet peers) | Bingo mutates or forks the trail | Bingo is a THIRD pure derivation over the same trail; never a second pipeline |
| `renameEntry` / fill-hint path | Rename retroactively un-lights a square | Sticky/monotonic marks; test rename never reduces lit count for same trail length |
| Dexie schema (at v4) | Edit v1–v4 or add table without bump | `version(5).stores({...})`, new table, no destructive rewrite; upgrade test on populated DB |
| JSON export/import | Card omitted or exported without schema version | Include versioned card artifact in round-trip so residency history survives eviction |
| `useReducedMotion` (already threaded) | New animation forgets to read it | Reduced-motion branch in every new bingo animation |
| Orb renderer / galaxy backdrop reuse | Assume desktop perf | Oldest-iPhone check; stop looping backdrop when idle |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Supernova + galaxy backdrop + per-square stamps concurrently | Frame drops, device heat mid-show | Celebration tiers; stop idle animation; reduced-motion fallback | Oldest iPhone, wake lock on, during a line |
| Re-deriving marks scanning whole event catalog per log | Laggy stamp on tap | 15 squares × small catalog is trivial — just don't refetch/rebuild curated lists per log; build once at freeze | Only if implemented naively |
| Bulk catch-up firing N celebrations | Animation stampede, jank | Suppress celebration on bulk-adopt; compute final state, then one settle | Late-join adopting 8+ songs |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Importing a friend's shared card artifact without validation | Malformed card corrupts Dexie / boot-loop (v1.0 import risk) | Schema-validate card on import; stage before commit; never crash on bad card |
| Rendering imported square labels / share-card text as HTML | Stored XSS via crafted export (v1.0) | React default escaping; no `dangerouslySetInnerHTML` on card data |

(Low overall surface — solo/personal v1, no leaderboard. The import path remains the only real corruption vector, unchanged from v1.0.)

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blank/empty card state | The +1 anchor feature is a dead tab | One-tap "Deal my card", never blank; auto-deal Balanced at Start Show |
| Celebration on every mark/line | Fatigue within one show, rage by night 2 | Big moments = first line + blackout only; small stamp per square |
| Reshuffle available after Start Show | User re-deals to an easier card; game meaningless | Freeze at Start Show; reshuffle gated on non-active session |
| Late joiner's opener square permanently dark | Silent unwinnable square; feels broken | Catch-up imports prior positions; opener judged against actual position-1 |
| Full supernova with reduce-motion on | Accessibility + perf regression | Reduced-motion static stamp path |
| Square un-lights after a rename/fill-hint | Looks like a bug mid-show | Monotonic/sticky marks; never fewer lit for same trail length |
| Dark-all-night card from a dead-event square | +1 watches nothing happen — feature fails its one job | Monte-Carlo excludes dead events; per-square fire-rate floor |

## "Looks Done But Isn't" Checklist

- [ ] **Consume-once:** Marking works in a demo — verify one song satisfying 3 squares marks exactly ONE, and a 15-song show never exceeds 15 marks.
- [ ] **Determinism:** Marks look right live — verify `deriveMarks(card, fullTrail)` == the incremental live path == a bulk catch-up, byte-identical, on a fixture with overlapping squares.
- [ ] **Replay:** GizzDex shows a past card — verify it re-derives to the SAME marks + win-state the user saw live, and does NOT change after a config/catalog/app update.
- [ ] **Lock:** Card freezes at Start Show — verify square defs are identical before/after, reshuffle rejected on active session, and a config change can't re-deal a locked card.
- [ ] **Late join:** Catch-up marks the board — verify a user joining at song 8 ends with the same card as one who logged all 15 live, opener included.
- [ ] **Live-sync coupling:** Catch-up marks correctly — verify a wrong-show / wrong-artist / schema-drift feed produces NO false marks (requires Tier-1 fixes #1–#3 landed first).
- [ ] **Calibration:** A recipe exists — verify the Monte-Carlo over 241 recent shows reports P(line) likely, P(blackout) rare-but->0, zero dark-all-night cards, no trivial instant lines, per vibe.
- [ ] **Migration:** New table added — verify upgrade from a POPULATED v4 DB leaves attendance/dex/tracked-shows intact.
- [ ] **Reduced motion:** Celebrations fire — verify reduce-motion path shows static stamps, no supernova, on the oldest target iPhone.
- [ ] **Placeholder/rename:** Card handles `???` — verify a placeholder later renamed (incl. to a debut) yields correct marks and never un-lights a square.
- [ ] **Export:** Card persists — verify it survives an export → import round-trip with a schema-version field.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Live≠replay divergence found late | MEDIUM | Marks are derived data: fix the `deriveMarks` fold, redeploy; historical cards re-derive correctly (if resolved defs were frozen) — no user data touched |
| Recipe mis-calibrated (dark/trivial cards) shipped | LOW-MEDIUM | Recipe is config: retune via Monte-Carlo, bump `cardVersion`; NEW cards fix; frozen old cards keep their (self-contained) defs |
| Wrong-show marks from unfixed feed | MEDIUM at showtime | Manual un-mark / re-catch-up after correction; real fix is sequencing Tier-1 bugs first — hence prevention |
| Card artifact drift corrupts history | HIGH (personal data) | Restore from JSON export if the habit exists; else history is lost — hence freeze-resolved-defs prevention |
| Dexie migration corrupted personal data | HIGH | Restore from JSON export; the additive-only discipline exists precisely to prevent this |
| Celebration fatigue / perf on old phone | LOW | Dial celebration tiers down via config; enable reduced-motion; no data impact |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Non-deterministic assignment (P1) | Core marking (`deriveMarks` fold) | live==replay==catch-up property test |
| One song → multiple squares (P2) | Core marking | ≤1 mark/song, ≤15 marks/show fixtures |
| Placeholder/rename edge cases (P3) | Core marking (reuses shipped `renameEntry`) | `???`→rename→debut fixture; no un-light |
| Fill-rate mis-calibration (P4) | **Monte-Carlo pre-plan (GATES bingo phase)** | P(line)/P(blackout)/dark-card report over 241 shows, per vibe |
| Reshuffle after Start Show (P5) | Card persistence + lock | Defs identical pre/post; reshuffle rejected active |
| Late-join replay (P6) | Marking + late-join | Join-at-8 == logged-all-15 fixture |
| **Live-sync bad marks (P7)** | **Tier-1 bug phases (#1 #2 #3 #4) PRECEDE bingo** | Wrong-show/artist/drift feed → zero false marks |
| Celebration fatigue (P8) | Bingo celebration/UX | ≤2 big moments/show; no bulk stampede |
| Reduced-motion (P9) | Bingo celebration/UX | Reduce-motion = static stamp, verified |
| Card artifact drift (P10) | Card persistence | Frozen resolved defs; past card stable across deploy |
| Dexie migration (P11) | Card persistence | Populated-v4 → v5 upgrade preserves all tables |
| Old-iPhone perf (P12) | Bingo celebration/UX | Oldest-device celebration frame check |
| Dead/empty +1 card (P13) | Bingo build/UX (+ P4 + P7) | Never-blank; manual fallback; no dark-all-night |

**Phase-ordering consequence for the roadmap:** the bingo phase has TWO hard upstream gates — (1) all Tier-1 live-sync bug fixes (#1–#4) landed, and (2) the fill-rate Monte-Carlo pre-plan task complete with calibration constants written to config. Within the bingo work, sequence: core marking (P1–P3, P6) → persistence+lock+migration (P5, P10, P11) → build/UX+celebration (P8, P9, P12, P13). Marking is pure core and testable headless before any UI exists.

## Sources

- `.planning/notes/gizz-bingo-design-vetting.md` — vetted design + empirical corpus findings (241 shows, median 15, dead event types, 4×4 rationale, consume-once, freeze-at-Start-Show, replay-as-re-derivation) — HIGH (project's own empirical work)
- `.planning/notes/v1.2-scope-triage.md` — Tier-1 live-sync bug list + "bugs first, then Bingo" sequencing + Monte-Carlo gate — HIGH
- `.planning/research/questions.md` Q1 — the open fill-rate calibration question this doc translates into a gate — HIGH
- `.planning/research/PITFALLS.md` (v1.0) — inherited iOS/PWA/live-sync/touch pitfalls (P1 state discard, P2 eviction, P3 wake lock, P7 sync suggest-only, P8 unknown songs, P9 anim perf, P12 tuning-by-eyeball) — HIGH
- Codebase: `packages/app/src/db/db.ts` (additive `version(1..4)` migration discipline), `packages/core/src/live/{poll-latest,suggest}.ts` (artist filter, schema validation, suggest-only, `renameEntry` path), `packages/core/src/config.ts` (single-source constants), `packages/core/src/{model,dex}` (existing pure derivations bingo sits alongside) — HIGH (read directly 2026-07-19)

---
*Pitfalls research for: Gizz Bingo live auto-marking cards (Guezzer v1.2)*
*Researched: 2026-07-19*
