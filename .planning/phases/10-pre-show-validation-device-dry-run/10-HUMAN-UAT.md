---
status: pass
phase: 10-pre-show-validation-device-dry-run
source: [10-VERIFICATION.md]
started: 2026-07-19T00:08:48Z
updated: 2026-07-18T21:36:14Z
---

## Current Test

### 1. Tuning-family spot-check + anomaly sweep (VALID-01)

## Tests

### 1. Tuning-family spot-check + anomaly sweep (VALID-01)
expected: |
  Prove the tuning-family tags are musically sane before show #1 without blindly regenerating them. This re-confirms the Phase 01 tuning-tag spot-check (`01-HUMAN-UAT.md` test #1, DATA-04) with a read-only review CLI. Open `data/tuning-review.md` (or re-run `node packages/core/src/cli/review-tuning-tags.ts`) and:

  (a) Confirm every canonical spot-check row is musically sensible (any `⚠️` / `MISSING` row needs your eye). Pre-run output — 12 pass / 0 fail:

  | song | expected | actual | ok |
  |---|---|---|---|
  | 12 Bar Bruise | standard | standard | ✅ |
  | Robot Stop | standard | standard | ✅ |
  | Gamma Knife | standard | standard | ✅ |
  | Crumbling Castle | standard | standard | ✅ |
  | The Dripping Tap | standard | standard | ✅ |
  | Hot Water | standard | standard | ✅ |
  | Doom City | microtonal | microtonal | ✅ |
  | Rattlesnake | microtonal | microtonal | ✅ |
  | Nuclear Fusion | microtonal | microtonal | ✅ |
  | Sleep Drifter | microtonal | microtonal | ✅ |
  | Straws in the Wind | microtonal | microtonal | ✅ |
  | Minimum Brain Size | microtonal | microtonal | ✅ |

  (b) Eyeball the anomaly candidates — the families the album-default logic can NEVER assign (`cs-standard` down-tuned era, `other` covers) plus the hand-tagged owner-knowledge overrides worth re-confirming. Summary: 264 total (238 standard, 26 microtonal, 0 cs-standard, 0 other, 52 hand-tagged), 45 anomaly candidate(s).

  **cs-standard candidates (down-tuned era — album-default cannot assign):**

  | songId | name | current family |
  |---|---|---|
  | 94 | Hell | standard |
  | 133 | Mars For the Rich | standard |
  | 152 | Organ Farmer | standard |
  | 157 | Perihelion | standard |
  | 160 | Planet B | standard |
  | 180 | Self-Immolate | standard |
  | 200 | Superbug | standard |
  | 239 | Venusian 1 | standard |
  | 240 | Venusian 2 | standard |

  **other candidates (covers — original-artist tuning is owner knowledge):** None — nothing to re-confirm (a valid pass).

  **hand-tagged overrides that diverge from their album default — confirm still intended:** None — nothing to re-confirm (a valid pass; of the 52 hand-tags, the 16 that match their album default are not surfaced).

  **hand-tagged, no album default to compare against — confirm still intended** (36 rows — the owner-knowledge edits the auto-logic cannot check, mostly covers): 80 Fury, 255 Love For Me, 256 Oh God, 257 Other Side, 258 Moby Dick, 263 Happy Birthday To You, 265 Talk Talk Talk, 266 I Gotta Rock 'n' Roll, 267 I Wanna Be Your Dog, 272 Pushin' Too Hard, 274 High School, 276 Let There Be Rock, 277 All My Loving, 278 Dirty Deeds Done Dirt Cheap, 279 Proud Mary, 280 La Grange, 281 I Was Made for Lovin' You, 282 Whole Lotta Love, 283 (You Gotta) Fight for Your Right (To Party!), 284 These Boots Are Made for Walkin', 285 Every 1's a Winner, 289 On the Road Again, 290 Silver Machine, 330 Boogie, 381 Ghost, 404 Gypsy, 405 Stoned, 424 Rock N' Roll, 425 T.V. Eye, 439 Jam, 498 Treaty, 927 Jailbreak, 980 Police Truck, 992 JOJAM, 996 LUSEQ, 1022 Dueling Drums.

  CONFIRMATION BRANCH (likely): if nothing is genuinely wrong, no file changes needed — reply "confirmed". FIX BRANCH (D-03): if you find a genuine error, hand-edit `data/tuning-tags.json` (flip `family` to the correct closed-vocabulary value standard | cs-standard | microtonal | other, set `source: "hand-tagged"`, keep 2-space + trailing newline), then run `node packages/core/src/cli/build-model.ts`, then `node packages/core/src/cli/run-backtest.ts`, and `git diff data/backtest-report.md` to confirm the top-k table shows NO regression.
result: |
  PASS (D-03 FIX branch). Owner reviewed `data/tuning-review.md` and eyeballed the anomaly candidates. Verdict:

  - CONFIRMED as-is: the 12 canonical spot-checks (all ✅, 0 fail) and the 36 hand-tagged no-album-default overrides (mostly covers) are correct — no change.
  - FIXED (D-03): the 9 cs-standard candidates from *Infest the Rats' Nest* were confirmed to be C# standard tuning and re-tagged `standard` → `cs-standard` (`source: album-default` → `hand-tagged`) in `data/tuning-tags.json`, matched by songId: 94 Hell, 133 Mars For the Rich, 152 Organ Farmer, 157 Perihelion, 160 Planet B, 180 Self-Immolate, 200 Superbug, 239 Venusian 1, 240 Venusian 2. Nothing else changed.

  Re-ran `build-model` + `run-backtest`. Backtest top-k delta = ZERO regression (byte-identical top-k + ablation tables; only the report timestamp changed):

  | Split | Top-1 | Top-5 | Top-10 |
  |---|---|---|---|
  | Overall (before) | 84 (54.5%) | 103 (66.9%) | 114 (74.0%) |
  | Overall (after)  | 84 (54.5%) | 103 (66.9%) | 114 (74.0%) |
  | Δ | 0.0pp | 0.0pp | 0.0pp |

  Post-fix summary counts: 264 total — 229 standard, 26 microtonal, **9 cs-standard**, 0 other, 61 hand-tagged. The 9 tracks now appear as cs-standard in the summary and are no longer flagged as cs-standard candidates (that sub-section is now empty — a valid nothing-to-re-confirm pass). Review CLI unit test green (10/10). VALID-01 closed; re-confirms Phase 01 `01-HUMAN-UAT.md` test #1 (DATA-04).

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
