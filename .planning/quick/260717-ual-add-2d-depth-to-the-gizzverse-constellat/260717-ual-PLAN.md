---
quick_id: 260717-ual
type: quick
title: 2D depth for the GizzVerse constellation — spherical shading + depth-scaling + occlusion + depth-edges + nebula parallax
governing_decisions: [EXPL-01, EXPL-06, spike-001]
autonomous: true
files_modified:
  - packages/core/src/explore/derive-constellation.ts
  - packages/core/test/explore/derive-constellation.test.ts
  - packages/app/src/config.ts
  - packages/app/src/explore/ConstellationCanvas.tsx
  - packages/app/src/explore/ExploreBackground.tsx

must_haves:
  truths:
    - "Each orb reads as a shaded ball (offset highlight → base → shadow), not a flat disc"
    - "Near (high-z) songs draw bigger/brighter/saturated; far (low-z) songs draw smaller/dimmer/faded toward #0C0C10 — in BOTH the caught full-color path AND the default unseen grayscale path"
    - "Near nodes overpaint far nodes (occlusion) because the drawn node array is sorted far→near"
    - "Edges connecting near nodes advance (slightly wider/brighter); far edges recede — layered onto the existing count-based width + focus tint, kept subtle"
    - "On pan/zoom the nebula backdrop translates/scales by a damped fraction of the graph transform (motion parallax), driven by onZoom only — no continuous per-frame repaint, no d3 reheat, frozen fx/fy survive"
    - "The 22px screen-space tap floor is preserved — depth never shrinks the hit area"
  artifacts:
    - path: "packages/core/src/explore/derive-constellation.ts"
      provides: "synthetic per-node z (0..1, 1=nearest) on ConstellationNode + far→near node sort for occlusion"
      contains: "z:"
    - path: "packages/core/test/explore/derive-constellation.test.ts"
      provides: "z-value + far→near draw-order + maxPlay=0 guard assertions"
      contains: "z"
    - path: "packages/app/src/explore/ConstellationCanvas.tsx"
      provides: "format-agnostic parseColor, sphereGradient, depth radius/opacity/color-fade on hex AND grayscale paths, depth-weighted edges"
      contains: "parseColor"
    - path: "packages/app/src/explore/ExploreBackground.tsx"
      provides: "optional parallax transform prop applied as a GPU compositor transform"
      contains: "parallax"
  key_links:
    - from: "packages/app/src/explore/ConstellationCanvas.tsx"
      to: "ConstellationNode.z"
      via: "node.z read in nodeCanvasObject depth-scaling + nodeZById map for depth-edges"
      pattern: "node\\.z"
    - from: "packages/app/src/explore/ConstellationCanvas.tsx"
      to: "packages/app/src/explore/ExploreBackground.tsx"
      via: "onZoom({k,x,y}) → damped parallax state → ExploreBackground prop"
      pattern: "onZoom"
---

<objective>
Give the GizzVerse (Explore) constellation a genuine sense of 2D depth/volume while
KEEPING the current `react-force-graph-2d` canvas (no three.js). Implements the
research + spike-001 validated "depth stack":

- **Tier-1** (canvas draw pass): (1) spherical shading via `createRadialGradient`,
  (2) synthetic-`z` depth-scaling of radius + opacity + color-fade toward the surface
  `#0C0C10` — applied to BOTH the caught/hex path AND the default unseen grayscale path,
  (3) occlusion by drawing nodes far→near, (4) depth-weighted edges.
- **#5** nebula parallax: on pan/zoom, translate/scale the DOM nebula by a DAMPED
  fraction of the graph transform so the sky moves slower than the constellation.

Governing constraint (verified in `force-graph` source): the canvas has
`autoPauseRedraw: true` — it repaints ONLY on interaction, never per-frame at rest.
Therefore every depth effect is baked into the draw pass or interaction-driven; NONE is
a continuous/time-based canvas animation (EXPL-06 low-power). Continuous motion stays on
the DOM nebula's compositor layer (already there). No graphData rebuild, no d3 reheat on
any depth/parallax change — frozen fx/fy survive.

Purpose: the constellation should read as a volumetric cloud of stars, not a flat sheet.
Output: a pure-core `z` axis + far→near sort (fixture-tested), an app-side depth draw
pass (spherical shading, depth-scaling incl. grayscale, depth-edges, format-agnostic
color helpers), and onZoom-driven nebula parallax.
</objective>

<key_design_decisions>

**D-A — Where `z` lives: Option A (core `deriveConstellation`), CHOSEN.**
`z` is added to `ConstellationNode` in the pure core derive, and the returned
`nodes` array is sorted **far→near** (ascending `z`). Rationale:
- Occlusion requires the drawn node array itself to be ordered far→near. **VERIFIED**
  in `node_modules/force-graph/dist/force-graph.mjs:557–559`: the paint loop is
  `state.graphData.nodes.filter(getVisibility).forEach(...)` — `.filter()` preserves
  array order and `.forEach` iterates it, so the library draws nodes in
  `graphData.nodes` array order. A one-time far→near sort at derive time therefore
  gives correct occlusion (nearest painted last = on top). Occlusion is NOT blocked.
- Keeps the single pipeline (CLAUDE.md): one deterministic, pure, Node-CLI-runnable,
  unit-tested place owns depth ordering. Future z-source swaps (degree/hash) change one
  function.
- Order-independence of downstream consumers is preserved (confirm during T1, no code
  change expected): `topKIds` sorts a COPY (`[...graphData.nodes].sort`), `connectedIds`
  / `neighborIds` / `keptLinkSet` build from `links` or from Sets, `onEngineStop`
  iterates nodes to set fx/fy (order-agnostic), `zoomToFit` uses a predicate. Only the
  DRAW order and the initial sim seed order change — both deterministic.

**D-B — `z` source: normalized playCount, gentle depth factors (default). [ASSUMED]**
`z = sqrt(playCount) / sqrt(maxPlayCount)` ∈ [0,1], 1 = nearest. Chosen over an
orthogonal hash/degree axis because a stated constraint is **preserving legibility**:
playCount-z keeps the important hubs forward (near = big/bright), so depth never pushes a
key node into the dim/shrunk background. It intentionally REINFORCES the existing
`sqrt(playCount)` radius hierarchy (spike flagged the double-count as "exaggerated but
fine" and confirmed it "reads as a depth cue"). The `sqrt` normalization matches the
radius's own `sqrt` and compresses the power-law so most nodes aren't crushed to `z≈0`.
All VISUAL shaping (how much radius/opacity/fade z drives) is app-side config so the
owner can tune, and the derivation is one function so swapping to a hash/degree z later
is a one-spot change. Tradeoff noted: depth is correlated with size rather than an
independent scatter — accepted for legibility.

**D-C — No core config, no configMirror churn.** `z` normalization needs only
`playCount` + `maxPlayCount` (data-derived, no tunable constant). ALL depth tunables land
in `config.explore` (app-side render constants, consistent with `NODE_RADIUS_*` /
`CHARGE_STRENGTH`). The core↔app mirror (`configMirror.test`) is untouched.

**D-D — How depth alpha folds into the existing dim contract.** Today
`alpha = min(focusAlpha, dexAlpha)`. Depth adds a `depthAlpha = lerp(FAR, NEAR, z)`.
Chosen combine: `alpha = max(DEPTH_ALPHA_FLOOR, min(focusAlpha, dexAlpha) * depthAlpha)`
— a GENTLE multiply so the near/far opacity gradient reads even in the default
all-grayscale view (spike finding #2), with a hard `DEPTH_ALPHA_FLOOR` clamp so a
far + focus-dimmed node never vanishes (the spike's naked multiply risk). Radius
depth-scaling + color-fade toward `#0C0C10` are NOT alpha-gated, so far/near contrast
still reads under the uniform 0.35 dex-dim veil. Preserve tuning HUE — only
shade/scale/fade it.

**D-E — Parallax seam: keep it inside ConstellationCanvas.** `ExploreBackground` is
already rendered as the first child of the canvas wrapper (`ConstellationCanvas` line
~458). Cleanest seam = hold the parallax transform as state IN `ConstellationCanvas`,
set it from the `onZoom` callback, pass it to `ExploreBackground` as a prop. No need to
lift to `ExploreView`. `onZoom` fires only during interaction (respects
`autoPauseRedraw`/EXPL-06). Confirmed the prop exists:
`react-force-graph-2d` exposes `onZoom` (fires with the `{k,x,y}` transform).
</key_design_decisions>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/spikes/001-constellation-depth-shading/README.md
@packages/core/src/explore/derive-constellation.ts
@packages/core/test/explore/derive-constellation.test.ts
@packages/app/src/explore/ConstellationCanvas.tsx
@packages/app/src/explore/ExploreBackground.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Core — add synthetic z + far→near sort to deriveConstellation</name>
  <files>packages/core/src/explore/derive-constellation.ts, packages/core/test/explore/derive-constellation.test.ts</files>
  <behavior>
    - z is normalized playCount depth: `z = sqrt(playCount) / sqrt(maxPlayCount)` ∈ [0,1], the max-playCount node → z = 1 (nearest).
    - maxPlayCount = the largest playCount across `matrix.nodes`. Guard: when maxPlayCount === 0 (empty/degenerate corpus), every node's z = 0 (no divide-by-zero, no NaN — this is the spike bug #1 root cause class; never emit NaN).
    - The returned `nodes` array is sorted FAR→NEAR: ascending z primary, ascending songId as the deterministic tie-break (so equal-playCount nodes keep a stable, fixture-reproducible order and the nearest node is drawn LAST for occlusion).
    - links output is unchanged (source/target/count/segueCount/fromId/toId).
  </behavior>
  <action>
    Add a required `z: number` field to the `ConstellationNode` interface (doc: "synthetic depth 0..1, 1 = nearest camera; drives app-side spherical depth-scaling + occlusion draw order; far→near sorted"). In `deriveConstellation`, compute `maxPlayCount` over `matrix.nodes`, then map each node to include `z` per the behavior (guard maxPlayCount===0 → z=0). Replace the current `.sort((a,b) => a.id - b.id)` with a far→near comparator: `(a,b) => a.z - b.z || a.id - b.id`. Keep the function pure (no I/O, no React/DOM) and Node-CLI-runnable. Update the file's doc comment to note the array is now far→near-ordered for occlusion, citing that the renderer draws in `graphData.nodes` array order (force-graph paint loop). Do NOT add any config constant — z uses only playCount + maxPlayCount, so `config.explore` (core) and the configMirror are untouched.
    In the test file: update the existing "maps nodes ... sorted by songId" assertion — with the fixture (Robot Stop=100, Gamma Knife=50, Rattlesnake=200) far→near order is now [20, 10, 30] (Gamma Knife z-min first, Rattlesnake z=1 last). Rename/retarget that test to assert the far→near order AND assert z values: Rattlesnake (max play) z===1, Gamma Knife z===sqrt(50)/sqrt(200) (0.5), Robot Stop z===sqrt(100)/sqrt(200). Add a new test: a matrix whose nodes all have playCount 0 → every node z===0 and no NaN (deterministic songId order preserved). Keep the existing links / edgesAtThreshold / topKEdgesPerNode tests green (they read links or build own equal-playCount nodes; the z tie-break keeps their id order stable).
  </action>
  <verify>
    <automated>cd "C:/Users/mattf/git/guezzer" && npx vitest run packages/core/test/explore/derive-constellation.test.ts && npx tsc -p packages/core/tsconfig.json --noEmit && npx vitest run packages/app/test/configMirror.test.ts</automated>
  </verify>
  <done>ConstellationNode carries a deterministic `z` (0..1, 1=nearest); deriveConstellation returns nodes far→near; new + updated tests pass; core tsc clean; configMirror still green (no core config touched).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: App canvas — spherical shading + depth-scaling (incl. grayscale) + depth-weighted edges + format-agnostic color helpers</name>
  <files>packages/app/src/config.ts, packages/app/src/explore/ConstellationCanvas.tsx</files>
  <behavior>
    - `parseColor(str)` returns `{r,g,b}` for BOTH `#RRGGBB` and `rgb(r,g,b)` inputs (the two formats the draw pass produces: `tuningColor` hex and `grayscaleOf`/depth-faded rgb). It NEVER yields NaN — this is spike bug #1: the old helper assumed hex and parsed `rgb(...)` into `NaN`, throwing `addColorStop('rgb(NaN,...)')`.
    - A `sphereGradient(ctx, x, y, r, baseColor)` builds a `createRadialGradient` (offset highlight stop → base stop → shadow stop) using `parseColor`, so it shades hex AND rgb bases identically.
    - Depth-scaling from `node.z`: visual radius = `radiusFor(playCount) * lerp(DEPTH_RADIUS_FAR, DEPTH_RADIUS_NEAR, z)`; base color faded toward `#0C0C10` by `(1-z) * DEPTH_FADE_MAX`; `depthAlpha = lerp(DEPTH_OPACITY_FAR, DEPTH_OPACITY_NEAR, z)`. Applied to the unseen GRAYSCALE path too (fade the `grayscaleOf` rgb value), not just caught/hex — so depth reads in the default overlay-ON, zero-catch view (spike finding #2).
    - Combined node alpha = `max(DEPTH_ALPHA_FLOOR, min(focusAlpha, dexAlpha) * depthAlpha)` (D-D) — far/near opacity reads, nothing vanishes.
    - Depth-weighted edges: per-edge depth = z of its endpoints (avg via a `nodeZById` map keyed on fromId/toId, Pitfall 1); width scaled by `lerp(DEPTH_EDGE_WIDTH_FAR, DEPTH_EDGE_WIDTH_NEAR, edgeZ)` on top of the existing count-based width; edge alpha modulated by `lerp(DEPTH_EDGE_OPACITY_FAR, DEPTH_EDGE_OPACITY_NEAR, edgeZ)` — subtle, and the focus highlight/dim precedence (§B3/§B4) still wins.
    - Preserved: tuning HUE (only shaded/scaled/faded), gold focus ring, green sighting ring, count pill, labels (zoom-gated + top-K + focus-forced), and the 22px tap floor — `nodePointerAreaPaint` keeps using the UNSCALED `radiusFor(playCount)` floored at `NODE_HIT_MIN_RADIUS_PX/globalScale`, so depth radius-shrink NEVER reduces the hit area.
  </behavior>
  <action>
    In `config.explore` add a documented `[ASSUMED]` depth block (single-config ethos — no magic numbers in the component): DEPTH_RADIUS_NEAR / DEPTH_RADIUS_FAR (radius multipliers, e.g. near 1.25 / far 0.7), DEPTH_OPACITY_NEAR / DEPTH_OPACITY_FAR (e.g. 1.0 / 0.6), DEPTH_FADE_MAX (max color-fade toward surface for the farthest node, e.g. 0.55), DEPTH_ALPHA_FLOOR (e.g. 0.1), gradient shape GRAD_HIGHLIGHT_OFFSET (fraction of r the highlight center is offset, e.g. 0.35), GRAD_HIGHLIGHT_LIGHTEN (0..1 toward white, e.g. 0.5), GRAD_SHADOW_DARKEN (0..1 toward black, e.g. 0.45), and depth-edge weights DEPTH_EDGE_WIDTH_NEAR/FAR (e.g. 1.15/0.75) + DEPTH_EDGE_OPACITY_NEAR/FAR (e.g. 1.0/0.55). Add a surface constant reuse for `#0C0C10` (a local `DEPTH_SURFACE = "#0C0C10"` const near the other color consts, matching SIGHTING_COUNT_TEXT's value — do not re-derive it magically inline).
    In `ConstellationCanvas.tsx`: add `parseColor` (accepts `#RRGGBB` AND `rgb(r,g,b)`; regex/split both, never NaN), a format-agnostic `mixColor(a,b,t)` / `fadeToward(color, target, t)` built on parseColor, and `sphereGradient(ctx,x,y,r,baseColor)` (radial gradient: highlight = fadeToward(base, white, GRAD_HIGHLIGHT_LIGHTEN) at an offset inner circle, mid = base, outer = fadeToward(base, black, GRAD_SHADOW_DARKEN)). In `nodeCanvasObject`: derive `z = node.z`; compute the depth radius (visual only), `depthAlpha`, and the depth-faded base (`fadeToward(baseColor or grayscaleOf(baseColor), DEPTH_SURFACE, (1-z)*DEPTH_FADE_MAX)`). Replace the flat `ctx.fill()` disc fill (step 1) with `sphereGradient(...)` over the depth-faded base for BOTH the unseen grayscale and the caught/overlay-off color paths. Set `ctx.globalAlpha` per D-D. Keep the sighting ring / focus ring / count pill / label steps unchanged EXCEPT they use the depth-scaled visual radius for their offsets so rings hug the shaded ball. Add a memoized `nodeZById: Map<number, number>` (from `graphData.nodes`), and fold depth weighting into `edgeColor` (opacity) and the `linkWidth` callback (width) using the endpoints' avg z — layered under the existing count width + focus tint, kept subtle. Leave `nodePointerAreaPaint` reading the UNSCALED `radiusFor(playCount)` (22px floor preserved — do NOT apply depth radius scaling to the hit area).
  </action>
  <verify>
    <automated>cd "C:/Users/mattf/git/guezzer" && npx tsc -p packages/app/tsconfig.json --noEmit && npx vitest run packages/app</automated>
  </verify>
  <done>Orbs render as shaded balls with depth radius/opacity/color-fade on both caught + grayscale paths; parseColor handles hex + rgb with no NaN; edges are subtly depth-weighted; hue + rings + labels + 22px hit floor preserved; app tsc clean, app tests green. (Visual/perf correctness — the ball look + occlusion + 264-node smoothness — is an owner on-device follow-up, NOT provable by tests; the spike already de-risked the ball look + desktop perf.)</done>
  </task>

<task type="auto">
  <name>Task 3: Nebula parallax — onZoom-driven damped transform on ExploreBackground</name>
  <files>packages/app/src/config.ts, packages/app/src/explore/ExploreBackground.tsx, packages/app/src/explore/ConstellationCanvas.tsx</files>
  <action>
    In `config.explore.background` add `[ASSUMED]` parallax tunables (single-config ethos): PARALLAX_TRANSLATE_DAMP (fraction of the graph pan the sky follows, e.g. 0.15 — sky moves slower than the constellation) and PARALLAX_ZOOM_DAMP (fraction of the graph zoom the sky scales with, e.g. 0.05, applied as `1 + (k-1)*damp`). Document that these drive a compositor transform on the nebula, interaction-driven only (EXPL-06), no continuous loop.
    In `ExploreBackground.tsx`: accept an optional `parallax?: { x: number; y: number; k: number }` prop (default undefined → no transform, current behavior byte-identical). Apply it as a GPU transform (`transform: translate3d(px, py, 0) scale(s)`, `willChange: transform`) on the ROOT `aria-hidden` container so it composes ABOVE the per-bloom drift keyframes (the `.explore-bg-bloom` children keep their independent drift transforms — do not touch those). Keep `pointer-events-none` + `aria-hidden`. Honor reduced motion: when `window.matchMedia('(prefers-reduced-motion: reduce)')` matches, ignore the parallax and stay static (mirrors the nebula's existing reduced-motion gating) — read it once (memo/state), no per-frame checks.
    In `ConstellationCanvas.tsx`: add a `bgParallax` state (`{x,y,k}` or null). Wire `onZoom={(t) => setBgParallax({ x: t.x, y: t.y, k: t.k })}` on `<ForceGraph2D>` (fires ONLY during interaction — respects autoPauseRedraw/EXPL-06). Compute the damped values and pass them to `<ExploreBackground parallax={...} />`: `x = t.x * PARALLAX_TRANSLATE_DAMP`, `y = t.y * PARALLAX_TRANSLATE_DAMP`, `k = 1 + (t.k - 1) * PARALLAX_ZOOM_DAMP`. Do NOT rebuild graphData, do NOT reheat, do NOT touch fx/fy — this is a pure sibling CSS transform. Confirm the onZoom handler adds no dependency that re-derives the graph.
  </action>
  <verify>
    <automated>cd "C:/Users/mattf/git/guezzer" && npx tsc -p packages/app/tsconfig.json --noEmit && npx vitest run packages/app</automated>
  </verify>
  <done>Panning/zooming the constellation translates + scales the nebula by a damped fraction (motion parallax), driven by onZoom only; reduced-motion keeps the sky static; no graphData rebuild / reheat; frozen fx/fy survive; app tsc clean, app tests green. (On-device eyeball of the parallax feel is an owner follow-up.)</done>
</task>

</tasks>

<verification>
- Core: `npx vitest run packages/core/test/explore/derive-constellation.test.ts` green (z + far→near + maxPlay=0 guard); `npx tsc -p packages/core/tsconfig.json --noEmit` clean.
- Mirror: `npx vitest run packages/app/test/configMirror.test.ts` green (unchanged — no core config touched).
- App: `npx tsc -p packages/app/tsconfig.json --noEmit` clean; `npx vitest run packages/app` green.
- EXPL-06 self-audit (code review, not a test): no continuous/time-based canvas animation added; every depth effect is baked into the draw pass; parallax is onZoom-driven only; no depth/parallax change rebuilds graphData or reheats d3; frozen fx/fy untouched.
- Owner on-device follow-up (NOT provable by tests): the shaded ball look, correct occlusion (near over far), subtle depth-edges, and 264-node pan/zoom smoothness + parallax feel on the iPhone. The spike already de-risked the ball look + desktop perf.
</verification>

<success_criteria>
- ConstellationNode carries a deterministic synthetic `z`; nodes returned far→near so the library's array-order paint yields correct occlusion.
- Orbs read as shaded volumetric balls; near = bigger/brighter/saturated, far = smaller/dimmer/faded toward #0C0C10 — in BOTH the caught color path AND the default unseen grayscale path.
- Color helpers handle `#hex` AND `rgb()` with zero NaN (spike bug #1 fixed).
- Edges are subtly depth-weighted, layered under the existing count width + focus tint.
- The nebula parallaxes on pan/zoom (damped, onZoom-driven), static under reduced-motion.
- Preserved: tuning hue, gold focus ring, green sighting ring, count pill, all label rules, top-K declutter + curved links, dex/focus dim contract, and the 22px tap floor.
- All automated verifications pass; single-config ethos + strict core/UI separation + EXPL-06 upheld.
</success_criteria>

<output>
Update the quick task SUMMARY when done: `.planning/quick/260717-ual-add-2d-depth-to-the-gizzverse-constellat/260717-ual-SUMMARY.md`
</output>
