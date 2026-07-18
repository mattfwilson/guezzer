# Model Trust Sign-Off — v1.0 Prediction Model

**Decision:** ACCEPTED — the shipped scoring model is trusted for live use at show #1.
**Signed off by:** owner (matt), 2026-07-18.
**Scope:** the prediction model / scoring signals only (the CLAUDE.md "non-negotiable
trust gate"). This is NOT the full-loop live rehearsal (that remains an open owner
validation item — see [[../STATE.md]] / Phase 10 VALID-02).

## What was reviewed

The committed backtest trust report (`data/backtest-report.md` + `data/backtest.json`),
a leak-free walk-forward backtest over the most-recent complete tour holdout
(2025 Phantom Island Australia, tour 65 — 9 shows, 154 within-set transitions):

| Split | n | Top-1 | Top-5 | Top-10 |
|---|---|---|---|---|
| Overall | 154 | 54.5% | 66.9% | 74.0% |
| Hard segue | 36 | 52.8% | 61.1% | 63.9% |
| Free choice | 118 | 55.1% | 68.6% | 77.1% |

These numbers are credible for the app's actual use case: a residency-style run of
**consecutive nights of the same tour** (which tour 65 is), where the model gets the
right song into the top-5 orbs ~2 of every 3 transitions.

## The one open concern, and how it was resolved

The report's leave-one-signal-out ablation (single holdout, n=154) suggested two
signals might be *hurting* top-1: removing `hardSegue` → +3.2pp, removing `rotation`
→ +2.6pp. On one tour (≈5 transitions) this is easily noise, and acting on it risked
overfitting. Before signing off, an **overfitting check** was run.

### Overfitting check — 36-tour walk-forward sweep (2026-07-18)

A throwaway analysis harness (deleted; reused the pure `buildMatrix` as-of + `predict`
core, and was validated to reproduce the committed tour-65 report *exactly*:
84/154 = 54.5%, no-rotation 57.1%, no-hardSegue 57.8%) re-ran the same leak-free
walk-forward across **36 holdout tours (7,978 transitions)**, and separately over
recent tours (2023+, most representative of a 2026 show):

| Variant | Pooled all-36 Δtop-1 | Recent (2023+) Δtop-1 | Per-tour top-1: helps / hurts |
|---|---|---|---|
| remove **hardSegue** | −0.9pp | +0.8pp | 13 / 15 |
| remove **rotation** | +3.7pp | +0.2pp | 28 / 5 |
| soften rotation (0.5→0.7) | +2.2pp | +0.0pp | 25 / 6 |

**Findings:**
- **hardSegue** — the tour-65 "+3.2pp" did not generalize; across 36 tours removing it
  is net *negative* (−0.9pp). It is theoretically sound and earns its place. **Retained.**
- **rotation** — the big pooled win is an **old-era artifact** (small, repetitive early
  setlists that rotation over-penalized). On recent/representative tours it is **+0.2pp
  — noise.** Rotation suppression directly serves the app's core scenario (consecutive
  nights of the same tour, where "don't just replay last night" matters most), where it
  is not hurting. Removing it would overfit to historical eras. **Retained.**
- On recent, representative data **no variant beats the shipped model by more than <1pp
  (noise).** No scoring change is warranted.

## Decision & rationale

- **No scoring-signal change.** All 7 signals (decay, rotation, alreadyPlayed, eraPrior,
  hardSegue, tuning, albumEra) retained at their shipped weights. `decay` is the
  workhorse (removing it costs −11pp top-1); the rest are net-neutral-to-positive and
  none robustly harm the representative case.
- **Model accepted for show #1.** The trust gate is now passed on evidence, not a single
  glance: the one apparent weakness was stress-tested across 36 tours and did not hold.

## Re-open conditions

Re-run the backtest (`node packages/core/src/cli/run-backtest.ts`) and revisit this
sign-off if: the corpus is materially refreshed (new tours ingested), any scoring
signal/weight in `packages/core/src/config.ts` is changed, or live show #1 predictions
diverge conspicuously from the ~55% top-1 / ~67% top-5 the holdout implies.
