# Phase 14: Gizz Bingo — Core Marking & Generation - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A pure, DOM-free `packages/core/src/bingo/` module — a deterministic consume-once
`deriveMarks` fold and a seeded card generator — proven correct headless and passing
the fill-rate Monte-Carlo calibration gate **before** any UI or DB is built. This is
the third derivation over the tracked-show trail, sibling to `deriveTally` and
`deriveDex`. Delivers BINGO-03.

**In scope:** `core/bingo/` (`types`, `context`, `generate`, `mark`, `wins`) + a
Monte-Carlo calibration CLI + locked config constants + core barrel exports + headless
fixture/property tests. **GATE 1** (Phase 11 live-sync correctness) is already met.
**GATE 2** (the calibration CLI runs over the 241-show corpus and writes locked
constants) is cleared *inside* this phase.

**Out of scope (later phases):** Dexie `bingoCards` persistence, lock-on-Start-Show,
export/import, catch-up, GizzDex replay (Phase 15); the GizzGames tab, Deal/vibe/swap
build UX, live-marking surface, "one away" surfacing, celebrations, share card
(Phase 16). No new dependencies, no new build-time data artifact.

</domain>

<decisions>
## Implementation Decisions

### Vibes & win-rate calibration targets (locked to per-vibe config constants this phase)
- **D-01:** Vibes shift **both** the square mix **and** the winnability targets — not one
  or the other. A vibe changes what's on the card *and* how likely it is to win.
- **D-02:** Per-vibe **line** targets over a median 15-song show — ~~**Chill ~82%**,
  **Balanced ~70%**, **Glory-hunter ~50%**~~ (SUPERSEDED — see amendment below).
  Line = the common reward; blackout = the rare crown.
- **D-03:** Per-vibe **blackout** targets — ~~**Balanced ~2–5%** (rare crown), **Glory-hunter
  ~5–10%** (roughly double Balanced)~~ (SUPERSEDED — see amendment below). Chill blackout
  stays rare (not a Chill goal).

> **AMENDMENT — D-02/D-03 retarget (2026-07-20, Plan 06 D-20 calibration).**
> Authorized by the owner (Option 1) after the D-20 gate **proved the original
> targets structurally unreachable** under D-11 consume-once single-show marking.
> With exactly one mark per logged song over a median-15-song show, the engine's
> real achievable ceiling is far below the originals and P(blackout) collapses to
> ~0.00 in *every* reachable mix — no mix-weight assignment can close a 30–40-point
> line gap or manufacture an unreachable blackout floor. The bands were retargeted
> to the engine's **measured** range, preserving the **chill > balanced > glory**
> ordering with meaningful separation, and the lock was finished against a
> genuinely green gate (bingo-calibrate.ts exit 0).
>
> **Measured-ceiling evidence (mid-collection dex, 241 recent-era shows, 500 cards/vibe):**
>
> | Vibe | Orig. P(line) target (D-02) | Max achievable P(line) | Orig. P(blackout) target (D-03) | Max achievable P(blackout) |
> |---|---|---|---|---|
> | Chill | ~0.82 | ~0.42 | rare cap | ~0.00 |
> | Balanced | ~0.70 | ~0.37 | 0.02–0.05 (floor) | ~0.00 |
> | Glory-hunter | ~0.50 | ~0.22 | 0.05–0.10 (floor) | ~0.00 |
>
> **Retargeted bands (now LOCKED in `config.bingo.vibes`, gate-green):**
> - **P(line)** (± 0.05 tolerance): **Chill 0.42**, **Balanced 0.35**, **Glory-hunter 0.20**.
>   As measured at lock: chill 42.4% / balanced 32.4% / glory 19.9% — ordering + separation intact.
> - **P(blackout)**: the balanced/glory **floors are REMOVED** (unreachable — the crown is never
>   *mandatory*). Only a small **upper cap** remains per vibe (`blackoutMax`: chill 0.02,
>   balanced 0.03, glory 0.05); measured ~0.00 clears all three.
> - **D-05 unchanged and still enforced** — every reliable event/album square clears the ≥20%
>   dark-floor in the gated run (bustOut + neverCaught EXEMPT, D-15).
- **D-04:** **Glory-hunter** mix leans into bust-out + never-caught + rarer album/song
  squares — deliberately high-variance risk/reward (some nights a dud, some the supernova).
  The vibe pick is a real gamble, not just re-skinned squares.
- **D-05:** **Dark-square floor: ≥20%** per-night fire-rate for **reliable event squares**
  (album, microtonal, opener, marathon-jam). Kills the "dark all night" failure the gate exists
  to prevent. (Glory squares are exempt — see D-15.)
- **D-06:** The **free center square counts as marked** for line / X / four-corners geometry
  (conventional bingo). `freeIndex` is a **locked config constant** — on an even 4×4 grid it
  sits at one of the 4 inner cells; lines/diagonals through it need only their other 3 squares.

### Consume-once marking & tie-break (documented in config, pinned by the property test)
- **D-07:** Marking is a **greedy fold in setlist play-order** — each logged song marks its
  single best unmarked square the moment it's logged. NOT a globally-optimal re-solve. This
  matches live reality, guarantees "what lit this square" never changes retroactively, and makes
  `live == replay == catch-up` hold trivially. Calibration accounts for any slight under-fill.
- **D-08:** When a song qualifies for several unmarked squares, **rarest / most-specific wins.**
  The full specificity rank (highest priority first):
  **specific song square > never-caught (personal glory) > bust-out (global glory) > common
  event (album / microtonal / opener / marathon-jam).**
- **D-09:** **Personal glory outranks global glory** — a song that is both a corpus bust-out AND
  your personal never-caught lights the **never-caught** square first (this is a personal Pokédex
  tool; catching one you've never seen is the more precious moment).
- **D-10:** Final deterministic fallback when two squares are exactly equally specific:
  **lowest board index (top-left first).** Rarely reached once specificity + rarity rank first.
- **D-11:** Consume-once is structural: one logged song → at most one mark; 15 logged songs →
  never more than 15 marks. Fixture-test a song satisfying 3 squares marks exactly one.

### "Never caught" personal-glory square
- **D-12:** **Resolved and frozen at card lock.** At Start Show, snapshot the caught-songs set
  and freeze "never-caught = any song NOT in that set" into the card's resolved defs. A song you
  catch for the first time *tonight* still counts as never-caught (it wasn't caught when the card
  locked). Deterministic; survives later config/dex changes. Matches Phase-15 freeze-resolved-defs.
- **D-13:** **Always dealt (subject to vibe weight, D-14); scales naturally.** On your very first
  show the dex is empty so it's near-certain (a warm free-ish win); it organically becomes rarer
  and more precious as your collection grows. No first-show special-casing in the generator —
  calibration just treats a thin dex as an edge.
- **D-14:** **Vibe-weighted, not guaranteed** — it's a mix weight like other event types:
  Glory-hunter leans in (possibly >1), Balanced sometimes, Chill rarely.

### Dark-floor scope for glory squares
- **D-15:** The ≥20% floor (D-05) applies to **reliable event squares only.** Glory squares
  (**bust-out ~21%, never-caught**) are **exempt** — their rarity is the point. They are governed
  by **vibe mix-weights + a per-card cap**, not a fire-rate floor. Without this exemption
  Glory-hunter cannot exist.

### Curated rosters (live in config — no scattered magic numbers)
- **D-16:** **Jam-vehicle roster** (~20 songs, ~95% fire, name-substring hand-tag — no duration
  data exists): **corpus-measured, then user-reviewed before it locks.** The calibration/roster
  step generates a candidate list from corpus fire-rates; the user reviews/edits; then it locks to
  config. → **Process gate (D-19).**
- **D-17:** **Album-membership roster: broad pool for variety** — the measured ≥53% set (Infest
  the Rats' Nest 80%, Omnium Gatherum 80%, PetroDragonic 60%, Ice/Death/Planets… 59%, Flying
  Microtonal Banana 53%, I'm in Your Mind Fuzz 53%) **plus** lower-fire albums that still clear the
  ≥20% floor. Album squares are the biggest variety lever.
- **D-18:** **Album-square count per card is owned by calibration** — a per-vibe mix weight the
  Monte-Carlo tunes within the fill targets and ≥20% floor. No hardcoded cap.

### Calibration gate enforcement
- **D-19:** The Monte-Carlo CLI does **report + hard assertion.** It (a) prints the per-vibe report
  — P(line) / P(blackout) / dark-square share / expected marks over the 241-show corpus — for the
  human trust gate, AND (b) asserts the hard invariants (≥20% floor on reliable squares, per-vibe
  target bands D-02/D-03, no dark-all-night square) and **exits non-zero if violated**, so
  un-calibrated config can never silently ship. This is the Bingo equivalent of the backtest gate.
- **D-20 (process):** Because the jam-vehicle + album rosters are **user-reviewed before lock**
  (D-16), the GATE-2 calibration task must **surface the candidate rosters for the user's sign-off
  BEFORE writing constants to `config.ts`.** Plan the calibration as: generate candidate rosters →
  user review checkpoint → run Monte-Carlo → lock constants. Do not auto-write config in one pass.

### Generator seed & determinism
- **D-21:** The generator uses an **explicit string seed**; `deal(seed, vibe, dexSnapshot,
  corpusVersion)` is a **pure function** — same inputs → byte-identical card (satisfies the
  same-seed property test naturally). No card-sharing plumbing is built in v1. Note: the personal
  never-caught square (D-12) means shared seeds will **not** produce fully identical cards across
  friends, so full leaderboard comparability stays future work (GAME-V1.3-01) — but the string seed
  is the correct determinism primitive regardless.

### Core/app trail boundary
- **D-22:** The pure core fold **defines its own minimal trail-input contract** — song id +
  play-order index (opener = index 0; all other event/album/microtonal/bust-out matching resolved
  from the frozen card + context; never-caught resolved from the frozen dex snapshot in the card).
  The app adapts its `TrackedEntry` rows → this contract. Keeps `core/bingo/` DOM/DB-free per the
  strict core-purity constraint and headless-testable with plain fixtures. `TrackedEntry` (defined
  in `packages/app/src/db/db.ts`) is **not** imported into core.

### Locked upstream (from prior research — NOT re-litigated here)
- **D-23:** Card is **4×4 (15 fillable + free center)**; marks are **DERIVED, never stored**;
  single deterministic `deriveMarks` fold pinned by a `live == replay == catch-up` property test.
- **D-24:** Auto-mark catalog: **opener + microtonal + marathon-jam + bust-out + never-caught +
  album-membership + song squares.** **"Segue" is EXCLUDED** — `TrackedEntry` is song-level and
  carries no transition metadata, so a segue square is not trail-derivable. Covers/encore/Set-2
  stay dropped (dead in the recent era). Re-adding segue is explicit future scope.
- **D-25:** Song-square seeding uses **base-rate recent-era frequency, NOT the transition
  predictor** (which models next-song-given-current, not standalone likelihood).
- **D-26:** Win conditions on 4×4: **line / four-corners / X / blackout** — all achievable.

### Claude's Discretion
- Exact module file split within `core/bingo/` (`types` / `context` / `generate` / `mark` /
  `wins` per research ARCHITECTURE.md), the `BingoCard` serializable JSON field shape, the
  concrete PRNG behind the string seed, and the precise numeric constants the Monte-Carlo lands on
  (within the D-02/D-03/D-05 targets) are all Claude's discretion — subject to the tests and the
  gate. `bustOutGapShows` starts from the vetting's ≥50-show gap (~21% fire) and is re-confirmed by
  the corpus scripts before locking.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (empirical corpus findings)
- `.planning/notes/gizz-bingo-design-vetting.md` — the vetted v1 design against 241 recent-era
  shows: median 15 songs, 4×4 decision, dead event types (covers/encore/Set-2), album-membership
  as the variety engine, per-event fire-rates. Source of truth for the empirical numbers.
- `.planning/research/questions.md` — Q1 (fill-rate calibration) and Q2 (canonical jam-vehicle +
  album lists) — the two open calibration questions this phase's gate resolves.

### Feature research (extends, never re-litigates, the vetting)
- `.planning/research/v1.2/SUMMARY.md` — synthesis; the segue-exclusion correction, the two hard
  gates, the deterministic-fold + specificity tie-break, phase ordering (B1 = this phase).
- `.planning/research/v1.2/ARCHITECTURE.md` — the `core/bingo/{types,context,generate,mark,wins}`
  module map, `bingo-calibrate.ts` CLI, third-derivation-over-trail thesis.
- `.planning/research/v1.2/PITFALLS.md` — non-deterministic marking, consume-once enforcement,
  fill-rate mis-calibration, freeze-resolved-defs, the live-sync HARD dependency (GATE 1).
- `.planning/research/v1.2/FEATURES.md` — the auto-marking premise + the two anti-boredom pillars
  (build agency, near-miss) that Phases 15–16 depend on (context, not this phase's deliverable).
- `.planning/research/v1.2/STACK.md` — zero-new-dependency reuse map (relevant to later phases).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Gizz Bingo — BINGO-03 (this phase); the segue-exclusion note; the
  phase-gate note.
- `.planning/ROADMAP.md` §"Phase 14" — goal, GATE 1 / GATE 2 definitions, success criteria.
- `.planning/notes/v1.2-scope-triage.md` — "bugs first, then Bingo" sequencing rationale.

### Config target (where locked constants land)
- `packages/core/src/config.ts` — GATE 2 writes the locked Bingo constants here (mix weights,
  per-vibe targets, `bustOutGapShows`, `jamVehicleSongIds`, album roster, `freeIndex`,
  `specificityRank`). No Bingo section exists yet.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Sibling derivations to model the fold after:** `deriveTally` (`packages/app/src/show/scoring.ts`)
  and `deriveDex` (`packages/core/src/dex/derive-dex.ts`) — both are pure folds over the tracked-show
  trail. Bingo is the third such derivation. `deriveDex` is the closer core-side analog for the
  marking fold; `deriveDex`'s "caught" set is the input to the never-caught square (D-12).
- **Album→song membership:** `packages/core/src/dex/albums.ts` (`deriveDexAlbums`) +
  `data/normalized/dex-albums.json` already ship — the album-membership matcher reads these; no new
  build-time artifact (D-17).
- **Tuning family (microtonal):** `packages/core/src/ingest/tuning-tags.ts` + `data/tuning-tags.json`
  — `tuningFamily` already tags microtonal songs.
- **Corpus for calibration + bust-out gap:** `data/normalized/corpus.json` (filter `year >= 2022`) —
  the CLI replays these 241 shows; bust-out = per-song corpus gap ≥ `bustOutGapShows`.
- **Config pattern:** `packages/core/src/config.ts` (350 lines) is the single home for all model
  constants — add the Bingo section there (D-05/D-08/D-17/D-18/D-21 constants).
- **CLI pattern:** `packages/core/src/cli/*.ts` run headless via Node native TS (e.g. `build-model.ts`,
  `run-census.ts`) — model `bingo-calibrate.ts` on these; erasable-syntax-only (no `enum`/`namespace`).

### Established Patterns
- **Strict core purity (CLAUDE.md constraint):** `packages/core` has `"lib": ["ES2023"]` (no DOM),
  no React dep — importing app/DOM types is a build error. Drives D-22 (core defines its own trail
  contract). String-literal unions, never `enum` (`erasableSyntaxOnly`).
- **Serializable-JSON contract:** the transition matrix is plain serializable JSON consumed by
  multiple readers; the `BingoCard` def follows the same discipline (frozen resolved defs → Phase 15).
- **Barrel exports:** `packages/core/src/index.ts` re-exports pure fns + types behind the ingestion
  anti-corruption boundary — add `bingo/` exports here.
- **Trust-gate precedent:** the Phase-2 backtest report is the model for the calibration gate (D-19)
  — a headless CLI report that must pass before the model is relied on live.

### Integration Points
- **Trail source:** `TrackedEntry` rows (`packages/app/src/db/db.ts`) — app adapts these to the core
  trail contract (D-22). App wiring is Phase 16, not this phase.
- **Caught-set source:** the dex derivation feeds the never-caught frozen snapshot (D-12); the freeze
  itself happens at lock in Phase 15, but the resolver signature must accept a dex snapshot now.

</code_context>

<specifics>
## Specific Ideas

- "This is a personal Pokédex tool" was the decisive framing for D-09 — personal never-caught glory
  is worth more than global bust-out glory.
- Glory-hunter should genuinely gamble: "some nights a dud, some nights the supernova" (D-04).
- The user wants the pen on the jam-vehicle + album rosters — corpus proposes, user disposes (D-16),
  and explicitly wants a review checkpoint *before* config is written (D-20).

</specifics>

<deferred>
## Deferred Ideas

- **Segue square** — excluded from v1 (not trail-derivable; `TrackedEntry` is song-level). Future
  scope: enrich `TrackedEntry` with a captured `transitionKind`, or mark opportunistically from the
  `latest` feed.
- **Shared-seed leaderboard / cross-friend comparable cards** — GAME-V1.3-01
  (`.planning/seeds/gizz-bingo-shared-leaderboard.md`). The explicit string seed (D-21) is the
  forward-compat primitive, but the personal never-caught square blocks full comparability until a
  shared-seed variant is designed. Needs the backend the project refuses → post-v1.
- **Pre-2020 replay cards** re-enabling cover / encore / Set-2 event squares (dead in the recent era
  but alive earlier).

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope.

</deferred>

---

*Phase: 14-gizz-bingo-core-marking-generation*
*Context gathered: 2026-07-19*
