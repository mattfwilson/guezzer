# Phase 14: Gizz Bingo — Core Marking & Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 14-gizz-bingo-core-marking-generation
**Areas discussed:** Vibe feel & win-rate targets, Consume-once tie-break, "Never caught" personal square, Curated roster ownership, Calibration gate enforcement, Dark-floor scope for glory squares, Seed shareability / forward-compat, Core/app trail boundary

---

## Vibe feel & win-rate targets

**Vibe axis**

| Option | Description | Selected |
|--------|-------------|----------|
| Both mix AND targets shift | Vibe changes both square pool and winnability | ✓ |
| Square mix only | Different rarity pool, same expected-marks target | |
| Win-targets only | Same pool, only fill-rate target differs | |

**Line target (Balanced)**

| Option | Description | Selected |
|--------|-------------|----------|
| ~70% likely, not guaranteed | Line most nights, real miss sometimes | ✓ |
| ~85% nearly every night | Cozy, risks feeling automatic | |
| ~55% an achievement | Higher stakes, leans Glory | |

**Blackout (Balanced)**

| Option | Description | Selected |
|--------|-------------|----------|
| Rare crown ~2–5% | A handful per tour | ✓ |
| Very rare <2% | Almost mythical | |
| Reachable ~8–12% | Seen regularly | |

**Dark-square floor (event squares)**

| Option | Description | Selected |
|--------|-------------|----------|
| ≥20% per event square | No dead-square glare | ✓ |
| ≥30% per event square | Stricter, shrinks variety pool | |
| ≥10% per event square | Permissive, allows occasional dead square | |

**Chill feel**

| Option | Description | Selected |
|--------|-------------|----------|
| Line near-certain ~90% | Warm free-ish win | |
| Line very likely ~82% | Gentler slope, still a real miss | ✓ |

**Glory-hunter tradeoff**

| Option | Description | Selected |
|--------|-------------|----------|
| Lower line ~50%, blackout ~5–10%, richer glory mix | High-variance risk/reward | ✓ |
| Same winnability, just rarer squares | Vibe pick stops being a gamble | |

**Free-square geometry**

| Option | Description | Selected |
|--------|-------------|----------|
| Free center counts (always marked) | Conventional; freeIndex a config constant | ✓ |
| No free square — 16 fillable | Contradicts vetted 15+free | |

**Notes:** Vibes are a genuine risk/reward pick, not a re-skin. Chill landed slightly below near-certain (~82%) to keep a real miss possible. Free center counts toward lines/X/corners.

---

## Consume-once tie-break

**Priority**

| Option | Description | Selected |
|--------|-------------|----------|
| Rarest / most-specific wins | song > rare event > common event | ✓ |
| Most-common / generic first | Risks specific squares never firing | |
| Board position (top-left) | Arbitrary, starves specific squares | |

**Assignment strategy**

| Option | Description | Selected |
|--------|-------------|----------|
| Greedy fold in play-order | Matches live; "what lit it" never changes | ✓ |
| Globally-optimal assignment | Slightly more fill, retroactive relabeling | |

**Final fallback**

| Option | Description | Selected |
|--------|-------------|----------|
| Lowest board index (top-left) | Deterministic, trivial to reason about | ✓ |
| Let me think about it | Flag for planner alternatives | |

**Notes:** Combined with the "Never caught" area, the full specificity rank became: specific song > never-caught (personal) > bust-out (global) > common events.

---

## "Never caught" personal square

**Resolution snapshot**

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen at card lock | Snapshot caught-set; tonight's first catch still counts | ✓ |
| Live against current dex | Meaning shifts mid-show, breaks frozen defs | |

**First-show edge**

| Option | Description | Selected |
|--------|-------------|----------|
| Always deal; scales naturally | Near-certain early, rarer as dex grows | ✓ |
| Suppress until dex has ≥N songs | Special-case in generator | |

**How many**

| Option | Description | Selected |
|--------|-------------|----------|
| Vibe-weighted, not guaranteed | Glory leans in, Chill rarely | ✓ |
| Exactly one on every card | Always a personal anchor | |

**Precedence vs bust-out**

| Option | Description | Selected |
|--------|-------------|----------|
| Never-caught (personal) first | Personal Pokédex glory outranks global | ✓ |
| Bust-out (global) first | Objectively harder event takes precedence | |

**Notes:** "This is a personal Pokédex tool" was the decisive framing — personal glory beats global glory.

---

## Curated roster ownership

**Jam-vehicle authorship**

| Option | Description | Selected |
|--------|-------------|----------|
| Corpus-measured, you review | Data proposes, user disposes, then locks | ✓ |
| You hand-pick from scratch | Max control, more upfront effort | |
| Delegate to me + calibration | No review step | |

**Album roster breadth**

| Option | Description | Selected |
|--------|-------------|----------|
| Broader pool for variety | ≥53% set + lower-fire clearing ≥20% floor | ✓ |
| Tight ≥53% set only | Reliable but repetitive album art | |
| Top-4 highest-fire only | Minimal variety | |

**Album squares per card**

| Option | Description | Selected |
|--------|-------------|----------|
| Let calibration decide | Per-vibe mix weight, no hardcoded cap | ✓ |
| Cap at ~4 | Hard guardrail | |
| Cap at ~2–3 | Under-uses strongest variety lever | |

**Notes:** User wants a review checkpoint on the generated rosters BEFORE constants are written to config (→ CONTEXT D-20 process gate).

---

## Calibration gate enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Report + hard assertion | Human report + machine fail-on-violation, exits non-zero | ✓ |
| Report + manual sign-off only | Bad config could slip through | |
| Hard assertion only | No feel for the distribution when tuning | |

**Notes:** Bingo equivalent of the backtest trust gate.

---

## Dark-floor scope for glory squares

| Option | Description | Selected |
|--------|-------------|----------|
| Exempt — floor guards reliable pool only | Glory governed by vibe weights + per-card cap | ✓ |
| Applies to everything | Effectively bans glory squares | |
| Separate lower floor for glory | More knobs to calibrate | |

**Notes:** Without exemption, Glory-hunter can't exist (bust-out ~21%, never-caught dex-dependent).

---

## Seed shareability / forward-compat

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit string seed, pure deal | deal(seed,vibe,dexSnapshot,corpusVersion) pure fn | ✓ |
| Minimal internal seed | Likely reworked for the leaderboard later | |

**Notes:** Personal never-caught square means shared seeds won't be fully identical across friends — full leaderboard comparability stays future work — but the string seed is the right determinism primitive now.

---

## Core/app trail boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Core defines minimal contract | song id + play-order index; app adapts TrackedEntry | ✓ |
| Core mirrors TrackedEntry shape | Couples fold to app DB row | |

**Notes:** Essentially forced by the strict core-purity constraint (no DOM/DB in core).

---

## Claude's Discretion

- `core/bingo/` file split, `BingoCard` JSON field shape, the concrete PRNG behind the string seed, and the precise numeric constants (within the agreed target bands).
- `bustOutGapShows` starts from the vetting's ≥50-show gap (~21% fire), re-confirmed by the corpus scripts before locking.

## Deferred Ideas

- Segue square (not trail-derivable in v1; needs `TrackedEntry.transitionKind` or `latest`-driven marking).
- Shared-seed leaderboard / cross-friend comparable cards (GAME-V1.3-01) — blocked by the personal square + no-backend constraint.
- Pre-2020 replay cards re-enabling cover / encore / Set-2 squares.
