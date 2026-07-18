---
spike: 001
name: constellation-depth-shading
type: standard
validates: "Given the real 264-node GizzVerse sky, when nodes are spherical-shaded + depth-scaled by playCount, then it reads as genuinely volumetric AND stays smooth on pan/zoom redraw"
verdict: PARTIAL
related: []
tags: [explore, constellation, canvas, depth, 2d, throwaway]
---

# Spike 001: Constellation Depth Shading

Throwaway, in-app spike (behind `?depth=1`) to judge **spherical shading** +
**playCount depth-scaling** on the real constellation before committing to the
full Tier-1 + #5 build. NOT the real implementation — no occlusion draw-order
sort, no depth-weighted edges, no nebula parallax, no `config` surface.

## What This Validates

Given the real 264-node GizzVerse sky, when each node is drawn as a shaded ball
and scaled/faded by a synthetic `z = √playCount / √maxPlay`, then (a) it reads as
a genuine volume rather than a flat sheet, and (b) per-node radial gradients stay
smooth at 264 nodes on pan/zoom redraw (no jank).

## How To Run

1. Dev server: `cd packages/app && npx vite` (was live on `:5199` during the spike).
2. Open `http://localhost:5199/?depth=1` → **GizzVerse** tab. The `depth` query
   param is read once at module load (`SPIKE_DEPTH`); tab switching preserves it.
3. **Toggle "My dex overlay" OFF** in the filter FAB (bottom-right). This is
   REQUIRED to see the effect — see finding #2.

Toggle is disposable: the change lives **uncommitted** in
`packages/app/src/explore/ConstellationCanvas.tsx` between the `// ─── SPIKE`
markers. `git checkout packages/app/src/explore/ConstellationCanvas.tsx` discards it.

## What To Expect

Near (high-playCount) songs: larger, brighter, saturated, shaded like lit balls.
Far (low-playCount) songs: smaller, dimmer, faded toward the surface `#0C0C10`.
Tuning hue is preserved — only shaded/scaled.

## Investigation Trail

1. **Built** the toggle: `z = √play/√maxPlay` → radius ×`lerp(0.6,1.3,z)`,
   `globalAlpha ×= lerp(0.4,1,z)`, colour faded toward `#0C0C10` by `(1−z)·0.6`,
   then a canvas `createRadialGradient` (offset highlight → base → shadow).
2. **First run (overlay ON):** nodes drew as flat GREY discs with visible size
   variation, but no ball shading. Cause → **finding #2**.
3. **Toggled overlay OFF → all nodes vanished, edges only.** Console:
   `SyntaxError: addColorStop ... 'rgb(NaN, 145, 191)'`. Cause → **finding #1**:
   I passed the already-faded `rgb(...)` string into `sphereGradient`, whose
   internal blend assumed `#RRGGBB` and parsed `"rg"`→`NaN`.
4. **Fixed:** added `parseColor()` that accepts BOTH `#hex` and `rgb(r,g,b)`;
   `hexLerp` now format-agnostic. No console errors after. (Visual re-confirm of
   the shaded orbs was interrupted — the browser extension disconnected before a
   post-fix repaint fired; `autoPauseRedraw` means the canvas only repaints on
   interaction, so the stale pre-fix frame lingered.)

## Results

**Verdict: PARTIAL ⚠** — promising, one visual confirmation still outstanding.

Confirmed:
- **Perf:** no jank observed across tab-settle, panel open, and overlay toggle at
  264 nodes (desktop). Structurally bounded — `autoPauseRedraw` (verified in
  `force-graph` source) repaints only on interaction, so per-node gradient cost is
  paid on pan/zoom, not continuously. Low risk; cache gradients / pre-render
  sprites only if on-device profiling shows cost.
- **Depth-scaling reads:** size + alpha variation by playCount is visibly a depth
  cue even in the grayscale (overlay-ON) state.
- Nebula backdrop composits cleanly behind the depth nodes.

Outstanding:
- **Flagship spherical-shading look on tuning-colored orbs not yet eyeballed**
  (needs overlay OFF + a repaint; interrupted by the extension drop). ~10s to
  confirm on device.

### Signal for the real build (/gsd-quick)
- **Shade the grayscale path too.** The dex overlay is ON by default and a fresh
  dex has zero catches → every song is an unseen grey silhouette, which the spike
  leaves flat (hex-only shading). Depth then only shows with overlay OFF or on
  caught songs. The real build should depth-shade the unseen grayscale value as
  well, so depth reads in the default view.
- **`z` source decision still open:** playCount double-counts the existing
  `sqrt(playCount)` radius (exaggerated but works for the spike). Consider a
  gentler mapping or an orthogonal `z` (degree / stable hash) for the real build.
- **Gradient perf:** fine as-is; revisit only if device profiling flags it.
- Color helpers must handle both `#hex` (tuningColor) and `rgb()` (grayscaleOf /
  faded) — the bug that ate an hour of nobody's time but would've shipped.
