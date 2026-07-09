# Phase 2: Transition Matrix, Model & Backtest - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a deterministic, inspectable prediction model as a frozen JSON transition-matrix artifact, a scoring pipeline that ranks next-song candidates from that artifact, and a Node-CLI backtest with per-feature ablation that proves (or honestly disproves) the model can be trusted at a live show. Entirely in the pure `packages/core` module — zero React/DOM/browser dependencies. The `NormalizedCorpus` at `data/normalized/corpus.json` (738 shows / 264 songs, from Phase 1) is the model's sole input.

**In scope:** DATA-05, MODL-01 through MODL-11, EVAL-01, EVAL-02, EVAL-03, EVAL-05.
**Not in scope (later phases):** any UI/Show Mode consumption (Phase 4), the constellation renderer itself (Phase 7), the `< ~25%` wider-confidence-framing UI behavior (EVAL-04, Phase 4). This phase only produces the artifact + predictor + backtest that those phases consume.

**Mode:** MVP (vertical slices). Run as thin end-to-end slices — build matrix → predict → backtest — rather than implementing all seven signals before anything is testable end-to-end.

</domain>

<decisions>
## Implementation Decisions

### Signal Combination (MODL-03 through MODL-10)
- **D-01:** Signals fuse via a **staged multiplicative pipeline**: `score = P(next|current) × decay × rotationSuppression × eraPrior`, with the sparse-data backoff supplying the base factor and the hard-segue override applied on top. Chosen for inspectability — each factor is a readable ratio — and because multiplicative smoothing naturally avoids hard-zeros. (Not log-linear/softmax.)
- **D-02:** The backoff chain (transition → tuning-family affinity → album/era affinity → base play rate, MODL-08) supplies the base factor via **interpolated smoothing**: the base is always a weighted blend of all available tiers (`w1·transitionProb + w2·tuningAffinity + w3·albumEra + w4·basePlayRate`), so an unseen pair still receives a nonzero floor from lower tiers. No hard cliffs between tiers. Tier weights live in config.
- **D-03:** Tuning-family affinity contributes **only** inside the backoff blend (D-02), never as a top-level multiplier (satisfies MODL-09).
- **D-04:** Hard-segue override (MODL-05) is **consistency-gated**: only pairs whose historical hard-segue rate exceeds a config threshold (e.g. ≥ X% of song A's within-set exits are a notated segue into B) force a near-1.0 confidence; inconsistent/one-off segues instead get a strong multiplicative boost, not 100%. Both the threshold and the override ceiling are config constants. Preserves "only notated hard segues reach 100%" without letting a single segue instance pin false certainty.
- **D-05:** Already-played conditioning (MODL-10): songs already played in the current show drop to **near-zero, not hard-zero** (sandwich/reprise-aware — repeats do occur). Implemented as a scoring-time multiplier against the in-progress setlist.
- **D-06:** The predictor emits a **rich per-candidate breakdown**, not just `{songId, score}`. Each ranked candidate carries its final score plus the contributing factors (transitionProb, decay, rotation, eraPrior, which backoff tier was used, hard-segue flag) and a one-line human-readable reason string. Makes the model self-explaining, powers ablation and debugging this phase, and powers the Show Mode per-orb "why" (SHOW-10) and Explore debugger (EXPL-02) later at no rework.

### Matrix Schema & Set Boundaries (DATA-05, MODL-01, MODL-02)
- **D-07:** Set-boundary and encore transitions are **excluded from edge counts** (DATA-05): the builder only emits transition edges between consecutive performances *within the same set*. A last-of-set-1 → first-of-set-2 or main-set → encore adjacency is never counted, so it cannot poison within-set segue probabilities. (Not retained-and-flagged.)
- **D-08:** The frozen artifact is a **nodes + edge-list** plain-JSON structure: `{ nodes: [{songId, name, playCount, tuningFamily, era…}], edges: [{from, to, count, segueCount…}] }`. The constellation renderer (Phase 7) reads nodes/links directly; the predictor builds an in-memory `from → edges` index on load. One artifact, both consumers, no second pipeline (honors the CLAUDE.md "single serializable structure consumed by BOTH predictor and constellation" constraint).
- **D-09:** Matrix construction takes an **as-of-date cutoff** (MODL-02): the builder filters shows to `date ≤ cutoff` before counting. The shipped artifact uses `cutoff = latest`; the backtest builds ephemeral matrices at earlier cutoffs. Leakage prevention is built into the builder signature, not bolted on downstream.
- **D-10:** Each edge stores **both `count` (raw) and `weightedCount` (recency-decayed, MODL-04)**. Decay is exponential with a tunable half-life computed **relative to the as-of cutoff date, not wall-clock now** — so a rebuilt/backtest matrix decays correctly for its own cutoff. Scoring picks which count to use; ablation-off (EVAL-02) uses raw `count`, keeping decay a toggleable signal. The constellation uses raw `count` for edge thickness. `sentinelSongIds` (song_id 1 "Unknown") and excluded settypes carry forward from Phase 1 config — never emitted as nodes/edges.

### Hard-Segue Source (MODL-05)
- **D-11:** Hard segues are derived **only from the already-normalized `Performance.transitionKind === "segue"`** (from raw `transition_id` 2/3, per docs/SCHEMA.md §4). `jamcharts.json` — present in `data/raw/` but not normalized — is **deferred**; jamcharts predominantly flag notable jams rather than segues, and the segue signal is fully captured by transition notation. Revisit jamcharts only if the backtest shows a hard-segue accuracy gap. No jamcharts ingest sub-task in this phase.

### Backtest & Ablation (EVAL-01, EVAL-02, EVAL-03, EVAL-05)
- **D-12:** Holdout = the **most recent complete tour** (grouped by `tourId`, excluding the `tourIdSentinel = 1` "Not Part of a Tour" bucket; identify the tour containing the latest show date). Evaluation is **walk-forward within that tour**: for each held-out show, rebuild the matrix as-of that show's date (train = everything strictly prior, *including that tour's earlier nights*), then score each within-set transition. Mirrors real live use and genuinely exercises rotation suppression (MODL-06) and already-played conditioning (MODL-10) — the app's core use case is consecutive nights of one tour.
- **D-13:** Metrics: **top-1 / top-5 / top-10 next-song hit rates, reported overall and split by hard-segue vs. free-choice** (EVAL-01).
- **D-14:** Ablation is **leave-one-signal-out, report-only** (EVAL-02): run the full backtest, then re-run with each signal individually disabled and report each variant's hit rates plus the delta vs. the full model. **No automated go/no-go gate in Phase 2** — the owner reads the numbers and judges trust. (The `< ~25%` free-choice wider-framing behavior is EVAL-04 / Phase 4, not a Phase 2 verification gate.)
- **D-15:** The backtest is a **Node-CLI command with zero browser dependencies** (EVAL-03) and emits a **paired human-readable `.md` + machine-readable `.json`**, mirroring Phase 1's census (`censusReportPath` / `censusJsonPath` in config.ts). The `.md` prints to stdout and is written to a committed report file; the `.json` holds per-split hit rates and ablation deltas (diffable across model changes, assertable by tests). Both paths added to `config.ts`.

### Configuration & Constants (MODL-11)
- **D-16:** **All** model constants — decay half-life, rotation-suppression penalty/curve, backoff tier weights (D-02), hard-segue consistency threshold + override ceiling (D-04), already-played suppression factor (D-05), era-prior definition, candidate-list size — live in the **single `packages/core/src/config.ts`** file (extends the existing Phase 1 config object; no scattered magic numbers). Values are **seeded with reasonable defaults and tuned/justified via the backtest + ablation**, per PROJECT.md's open question 1 ("propose values, justify from the backtest"). Config is the single source of truth for both the shipped model and every ablation variant.

### Testing (EVAL-05)
- **D-17:** Unit tests cover the scoring pipeline (and matrix construction) using **small fixture setlists with known expected outputs**, following the established Phase 1 Vitest + `test/fixtures/*.json` pattern. Fixtures should exercise: within-set vs boundary exclusion (D-07), backoff on unseen pairs (D-02), hard-segue override gating (D-04), already-played suppression (D-05), and as-of cutoff leak-safety (D-09).

### Claude's Discretion
- Exact numeric default values for every constant in D-16 (seed reasonable, justify via backtest). PROJECT.md explicitly defers these to planning.
- Precise era-prior definition ("base play probability in the current era", MODL-07) — the operational definition of "current era" and its smoothing weight.
- Internal function/module decomposition within `packages/core/src` (e.g. `model/matrix.ts`, `model/predict.ts`, `eval/backtest.ts`), CLI entrypoint naming, and MVP slice boundaries — Claude to structure during planning, consistent with existing `packages/core` layout.
- Exact in-memory index representation the predictor builds from the edge list (D-08).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 2 section: goal, success criteria, requirement IDs, MVP mode.
- `.planning/REQUIREMENTS.md` — DATA-05, MODL-01…MODL-11, EVAL-01/02/03/05 (the authoritative requirement text).
- `.planning/PROJECT.md` — model signal descriptions, "Open questions to resolve during planning" (decay/rotation defaults), core/UI separation and single-config-file constraints.

### Data contract (Phase 1 outputs — this phase's input)
- `packages/core/src/domain/types.ts` — `NormalizedCorpus`, `NormalizedShow`, `SetSection`, `Performance` (fields: `transitionKind`, `transitionId`, `position`, `isPlaceholder`), `TransitionKind`, `SetNumber`. The frozen input contract.
- `data/normalized/corpus.json` — the actual normalized corpus artifact (738 shows / 264 songs); the model's sole input.
- `data/tuning-tags.json` — `songId → family` (`standard | cs-standard | microtonal`) for tuning-family affinity (MODL-09).
- `packages/core/src/config.ts` — existing single-config-file pattern to extend (MODL-11); note `sentinelSongIds`, `settypeAllowlist`, `tourIdSentinel`, `corpusArtifactPath`, `censusReportPath`/`censusJsonPath` (report-pattern precedent).
- `docs/SCHEMA.md` — §4 transition/segue notation (`transition_id` → segue), set/encore delimiting (`setnumber: "e"`), §6 Unknown sentinel, §11 tour_id sentinel. Grounds DATA-05, MODL-05, D-07.
- `data/census-report.md` — corpus shape/density (settype counts, tour buckets) informing default-view scope and threshold intuition.

### Phase 1 planning context (patterns to follow)
- `.planning/phases/01-corpus-ingestion-schema-foundation/01-CONTEXT.md` — prior locked decisions (anti-corruption boundary, config-as-source-of-truth).
- `.planning/phases/01-corpus-ingestion-schema-foundation/01-PATTERNS.md` — established core module + Vitest fixture patterns.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/src/config.ts` — extend this exact object with all Phase 2 constants (D-16); it already models "single source of truth for pipeline constants."
- `packages/core/src/domain/types.ts` — reuse `NormalizedCorpus`/`Performance` as the input type; add new `TransitionMatrix`, predictor-output, and backtest-result types in the same `domain`/`model` vocabulary.
- `packages/core/test/fixtures/*.json` + `*.test.ts` — the fixture-setlist + Vitest pattern to mirror for scoring-pipeline unit tests (D-17). Existing fixtures (segues, encore, sandwich, multiset) are directly relevant test material.
- `packages/core/src/cli/run-census.ts` + `census.ts`/`censusReportPath` — the Node-CLI-emits-paired-.md+.json precedent to mirror for the backtest report (D-15).

### Established Patterns
- Pure-core purity is compile-enforced (`packages/core` tsconfig `lib: ES2023`, no DOM, no React dep; `erasableSyntaxOnly` — union types not enums). All Phase 2 code obeys this (EVAL-03's "zero browser deps" is structurally guaranteed).
- CLI entrypoints live in `packages/core/src/cli/` and run under Node-native TS execution (no build step).

### Integration Points
- Input boundary: read `data/normalized/corpus.json` via the `NormalizedCorpus` type only — never raw kglw.net field names (anti-corruption boundary from Phase 1).
- Output boundary: the `TransitionMatrix` JSON artifact (D-08) is the contract handed to Phase 4 (predictor consumption) and Phase 7 (constellation) — freeze its schema deliberately.

</code_context>

<specifics>
## Specific Ideas

- Follow the census report's paired-artifact ergonomics exactly (stdout Markdown + committed `.md` + committed `.json`) so accuracy history is diffable across model tweaks and the ablation table reads like the census tables.
- The predictor's per-candidate reason string (D-06) should read like the PROJECT.md example: e.g. "notated segue 14/15 times since 2024" — concrete counts, not vague labels — so it drops straight into the future orb "why".

</specifics>

<deferred>
## Deferred Ideas

- **Jamcharts as a hard-segue / signal source** (D-11) — deferred; revisit only if the backtest shows a hard-segue accuracy gap. Data is in `data/raw/jamcharts.json` if needed later.
- **Set-position awareness** (opener/closer/encore distributions) — v2 (MODL-V2-01); D-07 excludes boundary edges rather than modeling them. Set structure is preserved in the corpus, so this stays purely additive later.
- **Album-as-genre-proxy affinity** — v2 (MODL-V2-02); only if it beats tuning-family backoff in a future backtest.
- **A hard trust-threshold gate** (free-choice top-5 < ~25% → fail) — intentionally NOT in Phase 2 (D-14); the wider-confidence-framing behavior lands in the UI at Phase 4 (EVAL-04).

None of the above are in this phase's scope — recorded so they aren't lost.

</deferred>

---

*Phase: 02-transition-matrix-model-backtest*
*Context gathered: 2026-07-08*
