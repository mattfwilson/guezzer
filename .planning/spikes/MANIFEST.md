# Spike Manifest

## Idea

Add a genuine sense of **depth/volume** to the GizzVerse constellation while
keeping the current 2D `react-force-graph-2d` structure (no 3D/three.js migration).
Research surfaced a "depth stack": Tier-1 (spherical shading, playCount
depth-scaling, occlusion draw-order, depth-weighted edges) + #5 nebula parallax on
`onZoom`. Governing constraint (from `force-graph` source): `autoPauseRedraw` means
depth must be baked-in or interaction-driven — never continuous per-frame — to
respect EXPL-06 low-power. This spike de-risks the two aesthetic/perf-critical
pieces before the real build.

## Requirements

Design decisions locked from research + this spike (non-negotiable for the build):

- Stay 2D `react-force-graph-2d` — no three.js (bundle/one-thumb/battery).
- Depth must be **baked-in or interaction-driven** (no continuous canvas repaint;
  `autoPauseRedraw` must keep pausing at rest).
- Color helpers must handle BOTH `#hex` and `rgb(...)` inputs (spike bug #1).
- The real build must **depth-shade the unseen grayscale path**, not just
  hex/caught nodes (spike finding #2) — the dex overlay is ON by default.
- All real-build tunables in `config.explore` (single-config ethos); the spike
  itself is throwaway and un-configured.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | constellation-depth-shading | standard | Spherical shading + playCount depth-scaling reads as volume AND stays smooth at 264 nodes | PARTIAL ⚠ | explore, constellation, canvas, depth |
