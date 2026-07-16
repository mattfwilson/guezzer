# Phase 7: Explore Mode Constellation - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 14 (8 new source, 3 new tests, 3 modified)
**Analogs found:** 14 / 14 (every new file has a strong in-repo template — this phase is composition of shipped idioms)

> This is a **pure read/derive/render frontend phase**. No Dexie writes, no migrations, no schema bump. Three small pure-core derivation functions (fixture-tested in the `node` env) plus one canvas component and its supporting UI chrome, all mounting at `#/explore`. The only genuinely new code surface is the `react-force-graph-2d` canvas draw callbacks; everything else copies a proven pattern verbatim.

---

## File Classification

### New — Core (pure, `packages/core`, fixture-tested, `node` env)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/core/src/explore/derive-constellation.ts` | model (pure derivation) | transform (matrix JSON → `{nodes,links}`) | `packages/core/src/model/matrix.ts` `buildMatrix` | exact (same "one pure fn, Map-keyed accumulation, explicit sort, `cfg` param" shape) |
| `packages/core/src/explore/rotation.ts` | model (pure derivation) | transform (archive → `Set<songId>`) | `packages/core/src/dex/derive-dex.ts` (archive-shows iteration) | role-match |
| `packages/core/src/explore/rank-outgoing.ts` | model (pure derivation) | transform (matrix + songId → ranked bars) | `packages/core/src/model/matrix.ts` (edge iteration) + RESEARCH §Code Examples | exact |
| `packages/core/test/explore/derive-constellation.test.ts` | test | fixture | `packages/core/test/model/matrix.test.ts` | exact |
| `packages/core/test/explore/rotation.test.ts` | test | fixture + real-artifact | `packages/core/test/dex/albums.test.ts` (`node()`/`repoFile()` factories) | exact |
| `packages/core/test/explore/rank-outgoing.test.ts` | test | fixture | `packages/core/test/model/matrix.test.ts` | exact |

### New — App (`packages/app/src/explore/`, `jsdom` env, not unit-tested — canvas is spike-verified)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/app/src/explore/ExploreView.tsx` | view (route root, owns state) | request-response (load/derive/render) | `packages/app/src/show/ShowView.tsx` + `App.tsx` route wiring | role-match |
| `packages/app/src/explore/ConstellationCanvas.tsx` | component (canvas render stage) | streaming/event-driven (force sim + gestures) | `packages/app/src/show/OrbitStage.tsx` (ResizeObserver render stage) | role-match (SVG→canvas) |
| `packages/app/src/explore/ExploreFilterFab.tsx` | component (FAB) | event-driven | `packages/app/src/show/FabMenu.tsx` | exact |
| `packages/app/src/explore/ExploreFilterPanel.tsx` | component (control panel) | event-driven | `packages/app/src/show/FabMenu.tsx` (expanded rows) | role-match |
| `packages/app/src/explore/NodeSheet.tsx` | component (bottom sheet) | event-driven | `packages/app/src/show/TrailNodeSheet.tsx` + `dex/ShareCardSheet.tsx` | exact |
| `packages/app/src/explore/RankedBar.tsx` | component (list row) | event-driven (chain-hop) | `packages/app/src/dex/SongRow.tsx` / `PredictionOrb.tsx` (tuning fill) | role-match |
| `packages/app/src/explore/explore-artifact.d.ts` *(only if a new alias is added — see note)* | config (ambient decl) | — | `packages/app/src/show/matrix-artifact.d.ts` | exact |

> **Loader note:** Explore reuses the EXISTING `@matrix` loader (`packages/app/src/show/matrix.ts` `loadMatrix()`) and the EXISTING `@archive` loader (`packages/app/src/dex/archive-loader.ts` `loadArchive()`) plus `useDexStats`. **No new Vite alias, no new ambient declaration, and no new `.d.ts` file are needed** — the artifacts this phase renders are already aliased and guarded. The `explore-artifact.d.ts` row above applies only if the planner decides to add a brand-new bundled artifact, which the research says it should NOT (one pipeline, same `@matrix` artifact the predictor uses).

### Modified

| File | Change | Analog for the change |
|------|--------|-----------------------|
| `packages/app/src/App.tsx` | Route `explore` → `<ExploreView />` instead of `<PlaceholderView>`; extend `scroll={route !== "show"}` to also cover `explore` | existing `route === "show" ? <ShowView/>` branch (lines 44-57) |
| `packages/app/src/config.ts` | Add `explore: {...}` render constants + `copy.explore.*` block | existing `show:` / `dex:` config blocks + `copy.show` |
| `packages/core/src/config.ts` | Add `explore: { ROTATION_WINDOW_SHOWS, EDGE_COUNT_THRESHOLD_DEFAULT, EDGE_SLIDER_MIN/MAX, BARS_TOP_N }` | existing `dex: {...}` core config block (lines 195-282) |
| `packages/core/src/index.ts` | Barrel-export the three new pure fns + their types | existing dex export block (lines 181-193) |

---

## Pattern Assignments

### `packages/core/src/explore/derive-constellation.ts` (model, transform)

**Analog:** `packages/core/src/model/matrix.ts` (`buildMatrix`) — copy its module shape verbatim: leading doc-comment stating "Zero I/O", `cfg: typeof config = config` param, Map-keyed accumulation, explicit sort comparators, `.map()` to the frozen output shape.

**Module header + purity contract** (`matrix.ts:1-18`):
```typescript
/**
 * ...: pure derivation of ... from an already-normalized corpus. Zero I/O —
 * performs no network/disk access, reads only what the caller passes in.
 * Mirrors `ingest/census.ts`'s "pure module, one top-level fn, Map-keyed
 * accumulation, explicit sort comparators" shape.
 */
import { config } from "../config.ts";
import type { TransitionMatrix, MatrixNode, MatrixEdge } from "../domain/types.ts";
```

**Signature + `cfg` default idiom** (`matrix.ts:75-80`):
```typescript
export function buildMatrix(
  corpus: NormalizedCorpus,
  asOf: AsOfBound,
  cfg: typeof config = config,
  options: BuildMatrixOptions = {},
): TransitionMatrix {
```
→ Emit library-default accessor keys so `<ForceGraph2D>` needs no accessor props (RESEARCH Pattern 1): node objects `{ id: node.songId, name: node.songName, playCount, tuningFamily }`; link objects `{ source: edge.from, target: edge.to, count, segueCount, fromId: edge.from, toId: edge.to }`. **Keep `fromId`/`toId` as separate fields** — the library mutates `link.source`/`link.target` from ids into node object references after the first tick (RESEARCH Pitfall 1), so adjacency lookups for focus-dim must read `fromId`/`toId`, never `source`/`target`.

**Explicit sort discipline to copy** (`matrix.ts:156-166`): nodes `.sort((a,b) => a.songId - b.songId)`; a deterministic order keeps the graph layout reproducible.

**Types to consume** (already exported from the barrel — `packages/core/src/domain/types.ts:104-148`): `TransitionMatrix`, `MatrixNode {songId, songName, playCount, eraPlayCount, tuningFamily}`, `MatrixEdge {from, to, count, weightedCount, segueCount, firstDate, lastDate}`.

---

### `packages/core/src/explore/rotation.ts` (model, transform)

**Analog:** `packages/core/src/dex/derive-dex.ts` archive-iteration (lines 99-112) + the RESEARCH §Code Examples `rotationSongIds` sketch.

**Archive shape it consumes** (`packages/core/src/dex/archive-types.ts:22-48`, `ArchiveArtifact`): `shows: ArchiveShow[]`, each `{ id, date, venue, city, state, country, sets: [{ n: "1"|"2"|"e", songs: number[] }] }`. Note `set.songs` is already a `number[]` of songIds (no `.songId` field, unlike the dex snapshot's cache rows).

**Iteration idiom to copy** (`derive-dex.ts:101-105`):
```typescript
for (const show of archive.shows) {
  for (const set of show.sets) for (const songId of set.songs) songIds.push(songId);
}
```

**Critical: sort newest-first before slicing (RESEARCH Pitfall 5).** `archive.shows[0]` is currently newest (2025-12-13) but don't trust order — sort descending by `date`, then `.slice(0, windowShows)`. Read `windowShows` from `cfg.explore.ROTATION_WINDOW_SHOWS` (=5, yields 56 nodes, `[VERIFIED]`).

---

### `packages/core/src/explore/rank-outgoing.ts` (model, transform)

**Analog:** `packages/core/src/model/matrix.ts` edge iteration + RESEARCH §Code Examples (the exact function body is given there).

Reads the **FULL** matrix edge list for the tapped songId — **never the drawn/filtered links** (D-03, RESEARCH Anti-Pattern). `pct = count / totalOutgoing` off raw edge data; `total = sum of out.count`. Return `{ total, bars }` where bars carry `{ songId, count, pct, lastDate, segueCount }` sorted `b.count - a.count` (full list; the UI applies `BARS_TOP_N` + expander). Zero-outgoing node → `{ total: 0, bars: [] }` (honest zero, D-08 — no throw). The "why" copy string is assembled app-side from `count`/`total`/`lastDate`/`segueCount`, NOT here.

---

### Core fixture tests (`packages/core/test/explore/*.test.ts`)

**Analog for structure:** `packages/core/test/model/matrix.test.ts` (`describe`/`it`, requirement IDs in test names).
**Analog for factories + real-artifact reads:** `packages/core/test/dex/albums.test.ts:14-22`:
```typescript
import { describe, expect, it } from "vitest";
import type { MatrixNode, TransitionMatrix } from "../../src/domain/types.ts";

/** Inert matrix node factory — only the fields under test matter. */
function node(songId: number, songName: string): MatrixNode {
  return { songId, songName, playCount: 0, eraPlayCount: 0, tuningFamily: "standard" };
}
/** Resolve a repo-root-relative data file independent of the test runner cwd. */
function repoFile(rel: string): string {
  return fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
}
```
Also note `matrix.test.ts:9-12` uses the `import x from "../../../../data/..." with { type: "json" }` idiom for real-artifact reads — use it for the `rotation.test.ts` **real-corpus guard** (N=5 → exactly 56 song ids, guards the data-driven default `[VERIFIED]`). Run command: `pnpm vitest run packages/core/test/explore`.

---

### `packages/app/src/explore/ExploreView.tsx` (view, request-response)

**Analog:** `App.tsx` route branch (lines 44-57) for mounting + `useDexStats.ts` for the load/derive/guard shape.

**Guarded-load + error-sentinel idiom to copy** (`useDexStats.ts:62-75`): call `loadMatrix()` / `loadArchive()`, branch on `.ok` returning a calm error state (never throw). Copy the "split, don't `||`, so each branch narrows" comment discipline.

```typescript
// from useDexStats.ts:70-75
if (!archiveResult.ok) {
  return { ready: false, error: archiveResult.error, /* ... */ };
}
```

Owns local `useState` for focus/filter/overlay (no Dexie writes this phase). Reads `useDexStats()` for the overlay (`dex.perSong[songId].sightings`, `neverSeen`) — `useLiveQuery` recolors live. Renders `<ConstellationCanvas>` + `<ExploreFilterFab>` + `<NodeSheet>`. Error copy mirrors the Phase-4 `config.copy.show.modelLoadFailure*` pattern → add `config.copy.explore.errorHeading/errorBody`.

**Matrix loader to reuse verbatim** (`packages/app/src/show/matrix.ts:35-49`): `loadMatrix()` returns `{ ok: true, matrix } | { ok: false, error }`, memoized. **Do NOT write a new loader.**

---

### `packages/app/src/explore/ConstellationCanvas.tsx` (component, canvas render stage)

**Analog:** `packages/app/src/show/OrbitStage.tsx` — copy its ResizeObserver container-sizing pattern verbatim (RESEARCH Pitfall 2: `ForceGraph2D` defaults to `window.innerWidth/Height` and overflows AppShell's `<main>`).

**ResizeObserver sizing to copy** (`OrbitStage.tsx:41-54`):
```typescript
const stageRef = useRef<HTMLDivElement | null>(null);
const [size, setSize] = useState({ width: 0, height: 0 });
useEffect(() => {
  const el = stageRef.current;
  if (!el) return;
  const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
  measure();
  if (typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(measure);
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```
Pass measured `width`/`height` props to `<ForceGraph2D>`. Keep the stage container's gesture-suppression classes (`OrbitStage.tsx:64-65`): `touch-none select-none overflow-hidden` + `style={{ overscrollBehavior: "none" }}`.

**Tuning color to reuse VERBATIM** (`packages/app/src/show/tuningColor.ts:31-34`): `tuningColor(node.tuningFamily)` for node fills and bar fills — keyed on the core `TuningFamily` union (`"standard" | "cs-standard" | "microtonal" | "other"`), NEVER the display label. `import { tuningColor } from "../show/tuningColor.ts"`.

**Library-specific patterns (from RESEARCH, verbatim README API):**
- `nodeCanvasObject={(node, ctx, globalScale) => {...}}` + `nodeCanvasObjectMode={() => 'replace'}` — one draw fn: fill → dex-dim (0.35) → focus-dim (0.12) → sighting ring (`#22C55E`) → zoom-gated count (`globalScale ≥ 2.5`) → zoom-gated/focus-forced label (`globalScale ≥ 1.5` OR top-K OR focused). Draw text at `fontSizePx / globalScale` world units.
- `nodePointerAreaPaint` — 22px screen-space hit floor: `Math.max(radiusFor(playCount), 22 / globalScale)`.
- Settle-and-freeze: `cooldownTicks={200}` `d3AlphaDecay={0.035}` `d3VelocityDecay={0.45}` + `onEngineStop={() => nodes.forEach(n => { n.fx = n.x; n.fy = n.y; })}`.
- Camera (chain-hop D-16): `const fgRef = useRef(); fgRef.current?.centerAt(x, y, 400); fgRef.current?.zoom(k, 400)` (ref methods, RESEARCH Pitfall 3 — camera is only reachable via ref).
- `onNodeClick` / `onBackgroundClick` for tap-to-focus / tap-empty-to-clear (D-13).

---

### `packages/app/src/explore/ExploreFilterFab.tsx` + `ExploreFilterPanel.tsx` (FAB + control panel)

**Analog:** `packages/app/src/show/FabMenu.tsx` — copy the fixed-anchor + collapse-state + glyph-rotate idiom.

**Anchor + collapse pattern to copy** (`FabMenu.tsx:52`, `75-132`):
```typescript
const [open, setOpen] = useState(false);
const bottomOffset = `calc(env(safe-area-inset-bottom) + 64px + ... + 8px)`;
const rightOffset = "calc(env(safe-area-inset-right) + 16px)";
// 56px circle, border-hairline bg-elevated, glyph rotates 45° when open:
<Plus style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
  className="motion-safe:transition-transform motion-safe:duration-200" />
```
**Divergences from FabMenu (per UI-SPEC §Layout 3, D-09):** use `SlidersHorizontal` glyph not `Plus`; **NO scrim** (FabMenu's `fab-scrim` at lines 82-90 is Show-Mode only — the graph must stay live while sliding); the bottom offset **omits the `SUGGESTION_STRIP_HEIGHT` term** (strip is Show-Mode chrome). Sizes from `config.ui.FAB_DIAMETER` (56). Panel rows ≥ 44px (`min-h-11`). Accent gold only on the active half of the Rotation|Full toggle. Slider changes apply immediately (render-pass filter, no reheat).

---

### `packages/app/src/explore/NodeSheet.tsx` (bottom sheet)

**Analog:** `packages/app/src/show/TrailNodeSheet.tsx` + `packages/app/src/dex/ShareCardSheet.tsx` — identical bottom-sheet chrome.

**Sheet shell to copy** (`TrailNodeSheet.tsx:82-94`):
```typescript
<div
  role="dialog" aria-modal="true" aria-label={song.name}
  className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50"
  onClick={close}
>
  <div
    className="rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
    style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
    onClick={(event) => event.stopPropagation()}
  >
```
**Divergence (D-14):** this sheet is a **partial 40%-peek** (`config.explore.SHEET_PEEK_FRACTION = 0.4`) with drag-up-to-full / swipe-down-to-dismiss, unlike TrailNodeSheet's fixed auto-height overlay — the peek/drag geometry is new; the shell classes, safe-area padding, `role="dialog"`, and stopPropagation guard copy verbatim. Content: header (song name Heading + `Played {playCount}× all-time` subline) → top-10 `<RankedBar>` → "Show all N" expander → the muted D-03 note. Zero-edges state renders the `copy.explore` honest-zero heading.

---

### `packages/app/src/explore/RankedBar.tsx` (list row, chain-hop)

**Analog:** `packages/app/src/dex/SongRow.tsx` (row layout + caught tick) + `PredictionOrb.tsx:48` for the tuning fill.

Full-row ≥ 44px tap = chain-hop (D-16) → fires `onSelect(songId)`. Track `#2A2A34`, fill = `tuningColor(targetTuningFamily)` at 60% opacity. Name + `{pct}%` with `tabular-nums`. Green `Check` (lucide) leading the name when overlay ON + caught (reuse `#22C55E` semantics). "Why" line assembled from `config.copy.explore.barWhy(count, total, lastDate, segueCount)`. `<1%` never renders bare `0%` (inherited rule). Song names render as React text only — never `dangerouslySetInnerHTML` (T-04-14).

---

### `packages/app/src/App.tsx` (modified)

**Current wiring** (lines 44-57):
```typescript
<AppShell onMenuClick={() => setMenuOpen(true)} scroll={route !== "show"}>
  {route === "show" ? <ShowView />
   : route === "settings" ? <SettingsView />
   : route === "dex" ? <DexView />
   : <PlaceholderView route={route} />}
```
**Change:** add `route === "explore" ? <ExploreView />` branch and widen the scroll seam so the canvas owns gestures: `scroll={route !== "show" && route !== "explore"}` (AppShell `scroll={false}` makes `<main>` a non-scrolling full-height flex column — confirmed at `AppShell.tsx:14-19`). `ROUTES` already includes `"explore"` (`useHashRoute.ts:9`) and the Compass tab already exists — no routing/tab changes needed.

---

### `packages/core/src/config.ts` + `packages/app/src/config.ts` (modified)

**Analog:** the existing `dex: {...}` block (`core/src/config.ts:195-282`) and `show:`/`dex:` blocks + `copy.show`/`copy.dex` (`app/src/config.ts:33-76`, `197-386`). Add:
- **core `explore`**: `ROTATION_WINDOW_SHOWS: 5`, `EDGE_COUNT_THRESHOLD_DEFAULT: 2`, `EDGE_SLIDER_MIN: 1`, `EDGE_SLIDER_MAX: 10`, `BARS_TOP_N: 10` (all `[VERIFIED]` data-driven — see UI-SPEC §Data-Driven Defaults; re-measure if corpus refreshes).
- **app `explore`**: `NODE_RADIUS_MIN/MAX`, `NODE_HIT_MIN_RADIUS_PX`, `LABEL_ZOOM_THRESHOLD`, `COUNT_ZOOM_THRESHOLD`, `LABEL_AT_REST_TOP_K`, `LABEL_MAX_CHARS`, `DEX_DIM_OPACITY`, `FOCUS_DIM_OPACITY`, `SHEET_PEEK_FRACTION`, `ALPHA_DECAY`, `VELOCITY_DECAY`, `COOLDOWN_TICKS` (values in UI-SPEC §Config surface).
- **app `copy.explore`**: filter labels, bar "why" template, sheet headers, zero/empty/error states (verbatim from UI-SPEC §Copywriting Contract). Copy `copy.dex`'s function-template idiom (e.g. `songSeenCaught: (a,b,c) => ...`) for the `barWhy` interpolation.

Keep the `[ASSUMED]`/`[VERIFIED]` comment discipline the existing blocks use; physics + zoom thresholds are spike-tunable (mark `[ASSUMED]`), the two data-driven core defaults are `[VERIFIED]`.

---

## Shared Patterns

### Guarded bundled-artifact load → error sentinel (never throw)
**Source:** `packages/app/src/show/matrix.ts:35-49` (`loadMatrix`), `packages/app/src/dex/archive-loader.ts:31-45` (`loadArchive`)
**Apply to:** `ExploreView` (reuse both loaders as-is; no new loader).
```typescript
export function loadMatrix(): MatrixLoadResult {
  if (cachedResult) return cachedResult;
  const matrix = matrixArtifact as TransitionMatrix | null | undefined;
  if (!matrix || matrix.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    cachedResult = { ok: false, error: `Unsupported ... schemaVersion (...)` };
    return cachedResult;
  }
  cachedResult = { ok: true, matrix };
  return cachedResult;
}
```

### Pure-core module conventions
**Source:** `packages/core/src/model/matrix.ts:1-18`, `packages/core/src/dex/derive-dex.ts:1-16`
**Apply to:** all three new core fns. Leading doc-comment declaring "Zero I/O"; `cfg: typeof config = config` param; Map-keyed accumulation; explicit sort comparators; string-literal unions never enums (`erasableSyntaxOnly`); import types with the `.ts` extension.

### Tuning-family DATA palette
**Source:** `packages/app/src/show/tuningColor.ts:31-34`
**Apply to:** `ConstellationCanvas` node fills, `RankedBar` bar fills. Reuse VERBATIM — keyed on the core `TuningFamily` union, null/unmapped → `#A1A1AA` fallback, never an invented color.

### Reactive dex overlay (single derivation path)
**Source:** `packages/app/src/dex/useDexStats.ts:54-106`
**Apply to:** the dex overlay. Read `useDexStats()` — `dex.perSong.get(songId)?.sightings` for the ring/count, `neverSeen`/absence for the dimmed silhouette. `useLiveQuery` means marking a show in the Dex tab recolors the constellation with zero new derivation. Guard on `stats.ready` and `stats.error`.

### Bottom-sheet + FAB chrome
**Sources:** `packages/app/src/show/TrailNodeSheet.tsx:82-94` (sheet shell), `packages/app/src/show/FabMenu.tsx:52,75-132` (FAB anchor/collapse)
**Apply to:** `NodeSheet`, `ExploreFilterFab`/`ExploreFilterPanel`. `role="dialog" aria-modal`, `bg-elevated border-hairline rounded-t-2xl`, `env(safe-area-inset-*)` padding, `min-h-11` ≥44px rows, `motion-safe:` transitions.

### Untrusted-string rendering (inherited security control)
**Source:** `TrailNodeSheet.tsx:18` / `PredictionOrb.tsx` comments (T-04-14, ASVS V5)
**Apply to:** every surface showing a kglw-derived song name — React text or canvas `ctx.fillText` only, never `dangerouslySetInnerHTML`. Canvas `fillText` is inherently non-executing.

---

## No Analog Found

None. Every new file maps to a shipped in-repo template. The single genuinely-new *technique* — the `react-force-graph-2d` canvas draw callbacks (`nodeCanvasObject`, `nodePointerAreaPaint`, `onEngineStop` freeze, `centerAt`/`zoom` camera) — has no codebase analog because this is the app's first canvas/force view, but the exact library API is specified verbatim in `07-RESEARCH.md` §Architecture Patterns (Patterns 1-5) and §Common Pitfalls. The planner should reference RESEARCH for those, and OrbitStage only for the container-sizing shell around them.

---

## Metadata

**Analog search scope:** `packages/core/src/{model,dex,domain,ingest}`, `packages/core/test/{model,dex}`, `packages/app/src/{show,dex,components,routing}`, both `config.ts`, `App.tsx`, `vite.config.ts`
**Files scanned:** ~24 read in full or targeted
**Pattern extraction date:** 2026-07-16
