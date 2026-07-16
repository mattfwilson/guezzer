---
phase: 07-explore-mode-constellation
verified: 2026-07-16T18:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  # No previous VERIFICATION.md existed — initial verification.
---

# Phase 7: Explore Mode Constellation Verification Report

**Phase Goal:** The user can wander the band's entire transition graph as a living constellation — the same matrix artifact the predictor uses, now visible, filterable, and overlaid with their personal dex.
**Verified:** 2026-07-16T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

Goal-backward verification confirms the phase goal is achieved in the codebase, not merely claimed. Every core derivation is pure and fixture-tested; every app surface is wired end-to-end from the same matrix artifact the predictor consumes; both packages typecheck clean; the 10 explore unit tests pass including the real-corpus N=5→56 rotation guard. The advisory 07-REVIEW findings (0 blockers, 4 warnings, 4 info) are correctness/a11y edge cases that do not block goal achievement.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A force-directed constellation renders from the same matrix JSON as the predictor — nodes sized by play count, colored by tuning family, directed edges thickened by transition frequency | ✓ VERIFIED | `deriveConstellation` (core/src/explore/derive-constellation.ts) reshapes the frozen `TransitionMatrix` (same artifact `loadMatrix()` feeds the predictor) into `{nodes,links}`; `ConstellationCanvas.tsx` `radiusFor(playCount)=MIN+√playCount`, `tuningColor(tuningFamily)` fill, `linkWidth=min(4,0.5+√count·0.5)` + directional arrows. Single `<ForceGraph2D>` component, one pipeline. |
| 2 | The default view shows only the current-era active rotation with a toggle for the full catalog, and a slider hides edges below a tunable threshold | ✓ VERIFIED | `ExploreView` `view` defaults to `"rotation"`; `rotationSongIds(archive, ROTATION_WINDOW_SHOWS=5)` → passed as `visibleNodeIds` draw-gate; `ExploreFilterPanel` Rotation\|Full segmented toggle; edge `<input type="range" min=1 max=10>` default 2 → `linkVisibility` applies `l.count >= edgeThreshold` (pure render pass, node population untouched → free-floating stars, D-08). |
| 3 | Clicking a node shows its outgoing next-song probabilities as ranked bars with percentages and one-line "why" explanations, and highlights its neighborhood while dimming the rest | ✓ VERIFIED | `onNodeClick`→`onFocus`→`rankOutgoing(matrix, focusId)` (raw edge %, never predict()); `NodeSheet` + `RankedBar` render top-N bars with `pctLabel` and `copy.barWhy(count,total,lastDate,segueCount)`; `neighborIds` (from immutable fromId/toId) drive `FOCUS_DIM_OPACITY=0.12` dim + gold focus ring + chain-hop camera. |
| 4 | Physics settles and freezes; labels never jitter permanently | ✓ VERIFIED | `cooldownTicks`/`d3AlphaDecay`/`d3VelocityDecay` from config; `onEngineStop` pins `n.fx=n.x; n.fy=n.y` on every node; `enableNodeDrag={false}`. Later reheats (resize) are inert against pinned nodes. Labels are top-K-at-rest + zoom-gated, computed once (memoized), not per-tick. |
| 5 | The dex overlays the constellation: unseen songs as dimmed silhouettes, seen songs at full color with sighting-count badges | ✓ VERIFIED | Overlay ON by default (`dexOverlay=true`); `useDexStats` single live path; unseen → `grayscaleOf(baseColor)` at `DEX_DIM_OPACITY=0.35`, caught → full color + `#22C55E` sighting ring + zoom-gated (`COUNT_ZOOM_THRESHOLD`) green count pill; overlay switch in `ExploreFilterPanel` toggles neutral tuning view; `RankedBar` caught tick (B2). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/core/src/explore/derive-constellation.ts` | deriveConstellation + edgesAtThreshold | ✓ VERIFIED | Pure, mutation-safe fromId/toId (Pitfall 1). Exported via barrel. |
| `packages/core/src/explore/rotation.ts` | rotationSongIds(archive, N) | ✓ VERIFIED | Sorts by date desc before slice; empty-safe. Real corpus N=5→56 (test-proven). |
| `packages/core/src/explore/rank-outgoing.ts` | rankOutgoing(matrix, songId) | ✓ VERIFIED | Raw % off edges, division-by-zero guard, honest zero-outgoing. |
| `packages/app/src/explore/ConstellationCanvas.tsx` | Single ForceGraph2D + settle-freeze + all overlays | ✓ VERIFIED | 506 lines; fill/label/edge/dex/focus draw, tap floor, camera. |
| `packages/app/src/explore/ExploreView.tsx` | #/explore root: guarded load→derive→render | ✓ VERIFIED | Guarded loadMatrix, error state, focus/filter/overlay state, all deps wired. |
| `packages/app/src/explore/NodeSheet.tsx` | 40%-peek ranked-bars sheet | ✓ VERIFIED | Peek/drag/dismiss geometry, honest-zero state, expander. |
| `packages/app/src/explore/RankedBar.tsx` | Full-row tap chain-hop bar | ✓ VERIFIED | ≥44px button, target-tuning fill, why line, caught tick. |
| `packages/app/src/explore/ExploreFilterFab.tsx` | Collapsed no-scrim FAB | ✓ VERIFIED | 56px SlidersHorizontal, controlled open, no scrim. |
| `packages/app/src/explore/ExploreFilterPanel.tsx` | Rotation\|Full toggle + edge slider + overlay switch | ✓ VERIFIED | Three ≥44px rows, live handlers, config-driven bounds. |
| `packages/core/src/config.ts` / `packages/app/src/config.ts` | Single-config-file tunables | ✓ VERIFIED | core: N, threshold, slider bounds, BARS_TOP_N; app: radii, zoom thresholds, opacities, physics. Mirrored EDGE_* consistent (07-REVIEW confirms no drift). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| core/src/index.ts | explore/*.ts | barrel export | ✓ WIRED | Exports deriveConstellation, edgesAtThreshold, rankOutgoing, rotationSongIds. |
| ExploreView.tsx | deriveConstellation + loadMatrix | guarded load→derive | ✓ WIRED | `deriveConstellation(result.matrix)` in useMemo keyed on stable load result. |
| App.tsx | ExploreView | route branch + scroll=false | ✓ WIRED | `route === "explore" ? <ExploreView />`, scroll suppressed. |
| ExploreView.tsx | rankOutgoing | focus songId → bars | ✓ WIRED | `rankOutgoing(result.matrix, focusId)`. |
| ExploreView.tsx | rotationSongIds | rotation node population | ✓ WIRED | `rotationSongIds(archive, ROTATION_WINDOW_SHOWS)` → visibleNodeIds. |
| ConstellationCanvas.tsx | link.fromId/toId | focus-dim adjacency (mutation-safe) | ✓ WIRED | neighborIds/connectedIds/edgeColor all read fromId/toId, never mutated source/target. |
| ConstellationCanvas.tsx | link.count >= threshold | render-pass edge filter | ✓ WIRED | `linkVisibility` applies `l.count >= edgeThreshold`; nodes unchanged. |
| ExploreView.tsx | useDexStats | reactive dex overlay | ✓ WIRED | `useDexStats()` → `sightingsFor` → canvas + RankedBar caught tick. |
| ConstellationCanvas.tsx | #22C55E / sightings | nodeCanvasObject overlay layer | ✓ WIRED | Sighting ring + count pill use SIGHTING_RING_COLOR `#22C55E`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| ConstellationCanvas | graphData nodes/links | `deriveConstellation(loadMatrix().matrix)` — bundled frozen matrix JSON | Yes — real matrix nodes/edges | ✓ FLOWING |
| NodeSheet | sheetBars | `rankOutgoing(matrix, focusId)` off real edge records | Yes | ✓ FLOWING |
| ConstellationCanvas | rotation gate | `rotationSongIds(loadArchive().archive, 5)` — real archive.json (56 songs) | Yes | ✓ FLOWING |
| ConstellationCanvas/RankedBar | sightings | `useDexStats().dex.perSong` (Dexie useLiveQuery) | Yes — live reactive | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Core explore units incl. real-corpus N=5→56 | `npx vitest run packages/core/test/explore/` | 3 files / 10 tests passed | ✓ PASS |
| App package typecheck | `npx tsc -p packages/app/tsconfig.json --noEmit` | exit 0, no output | ✓ PASS |
| Core package typecheck (purity + erasable-only) | `npx tsc -p packages/core/tsconfig.json --noEmit` | exit 0 | ✓ PASS |
| Core purity (no React/DOM in core/explore) | grep for react/window/document imports | Only a doc comment references app-side lib | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| EXPL-01 | 07-01, 07-02, 07-07 | Force-directed constellation from same matrix; size=play count, color=tuning, edge=frequency | ✓ SATISFIED | deriveConstellation + ConstellationCanvas (Truth 1). |
| EXPL-02 | 07-01, 07-04, 07-07 | Node → outgoing ranked bars with % and "why" lines | ✓ SATISFIED | rankOutgoing + NodeSheet/RankedBar (Truth 3). |
| EXPL-03 | 07-01, 07-05, 07-07 | Default rotation (last N shows, tunable) + full-catalog toggle | ✓ SATISFIED | rotationSongIds default + ExploreFilterPanel toggle (Truth 2). |
| EXPL-04 | 07-01, 07-05, 07-07 | Edges below tunable threshold hidden (slider) | ✓ SATISFIED | edge slider + linkVisibility count≥threshold (Truth 2). |
| EXPL-05 | 07-04, 07-07 | Node highlights neighborhood, dims rest (focus+context) | ✓ SATISFIED | neighborIds focus-dim + gold ring + chain-hop (Truth 3). |
| EXPL-06 | 07-02, 07-03, 07-07 | Physics settles and freezes; labels never jitter | ✓ SATISFIED | onEngineStop fx/fy pin + enableNodeDrag=false (Truth 4). |
| DEX-05 | 07-06, 07-07 | Dex overlay: unseen silhouettes, seen full color + sighting badge | ✓ SATISFIED | useDexStats overlay: grayscale dim + sighting ring/count (Truth 5). |

All 7 declared requirement IDs are claimed by phase plans, present in REQUIREMENTS.md mapped to Phase 7, and satisfied in code. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase-modified file | ℹ️ Info | Clean. |

The `edgesAtThreshold` export is unused by the app (07-REVIEW IN-01) and `deriveConstellation`'s `_cfg` param is unread (IN-02) — dead surface, not stubs; the threshold predicate is correctly inlined in `linkVisibility`. Not goal-blocking.

### Advisory Findings (from 07-REVIEW — known, non-blocking)

| ID | Concern | Severity | Disposition |
| --- | --- | --- | --- |
| WR-01 | NodeSheet has no keyboard/Escape dismissal | Warning | A11y gap; pointer dismissal works, owner device UAT PASS. Advisory. |
| WR-02 | Resize while focused can snap camera off focused node | Warning | Edge case (phone rotation with sheet open). Advisory. |
| WR-03 | rotationSongIds tie-breaks equal dates by array order | Warning | Real corpus dates unique; N=5→56 test deterministic. Robustness note, not a current failure. |
| WR-04 | NodeSheet occludes FilterFab while focused | Warning | Interaction overlap; dismiss sheet to reach FAB. Advisory. |

These are the 4 advisory warnings flagged in the task brief. None falsifies an observable truth or a requirement; all are correctness/UX-polish edge cases surfaced for a future pass.

### Human Verification Required

None. The end-of-phase device UAT (07-07) already returned an explicit owner PASS on all 5 end-to-end checklist steps on real hardware (iPhone 16 Pro), covering canvas interaction feel, settle-and-freeze, chain-hop, filter live-shaping, and cross-tab live dex recolor (DEX-05 useLiveQuery proven on device). Per the task brief, device testing is not re-requested.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are observably achieved in the codebase, all 7 requirement IDs are satisfied and traceable, all key links are wired (verified against mutation-safe fromId/toId and the single dex derivation path), and data flows from the real bundled matrix + archive + live Dexie dex through every rendered surface. Core purity holds (zero React/DOM in core/explore, both packages typecheck clean, erasable-only syntax). The phase goal — wander the band's transition graph as a living, filterable, dex-overlaid constellation fed by the same matrix artifact as the predictor — is delivered.

---

_Verified: 2026-07-16T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
