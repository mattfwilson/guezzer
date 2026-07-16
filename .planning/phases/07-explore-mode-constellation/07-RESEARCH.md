# Phase 7: Explore Mode Constellation - Research

**Researched:** 2026-07-16
**Domain:** Force-directed canvas graph rendering (react-force-graph-2d) over a pure-core-derived transition graph; mobile PWA
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Bars show **raw historical transition %** straight from matrix edges — NOT live `predict()` scoring. Explore has no `ShowContext`. Do NOT wire the predictor into Explore.
- **D-02:** Each bar's "why" line = counts + dates straight off the edge record (`count`, `total`, `lastDate`, `segueCount`). Zero new derivation.
- **D-03:** The panel always shows a node's **complete outgoing history**, independent of the edge slider and rotation toggle. Graph filters are visual-only.
- **D-04:** **Top 10 bars + "show all N" expander** for the long tail.
- **D-05:** "Active rotation" = songs played in the **last N shows**, derived from the Phase 6 `@archive` artifact — NOT the matrix's `eraPlayCount`.
- **D-06:** Default N is **data-driven** (this doc closes it: **N=5 → 56 nodes**). Config constant.
- **D-07:** Edge slider filters by **transition count** ("played together ≥ X times"). Default data-driven (**threshold=2**). Config constant.
- **D-08:** When the slider hides all of a node's edges, the **node stays visible as a free-floating star**. Population never churns with the slider.
- **D-09:** All Explore controls live in a **collapsed filter FAB** (bottom-right, Phase 6 FabMenu idiom): rotation/full toggle + edge slider + dex-overlay switch. Graph stays visible while sliding; **no scrim**.
- **D-10:** **Dex overlay is ON by default** — caught lit, unseen dimmed silhouettes. Toggle restores neutral tuning-family view.
- **D-11:** Sighting counts render as a **ring on every caught node**; the count **number** draws only past a zoom threshold.
- **D-12:** Rotation window N is **config-only** — one binary Rotation/Full toggle, no second slider.
- **D-13:** A single tap does **both** — highlight neighborhood + dim the rest AND open the ranked-bars panel. Tap empty canvas clears both.
- **D-14:** The panel is a **partial bottom sheet (~40% height)**; drag up for full list, swipe down to dismiss. Existing sheet idiom.
- **D-15:** Labels are **zoom-gated + focus-forced**. At rest no labels (or a handful on the biggest nodes); fade in past a `globalScale` threshold; a focused node + neighbors are ALWAYS labeled.
- **D-16:** **Tapping a bar chain-hops** — selects that song, pans/refocuses, reloads the sheet with its outgoing bars.

### Claude's Discretion
- Exact data-driven defaults for N and edge-count threshold (**resolved below with real numbers**).
- Force-simulation tuning (`d3AlphaDecay`, `d3VelocityDecay`, `cooldownTicks`) and freeze mechanics via `onEngineStop`.
- Whether the canvas-label spike runs as an early plan task or a research prototype — D-15's zoom-gating is the decided answer to spike against.
- Pure core graph-derivation function design (fixture-tested).
- Zoom thresholds, ring styling, dim opacities, sheet snap points (subject to `/gsd-ui-phase` — **already produced 07-UI-SPEC.md**).
- Whether the biggest-nodes-at-rest label allowance (D-15) is used, and K if so.
- Physics re-run behavior when toggling rotation/full or overlay (reheat vs preserve) — **bias toward preserving positions; the sky must feel stable**.

### Deferred Ideas (OUT OF SCOPE)
- Era slider scrubbing the constellation through time (EXPL-V2-01 — v1.5/v2).
- Model-view toggle on the bars panel (live `predict()` alongside raw history) — rejected for v1.
- UI slider for rotation window N — rejected (config-only).
- Any change to prediction scoring, the matrix schema, or Show Mode.
- 3D/VR modes / the umbrella `react-force-graph` package.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPL-01 | Force-directed constellation from the SAME matrix JSON, one pipeline, single component | `ConstellationCanvas` wraps `ForceGraph2D`; pure core `deriveConstellation(matrix) → {nodes, links}`; loaded via the existing `@matrix` guarded loader (§Standard Stack, §Architecture) |
| EXPL-02 | Tap a node → ranked outgoing next-song bars with raw % + honest "why" | Pure core `rankOutgoing(matrix, songId)` returns complete outgoing history with count/total/lastDate/segueCount (§Core Functions); `NodeSheet` + `RankedBar` render it |
| EXPL-03 | Default view = current-era active rotation + full-catalog toggle | `rotationSongIds(archive, N=5)` over `@archive` shows (newest-first); toggle switches the node population (§Core Functions, §Data-Driven Defaults) |
| EXPL-04 | Count-based edge-hiding slider | Render-pass filter on `link.count ≥ threshold`; default 2 kills all 1,946 one-play edges; nodes stay (D-08) (§Data-Driven Defaults) |
| EXPL-05 | Neighborhood highlight / dim-the-rest (focus+context) | Focus-dim to 12% outside focused node + direct neighbors; computed from the derived link adjacency (§Architecture, UI-SPEC §B4) |
| EXPL-06 | Physics settles and freezes; labels never jitter permanently | `cooldownTicks 200` + `onEngineStop` → set `fx=x, fy=y` on every node; pan/zoom never reheats (§Settle-and-Freeze) |
| DEX-05 | Personal-dex overlay — dimmed silhouettes unseen, full color + sighting ring caught | `useDexStats().dex.perSong` provides `sightings` per songId; `nodeCanvasObject` renders ring + zoom-gated count; `useLiveQuery` recolors live (§Dex Overlay Wiring) |
</phase_requirements>

## Summary

Phase 7 is a **rendering + pure-derivation** phase with an unusually complete upstream contract: `07-CONTEXT.md` (D-01..D-16) and `07-UI-SPEC.md` between them already fix the library, every visual constant, the copy, and the data-driven defaults. This research **verifies** those decisions against the real artifacts and the real library API rather than re-opening them, and fills the genuine technical gaps: the exact `react-force-graph-2d` prop surface the planner will reference, the object-mutation and container-sizing gotchas that bite first-time users of this library, the pure-core function shapes, and the integration seams in the existing codebase.

Every data-driven default in the UI-SPEC was **independently recomputed from the shipped artifacts and matches exactly**: rotation window **N=5 → 56 distinct songs** (mid-band of the ~40–80 target), edge-count threshold **≥2** removes all **1,946 one-play edges (65.1%)** and leaves a **56-node / 174-edge** default subgraph. The library is confirmed on npm (`react-force-graph-2d@1.29.1`, published 2026-02-04), rates `[OK]` on slopcheck, and its `-2d` dependency tree contains **zero three.js** (the umbrella package's VR deps live only in `react-force-graph`, confirming the CLAUDE.md ban rationale).

**Primary recommendation:** Build one `ConstellationCanvas` component wrapping `<ForceGraph2D>` fed by a pure core `deriveConstellation(matrix) → {nodes, links}` whose node objects carry `id: songId` and link objects carry `source: from, target: to` (the library's default accessors). Render everything through a single `nodeCanvasObject(node, ctx, globalScale)` (mode `'replace'`) — fill, dex-dim, sighting ring, zoom-gated label and count all keyed off `globalScale`. Freeze on `onEngineStop` by writing `fx/fy`. Keep all derivation, rotation filtering, threshold logic, and bar ranking in fixture-tested core functions; the component only renders and handles gestures.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `matrix JSON → {nodes, links}` derivation | Core (pure, `packages/core`) | — | CLAUDE.md hard constraint: zero React/DOM in core; one pipeline from the artifact |
| Rotation filter (last-N-shows song set) | Core (pure) | — | D-05 derives from `@archive`; fixture-testable with known outputs |
| Edge-count threshold filter | App (render-pass) | Core (helper predicate) | D-08: visual-only, must not churn node population; cheapest as a per-render `links.filter` |
| Outgoing-bar ranking (top-10 + full history) | Core (pure) | — | D-01..D-04: complete history independent of visual filters; fixture-tested |
| Force simulation + freeze | App (library) | — | `react-force-graph-2d` owns physics; app tunes decay/cooldown and freezes on stop |
| Node/edge/label/ring canvas draw | App (component) | — | Canvas 2D context; first non-DOM view; keyed off library `globalScale` |
| Dex overlay (seen/unseen + sighting count) | App (hook) | Core (`deriveDex` already exists) | `useDexStats` already derives `perSong.sightings`; overlay is a read, no new derivation |
| Focus/filter/sheet UI state | App (component state) | — | Local `useState` in `ExploreView`; no Dexie writes this phase |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-force-graph-2d` | 1.29.1 | Canvas force-directed graph renderer | CLAUDE.md lock. Wraps `force-graph` (canvas engine) + d3-force; built-in mobile pan/zoom/hit-test, `cooldownTicks`/`onEngineStop` settle-and-freeze, `nodeCanvasObject` custom draw, `onNodeClick`/`onBackgroundClick`. `[VERIFIED: npm registry]` published 2026-02-04, slopcheck `[OK]`. |

**No other new runtime dependency.** React 19.2.7, Dexie 4.4.4, dexie-react-hooks, lucide-react, Tailwind v4 are all already installed and reused.

### Supporting (already in the workspace — reuse, do not re-add)
| Library / Module | Purpose | When to Use |
|---------|---------|-------------|
| `@matrix` alias + `packages/app/src/show/matrix.ts` `loadMatrix()` | Guarded bundled matrix load (schemaVersion sentinel) | ExploreView loads the matrix; `{ok:false}` → error state, never a throw |
| `@archive` alias + `packages/app/src/dex/archive-loader.ts` `loadArchive()` | Guarded bundled archive load | Rotation filter's `shows` source (D-05) |
| `packages/app/src/dex/useDexStats.ts` | Reactive dex derivation (`dex.perSong` sightings, `neverSeen`) | Dex overlay (DEX-05); `useLiveQuery` recolors live |
| `packages/app/src/show/tuningColor.ts` `tuningColor()` | `TuningFamily → hex` | Node fills + bar fills — reuse VERBATIM, keyed on the core union not the display label |
| `packages/core/src/dex/archive-types.ts` `ArchiveArtifact`/`ArchiveShow` | Archive shapes the rotation filter consumes | Core `rotationSongIds` input types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-force-graph-2d` | Direct d3-force + custom SVG/canvas | CLAUDE.md fallback ladder: budget 1–2 weeks to hand-build mobile pan/zoom/hit-testing/lifecycle. Only if the library's customization ceiling blocks a requirement — research found no such block. |
| `react-force-graph-2d` | `react-force-graph` (umbrella) | **BANNED** — pulls three.js/A-Frame/VR. Confirmed: `-2d` deps are `force-graph`, `prop-types`, `react-kapsule` only; no three.js. |

**Installation (app package only):**
```bash
pnpm --filter @guezzer/app add react-force-graph-2d@1.29.1
```
Core stays React/DOM-free — the derivation is a pure core function, the renderer is app-side.

**Version verification (performed this session):**
```
npm view react-force-graph-2d@1.29.1  → version 1.29.1, published 2026-02-04, deps: force-graph ^1.51, prop-types 15, react-kapsule ^2.5
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-force-graph-2d | npm | published 2026-02-04 (1.29.1); project ~7 yrs | high (established viz lib) | github.com/vasturiano/react-force-graph | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Notes: The `-2d` transitive tree (`force-graph` → `d3-force-3d`, `d3-zoom`, `d3-drag`, `@tweenjs/tween.js`, `canvas-color-tracker`, `lodash-es`, etc.) was inspected and contains **no three.js / A-Frame**. `npm view react-force-graph-2d@1.29.1 scripts.postinstall` returned nothing — no postinstall script. Maintained by `vasturiano`, the well-known d3/three viz author. `[VERIFIED: npm registry]`.

> **Note on the internal force engine:** the engine transitively depends on `d3-force-3d` (a superset of `d3-force`), NOT the standalone `d3-force` package. We never import d3-force directly, so **do not add a separate `d3-force` dependency** despite CLAUDE.md naming "d3-force 3.0.0" — that constant refers to the algorithm, which ships inside `force-graph`.

## Architecture Patterns

### System Architecture Diagram

```
                       BUILD-TIME ARTIFACTS (static, bundled)
   data/normalized/transition-matrix.json      data/normalized/archive.json
   (264 nodes / 2,987 edges, schemaVersion 1)   (738 shows, newest-first, songs map)
                 │                                        │
        @matrix alias                              @archive alias
                 │                                        │
       loadMatrix() guard                        loadArchive() guard
        (schemaVersion===1)                        (schemaVersion===1)
                 │                                        │
                 ▼                                        ▼
   ┌─────────────────────────────── CORE (pure, no React/DOM) ──────────────────────────────┐
   │  deriveConstellation(matrix)          rotationSongIds(archive, N=5)                     │
   │    → {nodes:[{id,...}], links:[{source,target,count,segueCount,...}]}   → Set<songId>   │
   │  rankOutgoing(matrix, songId) → { total, bars:[{songId,name,pct,count,lastDate,...}] }  │
   └───────────┬──────────────────────────────┬───────────────────────────┬─────────────────┘
               │ {nodes,links}                 │ rotation Set              │ ranked bars
               ▼                               ▼                           ▼
   ┌───────────────────────── APP: ExploreView (#/explore, scroll=false) ─────────────────────┐
   │  focus/filter/overlay useState        useDexStats() ──── useLiveQuery (reactive) ──────┐  │
   │        │                                    │  dex.perSong[songId].sightings           │  │
   │        ▼                                    ▼  neverSeen                                │  │
   │  ┌──────────────────────┐   ┌────────────────────┐   ┌─────────────────────────────┐   │  │
   │  │ ConstellationCanvas  │   │ ExploreFilterFab / │   │ NodeSheet (40% peek)        │   │  │
   │  │ <ForceGraph2D>       │◄──│ ExploreFilterPanel │   │  → RankedBar (chain-hop) ───┼───┘  │
   │  │ nodeCanvasObject     │   │ Rotation|Full,     │   │  header + top10 + expander  │      │
   │  │ (globalScale-gated)  │   │ edge slider,       │   └──────────────┬──────────────┘      │
   │  │ onNodeClick/Bg,      │   │ overlay switch     │                  │ tap bar = new focus  │
   │  │ cooldownTicks+        │   └────────────────────┘                  │ (centerAt+zoom)     │
   │  │ onEngineStop(fx=x)   │◄──────────────── focus/filter state ───────┘                     │
   │  └──────────────────────┘                                                                 │
   └──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Structure (extends existing dirs)
```
packages/core/src/explore/           # NEW pure-derivation module (mirrors dex/)
├── derive-constellation.ts          # deriveConstellation(matrix) → {nodes, links}
├── rotation.ts                      # rotationSongIds(archive, N) → Set<songId>
└── rank-outgoing.ts                 # rankOutgoing(matrix, songId) → bars payload
packages/core/test/explore/          # NEW fixture tests (node env)
packages/app/src/explore/            # NEW app view module (mirrors show/, dex/)
├── ExploreView.tsx                  # replaces PlaceholderView at #/explore
├── ConstellationCanvas.tsx          # the single graph component (EXPL-01)
├── ExploreFilterFab.tsx / ExploreFilterPanel.tsx
├── NodeSheet.tsx / RankedBar.tsx
└── constellationColors.ts           # dim/ring helpers over tuningColor (optional)
```

### Pattern 1: Library graphData accessors — map to defaults in the derivation
**What:** `ForceGraph2D` defaults are `nodeId="id"`, `linkSource="source"`, `linkTarget="target"`. The matrix uses `songId`, `from`, `to`.
**When:** In `deriveConstellation` — emit the library's expected keys so no accessor props are needed.
```typescript
// Source: react-force-graph README (vasturiano/react-force-graph) — verified 2026-07-16
// Node objects carry id + the fields the canvas draw needs:
{ id: node.songId, name: node.songName, playCount: node.playCount, tuningFamily: node.tuningFamily }
// Link objects use source/target (default accessors), keep count/segueCount for width + slider:
{ source: edge.from, target: edge.to, count: edge.count, segueCount: edge.segueCount }
```
Alternatively set `nodeId="songId"` etc., but emitting defaults keeps the component prop list minimal.

### Pattern 2: Single `nodeCanvasObject` with `globalScale`-gated layers (mode `'replace'`)
```typescript
// Source: react-force-graph README — nodeCanvasObject(node, ctx, globalScale); nodeCanvasObjectMode='replace'
// globalScale is the current zoom factor — the single lever for D-11/D-15 gating.
nodeCanvasObject={(node, ctx, globalScale) => {
  const r = radiusFor(node.playCount);            // sqrt-scaled, NODE_RADIUS_MIN..MAX (world units)
  // 1. fill (tuning color, dex-dim to 0.35 if overlay+unseen, focus-dim to 0.12 if not in neighborhood)
  // 2. sighting ring (#22C55E) if overlay ON && caught
  // 3. count number if globalScale >= COUNT_ZOOM_THRESHOLD (2.5)
  // 4. label if globalScale >= LABEL_ZOOM_THRESHOLD (1.5) OR node is top-K-at-rest OR node is focused/neighbor
  //    draw at fontSizePx/globalScale world units for constant screen-space size
}}
nodeCanvasObjectMode={() => 'replace'}   // we draw everything; skip the default circle
```

### Pattern 3: Pointer-area floor independent of visual radius (44px tap)
```typescript
// Source: react-force-graph README — nodePointerAreaPaint(node, color, ctx, globalScale)
nodePointerAreaPaint={(node, color, ctx, globalScale) => {
  const hitR = Math.max(radiusFor(node.playCount), NODE_HIT_MIN_RADIUS_PX / globalScale); // 22px screen → world
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(node.x, node.y, hitR, 0, 2 * Math.PI); ctx.fill();
}}
```

### Pattern 4: Settle-and-freeze (EXPL-06)
```typescript
// Source: react-force-graph README — cooldownTicks + onEngineStop; node x/y + fx/fy are mutable props
<ForceGraph2D
  cooldownTicks={200}          // app config COOLDOWN_TICKS
  d3AlphaDecay={0.035}         // ALPHA_DECAY
  d3VelocityDecay={0.45}       // VELOCITY_DECAY
  warmupTicks={/* optional pre-warm to shorten visible motion, esp. prefers-reduced-motion */}
  onEngineStop={() => graphData.nodes.forEach(n => { n.fx = n.x; n.fy = n.y; })}
/>
// Pan/zoom never reheats. Filter/overlay changes keep fx/fy on survivors (positions preserved, discretion-decided).
```

### Pattern 5: Imperative camera for chain-hop (D-16)
```typescript
// Source: react-force-graph README — centerAt([x],[y],[ms]) and zoom([k],[ms]) are ref methods
const fgRef = useRef<ForceGraphMethods>(null);
// on node/bar focus: pan the node into the upper 60% so the 40% sheet never covers it
fgRef.current?.centerAt(node.x, node.y - viewportBiasWorldUnits, 400);
fgRef.current?.zoom(targetK, 400);
```

### Anti-Patterns to Avoid
- **Wiring `predict()` / `ShowContext` into Explore** (D-01). Bars are raw edge % only. Explore has no trail/rotation state.
- **Letting the edge slider add/remove nodes** (D-08). Slider filters `links` only; node array is constant within a rotation/full selection.
- **Computing bars from the *drawn* (filtered) links** (D-03). `rankOutgoing` reads the FULL matrix edge list for the tapped songId, always.
- **A second graph pipeline for the constellation** (CLAUDE.md / PROJECT.md). One `deriveConstellation` from the same `@matrix` artifact the predictor uses.
- **Reheating layout on every overlay/slider change.** Overlay + slider are pure render-pass; only Rotation→Full spawns new nodes and does a low-alpha reheat of unfixed nodes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force simulation + settle/freeze | Custom d3-force lifecycle in React | `react-force-graph-2d` `cooldownTicks`/`onEngineStop` | Weeks of React↔simulation lifecycle work; library owns it |
| Mobile pan/zoom/hit-testing on canvas | Manual pointer math + transform matrix | Library's built-in canvas interaction (`d3-zoom`/`d3-drag` inside `force-graph`) | Pinch/pan/tap on dense graphs is a deep well of edge cases |
| Node color mapping | New palette | `tuningColor()` from `show/tuningColor.ts` | Already the app-wide data palette; keyed on the core union |
| Seen/unseen + sighting counts | New attendance derivation | `useDexStats().dex.perSong` | Single derivation path; `useLiveQuery` reactivity for free |
| Last-N-shows song set | Re-parse corpus | `rotationSongIds(archive, N)` over the compact `@archive` `shows` (newest-first) | Archive is the already-shipped, compact source (D-05) |
| Matrix load + schema guard | New loader | `loadMatrix()` | Existing guarded sentinel → error state, memoized |
| Bottom sheet / FAB chrome | New components | Extend TrailNodeSheet/ShareCardSheet + FabMenu idioms | Proven, inherited (D-09/D-14) |

**Key insight:** This phase's only genuinely new *code surface* is the canvas draw callbacks and three small pure core functions. Everything else is composition of shipped parts.

## Data-Driven Defaults (D-06 / D-07 — INDEPENDENTLY VERIFIED)

Recomputed this session directly from `data/normalized/archive.json` (738 shows, newest-first, latest 2025-12-13) and `data/normalized/transition-matrix.json` (264 nodes / 2,987 edges). **Every number matches the UI-SPEC exactly** `[VERIFIED: codebase computation]`:

**Rotation window N** — distinct songs in the last N shows:

| N | Distinct songs |
|---|----------------|
| 3 | 39 |
| 4 | 40 |
| **5** | **56** |
| 6 | 71 |
| 7 | 84 (breaches the ~40–80 band) |
| 8 | 86 |
| 10 | 93 |

→ **`ROTATION_WINDOW_SHOWS = 5`** lands mid-band at 56 nodes and reads naturally ("the last five shows"). `[VERIFIED]`

**Edge-count threshold** — count distribution over all 2,987 edges:

| Predicate | Edges |
|-----------|-------|
| count == 1 (misleading 100%-from-one-play class) | **1,946 (65.1%)** |
| count ≥ 2 | 1,041 |
| count ≥ 3 | 563 |
| count ≥ 5 | 287 |
| count ≥ 10 | 133 |
| max observed count | 224 |

Within the **N=5 rotation subgraph (56 nodes)**: 369 edges total → **174 at ≥2**, 103 at ≥3.

→ **`EDGE_COUNT_THRESHOLD_DEFAULT = 2`** removes all 1,946 one-play edges by construction, yielding a legible **56-node / 174-edge default sky**. Slider **range 1–10** (min 1 restores full truth; ≥10 already thins to 133 catalog-wide — deeper cuts add nothing). `[VERIFIED]`

**Tuning-family distribution (current corpus):** `standard: 247, microtonal: 17`. **No `cs-standard` and no `other` nodes exist today** — the violet and neutral-fallback fills will not appear until the corpus grows, but the mapping must still handle all four keys (it does, via `tuningColor`). `playCount` range: **1–334** (drives `sqrt`-scaled radius).

**Re-run the measurement if the corpus is refreshed** — these constants are corpus-dependent.

## Common Pitfalls

### Pitfall 1: The simulation mutates your node/link objects in place
**What goes wrong:** `force-graph` adds `x, y, vx, vy` to every node object and **replaces `link.source`/`link.target` string ids with the actual node object references** after the first tick. If `deriveConstellation` output is memoized and reused across renders, or if you later read `link.source` expecting a songId, you get a node object (or a mutated array).
**Why:** The engine needs live mutable state on the objects you pass to `graphData`.
**How to avoid:** Treat the derived `{nodes, links}` as owned by the graph once passed. Keep the original `from`/`to` songIds as **separate fields** on the link (`count`, `segueCount`, and e.g. `fromId`/`toId`) so adjacency lookups for focus-dim don't depend on `source`/`target`. Do NOT deep-freeze the derivation output. Rebuild `graphData` only when the node population actually changes (Rotation↔Full), not on every overlay/slider tick.
**Warning signs:** `link.source.id` works but `link.source` "is an object not a number"; positions reset when you didn't intend a reheat.

### Pitfall 2: No responsive sizing — you must measure the container
**What goes wrong:** `ForceGraph2D` defaults `width`/`height` to `window.innerWidth/innerHeight`, so inside AppShell's `<main>` (header + BottomTabBar consume vertical space) the canvas overflows and sits under the tab bar.
**How to avoid:** Reuse the **existing `OrbitStage.tsx` ResizeObserver pattern** (`stageRef` + `useState({width,height})` + `ResizeObserver`) and pass measured `width`/`height` props to `<ForceGraph2D>`. `#/explore` mounts with **AppShell `scroll={false}`** (change `App.tsx` from `scroll={route !== "show"}` to also cover `explore`) so `<main>` is a non-scrolling full-height flex column.
**Warning signs:** Canvas taller than viewport; graph clipped by the tab bar; pan fights page scroll.

### Pitfall 3: React 19 + a Kapsule class component needs a ref, not children
**What goes wrong:** `ForceGraph2D` is a `react-kapsule`-generated component (uses `prop-types`, imperative methods). Camera control (`centerAt`, `zoom`, `zoomToFit`) is only reachable via a ref.
**How to avoid:** `const fgRef = useRef(); <ForceGraph2D ref={fgRef} .../>` and call `fgRef.current?.centerAt(...)`. CLAUDE.md confirms 1.29.1 is React-19-compatible; no `dangerouslySetInnerHTML`, no SSR concern (static Vite SPA — client-only render is fine).
**Warning signs:** `prop-types` dev warnings (benign); trying to control the camera declaratively and failing.

### Pitfall 4: Dense-graph render cost on mobile Safari at threshold=1 / full-catalog
**What goes wrong:** The **default view is trivial** (56 nodes / 174 edges). But Full catalog at slider=1 draws **2,987 edges with directional arrows + 264 custom `nodeCanvasObject` draws every frame during settle** — this is the STATE-flagged small-screen stress case.
**How to avoid:** The default threshold=2 already keeps it light (1,041 edges catalog-wide). For the stress case: keep `linkDirectionalArrowLength` modest, consider gating arrows/labels below a zoom, and lean on freeze (draws stop churning after `onEngineStop`). **This is exactly what the D-15 canvas-label spike should measure** — run it on a real mid-range phone with Full+threshold=1, not just desktop.
**Warning signs:** Jank during settle on Full catalog; fan noise; dropped frames only while the simulation is hot.

### Pitfall 5: Archive ordering assumption (newest-first)
**What goes wrong:** `rotationSongIds` takes "the last N shows" as `shows.slice(0, N)`. Verified: `archive.json` `shows[0]` = 2025-12-13 (newest), last = 2010 (oldest) — **newest-first**. If a future archive rebuild changes ordering, the rotation silently reads the oldest shows.
**How to avoid:** In the core function, **sort by date descending (or assert ordering) before slicing** rather than trusting array order — cheap insurance, fixture-testable.
**Warning signs:** Rotation shows 2010-era songs; N=5 yields a weird set.

### Pitfall 6: Chain-hop to a node not currently drawn (D-16 + D-03)
**What goes wrong:** A tapped bar's target may be a full-catalog song while in Rotation view — it isn't in the drawn node set, so `centerAt` has nowhere to pan.
**How to avoid:** Per UI-SPEC §Layout, the **focused node is always rendered regardless of active filters** (temporary filter exemption). When focus lands on an out-of-view node, inject it (and its neighbor edges as needed) into `graphData` so the chain-hop never lands on empty space.
**Warning signs:** Bar tap pans to blank canvas; sheet loads but no star is highlighted.

## Code Examples

### Core: `rotationSongIds` (D-05, fixture-tested)
```typescript
// Source: derived from archive-types.ts ArchiveArtifact shape (verified 2026-07-16)
import type { ArchiveArtifact } from "../dex/archive-types.ts";
export function rotationSongIds(archive: ArchiveArtifact, windowShows: number): Set<number> {
  const recent = [...archive.shows]                     // don't mutate the artifact
    .sort((a, b) => (a.date < b.date ? 1 : -1))         // Pitfall 5: assert newest-first
    .slice(0, windowShows);
  const ids = new Set<number>();
  for (const show of recent) for (const set of show.sets) for (const id of set.songs) ids.add(id);
  return ids;
}
```

### Core: `rankOutgoing` (D-01..D-04, complete history — filter-independent)
```typescript
// Bars are RAW edge % off the full matrix — never predict(). pct = count / totalOutgoing.
export function rankOutgoing(matrix: TransitionMatrix, songId: number) {
  const out = matrix.edges.filter(e => e.from === songId);
  const total = out.reduce((s, e) => s + e.count, 0);
  const bars = out
    .map(e => ({ songId: e.to, count: e.count, pct: total ? e.count / total : 0,
                 lastDate: e.lastDate, segueCount: e.segueCount }))
    .sort((a, b) => b.count - a.count);   // full list; the UI shows top BARS_TOP_N + expander
  return { total, bars };                 // "why" copy is assembled app-side from count/total/lastDate/segueCount
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG-per-node graphs in React | Canvas rendering for dense/mobile graphs | react-force-graph 2D canvas engine | Right call here — 264 nodes + up to 2,987 edges; SVG DOM-per-node would thrash |
| `d3-force` standalone | `d3-force-3d` inside `force-graph` | (engine internal) | Do NOT add a separate d3-force dep; the algorithm ships with the library |

**Deprecated/outdated:** the umbrella `react-force-graph` package (three.js/VR) — banned; use `-2d`.

## Runtime State Inventory

Not applicable — this is a **pure read/derive/render phase**. Additive-only, writes nothing to Dexie (CONTEXT §Established Patterns). No rename/refactor/migration. Verified: no new tables, no schema bump, no OS/service state. **None — verified by CONTEXT "Additive-only, render-only" and the absence of any Dexie write in the component inventory.**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Physics constants (`ALPHA_DECAY 0.035`, `VELOCITY_DECAY 0.45`, `COOLDOWN_TICKS 200`) settle 56 nodes cleanly on mobile | Settle-and-Freeze | Low — spike-tunable config; wrong values only affect settle time/aesthetics, not correctness |
| A2 | `LABEL_ZOOM_THRESHOLD 1.5` / `COUNT_ZOOM_THRESHOLD 2.5` are readable on small screens | Pitfall 4 / D-15 | Low — the canvas-label spike exists to validate/tune these; `LABEL_AT_REST_TOP_K` may drop to 0 |
| A3 | Full-catalog + threshold=1 (2,987 edges) is acceptable-with-freeze on a mid-range phone | Pitfall 4 | Medium — if it janks badly, mitigate via zoom-gated arrows or an edge cap; default view is unaffected |

All D-06/D-07 data-driven defaults are `[VERIFIED]`, not assumed. Library API is `[VERIFIED]` against the official README. The only open items are physics/threshold *aesthetics*, all config-tunable and covered by the planned spike.

## Open Questions (RESOLVED)

1. **Does `LABEL_AT_REST_TOP_K = 8` crowd small screens?**
   - What we know: D-15 zoom-gating is the decided strategy; UI-SPEC allows K=0.
   - What's unclear: whether even 8 at-rest labels jitter-crowd during settle on a 375px-wide screen.
   - Recommendation: run the canvas-label spike (early plan task) on a real phone; set K from the result. Not a blocker — start at 8, tune down.
   - **RESOLVED:** wired into Plan 07-03 as the on-device canvas-label spike (`autonomous: false` device checkpoint); `LABEL_AT_REST_TOP_K` starts at 8 in config and is tuned from the spike result before the polish slices depend on it.

2. **Filter-exempt focused-node injection mechanics (Pitfall 6).**
   - What we know: focused node must always render even when filtered out.
   - What's unclear: cleanest implementation — inject into `graphData.nodes` vs. an overlay draw.
   - Recommendation: inject the focused node (+ its neighbor edges) into the graphData the canvas receives; let the planner spec it as a derived "visible set = filtered ∪ {focus, neighbors}".
   - **RESOLVED:** adopted by Plan 07-04 — the visible set is derived as `filtered ∪ {focus, neighbors}`, injecting the focused node and its neighbor edges into the graphData the canvas receives (see 07-04 focus-dim task).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm workspace + Vite 8 | Build/dev | ✓ | vite 8.1.3 | — |
| react-force-graph-2d | Constellation render | ✗ (not yet installed) | 1.29.1 (npm-verified) | none — this phase installs it (`pnpm --filter @guezzer/app add`) |
| `@matrix` / `@archive` aliases | Data load | ✓ | (vite.config.ts) | — |
| Vitest projects (core=node) | Fixture tests | ✓ | vitest (root config) | — |

**Missing dependencies with no fallback:** `react-force-graph-2d` — install is a planned task (slopcheck `[OK]`, gate satisfied by CLAUDE.md vetting; a `checkpoint:human-verify` before install is optional-but-cheap given it's a new dep).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root `vitest.config.ts`, `projects` — core=`node`, app=`jsdom`) |
| Config file | `./vitest.config.ts` |
| Quick run command | `pnpm vitest run packages/core/test/explore` |
| Full suite command | `pnpm vitest run` |

The three core functions are the fixture-testable heart of this phase (project constraint: "Unit tests for the scoring pipeline AND dex derivation using small fixture setlists with known expected outputs"). The canvas component is **not** unit-tested (canvas draw is validated by the human-verify spike, not jsdom) — jsdom has no canvas. Test the pure derivation, not the render.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPL-01 | `deriveConstellation` emits `{nodes:[{id,...}], links:[{source,target,count,...}]}` from a fixture matrix | unit | `pnpm vitest run packages/core/test/explore/derive-constellation.test.ts` | ❌ Wave 0 |
| EXPL-03 | `rotationSongIds` returns exactly the distinct songs of the last N shows (fixture archive) | unit | `pnpm vitest run packages/core/test/explore/rotation.test.ts` | ❌ Wave 0 |
| EXPL-03 | Real-corpus assertion: N=5 → 56 song ids (guards the data-driven default) | unit (reads `@archive`) | same file, real-artifact case | ❌ Wave 0 |
| EXPL-04 | Edge-count threshold predicate: ≥2 removes all count==1 edges; nodes unchanged (D-08) | unit | `pnpm vitest run packages/core/test/explore/derive-constellation.test.ts` | ❌ Wave 0 |
| EXPL-02 | `rankOutgoing` returns complete outgoing history sorted by count, correct pct=count/total | unit | `pnpm vitest run packages/core/test/explore/rank-outgoing.test.ts` | ❌ Wave 0 |
| EXPL-02 | Zero-outgoing node → `{total:0, bars:[]}` (honest-zero, D-08 free-floating star) | unit | same file | ❌ Wave 0 |
| EXPL-05/06, DEX-05 | Focus-dim adjacency, settle-freeze, dex ring rendering | manual (spike) | human-verify on device | n/a (canvas) |

### Sampling Rate
- **Per task commit:** `pnpm vitest run packages/core/test/explore`
- **Per wave merge:** `pnpm vitest run` (full core+app suite)
- **Phase gate:** Full suite green + the canvas-label device spike signed off before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/core/test/explore/derive-constellation.test.ts` — covers EXPL-01, EXPL-04
- [ ] `packages/core/test/explore/rotation.test.ts` — covers EXPL-03 (fixture + real-corpus N=5→56 guard)
- [ ] `packages/core/test/explore/rank-outgoing.test.ts` — covers EXPL-02
- [ ] Fixture helpers: reuse the `node()`/`repoFile()` factory idiom from `packages/core/test/dex/albums.test.ts`
- [ ] Framework install: none needed — Vitest projects already configured

## Security Domain

`security_enforcement: true`, ASVS level 1. This phase is read/derive/render with **no network, no auth, no persistence, no destructive actions** — the attack surface is minimal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (project constraint) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Local-only PWA |
| V5 Input Validation | yes | Matrix/archive are schemaVersion-guarded on load (`loadMatrix`/`loadArchive` sentinels); no user free-text input reaches derivation (slider is a bounded int, toggle is binary) |
| V6 Cryptography | no | None |
| V7 Error Handling | yes | Guarded loaders return `{ok:false}` → calm error state, never a throw that bricks the view (inherited Phase-4 pattern) |

### Known Threat Patterns for {React canvas PWA over bundled JSON}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via song names (kglw-derived, untrusted) | Tampering | Render as React text / canvas `ctx.fillText` only — never `dangerouslySetInnerHTML` (inherited T-04-14). Canvas `fillText` is inherently non-executing. |
| Malformed/drifted bundled artifact | Tampering/DoS | `schemaVersion === 1` guard in the existing loaders → error state, not a crash |
| Hash-route injection | Tampering | `useHashRoute` already validates against a fixed allow-list; only selects a view |

No new secrets, no new network calls, no new storage. ASVS L1 is satisfied by inherited controls + the schema guards already in place.

## Sources

### Primary (HIGH confidence)
- `react-force-graph` official README (github.com/vasturiano/react-force-graph) — verbatim ForceGraph2D prop/method names (`nodeCanvasObject(node,ctx,globalScale)`, `nodePointerAreaPaint`, `linkDirectionalArrowLength/RelPos`, `cooldownTicks`, `onEngineStop`, `d3AlphaDecay/VelocityDecay`, `onNodeClick/onBackgroundClick`, `centerAt/zoom/zoomToFit`, node `x/y/fx/fy`) — fetched 2026-07-16
- npm registry — `react-force-graph-2d@1.29.1` version, publish date (2026-02-04), dependency tree (force-graph ^1.51, no three.js), no postinstall — verified 2026-07-16
- Codebase computation over `data/normalized/archive.json` + `transition-matrix.json` — every D-06/D-07 default recomputed and matched exactly — 2026-07-16
- Direct file reads: `types.ts`, `matrix.ts`, `useDexStats.ts`, `derive-dex.ts`, `tuningColor.ts`, `config.ts` (core+app), `AppShell.tsx`, `App.tsx`, `useHashRoute.ts`, `vite.config.ts`, `OrbitStage.tsx` sizing pattern, `archive.json` structure

### Secondary (MEDIUM confidence)
- slopcheck 0.6.1 — `react-force-graph-2d` rated `[OK]`

### Tertiary (LOW confidence)
- Physics/threshold aesthetic defaults (A1–A3) — training knowledge, flagged for the device spike

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — single locked library, npm+slopcheck verified, deps inspected
- Library API: HIGH — prop names verbatim from official README
- Data-driven defaults: HIGH — independently recomputed, exact match to shipped artifacts
- Architecture / core functions: HIGH — grounded in real types and existing module idioms
- Pitfalls: HIGH (Pitfalls 1–3, 5) / MEDIUM (Pitfall 4 perf — needs device spike)

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (stable; re-verify data-driven defaults if the corpus is refreshed, and re-check the library version if bumping past 1.29.1)
