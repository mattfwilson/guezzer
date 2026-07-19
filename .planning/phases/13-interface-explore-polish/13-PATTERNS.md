# Phase 13: Interface & Explore Polish - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 9 modified in place (+ 6 audited-only overlays) / 0 net-new source files
**Analogs found:** 9 / 9 (all fixes are in-place edits — the analog IS the current file + its sibling idioms)

> **Nature of this phase:** A 4-bug hardening cluster. Every changed file already exists;
> the "closest analog" for each is the file's own current code and the sibling idioms it must
> preserve. There are NO net-new source files — only extensions to two existing test files.
> Pattern assignments below pin the exact functions/lines to change and the idioms to keep intact.

## File Classification

| Modified File | Role | Data Flow | Closest Analog (idiom to preserve) | Match Quality |
|---------------|------|-----------|-------------------------------------|---------------|
| `packages/app/src/styles.css` (UX-01) | config (global CSS) | transform (layout) | The six fixed overlays' per-surface `env()` calc (already correct) | exact — self |
| `packages/app/src/components/AppShell.tsx` (UX-01) | component (in-flow header) | request-response (render) | Overlay headers `calc(env(safe-area-inset-top) + 12px)` | exact — sibling |
| `packages/app/src/wakeLock.ts` (UX-02) | utility (browser-API glue) | event-driven (lifecycle) | `releaseWakeLock` never-throw block (:79-83); mirrors `pwa/persist.ts` | exact — self |
| `packages/core/src/live/suggest.ts` (UX-03) | utility (pure core) | transform (derivation) | `diffLatestAgainstTrail` sort+anchor idiom (:106-134); `resolvePlaceholders` (:144-161) | exact — self+sibling |
| `packages/app/src/explore/ConstellationCanvas.tsx` (UX-04) | component (canvas) | event-driven (settle/camera) | focus-camera effect (:325-348); `onEngineStop` (:695-714) | exact — self |
| `packages/app/src/config.ts` (UX-04) | config | — | `explore.FOCUS_*` constant block (:451-465) | exact — sibling |
| `packages/core/test/suggest.test.ts` (UX-03) | test (extend) | — | `describe("resolvePlaceholders")` fixture block (:177-216) | exact — extend |
| `packages/app/test/wakeLock.test.ts` (UX-02) | test (extend) | — | deferred-request mock idiom (:12-34, `liveSentinel`) | exact — extend |
| Six overlays (audit-only, see UX-01) | component | request-response | mutually — all share `env + 12px` except RecapView (`+24px`) | exact — sibling |

---

## Pattern Assignments

### UX-01 — `packages/app/src/styles.css` + `AppShell.tsx` (config/component, layout transform)

**The one change (D-01):** delete the doubled top inset from `body`. Everything else realigns
automatically because all fixed overlays position against the viewport and never received body
padding.

**Current `body` inset block** (`styles.css:185-190`) — remove ONLY line 186:
```css
  /* Safe-area awareness for notches / home indicators (venue reality: fat-thumb, edge-to-edge). */
  padding-top: env(safe-area-inset-top);      /* ← DELETE this line (the doubled top inset) */
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
```
> Discretion (D-01): planning may also move L/R/bottom to per-surface calc for "one idiom" purity,
> but RESEARCH flags that as an enlarged blast radius (must re-add L/R/bottom to `<main>` :63 and
> re-verify every overlay). Recommendation: ship the top-only deletion; treat full migration as
> optional. The bottom body pad is already covered by the fixed `BottomTabBar` — no dead band.

**The canonical per-surface idiom to preserve** — every top-anchored surface owns its inset. This
is the AppShell in-flow header (`AppShell.tsx:39-42`), which is CORRECT once body's pad is gone:
```tsx
      <header
        className="flex items-center justify-between border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
```

**Surface audit — all 7 top-anchored `env(safe-area-inset-top)` surfaces** `[VERIFIED: grep 2026-07-19]`.
Do NOT edit the overlays; they were always single-inset. The audit is to confirm header-height
consistency after the body deletion:

| Surface | Line | Positioning | Top calc | Action |
|---------|------|-------------|----------|--------|
| `components/AppShell.tsx` header | :41 | in-flow (inside body) | `env + 12px` | **the bug — fixed by deleting styles.css:186 (no edit here)** |
| `show/SearchSheet.tsx` | :105 | `fixed inset-0` | `env + 12px` | leave (already correct) |
| `dex/ArchiveBrowser.tsx` | :256 | `fixed inset-0` | `env + 12px` | leave |
| `dex/AlbumDetail.tsx` | :53 | `fixed inset-0` | `env + 12px` | leave |
| `dex/CompareView.tsx` | :57 | `fixed` header | `env + 12px` | leave |
| `dex/SetlistView.tsx` | :136 | `fixed inset-0` | `env + 12px` | leave |
| `dex/RecapView.tsx` | :162 | `fixed inset-0` | **`env + 24px`** | **DECISION: normalize to +12px or document as intentional** |

> **RecapView `+24px` (Open Question 1):** after the fix its header sits 12px lower than the other
> six. RESEARCH recommends leaving it + one-line comment marking intentional. Do NOT silently
> normalize — it changes recap layout. Planning must make an explicit call.

**Validation:** device-only iOS UAT (no unit test — CSS `env()` under `viewport-fit=cover`).

---

### UX-02 — `packages/app/src/wakeLock.ts` (utility, event-driven lifecycle)

**Analog = the file itself.** The fix inserts a `showActive` re-check into `acquireWakeLock`,
directly reusing the module's existing never-throw / silent-fallback idiom.

**The seam to change** (`wakeLock.ts:49-67`) — insert the re-check right after the `await`
resolves, BEFORE the `next.released` check:
```ts
  try {
    const next = await navigator.wakeLock.request("screen");

    // ← D-02 RE-CHECK GOES HERE: if End Show fired during the in-flight request,
    //   showActive is now false → release `next`, return, do NOT store sentinel,
    //   do NOT call onUnsupported (End Show is normal teardown, not "unsupported").

    // Verify the lock actually HELD: an installed-PWA false-positive resolves a
    // sentinel that is already released. Treat it as unsupported (Pitfall 1).
    if (next.released) {
      onUnsupported();
      return;
    }

    next.addEventListener("release", () => {
      if (sentinel === next) sentinel = null;
    });
    sentinel = next;
  } catch {
    onUnsupported();
  }
```

**The never-throw idiom to COPY for the new release** — take it verbatim from `releaseWakeLock`
(`wakeLock.ts:79-83`), so the End-Show branch's `next.release()` swallows identically:
```ts
  try {
    await held.release();
  } catch {
    // Swallow — releasing is best-effort and must never surface an error.
  }
```

**Contract points that MUST hold** (module docstring :1-19, `bindVisibilityReacquire` :91-105):
- Never-throw: wrap the new `next.release()` in `try {} catch {}` and swallow.
- No false "unsupported": the End-Show branch returns silently — do NOT call `onUnsupportedCb`.
- No sentinel stored: `return` before `sentinel = next`. Reacquire listener can't fire post-End-Show
  anyway (`showActive === false` guard at :99), so this is safe and does not fight reacquire.

> **Residual (A5, Open Question 2):** rapid End-Show→Start-Show with an old acquire in flight still
> leaks (boolean `showActive` can't distinguish shows). Planning: accept & document (smallest
> hardening) OR add the ~3-line monotonic `epoch` token (`const myEpoch = ++epoch` before the await;
> only store if `epoch === myEpoch`). Flag explicitly if scope-expanding beyond D-02.

**Validation (component, jsdom):** extend `packages/app/test/wakeLock.test.ts` — see test idiom below.

---

### UX-03 — `packages/core/src/live/suggest.ts` (pure core utility, transform)

**Analog = `resolvePlaceholders` itself (`:144-161`) + its sibling `diffLatestAgainstTrail`
(`:106-134`).** The bug is the raw same-position match at `:151`.

**The bug** (`suggest.ts:149-159`):
```ts
  for (const entry of trail) {
    if (!entry.isPlaceholder) continue;
    const match = latestRows.find((row) => row.position === entry.position);  // ← BUG :151
    if (!match) continue;                                                     //   two independent
    hints.push({                                                             //   coordinate systems
      position: match.position,
      songId: match.song_id,
      songName: match.songname,
      entryPosition: entry.position,
    });
  }
```
Trail `entry.position` = monotonic max+1 (gaps on skip/delete, `db.ts:325-334`); editor
`row.position` = contiguous 1,2,3. They diverge → confident off-by-N.

**Sibling idiom to COPY (sort-before-derive)** — `diffLatestAgainstTrail` already sorts editor
rows by position and iterates in order (`suggest.ts:119-133`); the new algorithm reuses this shape:
```ts
  const ordered = [...latestRows].sort((a, b) => a.position - b.position);
  // ... iterate `ordered` in position order, dedupe/anchor by song_id (NOT position) ...
```

**Recommended fix (D-03 conservative-suppress) — interval-count-match subsequence anchoring:**
1. Sort trail by `position`; sort editor rows by `position`.
2. Anchors = logged trail entries (`!isPlaceholder && songId !== null`), matched to editor rows
   **by `songId`** — the same by-song_id keying `diffLatestAgainstTrail` uses (:112-117, 124).
   Require anchors to form a strictly-increasing in-order subsequence of editor indices.
3. Partition both into intervals bounded by consecutive anchors, INCLUDING head (before first
   anchor) and tail (after last).
4. Per interval: if `#placeholder-slots === #editor-rows-in-interval`, map 1:1 in order → emit
   `FillHint`. Otherwise SUPPRESS that interval. Any out-of-order/missing anchor → suppress.

**FillHint contract to preserve** (`suggest.ts:83-88`) — keep the interface unchanged; set
`entryPosition = placeholder.position` (the UI's `renameEntry` handle) and take `position/songId/
songName` from the BRACKETED editor row, not the raw same-position row:
```ts
export interface FillHint {
  position: number;      // now: the bracketed editor row's position
  songId: number;
  songName: string;
  entryPosition: number; // still: the placeholder's trail position (renameEntry handle)
}
```

**Purity constraint (CLAUDE.md):** stays entirely in `packages/core` — zero DOM, zero db import.
`TrailEntryInput` (:24-28) is the re-declared app-free projection; do not import from the app.

**Validation (unit, node):** extend the test block — see below.

---

### UX-04 — `packages/app/src/explore/ConstellationCanvas.tsx` + `config.ts` (component, event-driven camera)

**Analog = the file's own `onEngineStop` (`:695-714`) and focus-camera effect (`:325-348`).**

**The reheat→re-fit loop.** Spacing effect keyed on `[graphData, size.width, size.height]`
(`:221-233`) reheats on any resize, re-firing `onEngineStop`:
```tsx
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // ...charge/link strength from config...
    fg.d3ReheatSimulation();               // ← re-fires onEngineStop on every resize
  }, [graphData, size.width, size.height]);
```

**The unconditional fit to gate** (`onEngineStop`, `:695-714`) — keep the `fx/fy` pinning
(EXPL-06 invariant) UNCHANGED; gate ONLY the `zoomToFit` behind a first-settle ref:
```tsx
          onEngineStop={() => {
            for (const raw of graphData.nodes) {   // ← KEEP: settle-and-freeze pin, every time
              const n = raw as FgNode;
              n.fx = n.x;
              n.fy = n.y;
            }
            // ← GATE: call zoomToFit ONLY if the first-settle ref is true, then set it false.
            fgRef.current?.zoomToFit(
              config.explore.ZOOM_TO_FIT_DURATION_MS,
              config.explore.ZOOM_TO_FIT_PADDING_PX,
              (n: FgNode) =>
                (connectedIds.size === 0 || connectedIds.has(n.id)) &&
                isNodeVisible(n.id),
            );
          }}
```

**First-settle ref mechanism (D-05):**
- `const firstSettleRef = useRef(true)`.
- Reset to `true` in a `useEffect` keyed strictly on `[graphData]` (Pitfall 4: NOT `[size]`, NOT a
  filter dep). Filters (`topK`/`overlay`/`visibleNodeIds`) provably never rebuild `graphData`
  (memo comments :253-259) — only a view change (Rotation ↔ Full catalog) does, which legitimately
  should re-fit.
- In `onEngineStop`: `if (firstSettleRef.current) { zoomToFit(...); firstSettleRef.current = false; }`.

**Off-screen focus re-center (the D-05 exception) — extend the EXISTING focus-camera effect**
(`:325-348`), do not add a new one:
```tsx
  useEffect(() => {
    if (focusId == null) return;
    const fg = fgRef.current;
    if (!fg) return;
    const node = graphData.nodes.find((n) => n.id === focusId) as FgNode | undefined;
    if (!node || node.x == null || node.y == null) return;
    // ...zoom(k, ms) + centerAt(node.x, node.y + offsetWorld, ms)...
  }, [focusId, graphData, size.height, visibleViewportHeight]);   // ← ADD size.width to deps
```
- Add `size.width` to the deps so a width-changing resize re-evaluates.
- Gate the re-center on an actual off-screen test via `fg.graph2ScreenCoords(node.x, node.y)`
  against `[0..size.width] × [0..size.height]` minus `FOCUS_OFFSCREEN_MARGIN_PX` (Pitfall 5: do NOT
  reframe a still-visible focus). `[A4: verify graph2ScreenCoords on installed 1.29.1]`.
- Prefer pan-only (keep current zoom `k`) over re-zooming to `FOCUS_ZOOM_K` (Open Question 3).

**New config constant (`config.ts`, `explore` section)** — slot beside the existing `FOCUS_*`
block (`:451-465`), matching the `[ASSUMED]` + device-tune comment idiom:
```ts
    /** [ASSUMED] ms ease for the focus pan/zoom camera move (0 under prefers-reduced-motion). */
    FOCUS_CAMERA_DURATION_MS: 400,   // ← REUSE this for the re-center ease (no new duration const)
    // ↓ ADD ONE constant:
    /** [ASSUMED] Screen-px a focused node must fall past the viewport edge before a resize
     *  re-centers it (avoids re-centering a node grazing the edge). Device-tune like its peers. */
    FOCUS_OFFSCREEN_MARGIN_PX: <value>,
```
Single-config-file rule (CLAUDE.md): no scattered magic numbers; do NOT add a re-zoom constant
unless planning chooses to re-zoom rather than pan (A7).

**Validation:** device-only iOS UAT (camera lifecycle; not jsdom-testable).

---

## Shared Patterns

### Never-throw / silent-fallback browser-API idiom
**Source:** `packages/app/src/wakeLock.ts:79-83` (mirrors `pwa/persist.ts`)
**Apply to:** UX-02's new End-Show release branch.
```ts
  try {
    await held.release();
  } catch {
    // Swallow — best-effort, must never surface an error.
  }
```

### Sort-then-derive-by-song_id (pure-core diff idiom)
**Source:** `packages/core/src/live/suggest.ts:112-133` (`diffLatestAgainstTrail`)
**Apply to:** UX-03's `resolvePlaceholders` rewrite (sort editor rows, anchor by `songId` not position).

### Settle-and-freeze invariant (EXPL-06)
**Source:** `ConstellationCanvas.tsx:695-700` (pin `fx/fy` on every `onEngineStop`)
**Apply to:** UX-04 — the first-settle gate wraps ONLY `zoomToFit`; the `fx/fy` pinning stays
unconditional so the frozen layout never drifts.

### Single config file for constants
**Source:** `packages/app/src/config.ts` `explore` block (`:389-505`)
**Apply to:** UX-04's `FOCUS_OFFSCREEN_MARGIN_PX`. Follow the `[ASSUMED]`/`[VERIFIED: device spike]`
tagging convention. Pure-core mirrors (e.g. `BARS_TOP_N`) are noted where they MUST stay equal.

### Core/UI separation (CLAUDE.md)
**Apply to:** UX-03 lives entirely in `packages/core` (pure, node-testable, no DOM/app import).
UX-01/02/04 are `packages/app` (CSS/browser/canvas). Never cross the boundary.

---

## Test Extension Patterns (no new files — extend existing)

### UX-03 — `packages/core/test/suggest.test.ts` (extend `describe("resolvePlaceholders")` :177-216)
**Fixture idiom to copy** (`:178-196`): `latest`/`trail` built from `row({...})` / `entry({...})`
helpers; assert with `toMatchObject` / `.map((h) => h.songId)`. All 4 existing assertions MUST stay
green (hand-verified against the interval-count-match algorithm). New fixtures to add:
- Deleted mid-trail entry (trail positions `1,3,4` with a placeholder) → correct bracketed hint.
- Skipped song (`A(logged), ph, C(logged)`; editor `A,B,C`) → placeholder resolves to **B**, not C.
- Count mismatch (2 editor rows between anchors, 1 placeholder) → **suppress** (`[]`).
- Logged song absent-from-editor / out-of-order → **suppress** the affected interval.
- Trailing placeholder with multiple tail editor rows → **suppress**.

### UX-02 — `packages/app/test/wakeLock.test.ts` (extend, :12-60)
**Deferred-request mock idiom to copy** (`:12-34`): `freshModule()` via `vi.resetModules()` for
singleton isolation; `setWakeLock(request)`; `liveSentinel()` whose `.release` is a `vi.fn()`;
`flush = () => new Promise((r) => setTimeout(r, 0))`. New test: resolve the `request("screen")`
promise AFTER `releaseWakeLock()` runs; assert the late sentinel's `release()` spy fired (from the
re-check) and the module retained nothing (a subsequent `releaseWakeLock` is a no-op; `onUnsupported`
was NOT called).

---

## No Analog Found

None. Every changed file exists; the analog for each is its own current code plus a documented
sibling idiom. No net-new source files this phase (tests are extensions of existing files).

## Metadata

**Analog search scope:** `packages/app/src` (styles.css, components/AppShell, wakeLock, explore/,
show/, dex/, config.ts), `packages/core/src/live/suggest.ts`, `packages/core/test`, `packages/app/test`.
**Files scanned:** 11 (5 source targets + 6 audited overlays via grep + 2 test files).
**Pattern extraction date:** 2026-07-19
