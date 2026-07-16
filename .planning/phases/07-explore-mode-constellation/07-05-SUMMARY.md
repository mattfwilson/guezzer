---
phase: 07-explore-mode-constellation
plan: 05
subsystem: app
tags: [explore, constellation, filter-fab, rotation, edge-slider, draw-gate]

# Dependency graph
requires:
  - phase: 07-explore-mode-constellation
    plan: 04
    provides: ConstellationCanvas visibleNodeIds seam (focus+neighbor exemption) + focusId/onFocus; ExploreView focus/derive scaffold
  - phase: 07-explore-mode-constellation
    plan: 03
    provides: device-tuned force spacing (CHARGE/LINK), on-settle zoomToFit framing, enableNodeDrag={false}
  - phase: 07-explore-mode-constellation
    plan: 01
    provides: rotationSongIds(archive, N) + edgesAtThreshold predicate + config.explore rotation/edge constants (core)
provides:
  - "ExploreFilterFab — collapsed 56px bottom-right filter FAB, SlidersHorizontal glyph rotating 45deg on open, NO scrim (graph stays live, D-09), controlled open state"
  - "ExploreFilterPanel — Rotation|Full segmented toggle (accent on active half only) + live edge slider (1–10, default 2) + reserved disabled dex-overlay slot (07-06 seam)"
  - "ExploreView rotation-default view: rotationSongIds(N=5) → visibleNodeIds draw-gate; Full → null; edgeThreshold state; canvas-tap panel collapse; rotation-empty overlay"
  - "ConstellationCanvas edgeThreshold prop — render-pass edge filter (link.count >= threshold), nodes untouched (free-floating stars, D-08), no reheat; zoomToFit honours the active filter"
affects: [07-06 dex overlay (fills the reserved overlay switch slot + reads dexOverlay state)]

# Tech tracking
tech-stack:
  patterns:
    - "Pure draw-gate over graphData-rebuild: filters flow through visibleNodeIds (nodes) + linkVisibility (edges) so the frozen fx/fy layout never churns and the sim never reheats on a filter change"
    - "Controlled FAB: open state lives in the parent (ExploreView), so a scrim-less canvas tap can collapse the panel without a full-viewport scrim to catch it (D-09)"
    - "Core-config mirror: rotation/edge constants live in @guezzer/core config (not re-exported from the barrel) and are mirrored into app config.explore with a MUST-stay-equal comment (BARS_TOP_N precedent)"

key-files:
  created:
    - packages/app/src/explore/ExploreFilterFab.tsx
    - packages/app/src/explore/ExploreFilterPanel.tsx
  modified:
    - packages/app/src/explore/ExploreView.tsx
    - packages/app/src/explore/ConstellationCanvas.tsx
    - packages/app/src/config.ts

key-decisions:
  - "Implemented the rotation filter as a PURE DRAW-GATE (visibleNodeIds) rather than the plan's graphData-rebuild-plus-reheat approach. The 07-04 seam + orchestrator context both specify draw-gate; it is strictly better for the 'sky must feel stable' requirement — the full-catalog layout is computed once and frozen, so toggling Rotation↔Full only changes which frozen nodes draw, never their positions, and never reheats the simulation."
  - "Edge slider applied per-link in linkVisibility (inline `l.count >= edgeThreshold`) rather than array-filtering via core's edgesAtThreshold. edgesAtThreshold returns a NEW links array, which would re-create graphData and reheat the sim — violating 'slider changes are pure render-pass, no reheat'. The per-link gate applies the identical predicate without touching the links array (and matches the plan's key_links `count >=` contract)."
  - "Refined 07-03's onEngineStop zoomToFit predicate to AND in isNodeVisible so the default Rotation view opens framed on its ~56 visible nodes rather than the whole catalog. The zoomToFit mechanism/constants are preserved; only the node predicate is narrowed. Fires once at settle; a later toggle never re-fires it, so positions stay put."
  - "Lifted the filter-panel `open` state into ExploreView (controlled FAB) so any canvas tap (via the shared onFocus handler) collapses the panel — there is no scrim to catch outside taps (D-09 keeps the graph live while sliding)."
  - "Mirrored ROTATION_WINDOW_SHOWS / EDGE_COUNT_THRESHOLD_DEFAULT / EDGE_SLIDER_MIN / EDGE_SLIDER_MAX into app config.explore — the core barrel does not re-export config (same situation/precedent as BARS_TOP_N and dex.OWNER_NAME_MAX_LENGTH); each carries a MUST-stay-equal comment."

patterns-established:
  - "Pattern: a filter is a render draw-gate, never a data rebuild — node population and edge visibility change via visibleNodeIds/linkVisibility while graphData (and its frozen layout) stays immutable"

requirements-completed: [EXPL-03, EXPL-04]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 7 Plan 05: Explore Filter FAB — Rotation Default + Edge Slider Summary

**Explore now opens on the current-era active rotation — the last 5 shows' 56 songs — instead of the full ~264-node catalog, with a collapsed bottom-right filter FAB (SlidersHorizontal, no scrim) that expands upward into a Rotation | Full catalog toggle and a live "played together ≥ X" edge slider (default ≥2, killing the misleading one-play edges). Both filters are pure render draw-gates: the full-catalog layout is computed once and frozen, so toggling Rotation↔Full only changes which frozen nodes draw and sliding only hides sub-threshold edges — the node population never churns, free-floating stars stay put, and the simulation never reheats. A tapped node's ranked bars still read the complete history (filters only shape the map). An empty archive lands on the honest "Nothing in rotation" overlay with the FAB still offering Full catalog.**

## Performance
- **Duration:** ~20 min
- **Tasks:** 2 (both `type="auto"`)
- **Files:** 5 (2 created, 3 modified)

## Accomplishments

### Task 1 — ExploreFilterFab + ExploreFilterPanel (`d61a744`)
- `ExploreFilterFab` copies the Show-Mode `FabMenu` fixed-anchor + glyph-rotate idiom with the three UI-SPEC divergences: `SlidersHorizontal` glyph (rotating 45° on open), **NO scrim** (the graph stays live while sliding, D-09), and a bottom offset that **omits the `SUGGESTION_STRIP_HEIGHT` term** (Show-Mode-only chrome). 56px `bg-elevated border-hairline` circle — deliberately NOT accent (Phase-6 precedent). aria-label reads `config.copy.explore.filterFabAria` ("Explore filters"). Controlled `open`/`onOpenChange`.
- `ExploreFilterPanel` is a compact secondary-surface card opening upward (md padding, hairline border) with three ≥44px rows: (1) Rotation | Full segmented toggle — **accent gold only on the active half** (same `bg-accent/20` idiom as DexView's Albums|Shows), with the muted `rotationHelper(N)` line under it; (2) an edge-count `<input type="range">` (`EDGE_SLIDER_MIN`..`MAX` = 1–10, default `EDGE_COUNT_THRESHOLD_DEFAULT` = 2, `edgeSliderLabel(x)` + a tabular-nums readout, fires immediately on change); (3) a **reserved disabled dex-overlay switch** row (07-06 seam — inert until wired). Gold `focus-visible` outline on every control.
- Mirrored `ROTATION_WINDOW_SHOWS` / `EDGE_COUNT_THRESHOLD_DEFAULT` / `EDGE_SLIDER_MIN` / `EDGE_SLIDER_MAX` into app `config.explore` (barrel does not re-export core config).

### Task 2 — Rotation-default population + render-pass edge filter (`71a74c4`)
- `ExploreView` gains `view` (default `"rotation"`), `edgeThreshold` (default 2), and `filterOpen` state. It loads the archive via the guarded, memoized `loadArchive()` (reused verbatim) and derives `rotationSongIds(archive, ROTATION_WINDOW_SHOWS)` in a `useMemo`. Rotation → passes the rotation songId Set as `visibleNodeIds`; Full → passes `null`. A shared `handleFocus` collapses the panel on any canvas tap (no scrim) then applies focus/clear. The rotation-empty corpus edge case renders the honest `pointer-events-none` "Nothing in rotation" overlay while keeping the FAB available to switch to Full.
- `ConstellationCanvas` accepts an `edgeThreshold` prop and gates edges in the render pass: `linkVisibility` now also requires `edgeThreshold == null || l.count >= edgeThreshold`. The node array is untouched — a node whose every edge is hidden still draws as a free-floating star and stays tappable (D-08). The `onEngineStop` `zoomToFit` predicate now ANDs in `isNodeVisible` so the default Rotation view opens framed on its ~56 nodes.
- The 07-04 focus+neighbor exemption does the rest: the canvas always unions `{focus, neighbors}` into the visible set, so a chain-hop to a filter-hidden song never lands the camera on empty space, and the bars keep reading the complete `rankOutgoing` history regardless of the filter.

## Preserved from 07-03 / 07-04
- **07-03:** imperative `d3Force("charge"/"link")` spacing + reheat, the `onEngineStop` `zoomToFit` framing (mechanism + constants intact — only its node predicate is narrowed to respect the active filter), and `enableNodeDrag={false}` — all verified present.
- **07-04:** the `visibleNodeIds` draw-gate seam (`nodeVisibility`/`linkVisibility` with focus+neighbor exemption), `focusId`/`onFocus`, focus-dim, gold ring, forced labels, focus camera, and the complete-history NodeSheet bars are untouched — this slice only feeds the seam its rotation set + edge threshold.

## Task Commits
1. **Task 1: ExploreFilterFab + ExploreFilterPanel** — `d61a744` (feat)
2. **Task 2: Rotation-default population + render-pass edge filter** — `71a74c4` (feat)

## Files Created/Modified
- `packages/app/src/explore/ExploreFilterFab.tsx` (created) — collapsed filter FAB (56px, SlidersHorizontal, no scrim, controlled open)
- `packages/app/src/explore/ExploreFilterPanel.tsx` (created) — Rotation|Full toggle + live edge slider + reserved overlay slot
- `packages/app/src/explore/ExploreView.tsx` — view/edgeThreshold/filterOpen state, rotation-set derivation, draw-gate wiring, rotation-empty overlay, FAB render
- `packages/app/src/explore/ConstellationCanvas.tsx` — edgeThreshold render-pass edge gate + filter-aware zoomToFit
- `packages/app/src/config.ts` — mirrored rotation/edge constants into `config.explore`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Tooling] pnpm verify commands run via npm/npx**
- **Found during:** both verify steps.
- **Issue:** the plan specifies `pnpm --filter @guezzer/app exec tsc` / `pnpm -w test`, but the repo is an **npm** workspace (no `pnpm-lock.yaml`; established in 07-01..07-04). CLAUDE.md lists npm workspaces as an approved equal.
- **Fix:** ran `npx tsc --noEmit -p packages/app/tsconfig.json` and `npx vitest run` (+ `npm run build -w @guezzer/app`). Identical result.
- **Commit:** n/a (tooling only).

**2. [Rule 1 - Bug] edgeThreshold state narrowed to literal `2` by `as const` config**
- **Found during:** Task 2 typecheck.
- **Issue:** `useState(config.explore.EDGE_COUNT_THRESHOLD_DEFAULT)` inferred state type `2` (the config is `as const`), so the slider's `onChange(number)` setter failed to typecheck.
- **Fix:** typed the state explicitly as `useState<number>(...)`.
- **Commit:** `71a74c4`.

### Design decisions (documented above in key-decisions)

**3. [Design] Draw-gate over graphData-rebuild + reheat**
- The plan's Task 2 action text described rebuilding `graphData` on the view toggle and low-alpha-reheating entering nodes. The 07-04 seam and the orchestrator context both specify a pure `visibleNodeIds` **draw-gate**. I implemented the draw-gate: `graphData` is never rebuilt, so the frozen fx/fy layout survives every toggle and the sim never reheats — strictly better for the "sky must feel stable" / "positions preserved on toggle" requirement. Entering nodes need no reheat because they were laid out in the initial full-catalog settle and are simply revealed.

**4. [Design] Per-link edge gate rather than `edgesAtThreshold` array filter**
- `edgesAtThreshold` returns a new links array; passing it as graphData would re-create the links and reheat. The identical predicate (`count >= threshold`) is applied per-link in `linkVisibility` instead — a pure render pass with no reheat, matching the plan's key_links `count >=` contract.

**5. [Design] Filter-aware zoomToFit + controlled-FAB open state**
- The `onEngineStop` zoomToFit predicate now ANDs in `isNodeVisible` so Rotation opens framed on ~56 nodes (07-03 mechanism preserved, predicate narrowed). `open` is lifted to ExploreView so a scrim-less canvas tap collapses the panel.

## Known Stubs
- **Dex-overlay switch (reserved seam, not a data stub):** `ExploreFilterPanel`'s third row renders a **disabled** "My dex overlay" switch when no `onDexOverlayChange` handler is passed (this slice passes none). It is inert by design — 07-06 wires it. The row reserves the layout slot per the plan ("reserve the slot"); no empty/placeholder data flows to a live-but-dead control. ExploreView still carries the forward-scaffold `dexOverlay` state for 07-06 to read.

## Threat Flags
None. No new network endpoints, auth paths, file access, or schema changes. The only new user input is the bounded-integer edge slider (`EDGE_SLIDER_MIN`..`MAX`) and the binary Rotation|Full toggle — neither reaches derivation as free text (T-07-07 accept). The archive is read through the existing `schemaVersion===1`-guarded `loadArchive()` sentinel (T-07-06 mitigated → calm "Nothing in rotation" state, never a crash). kglw-derived song names still render via escaped React text / canvas `fillText` only.

## Verification
- App typecheck: `npx tsc --noEmit -p packages/app/tsconfig.json` → exit 0
- Full suite: `npx vitest run` → 480 passed (65 files), no regression (the benign jsdom "getContext"/"navigation" lines are pre-existing; canvas draw/gesture is device-validated per RESEARCH §Validation, not jsdom)
- Vite build: `npm run build -w @guezzer/app` → exit 0 (the >500 KB single-chunk warning is pre-existing — the model artifact is bundled by design, CLAUDE.md — out of scope). Confirms the new `loadArchive` import resolves through the `@archive` alias graph.
- Worktree hygiene: `package-lock.json` untouched by `npm install`; `dist/` gitignored; no stray untracked files
- Preserved-behavior grep: `enableNodeDrag={false}`, `zoomToFit`, and `d3Force("charge")` all present in ConstellationCanvas.tsx

## User Setup Required
None — pure read/derive/render, no network, persistence, or secrets. The on-device feel of the rotation-open framing and the live edge slider is a natural next device-pass candidate but was not a plan checkpoint.

## Self-Check: PASSED
Both created files (`ExploreFilterFab.tsx`, `ExploreFilterPanel.tsx`) and all three modified files exist on disk; both task commits (`d61a744`, `71a74c4`) are present in git history; 07-03's `enableNodeDrag={false}`, `zoomToFit` framing, and `d3Force("charge")` tuning are preserved in `ConstellationCanvas.tsx`. App typecheck exit 0, full suite 480/480 green, vite build exit 0.

---
*Phase: 07-explore-mode-constellation*
*Completed: 2026-07-16*
