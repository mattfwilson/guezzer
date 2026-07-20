# Phase 14: Gizz Bingo — Core Marking & Generation - Research

**Researched:** 2026-07-19
**Domain:** Pure-TS deterministic derivation over a setlist trail — a seeded card generator + consume-once marking fold + a Monte-Carlo calibration CLI, all headless in `packages/core`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

> The phase already carries 26 LOCKED decisions (D-01..D-26). These are NOT re-litigated. Copied verbatim below so the planner honors them exactly. Everything in the technical sections that follows is subordinate to these.

### Locked Decisions

**Vibes & win-rate calibration targets (locked to per-vibe config constants this phase)**
- **D-01:** Vibes shift **both** the square mix **and** the winnability targets — not one or the other.
- **D-02:** Per-vibe **line** targets over a median 15-song show — **Chill ~82%**, **Balanced ~70%**, **Glory-hunter ~50%**. Line = the common reward; blackout = the rare crown.
- **D-03:** Per-vibe **blackout** targets — **Balanced ~2–5%**, **Glory-hunter ~5–10%** (roughly double Balanced). Chill blackout stays rare (not a Chill goal).
- **D-04:** **Glory-hunter** mix leans into bust-out + never-caught + rarer album/song squares — deliberately high-variance risk/reward. The vibe pick is a real gamble.
- **D-05:** **Dark-square floor: ≥20%** per-night fire-rate for **reliable event squares** (album, microtonal, opener, marathon-jam). Kills the "dark all night" failure. (Glory squares exempt — D-15.)
- **D-06:** The **free center square counts as marked** for line/X/four-corners geometry. `freeIndex` is a **locked config constant** — on an even 4×4 grid it sits at one of the 4 inner cells; lines/diagonals through it need only their other 3 squares.

**Consume-once marking & tie-break (documented in config, pinned by the property test)**
- **D-07:** Marking is a **greedy fold in setlist play-order** — each logged song marks its single best unmarked square the moment it's logged. NOT a globally-optimal re-solve. Makes `live == replay == catch-up` hold trivially. Calibration accounts for any slight under-fill.
- **D-08:** When a song qualifies for several unmarked squares, **rarest / most-specific wins.** Full specificity rank (highest priority first): **specific song square > never-caught (personal glory) > bust-out (global glory) > common event (album / microtonal / opener / marathon-jam).**
- **D-09:** **Personal glory outranks global glory** — a song that is both a corpus bust-out AND your personal never-caught lights the **never-caught** square first.
- **D-10:** Final deterministic fallback when two squares are exactly equally specific: **lowest board index (top-left first).**
- **D-11:** Consume-once is structural: one logged song → at most one mark; 15 logged songs → never more than 15 marks. Fixture-test a song satisfying 3 squares marks exactly one.

**"Never caught" personal-glory square**
- **D-12:** **Resolved and frozen at card lock.** At Start Show, snapshot the caught-songs set and freeze "never-caught = any song NOT in that set" into the card's resolved defs. A song caught for the first time *tonight* still counts as never-caught. Matches Phase-15 freeze-resolved-defs.
- **D-13:** **Always dealt (subject to vibe weight, D-14); scales naturally.** First show → empty dex → near-certain. No first-show special-casing; calibration treats a thin dex as an edge.
- **D-14:** **Vibe-weighted, not guaranteed** — a mix weight like other event types: Glory-hunter leans in (possibly >1), Balanced sometimes, Chill rarely.

**Dark-floor scope for glory squares**
- **D-15:** The ≥20% floor (D-05) applies to **reliable event squares only.** Glory squares (**bust-out ~21%, never-caught**) are **exempt** — governed by vibe mix-weights + a per-card cap, not a fire-rate floor. Without this exemption Glory-hunter cannot exist.

**Curated rosters (live in config — no scattered magic numbers)**
- **D-16:** **Jam-vehicle roster** (~20 songs, ~95% fire, name-substring hand-tag — no duration data exists): **corpus-measured, then user-reviewed before it locks.** → Process gate (D-20).
- **D-17:** **Album-membership roster: broad pool for variety** — the measured ≥53% set (Infest the Rats' Nest 80%, Omnium Gatherum 80%, PetroDragonic 60%, Ice/Death/Planets… 59%, Flying Microtonal Banana 53%, I'm in Your Mind Fuzz 53%) **plus** lower-fire albums that still clear the ≥20% floor.
- **D-18:** **Album-square count per card is owned by calibration** — a per-vibe mix weight the Monte-Carlo tunes within the fill targets and ≥20% floor. No hardcoded cap.

**Calibration gate enforcement**
- **D-19:** The Monte-Carlo CLI does **report + hard assertion.** (a) prints the per-vibe report — P(line)/P(blackout)/dark-square share/expected marks over the 241-show corpus; AND (b) asserts hard invariants (≥20% floor on reliable squares, per-vibe target bands D-02/D-03, no dark-all-night square) and **exits non-zero if violated.** The Bingo equivalent of the backtest gate.
- **D-20 (process):** Because the jam-vehicle + album rosters are user-reviewed before lock, the GATE-2 calibration task must **surface the candidate rosters for the user's sign-off BEFORE writing constants to `config.ts`.** Plan: generate candidate rosters → user review checkpoint → run Monte-Carlo → lock constants. Do not auto-write config in one pass.

**Generator seed & determinism**
- **D-21:** The generator uses an **explicit string seed**; `deal(seed, vibe, dexSnapshot, corpusVersion)` is a **pure function** — same inputs → byte-identical card. No card-sharing plumbing in v1. Shared seeds will not produce fully identical cards across friends (never-caught is personal) — leaderboard comparability is future work (GAME-V1.3-01).

**Core/app trail boundary**
- **D-22:** The pure core fold **defines its own minimal trail-input contract** — song id + play-order index (opener = index 0). The app adapts its `TrackedEntry` rows → this contract. `TrackedEntry` (in `packages/app/src/db/db.ts`) is **NOT** imported into core.

**Locked upstream (from prior research — NOT re-litigated here)**
- **D-23:** Card is **4×4 (15 fillable + free center)**; marks are **DERIVED, never stored**; single deterministic `deriveMarks` fold pinned by a `live == replay == catch-up` property test.
- **D-24:** Auto-mark catalog: **opener + microtonal + marathon-jam + bust-out + never-caught + album-membership + song squares.** **"Segue" EXCLUDED** (not trail-derivable — `TrackedEntry` is song-level, no transition metadata). Covers/encore/Set-2 stay dropped.
- **D-25:** Song-square seeding uses **base-rate recent-era frequency, NOT the transition predictor.**
- **D-26:** Win conditions on 4×4: **line / four-corners / X / blackout** — all achievable.

### Claude's Discretion
- Exact module file split within `core/bingo/` (`types` / `context` / `generate` / `mark` / `wins`), the `BingoCard` serializable JSON field shape, the **concrete PRNG behind the string seed**, and the **precise numeric constants** the Monte-Carlo lands on (within D-02/D-03/D-05 targets) — all Claude's discretion, subject to the tests and the gate.
- `bustOutGapShows` starts from the vetting's ≥50-show gap (~21% fire) and is re-confirmed by the corpus scripts before locking.

### Deferred Ideas (OUT OF SCOPE)
- **Segue square** — excluded from v1 (not trail-derivable). Future: enrich `TrackedEntry` with `transitionKind`, or mark opportunistically from `latest`.
- **Shared-seed leaderboard / cross-friend comparable cards** — GAME-V1.3-01. Needs the backend the project refuses.
- **Pre-2020 replay cards** re-enabling cover / encore / Set-2 squares.
- All UI, Dexie persistence, lock-on-Start-Show, export/import, catch-up, GizzDex replay (Phase 15), the GizzGames tab, Deal/vibe/swap build UX, celebrations, share card (Phase 16). **No new dependencies, no new build-time data artifact.**
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BINGO-03 | The locked card auto-marks itself (deterministic consume-once) as the show's setlist is logged — live in the GizzGames tab, with no manual daubing required. | This phase delivers the pure-core substrate BINGO-03 sits on: the `deriveMarks` consume-once fold (§2), the seeded `deal` generator (§1), the `BingoContext` resolver, `detectWins`, config constants, and the calibration gate that proves cards are winnable (§3). The *tab wiring* / live surface of BINGO-03 is Phase 16; this phase makes the mark-derivation correct and headless-provable first. The `live == replay == catch-up` property test (§5) is the exit criterion that guarantees the "auto-marks itself" behavior is deterministic across live/replay/catch-up code paths. |
</phase_requirements>

## Summary

This is an **internal-domain phase**: almost every input is already-shipped source, and the four canonical research artifacts (`v1.2/{SUMMARY,ARCHITECTURE,PITFALLS,STACK}.md`) plus the design-vetting note already resolve the design into concrete signatures. There is **exactly one genuinely external technical decision** — the seedable PRNG behind the string seed (D-21) — and it resolves to a canonical, public-domain, zero-dependency snippet. Everything else is a matter of faithfully implementing the locked decisions against the existing `deriveDex` / `deriveTally` fold patterns and the existing `run-backtest.ts` CLI-gate pattern.

The load-bearing correctness insight (stated identically by ARCHITECTURE and PITFALLS) is that marking must be **one pure deterministic fold** — `deriveMarks(card, trail, ctx, caughtSnapshot)` — computed left-to-right in ascending play-order over the *full* trail, with consume-once enforced structurally and a *total* tie-break (specificity rank D-08 → lowest board index D-10). Because it is one pure function of the sorted trail, `live == replay == catch-up` holds trivially — the property test asserts this rather than reconciling two code paths.

The calibration gate (`core/cli/bingo-calibrate.ts`) is the Bingo equivalent of the Phase-2 backtest trust gate: replay all 241 recent-era shows (`corpus.json`, `year >= 2022`) through the **real** `deriveMarks` fold across many seeded cards per vibe, report P(line)/P(blackout)/dark-square-share/expected-marks, and hard-assert the D-02/D-03/D-05 invariants with a non-zero exit on violation. The D-20 process constraint splits this into two tasks with a human checkpoint between them: generate candidate rosters → **user sign-off** → run Monte-Carlo → lock constants.

**Primary recommendation:** Implement `core/bingo/{types,context,generate,mark,wins}.ts` + `core/cli/bingo-calibrate.ts` modeled cell-for-cell on `dex/derive-dex.ts` (fold), `dex/rarity.ts` (index/context build), and `cli/run-backtest.ts` (report+gate CLI). Use **xmur3 (string→seed) + mulberry32 (32-bit PRNG)** for D-21. Freeze the JSON contract and `config.bingo` shape in the first task; sequence roster-candidates → checkpoint → Monte-Carlo lock per D-20.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Seeded card generation (`deal`) | `core/bingo/generate.ts` (pure) | — | Deterministic, DOM-free; app owns only the seed *value* (randomness/clock), core is pure `f(seed,vibe,ctx,dexSnapshot)` (D-21, Anti-Pattern 3) |
| Consume-once marking (`deriveMarks`) | `core/bingo/mark.ts` (pure) | — | Third derivation over the trail, sibling to `deriveDex`/`deriveTally` (D-07/D-23) |
| Artifact → lookup resolution (`buildBingoContext`) | `core/bingo/context.ts` (pure) | — | Resolves shipped `matrix`/`archive`/`rarity`/`dex-albums` into fast Maps; no I/O, no new artifact |
| Win geometry (`detectWins`) | `core/bingo/wins.ts` (pure) | — | 4×4 line/corners/X/blackout is pure grid math (D-26) |
| Calibration + gate (Monte-Carlo) | `core/cli/bingo-calibrate.ts` (Node) | reads `data/normalized/*` | Build-time only, never in browser; report+assert like `run-backtest.ts` (D-19) |
| Locked constants | `packages/core/src/config.ts` (`bingo` section) | — | Single-config-file rule (CLAUDE.md); calibration output lands here (D-05/D-08/D-16/D-17/D-18/D-21) |
| Trail adaptation (`TrackedEntry` → core contract) | `packages/app` | — | **Phase 16, NOT this phase.** Core defines the minimal contract; app adapts (D-22) |
| cardId / uuid, persistence, lock | `packages/app` | — | **Phase 15/16, NOT this phase.** `packages/app/src/uuid.ts` exists app-side; core `deal` never mints ids |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| *(none new)* | — | — | **Zero new dependencies is a locked constraint** (CONTEXT out-of-scope + CLAUDE.md). Every input already ships. `[VERIFIED: codebase — no bingo deps needed]` |

### Supporting (already installed, reused)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.10 | Test runner, `@guezzer/core` project runs under `node` env | All fold/generator/gate tests `[VERIFIED: vitest.config.ts]` |
| zod | 4.4.3 | `BingoCard` strict schema (forward-compat for Phase-15 import validation) | Define `bingoCard` zod `strictObject` in `types.ts` alongside the TS type, mirroring `tuning-tags.ts` / `archive-types.ts` `[CITED: packages/core/src/ingest/tuning-tags.ts]` |
| Node.js | ≥24.12 | Native `.ts` execution of `bingo-calibrate.ts` (no build step, no tsx) | The CLI runs `node packages/core/src/cli/bingo-calibrate.ts` `[CITED: CLAUDE.md Development Tools]` |

### PRNG (hand-rolled in core — the one Claude's-discretion technical choice, D-21)

**Recommendation: xmur3 (string→32-bit seed) + mulberry32 (32-bit-state PRNG).** Both are canonical, public-domain, dependency-free, pure functions using only `Math.imul` + bit ops (all ES2015/ES2023-lib safe, fully erasable syntax — no `enum`/`namespace`/`class`). `[CITED: github.com/bryc/code/blob/master/jshash/PRNGs.md]`

```typescript
// core/bingo/prng.ts (or inline in generate.ts)
// Source: bryc/code PRNGs.md (public domain). ES2023-lib safe, erasable-syntax-only.

/** Hash a string into a stream of 32-bit seeds (MurmurHash3 mixing). */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** 32-bit-state PRNG → float in [0,1). Simplest high-quality option. */
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

**Deriving the stream from `deal`'s inputs (D-21):** compose the seed string so vibe and corpus version scope the determinism, then hash:

```typescript
// same string seed + same vibe + same corpusVersion → byte-identical card
const seedStr = `${seed} ${vibe} ${corpusVersion}`;
const seedGen = xmur3(seedStr);
const rand = mulberry32(seedGen());   // rand() → [0,1)
```

**Exact algorithm the planner should specify:** `xmur3(seedStr)` produces the 32-bit seed; feed *one* output into `mulberry32`. Use `rand()` for every random choice in the deal (which event/album/song squares to place, shuffle of board positions). Never call `Math.random()` or `Date.now()` anywhere in core (Anti-Pattern 3).

**Alternatives Considered**
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mulberry32 | **sfc32** (needs 4 xmur3 outputs as state) | Higher statistical quality / 128-bit state. Overkill for dealing 16 squares; mulberry32's 32-bit state is more than enough here and is a single variable. Switch only if a distribution test ever flags mulberry32 bias (it won't at this scale). |
| Hand-rolled | an npm PRNG (`seedrandom`, `pure-rand`) | Violates the zero-new-dependency constraint and adds a slopcheck/supply-chain surface for ~12 lines of public-domain code. Reject. |

**Installation:** none. `[VERIFIED: codebase]`

## Package Legitimacy Audit

> **N/A — this phase installs no external packages.** Zero-new-dependencies is a locked constraint (CONTEXT out-of-scope; CLAUDE.md "What NOT to Use" + STACK.md "install nothing"). The only non-project code is the ~12-line public-domain xmur3/mulberry32 snippet, copied inline into core with a source comment — not an npm install. slopcheck / registry verification is therefore not applicable. If any plan proposes a dependency, that plan contradicts a locked constraint and must be rejected.

## Architecture Patterns

### System Architecture Diagram

```
                    (build-time, Node CLI — GATE 2)
  data/normalized/corpus.json ──filter year>=2022──► 241 recent-era shows
          │                                                  │
          │                                                  ▼
          │                                    ┌──────────────────────────┐
  matrix / archive / rarity /                  │  bingo-calibrate.ts       │
  dex-albums artifacts ──────► buildBingoContext ──►  for vibe in 3:       │
                                     │              for card in N seeds:   │
                                     │                deal(seed,vibe,ctx)  │
                                     ▼                for show in 241:     │
                              ┌─────────────┐           deriveMarks(...)   │
                              │ BingoContext│           detectWins(...)    │
                              │  eraPlayRate│         aggregate P(line),   │
                              │  microtonal │         P(blackout), dark%,  │
                              │  corpusGap  │         expected-marks/vibe  │
                              │  albumSongs │              │               │
                              │  jamVehicle │              ▼               │
                              └─────────────┘      report + HARD ASSERT    │
                                     │             (D-02/D-03/D-05)        │
                                     │             exit(1) on violation ───┘
                                     │
      ┌──────────────────────────────┼───────────────────────────────┐
      │ RUNTIME derivation path (headless-testable this phase)         │
      │                                                               │
      │  deal(seed,vibe,ctx,dexSnapshot,corpusVersion) ─► BingoCard   │
      │     (16 square DEFS, 1 free @ freeIndex, resolved+serializable)│
      │                         │                                     │
      │  trail: [{songId,position,isPlaceholder}]  (D-22 contract)    │
      │  caughtSnapshot: Set<songId>  (frozen prior sightings, D-12)  │
      │                         ▼                                     │
      │  deriveMarks(card, trail, ctx, caughtSnapshot) ─► MarkedCard  │
      │     consume-once greedy, ascending position,                  │
      │     specificityRank (D-08) → lowest index (D-10)              │
      │                         ▼                                     │
      │  detectWins(markedCard) ─► Win[]  (line/corners/X/blackout)   │
      └──────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
packages/core/src/
├── bingo/
│   ├── types.ts       # BingoCard/BingoSquareDef/MarkedCard/Win + zod schema + BingoVibe/BingoEvent unions
│   ├── prng.ts        # xmur3 + mulberry32 (or inline in generate.ts)
│   ├── context.ts     # buildBingoContext(matrix,archive,rarity,albums,cfg) -> BingoContext
│   ├── generate.ts    # deal(seed,vibe,ctx,dexSnapshot,corpusVersion,cfg) -> BingoCard
│   ├── mark.ts        # deriveMarks(card,trail,ctx,caughtSnapshot,cfg) -> MarkedCard
│   └── wins.ts        # detectWins(marked) -> Win[]  + expectedFill(...) helper
├── cli/
│   └── bingo-calibrate.ts   # Monte-Carlo report + hard-assert gate (models run-backtest.ts)
├── config.ts          # + `bingo:` section (all locked constants)
└── index.ts           # + bingo barrel exports
```

### Pattern 1: Third pure derivation over the trail (the load-bearing one)
**What:** Marking is a pure `deriveMarks(card, trail, ctx, caught)` recomputed reactively — a sibling of `deriveDex` (`packages/core/src/dex/derive-dex.ts`) and `deriveTally` (`packages/app/src/show/scoring.ts`).
**When to use:** Always here (locked D-07/D-23).
**Model it on:** `deriveDex` — same shape: pure module, one exported top-level fn, `Map`-keyed accumulation, `config` injected with a default param, zero I/O, no Dexie/DOM types. `deriveDex`'s caught-song accumulation (its `acc` Map of sightings) is literally the input to never-caught (D-12).

```typescript
// Source: packages/core/src/dex/derive-dex.ts (sibling fold shape to mirror)
export function deriveDex(snapshot, archive, albums, rarity, cfg = config): DexStats { ... }
// deriveMarks follows the identical signature discipline:
export function deriveMarks(
  card: BingoCard,
  trail: ReadonlyArray<{ songId: number | null; position: number; isPlaceholder: boolean }>,
  ctx: BingoContext,
  caughtSnapshot: ReadonlySet<number>,   // frozen prior sightings (D-12/D-22)
  cfg: typeof config = config,
): MarkedCard { ... }
```

### Pattern 2: Naming — `deriveMarks` over ARCHITECTURE's `markCard`
ARCHITECTURE.md drafted the fn as `markCard`. **Recommend `deriveMarks`** to match (a) the BINGO-03 requirement text and the `live==replay==catch-up` property-test name, and (b) the sibling-derivation naming (`deriveTally`, `deriveDex`, `deriveRecap`, `deriveConstellation`, `deriveTopOpeners`). The ARCHITECTURE *signature* is otherwise authoritative; only the name changes. Export both types + the fn from `core/index.ts`. `[ASSUMED — naming, low risk]`

### Pattern 3: CLI report+gate mirrors `run-backtest.ts`
**What:** `bingo-calibrate.ts` is a thin Node wrapper: read committed artifacts, run the pure sim, write `data/bingo-calibration.json` + `data/bingo-calibration-report.md`, print the report, `exit(1)` on any hard-assertion failure.
**Model it on:** `cli/run-backtest.ts` verbatim — `sections: string[]` joined with blank lines + trailing newline, `escapeMarkdownExcerpt` for any catalog-sourced song name embedded in the report (song names are a rendering surface in markdown viewers — T-01-03/T-02-10 precedent), `isMain` guard, `--out`/`--json-out` flags, `process.exit(1)` in the catch.

### Pattern 4: Reuse shipped artifacts, add zero pipelines
Every generator/marker input already ships and is precached — the biggest architecture finding:

| Bingo need | Source (already shipped) | Field |
|------------|--------------------------|-------|
| song-square base rate (D-25) | `TransitionMatrix.nodes` | `MatrixNode.eraPlayCount` `[VERIFIED: domain/types.ts]` |
| microtonal predicate | `TransitionMatrix.nodes` | `MatrixNode.tuningFamily === "microtonal"` `[VERIFIED: domain/types.ts]` |
| bust-out predicate | `RarityIndex` (`buildRarityIndex(archive)`) | `SongRarity.corpusGap >= config.bingo.bustOutGapShows` `[VERIFIED: dex/rarity.ts]` |
| album-membership squares | `dex-albums.json` (`DexAlbumsArtifact.albums[].tracks[].songId`) | album_url → Set<songId> `[VERIFIED: dex/albums.ts]` |
| never-caught (personal) | dex caught set (from `deriveDex` acc / a `Set<songId>` snapshot) | songId ∉ frozen caught snapshot `[VERIFIED: dex/derive-dex.ts]` |

### `BingoCard` serializable JSON shape (frozen resolved defs)
Follows the "clean serializable plain-JSON + frozen header" convention (`schemaVersion` literal, string-literal unions never enums). **One change from ARCHITECTURE.md: `seed` is `string`, not `number`** — D-21 locks an *explicit string seed*.

```typescript
export type BingoWinKind = "line" | "corners" | "x" | "blackout";
export type BingoVibe = "chill" | "balanced" | "glory";
export type BingoEvent = "opener" | "microtonal" | "marathonJam" | "bustOut" | "neverCaught";
// NOTE: no "segue" (D-24 — not trail-derivable). No covers/encore/set-2.

export type BingoSquareDef =
  | { kind: "free" }
  | { kind: "song"; songId: number; label: string }
  | { kind: "album"; albumUrl: string; label: string }
  | { kind: "event"; event: BingoEvent; label: string };

export interface BingoCard {
  schemaVersion: 1;
  seed: string;            // D-21 explicit string seed (reshuffle = new string)
  vibe: BingoVibe;
  corpusVersion: string;   // scopes determinism to a corpus (from corpus.generatedAt or a version tag)
  freeIndex: number;       // locked config constant, one of {5,6,9,10}
  squares: BingoSquareDef[];  // length 16, row-major, exactly one {kind:"free"} at freeIndex
}
```

**cardId / sessionId / generatedAt / lockedAt are Phase-15 persistence fields** — do NOT add them to the core `deal` output this phase (core is DOM/DB-free and mints no ids). The Phase-15 Dexie row wraps this `BingoCard` with those fields. Freezing the *never-caught caught-set* into the card row is likewise Phase 15 (D-12); this phase's `deriveMarks` accepts `caughtSnapshot` as an explicit param so the resolver signature is ready now (per code_context Integration Points).

### Anti-Patterns to Avoid (from PITFALLS.md, this-phase-relevant subset)
- **`Math.random()`/`Date.now()` inside `deal`** → breaks determinism + core purity. App owns the seed value; core is pure (Anti-Pattern 3).
- **Marking every square a song qualifies for** → 1 song = 3 marks → false blackout. Consume-once structurally (Anti-Pattern 5 / D-11).
- **Tie-break falling through to `Object.keys()`/`Set` iteration order** → live≠replay. Use the *total* order specificityRank → lowest index (Pitfall 1).
- **Regenerating square defs from seed at read time** → a corpus refresh silently reshuffles a locked card. Freeze *resolved* defs (Anti-Pattern 4). (Enforced in Phase 15 persistence; this phase makes `deal` output self-contained resolved defs.)
- **Importing `TrackedEntry` into core** → violates D-22 + core purity. Core defines its own minimal `{songId, position, isPlaceholder}` contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String→seed hashing | A custom `hashCode` loop | **xmur3** (canonical MurmurHash3 mixer) | Well-distributed, avalanche-tested; ad-hoc hashes cluster and produce visibly biased deals |
| Seeded PRNG | A LCG you invent | **mulberry32** (public domain) | Passes gjrand/PractRand at this scale; a naive `(seed*9301+49297)%233280` LCG has visible short-period artifacts |
| Album→song membership | Re-parse `albums.json` | `dex-albums.json` via `context.ts` | Already derived, deduped, sentinel-filtered by `deriveDexAlbums` (D-17) |
| bust-out gap computation | Re-scan corpus timeline | `buildRarityIndex(archive)` → `corpusGap` | Already computed as shows-after-last-play `[VERIFIED: dex/rarity.ts]` |
| Rarity/base-rate | Recompute play counts | `MatrixNode.playCount`/`eraPlayCount` | Baked into the frozen matrix at build time |
| Markdown-report escaping | Inline `.replace` | Reuse `escapeMarkdownExcerpt` idiom from `run-backtest.ts` | Consistent T-01-03 XSS-in-report mitigation |

**Key insight:** The only new *logic* in this phase is the fold + generator + gate. The only new *data* is `config.bingo` constants. Every substrate already exists — building a second pipeline would violate CLAUDE.md's single-pipeline rule and the zero-new-artifact constraint.

## The consume-once marking fold — concrete spec (objective #3)

**Signature** (mirrors `deriveDex`; uses the D-22 minimal contract):
```typescript
deriveMarks(card, trail, ctx, caughtSnapshot, cfg = config): MarkedCard
```

**Algorithm** (order-stable, pure — from ARCHITECTURE §2, reconciled to the LOCKED D-08/D-09/D-10 tie-break):
```
marked = card.squares.map((def, index) => ({ def, index, markedByPosition: null }))
marked[card.freeIndex].markedByPosition = FREE_SENTINEL      // D-06: free pre-marked

for entry in trail SORTED BY position ASCENDING:             // (1) stable order
  if entry.isPlaceholder or entry.songId == null: continue   // (2) ??? consumes no square (see note)

  qualifying = marked.filter(sq =>
      sq.markedByPosition == null &&
      squareMatches(sq.def, entry.songId, entry.position, ctx, caughtSnapshot))
  if qualifying.length === 0: continue

  winner = argmin over qualifying of ( specificityRank(sq.def, ctx), sq.index )   // (3) D-08 then D-10
  winner.markedByPosition = entry.position                   // consume BOTH the song and the square

return { squares: marked, markedCount: count(markedByPosition != null) }
```

**`specificityRank` (LOCKED by D-08/D-09 — lower wins; store in `config.bingo.specificityRank`):**
```
song            → 0    // specific-song square (most specific)
event:neverCaught → 1  // personal glory (D-09: outranks bust-out)
event:bustOut   → 2    // global glory
event:opener    → 3  }
event:microtonal→ 3  }  // "common event" tier — all equal (D-08)
event:marathonJam→ 3 }
album           → 3  }
free            → n/a
```
Ties within a tier resolve by **lowest board index (D-10)**. This makes the order *total* → ties are impossible → live==replay is guaranteed. **Note:** this LOCKED grouping supersedes ARCHITECTURE.md's suggestion to rank `opener` last; opener is in the common tier per D-08, and D-10's index tie-break governs.

**`squareMatches` predicates** (each a pure fn of songId + position + ctx + caughtSnapshot):
- `song`: `entry.songId === def.songId`
- `album`: `ctx.albumSongIds.get(def.albumUrl)?.has(entry.songId)`
- `event:opener`: `entry.position === 0` (D-22: opener = index 0)
- `event:microtonal`: `ctx.microtonalSongIds.has(entry.songId)`
- `event:marathonJam`: `ctx.jamVehicleSongIds.has(entry.songId)`
- `event:bustOut`: `(ctx.corpusGap.get(entry.songId) ?? 0) >= cfg.bingo.bustOutGapShows`
- `event:neverCaught`: `!caughtSnapshot.has(entry.songId)` (D-12 — frozen set; a song caught for the first time tonight is NOT in the snapshot, so still matches)

**Consume-once guarantees (D-11):** each entry marks ≤1 square; each square marked by ≤1 entry. 15 song entries → ≤15 song-marks (+ free) → blackout is a genuine crown. A repeated song (sandwich/reprise) is two entries: the first consumes its best square, the second consumes a *different* still-unmarked qualifying square (or none) — never a triple-mark.

**Placeholder handling — decision needed:** the algorithm above skips `songId == null` entirely (matching `deriveDex`, which skips placeholders). This is the conservative, simplest choice and keeps rename re-derivation clean. The alternative (let a position-1 `???` mark the positional `opener` square) is defensible but adds an un-lighting-on-rename risk (Pitfall 3). **Recommend: skip null-songId entries entirely for v1**; a later rename to a real song re-derives and lights the square for free. Fixture-test both the skip and the rename-relights behavior. `[ASSUMED — placeholder policy; flag for planner]`

## Monte-Carlo calibration methodology (objective #2)

**Structure of `bingo-calibrate.ts`** (models `run-backtest.ts`):
1. Read `corpus.json`, filter `year >= 2022` → 241 shows. For each show, extract the play-ordered song list from `sets[].performances[]` (`{songId, position}`; positions are per-set — flatten to a single ascending play-order index; opener = first performance overall). `[VERIFIED: corpus.json shape — sets[].performances[].{songId,position}]`
2. Build `BingoContext` once from the committed `matrix`/`archive`/`rarity`/`dex-albums` artifacts.
3. For each `vibe ∈ {chill, balanced, glory}`, for each of **N seeded cards** (deterministic seeds `sim-${vibe}-${i}`), replay all 241 shows through the **real** `deriveMarks` + `detectWins`. Record per (card,show): line?/blackout?/corners?/X?/marks-count, and per reliable-square-type whether it fired.
4. Aggregate per vibe: **P(≥1 line)**, **P(blackout)**, **P(corners)**, **P(X)**, **expected marks (median/mean/min/max)**, **dark-square share** (fraction of shows where a given reliable square never fired → drives the D-05 floor check).
5. **Print** the per-vibe report (D-19a) and **hard-assert** (D-19b), `exit(1)` on any violation.

**How many simulated cards per vibe:** the estimand is a proportion over `241 × N` trials. Standard error ≈ `sqrt(p(1-p) / (241·N))`. For Monte-Carlo noise < ~0.3pp on P(line)/P(blackout), use **N ≈ 500–1000 cards per vibe** (≈120k–240k trials). This is trivially cheap (16 squares × ≤32 entries per trial). Start N=500; bump to 1000 for the final locking run so the report is stable across reruns. `[VERIFIED: proportion SE formula]`

**Never-caught dex assumption for the sim:** never-caught depends on a personal dex, which the corpus alone doesn't provide. D-13 says calibration treats a thin dex as an *edge*. **Recommend running the sim under two dex assumptions and reporting both:** (a) **empty dex** (first-show worst case — never-caught near-certain, the easy edge), and (b) a **mid-collection dex** (e.g. caught = union of songs from a fixed pseudo-random ~50% subset of prior corpus shows, seeded for determinism). The D-05 floor and D-02/D-03 bands must hold under the *representative* (mid-collection) assumption; the empty-dex run is reported as the first-show edge, not gated. `[ASSUMED — dex-assumption modeling; genuine open question, flag for planner + user]`

**Tuning: manual iterate-and-rerun, not an automated search.** The parameter space is small (per-vibe mix weights across ~5 event types + album-square count + song-square count, plus `bustOutGapShows`), the targets are *bands* not point objectives, and the backtest gate precedent is manual iteration. **Recommend manual iterate** — adjust `config.bingo` mix weights, rerun the CLI, read the report, repeat until green — optionally with a small coarse grid-sweep helper the CLI can print to guide the next step. Do NOT build a full optimizer; it is not warranted and adds untested surface.

**Hard-assertion gate wiring (D-19b):** after aggregation, assert and collect failures:
- Every **reliable** event/album square type's per-night fire-rate `≥ config.bingo.darkSquareFloor` (0.20, D-05). **bustOut + neverCaught are EXEMPT** (D-15).
- Per-vibe `P(line)` within `[target − tol, target + tol]` (chill 0.82 / balanced 0.70 / glory 0.50, D-02).
- Per-vibe `P(blackout)` within band (balanced 0.02–0.05 / glory 0.05–0.10, D-03; chill: rare, assert an upper bound only).
- No reliable square with dark-share == 1.0 (subsumed by the floor, but assert explicitly for a clear message).
- If `failures.length > 0`: print them, `process.exit(1)`. Else `exit(0)`.

**D-20 process — two tasks with a human checkpoint between:**
1. **Roster-candidate generation** (a `--candidates` mode of the CLI, or a sibling script): measure per-song corpus fire-rate to propose `jamVehicleSongIds` (seed from a name-substring list → resolve to song IDs → rank by measured ~fire) and the album-square pool (measured album fire-rates, ≥53% set + lower-fire albums clearing ≥20%, D-17). **Emit to a review file** (e.g. `data/bingo-roster-candidates.md/json`), **NOT** `config.ts`.
2. **`checkpoint:human-verify`** — user reviews/edits the rosters (corpus proposes, user disposes; D-16/specifics).
3. **Monte-Carlo calibration + lock** — with the approved rosters written to `config.bingo`, iterate the mix weights until the gate is green, then commit the locked constants. **Never auto-write config in one pass** (D-20).

## Config surface — new `bingo` section in `config.ts` (objective #4)

Add under the existing `explore` section (single-config-file rule). All values `[ASSUMED]` until the gate locks them (mark with the same `[ASSUMED]`/`[VERIFIED]` comment discipline the file already uses):

```typescript
bingo: {
  // paths (mirror backtestReportPath / backtestJsonPath)
  calibrationReportPath: "data/bingo-calibration-report.md",
  calibrationJsonPath: "data/bingo-calibration.json",
  rosterCandidatesPath: "data/bingo-roster-candidates.md",

  freeIndex: 5,                    // [ASSUMED] one of {5,6,9,10}; locked by the gate (Open Item 1)
  darkSquareFloor: 0.20,           // D-05 reliable-square per-night fire floor
  bustOutGapShows: 50,             // [ASSUMED] vetting ≥50 (~21% fire); re-confirm via corpus (Discretion)
  simCardsPerVibe: 500,            // Monte-Carlo N (bump to 1000 for final lock)

  // D-08/D-09/D-10 — the total tie-break order (lower wins)
  specificityRank: { song: 0, neverCaught: 1, bustOut: 2, opener: 3, microtonal: 3, marathonJam: 3, album: 3 },

  // reliable (floored) vs glory (exempt) classification (D-05/D-15)
  reliableEvents: ["opener", "microtonal", "marathonJam"],   // + album squares are reliable
  gloryEvents: ["bustOut", "neverCaught"],                    // exempt from the floor

  jamVehicleSongIds: [],           // [ASSUMED] user-reviewed roster (D-16/D-20) — locked after checkpoint
  albumSquarePool: [],             // [ASSUMED] album_urls, D-17 — locked after checkpoint

  // per-vibe mix weights (event-type + album + song square counts) — Monte-Carlo output (D-18)
  vibes: {
    chill:    { line: 0.82, blackoutMax: 0.02, mix: { /* [ASSUMED] weights */ } },
    balanced: { line: 0.70, blackout: [0.02, 0.05], mix: { /* [ASSUMED] */ } },
    glory:    { line: 0.50, blackout: [0.05, 0.10], mix: { /* [ASSUMED] */ } },
  },
},
```

**Note on album pool vs `dex.cardAlbumUrls`:** the existing `config.dex.cardAlbumUrls` (~29 album_urls) is the dex shelf; the bingo `albumSquarePool` (D-17) is a *bingo-specific* subset chosen by measured fire-rate + user review. Keep it a distinct key (do not overload the dex allowlist) so the two tune independently — same discipline the file already applies to `search` vs `dex.archiveSearch`.

**Barrel exports (`core/index.ts`):** add a bingo block (mirroring the Phase-7 explore block) exporting `deal`, `deriveMarks`, `detectWins`, `buildBingoContext`, `expectedFill`, and the types (`BingoCard`, `BingoSquareDef`, `MarkedCard`, `MarkedSquare`, `Win`, `BingoVibe`, `BingoEvent`, `BingoWinKind`, `BingoContext`). CLI internals (`cli/bingo-calibrate.ts`) stay behind the boundary — never exported (matches `run-backtest.ts`).

## Common Pitfalls

### Pitfall 1: Non-deterministic marking (live ≠ replay)
**What goes wrong:** greedy assignment over many-to-many qualification is order-dependent; a tie-break that falls through to hash/set iteration produces different cards on the live vs replay path.
**How to avoid:** ONE pure fold over the position-sorted full trail; total tie-break (specificityRank → index); the `live==replay==catch-up` property test as phase exit. `[CITED: PITFALLS.md Pitfall 1]`

### Pitfall 2: Consume-once not enforced
**What goes wrong:** "mark every square this song matches" → 1 song lights 3 squares → instant false blackout.
**How to avoid:** structural consume-once (a marked square leaves the pool; a song that marked stops matching). Fixture: one song satisfying 3 squares → exactly 1 mark; 15 songs → ≤15 marks. `[CITED: PITFALLS.md Pitfall 2 / D-11]`

### Pitfall 3: Calibrating on an approximation instead of the real fold
**What goes wrong:** the sim reimplements marking; its numbers don't match production, so the gate passes but real cards under/over-fill.
**How to avoid:** the CLI imports and calls the **same** `deriveMarks` the app uses. No forked marking logic. `[CITED: PITFALLS.md Pitfall 4]`

### Pitfall 4: Float-summation-order / iteration-order nondeterminism in the report
**What goes wrong:** map iteration or float accumulation makes `bingo-calibration.json` non-byte-stable across reruns → `git diff` review breaks.
**How to avoid:** sort all map iterations by a stable key; source `generatedAt` from `corpus.generatedAt` never wall-clock (the `run-backtest.ts` + `weightedCountPrecision` precedent). `[CITED: run-backtest.ts / config.weightedCountPrecision]`

### Pitfall 5: `seed: number` vs `seed: string` drift
**What goes wrong:** copying ARCHITECTURE.md's `seed: number` contradicts D-21's explicit *string* seed, breaking the eventual share/reproducibility semantics.
**How to avoid:** `BingoCard.seed: string`; compose `${seed} ${vibe} ${corpusVersion}` before `xmur3`. `[CITED: D-21]`

## Code Examples

### CLI gate skeleton (models run-backtest.ts)
```typescript
// core/cli/bingo-calibrate.ts — Source: pattern from packages/core/src/cli/run-backtest.ts
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { report, failures } = await runCalibrateCli(parseArgs(process.argv.slice(2)));
  console.log(report);
  if (failures.length > 0) {
    console.error(`Calibration FAILED: ${failures.length} invariant violation(s).`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);   // D-19b — un-calibrated config can never silently ship
  }
}
```

### Sibling fold shape (already in repo — mirror it)
```typescript
// Source: packages/core/src/dex/derive-dex.ts
export function deriveDex(snapshot, archive, albums, rarity, cfg = config): DexStats {
  // pure, Map-keyed accumulation, explicit sort comparators, zero I/O
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static PDF fan bingo (reeserich/king_gizz_bingo) | Live auto-marking driven by the tracker | this project | The differentiator; marking must be trust-by-design correct |
| Segue square (97% fire, in original vetting) | **Segue DROPPED** (not trail-derivable) | v1.2 SUMMARY correction | D-24 — do not implement a segue square |
| `vitest.workspace.ts` | `test.projects` in `vitest.config.ts` | Vitest 4 | Core tests run under `@guezzer/core` node project |

**Deprecated/outdated:** ARCHITECTURE.md's `markCard` name (→ `deriveMarks`) and `seed: number` (→ `string`); the vetting's segue square (dropped, D-24).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | mulberry32 (over sfc32) is sufficient PRNG quality for dealing 16 squares | Standard Stack / PRNG | Low — distribution test would catch bias; swap to sfc32 is a 4-line change |
| A2 | Placeholder (`null` songId) entries should be skipped entirely (not mark positional opener) | Marking fold | Medium — affects whether a `???`-opener lights the opener square; flag for planner decision |
| A3 | Run the sim under two dex assumptions (empty + mid-collection), gate on mid-collection | Calibration | Medium — wrong dex model skews never-caught fire-rate and P(line) for glory vibe; needs user input |
| A4 | `freeIndex`, `bustOutGapShows`, all mix weights & per-vibe bands | Config / Calibration | By-design ASSUMED — the gate's whole purpose is to lock these; not shippable until green |
| A5 | `bustOutGapShows = 50` starting value (vetting) | Config | Low — Discretion says re-confirm via corpus before locking |
| A6 | `deriveMarks` naming + `seed: string` field shape | Patterns / BingoCard | Low — internal naming/shape, no external contract yet (persistence is Phase 15) |
| A7 | N=500–1000 cards/vibe gives stable Monte-Carlo estimates | Calibration | Low — SE formula backs it; bump N if report drifts across reruns |

## Open Questions

1. **`freeIndex` on an even 4×4.** No true center; must pick one of {5,6,9,10}. Affects which diagonals/lines get the free boost. **Recommendation:** decide in the calibration step, hold constant; default 5 as a starting value. MEDIUM.
2. **Never-caught dex assumption for calibration** (A3). The sim needs a personal-dex model. **Recommendation:** report empty-dex (edge) + mid-collection (gated); confirm the mid-collection definition with the user, since it materially affects the glory-vibe numbers. MEDIUM.
3. **Placeholder policy** (A2). Skip null-songId entirely vs let it mark positional opener. **Recommendation:** skip entirely for v1; rename relights via re-derivation. Fixture-test both. LOW-MEDIUM.
4. **corpusVersion source.** Use `corpus.generatedAt` or a dedicated version tag as the `corpusVersion` component of the seed string. **Recommendation:** `corpus.generatedAt` (already a frozen field), so a corpus refresh deterministically re-scopes new deals without touching locked historical cards. LOW.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥24.12 | native `.ts` execution of `bingo-calibrate.ts` | ✓ (repo requires it) | ≥24.12 | `tsx` (already available) if Node < 24.12 |
| `data/normalized/corpus.json` | Monte-Carlo replay (241 shows year≥2022) | ✓ | schemaVersion 1, 738 shows / 241 recent | — |
| `data/normalized/transition-matrix.json` | eraPlayCount / tuningFamily | ✓ | — | — |
| `data/normalized/archive.json` | rarity index (corpusGap) | ✓ | — | — |
| `data/normalized/dex-albums.json` | album-membership squares | ✓ | schemaVersion 1 | — |
| Vitest 4 (`@guezzer/core` node project) | all headless tests | ✓ | 4.1.10 | — |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none (Node version is the only soft item, `tsx` covers it). `[VERIFIED: files present, checked 2026-07-19]`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, `@guezzer/core` project (`environment: "node"`) `[VERIFIED: vitest.config.ts]` |
| Config file | `vitest.config.ts` (root); core `root: "packages/core"`, `include: ["test/**/*.test.ts"]` |
| Quick run command | `npx vitest run --project @guezzer/core test/bingo` |
| Full suite command | `npm test` (root — `vitest run`, both projects) `[VERIFIED: package.json]` |
| Gate CLI (not a unit test) | `node packages/core/src/cli/bingo-calibrate.ts` — exit code IS the gate (D-19) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| BINGO-03 | `live == replay == catch-up` — one fold, byte-identical marks across full-trail / shuffled-then-sorted / incremental foldLeft / bulk | property/unit | `npx vitest run --project @guezzer/core test/bingo/mark.test.ts` | ❌ Wave 0 |
| BINGO-03 | consume-once: one song satisfying 3 squares → exactly 1 mark (most-specific by D-08) | unit fixture | (same file) | ❌ Wave 0 |
| BINGO-03 | 15-song fixture → ≤15 marks (never exceeds fillable count) | unit fixture | (same file) | ❌ Wave 0 |
| BINGO-03 | specificity + tie-break: never-caught > bust-out (D-09); equal-tier → lowest index (D-10) | unit fixture | (same file) | ❌ Wave 0 |
| BINGO-03 | placeholder (null songId) handled; later rename relights, never un-lights | unit fixture | (same file) | ❌ Wave 0 |
| BINGO-01 (substrate) | same-seed reproducibility: `deal` twice → deep-equal card; different seed → different card | unit | `npx vitest run --project @guezzer/core test/bingo/generate.test.ts` | ❌ Wave 0 |
| BINGO-01 (substrate) | never-blank: exactly 16 squares, exactly one `free` at `freeIndex`, no undefined | unit | (same file) | ❌ Wave 0 |
| BINGO-05 (substrate) | `detectWins`: line/corners/X/blackout geometry incl. free cell | unit | `npx vitest run --project @guezzer/core test/bingo/wins.test.ts` | ❌ Wave 0 |
| BINGO-03 (gate) | calibration gate exits 0 when green, 1 on any D-02/D-03/D-05 violation | CLI exit-code | `node packages/core/src/cli/bingo-calibrate.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project @guezzer/core test/bingo`
- **Per wave merge:** `npm test` (full both-project suite)
- **Phase gate:** full suite green **AND** `bingo-calibrate.ts` exits 0 (constants locked) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/bingo/mark.test.ts` — covers BINGO-03 (fold determinism, consume-once, tie-break, placeholder/rename)
- [ ] `test/bingo/generate.test.ts` — covers BINGO-01 substrate (reproducibility, never-blank)
- [ ] `test/bingo/wins.test.ts` — covers BINGO-05 substrate (win geometry)
- [ ] `test/bingo/context.test.ts` — `buildBingoContext` resolves artifacts into correct lookups
- [ ] `test/fixtures/bingo/synthetic.ts` — hand-authored cards + trails with known marks/wins (model on `test/fixtures/dex/synthetic.ts`)
- [ ] `test/config.test.ts` addition — assert `specificityRank` is a total order, `freeIndex ∈ {5,6,9,10}`, mix weights present per vibe
- [ ] Framework install: none — Vitest already configured

## Security Domain

> `security_enforcement: true`, ASVS level 1. This phase is pure core + a build-time CLI — no auth, session, access-control, or crypto surface. The relevant categories are narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (project constraint) |
| V3 Session Management | no | — |
| V4 Access Control | no | Personal tool, no multi-user |
| V5 Input Validation | yes (narrow) | CLI `--year`-style args already bounded via `config.cliYearMin/Max`; define a **zod `strictObject` schema for `BingoCard`** now (forward-compat: Phase 15 imports friend files — a validated card contract prevents malformed-card Dexie corruption then). Reuse `escapeMarkdownExcerpt` for song names embedded in the calibration report. |
| V6 Cryptography | no | The PRNG is **explicitly non-cryptographic** (mulberry32) — correct here; it is a game deal, never a secret. Do not reach for `crypto`. |

### Known Threat Patterns for pure-core + build CLI
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Song-name prose rendered in the markdown calibration report (GitHub/VS Code render embedded HTML) | Tampering/XSS-in-report | `escapeMarkdownExcerpt` before embedding (T-01-03/T-02-10 precedent, reuse from `run-backtest.ts`) |
| Malformed `BingoCard` corrupts Dexie / boot-loop (Phase-15 import) | Tampering | Define the zod `strictObject` card schema this phase so Phase 15 has a validated contract to reject bad cards before merge (PITFALLS Security row) |
| Non-deterministic deal seeded from a secret expectation | Info disclosure | N/A — seed is a public game string; explicitly non-crypto by design (D-21) |

## Sources

### Primary (HIGH confidence)
- Shipped source (read 2026-07-19): `packages/core/src/dex/{derive-dex,rarity,albums,archive-types}.ts`, `packages/core/src/{config,index}.ts`, `packages/core/src/domain/types.ts` (`MatrixNode.eraPlayCount`/`tuningFamily`, `SongRarity.corpusGap`), `packages/core/src/ingest/tuning-tags.ts`, `packages/core/src/cli/run-backtest.ts`, `packages/app/src/show/scoring.ts`, `vitest.config.ts`, `package.json`, `.planning/config.json`
- Corpus shape verified directly: `data/normalized/corpus.json` — `shows[].{year,sets[].performances[].{songId,position}}`, 738 shows / 241 with year≥2022
- `.planning/phases/14-.../14-CONTEXT.md` — 26 locked decisions (authoritative)
- `.planning/research/v1.2/{ARCHITECTURE,PITFALLS,SUMMARY,STACK}.md` — feature research (concrete signatures, algorithm, pitfalls)
- `.planning/notes/gizz-bingo-design-vetting.md` — empirical corpus source of truth (241 shows, fire-rates, 4×4)
- `.planning/REQUIREMENTS.md` — BINGO-03, segue-exclusion, phase-gate note

### Secondary (MEDIUM confidence)
- `github.com/bryc/code/blob/master/jshash/PRNGs.md` — canonical public-domain xmur3/mulberry32/sfc32 reference `[CITED]`
- `4rknova.com/blog/2026/03/01/mulberry32-rng`, `emanueleferonato.com/2026/01/08/...mulberry32...` — mulberry32 determinism confirmation

## Metadata

**Confidence breakdown:**
- Standard stack / PRNG: HIGH — zero-new-dep constraint; PRNG is a canonical documented snippet, verified against bryc/code.
- Architecture / fold / config surface: HIGH — every input is a concrete shipped file/field, mirroring `deriveDex`/`run-backtest.ts`.
- Calibration methodology: MEDIUM-HIGH — structure is HIGH (backtest precedent); exact numbers are ASSUMED by design (the gate's purpose); dex-assumption modeling is a genuine open question needing user input.
- Pitfalls: HIGH — grounded in the project's own v1.2 PITFALLS.md + shipped patterns.

**Research date:** 2026-07-19
**Valid until:** ~2026-08-18 (30 days — internal-domain, stable; only the corpus refresh or a dependency-policy change would invalidate)
