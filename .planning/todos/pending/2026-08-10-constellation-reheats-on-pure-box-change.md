---
created: 2026-08-10T00:00:00.000Z
title: Chrome toggle reheats the constellation simulation on a pure box change
area: explore
resolves_phase:
files:
  - packages/app/src/explore/ConstellationCanvas.tsx
  - packages/app/test/chromeResize.test.tsx
---

## Problem

A chrome toggle changes only the viewport box, but it restarts the d3 force simulation.

`ConstellationCanvas`'s spacing effect has deps `[graphData, size.width, size.height]` and calls
`fg.d3ReheatSimulation()` **unconditionally**. Hiding or showing chrome changes `size.height`, so
every toggle reheats — even though no node, link or spacing input changed.

**The reheat is inert, not harmless-by-accident.** Two shipped mitigations bound it:

- `onEngineStop` pins every node's `fx`/`fy`, so a reheat cannot move the layout.
- `firstSettleRef` gates `zoomToFit`, so the camera cannot snap.

Both were independently confirmed in `22-VERIFICATION.md`. What is *not* bounded is the CPU: the
reheat still runs simulation ticks on a surface whose whole point is to be cheap enough to sit on
during a show.

## Evidence

- `packages/app/src/explore/ConstellationCanvas.tsx:249` — `fg.d3ReheatSimulation()` inside an
  effect keyed on `size.height`.
- `packages/app/test/chromeResize.test.tsx:192-207` — a block comment stating that asserting
  CHROME-05's original wording FAILS against the shipped code, and instructing readers not to
  "strengthen" the test into a failure. The test suite documents the gap honestly rather than
  passing vacuously.
- `.planning/REQUIREMENTS.md` CHROME-05 was **amended 2026-08-10** to describe the inert-reheat
  behaviour actually shipped. This todo tracks closing the original intent.

## Solution

TBD. The direction is to make a pure box change not reheat — separate "the graph changed"
(needs a reheat) from "the container resized" (does not). Sketch:

- Split the effect: keep `graphData` on a reheating effect; move `size.*` to an effect that
  updates force parameters without calling `d3ReheatSimulation()`.
- Or gate the reheat on a ref holding the last `graphData` identity, so a size-only rerun skips it.

**Do not do this on a deploy day.** It is a layout-affecting change to the constellation, which is
the highest-regression surface available — and the user-visible symptom today is zero, because the
pins and the camera gate already absorb it. Sequence it with a device pass on GizzVerse, and
re-point `chromeResize.test.tsx`'s comment at the real assertion once it can pass.
