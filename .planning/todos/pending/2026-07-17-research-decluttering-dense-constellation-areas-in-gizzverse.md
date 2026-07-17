---
created: 2026-07-17T19:48:29.121Z
title: Research decluttering dense constellation areas in GizzVerse
area: ui
files:
  - packages/app/src/explore/ConstellationCanvas.tsx:173-200
  - packages/app/src/explore/ConstellationCanvas.tsx:406-471
  - packages/app/src/config.ts:269-345
---

## Problem

On the **GizzVerse** tab (the Explore song constellation; `ConstellationCanvas.tsx`,
the react-force-graph-2d canvas fed by pure-core `deriveConstellation` `{nodes,
links}`), the layout is **understandable now but gets super busy in dense
regions** — clusters where many songs interconnect turn into a tangle of
overlapping edges and stars, hurting legibility. This is a *research* task, not a
committed design: find a better way to render/lay out those high-degree pockets
so the hub-and-spoke structure stays readable everywhere, not just in the sparse
outskirts.

Current levers already in play (so research doesn't re-tread them):
- **Force spacing** — `CHARGE_STRENGTH: -800` and `LINK_DISTANCE: 180`
  (`config.ts:274,282`), both already **doubled** from the device-tuned values
  for a wider spread. Applied by reheating d3-force in `ConstellationCanvas.tsx:173-200`.
- **Edge slider** — `EDGE_COUNT_THRESHOLD_DEFAULT: 2` (hides one-play edges),
  range 1–10 (`config.ts:331-345`); a pure render-pass filter, no rebuild
  (`ConstellationCanvas.tsx:145-149`).
- **Edge styling** — neutral tint at 20% base, width clamped ≤4px, focus lifts
  neighborhood to 70% and dims the rest (`ConstellationCanvas.tsx:406-471`).

So simply spreading harder or raising the edge threshold are the knobs we've
already maxed; the busyness persists structurally in dense clusters.

## Solution

TBD — research directions to evaluate (pick/prototype, don't assume):

- **Edge bundling** — hierarchical/force-directed edge bundling to merge parallel
  edges in dense pockets into readable arcs (biggest visual-density win; check
  cost/compat with react-force-graph-2d canvas or whether it needs custom
  `linkCanvasObject`).
- **Degree-aware / adaptive filtering** — instead of one global edge-count
  threshold, thin edges *locally* by node degree (e.g. keep each node's top-K
  strongest transitions), so hubs declutter while sparse areas keep detail.
- **Focus-first / progressive disclosure** — draw a calmer base graph (fewer
  edges) and reveal a node's full neighborhood only on focus/tap. The focus
  tint/dim machinery (§B3/§B4) already exists to build on.
- **Layout alternatives** — clustered/community layout (group by tuning family or
  graph community), or a hub-emphasis layout that pushes leaf nodes outward;
  compare against the current single d3-force sim.
- **Rendering tricks** — curved links to reduce overlap, opacity/width scaling by
  weight so weak edges recede, halo/collision to stop star overlap.

Keep the constraints: single component + one pipeline off the same matrix JSON
(CLAUDE.md), all constants in `config.explore` (no magic numbers), and respect
the **settle-and-freeze / low-power** ethos (EXPL-06) — favor approaches that
compute once at settle rather than animate continuously. Deliverable: a short
recommendation (which technique(s), rough effort, library-fit) before any build.

Related but distinct: [[gizzverse-animate-directional-flow-particles-along-constella]]
(edge-flow animation) and the galaxy-gradient backdrop todo — those are polish;
this is structural legibility.
