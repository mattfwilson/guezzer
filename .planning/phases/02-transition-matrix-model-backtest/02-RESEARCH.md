# Phase 2: Transition Matrix, Model & Backtest - Research

**Researched:** 2026-07-08
**Domain:** Markov-style sequence prediction, language-model smoothing/backoff, walk-forward evaluation — all in pure TypeScript `packages/core`
**Confidence:** HIGH (methodology + corpus grounding); numeric seeds are ASSUMED-and-backtest-tunable by design (D-16)

## Summary

This is a **methodology + arithmetic** phase, not a library-integration phase. There is **no new external dependency to install** — the model is a first-order Markov transition matrix with classic language-model smoothing (Jelinek-Mercer linear interpolation) and a stack of inspectable multiplicative modifiers, all hand-written over the already-normalized corpus. The architecture is fully locked by CONTEXT.md (D-01…D-17); the planner's real work is (a) resolving a small number of genuine methodology subtleties that the decisions leave open, and (b) seeding numeric constants that the backtest will later tune.

I read the actual Phase 1 code and the real 738-show / 264-song corpus. Everything below is grounded in that data. The corpus is **sparse**: 65.1% of the 2,987 distinct directed within-set edges occur exactly once, 32 songs have been played only once ever, and the median song has 17 lifetime plays. Sparsity is the dominant modeling fact and it justifies every smoothing/backoff decision — a raw MLE transition probability is zero for the overwhelming majority of plausible next-songs, so the interpolated backoff floor (D-02) is load-bearing, not decorative. The holdout tour (D-12) resolves cleanly to **tour 65 "2025 Phantom Island Australia Tour", 9 shows, 2025-12-02…2025-12-13, contributing 154 within-set eval transitions (36 hard-segue, 118 free-choice)**.

**Primary recommendation:** Build the model as a single pure `score(matrix, context, config, toggles)` function whose factors are each an individually-neutralizable multiplier, with the D-02 backoff blend computed as a convex (weights-sum-to-1) Jelinek-Mercer interpolation over four per-tier distributions that are each normalized over the same candidate universe. This one design simultaneously satisfies the multiplicative-pipeline decision (D-01), the no-hard-zeros requirement (MODL-08), and makes leave-one-signal-out ablation (D-14) a matter of flipping a flag rather than forking code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Matrix construction (as-of cutoff, decay, edge counts) | Core / build-time CLI | — | Pure derivation over `NormalizedCorpus`; emits frozen JSON artifact (D-08/D-09) |
| Prediction scoring | Core (pure fn) | — | Zero I/O; consumes matrix + in-progress context; feeds Phase 4 UI later |
| Backtest + ablation | Core / Node CLI | — | EVAL-03 zero browser deps; reads committed corpus, writes paired .md/.json report |
| Config constants | Core `config.ts` | — | MODL-11 single source of truth; also the ablation-variant source |
| Report rendering (.md/.json) | Core CLI wrapper | — | Mirrors `cli/run-census.ts` precedent (D-15) |

All capabilities sit in one tier (pure core). There is **no browser/server/DB tier in this phase** — that is structurally guaranteed by the `packages/core` tsconfig (`lib: ES2023`, no DOM, no React dep). The tier map is deliberately trivial; its value here is confirming that nothing in Phase 2 belongs anywhere else.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.4.3 (already installed) | Validate/parse the tuning-tags file and any schema-versioned artifact header | Already the project's validation tool (Phase 1); reuse for the `TransitionMatrix` header + tuning-tags load |
| Vitest | 4.1.10 (already installed) | Unit tests on fixture setlists (D-17/EVAL-05) | Established Phase 1 test runner; `node` environment already configured |
| Node.js | ≥24.12 (native TS execution) | Run the build-model + backtest CLIs with no build step | Established Phase 1 pattern; verified working this session (ran corpus analysis via `node`) |

### Supporting
**None.** No math/stats/Markov library is warranted. The entire model is elementary arithmetic (counts, ratios, `Math.exp`, `Math.pow`, weighted sums, a sort). Pulling in a stats or ML package would violate the "inspectable, deterministic" constraint and add slopcheck surface for zero benefit.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written interpolation | An npm smoothing/NLP library | Rejected — the blend is four multiply-adds; a dependency adds risk and opacity, and no library matches this exact 4-tier setlist-specific backoff |
| `Math.exp` decay | A time-series/decay library | Rejected — one-line exponential; a library obscures the single most determinism-sensitive computation in the phase |

**Installation:** No new packages. `zod` and `vitest` are already present from Phase 1.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All code is written against the existing `@guezzer/core` toolchain (zod 4.4.3, vitest 4.1.10, Node-native TS), all vetted in Phase 1. No `npm install` occurs in any planned task. If the planner discovers a genuine need for a new package, it MUST trigger the Package Legitimacy Gate before adding it; nothing in this research recommends one.

## Architecture Patterns

### System Architecture Diagram

```
                          data/normalized/corpus.json  (NormalizedCorpus — Phase 1 output, sole input)
                                        │
                                        ▼
            ┌──────────────────────────────────────────────────────┐
            │  buildMatrix(corpus, asOf, config)                    │
            │  • filter shows: (date,showOrder) ≤ asOf  (D-09)      │
            │  • drop excluded settypes + placeholder/sentinel      │
            │  • for each set, walk position-adjacent pairs ONLY    │
            │    within the same set (D-07 boundary exclusion)      │
            │  • per edge accumulate: count, weightedCount(decay),  │
            │    segueCount   (A.transitionKind==="segue")          │
            └──────────────────────────────────────────────────────┘
                                        │
                         TransitionMatrix { nodes[], edges[] }  (D-08 frozen artifact)
                          ├──────────────────────────────┐
                          ▼                               ▼
     ┌────────────────────────────────┐    (Phase 7) constellation renderer
     │ predict(matrix, context, cfg,  │     reads nodes/edges.count directly
     │         toggles)               │
     │  in-mem index: from → edges    │
     │  ┌──────────────────────────┐  │
     │  │ base = Σ wᵢ · tierᵢ(A,B) │  │  ← D-02 Jelinek-Mercer interpolation
     │  │  t1 transitionProb        │  │     (each tier normalized over candidates)
     │  │  t2 tuningAffinity        │  │
     │  │  t3 albumEra affinity     │  │
     │  │  t4 basePlayRate (floor)  │  │
     │  └──────────────────────────┘  │
     │  score = base × decayToggle    │  ← D-01 multiplicative pipeline
     │        × rotationSuppression   │
     │        × alreadyPlayed         │
     │        × eraPrior              │
     │  then hard-segue override/boost│  ← D-04 consistency-gated, applied on top
     │  → ranked candidates w/ reason │  ← D-06 rich per-candidate breakdown
     └────────────────────────────────┘
                          │
                          ▼
     ┌────────────────────────────────────────────────────────────┐
     │ backtest(corpus, config)                                    │
     │  • holdout = tour containing latest show date (D-12)        │
     │  • for each held-out show S in (date,showOrder) order:      │
     │      matrix_S = buildMatrix(corpus, asOf = just-before S)   │
     │      walk within-set transitions A→B of S, predict, score   │
     │      hit@k, split hard-segue vs free-choice (D-13)          │
     │  • ablation: re-run with each signal toggled off (D-14)     │
     └────────────────────────────────────────────────────────────┘
                          │
                          ▼
             paired backtest-report.md + backtest.json  (D-15, mirrors census)
```

### Recommended Project Structure
Consistent with the existing `packages/core/src` layout (Claude's discretion per CONTEXT.md). Suggested — the planner may adjust:
```
packages/core/src/
├── config.ts                 # EXTEND with all Phase 2 constants (D-16)
├── domain/types.ts           # ADD TransitionMatrix, MatrixNode, MatrixEdge,
│                             #   PredictionCandidate, BacktestResult types
├── model/
│   ├── matrix.ts             # buildMatrix(corpus, asOf, config) → TransitionMatrix (pure)
│   ├── decay.ts              # exponential weightedCount helper (pure)
│   ├── predict.ts            # predict(matrix, context, config, toggles) (pure)
│   └── index-build.ts        # from→edges in-memory index (D-08 loader)
├── eval/
│   ├── backtest.ts           # walk-forward + metrics + ablation (pure)
│   └── holdout.ts            # identify most-recent-complete-tour (pure)
├── cli/
│   ├── build-model.ts        # thin: corpus → matrix.json (mirrors normalize-corpus.ts)
│   └── run-backtest.ts       # thin: corpus → backtest.md + backtest.json (mirrors run-census.ts)
└── index.ts                  # export new domain types + pure fns (anti-corruption boundary preserved)
```

### Pattern 1: Jelinek-Mercer linear interpolation for the D-02 backoff base
**What:** The base factor is a convex combination of four tier distributions, weights summing to 1. This is textbook linear-interpolation smoothing (Jelinek-Mercer): `[CITED: Jurafsky & Martin, *Speech and Language Processing*, ch. "N-gram Language Models", interpolation & backoff]`. Because tier 4 (`basePlayRate`) is nonzero for every catalog song, an unseen pair still receives a positive floor — this is precisely MODL-08's "never a hard zero for a plausible song."
**When to use:** As the `base` in D-01's pipeline, replacing a raw MLE `P(next|current)`.
**Critical subtlety (flag for planner):** For the weights `w1…w4` to have stable, comparable meaning, **each tier must be normalized to a distribution over the same candidate universe before blending.** If tier 1 is a probability that sums to 1 over successors but tier 4 is an un-normalized play count, the weights stop meaning what D-02 says they mean and the whole blend is uncalibrated. Normalize each tier over the candidate set, then blend.
```typescript
// Source: derived from D-01/D-02 + standard Jelinek-Mercer interpolation.
// Each tierN(A, B) returns a value in [0,1], normalized so Σ_B tierN(A,B) = 1
// over the candidate universe C (all non-placeholder catalog songs).
function baseFactor(A: SongId, B: SongId, m: MatrixIndex, cfg: Config): number {
  const { w1, w2, w3, w4 } = cfg.backoffWeights;        // sum to 1
  return w1 * transitionProb(A, B, m)      // MLE over weightedCount edges out of A
       + w2 * tuningAffinity(A, B, m)      // family-conditioned successor rate (D-03: backoff only)
       + w3 * albumEraAffinity(A, B, m)    // same-album/era pair affinity
       + w4 * basePlayRate(B, m);          // all-time marginal — the nonzero floor
}
```

### Pattern 2: Multiplicative modifier pipeline with per-signal toggles (D-01 + D-14)
**What:** Every downstream signal is a multiplier defaulting to 1.0 when its toggle is off, so ablation is a flag flip, not a code fork. One code path scores the full model and every ablation variant.
```typescript
// Source: derived from D-01 (multiplicative), D-14 (leave-one-out ablation).
interface SignalToggles {   // all default true; backtest flips one false per ablation run
  decay: boolean; rotation: boolean; alreadyPlayed: boolean;
  eraPrior: boolean; hardSegue: boolean;
  tuning: boolean; albumEra: boolean;        // backoff tiers toggled by re-normalizing weights
}
function scoreCandidate(A, B, m, cfg, t: SignalToggles, ctx: ShowContext): Scored {
  const base = baseFactor(A, B, m, cfg, t);          // decay off → use raw count edges
  let s = base;
  s *= t.rotation      ? rotationSuppression(B, ctx, cfg) : 1;
  s *= t.alreadyPlayed ? alreadyPlayedFactor(B, ctx, cfg) : 1;
  s *= t.eraPrior      ? eraPrior(B, m, cfg)              : 1;
  const seg = t.hardSegue ? hardSegueOverride(A, B, m, cfg) : null;  // may pin/boost
  return applyOverride(s, seg, cfg);                 // reason string assembled here (D-06)
}
```

### Anti-Patterns to Avoid
- **Reading `transitionKind` as an in-transition.** `Performance.transitionKind` is derived from that performance's own `transition_id` and describes the transition **out of** this song into the next within-set performance (kglw.net/phish.net convention: `"A > B"` stores `>` on A's row). Edge `A→B` is a hard segue **iff `A.transitionKind === "segue"`.** Getting this backwards silently inverts the entire hard-segue signal. Verified against `normalize.test.ts` Fixture F/H and rr1010 data[0] ("Mars For the Rich", position 1, `transition_id: 2` → segue into position 2).
- **Identifying the holdout tour by max `tourId`.** `tourId` is **not** chronologically monotonic (verified: tour 57 starts 2025-05-18 but tour 58 starts 2024-11-01). Identify the holdout by the tour that **contains the show with the latest date** (D-12), never by max id.
- **`date ≤ cutoff` as the walk-forward split.** Two shows can share a date (`showOrder` disambiguates — verified in 2013 corpus). A date-only cutoff would leak a same-date show into its own prediction. Use a **strict `(date, showOrder)` tuple bound.**
- **Bridging edges across a placeholder.** 28 placeholder performances exist; 45 adjacent pairs touch one. A placeholder ("Unknown" sentinel) occupies a real position slot but is not a real song. Do not emit an edge into or out of a placeholder, and do not bridge `A → placeholder → C` into an `A→C` edge — the true intervening song is unknown, so any bridged edge is fabricated.
- **Hard-zeros anywhere.** MODL-08/MODL-10 forbid them. Already-played and rotation are strong *fractional* multipliers, never 0. 107 of 738 shows contain a repeated song — a hard-zero would mispredict every sandwich/reprise.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Corpus parsing / validation | A second raw-row parser | The Phase 1 `NormalizedCorpus` via `index.ts` exports only | Anti-corruption boundary; raw kglw.net fields must never re-enter |
| Paired .md + .json report | A new report harness | Mirror `cli/run-census.ts` (`formatReport`, `mkdir`+`writeFile`, `escapeMarkdownExcerpt`) | Proven precedent (D-15); consistent ergonomics; markdown-escaping already solved |
| Tuning family lookup | A new tuning classifier | `data/tuning-tags.json` via `tuningTagsFileSchema` / `TuningFamily` | Owner-curated file already exists; D-03 says backoff-tier only |
| CLI arg/date validation | Ad-hoc parsing | Extend the Phase 1 bounded-integer/allowlist pattern (`cliYearMin/Max`) | Security V5 — validate before path/URL construction (established convention) |

**Key insight:** Phase 1 already built every I/O, validation, and reporting primitive this phase needs. Phase 2 is almost entirely *new pure functions over existing types* plus config constants — the only genuinely novel machinery is the scoring math itself.

## Model Methodology — Resolved Design Questions

This is the core of the research: the non-obvious decisions the locked CONTEXT.md leaves to planning. Every numeric value below is a **seed**, flagged `[ASSUMED]`, to be justified or overridden by the backtest (D-16).

### M1. Interpolated backoff smoothing (D-02) — tier definitions + weight seeds
Define each tier as a distribution over the candidate universe `C` (all non-placeholder catalog songs), normalized to sum to 1 over `C`:
- **t1 `transitionProb(A,B)`** = `weightedCount(A→B) / Σ_x weightedCount(A→x)` (raw `count` when decay toggled off). MLE first-order transition (MODL-03).
- **t2 `tuningAffinity(A,B)`** = successor frequency of `B` among all within-set successors of songs sharing `A`'s tuning family, normalized. D-03: contributes **only** here.
- **t3 `albumEraAffinity(A,B)`** = pair affinity when `A` and `B` are from the same album/era cluster; normalized. (Operational "era" definition below in M8.)
- **t4 `basePlayRate(B)`** = `playCount(B) / Σ playCount` — the all-time marginal; the nonzero floor guaranteeing MODL-08.

**Seed weights `[ASSUMED]`:** `w1=0.60, w2=0.20, w3=0.15, w4=0.05` (sum 1.0). Justification: t1 is the primary signal (MODL-03) but the corpus is 65% singleton edges, so lower tiers must carry real mass or unseen-but-plausible pairs collapse. A denser corpus would push weight toward t1; the backtest will find the true split. When a backoff tier is ablated off (D-14), **re-normalize the remaining weights to sum to 1** so the blend stays a valid interpolation.
**Additive floor inside t1:** apply add-α (Laplace/Lidstone) smoothing to the t1 numerator, seed `α=0.0` initially (interpolation already supplies the floor via t4) — expose `transitionAddAlpha` in config as a backtest knob. `[CITED: Jurafsky & Martin — add-k/Lidstone smoothing]`

### M2. Recency decay (D-10) — exponential half-life relative to cutoff
For each observed instance of edge `A→B` at show date `d`, its decayed weight is `exp(-ln2 · ageDays / halfLifeDays)` where `ageDays = (asOfCutoff − d)` in days. `weightedCount(A→B) = Σ` over instances. **Half-life is measured from the matrix's own as-of cutoff, never wall-clock `now`** (D-10) — so a backtest matrix built as-of 2025-06-01 decays correctly for that date.
**Seed `[ASSUMED]`:** `decayHalfLifeDays = 365`. Justification: MODL-04 wants "current + previous tour dominate." The band plays ~50–70 shows/year (verified: 2022:70, 2023:57, 2024:64, 2025:50). A 1-year half-life makes a transition from exactly one year before the cutoff count 0.5 and two years 0.25 — recent tours dominate while the deep catalog retains a faint but nonzero voice. Shorter (~180d) sharpens rotation focus; the backtest decides.
**Storage:** each edge stores `count` (raw int) **and** `weightedCount` (float). The shipped artifact bakes `weightedCount` at `cutoff = latest`; backtest matrices recompute it per cutoff. The constellation (Phase 7) uses raw `count` for edge thickness (D-10).

### M3. Rotation suppression (MODL-06) vs already-played (D-05) — two distinct multipliers
These are different signals and must not be conflated:
- **Already-played (D-05)** conditions on the **in-progress current show**: if `B` already appears in the trail so far, multiply by `alreadyPlayedFactor`. **Seed `[ASSUMED]` `alreadyPlayedFactor = 0.02`** (near-zero, not zero). Justification: repeats occur in ~14% of shows (107/738) but are rare per song; a strong penalty is right, a hard-zero would miss every sandwich. Apply once per candidate (flag), not per prior occurrence.
- **Rotation suppression (MODL-06)** conditions on **recent prior shows of the current tour**: `rotationSuppression(B) = rotationPenaltyPerShow ^ (number of the last N shows in which B was played)`. **Seeds `[ASSUMED]`: `rotationWindowShows = 3`, `rotationPenaltyPerShow = 0.5`** → a song played in all 3 recent nights scores ×0.125, "approaching hard exclusion" in a multi-night run (MODL-06) without ever hitting zero. In a same-venue run the backtest may push the penalty lower.

### M4. Hard-segue consistency gating (D-04)
`segueRate(A→B) = segueCount(A→B) / totalExits(A)`, where `segueCount(A→B)` = adjacent within-set pairs `(A,B)` with `A.transitionKind === "segue"`, and `totalExits(A)` = all adjacent within-set pairs with `A` first (any successor). This denominator answers "when `A` is played, how reliably does it segue into `B`" — the reliability D-04 wants.
- **Gate:** override to a near-1.0 ceiling only if `segueRate ≥ hardSegueConsistencyThreshold` **AND** `totalExits(A) ≥ hardSegueMinSupport` (prevents a single 1/1 from pinning false certainty).
- **Seeds `[ASSUMED]`:** `hardSegueConsistencyThreshold = 0.70`, `hardSegueMinSupport = 3`, `hardSegueOverrideCeiling = 0.97` (near-1.0 but never literally 1.0 — honors "only notated hard segues reach 100%" while staying honest), `hardSegueBoost = 3.0` (multiplier for inconsistent/one-off segues that fail the gate — a strong boost, not an override).
- **Reason string (D-06):** compute from the stored counts, e.g. `"notated segue 14/15 times since 2024"`. This requires `segueCount`, `totalExits`, and a date; **store `firstDate`/`lastDate` per edge** (cheap) so the "since YYYY" clause is available and the constellation can label edges. Corpus check: 31.3% of all within-set transitions carry `A.transitionKind === "segue"`, so this signal is dense enough to matter.

### M5. Walk-forward backtest (D-12) — leak-free split
1. **Holdout:** `holdout.ts` finds the show with max `(date, showOrder)`, reads its `tourId` (skip `tourIdSentinel = 1`), and groups all shows with that `tourId`. Verified result: **tour 65, 9 shows, 2025-12-02…2025-12-13.**
2. **Per held-out show S** (processed in `(date, showOrder)` order): build `matrix_S = buildMatrix(corpus, asOf = strictly-before S)`. "Train = everything strictly prior, including that tour's earlier nights" (D-12) — the as-of bound must be the exclusive tuple `(S.date, S.showOrder)`, so tour 65's own earlier nights ARE in training (this is what genuinely exercises rotation suppression, MODL-06). **This refines D-09's `date ≤ cutoff`:** the builder needs an *exclusive* `(date, showOrder)` bound for walk-forward, not just `date ≤ cutoff`. Recommend `buildMatrix` accept an `asOf: { date, showOrder, inclusive }` predicate.
3. **Within S**, walk each within-set adjacent transition `A→B`. The "current context" = `A` plus the in-progress trail (all songs before `A` in `S`) — legitimately known, because live it already happened. Predict ranked candidates, record whether `B` ∈ top-k.
4. **No leakage:** matrix strictly precedes S; rotation window pulls only prior nights (in training). Cold-start check: **0 songs in the holdout were never seen before the tour started** — the deep-catalog debut case (STAT-04) is not exercised by this holdout, so the backtest will not measure debut handling (note for honest reporting).

### M6. Ablation mechanics (D-14)
Run the full backtest once, then re-run once per signal with that signal's toggle off, reporting each variant's top-1/5/10 (overall + split) and the **delta vs. full**. "Off" semantics per signal: `decay` → use raw `count`; `rotation`/`alreadyPlayed`/`eraPrior` → multiplier = 1; `hardSegue` → no override/boost; backoff tiers (`tuning`/`albumEra`) → drop the tier and re-normalize remaining weights. Report-only; **no automated go/no-go gate in Phase 2** (D-14). Single scoring code path (Pattern 2) means every variant is byte-identical logic with one flag flipped.

### M7. Metrics (D-13)
- **top-k hit rate** = (eval transitions where true `B` ∈ top-k ranked candidates) / (total eval transitions), for k ∈ {1,5,10}.
- **Split criterion:** an eval transition is **hard-segue** iff the *actual* transition was notated (`A.transitionKind === "segue"`), else **free-choice**. Report both subsets. Corpus: holdout has 36 hard-segue + 118 free-choice = 154 eval transitions. Hard-segue top-k should be near-ceiling if the override works; free-choice is the honest trust metric (and the EVAL-04 threshold input for Phase 4).
- **Eval-target exclusions:** skip transitions where `B` is a placeholder (can't predict "Unknown"); set-openers are already excluded (no within-set predecessor); single-song sets contribute nothing (50 exist).
- **Candidate list size:** the predictor must return ≥10 scored candidates for top-10. **Seed `[ASSUMED]` `candidateListSize = 15`** (backtest needs ≥10; Phase 4 UI shows 5–8). Return all scored if cheaper; 264 songs is trivial to rank fully.

### M8. Era-prior definition (Claude's discretion, MODL-07) — avoid double-counting
**Landmine:** "era" appears twice — as backoff tier t3 (`albumEraAffinity`, a *pairwise* A–B similarity) and as the top-level `eraPrior` multiplier (a *marginal* property of B). They must measure different things or they double-count.
**Recommendation:** define `eraPrior(B)` as a **relative** multiplier centered near 1, not an absolute probability: `eraPrior(B) = clamp( smooth(eraRate(B)) / smooth(allTimeRate(B)), floor, ceil )`, where `eraRate(B)` = B's play rate within a trailing era window and `allTimeRate(B)` = t4's marginal. This makes `eraPrior` a clean "is B hot **right now** relative to its career" boost (>1 for current rotation, <1 for retired songs) that is orthogonal to t4's absolute marginal — no double-count.
**Seeds `[ASSUMED]`:** `eraWindowShows = 40` (≈ the last ~2 tours; verified tour sizes 9–24), `eraPriorSmoothingK = 1`, `eraPriorFloor = 0.3`, `eraPriorCeil = 2.0`. Define the era window relative to the matrix cutoff (last 40 shows before `asOf`), keeping it leak-safe in the backtest.

## Runtime State Inventory

Not applicable — this is a greenfield additive phase (new pure functions + new config keys + new committed artifact/report files). No rename, refactor, migration, or string replacement. No stored data, live service, OS registration, secret, or build artifact carries a value this phase changes. Verified: the only writes are new files (`data/normalized/transition-matrix.json` or similar, `data/backtest-report.md`, `data/backtest.json`) and additive edits to `config.ts`, `domain/types.ts`, `index.ts`.

## Common Pitfalls

### Pitfall 1: Segue direction inverted
**What goes wrong:** Treating `B.transitionKind` (or the successor's kind) as the A→B segue signal.
**Why it happens:** Intuition says "the transition into B lives on B." kglw.net stores it on A.
**How to avoid:** Edge `A→B` is a hard segue iff `A.transitionKind === "segue"`. Add a fixture assertion (reuse `2017-segues` / `2025-segue-chain`, which already assert segue-kind on the *earlier* position).
**Warning signs:** Hard-segue top-1 hit rate near random instead of near-ceiling.

### Pitfall 2: Non-deterministic / non-diffable artifact
**What goes wrong:** Float summation order or unstable sort makes `transition-matrix.json` and `backtest.json` churn on every rebuild, defeating the "diffable across model changes" goal (D-15).
**Why it happens:** `Map` iteration order, `Array.sort` instability on ties, IEEE-754 summation order.
**How to avoid:** (a) Accumulate `weightedCount` by iterating instances in a fixed sorted order (by `date`, `showOrder`, `position`). (b) **Round `weightedCount` to a fixed precision** (e.g. 1e-9) before serialization. (c) Sort nodes/edges by stable keys (`songId`, then `from,to`). (d) Rank candidates by score desc with a **deterministic tie-break**: `playCount` desc, then `songId` asc. Assert byte-stability in a test (mirrors the tuning-tags "survives regeneration byte-for-byte" test, Pitfall 6 in Phase 1).
**Warning signs:** `git diff` on the artifact after a no-op rebuild.

### Pitfall 3: Holdout identified by tourId, or split by date only
**What goes wrong:** Wrong holdout, or same-date leakage.
**How to avoid:** Holdout by latest-date's tour (M5); walk-forward by exclusive `(date, showOrder)` tuple. Both verified as real hazards in this corpus.
**Warning signs:** Holdout tour that isn't the Dec-2025 Phantom Island run; suspiciously high top-1 on the first held-out night.

### Pitfall 4: Uncalibrated backoff blend
**What goes wrong:** Tiers not normalized to the same universe before weighting, so `w1…w4` don't mean what D-02 says and ablation deltas are noise.
**How to avoid:** Normalize each tier over the candidate set, then blend (Pattern 1). Unit-test that each tier sums to ~1 over `C`.
**Warning signs:** basePlayRate dominating despite `w4=0.05`, or ablation deltas that don't move monotonically with weight.

### Pitfall 5: Era double-counting
**What goes wrong:** `albumEraAffinity` (t3) and `eraPrior` both reward "B plays a lot lately," compounding.
**How to avoid:** Make `eraPrior` a *relative* multiplier centered at 1 (M8), distinct from t3's pairwise affinity and t4's absolute marginal.
**Warning signs:** Retired songs vanish entirely; current-rotation songs pin the top ranks regardless of `A`.

## Code Examples

### Exponential decay weight (determinism-critical)
```typescript
// Source: derived from D-10 (half-life relative to as-of cutoff, not wall-clock).
const MS_PER_DAY = 86_400_000;
function decayedWeight(showDate: string, asOfDate: string, halfLifeDays: number): number {
  const ageDays = (Date.parse(asOfDate) - Date.parse(showDate)) / MS_PER_DAY;
  return Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
}
// weightedCount(A→B) = instances (sorted by date,showOrder,position).reduce((s,i)=>s+decayedWeight(...),0)
// round to fixed precision before serialization for a diffable artifact.
```

### Holdout identification (tourId is NOT chronological)
```typescript
// Source: verified against data/normalized/corpus.json this session.
function findHoldoutShows(corpus: NormalizedCorpus, tourIdSentinel: number): NormalizedShow[] {
  const latest = corpus.shows.reduce((m, s) =>
    s.date > m.date || (s.date === m.date && s.showOrder > m.showOrder) ? s : m, corpus.shows[0]);
  const tourId = latest.tourId; // 65 "2025 Phantom Island Australia Tour"
  if (tourId === tourIdSentinel) throw new Error(`Latest show is a one-off (tour ${tourIdSentinel}); no complete-tour holdout.`);
  return corpus.shows.filter((s) => s.tourId === tourId); // 9 shows, 2025-12-02..2025-12-13
}
```

### Within-set edge emission (boundary exclusion D-07, placeholder-safe)
```typescript
// Source: derived from D-07 + D-08 + sentinel handling; verified pair counts this session.
for (const set of show.sets) {                 // NEVER across sets/encore (D-07)
  const p = set.performances;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (a.isPlaceholder || b.isPlaceholder) continue;   // don't bridge Unknown (45 such pairs corpus-wide)
    const e = edgeFor(a.songId, b.songId);
    e.count += 1;
    e.weightedCount += decayedWeight(show.date, asOf, cfg.decayHalfLifeDays);
    if (a.transitionKind === "segue") e.segueCount += 1; // A's OUT-transition (Pitfall 1)
    e.lastDate = show.date; e.firstDate ??= show.date;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Held-out random split | Walk-forward / time-series CV | Long-standing best practice for temporal data | Random splits leak future→past; walk-forward mirrors live use (D-12) |
| Katz back-off (discount + redistribute) | Linear interpolation (Jelinek-Mercer) | Both classic; interpolation is simpler + differentiable in weights | Interpolation chosen (D-02) for inspectability and easy ablation |

**Deprecated/outdated:** none relevant. These are stable, decades-old techniques; no library-version currency risk applies. `[CITED: Jurafsky & Martin, *Speech and Language Processing*, N-gram LM chapter]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backoff weight seeds `w1=.60, w2=.20, w3=.15, w4=.05` | M1 | Low — backtest tunes; wrong seed only shifts starting accuracy, not correctness |
| A2 | `decayHalfLifeDays = 365` | M2 | Low — tunable; affects recency sharpness only |
| A3 | `alreadyPlayedFactor = 0.02` | M3 | Low-Med — too high → repeats over-predicted; near-zero is safe, tunable |
| A4 | `rotationWindowShows = 3`, `rotationPenaltyPerShow = 0.5` | M3 | Low — tunable; MODL-06 wording ("1–3 shows") supports this range |
| A5 | Hard-segue: threshold 0.70, minSupport 3, ceiling 0.97, boost 3.0 | M4 | Med — threshold/ceiling govern the "only segues reach ~100%" invariant; validate on fixtures + backtest split |
| A6 | Era-prior: relative multiplier, window 40 shows, clamp [0.3, 2.0] | M8 | Med — "current era" is genuinely undefined in requirements; this is a proposed operational definition needing owner/backtest confirmation |
| A7 | `candidateListSize = 15` | M7 | Low — must be ≥10 for top-10; otherwise free |
| A8 | Denominator for `segueRate` = all of A's within-set exits (not segue-exits only) | M4 | Med — changes which pairs cross the gate; both readings defensible, this matches D-04 wording "share of A's within-set exits" |
| A9 | Interpolation (Jelinek-Mercer) is the intended smoothing family | M1 | Low — D-02 explicitly says "interpolated smoothing… weighted blend of all tiers" |

## Open Questions

1. **Era's two roles (t3 affinity vs top-level eraPrior).**
   - What we know: D-01 lists `eraPrior` as a top-level multiplier; D-02 lists `albumEra` as backoff tier t3; MODL-07 (prior) and MODL-08 (backoff) are distinct requirements.
   - What's unclear: exact operational boundary so they don't double-count.
   - Recommendation: adopt M8 (t3 = pairwise same-album/era affinity; eraPrior = relative marginal boost centered at 1). Flag `[ASSUMED]` A6 for owner confirmation during planning/discussion.

2. **`segueRate` denominator (A8).**
   - What we know: D-04 says "share of song A's within-set exits are a notated segue into B."
   - What's unclear: exits = all successors, or only segue-notated successors.
   - Recommendation: all exits (matches wording); keep it a config-swappable helper so the alternative is a one-line change if the hard-segue split underperforms.

3. **Debut/cold-start not exercised by this holdout.**
   - What we know: 0 holdout songs are catalog-new; 32 songs are lifetime-singletons but none debut in tour 65.
   - What's unclear: nothing to resolve in Phase 2 — just report honestly that the backtest does not measure debut handling (STAT-04 is Phase 6).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js native TS execution | build-model + backtest CLIs (no build step) | ✓ | ≥24.12 (ran `node` corpus analysis this session) | tsx (already a listed fallback) |
| pnpm workspace | monorepo core package | ✓ | established Phase 1 | npm workspaces |
| Vitest 4.1.10 | unit tests | ✓ | installed | — |
| zod 4.4.3 | artifact/tuning-tags validation | ✓ | installed | — |
| `data/normalized/corpus.json` | sole model input | ✓ | schemaVersion 1, 738 shows / 264 songs, latest 2025-12-13 | none — hard dependency (present) |
| `data/tuning-tags.json` | backoff tuning tier | ✓ | schemaVersion 1 | none — hard dependency (present) |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none. All inputs verified present this session.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`node` environment for core, via `test.projects`) |
| Config file | `vitest.config.ts` (root; `test.projects: ['packages/*']`) |
| Quick run command | `pnpm test` (or `npx vitest run packages/core`) |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-05 | Set-boundary/encore transitions excluded from edges | unit | `npx vitest run packages/core -t "boundary exclusion"` | ❌ Wave 0 (`model/matrix.test.ts`); fixture `2013-encore` / `2022-rr1010-multiset` exist |
| MODL-01 | Serializable frozen-schema matrix artifact | unit | `... -t "matrix schema"` | ❌ Wave 0 |
| MODL-02 | As-of cutoff filters shows (leak prevention) | unit | `... -t "as-of cutoff"` | ❌ Wave 0 |
| MODL-03 | First-order P(next\|current) core signal | unit | `... -t "transitionProb"` | ❌ Wave 0 |
| MODL-04 | Exponential decay, current+prev tour dominate | unit | `... -t "decay half-life"` | ❌ Wave 0 |
| MODL-05 | Hard-segue override at high confidence | unit | `... -t "hard segue override"` | ❌ Wave 0; fixture `2017-segues` / `2025-segue-chain` exist |
| MODL-06 | Rotation suppression over recent tour shows | unit | `... -t "rotation suppression"` | ❌ Wave 0 |
| MODL-07 | Era prior smoothing | unit | `... -t "era prior"` | ❌ Wave 0 |
| MODL-08 | Backoff never hard-zero / never 100% except segue | unit | `... -t "backoff floor"` | ❌ Wave 0 |
| MODL-09 | Tuning family only in backoff tier | unit | `... -t "tuning backoff only"` | ❌ Wave 0 |
| MODL-10 | Already-played → near-zero, sandwich-aware | unit | `... -t "already played"` | ❌ Wave 0; fixture `2025-sandwich` exists |
| MODL-11 | All constants in config.ts | unit/lint | `... -t "config constants"` | ❌ Wave 0 |
| EVAL-01 | Holdout + top-1/5/10 overall + split | unit | `... -t "backtest metrics"` | ❌ Wave 0 |
| EVAL-02 | Per-signal ablation deltas | unit | `... -t "ablation"` | ❌ Wave 0 |
| EVAL-03 | Backtest runs Node CLI, zero browser deps | structural | tsconfig `lib: ES2023` (compile-enforced) + CLI smoke | ✓ enforced |
| EVAL-05 | Fixture setlists, known expected outputs | unit | `pnpm test` | ❌ Wave 0 (partial — fixtures exist, scoring tests new) |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core` (fast; node env, no browser).
- **Per wave merge:** `pnpm test` (full core suite).
- **Phase gate:** full suite green + `run-backtest` CLI produces a report before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/test/model/matrix.test.ts` — DATA-05, MODL-01/02/04 (reuse `2013-encore`, `2022-rr1010-multiset` fixtures for boundary; add a tiny 2-cutoff fixture for as-of leak-safety)
- [ ] `packages/core/test/model/predict.test.ts` — MODL-03/05/06/07/08/09/10 (reuse `2025-sandwich` for already-played, `2017-segues`/`2025-segue-chain` for hard-segue)
- [ ] `packages/core/test/eval/backtest.test.ts` — EVAL-01/02 (small synthetic multi-tour fixture with a known holdout + hand-computed top-k)
- [ ] `packages/core/test/fixtures/` — 1–2 **new synthetic scoring fixtures** with hand-computed expected scores (existing fixtures are normalize-oriented; scoring needs known-output setlists per D-17)
- [ ] Determinism test — matrix + backtest.json byte-stable across rebuilds (Pitfall 2)
- Framework install: none — Vitest already configured.

## Security Domain

`security_enforcement: true`, ASVS level 1, block_on high. This phase is **pure offline build-time computation** — no auth, session, network, crypto, or runtime user input. Attack surface is minimal but two controls apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts/auth anywhere in project |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Local CLI, single owner |
| V5 Input Validation | yes | CLI args (e.g. `--cutoff` date) validated before path/use, mirroring Phase 1 `cliYearMin/Max` bounded-integer + allowlist convention; corpus already zod-validated at the Phase 1 boundary |
| V6 Cryptography | no | No secrets/crypto in scope |
| V12/V5 Output encoding (report) | yes | Backtest `.md` embeds song names / reason strings; **reuse `escapeMarkdownExcerpt`** from `run-census.ts` when writing any editor-sourced text to markdown (defense-in-depth; markdown viewers render embedded HTML) |

### Known Threat Patterns for pure-core build tooling

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via CLI-supplied output path | Tampering | Output paths come from `config.ts` constants, not user input; if a `--out` flag is added, validate/normalize against an allowed dir (Phase 1 pattern) |
| Untrusted prose injected into rendered `.md` | Tampering (stored) | Escape with `escapeMarkdownExcerpt`; song names are catalog data (lower risk than `shownotes`), but reason strings that interpolate names should still be escaped on write |
| Malformed/adversarial corpus crashing the build | DoS | Corpus is a committed, zod-validated Phase 1 artifact; the builder should still fail loudly (Phase 1 error-message convention) rather than emit a corrupt matrix |

No high-severity ASVS-L1 findings block this phase.

## Sources

### Primary (HIGH confidence)
- `packages/core/src/domain/types.ts`, `config.ts`, `ingest/normalize.ts`, `ingest/tuning-tags.ts`, `cli/run-census.ts`, `test/normalize.test.ts` — read this session; the concrete contracts, segue semantics, report precedent, and fixture pattern the plan depends on.
- `data/normalized/corpus.json` — analyzed this session via `node` (738 shows / 264 songs; holdout = tour 65, 9 shows; 65.1% singleton edges; 31.3% segue transitions; 107 sandwich shows; tourId non-monotonic; 0 cold-start holdout songs).
- `docs/SCHEMA.md` §4/§6/§11 — transition_id → segue mapping, Unknown sentinel, tour_id sentinel.
- `.planning/phases/02-.../02-CONTEXT.md` — locked decisions D-01…D-17.
- `.planning/REQUIREMENTS.md` — DATA-05, MODL-01…11, EVAL-01/02/03/05 authoritative text.

### Secondary (MEDIUM confidence)
- Jelinek-Mercer interpolation, add-k/Lidstone smoothing, walk-forward temporal validation, top-k hit rate — `[CITED: Jurafsky & Martin, *Speech and Language Processing*, N-gram Language Models chapter]`. Stable, decades-old; training knowledge cross-checked against the standard reference. Not version-sensitive.

### Tertiary (LOW confidence)
- None. No unverified web claims were relied upon; no new package recommended.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; existing toolchain verified installed and running.
- Architecture / methodology: HIGH — grounded in the actual code + real corpus counts; the locked decisions map cleanly onto standard smoothing/backoff/walk-forward techniques.
- Numeric seeds: intentionally ASSUMED (backtest-tunable per D-16) — these are starting points, not claims of optimality.
- Pitfalls: HIGH — every pitfall (segue direction, tourId non-monotonicity, same-date leakage, placeholder bridging, determinism) is verified against the real data or the real Phase 1 code, not hypothesized.

**Research date:** 2026-07-08
**Valid until:** 2026-08-07 (stable domain; no fast-moving dependency). Re-verify only if the corpus is refreshed (holdout tour and edge counts would shift) or Phase 1 types change.
