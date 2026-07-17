---
created: 2026-07-17T04:10:04.732Z
title: GizzVerse — animate directional flow along constellation edges
area: ui
files:
  - packages/app/src/explore/ConstellationCanvas.tsx:467-476
  - packages/app/src/config.ts (config.explore)
---

## Problem

On the **GizzVerse** tab (the Explore song constellation; route `explore`,
`ConstellationCanvas.tsx`), each edge already draws a **static** directional
arrowhead (`linkDirectionalArrowLength={3.5}`, `linkDirectionalArrowRelPos={0.9}`,
`ConstellationCanvas.tsx:474-475`). Owner wants the arrows to **animate — move
along the path in the direction they point** — so it's obvious at a glance which
song leads to which (transition direction A → B = "after A, B tends to follow").

## Solution

react-force-graph-2d has built-in directional-flow animation — the natural fit:

- Add `linkDirectionalParticles` (dots that travel source → target), with
  `linkDirectionalParticleSpeed`, `linkDirectionalParticleWidth`, and
  `linkDirectionalParticleColor={edgeColor}` (so particles inherit the focus
  tint/dim from `edgeColor`, `ConstellationCanvas.tsx:409`). Put speed/width/count
  in `config.explore` (single-config rule — no magic numbers).
- **Direction correctness:** graph links are directed `fromId → toId`; particles
  travel source→target by default, which must equal the transition direction.
  Verify the link build orientation (source = the "from" song) so arrows/particles
  point the right way. The existing static arrowhead can stay (reinforces
  direction) or be dropped once particles read clearly.

### ⚠️ Key tension — animation vs the settle-and-freeze battery design

The constellation deliberately **freezes rendering on cooldown** (EXPL-06,
`onEngineStop` fixes every node so the canvas stops repainting) — chosen for the
"one thumb, in the dark, offline, all night" low-power ethos. Directional
particles keep react-force-graph's **animation loop running continuously**, so the
canvas never truly idles → real battery cost at a live venue. Decide during
planning:

- **Recommended: focus-only particles.** Animate flow only on edges touching the
  currently-focused node (tap a song → its out/in flows animate; everything else
  stays frozen). Cheaper, and a *clearer* teaching signal than animating all
  ~thousands of edges at once. Trade-off: "for all of the paths" becomes "all
  paths of the tapped song."
- If truly all-edges-always: cap particle count hard and profile on a real phone.
- **Respect `prefers-reduced-motion`:** gate the animation off when set — reuse the
  existing helper idiom (`ConstellationCanvas.tsx:261`, `NodeSheet.tsx:62`); fall
  back to the current static arrowheads.

### Shape note

Built-in particles are filled **dots**, not arrow glyphs. If the owner
specifically wants moving *arrow* shapes (not dots), that needs a custom
`linkDirectionalParticleCanvasObject` — more work; confirm dots-as-flow are
acceptable first (they read as "moving in the arrow's direction").

## Acceptance

Tapping a song (or on load, per the chosen scope) shows animated flow travelling
the correct source→target direction along its edges; honors reduced-motion; no
perceptible frame-rate hit on a mid-range phone; edge focus tint/dim still applies
to the moving markers.
