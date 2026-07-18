---
status: resolved
resolution: "Plan 08-08 made fitOrbLabel circle-aware (per-line chord width + total-height budget incl. percent line + face padding), commits 84973dd..baef4ad. On-device retest via #/dev/orb-fit passed 2026-07-18."
trigger: "UAT POLISH-01: smaller prediction orbs overflow their song-name labels outside the circle; larger orbs render fine. Catalog test passed because it only checked fixed sizes (64/92), never the smaller dynamic radii the real graph uses."
created: 2026-07-18
updated: 2026-07-18
---

## Current Focus

hypothesis: fitOrbLabel models the orb as a SQUARE (full diameter usable on every wrapped line) — ignoring circular-chord narrowing, total text height, the always-present percent line, and the button padding — so multi-line labels on small orbs spill past the circular fill.
test: read fit heuristic, orb layout diameter range, both callers, catalog test, and dev harness.
expecting: charsPerLine uses raw diameter with no circle geometry; test asserts only `.ellipsized === false`; harness measures rectangular scroll + clips with overflow:hidden.
next_action: return ROOT CAUSE FOUND (diagnose-only).

## Symptoms

expected: Every prediction-orb song-name label renders fully INSIDE the orb's circular fill at any rendered orb diameter.
actual: Larger orbs render labels correctly; many smaller-sized orbs overflow — text spills outside the circle.
errors: none (visual)
reproduction: On a physical iPhone, view constellation/prediction orbs where the ring solver produces small diameters (near ORB_MIN_DIAMETER=56).
started: Phase 08 POLISH-01 (retune to CHAR_WIDTH_FACTOR 0.55 / MAX_LINES 4 / 10px floor).

## Eliminated

- hypothesis: Ellipsis floor causes overflow instead of clipping.
  evidence: Pass 3 (orbLabelFit.ts:142-150) always ellipsizes when over budget — it never overflows in the fitter's OWN model. The overflow is because the model (rectangle) disagrees with reality (circle), not because ellipsis fails to fire.
  timestamp: 2026-07-18

## Evidence

- checked: orbLabelFit.ts charsPerLine (lines 46-54)
  found: CHAR_WIDTH_FACTOR=0.55, USABLE_WIDTH_FACTOR=1. `usable = diameterPx * 1`; chars/line = floor(usable/(0.55*fontPx)). Full diameter granted as text chord for EVERY line regardless of that line's vertical position in the circle.
  implication: Rectangle model. Lines away from vertical center overflow the true circular chord.

- checked: orbitLayout.ts layoutOrbs (lines 108-143)
  found: single uniform diameter clamped to [ORB_MIN_DIAMETER=56, ORB_MAX_DIAMETER=112]; on tight stages clamps to 56. PredictionOrb is called with this real diameter.
  implication: Real min radius = 56px, a continuum below the tested realistic 64; fitter IS invoked at 56.

- checked: PredictionOrb.tsx (lines 63-67, 145, 152-170)
  found: passes RAW layout.diameterPx (does NOT subtract the `px-1`=4px×2 padding on the face button, unlike CenterNode). Name block + a fixed `text-[14px]` percent sibling both must fit the circle; fitter constrains only line COUNT (≤4), never total height.
  implication: Even the rectangle budget is over-optimistic (padding ignored); vertical budget unmodeled.

- checked: CenterNode.tsx (lines 59-64)
  found: center DOES subtract padding (diameter - 12*2) — inconsistent with PredictionOrb which subtracts nothing.
  implication: Confirms padding subtraction was known-necessary but omitted for prediction orbs; center still uses the same rectangle model though.

- checked: orbLabelFit.catalog.test.ts (lines 26, 59-94)
  found: exercises only 3 discrete diameters (64, 56, center 92) and asserts ONLY `.ellipsized === false` / fontPx>=floor / lines<=maxLines. Never checks that N lines at chosen font actually fit inside the circle geometry.
  implication: "no ellipsis" is the wrong proxy for "fits inside the orb." A 4-line near-full-width wrap passes the test yet overflows the circle. This is the coverage gap.

- checked: OrbFitHarness.tsx (lines 83-93, 149-153)
  found: on-device check measures `scrollWidth>clientWidth || scrollHeight>clientHeight` on a SQUARE cell that also sets `overflow:hidden` + `rounded-full`. scrollWidth compares to the rectangular padding box; overflow:hidden clips at the circle so spill is invisible.
  implication: The harness uses the SAME rectangular fit criterion as the heuristic AND clips the evidence — so it reported "zero offenders" while the real orb (rounded-full, NO overflow:hidden) visibly spills. Both automated + on-device gates shared the rectangle blind spot.

## Resolution

root_cause: fitOrbLabel treats the orb as a square — orbLabelFit.ts:48 sets USABLE_WIDTH_FACTOR=1 and charsPerLine (orbLabelFit.ts:51-54) grants the FULL diameter as usable text chord for every wrapped line, ignoring that a circle's usable width narrows toward the top/bottom lines. On small orbs (real min = ORB_MIN_DIAMETER 56, orbitLayout.ts:127-130) names wrap to 3-4 near-full-diameter lines that satisfy the rectangular budget (`ellipsized: false`) but exceed the circular chord, so text spills outside the fill. The catalog test (orbLabelFit.catalog.test.ts:59-94) only asserts `.ellipsized === false` at 3 fixed sizes and never validates circular fit, and the on-device harness (OrbFitHarness.tsx:83-93) measures rectangular scrollWidth on an overflow:hidden square, so both gates shared the same rectangle blind spot.
fix: (not applied — diagnose-only)
verification: (not applied)
files_changed: []
