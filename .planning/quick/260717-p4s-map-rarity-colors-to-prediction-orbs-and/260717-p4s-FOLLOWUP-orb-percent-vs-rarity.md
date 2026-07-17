# Follow-up research: reconciling orb % with rarity color

**Logged:** 2026-07-17 · **Status:** Parked (no change decided) · **Context:** follow-up to quick task 260717-p4s (which put rarity-tier color on the Show Mode prediction orbs)

## The observation that triggered this

After 260717-p4s shipped, testing surfaced a **legendary** (rare) prediction orb showing a **higher %** than a **common** orb next to it with a lower %. This *looks* contradictory ("rare but likely?") and is the thing we may want to reconcile later.

## Core reframe: the two numbers answer different questions

They are **orthogonal**, not contradictory:

- **The % = absolute prediction confidence.** "Is *this* the next song, given what's playing now?" Dominated by the transition matrix. It is **not** normalized to sum to 100 across the fan, and is capped at 97%.
  - `formatOrbPercent` → `Math.round(score*100)` — `packages/app/src/show/confidence.ts:19`
  - Header comment confirms it's the absolute score, never a renormalized fan share (D-09) — `confidence.ts:1-6`, reinforced `orbitLayout.ts:18-19`
  - `score = baseFactor × rotationSuppression × alreadyPlayedFactor × eraPrior`, then hard-segue override, capped at `hardSegueOverrideCeiling=0.97` — `scoreCandidate`, `packages/core/src/model/predict.ts:433-472`
  - `baseFactor` = Jelinek-Mercer interpolation of 4 backoff tiers, weights `w1=0.6 (transition MLE), w2=0.2 (tuning), w3=0.15 (era), w4=0.05 (base play rate)` — `predict.ts:214-228`, `core/config.ts:130`
  - `transitionProb` (t1, the dominant term) = `(count(A→B)+α) / (Σ exits(A) + α·candidateCount)` with **`transitionAddAlpha = 0.0`** (no smoothing) — `predict.ts:88-103`, `core/config.ts:121`

- **The rarity color = global frequency stat.** "How often is this song played *at all*, across the whole archive?" It has **zero** knowledge of the current song.
  - Pure function of all-time `playCount` bucketed into bands — `buildRarityIndex` / `tierForPlayCount`, `packages/core/src/dex/rarity.ts:51-107`
  - `RARITY_BANDS`: `legendary = 1 play`, `epic = 2–3`, `rare = 4–8`, `uncommon = 9–23`, `common = 24+` — `core/config.ts:214-219`
  - Orb resolves it via `rarityColor(rarityTierForSong(candidate.songId))` — `packages/app/src/dex/rarityStyle.ts:36-39`, `PredictionOrb.tsx:58`

**Conclusion:** a legendary-and-high-% orb means "rarely played overall, *yet* strongly bonded to whatever is on stage right now" — potentially the product's most exciting signal (a rare song that historically only appears as a specific segue), not a bug. The UI's job is to stop *implying* the two should agree.

## Two real problems hiding inside the collision

### Problem 1 — Perceptual (salience is inverted)
Rarity owns the loudest channel (the whole orb fill hue); the decision-relevant number (%) is small text. The rarity palette is also an implicit **value ramp** (legendary-orange reads as "best"), so at a glance the bright orb looks like "the pick" even when the % ranks it lower.
- Fill = rarity, % = small text — `PredictionOrb.tsx:147` (fill), `:162-170` (% text)
- Tier hexes (app/config.ts:236-249): debut `#A1A1AA`, common `#E4E4E7`, uncommon `#34D399`, rare `#60A5FA`, epic `#A855F7`, legendary `#FB923C`
- **Orb size and radius are uniform** and this is *intentional*: "score is conveyed by rank order + the % label, not by radius" — `orbitLayout.ts:10-13`. Diameter clamped `[56,112]`, single shared ring, angle = rank only (rank 0 at top, clockwise) — `orbitLayout.ts:108-135`

### Problem 2 — Statistical (some high-% rare orbs are noise)
A legendary song was played once. With `transitionAddAlpha = 0.0`, its % is `count(A→B)/totalExits(A)` off a sample of **one** — if the current song is also obscure and was followed by the rare song on the single night both appeared, you get a large ratio from one observation. The orb signals nothing about support.
- No smoothing on the MLE — `predict.ts:88`, `core/config.ts:121`
- Raw support **exists but isn't surfaced**: `MatrixEdge` carries `count`, `weightedCount`, `segueCount`, dates (`domain/types.ts:122-130`); the matrix is already in the app's hand (`useShowSession.ts:124`), but `PredictionCandidate.factors` exposes only normalized numbers (`transitionProb, decay, rotation, alreadyPlayed, eraPrior, backoffTier, hardSegueFlag` — `types.ts:167-175`), **no raw count / totalExits**.
- The only sample-size hint reaches the user via the long-press *Why* sheet reason string ("seen 1× since 2024") — `buildReason`, `predict.ts:396-424`; rendered `WhyDetail.tsx:60`.

## Option space (for when we revisit)

**Problem 1 — perceptual**
- **A1. Size/center-pull orbs by confidence** (bigger/closer = higher %). Rarity stays the fill; the likely orb becomes obvious from geometry regardless of hue. *Cost: medium. Tradeoff: reverses the deliberate uniform-orb decision at `orbitLayout.ts:10-13`.*
- **A2. Demote rarity to a secondary cue** (ring/border/gem/badge); fill or opacity encodes confidence instead. *Cost: medium. Tradeoff: partially unwinds p4s "fill = rarity" on the predictive fan; Dex/chronological keep full-fill rarity.*
- **A3. Keep as-is + legend/one-time explainer** (color = rarity, number = likelihood). *Cost: low. Tradeoff: doesn't reduce the glance-level misread.*

**Problem 2 — statistical / trust**
- **B1. Surface low support visually** — dim/desaturate/texture an orb when `totalExits(A)` or raw `A→B count` is tiny; reuse the existing weak-fan softening (`OrbitStage.tsx:147`, `PredictionOrb.tsx:131-133`, `WEAK_FAN_THRESHOLD=0.15`). Needs threading `count`/`totalExits` into `PredictionCandidate.factors`. *Cost: medium. Tradeoff: adds a third visual state; pick a support threshold.*
- **B2. Shrink sparse estimates in the model** — raise `transitionAddAlpha` or add Bayesian shrinkage so a 1-sample legendary is pulled toward the backoff prior and stops out-ranking well-supported commons. Fixes the % itself → ordering matches intuition. *Cost: high. Tradeoff: touches the core model → **must re-run the backtest trust gate**.*

**Problem 0 — "it's a feature"**
- **B0. Lean in** — mark high-%-rare as a highlight ("rare + likely = special"). *Only sensible after B1/B2 ensure those orbs are real signal, not 1-sample noise.*

## Tentative recommendation (not decided)
- Cleanest reconciliation that keeps all p4s rarity work: **A1 + B1** — encode confidence in geometry so the likely orb is unmistakable independent of hue, and add a low-support cue so rare-and-noisy orbs visibly recede. Color becomes pure flavor. *Blocker to confirm first: willingness to reverse the intentional uniform-orb decision.*
- If geometry is off-limits: **A2 + B1**.
- **B2** is the "fix it at the source" move but is the only option that trips the backtest gate — hold unless real-corpus data shows sparse-sample cases are common.

## Suggested next step if/when we pick this up
Pull real numbers from the corpus **before** choosing: how often does a legendary orb actually out-rank a common one in a live fan, and how many of those are 1–2-sample cases? That distinguishes "frequent problem worth a geometry change" from "rare curiosity a support-dimming cue handles."

## Explicit non-goals right now
No change decided or built (owner: "hold off on changing anything right now"). This note exists so we don't have to re-derive the mechanics later.
