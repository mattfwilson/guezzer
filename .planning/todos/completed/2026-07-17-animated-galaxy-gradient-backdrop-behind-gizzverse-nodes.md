---
created: 2026-07-17T19:40:24.839Z
title: Animated galaxy gradient backdrop behind GizzVerse nodes
area: ui
files:
  - packages/app/src/explore/ConstellationCanvas.tsx
  - packages/app/src/explore/ExploreView.tsx
  - packages/app/src/config.ts (config.explore)
  - packages/app/src/styles.css
---

## Problem

On the **GizzVerse** tab (the Explore song constellation; route `explore`,
`ConstellationCanvas.tsx`, rendered via `react-force-graph-2d` on a `<canvas>`)
the nodes currently sit on the flat dark surface (`#0C0C10`). Owner wants a
**subtle, animated "galaxy"/universe backdrop behind the nodes**, built from
**gradients**, purely aesthetic — to give the feel of a starfield/nebula
**without distracting from the nodes or their functionality** (tap/focus/pan/zoom,
labels, edges, Dex-dim overlay). It must read as ambient depth, not compete for
attention.

Related but SEPARATE from the edge-flow-particles idea
(`2026-07-17-gizzverse-animate-directional-flow-particles-along-constella.md`),
which animates direction ALONG edges. This one is the background layer.

## Solution

TBD — approach options to weigh at plan time:

- **Layer placement (two viable routes):**
  1. **CSS/DOM layer behind the canvas** — an absolutely-positioned `div`
     underneath the `ForceGraph2D` in `ExploreView`/`ConstellationCanvas`, with
     animated CSS `radial-gradient`/`conic-gradient` (slow drift/rotation, subtle
     opacity pulse). Cheapest; does NOT pan/zoom with the graph (backdrop stays
     fixed to the viewport — arguably fine, or even desirable, for an ambient sky).
  2. **Canvas `onRenderFramePre`** — react-force-graph-2d calls this BEFORE it
     draws nodes; paint gradient washes / faint stars in world coords so the
     galaxy pans+zooms WITH the constellation (stronger "universe" feel, heavier).
     Note the graph already runs a settle-and-freeze sim over ~264 nodes.

- **Aesthetic:** deep-space gradients complementing the dark theme (`#0C0C10`
  surface) — a couple of soft off-center nebula blooms (violet/indigo/teal at low
  opacity) + optional faint static star specks. Keep contrast LOW so node fills
  (tuning colors) and labels stay the clear focal point.

- **Hard constraints (this project):**
  - **Honor `prefers-reduced-motion`** — the app gates all animation on it
    (styles.css idiom: default = reduced state, `@media (prefers-reduced-motion:
    no-preference)` enables motion; JS via `useReducedMotion` from `motion/react`).
    Under reduced motion → a STATIC gradient (no drift/pulse).
  - **Performance/battery (EXPL-06 settle-and-freeze):** the backdrop must not
    fight the force sim or drain battery — prefer CSS (GPU compositor) or a very
    slow/cheap paint. Avoid per-frame heavy canvas work that runs even after the
    graph freezes.
  - **Offline-safe:** gradients/CSS only, no external images/assets.
  - **Non-interactive:** `pointer-events-none`, `aria-hidden` — never intercept
    the canvas's pan/zoom/tap gestures.
  - **Single-config rule (CLAUDE.md):** any tunables (bloom colors, opacity,
    drift period) go in `config.explore`, no scattered magic numbers.
  - **Focus/Dex-dim compatibility:** must still read well when the focus-dim or
    Dex-dim (unseen silhouette) overlays lower node opacity — don't let the
    backdrop swallow dimmed nodes.

- Start with option 1 (CSS layer) as the MVP — lowest risk, honors reduced-motion
  trivially, no canvas-perf entanglement; escalate to option 2 only if a
  pan/zoom-locked sky is wanted.
</content>
