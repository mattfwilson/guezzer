---
phase: 07-explore-mode-constellation
plan: 04
subsystem: app
tags: [explore, constellation, focus, context-highlight, chain-hop, bottom-sheet, ranked-bars]

# Dependency graph
requires:
  - phase: 07-explore-mode-constellation
    plan: 02
    provides: ConstellationCanvas render stage (fgRef, nodeCanvasObject, settle-freeze) + ExploreView focus useState scaffold
  - phase: 07-explore-mode-constellation
    plan: 03
    provides: device-tuned force spacing (CHARGE/LINK), on-settle zoomToFit framing, enableNodeDrag={false}
  - phase: 07-explore-mode-constellation
    plan: 01
    provides: rankOutgoing(matrix, songId) → {total, bars} + config.copy.explore strings
provides:
  - "ConstellationCanvas focus+context: focusId/onFocus props, fromId/toId neighborhood, focus-dim (0.12), gold ring, forced labels, focus camera (EXPL-05)"
  - "visibleNodeIds seam — visible = filtered ∪ {focus, neighbors} (Pitfall 6) ready for the 07-05 rotation filter"
  - "NodeSheet — 40%-peek ranked-bars bottom sheet (drag-full / swipe-dismiss), non-modal/no-scrim so the sky stays live (EXPL-02/D-14)"
  - "RankedBar — full-row 44px chain-hop, target-tuning fill @60%, raw % + honest why line (D-01/D-02/D-16)"
  - "ExploreView chain-hop loop: rankOutgoing → resolved bars → NodeSheet; bar tap refocuses canvas + reloads sheet"
affects: [07-05 rotation/edge filter (passes visibleNodeIds; bars stay filter-independent), 07-06 dex overlay (RankedBar caught-tick seam + focus-dim min-with-dex-dim)]

# Tech tracking
tech-stack:
  patterns:
    - "Focus-dim via ctx.globalAlpha in nodeCanvasObject (fill+ring+label dim together); edge dim/highlight via linkColor rgba alpha — both read immutable fromId/toId (Pitfall 1)"
    - "Focus camera: fgRef.zoom(FOCUS_ZOOM_K) + centerAt(x, y + worldOffset) to seat the node in the upper 60% above the 40% peek sheet; instant under prefers-reduced-motion"
    - "Visible-set gating (nodeVisibility/linkVisibility) with focus+neighbor exemption — the forward-compatible Pitfall-6 rule that never churns frozen positions"
    - "Partial bottom sheet: pointer-drag height with peek/full snap + swipe-dismiss; copies the TrailNodeSheet shell but non-modal (no scrim) to keep the canvas live above it"

key-files:
  created:
    - packages/app/src/explore/NodeSheet.tsx
    - packages/app/src/explore/RankedBar.tsx
  modified:
    - packages/app/src/explore/ConstellationCanvas.tsx
    - packages/app/src/explore/ExploreView.tsx
    - packages/app/src/config.ts

key-decisions:
  - "Implemented Pitfall 6 as a visibleNodeIds gating seam (nodeVisibility/linkVisibility with focus+neighbor exemption) rather than mutating focus/neighbors INTO graphData — the focus node object always survives in the full graph so its frozen x/y is always camera-able, and no filter churns node positions. 07-05 just passes the rotation set."
  - "NodeSheet is NON-modal with no scrim (aria-modal={false}) — a deliberate divergence from TrailNodeSheet's modal+black/50 scrim. A scrim would hide the very neighborhood the sheet describes; D-14 requires the focused node + lit neighborhood to stay visible above the peek."
  - "Mirrored BARS_TOP_N (10) into app config.explore — core config is not re-exported from the @guezzer/core barrel (same situation and precedent as dex.OWNER_NAME_MAX_LENGTH); the two MUST stay equal."
  - "Added FOCUS_ZOOM_K / FOCUS_TARGET_TOP_FRACTION / FOCUS_CAMERA_DURATION_MS to app config.explore (no scattered magic numbers, CLAUDE.md) — FOCUS_ZOOM_K=2 sits ≥ LABEL_ZOOM_THRESHOLD so the neighborhood reads at focus zoom."
  - "Ring/label colors + edge alphas kept as component-module consts (matching the existing EDGE_COLOR/LABEL_COLOR pattern), while behavioral/tunable values live in config — consistent with the 07-02/07-03 split."

patterns-established:
  - "Pattern: canvas focus-dim through a single ctx.globalAlpha guard so fill, ring, and label dim as one unit (§B4 'nodes, edges, rings, labels alike')"
  - "Pattern: complete-history sheet independence — bars always come from rankOutgoing(matrix, focusId), never the drawn/filtered link set (D-03)"

requirements-completed: [EXPL-02, EXPL-05]

# Metrics
duration: ~25min
completed: 2026-07-16
---

# Phase 7 Plan 04: Explore Focus + Ranked-Bars Chain-Hop Summary

**Tapping a star now focuses it in one gesture — a 2px gold ring, its neighborhood lit while everything else dims to 12%, forced text-primary labels, and the camera easing it into the upper 60% above a 40%-peek bottom sheet of ranked next-song bars (raw historical %, honest count/date "why" lines). Tapping a bar chain-hops: it becomes the new focus, the camera pans to it, and the sheet reloads with ITS outgoing bars — the phase's core "walk the setlist paths" loop. Tapping empty canvas clears everything; a zero-outgoing star opens the honest "No next songs on record" state, not an error.**

## Performance
- **Duration:** ~25 min
- **Tasks:** 2 (both `type="auto"`)
- **Files:** 5 (2 created, 3 modified)

## Accomplishments

### Task 1 — Focus + context highlighting and chain-hop camera (`ba8b063`)
- `ConstellationCanvas` now accepts `focusId` + `onFocus`; `onNodeClick` sets focus, `onBackgroundClick` clears it (D-13).
- Neighborhood is computed in a `useMemo` from the **immutable `fromId`/`toId`** copies (never the post-tick-mutated `source`/`target`, RESEARCH Pitfall 1).
- Focus-dim (§B4): a single `ctx.globalAlpha` guard in `nodeCanvasObject` drops every out-of-neighborhood node's fill + ring + label to `FOCUS_DIM_OPACITY` (0.12); edges dim/highlight via `linkColor` (base 20% → neighborhood 70% / else 12%), arrows share the same tint.
- The focused node gets a 2px screen-space **gold ring** (`#F2C14E`, the reserved one-active-selection accent); the focused node + neighbors are **force-labeled at any zoom** in text-primary semibold, the focused node showing its FULL (ellipsis-exempt) name.
- Focus camera: `fgRef.zoom(FOCUS_ZOOM_K)` + `centerAt(x, y + worldOffset)` seats the node at `FOCUS_TARGET_TOP_FRACTION` (0.3) from the top — the upper 60%, clear of the 40% sheet — with a 400ms ease that collapses to an **instant jump under `prefers-reduced-motion`**.
- **Pitfall 6** implemented as a `visibleNodeIds` seam: `nodeVisibility`/`linkVisibility` draw only the filtered population, but the focus + neighbors are always exempt, so a chain-hop to a filter-hidden node never lands the camera on empty space. This slice passes no filter (everything visible); 07-05 inherits the rule by passing its rotation set.

### Task 2 — NodeSheet (40% peek) + RankedBar + chain-hop wiring (`b15b26d`)
- `NodeSheet` copies the TrailNodeSheet shell (`role="dialog"`, `rounded-t-2xl border-t border-hairline bg-elevated`, `env(safe-area-inset-bottom)` padding, `stopPropagation`) but is a **partial, non-modal, scrim-less** sheet: pointer-drag height with **peek (0.4 viewport) / full snap** and **swipe-down-to-dismiss**, transitions disabled while dragging and under reduced-motion.
- Content: header (song name Heading + `sheetSubline` play-count, tabular-nums) → top-`BARS_TOP_N` `RankedBar`s → a working **Show all {N} / Show top {N}** expander for the long tail → the muted D-03 note ("Complete history — filters only shape the map."). A `{total: 0}` node renders the honest **"No next songs on record"** zero-state (D-08).
- `RankedBar` is a full-row ≥44px chain-hop button: `#2A2A34` track + a fill sized to the raw `pct` in the **target song's tuning color @60%**, name + `{pct}%` (Label semibold, tabular-nums, `<1%` never a bare `0%`), a `barWhy` line straight off the edge record, and a `ChevronRight` chain-hop affordance. The dex caught-tick is left as an inert `caught?` **prop seam** for 07-06.
- `ExploreView` derives the focused node's bars via `rankOutgoing(matrix, focusId)` — the **complete raw history**, never `predict()` and never the drawn/filtered links (D-01/D-03) — resolves each bar's target name + tuning family from a node map, and renders `NodeSheet`. A `RankedBar` tap sets `focusId` to the target: the canvas refocuses (Task 1 camera fires) and the sheet reloads that song's bars, keeping its snap.

## Preserved from 07-03 (device spike)
The wave-2 device tuning is intact in `ConstellationCanvas.tsx`: imperative `d3Force("charge"/"link")` spacing + reheat, the `onEngineStop` `zoomToFit` framing of the connected main grouping, and `enableNodeDrag={false}`. Focus/tap handling coexists with the frozen `fx/fy` layout — `onNodeClick` fires on tap with node-drag disabled, and the focus camera never reheats the sim.

## Task Commits
1. **Task 1: Focus+context highlighting and chain-hop camera** — `ba8b063` (feat)
2. **Task 2: NodeSheet (40% peek) + RankedBar + chain-hop wiring** — `b15b26d` (feat)

## Files Created/Modified
- `packages/app/src/explore/NodeSheet.tsx` (created) — 40%-peek ranked-bars sheet: drag-full/swipe-dismiss, header + top-N bars + expander + D-03 note + zero-state
- `packages/app/src/explore/RankedBar.tsx` (created) — one outgoing-transition bar; full-row chain-hop, tuning fill @60%, raw % + why line, caught-tick seam
- `packages/app/src/explore/ConstellationCanvas.tsx` — focusId/onFocus, neighborhood, focus-dim, gold ring, forced labels, focus camera, visibleNodeIds gating
- `packages/app/src/explore/ExploreView.tsx` — focus wiring, rankOutgoing bar derivation + target resolution, NodeSheet render, chain-hop
- `packages/app/src/config.ts` — `explore.FOCUS_ZOOM_K` / `FOCUS_TARGET_TOP_FRACTION` / `FOCUS_CAMERA_DURATION_MS` / `BARS_TOP_N`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Tooling] pnpm verify commands run via npm/npx**
- **Found during:** both verify steps.
- **Issue:** The plan specifies `pnpm --filter @guezzer/app exec tsc --noEmit` / `pnpm -w test --run`. The repo is an **npm** workspace (07-01/07-02 established this — `package-lock.json`, no `pnpm-lock.yaml`).
- **Fix:** Ran `npx tsc --noEmit -p packages/app/tsconfig.json` and `npx vitest run` (identical result). CLAUDE.md lists npm workspaces as an approved equal.
- **Commit:** n/a (tooling only, no file change).

**2. [Convention] BARS_TOP_N mirrored into app config**
- Core `config.explore.BARS_TOP_N` is not re-exported from the `@guezzer/core` barrel, so the app tier cannot read it. Added `BARS_TOP_N: 10` to app `config.explore` with a mirror comment — the exact same situation and precedent as `dex.OWNER_NAME_MAX_LENGTH`. The two MUST stay equal.
- **Commit:** `ba8b063`.

**3. [Design divergence] NodeSheet is non-modal, no scrim**
- TrailNodeSheet is a modal with a full-screen `bg-black/50` scrim. The Explore peek sheet is deliberately **non-modal** (`aria-modal={false}`) with **no scrim**: D-14 requires the focused node + lit neighborhood to stay visible AND interactive above the 40% peek. A scrim would dim the sky the sheet is describing and block chain-hop taps on the canvas. Shell classes (rounded-t-2xl, border-hairline, bg-elevated, safe-area padding, stopPropagation) are copied verbatim; only the modal/scrim wrapper is dropped by design.

### Enhancement
**4. Focus camera constants added to config**
- Added `FOCUS_ZOOM_K` (2), `FOCUS_TARGET_TOP_FRACTION` (0.3), `FOCUS_CAMERA_DURATION_MS` (400) to app `config.explore` so the plan's `centerAt`/`zoom(targetK, 400)` carries no scattered magic numbers (CLAUDE.md single-config-file ethos). `FOCUS_ZOOM_K=2` sits ≥ `LABEL_ZOOM_THRESHOLD` (1.5) so the neighborhood reads at focus zoom.

## Known Stubs
- **RankedBar `caught?` prop (intentional seam, not a data stub):** the green Check / hollow-circle caught indicator only renders when `caught` is explicitly passed. This slice never passes it (no dex overlay yet), so nothing draws. Wired by the 07-06 dex-overlay slice, as the plan directs ("leave a prop seam"). No empty/placeholder value flows to rendered UI — the bars, %, why lines, and chain-hop are all fully live off real matrix data.

## Threat Flags
None. No new network endpoints, auth paths, file access, or schema changes. Song names + why lines render as escaped React text; canvas labels via `ctx.fillText` only (T-07-05 mitigated — never `dangerouslySetInnerHTML`). Bars are read-only derivations of the trusted matrix.

## Verification
- App typecheck: `npx tsc --noEmit -p packages/app/tsconfig.json` → exit 0 (`focusId`/`onFocus`/`nodeVisibility`/`linkVisibility`/`centerAt`/`zoom` all valid in react-force-graph-2d 1.29.1 types)
- Full suite: `npx vitest run` → 480 passed (65 files) — no regression (canvas draw/gesture validated on device per RESEARCH §Validation, not jsdom; the benign "Not implemented: navigation"/getContext jsdom lines are pre-existing)
- Vite build: `npm run build -w @guezzer/app` → exit 0 (the >500 KB single-chunk warning is pre-existing — the model artifact is bundled by design, CLAUDE.md — out of scope)
- Worktree hygiene: `package-lock.json` untouched by `npm install`; `dist/` gitignored; no stray untracked files

## User Setup Required
None — pure read/derive/render, no network, persistence, or secrets. On-device feel of the focus camera + peek-sheet drag is a natural candidate for the next device pass but was not a plan checkpoint.

## Self-Check: PASSED
Both created files (`NodeSheet.tsx`, `RankedBar.tsx`) and all three modified files exist on disk; both task commits (`ba8b063`, `b15b26d`) are present in git history; 07-03's `enableNodeDrag={false}`, `zoomToFit` framing, and `d3Force("charge"/"link")` tuning are preserved in `ConstellationCanvas.tsx`. App typecheck exit 0, full suite 480/480 green, vite build exit 0.

---
*Phase: 07-explore-mode-constellation*
*Completed: 2026-07-16*
