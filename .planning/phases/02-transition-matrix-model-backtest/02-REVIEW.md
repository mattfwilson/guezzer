---
phase: 02-transition-matrix-model-backtest
reviewed: 2026-07-08T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - data/backtest-report.md
  - data/backtest.json
  - data/normalized/transition-matrix.json
  - packages/core/src/cli/build-model.ts
  - packages/core/src/cli/run-backtest.ts
  - packages/core/src/config.ts
  - packages/core/src/domain/types.ts
  - packages/core/src/eval/backtest.ts
  - packages/core/src/eval/holdout.ts
  - packages/core/src/index.ts
  - packages/core/src/model/decay.ts
  - packages/core/src/model/index-build.ts
  - packages/core/src/model/matrix.ts
  - packages/core/src/model/predict.ts
  - packages/core/test/eval/backtest.test.ts
  - packages/core/test/fixtures/synthetic-ascutoff.json
  - packages/core/test/fixtures/synthetic-ascutoff.meta.json
  - packages/core/test/fixtures/synthetic-multitour.json
  - packages/core/test/fixtures/synthetic-multitour.meta.json
  - packages/core/test/model/matrix.test.ts
  - packages/core/test/model/predict.test.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-08
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the transition-matrix / predictor / walk-forward backtest core (`packages/core/src/model`, `src/eval`, `src/cli`, `src/config.ts`, `src/domain/types.ts`), its unit tests, and the shipped data artifacts. The leakage/as-of-bound handling, decay math, hard-segue gating, and ablation sweep are all correctly implemented and match their documented invariants (verified against both the synthetic fixtures and the real 738-show corpus).

However, `predict()` never excludes the currently-playing song from its own candidate universe. I confirmed this against the real shipped `data/normalized/transition-matrix.json`: predicting "what comes after The River" ranks **The River itself** as the #9 candidate (of 15), and "what comes after Crumbling Castle" ranks **Crumbling Castle itself** as the #7 candidate — both well within the candidate-list window the Phase 4 UI is specified to display (top 5–8). This directly undermines the project's stated Core Value ("credible next-song predictions") and is classified as a blocker.

Several smaller quality/consistency gaps were also found: a magic number outside the single config file (violates the CLAUDE.md "no scattered magic numbers" constraint), an unenforced doc-promise ("verified by a config test" — no such test exists), duplicated `findLatestShow` logic across two files, and inconsistent CLI argument validation between `--cutoff` (validated) and `--out`/`--json-out` (unvalidated, can crash with a cryptic error on a missing value).

## Critical Issues

### CR-01: `predict()` never excludes the currently-playing song from the candidate universe — the model can predict "next song = the song currently playing"

**File:** `packages/core/src/model/predict.ts:482-502`

**Issue:** `predict()` scores every node in `index.nodeById` (the full candidate universe `C`) against `context.currentSongId`, with no filter removing `context.currentSongId` itself from that universe:

```ts
export function predict(
  matrix: TransitionMatrix,
  context: ShowContext,
  cfg: ScoringConfig = config,
  toggles: SignalToggles = defaultSignalToggles,
): PredictionCandidate[] {
  const index = buildMatrixIndex(matrix);
  const candidates = [...index.nodeById.values()].map((node) =>
    scoreCandidate(context.currentSongId, node.songId, index, cfg, toggles, context),
  );
  ...
```

Nothing downstream neutralizes this: `alreadyPlayedFactor` only fires if the current song already appears in `ctx.trail`, but the in-progress trail is built by `evalTransitions`/(future Show Mode) to exclude the very occurrence that is "happening now" — so on a song's first play of the show, self-prediction is completely unsuppressed. `rotationSuppression` only looks at *prior* shows, not the current one. `eraPrior`/`albumEraAffinity`/`basePlayRate` actively favor the current song when it is one of the catalog's most-played/most-recently-hot songs — exactly the songs most likely to be "currently playing" at a show.

I verified this is not a theoretical concern — running `predict()` against the real shipped `data/normalized/transition-matrix.json` for the 20 most-played songs in the catalog:

```
SELF-PREDICTION: "The River" (playCount 245) ranked #9 of 15, score=0.0132, top score=0.6092
SELF-PREDICTION: "Crumbling Castle" (playCount 164) ranked #7 of 15, score=0.0126, top score=0.5785
```

`candidateListSize` is 15 and Phase 4's UI is specified (config.ts:153) to show only the top 5–8 — so "Crumbling Castle" ranking #7 for its own next-song prediction would plausibly surface directly in the shipped product as "might play Crumbling Castle next" while Crumbling Castle is what's currently playing. This directly contradicts CLAUDE.md's Core Value statement ("credible next-song predictions") and MODL-08's intent (a nonzero floor for *plausible* unseen pairs — a song following itself is not a plausible candidate the model should ever surface).

This does not corrupt the backtest's reported hit-rate numbers (real successive transitions are never `A→A`, so the self-candidate is never the ground-truth target), but it does waste a candidate-list slot that a legitimate candidate could otherwise occupy, and it is a live, reproducible product-facing bug.

**Fix:** Exclude the current song from the candidate universe before scoring/returning:

```ts
const candidates = [...index.nodeById.values()]
  .filter((node) => node.songId !== context.currentSongId)
  .map((node) =>
    scoreCandidate(context.currentSongId, node.songId, index, cfg, toggles, context),
  );
```

(Note: if tier-normalization sums-to-1-over-`C` invariants documented in 02-RESEARCH.md are load-bearing at the *tier* level (`transitionProb`/`tuningAffinity`/`basePlayRate`), keep those tier functions summing over the full node set — only filter the *returned/ranked* candidate list, not the normalization denominator, to avoid silently changing the meaning of `w1..w4`.)

## Warnings

### WR-01: `WEIGHTED_COUNT_PRECISION` is a magic number outside the single config file (CLAUDE.md constraint violation)

**File:** `packages/core/src/model/matrix.ts:21`

**Issue:** CLAUDE.md's Constraints section states: "All model constants ... in a single config file — no scattered magic numbers." `WEIGHTED_COUNT_PRECISION = 1e9` is a model-output-precision constant hardcoded directly in `matrix.ts`, not in `config.ts` alongside every other numeric tunable (`decayHalfLifeDays`, `backoffWeights`, etc.).

**Fix:** Move the constant into `config.ts` (e.g. `weightedCountPrecision: 1e9`) and reference `cfg.weightedCountPrecision` from `roundWeighted`.

### WR-02: `backoffWeights` doc-comment promises a config test that does not exist

**File:** `packages/core/src/config.ts:111-118`

**Issue:** The docstring states: "Must sum to 1.0 — verified by a config test." No such test exists anywhere in `packages/core/test/` (confirmed via search — the only files touching `backoffWeights` are `predict.test.ts`, which exercises the value but never asserts `w1+w2+w3+w4 === 1`). The current committed values do sum to 1.0, but nothing prevents a future edit from silently breaking `baseFactor`'s convex-blend invariant (D-02) — `effectiveBackoffWeights` would still divide by whatever the (wrong) sum is, so a drift here degrades scoring silently rather than failing loudly.

**Fix:** Add a small config test asserting `config.backoffWeights.w1 + w2 + w3 + w4 === 1` (or `toBeCloseTo(1, 10)`), matching the promise already made in the comment.

### WR-03: `findLatestShow` is duplicated verbatim across two files

**File:** `packages/core/src/cli/build-model.ts:40-49` and `packages/core/src/eval/holdout.ts:15-23`

**Issue:** Both files independently implement the identical "max `(date, showOrder)` tie-break" reducer:

```ts
// cli/build-model.ts
return corpus.shows.reduce((latest, show) =>
  show.date > latest.date || (show.date === latest.date && show.showOrder > latest.showOrder)
    ? show
    : latest,
corpus.shows[0]);
```
```ts
// eval/holdout.ts
return corpus.shows.reduce(
  (latest, show) =>
    show.date > latest.date || (show.date === latest.date && show.showOrder > latest.showOrder)
      ? show
      : latest,
  corpus.shows[0],
);
```

If one copy's tie-break logic is ever changed (e.g., a bugfix), the other silently drifts out of sync — this is exactly the kind of determinism-critical logic (Pitfall 2) that should have one source of truth.

**Fix:** Export `findLatestShow` from `eval/holdout.ts` (or a shared `model/`-level helper) and have `cli/build-model.ts` import it instead of reimplementing it.

### WR-04: CLI `--out`/`--json-out` flags crash with a cryptic error if given no value, unlike `--cutoff`

**File:** `packages/core/src/cli/build-model.ts:126-141`, `packages/core/src/cli/run-backtest.ts:140-153`

**Issue:** `--cutoff` is explicitly validated (`validateCutoffArg` checks `rawValue === undefined`), but `--out`/`--json-out` are not:

```ts
} else if (arg === "--out") {
  options.outPath = argv[++i];   // undefined if --out is the last argv token
}
```

If `--out` is the last CLI token, `options.outPath` becomes `undefined`, which then overwrites `defaultOptions().outPath` via the `{ ...defaultOptions(), ...options }` spread (object spread copies the key even when its value is `undefined`). Downstream, `dirname(opts.outPath)` — `dirname(undefined)` — throws an unhelpful low-level Node `TypeError` instead of a clear "Missing value for --out" message.

**Fix:** Validate the presence of a value the same way `validateCutoffArg` does, e.g.:

```ts
} else if (arg === "--out") {
  const value = argv[++i];
  if (value === undefined) throw new Error("--out requires a value");
  options.outPath = value;
}
```

### WR-05: No path validation on `--out`/`--json-out`, inconsistent with the project's own stated CLI-arg-validation convention

**File:** `packages/core/src/cli/build-model.ts:126-141`, `packages/core/src/cli/run-backtest.ts:140-153`

**Issue:** `validateCutoffArg`'s comment explicitly invokes "Security V5 — validate before URL/path construction" and mirrors `cli/refresh.ts`'s bounded-integer convention. `--out`/`--json-out`, which are used directly to construct filesystem write paths (`mkdir(dirname(opts.outPath)...)`, `writeFile(opts.outPath, ...)`), receive no such validation anywhere. Exploitability is low today (single-owner local CLI, not attacker-facing), but this is an inconsistent application of a convention this same codebase treats as load-bearing elsewhere, and any future reuse of this CLI in a less trusted context (e.g. invoked from a script that accepts external input) would inherit an unvalidated path-write primitive.

**Fix:** At minimum, reject values containing `..` path-traversal segments, or resolve+confirm the output path stays under the project root, mirroring the rigor already applied to `--cutoff`.

### WR-06: Corpus JSON is loaded with an unchecked type cast, no runtime schema validation

**File:** `packages/core/src/cli/build-model.ts:75`, `packages/core/src/cli/run-backtest.ts:119`

**Issue:** Both CLIs load the committed corpus artifact via:

```ts
const corpus = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;
```

This is a compile-time-only cast — there is no `corpus.schemaVersion === 1` check and no zod validation, unlike `loadTuningFamilyBySongId` in the same file, which validates `data/tuning-tags.json` against `tuningTagsFileSchema` before use. If `corpus.json`'s shape ever drifts (a new ingestion pipeline bug, a stale/corrupted committed file, a manual edit), both `buildMatrix` and `runBacktest` will silently operate on malformed data (e.g. `undefined.sets` crashes deep in a loop, or worse, silently misinterprets a renamed/reshaped field) rather than failing loudly at the load boundary — the exact failure mode this project's own docs elsewhere insist on avoiding ("schema drift ... fails loudly at build time, never silently corrupts the matrix", `config.ts:35`).

**Fix:** Either zod-validate the parsed corpus against a schema (mirroring the tuning-tags pattern), or at minimum assert `corpus.schemaVersion === 1` immediately after parsing, throwing a descriptive error otherwise.

## Info

### IN-01: `formatDeltaPct` can theoretically render an unsigned "-0.0pp"

**File:** `packages/core/src/cli/run-backtest.ts:66-70`

**Issue:** The function special-cases `value === 0` to print a clean `"0.0pp"`, explicitly to avoid an ambiguous sign on a true no-op. But a delta that is nonzero yet rounds to `0.0` after `.toFixed(1)` (e.g. `-0.0001`) would still hit the `value > 0 ? "+" : ""` branch and could render `"-0.0pp"`, contradicting the stated intent. Not observed in the current 154-transition holdout report (the smallest possible nonzero delta there is `1/154 ≈ 0.65pp`, well above the rounding threshold), but would resurface once a holdout tour's `evalTransitionCount` grows large enough (roughly `n > 2000`) for `1/n` to round under `0.05pp`.

**Fix:** Round first, then compare: `const pct = (value * 100).toFixed(1); return pct === "0.0" || pct === "-0.0" ? "0.0pp" : ...`.

### IN-02: Backoff-tier values are recomputed redundantly per candidate

**File:** `packages/core/src/model/predict.ts:433-472`

**Issue:** `scoreCandidate` calls `baseFactor` (which internally computes `transitionProb`, `tuningAffinity`, `albumEraAffinity`, `basePlayRate` once each), then separately calls `dominantBackoffTier`, which recomputes all four of the exact same tier functions again just to compare their contributions, and then a third time explicitly for `factors.transitionProb`. This is flagged as a quality/duplication concern (not a performance one, which is out of v1 scope) — the two computations of "the four tier contributions" are two independent code paths that must be kept in sync by hand; a future change to one of the tier functions' call signature or an added tier could easily update one call site and miss the other.

**Fix:** Have `baseFactor` (or a shared internal helper) compute and return the four tier contributions once, and have both the blended score and `dominantBackoffTier` consume that single result.

### IN-03: No test coverage for the CLI wrapper layer

**File:** `packages/core/src/cli/build-model.ts`, `packages/core/src/cli/run-backtest.ts`

**Issue:** `packages/core/test/` has no test file exercising `runBuildModel`, `runBacktestCli`, `parseArgs`, or `validateCutoffArg` in either CLI file — only the pure `buildMatrix`/`runBacktest` functions they wrap are unit tested. This means the argument-parsing and validation logic (including the missing-value crash noted in WR-04, and `validateCutoffArg`'s regex/bounds logic) has zero automated coverage.

**Fix:** Add a focused test file per CLI covering `parseArgs`'s flag handling (including the missing-value case) and `validateCutoffArg`'s bounds/format checks, consistent with the project's stated testing bar for the scoring pipeline.

---

_Reviewed: 2026-07-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
