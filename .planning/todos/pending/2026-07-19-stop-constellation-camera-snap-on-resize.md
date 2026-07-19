---
created: 2026-07-19T04:48:04.422Z
title: "Stop constellation camera snapping to zoom-to-fit on container resize"
area: bug
files:
  - packages/app/src/explore/ConstellationCanvas.tsx:221-233
  - packages/app/src/explore/ConstellationCanvas.tsx:695-714
---

## Problem

**Severity: LOW-MEDIUM (UX, GizzVerse). Found in 2026-07-19 bug-hunt review.**

The effect keyed on `[graphData, size.width, size.height]` calls `d3ReheatSimulation()`; with frozen positions the reheat is visually inert but still re-fires `onEngineStop`, whose handler unconditionally calls `zoomToFit`. So any container resize — iOS Safari address-bar collapse while scrolling, orientation change, keyboard appearing — yanks the camera back to fit-all mid-exploration, fighting the user's pan/zoom and the focus-camera effect.

## Solution

Gate `zoomToFit` behind a first-settle flag (only auto-fit on the initial engine stop per graph-data change, never on pure size changes). Preserve the user's camera on resize, or at most re-center smoothly if the focused node would go off-screen.

Run via /gsd-quick.
