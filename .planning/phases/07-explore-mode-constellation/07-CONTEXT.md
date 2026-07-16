# Phase 7: Explore Mode Constellation - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

The band's entire transition graph becomes a wanderable, living constellation: a force-directed graph rendered from the **same matrix artifact the predictor uses** (264 nodes / 2,987 edges), with nodes sized by play count and colored by tuning family, directed edges thickened by frequency, a filterable default view (current-era active rotation + edge-count slider), tap-a-node ranked next-song bars with honest "why" lines, focus+context highlighting, settle-and-freeze physics, and the personal dex overlaid (unseen = dimmed silhouettes, caught = full color + sighting ring). Delivers **EXPL-01..06, DEX-05**. **Mode:** MVP. **UI hint:** yes.

**In scope:**
- Force-directed constellation via `react-force-graph-2d` in a single component, graph data derived by a pure core function from `transition-matrix.json` — one pipeline (EXPL-01).
- Default view = current-era active rotation with full-catalog toggle (EXPL-03); count-based edge-hiding slider (EXPL-04).
- Tap a node → ranked outgoing next-song bars with raw historical percentages and counts+dates "why" lines (EXPL-02) + neighborhood highlight / dim-the-rest (EXPL-05), in one gesture.
- Physics settles and freezes; labels never jitter permanently (EXPL-06).
- Dex overlay from live attendance derivation: dimmed silhouettes for unseen, full color + sighting ring/count for caught (DEX-05).

**Not in scope (later / v2):**
- Era slider scrubbing the constellation through time (EXPL-V2-01 — explicit v1.5/v2 stretch).
- Any change to prediction scoring, the matrix artifact schema, or Show Mode.
- 3D/VR modes (umbrella `react-force-graph` package is explicitly banned — import `-2d` only).

</domain>

<decisions>
## Implementation Decisions

### Ranked-Bars Panel (EXPL-02)
- **D-01:** Bars show **raw historical transition %** straight from the matrix edges ("after Rattlesnake → X 34% of the time") — NOT live `predict()` scoring. Explore has no `ShowContext` (no trail, no rotation state), so the predictor's numbers would be a meaningless hybrid; the edge data is the honest artifact the graph already renders.
- **D-02:** Each bar's one-line "why" is **counts + dates, straight off the edge record**: e.g. "Played 12 of 35 times after this song · last: 2025-11-02 · 8 hard segues" (`count`, `segueCount`, `firstDate`/`lastDate` — zero new derivation).
- **D-03:** The panel always shows a node's **complete outgoing history**, independent of the edge slider and rotation toggle — graph filters are visual-only; a tapped node tells the whole truth.
- **D-04:** **Top 10 bars + "show all N" expander** for the long tail of one-off transitions.

### Default View & Thresholds (EXPL-03, EXPL-04)
- **D-05:** "Active rotation" = **songs played in the last N shows**, derived from the Phase 6 `@archive` artifact (738 shows already shipped to the app) — NOT the matrix's baked `eraPlayCount` (coarser, less explainable).
- **D-06:** **Default N is data-driven at planning/research time**: analyze real corpus density and propose the N that yields a readable default graph (~40–80 nodes), justified in writing — this closes PROJECT.md open question #2. N is a config constant.
- **D-07:** The edge slider filters by **transition count** ("show pairs played together at least X times") — kills the misleading 100%-from-one-play edges by construction. Default threshold data-driven like N, config constant.
- **D-08:** When the slider hides all of a node's edges, the **node stays visible as a free-floating star** — population never churns with the slider; a rarely-transitioned song is still tappable for its history/dex state.

### Controls & Dex Overlay (DEX-05)
- **D-09:** All Explore controls live in a **collapsed filter FAB** (bottom-right, same idiom as Show Mode's Phase 6 FabMenu) expanding a compact panel: rotation/full toggle + edge slider + dex-overlay switch. The graph stays visible while sliding.
- **D-10:** **Dex overlay is ON by default** — the constellation opens as *your* sky (caught songs lit, unseen dimmed silhouettes per Phase 6 D-06 visual language); the filter panel's toggle restores the neutral tuning-family view (where dim = data, not dex).
- **D-11:** Sighting counts render as a **ring on every caught node, with the count number drawn only past a zoom threshold** (same gating pattern as labels) — no 264-badge soup at rest.
- **D-12:** Rotation window **N is config-only** — the UI keeps one binary Rotation/Full toggle; no second slider.

### Node Tap & Labels (EXPL-05, EXPL-06)
- **D-13:** A single tap does **both**: highlights the neighborhood + dims the rest AND opens the ranked-bars panel. Tap empty canvas to clear both.
- **D-14:** The panel is a **partial bottom sheet** (~40% height) — focused node and lit neighborhood stay visible above; drag up for the full list, swipe down to dismiss. Matches the app's existing sheet idiom (TrailNodeSheet, ShareCardSheet).
- **D-15:** Labels are **zoom-gated + focus-forced**: at rest no labels (or only a handful on the very biggest nodes); labels fade in past a `globalScale` threshold; a focused node + its neighbors are ALWAYS labeled regardless of zoom. This is the CLAUDE.md label pattern and directly addresses the STATE-flagged ~250-node small-screen readability concern.
- **D-16:** **Tapping a bar chain-hops**: selects that song, refocuses/pans the graph to it, and reloads the sheet with its outgoing bars — walking probable setlist paths bar-by-bar is the core exploration loop.

### Claude's Discretion
- Exact data-driven defaults for N and the edge-count threshold (D-06/D-07) — proposed from real corpus density with written justification; all in the single config file.
- Force-simulation tuning (`d3AlphaDecay`, `d3VelocityDecay`, `cooldownTicks`) to hit settle-and-freeze (EXPL-06); freeze mechanics via `onEngineStop`.
- Whether the STATE-flagged canvas-label spike runs as an early plan task or a research prototype — but D-15's zoom-gating strategy is the decided answer to spike against.
- Pure core graph-derivation function design (`matrix JSON → {nodes, links}` + rotation filter + threshold filter) — fixture-tested per the project testing constraint.
- Zoom thresholds for labels and count numbers, ring styling, dim opacities (respect Phase 6 TierBadge rule: data semantics never chrome), exact sheet heights/snap points — subject to `/gsd-ui-phase` (ROADMAP flags "UI hint: yes").
- Whether the biggest-nodes-at-rest label allowance in D-15 is used at all, and K if so.
- Physics re-run behavior when toggling rotation/full or overlay (reheat vs preserve positions) — bias toward not surprising the user; positions should feel stable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 7 section: goal, 5 success criteria, requirement IDs (EXPL-01..06, DEX-05), `Mode: mvp`, `UI hint: yes`, `Depends on: Phase 2 (matrix), Phase 6 (dex)`.
- `.planning/REQUIREMENTS.md` — authoritative requirement text (EXPL-01..06 §89–94, DEX-05 §85; EXPL-V2-01 §117 explicitly v2/out of scope).
- `.planning/PROJECT.md` — rendering constraint ("Constellation via d3-force (or equivalent) in a single component; graph data derived from the same matrix JSON, never a second pipeline"), single-config-file rule, open question #2 (resolved here by D-06/D-07's data-driven mandate).
- `CLAUDE.md` — **library lock**: `react-force-graph-2d@1.29.1` (NEVER the umbrella `react-force-graph` — pulls three.js/VR); `cooldownTicks`/`onEngineStop` settle-and-freeze; `nodeCanvasObject` labels only above a zoom threshold (`globalScale`); Decision 5 rationale + fallback ladder.

### Data artifacts this phase renders
- `data/normalized/transition-matrix.json` — the single graph source (`schemaVersion: 1`, 264 nodes / 2,987 edges). Node: `{songId, songName, playCount, eraPlayCount, tuningFamily}`. Edge: `{from, to, count, weightedCount, segueCount, firstDate, lastDate}` — D-01/D-02's entire bar+why payload.
- `packages/core/src/domain/types.ts` — `TransitionMatrix` / `MatrixNode` / `MatrixEdge` / `TuningFamily` types the pure graph-derivation function consumes.
- The `@archive` artifact + app loader (Phase 6, 06-05 idiom) — the 738-show setlist archive that D-05's last-N-shows rotation filter derives from.

### App foundation this phase extends
- `packages/app/src/routing/useHashRoute.ts` — `ROUTES` already includes `"explore"`; `packages/app/src/components/BottomTabBar.tsx` already has the Compass Explore tab; `PlaceholderView.tsx` is what `#/explore` currently renders — this phase fills it.
- `packages/app/src/show/OrbitStage.tsx` / `PredictionOrb.tsx` — established tuning-family color mapping (keyed off the core `TuningFamily` union, not display labels) the constellation must reuse.
- `packages/app/src/dex/` — `useDexStats` (live attendance → derived dex, `{ready,error,dex,rarity,archive,albums}`) is the D-10/D-11 overlay data source; Phase 6 D-06's dimmed-silhouette visual language.
- Phase 6 FabMenu component (Show Mode speed-dial, 06-02) — the collapsed-control idiom D-09 mirrors.
- Existing sheet components (`packages/app/src/show/TrailNodeSheet.tsx`, `packages/app/src/dex/ShareCardSheet.tsx`) — the bottom-sheet idiom D-14 follows.
- `packages/app/src/config.ts` + `packages/core/src/config.ts` — single-config-file home for N, edge threshold, zoom thresholds, physics constants.
- `packages/app/src/components/AppShell.tsx` — scroll-prop seam (Phase 4): the constellation canvas likely needs the non-scrolling full-height mode like `#/show`.

### Prior-phase decisions
- `.planning/phases/06-pok-dex-history-stats/06-CONTEXT.md` — D-05 (derived-only seen state), D-06 (dimmed-silhouette language "consistent with the Phase 7 constellation plan"), TierBadge color discipline (data semantics never chrome).
- `.planning/phases/03-app-shell-pwa-foundation/03-UI-SPEC.md` — inherited design tokens (spacing, 44px tap floor, dark theme, lucide-react); extend, don't re-derive.
- `.planning/STATE.md` — Blockers: "[Phase 7] Canvas label rendering quality at ~250 nodes on small screens needs a spike" (answered by D-15's strategy; spike validates it).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`transition-matrix.json` via the `@matrix` Vite alias** (Phase 4 idiom: bundle import + ambient declare + `schemaVersion` guard sentinel) — the graph loads the exact artifact Show Mode already ships; zero new data pipeline.
- **`@archive` loader + `useDexStats`** (Phase 6) — rotation filter (last N shows) and dex overlay (sighting counts, seen/unseen) both derive from already-shipped data/hooks; `useLiveQuery` reactivity means marking a show recolors the constellation live.
- **Tuning-family color mapping** (OrbitStage/PredictionOrb) — same `TuningFamily`-keyed palette for node colors.
- **FabMenu + bottom-sheet components** — D-09's filter FAB and D-14's bars sheet extend proven idioms rather than inventing chrome.
- **Vitest `projects`** (core=node, app=jsdom) — the pure graph-derivation function is fixture-tested in core.

### Established Patterns
- **Strict core/UI separation** — `matrix JSON → {nodes, links}` derivation, rotation filtering, threshold filtering, and bar ranking are all pure core functions; the component only renders and handles gestures.
- **Single config file** — N, edge-count threshold, label/count zoom thresholds, physics constants, top-10 bar cap.
- **Additive-only, render-only** — this phase writes nothing to Dexie; it is a pure read/derive/render phase (no migration expected).
- **`react-force-graph-2d` not yet installed** — new dependency this phase adds (locked version 1.29.1 in CLAUDE.md; import the `-2d` package only).

### Integration Points
- **`#/explore` route** — currently `PlaceholderView`; the constellation component mounts here (likely with AppShell `scroll={false}` like `#/show`).
- **`useDexStats`** — overlay reads the same hook the Dex tab uses; no second derivation path.
- **Config files** — all new tunables land beside the existing show/search constants.

</code_context>

<specifics>
## Specific Ideas

- **"Walk the setlist paths":** chain-hop navigation (D-16) — tap a bar to jump to that song and see *its* bars — turns the panel into a probable-setlist explorer, not just a stats readout.
- **"Your sky by default":** the constellation opens with the dex overlay on — caught songs lit, unseen as dimmed silhouettes — the Pokédex made spatial (D-10).
- **Honest numbers everywhere:** bars are raw history with real counts and dates, never model-flavored pseudo-probabilities outside a show context (D-01/D-02) — same trust ethos as Show Mode's honest orb percentages.
- **Graph filters never lie by omission:** the slider/toggle shape what's *drawn*, but a tapped node always reports its complete history (D-03).

</specifics>

<deferred>
## Deferred Ideas

- **Era slider (2010 → present) scrubbing the constellation through time** — EXPL-V2-01, explicit v1.5/v2 stretch; not MVP.
- **Model-view toggle on the bars panel** (live `predict()` scoring alongside raw history) — considered and rejected for v1 (D-01); could return as a debug flag if model-debugging demand materializes.
- **UI slider for rotation window N** — rejected for v1 (D-12, config-only); revisit if retuning N turns out to be a frequent desire.
- **Suppress the update toast during an active tracked show** — carried from Phases 3–6 deferred notes; still belt-and-suspenders, still unclaimed.

### Reviewed Todos (not folded)
- **Fix truncated/oversized orb song-name text** (`.planning/todos/pending/2026-07-11-orb-song-name-text-truncated-and-oversized.md`) — already delivered in Phase 6 (D-21 / fitOrbLabel, 06-02); todo file is stale, safe to archive.
- **Collapse Show-Mode actions into FAB menu** (`.planning/todos/pending/2026-07-14-collapse-show-actions-into-fab-menu.md`) — already delivered in Phase 6 (D-20 / FabMenu, 06-02); stale.
- **InstallBanner once per app version** (`.planning/todos/pending/2026-07-14-install-banner-reappears-every-reload.md`) — already delivered in Phase 6 (D-22 / installBannerSeenVersion, 06-02); stale.

</deferred>

---

*Phase: 7-Explore Mode Constellation*
*Context gathered: 2026-07-16*
