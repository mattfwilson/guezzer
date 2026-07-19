# Research Summary — Gizz Bingo (v1.2)

**Project:** Guezzer
**Feature:** Gizz Bingo — live auto-marking 4x4 setlist bingo
**Milestone:** v1.2 (single feature; the 13 v1.2 bug fixes need no research and are out of scope here)
**Researched:** 2026-07-19
**Confidence:** HIGH (stack + architecture grounded in the shipped source; features MEDIUM-HIGH; calibration numbers deliberately deferred to a gate)

> **Scope.** This is a subsequent-milestone, single-feature synthesis. It extends the prior vetted design (`.planning/notes/gizz-bingo-design-vetting.md`), which remains the source of truth for the empirical corpus findings (241 recent shows, median 15 songs, dead event types, 4x4). All four research files AGREE that they extend — never re-litigate — that vetting, with **one material correction** flagged below.

## Executive Summary

Gizz Bingo is a casual-anchor mini-game: a 4x4 card that auto-marks as the live show is tracked, so a knowledge-free +1 "just watches squares light up." All four researchers converge on a strikingly clean verdict: **it bolts onto the shipped v1.1 app with ZERO new dependencies and NO new data pipeline.** Every piece reuses something already load-bearing — Tailwind CSS Grid for the board, `motion` 12 + the `ExploreBackground` bloom for celebrations, an additive Dexie `version(5)` table for persistence, the existing `shareCard.ts` canvas for the shareable result, `searchCatalog` (fuse.js) for square-swap, and the shipped `transition-matrix.json` / `archive.json` / `dex-albums.json` artifacts for card generation. The only genuinely new code is a pure `packages/core/src/bingo/` module — a third derivation over the tracked-show trail, sibling to the existing tally and dex derivations.

The load-bearing correctness insight, raised independently by Architecture and Pitfalls, is that marking must be **a single deterministic pure fold, `deriveMarks(card, trail)`**, with a documented total tie-break (consume-once, specificity rank, then square index). The live incremental path, post-show replay, and bulk "catch me up" must all call the *same* fold and produce byte-identical marks — pinned by a `live == replay == catch-up` property test. Marks are DERIVED, never stored; only the card *definition* + seed + lock timestamp persist. This is what makes rename/undo/replay free, exactly as it already does for the dex.

The dominant product risk is that auto-marking is structurally passive — "a game that marks itself, with nothing else, is a screensaver." The Feature research is emphatic that fun cannot live in the marking act; it must live in **two P1 pillars: (1) up-front build agency** (one-tap Deal + vibe pick + tap-to-swap + a live expected-fill meter) and **(2) continuous "one away" near-miss surfacing.** Both are table stakes, not polish — if either slips, the feature degrades to a slowly-filling grid. The dominant delivery risk is winnability: a mis-sized card recipe ships dark-all-night or trivial-instant-line cards, and this is a distributional property invisible from eyeballing a few hand-dealt cards. It is resolved by a **Monte-Carlo calibration gate** over the 241-show corpus, run before the generator constants are frozen.

## Key Findings

### Recommended Stack — Zero new dependencies

Detail: `.planning/research/v1.2/STACK.md`. The headline is unanimous: **install nothing.** Every capability maps to an installed, shipping library. Confidence HIGH — verified against the real `packages/app/package.json` and the actual reuse-target source files.

**Reuse map (all already installed):**
- **Tailwind CSS Grid** 4.3.2 — the 4x4 board is `grid grid-cols-4`; reuse the `min-h-11 min-w-11` tap-floor idiom from `PredictionOrb.tsx`. No layout library.
- **motion** 12.42.2 — per-square "stamp" pop + first-line/blackout supernova; already the app animation engine, already `useReducedMotion`-wired.
- **Dexie** 4.4.4 + dexie-react-hooks — additive `version(5)` `bingoCards` table; `useLiveQuery` recomputes marks on every `logSong`, the same reactive seam the tally uses.
- **`ExploreBackground` bloom + `shareCard.ts` canvas + `searchCatalog` (fuse.js)** — the supernova backdrop, the shareable result image (preserving the Pitfall-7 pre-build-before-tap contract), and the square-swap search — all reused verbatim.
- **Explicitly NOT used:** `canvas-confetti`/particle libs, `lottie`, `html2canvas`, any grid/routing lib, a second fuzzy-search lib, `zustand`/Redux. All would add bundle + reduced-motion wiring for capabilities that already exist.

### Expected Features

Detail: `.planning/research/v1.2/FEATURES.md`. The one load-bearing insight: auto-marking is the concept greatest strength AND its biggest boredom risk. Fun lives in build agency + near-miss tension + the reveal — not the marking itself.

**Must have (P1 — table stakes, launch-blocking for the feature):**
- One-tap **Deal my card** produces a complete 4x4, never blank; **vibe pick** (Chill/Balanced/Glory-hunter) — **build-agency pillar #1**.
- **Expected-fill / difficulty meter** — the winnability guardrail that stops an all-rare unwinnable card.
- **Auto-marking** (consume-once) on every logged/synced song — the premise.
- Per-square **orb stamp** + "which song lit it" — the recognition reward.
- **"One away" / near-miss surfacing** — **pillar #2**; the tension mechanic every commercial app misses. Flagged explicitly: **this is table stakes, do NOT defer to polish.**
- **First-line + blackout supernova**, reduced-motion aware; **lock-on-Start-Show**; the **GizzGames** 4th tab.

**Should have (P2 — differentiators, add after validation):**
- Tap-to-swap square builder (catchability hints + cover art + search); "You called it!" rare-song / bust-out / never-caught distinct celebrations; replay card artifact in GizzDex; shareable result card; "Catch me up" late-joiner bulk-adopt.

**Defer (P3 / future):**
- Night-to-night residency streak, personal-best rarest-square memory (P3, free flavor); shared leaderboard / real-time cross-friend cards (explicitly deferred — needs the backend the project refuses); pre-2020 replay cards re-enabling cover/encore/Set-2.

**Anti-features to refuse:** manual daub, multiplayer/shared live state, power-ups, 5x5, "predict-the-setlist" as the core loop, push notifications, and "deal a card and just watch it fill" with no agency/proximity.

### Architecture Approach

Detail: `.planning/research/v1.2/ARCHITECTURE.md`. One-sentence thesis: Gizz Bingo is **a third pure-core derivation over the existing trail**, sibling to `deriveTally` and `deriveDex`; marks are derived, never stored; the live view recomputes through the *same* `useLiveQuery` the Show view already uses — no new sync plumbing, no second pipeline.

**Major components:**
1. **`packages/core/src/bingo/`** (NEW, pure, DOM-free) — `types.ts` (serializable `BingoCard` JSON, string-literal unions no enums), `context.ts` (resolves shipped artifacts into lookups), `generate.ts` (deterministic seeded deal), `mark.ts` (consume-once greedy fold), `wins.ts` (4x4 geometry), plus `cli/bingo-calibrate.ts` (the Monte-Carlo gate).
2. **Dexie `version(5)`** — additive `bingoCards` table keyed `&cardId` with `sessionId` indexed/nullable (provisional-then-bound draft-to-session idiom, like `TrackedShow.showId`); plus export/import envelope inclusion.
3. **`useBingoCard()` hook + `GizzGamesView`** — reactive `useLiveQuery` over the active card + trail, `useMemo(markCard)` / `useMemo(detectWins)`; three mechanical wiring edits (`ROUTES`, `BottomTabBar`, `App.tsx` branch).

**No new build-time artifact is required** — every generator/marker input (`eraPlayCount` base rates, `tuningFamily`, `corpusGap`, album-to-song sets, dex sightings) already ships. The only new *data* is config constants (calibrated mix weights, curated `jamVehicleSongIds`, `bustOutGapShows`).

### Critical Pitfalls

Detail: `.planning/research/v1.2/PITFALLS.md`. The v1.0 iOS/PWA pitfalls (state discard, eviction, wake lock, touch floor) apply unchanged — the bingo card is live-show state and inherits them.

1. **Non-deterministic marking (live != replay).** Greedy assignment over many-to-many qualification is order-dependent. Avoid with a single pure `deriveMarks` fold, a total documented tie-break in config, and a `deriveMarks(card, fullTrail) == foldLeft == catch-up` property test.
2. **Consume-once not enforced (1 song lights 3 squares, false blackout).** Structurally cap each trail entry to at most one square; fixture-test a song satisfying 3 squares marks exactly one, and 15 songs never exceed 15 marks. Calibration depends on this being correct first.
3. **Fill-rate mis-calibration produces dead or trivial cards.** Winnability is distributional; **the Monte-Carlo gate is non-negotiable** — replay all 241 shows per vibe through the real fold, report P(line)/P(blackout)/dark-card share, enforce a per-square fire-rate floor, write constants to config.
4. **Card not frozen at Start Show / artifact drift.** Freeze **resolved square defs** (not just the seed) into the Dexie row so a later corpus/config change cannot silently re-deal a locked historical card. Gate reshuffle on non-active session.
5. **Live-sync bad marks (HARD dependency).** Auto-marking and "catch me up" consume the same `latest` feed the v1.2 Tier-1 bugs fix; until those land, phantom/wrong-show/wrong-artist marks look authoritative to a user who cannot catch them. **Sequence bingo after the Tier-1 fixes.**

Plus moderate: celebration fatigue (big moments = first line + blackout only), reduced-motion on the new supernova surface, Dexie additive-only migration discipline, old-iPhone celebration perf, and the "+1 gets a dead/empty card" failure the whole feature exists to prevent.

## Reconciliation with the Prior Vetting

The four files overwhelmingly **confirm** the vetted design and **add** concrete signatures, algorithms, and gates to it. Where they extend or correct:

**AGREE / CONFIRM:** zero-new-deps reuse plan; 4x4 + consume-once + event-weighted mix; album-membership as the variety engine; GizzGames tab; lock-on-Start-Show; solo/no-leaderboard; replay-as-re-derivation; celebrations reuse existing renderers.

**ADD (net-new, actionable):** the deterministic `deriveMarks` fold + documented `specificityRank` tie-break; the `BingoCard` serializable JSON contract with frozen resolved defs; the `&cardId`/nullable-`sessionId` provisional-then-bound key choice; export/import envelope bump (`SCHEMA_VERSION` 2 to 3, `MIGRATIONS[2]`); the near-miss "one away" surfacing promoted to a P1 pillar; the two hard upstream gates.

**CORRECT (must flag for requirements):**
- **[!] "A segue" square is DROPPED from the v1 auto-mark catalog.** The vetted design event list included segue (97% fire-rate). Architecture found — and Pitfalls confirms — that **`TrackedEntry` is song-level and carries no transition metadata (no `transitionKind`)**, so a segue square **cannot be auto-marked from the trail.** The reliable remaining events (album-membership x6-10, microtonal, jam, opener, bust-out, never-caught) already calibrate to ~15 marks without it. **The v1 auto-mark event catalog is: `opener` + `microtonal` + `marathonJam` + `bustOut` + `neverCaught` + album-membership + 2-3 song squares.** Re-adding segue is explicit future scope (enrich `TrackedEntry` with a captured `transitionKind`, or mark opportunistically from `latest`) — not a silent assumption. **Requirements must reconcile the event list against this correction.**
- **Confirmed-dead (already dropped by the vetting, restated):** covers (2%), encore (0%), Set-2 (2%) stay out of recent-era cards.

## Implications for Roadmap

Two **HARD upstream gates** bound the entire Bingo phase — both must be satisfied before Bingo build begins:

- **GATE 1 — Tier-1 live-sync bug fixes landed first.** Bugs #1 (stale-latest wrong-show rows), #2 (artist filter on latest), #3 (schema-drift guard), #4 (rotation suppression) all precede Bingo. Auto-marking is trust-by-design; a wrong-show burst silently corrupts a card whose user has no independent knowledge to catch it. This is the concrete reason for the scope-triage "bugs first, then Bingo" sequencing.
- **GATE 2 — Monte-Carlo fill-rate calibration complete, constants written to config.** The generator must not ship un-calibrated. Run `core/cli/bingo-calibrate.ts` over the 241-show corpus per vibe using the *real* `deriveMarks` fold; freeze mix weights + `bustOutGapShows` + `jamVehicleSongIds` + `freeIndex` into `packages/core/src/config.ts` so median ~15 marks, a line is likely, blackout is a rare crown, and no square is dark-all-night. This is the bingo equivalent of the backtest trust gate.

Suggested build order within the Bingo work (marking is pure core and headless-testable before any UI exists):

### Phase B1: Pure core marking + generation
**Rationale:** Everything downstream depends on the frozen `BingoCard` JSON contract and a deterministic, consume-once-correct fold. Testable with hand-authored fixtures, no UI, no DB.
**Delivers:** `core/bingo/{types,context,generate,mark,wins}.ts` + `config.bingo` constants + `core/index.ts` exports; the `bingo-calibrate.ts` CLI (GATE 2 runs here — draft, then re-run to lock).
**Addresses:** auto-marking (P1), deal + vibe generator (P1).
**Avoids:** Pitfalls 1-4 (determinism, consume-once, placeholder/rename, calibration).
**Exit tests:** `live == replay == catch-up` property test; one-song-3-squares yields exactly 1 mark; 15 songs cap at 15 marks; placeholder-rename-debut yields correct marks and never un-lights; same-seed yields identical card; the Monte-Carlo report per vibe.

### Phase B2: Persistence + lock + migration + export
**Rationale:** Freeze the card artifact and its backup round-trip before building UX on top of it; the frozen-resolved-defs decision is architectural.
**Delivers:** Dexie `version(5)` `bingoCards` table (`&cardId, sessionId`); `saveDraftCard`/`reshuffleCard`/`swapSquare`/`lockBingoCard`/`getDraftCard`/`getCardForSession`; **freeze RESOLVED square defs (not seed-only)**; export/import inclusion (`DbSnapshot`/`snapshot()`/`importSnapshot()` + core `data-safety` envelope bump `SCHEMA_VERSION` 2 to 3, `MIGRATIONS[2]`, `bulkPut` by stable `cardId`); reactive app-side lock-on-Start-Show effect.
**Uses:** Dexie 4.4 additive-migration pattern (proven 4x in `db.ts`).
**Avoids:** Pitfalls 5, 10, 11 (freeze/reshuffle, artifact drift, migration corruption).
**Exit tests:** defs byte-identical pre/post lock; reshuffle rejected on active session; card unchanged after a config/app update; populated-v4 to v5 upgrade preserves all prior tables; export to import round-trip with schema-version field.

### Phase B3: Build UX + live-marking + celebrations
**Rationale:** With the contract + table frozen, the app-side surface can proceed (and overlap internally). This is where the two P1 anti-boredom pillars ship.
**Delivers:** `useBingoCard()` hook; GizzGames tab wiring (`ROUTES` + `BottomTabBar` + `App.tsx`); build UX (**Deal + vibe + reshuffle + tap-to-swap + live expected-fill meter** — pillar #1); live-marking surface with **"one away" near-miss surfacing** (pillar #2) + per-square stamp + "what lit it"; first-line/blackout supernova (reuse bloom); "Catch me up" via the shipped `diffLatestAgainstTrail` + `adoptSuggestion`; shareable result card; GizzDex replay.
**Uses:** motion 12, `ExploreBackground` bloom, `shareCard.ts` canvas, `searchCatalog`, `useReducedMotion` — all installed.
**Avoids:** Pitfalls 6, 8, 9, 12, 13 (late-join, celebration fatigue, reduced-motion, old-iPhone perf, dead/empty card).
**Exit tests:** join-at-8 equals logged-all-15 fixture; reduced-motion equals static stamps, no supernova, on oldest iPhone; at most 2 big moments/show; no blank/dead-board path (auto-deal + manual fallback).

### Phase Ordering Rationale
- **Both gates precede all bingo work** — dependency and trust, not tidiness (Pitfalls 4, 7).
- **Pure core before persistence before UI** mirrors the v1.0 "freeze the artifact, then model + UI proceed in parallel" pattern; marking correctness is locked headless where it is cheapest.
- **Near-miss + build agency are inside the launch phase (B3), not a later polish pass** — Feature research treats both as table stakes.

### Research Flags

Phases likely needing deeper planning research:
- **GATE 2 / Phase B1 (calibration):** MEDIUM confidence — exact mix weights, `specificityRank` ordering, and `freeIndex` are the Monte-Carlo output, ASSUMED until it runs. `jamVehicleSongIds` must be promoted from a fragile name-substring script to a curated committed id list. "neverCaught" prior-sightings semantics (exclude the active session, `deriveRecap` trick) need confirming so replay reproduces marks.
- **Phase B3 celebrations:** MEDIUM — celebration-trigger design must fire on derived-win-state *transitions* in view-local state (marks are non-sticky under edits), not a stored "celebrated" flag.

Phases with standard/established patterns (skip research-phase):
- **Phase B2 persistence** — additive `version(N)` migration + export inclusion is proven 4x in `db.ts`; mechanical.
- **Tab wiring** — three mechanical edits against a `flex-1` 4-tab bar.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against real `package.json` + reuse-target source; zero new deps means zero new version-resolution risk. |
| Features | MEDIUM-HIGH | Digital-bingo / second-screen UX patterns from multiple sources; all corpus/design decisions pre-vetted (HIGH). |
| Architecture | HIGH | Every integration point is a concrete file/line in shipped v1.0/v1.1 source. |
| Pitfalls | HIGH/MEDIUM | HIGH for architecture-fit + inherited iOS pitfalls; MEDIUM for exact calibration thresholds (gated on the Monte-Carlo). |

**Overall confidence:** HIGH for how to build it; the one genuine unknown (exact card recipe numbers) is deliberately deferred to the calibration gate rather than guessed.

### Gaps to Address
- **Calibration constants** (mix weights, `specificityRank`, `freeIndex`, `bustOutGapShows`): resolve by running the Monte-Carlo gate before locking `config.bingo`. Do not eyeball.
- **`jamVehicleSongIds`**: curate to committed song ids at authoring time (name-substring matching is fragile).
- **Segue reconciliation**: requirements must formally drop segue from the v1 auto-mark catalog and record re-adding it as future scope (needs `transitionKind` capture).
- **"neverCaught" prior-set semantics**: confirm the exact prior-sightings definition (exclude active session) so live and replay marks agree.
- **Celebration transitions**: confirm the derived-win-state-transition trigger design (view-local, per-session reset) in the B3 plan.

## Sources

### Primary (HIGH confidence)
- Shipped v1.0/v1.1 source read 2026-07-19 — `packages/core/src/{dex,live,model,domain,config}`, `packages/app/src/db/db.ts`, `.../show/{useShowSession,ShowView,scoring}`, `.../dex/{shareCard,ShareCardSheet,useDexStats}`, `.../explore/ExploreBackground`, `.../routing/useHashRoute`, `.../components/BottomTabBar`, `package.json`
- `.planning/notes/gizz-bingo-design-vetting.md` — the vetted design + empirical corpus (241 shows, median 15, dead events, 4x4, consume-once, freeze-at-Start)
- `.planning/notes/v1.2-scope-triage.md` — Tier-1 bug list + "bugs first, then Bingo" + Monte-Carlo gate
- `.planning/research/PITFALLS.md` (v1.0) — inherited iOS/PWA/live-sync pitfalls

### Secondary (MEDIUM confidence)
- Auto-daub-reduces-engagement + sports second-screen "real-time sync is engaging, lag is boring" — LiveScore, Emory Wheel, Match Bingo, Sideline Sports, Galaxy4Games, GammaStack (feature-landscape framing for the two anti-boredom pillars)

### Feature-scoped research files
- `.planning/research/v1.2/STACK.md` + `FEATURES.md` + `ARCHITECTURE.md` + `PITFALLS.md`

---
*Research synthesized: 2026-07-19*
*Feature: Gizz Bingo (v1.2) — ready for requirements + roadmap*
