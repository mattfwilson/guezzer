# Phase 2: Transition Matrix, Model & Backtest - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 2-transition-matrix-model-backtest
**Areas discussed:** Signal combination math, Matrix schema & set boundaries, Hard-segue source, Backtest & ablation design

---

## Signal Combination Math

### Q1 — How the 7 signals fuse into one score

| Option | Description | Selected |
|--------|-------------|----------|
| Staged multiplicative | `P(next\|cur) × decay × rotation × eraPrior`, backoff fills sparse base, hard-segue override on top; inspectable ratios, avoids hard-zero | ✓ |
| Log-linear additive | Σ(weight·log signal) + softmax; more tunable, less inspectable, overfitting risk on small corpus | |
| You decide | Defer to planning | |

**User's choice:** Staged multiplicative.

### Q2 — How the backoff chain supplies the base

| Option | Description | Selected |
|--------|-------------|----------|
| Interpolated smoothing | Base = always-on weighted blend of all tiers → nonzero floor for unseen pairs; tuning-family confined here | ✓ |
| Strict stepped fallback | Use highest tier with data; simpler but cliffs, 1-observation edge dominates | |
| You decide | Defer to planning | |

**User's choice:** Interpolated smoothing.

### Q3 — Hard-segue override trigger & absoluteness

| Option | Description | Selected |
|--------|-------------|----------|
| Consistency-gated override | Only pairs above a config segue-rate threshold hit near-1.0; inconsistent segues get a boost only | ✓ |
| Any notated segue overrides | Any ever-notated segue forces near-1.0; simplest, but one-off segue wrongly pins 100% | |
| You decide | Defer to planning | |

**User's choice:** Consistency-gated override.

### Q4 — Predictor output shape (inspectability)

| Option | Description | Selected |
|--------|-------------|----------|
| Rich breakdown per candidate | Each candidate carries score + contributing factors + one-line reason; self-explaining, powers ablation now & UI later | ✓ |
| Score-only now, enrich later | `{songId, score}` only; leaner now but guarantees a contract change in Phase 4/7 | |
| You decide | Defer to planning | |

**User's choice:** Rich breakdown per candidate.

---

## Matrix Schema & Set Boundaries

### Q1 — Boundary-crossing adjacencies (DATA-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude from edge counts | Only within-set consecutive pairs emit edges; boundary crossings never counted | ✓ |
| Retain but flag | Emit tagged boundary edges, predictor ignores by default; keeps data for v2 set-position modeling | |
| You decide | Defer to planning | |

**User's choice:** Exclude from edge counts.

### Q2 — Artifact serialization shape (MODL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Nodes + edge list | `{nodes:[…], edges:[{from,to,count,segueCount}]}`; constellation reads directly, predictor indexes on load | ✓ |
| Nested adjacency map | `{[from]:{[to]:{…}}}`; fastest predictor lookup, awkward for constellation | |
| You decide | Defer to planning | |

**User's choice:** Nodes + edge list.

### Q3 — Decay vs. as-of cutoff placement (MODL-02/04, EVAL-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Store raw + weighted counts | Edge holds `count` (raw) + `weightedCount` (decay relative to cutoff); ablation-off uses raw; backtest rebuilds per cutoff | ✓ |
| Raw counts only, decay at scoring | Store per-edge show-date list, apply decay at predict time; flexible but fattens edges | |
| You decide | Defer to planning | |

**User's choice:** Store raw + weighted counts.

---

## Hard-Segue Source

### Q1 — Where hard segues come from (MODL-05)

| Option | Description | Selected |
|--------|-------------|----------|
| transitionKind only now | Derive from already-normalized `transitionKind=='segue'`; jamcharts deferred | ✓ |
| Also ingest jamcharts | Normalize `jamcharts.json` and fold in; honors MODL-05 literally, adds ingest + validation work | |
| You decide | Defer to planning | |

**User's choice:** transitionKind only now (jamcharts deferred as possible enrichment).

---

## Backtest & Ablation Design

### Q1 — Held-out tour evaluation scheme (EVAL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Walk-forward within tour | Rebuild matrix as-of each held-out show (train = all prior incl. tour's earlier nights); mirrors live use, exercises rotation suppression | ✓ |
| Single frozen cutoff | Train once before tour start; simpler/cheaper, but understates rotation-suppression accuracy | |
| You decide | Defer to planning | |

**User's choice:** Walk-forward within tour.

### Q2 — Ablation method & trust gate (EVAL-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Leave-one-out, report-only | Re-run backtest with each signal disabled, report deltas; owner judges trust, no automated gate | ✓ |
| Leave-one-out + hard gate | Same ablation but fail verification below a free-choice top-5 threshold; risks blocking on acceptable numbers | |
| You decide | Defer to planning | |

**User's choice:** Leave-one-out, report-only.

### Q3 — Report output format (EVAL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Paired .md + .json | Stdout Markdown + committed `.md` + machine-readable `.json`; mirrors Phase 1 census, diffable, test-assertable | ✓ |
| Stdout Markdown only | Just print; leanest, but no diffable history and nothing for tests to assert | |
| You decide | Defer to planning | |

**User's choice:** Paired .md + .json.

---

## Claude's Discretion

- Exact numeric default values for all model constants (decay half-life, rotation penalty, backoff weights, segue threshold, already-played suppression, era-prior weight, candidate-list size) — seed reasonable, justify via backtest (PROJECT.md open question 1).
- Operational definition of "current era" for the era prior (MODL-07).
- Internal module decomposition, CLI entrypoint naming, and MVP slice boundaries within `packages/core`.
- In-memory index representation the predictor builds from the edge list.

## Deferred Ideas

- Jamcharts as a hard-segue/signal source — revisit only on a demonstrated backtest gap.
- Set-position awareness (opener/closer/encore) — v2 (MODL-V2-01).
- Album-as-genre-proxy affinity — v2 (MODL-V2-02).
- Hard trust-threshold gate — intentionally deferred to Phase 4 UI framing (EVAL-04).
