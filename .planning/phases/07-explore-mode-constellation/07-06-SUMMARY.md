---
phase: 07-explore-mode-constellation
plan: 06
subsystem: app
tags: [explore, constellation, dex-overlay, sighting-ring, caught-tick, pokedex]

# Dependency graph
requires:
  - phase: 07-explore-mode-constellation
    plan: 05
    provides: filter draw-gate (visibleNodeIds/linkVisibility/edgeThreshold) + reserved disabled dex-overlay switch slot in ExploreFilterPanel
  - phase: 07-explore-mode-constellation
    plan: 04
    provides: ConstellationCanvas focusId/onFocus + focus-dim; inert RankedBar caught? prop seam; sheetBars scaffold
  - phase: 07-explore-mode-constellation
    plan: 03
    provides: device-tuned force spacing (CHARGE/LINK), on-settle zoomToFit framing, enableNodeDrag={false}, COUNT_ZOOM_THRESHOLD zoom gate
  - phase: 06-pokedex
    plan: 05
    provides: useDexStats reactive hook (dex.perSong sightings / neverSeen via useLiveQuery) — the single dex derivation path
provides:
  - "ConstellationCanvas dex overlay: caught nodes keep full tuning color + a #22C55E sighting ring; unseen render as DEX_DIM_OPACITY (0.35) grayscale silhouettes; zoom-gated sighting-count pill past COUNT_ZOOM_THRESHOLD"
  - "Two-dim contract: focus-dim (0.12) + dex-dim (0.35) combine by MINIMUM opacity, never multiplication, so states never compound into mud"
  - "ExploreView overlay wiring: reads useDexStats (single path), overlay ON by default (D-10), degrades to neutral view on a not-ready/errored dex; sightingsFor accessor passed to canvas + bars"
  - "ExploreFilterPanel 'My dex overlay' switch enabled (was reserved/disabled), wired through ExploreFilterFab to overlay state"
  - "RankedBar caught-tick live: green Check (caught) / hollow circle (unseen) when overlay ON, nothing when OFF — panel mirrors the sky"
affects: [phase-07 complete — DEX-05 was the last requirement]

# Tech tracking
tech-stack:
  patterns:
    - "Overlay as a pure render-pass flag: toggling the dex overlay never rebuilds graphData and never reheats — useLiveQuery inside useDexStats already re-renders the canvas on a Dex mark, recoloring the sky live with zero second derivation"
    - "Two-dim-by-minimum: independent opacity dims (focus-dim, dex-dim) resolve via Math.min so the more-hidden state wins cleanly instead of multiplying into an unreadable product"
    - "Single dex path: the canvas silhouettes, the sighting count, and the bar caught-tick all read the same useDexStats sightingsFor accessor — no parallel derivation"

key-files:
  created: []
  modified:
    - packages/app/src/explore/ConstellationCanvas.tsx
    - packages/app/src/explore/ExploreView.tsx
    - packages/app/src/explore/ExploreFilterFab.tsx
    - packages/app/src/explore/ExploreFilterPanel.tsx
    - packages/app/src/explore/NodeSheet.tsx

key-decisions:
  - "Gated the overlay ACTIVE state on dex readiness (dexOverlayActive = dexOverlay && dexReady) rather than only on the switch. On a not-ready/errored dex, sightingsFor would return 0 for every song, so an ON overlay would dim the ENTIRE sky to silhouettes — a dex-derivation error must degrade to the neutral tuning view (T-07-09 mitigate), never blank the constellation. The panel switch stays bound to the raw dexOverlay preference; only rendering respects readiness."
  - "Combined focus-dim + dex-dim by Math.min(focusAlpha, dexAlpha) exactly as the plan's two-dim contract specifies (MINIMUM, not multiply). An unseen non-neighbor resolves to 0.12 (focus wins), not 0.35×0.12 — the two 3×-apart dims never compound into an illegible product."
  - "Threaded caught through the sheetBars → NodeSheet → RankedBar chain (adding `caught?` to the SheetBar interface + forwarding it in NodeSheet). NodeSheet + ExploreFilterFab are intermediary components omitted from the plan's files_modified list; wiring the switch and the tick is impossible without passing props through them (Rule 3). RankedBar and the panel switch were already fully scaffolded in 07-04/07-05 — this slice only feeds them their live state, no re-implementation."
  - "Drew the grayscale silhouette via a Rec-601 luma of the tuning-family hex (grayscaleOf) so an unseen star keeps its relative brightness but loses all hue — 'dim = dex' reads unambiguously against the full-color caught sky, and the fill stays a single fillStyle (no canvas filter/compositing that jsdom or older Safari might not honor)."
  - "Zoom-gated the sighting-count pill on the SAME globalScale >= COUNT_ZOOM_THRESHOLD (2.5) gate the 07-03 device spike verified for labels, so counts appear only on zoom-in — no 264-badge soup at rest (D-11). The pill is drawn with arcTo (not roundRect, which isn't universally available) and dark #0C0C10 text on the #22C55E fill for contrast."

patterns-established:
  - "Pattern: a visual overlay is a render-pass flag over the same frozen graphData + single derivation source — never a data rebuild or a parallel pipeline; live reactivity comes from the source hook (useLiveQuery), not from re-deriving in the view"

requirements-completed: [DEX-05]

# Metrics
duration: ~15min
completed: 2026-07-16
---

# Phase 7 Plan 06: Explore Dex Overlay — Your Sky Summary

**The constellation now opens as YOUR sky: with the "My dex overlay" ON by default (D-10, the Pokédex made spatial), caught songs keep full tuning color and wear a green (#22C55E) sighting ring while unseen songs recede to dimmed 35% grayscale silhouettes — and zooming in past the count threshold reveals a small green pill with each caught song's sighting count (no badge soup at rest, D-11). The overlay reads live from the existing `useDexStats` hook, so marking a show in the Dex tab recolors the sky instantly via `useLiveQuery` with zero second derivation and zero reheat. Toggling the panel switch OFF restores the neutral tuning-family view (dim = data, not dex). The two dimming systems — focus-dim (0.12) and dex-dim (0.35) — combine by MINIMUM so state always reads unambiguously. Ranked-bar rows gain a matching caught-tick (green Check / hollow circle) when the overlay is ON, so the bars panel mirrors the sky's semantics. This closes DEX-05, the phase's last requirement.**

## Performance
- **Duration:** ~15 min
- **Tasks:** 2 (both `type="auto"`)
- **Files:** 5 modified (0 created — all symbols were scaffolded in 07-02/07-04/07-05)

## Accomplishments

### Task 1 — Dex overlay draw layers on the canvas (`0baa546`)
- `ConstellationCanvas` gains `overlay?: boolean` + `sightingsFor?: (id) => number` props and extends the single `nodeCanvasObject` with the overlay layers, ordered **fill → dex-dim → sighting ring → focus ring → count → label**:
  - **Unseen (overlay ON, sightings 0):** the fill is desaturated to its Rec-601 grayscale-luminance equivalent (`grayscaleOf`) and dimmed to `DEX_DIM_OPACITY` (0.35); no ring.
  - **Caught (overlay ON, sightings > 0):** full tuning color + a `#22C55E` sighting ring (1.5px screen-space, just outside the fill). A green count pill (11px, dark text) draws above the node **only when `globalScale >= COUNT_ZOOM_THRESHOLD` (2.5)** — the same 07-03-verified zoom gate labels use.
  - **Two-dim contract:** `ctx.globalAlpha = Math.min(focusAlpha, dexAlpha)` — focus-dim (0.12) and dex-dim (0.35) resolve by MINIMUM, never multiplication.
  - **Overlay OFF:** `caught`/`unseen` both false → every node full tuning color, no rings, no dex-dim (dim = data, not dex).
- `ExploreView` reads `useDexStats()` (the single dex path), computes `dexReady` (ready && no error && dex present) and `dexOverlayActive = dexOverlay && dexReady`, and a memoized `sightingsFor` accessor off `dex.perSong`. Overlay is ON by default (`useState(true)`, D-10) and passed to the canvas as `overlay={dexOverlayActive}` so a not-ready/errored dex degrades to the neutral view rather than blanking the sky (T-07-09).
- The canvas `aria-label` now reports the actually-drawn (filtered) shown-song count instead of the full catalog length.

### Task 2 — Overlay switch + bar caught-tick (`668ce73`)
- The `ExploreFilterPanel` "My dex overlay" switch (previously the **reserved/disabled** third row from 07-05) is now enabled: `dexOverlay` + `onDexOverlayChange` are threaded ExploreView → `ExploreFilterFab` → panel. The panel already carried the full switch implementation (role="switch", ≥44px row, gold focus-visible ring, ON-default styling) — passing the handler flips `overlayReserved` false and activates it. Toggling OFF restores the neutral tuning view.
- The bar caught-tick is wired end-to-end: `ExploreView` sets `caught: dexOverlayActive ? sightingsFor(bar.songId) > 0 : undefined` on each `sheetBar`; `NodeSheet`'s `SheetBar` interface gains `caught?` and forwards it to `RankedBar`. `RankedBar`'s 07-04 seam already renders a green `Check` (caught) / hollow `#2A2A34` circle (unseen) / nothing (overlay OFF) — same idiom as the dex `SongRow`. No new derivation: the tick reuses the same `sightingsFor` path as the sky.

## Preserved from 07-03 / 07-04 / 07-05
- **07-03:** imperative `d3Force("charge"/"link")` spacing + reheat, the `onEngineStop` `zoomToFit` framing, and `enableNodeDrag={false}` — all untouched (grep-confirmed present). The `COUNT_ZOOM_THRESHOLD` gate is reused, not altered.
- **07-04:** `focusId`/`onFocus`, focus-dim, the gold focus ring, forced neighbor labels, and the focus camera are intact. The overlay's dex-dim stacks on focus-dim by minimum — the gold ring and focus behavior are unchanged; only the alpha/fill computation is extended. The inert `RankedBar caught?` seam is now fed live.
- **07-05:** the filter draw-gate (`visibleNodeIds` / `linkVisibility` / `edgeThreshold`) is untouched — overlay is an orthogonal render-pass layer. Toggling the overlay never rebuilds `graphData` and never reheats (the frozen fx/fy layout survives). The reserved overlay-switch slot is filled exactly where 07-05 left it.

## Task Commits
1. **Task 1: Dex overlay draw layers on the canvas** — `0baa546` (feat)
2. **Task 2: Overlay switch + bar caught-tick** — `668ce73` (feat)

## Files Created/Modified
- `packages/app/src/explore/ConstellationCanvas.tsx` — `overlay`/`sightingsFor` props; sighting-ring + grayscale-silhouette + zoom-gated count-pill draw layers; two-dim-by-minimum alpha; shown-count aria-label; `grayscaleOf` helper + sighting color constants
- `packages/app/src/explore/ExploreView.tsx` — `useDexStats` wiring, `dexReady`/`dexOverlayActive`/`sightingsFor`, canvas overlay props, FAB switch wiring, `caught` on `sheetBars`
- `packages/app/src/explore/ExploreFilterFab.tsx` — forwards `dexOverlay`/`onDexOverlayChange` to the panel (intermediary threading)
- `packages/app/src/explore/ExploreFilterPanel.tsx` — no logic change; the reserved switch activates once the handler is passed (07-05 scaffold)
- `packages/app/src/explore/NodeSheet.tsx` — `SheetBar.caught?` added + forwarded to `RankedBar` (intermediary threading)

_Note: `ExploreFilterPanel.tsx` appears in the plan's files list but needed no source edit — its switch was fully built in 07-05 and only required the handler; it is listed here for provenance. `RankedBar.tsx` (a plan Task-2 file) likewise needed no edit — its caught-tick was scaffolded in 07-04 and is turned on purely by the threaded `caught` prop._

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Tooling] pnpm verify commands run via npm/npx**
- **Found during:** both verify steps.
- **Issue:** the plan specifies `pnpm --filter @guezzer/app exec tsc` / `pnpm -w test`, but the repo is an **npm** workspace (no `pnpm-lock.yaml`, no `pnpm` on PATH; established 07-01..07-05). CLAUDE.md lists npm workspaces as an approved equal.
- **Fix:** ran `npx tsc -p packages/app/tsconfig.json --noEmit`, `npm test` (root `vitest run`), and `npm run build -w @guezzer/app`. Identical result.
- **Commit:** n/a (tooling only).

**2. [Rule 3 - Blocking] Threaded overlay props through intermediary components omitted from the plan's file list**
- **Found during:** Task 2.
- **Issue:** the plan's `files_modified` lists `ExploreFilterPanel` + `RankedBar` but not the two components that sit between them and `ExploreView`: `ExploreFilterFab` (renders the panel) and `NodeSheet` (renders the bars). The switch and the caught-tick cannot be wired without passing props through both.
- **Fix:** added `dexOverlay`/`onDexOverlayChange` to `ExploreFilterFab` (forwarded to the panel) and `caught?` to `NodeSheet`'s `SheetBar` (forwarded to `RankedBar`). Pure prop threading, no behavior of its own.
- **Commit:** `668ce73`.

### Design decisions (documented above in key-decisions)

**3. [Design] Overlay ACTIVE state gated on dex readiness**
- `dexOverlayActive = dexOverlay && dexReady`. If the dex derivation is not-ready/errored, an ON overlay would read every song's sightings as 0 and silhouette the whole sky. Gating on readiness degrades to the neutral tuning view (T-07-09 mitigate) while keeping the panel switch bound to the user's raw preference.

**4. [Design] Grayscale silhouette via Rec-601 luma + arcTo count pill**
- Unseen fills are desaturated by a single computed gray `fillStyle` (`grayscaleOf`) rather than a canvas `filter`/composite (portability + no jsdom/Safari surprises). The count pill uses `arcTo` (not the not-universally-available `roundRect`) with dark text on the green fill for contrast.

## Known Stubs
None. The dex-overlay switch — the reserved/inert slot tracked as a stub in 07-05 — is now live and wired; no placeholder or dead-but-live controls remain. Every overlay surface reads real sightings from `useDexStats`.

## Threat Flags
None. No new network endpoints, auth paths, file access, or schema changes. The overlay reads the user's own local dex (Dexie → `useDexStats`), read-only — nothing is written and nothing is exposed (T-07-08 accept). The dex error path degrades to the neutral view rather than throwing (T-07-09 mitigate, via `dexReady`). kglw-derived song names still render via escaped React text / canvas `fillText` only (T-07-02).

## Verification
- App typecheck: `npx tsc -p packages/app/tsconfig.json --noEmit` → exit 0 (both tasks)
- Full suite: `npm test` (`vitest run`) → **480 passed (65 files)**, no regression (the benign jsdom `getContext`/`navigation` lines are pre-existing; canvas draw is device-validated per RESEARCH §Validation, not jsdom)
- Vite build: `npm run build -w @guezzer/app` → exit 0 (the >500 KB single-chunk warning is pre-existing — the model artifact is bundled by design, CLAUDE.md — out of scope). Confirms the new `useDexStats` import resolves through the app graph.
- Worktree hygiene: `package-lock.json` untouched by `npm install`; `dist/` gitignored; no stray untracked files
- Preserved-behavior grep: `enableNodeDrag={false}`, `zoomToFit`, and `d3Force("charge")` all present in `ConstellationCanvas.tsx`

## User Setup Required
None — pure read/derive/render, no network, persistence, or secrets. On-device confirmation of the sighting-ring legibility and the count-pill zoom reveal is a natural next device-pass candidate but was not a plan checkpoint.

## Self-Check: PASSED
All five modified files exist on disk with the described changes; both task commits (`0baa546`, `668ce73`) are present in git history; 07-03's `enableNodeDrag={false}`, `zoomToFit` framing, and `d3Force("charge")` tuning remain in `ConstellationCanvas.tsx`; 07-05's filter draw-gate and 07-04's focus seam are intact. App typecheck exit 0, full suite 480/480 green, vite build exit 0.

---
*Phase: 07-explore-mode-constellation*
*Completed: 2026-07-16*
