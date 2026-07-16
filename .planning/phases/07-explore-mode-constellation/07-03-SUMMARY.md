---
phase: 07-explore-mode-constellation
plan: 03
subsystem: app
tags: [explore, constellation, device-spike, canvas, labels, force-layout, gesture, config]

# Dependency graph
requires:
  - phase: 07-explore-mode-constellation
    plan: 02
    provides: ConstellationCanvas render stage + config.explore render constants (label/zoom/physics)
provides:
  - device-verified label/zoom/settle constants (LABEL_AT_REST_TOP_K, LABEL_ZOOM_THRESHOLD, COUNT_ZOOM_THRESHOLD, ALPHA/VELOCITY_DECAY, COOLDOWN_TICKS) — [VERIFIED] markers stamped
  - CHARGE_STRENGTH / LINK_DISTANCE spacing levers (device-tuned) wired into the force sim
  - on-load zoomToFit auto-framing of the connected main grouping (ZOOM_TO_FIT_PADDING_PX / _DURATION_MS)
  - enableNodeDrag={false} — clean pinch-to-zoom on touch, tap preserved
affects: [07-04 focus-dim/NodeSheet (reuses the frozen layout + fgRef camera + zoom-gated label pattern), 07-05 edge slider (free-floating stars excluded from the auto-fit frame), 07-06 dex sighting counts (reuse COUNT_ZOOM_THRESHOLD)]

# Tech tracking
tech-stack:
  patterns:
    - "Imperative d3-force tuning via fgRef.d3Force('charge').strength() / ('link').distance() from config — react-force-graph-2d exposes no charge/link-distance props"
    - "On-settle camera framing: onEngineStop pins fx/fy then zoomToFit(duration, padding, nodeFilter) targeting only connected nodes (fromId/toId set), so lone stars never drag the fit out"
    - "enableNodeDrag={false} on a settle-and-freeze graph: hands multi-touch to d3-zoom for clean pinch, keeps tap→onNodeClick"

key-files:
  modified:
    - packages/app/src/config.ts
    - packages/app/src/explore/ConstellationCanvas.tsx

key-decisions:
  - "All three checkpoint items (settle-then-freeze smoothness on Full catalog, top-8 at-rest labels, 1.5/2.5 zoom thresholds) APPROVED as-is on the owner's iPhone 16 Pro — no label/zoom/physics values changed, [ASSUMED] → [VERIFIED: device spike 2026-07-16] stamped on the six confirmed keys"
  - "Device spike surfaced a NEW finding beyond the plan's label question: d3-force defaults (charge ~-30, link ~30) clump ~264 nodes into an unreadable ball. Added CHARGE_STRENGTH/LINK_DISTANCE (tuned live to -400 / 90 over two device passes) so connections read"
  - "Added on-load zoomToFit framing the connected main grouping (owner request) — filtered to nodes with edges so free-floating stars (common once the 07-05 edge slider hides weak edges) never pull the zoom out"
  - "Disabled node drag (owner request): on touch, react-force-graph's node-drag handler was intercepting the pinch gesture; disabling it gives d3-zoom the multi-touch. Layout is frozen so drag was never wanted; tap is unchanged"

patterns-established:
  - "Pattern: device-driven config tuning with dated [VERIFIED]/[device spike] provenance markers on each key"

requirements-completed: [EXPL-06]

# Metrics
duration: device-spike (interactive)
completed: 2026-07-16
---

# Phase 7 Plan 03: On-Device Canvas-Label + Force-Layout Spike Summary

**The STATE blocker "Canvas label rendering quality at ~250 nodes on small screens needs a spike" is resolved on the owner's iPhone 16 Pro: all three plan checkpoint items (Full-catalog settle-then-freeze smoothness, top-8 at-rest labels, 1.5/2.5 zoom thresholds) were verified good as-is, and the spike additionally surfaced and fixed node clumping (device-tuned charge/link spacing), added on-load auto-framing of the main grouping, and cleaned up pinch-to-zoom by disabling node drag.**

## Device Verdict (the checkpoint)

Tested on the owner's iPhone 16 Pro over the HTTPS cloudflared tunnel (production preview build, per MEMORY device-uat-hosting), at the Full-catalog stress case (~264 nodes / ~2,987 edges — Rotation/Full toggle and edge slider are later slices, so the full population was exercised directly).

| # | Checkpoint item | Verdict |
|---|-----------------|---------|
| a | Settle-then-freeze smooth on Full catalog? | **Approved** — settles and freezes cleanly, no unacceptable jank. No mitigation note needed for 07-05. |
| b | `LABEL_AT_REST_TOP_K=8` comfortable or crowding at 375px? | **Approved at 8** — top-8 legible, not crowding. |
| c | `LABEL_ZOOM_THRESHOLD=1.5` / `COUNT_ZOOM_THRESHOLD=2.5` right? | **Approved as-is** — labels/counts fade in at a comfortable zoom. |

No label/zoom/physics constant needed changing → `[ASSUMED]` replaced with `[VERIFIED: device spike 2026-07-16]` on the six confirmed keys (`LABEL_AT_REST_TOP_K`, `LABEL_ZOOM_THRESHOLD`, `COUNT_ZOOM_THRESHOLD`, `ALPHA_DECAY`, `VELOCITY_DECAY`, `COOLDOWN_TICKS`). **Full-catalog perf verdict: acceptable — no slider/arrow-gating mitigation required for Plan 07-05.**

## Accomplishments (beyond the checkpoint — owner-driven device findings)
- **Node spacing (legibility).** The spike revealed d3-force's tight defaults clump the ~264 nodes centrally, obscuring connections. Added `CHARGE_STRENGTH` and `LINK_DISTANCE` to `config.explore` and wired them into the simulation imperatively (`fgRef.d3Force('charge').strength()` / `('link').distance()` — the library exposes no props for these), reheating so they take on the first settle and staying inert after the layout freezes. Tuned live over two device passes to **`-400` / `90`** (from d3's ~-30 / ~30); owner confirmed the sky reads cleanly.
- **On-load auto-framing.** Added a `zoomToFit(ZOOM_TO_FIT_DURATION_MS, ZOOM_TO_FIT_PADDING_PX, filter)` in `onEngineStop` (after fx/fy pinning) that frames the **connected** main grouping — filtered by a `connectedIds` set built from the immutable `fromId`/`toId` copies (never post-tick-mutated `source`/`target`, Pitfall 1) so free-floating stars can't drag the zoom out. Opens centered at a comfortable rest zoom (still below `LABEL_ZOOM_THRESHOLD`, so D-15's top-K-only-at-rest behaviour holds).
- **Pinch-to-zoom fix.** Set `enableNodeDrag={false}`. On touch, react-force-graph's node-drag handler was grabbing a finger-on-orb and starving the pinch gesture; disabling it hands multi-touch to d3-zoom. The graph is settle-and-freeze so dragging nodes was never desired, and `onNodeClick` (tap, wired in 07-04) is unaffected — tap behaviour is unchanged.

## Task Commits

1. **Task 1: On-device canvas-label readability + Full-catalog perf spike (checkpoint:human-verify)** — device sign-off recorded; config verified + device-tuned. `fb806da` (feat)

## Files Modified
- `packages/app/src/config.ts` — `[VERIFIED]` markers on the six device-confirmed keys; new `CHARGE_STRENGTH`/`LINK_DISTANCE` spacing levers and `ZOOM_TO_FIT_PADDING_PX`/`ZOOM_TO_FIT_DURATION_MS` framing constants
- `packages/app/src/explore/ConstellationCanvas.tsx` — imperative charge/link force tuning + reheat; `connectedIds` memo; on-settle `zoomToFit` framing; `enableNodeDrag={false}`

## Deviations from Plan

**1. [Scope expansion — owner-requested] `ConstellationCanvas.tsx` modified beyond the plan's `config.ts`-only `files_modified`**
- **Found during:** the device spike (the plan's own `<action>` anticipates spike-surfaced findings; these three exceeded a pure config edit).
- **Issue:** The plan scoped edits to `packages/app/src/config.ts`. Resolving the observed clumping, adding auto-framing, and fixing pinch all required force/camera/gesture wiring that lives in the canvas component. All three were explicit owner requests during the checkpoint.
- **Fix:** Added the force tuning, `zoomToFit`, and `enableNodeDrag={false}` to `ConstellationCanvas.tsx`, all driven by new `config.explore` constants (single-config-file ethos preserved — no magic numbers in the component). 07-04/05/06 also modify this file (sequential waves, no conflict).
- **Commit:** `fb806da` (feat)

**2. [Enhancement] Spike produced tuning + behaviour changes, not just a sign-off**
- The plan's success path allowed "confirmed as-is or updated." The label/zoom/physics keys were confirmed as-is; the spacing/framing/gesture work is additive device-driven tuning surfaced by seeing the render on real hardware — exactly what the early spike exists to catch before the polish slices build on this surface.

## Verification
- App typecheck: `npx tsc --noEmit -p packages/app/tsconfig.json` → exit 0 (`zoomToFit`/`enableNodeDrag` valid in react-force-graph-2d 1.29.1 types)
- Full suite: `npm test` → 480 passed (65 files) — no regression from the canvas changes (canvas draw/gesture validated on device, not jsdom, per RESEARCH §Validation)
- Vite build: `npm run build -w @guezzer/app` → exit 0
- Device sign-off: owner confirmed on iPhone 16 Pro — spacing reads cleanly, opens auto-framed on the main grouping, pinch-to-zoom smooth

## STATE Blocker
"[Phase 7] Canvas label rendering quality at ~250 nodes on small screens needs a spike" → **RESOLVED** (device-verified; labels legible at top-8, and the deeper clumping cause was found and fixed).

## Self-Check: PASSED

Both modified files exist on disk with the described changes; the six `[VERIFIED: device spike 2026-07-16]` markers and the four new constants are present in `config.ts`; the force tuning, `zoomToFit`, and `enableNodeDrag={false}` are present in `ConstellationCanvas.tsx`. App typecheck exit 0, full suite 480/480 green, vite build exit 0. Owner device sign-off recorded on all three checkpoint items plus the three additional tuning findings.

---
*Phase: 07-explore-mode-constellation*
*Completed: 2026-07-16*
