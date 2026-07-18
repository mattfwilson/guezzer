---
status: complete
phase: 08-on-device-ui-polish-accessibility
source: [08-VERIFICATION.md]
started: 2026-07-18T09:00:00Z
updated: 2026-07-18T20:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Orb-label legibility on the physical iPhone via `#/dev/orb-fit`
expected: All 264 real @matrix song names render fully — no truncation/overflow/oversizing — and the harness reports ZERO overflow offenders (especially the 44-char outlier "(You Gotta) Fight for Your Right (To Party!)" and "Deserted Dunes Welcome Weary Feet"). (POLISH-01)
result: pass
retested: 2026-07-18 after plan 08-08 fix — user: "much better - pass"
history:
  - result: issue (2026-07-18T10:10:00Z, pre-fix)
    reported: "almost all of the larger sized orbs look fine and the text fits but for many of the smaller orb sizes for songs the text overflows out of the orb"
    severity: major
    fixed_by: plan 08-08 (circle-aware fitOrbLabel — commits 84973dd..baef4ad)

### 2. `inert` propagation through `display:contents` on iOS Safari with VoiceOver (WR-02)
expected: With a modal `<Sheet>` open, VoiceOver cannot reach any background control — swipe past the last in-sheet element and confirm focus stays inside the sheet. If the background remains reachable, the documented fallback is to move `id`/`inert` onto AppShell's root flex box. (A11Y-01)
result: pass

### 3. Real-device dismiss / trap / restore on the 7 audited surfaces (VoiceOver + external keyboard)
expected: For each of NodeSheet, AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, "Whose dex is this?" prompt, CompareView — Escape dismisses; a modal traps the AT virtual cursor and Tab wraps; focus restores to the trigger on close; NodeSheet stays non-modal (graph reachable). (A11Y-01)
result: pass

### 4. FilterFab no-occlusion on a real phone (A11Y-02)
expected: Focus a constellation node — the FilterFab rests ~12px above the NodeSheet peek top edge, fully visible and tappable, no overlap with sheet content; it returns to bottom-right when the sheet closes.
result: pass

### 5. Resize-keeps-camera-framed on a real phone (A11Y-03)
expected: Focus a node, then rotate the device and toggle the on-screen keyboard — the camera stays framed on that node with no snap-off.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Every prediction-orb + center-node song name renders fully inside its orb — no truncation/overflow/oversizing — across ALL orb sizes (POLISH-01)"
  status: resolved
  resolved_by: "plan 08-08 (circle-aware fitOrbLabel, commits 84973dd..baef4ad); on-device retest passed 2026-07-18"
  reason: "User reported: almost all of the larger sized orbs look fine and the text fits but for many of the smaller orb sizes for songs the text overflows out of the orb"
  severity: major
  test: 1
  root_cause: "fitOrbLabel models the orb as a rectangle (square), not a circle. orbLabelFit.ts:48 sets USABLE_WIDTH_FACTOR=1 and charsPerLine (51-54) grants the full diameter as usable chord width for EVERY wrapped line, ignoring that a circle's usable width shrinks toward top/bottom lines. On small orbs (real min ORB_MIN_DIAMETER 56px from orbitLayout.ts:127-130, passed raw) names wrap to 3-4 near-full-diameter lines that pass the rectangular char budget (ellipsized:false) but exceed the circle's chord at top/bottom -> horizontal + vertical spill. Larger orbs render fewer/shorter lines near the vertical center (chord ~ diameter) so they fit. fitsBudget (98-105) never checks total text HEIGHT vs the circle's vertical extent, and PredictionOrb also renders a fixed 14px percent line (162-170) the fitter reserves no room for."
  artifacts:
    - path: "packages/app/src/show/orbLabelFit.ts"
      line: 48
      issue: "USABLE_WIDTH_FACTOR = 1 — full diameter used as text width (rectangle model)"
    - path: "packages/app/src/show/orbLabelFit.ts"
      line: 51
      issue: "charsPerLine applies full-diameter width to every line uniformly; no circular-chord reduction / per-line vertical awareness"
    - path: "packages/app/src/show/orbLabelFit.ts"
      line: 98
      issue: "fitsBudget checks only line count <= maxLines and per-line chars; never total text height vs circle vertical extent"
    - path: "packages/app/src/show/PredictionOrb.tsx"
      line: 63
      issue: "passes raw layout.diameterPx without subtracting face-button px-1 padding (CenterNode does subtract)"
    - path: "packages/app/src/show/PredictionOrb.tsx"
      line: 162
      issue: "fixed text-[14px] percent line rendered below the name, but fitter reserves no vertical room for it"
    - path: "packages/app/src/show/config.ts"
      line: 95
      issue: "ORB_LABEL_MAX_LINES=4 + ORB_LABEL_MIN_FONT_PX=10 let the rectangle model pack near-full-width text into small circles"
    - path: "packages/app/test/orbLabelFit.catalog.test.ts"
      line: 59
      issue: "only 3 fixed diameters (64/56/center 92) and only asserts .ellipsized===false; never validates circular fit — the coverage gap that let this ship"
    - path: "packages/app/src/dev/OrbFitHarness.tsx"
      line: 83
      issue: "on-device gate uses rectangular scrollWidth/scrollHeight on an overflow:hidden rounded-full square, so circular spill is unmeasured and visually clipped"
  missing:
    - "Make fit heuristic circle-aware: derive per-line usable chord from the line's vertical offset (chord = 2*sqrt(r^2 - y^2)), or apply a USABLE_WIDTH_FACTOR < 1 that scales down as line count rises"
    - "Add total-height constraint: (lineCount * lineHeight) + reserved percent-line height must fit the circle's vertical extent, not just lines <= maxLines"
    - "Subtract PredictionOrb padding before fitting (mirror CenterNode's diameter - padding*2) and subtract percent-line height from the vertical budget"
    - "Fix catalog test to sweep the real dynamic diameter range [56..112] and assert a GEOMETRIC fit predicate, not merely .ellipsized===false"
    - "Fix OrbFitHarness to measure spill against the circular boundary (remove overflow:hidden or test each line's width against the chord at its y)"
  debug_session: ".planning/debug/orb-label-overflow-small-orbs.md"
