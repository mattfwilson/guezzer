# Backtest Report

Generated 2026-07-18T21:36:14.453Z from the committed normalized corpus. Zero network requests were made to produce this report -- it is a pure derivation over the already-committed `data/normalized/corpus.json` artifact (D-15, mirrors `census-report.md`, D-10).

**Holdout:** 2025 Phantom Island Australia Tour (tour 65), 9 show(s), 154 evaluated within-set transitions.

This is a leak-free walk-forward backtest (D-12): for each held-out show, the transition matrix is rebuilt with an exclusive as-of cutoff so the show's own transitions are never in its own training data, while the tour's earlier nights are.

This report is a non-negotiable trust gate before relying on the model live (CLAUDE.md Timeline constraint) -- the owner reads the numbers below and judges credibility. Ablation is report-only: there is no automated go/no-go gate in Phase 2 (D-14). Any signal whose ablation delta shows it does not earn its place is a candidate for deletion.

## Top-k hit rates

| Split | n | Top-1 | Top-5 | Top-10 |
|---|---|---|---|---|
| Overall | 154 | 84 (54.5%) | 103 (66.9%) | 114 (74.0%) |
| Hard segue | 36 | 19 (52.8%) | 22 (61.1%) | 23 (63.9%) |
| Free choice | 118 | 65 (55.1%) | 81 (68.6%) | 91 (77.1%) |

## Leave-one-signal-out ablation (D-14)

Each row re-runs the identical walk-forward backtest with exactly one signal disabled (every other signal stays on), through the same scoring code path as the full model -- never a forked implementation. `Δ` columns are the signal-off hit rate minus the full model's overall hit rate, in percentage points: negative means the signal HELPS (removing it hurts accuracy); positive means the signal HURTS (removing it would improve accuracy); zero means the signal made no difference on this holdout tour.

| Signal off | n | Top-1 | Top-5 | Top-10 | Δ Top-1 | Δ Top-5 | Δ Top-10 |
|---|---|---|---|---|---|---|---|
| decay | 154 | 67 (43.5%) | 99 (64.3%) | 116 (75.3%) | -11.0pp | -2.6pp | +1.3pp |
| rotation | 154 | 88 (57.1%) | 101 (65.6%) | 114 (74.0%) | +2.6pp | -1.3pp | 0.0pp |
| alreadyPlayed | 154 | 85 (55.2%) | 104 (67.5%) | 116 (75.3%) | +0.6pp | +0.6pp | +1.3pp |
| eraPrior | 154 | 82 (53.2%) | 103 (66.9%) | 114 (74.0%) | -1.3pp | 0.0pp | 0.0pp |
| hardSegue | 154 | 89 (57.8%) | 104 (67.5%) | 112 (72.7%) | +3.2pp | +0.6pp | -1.3pp |
| tuning | 154 | 84 (54.5%) | 105 (68.2%) | 115 (74.7%) | 0.0pp | +1.3pp | +0.6pp |
| albumEra | 154 | 84 (54.5%) | 104 (67.5%) | 114 (74.0%) | 0.0pp | +0.6pp | 0.0pp |
