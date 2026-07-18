# Phase 8: On-Device UI Polish & Accessibility - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 17 (5 net-new + 12 edited; plus the ~24-usage z-scale migration)
**Analogs found:** 12 / 17 (5 net-new a11y files have NO analog — this is the phase's genuinely-new layer)

This is a **UI-layer-only** phase under `packages/app/src`. No core changes, no schema, no artifact edits. The dominant pattern truth: the app has **one hand-rolled sheet shell idiom copied inline into 8 places** and **zero focus/Escape/inert machinery anywhere**. The new work is (1) factor that shell into `<Sheet>`, (2) build the a11y hooks from scratch (RESEARCH.md ships their full source — copy from there, not from an analog), (3) centralize z-index into config, (4) retune two pure constants.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `components/Sheet.tsx` | component (primitive) | event-driven | `components/AppMenu.tsx` (shell) + `show/TrailNodeSheet.tsx` (shell) | role-match (shell only; trap wiring is net-new) |
| `components/a11y/useFocusTrap.ts` | hook | event-driven | *(none — no hook uses `document.activeElement`/`inert`/`Tab` anywhere)* | **no analog** |
| `components/a11y/useDialogDismiss.ts` | hook | event-driven | `explore/NodeSheet.tsx:84-88` (bare `useEffect` + window listener idiom only) | partial (lifecycle shape only) |
| `components/a11y/dialogStack.ts` | utility (module LIFO) | event-driven | *(none — no module-level event store exists)* | **no analog** |
| `components/a11y/inertRoot.ts` | utility (ref-counted toggle) | event-driven | *(none)* | **no analog** |
| `config.ts` (add `ui.z`, orb retune, FAB gap) | config | — | `config.ts` existing `ui:` (:177-187) & `show` orb block (:89-99) | exact (same file, same idiom) |
| `components/AppMenu.tsx` | component (modal) | event-driven | self / `<Sheet modal bottom-sheet>` | exact |
| `show/TrailNodeSheet.tsx` | component (modal) | event-driven | self / `<Sheet modal bottom-sheet>` | exact |
| `show/EndShowDialog.tsx` | component (modal) | event-driven | `<Sheet modal bottom-sheet>` | exact |
| `dex/ShareCardSheet.tsx` | component (modal) | event-driven | `<Sheet modal bottom-sheet>` | exact |
| `dex/CompareView.tsx` | component (modal, fullscreen) | event-driven | `<Sheet modal fullscreen>` | role-match (fullscreen variant) |
| `settings/SettingsView.tsx:269` prompt | component (modal) | request-response (text input) | `<Sheet modal bottom-sheet>` + `initialFocusRef` | exact |
| `show/WhyDetail.tsx` | component (modal) | event-driven | `<Sheet modal bottom-sheet>` | exact (confirm inclusion — Open Q1) |
| `explore/NodeSheet.tsx` | component (non-modal sheet) | event-driven | keeps bespoke shell; consumes hooks only (D-02) | special case |
| `explore/ExploreFilterFab.tsx` | component (FAB) | event-driven | `show/FabMenu.tsx` (fixed-anchor idiom) + own `motion-safe:` transition | role-match |
| `show/orbLabelFit.ts` | utility (pure heuristic) | transform | self (constants only — no structural change) | exact |
| ~24 `z-*` usages (D-04) | styling | — | `config.ui.z` tiers via inline `style` | migration |

---

## Pattern Assignments

### `components/Sheet.tsx` (NEW — component primitive, event-driven)

**Analog (shell markup):** `components/AppMenu.tsx:40-52` and `show/TrailNodeSheet.tsx:82-94` — byte-for-byte the same shell. `<Sheet>` absorbs this exact markup.

The canonical modal shell to factor in (from `AppMenu.tsx:40-52`):
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-label="Menu"
  className="fixed inset-0 z-20 flex flex-col justify-end bg-black/50"
  onClick={onClose}                                   // backdrop tap-to-close
>
  <div
    className="rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
    style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
    onClick={(event) => event.stopPropagation()}      // inner stops the tap
  >
    {/* content */}
  </div>
</div>
```

**Every modal opens with the same guard** (`AppMenu.tsx:21`, mirrored in every sheet): `if (!open) return null;` — the primitive MUST preserve this (V7 Error Handling: keep the early-return so a closed sheet renders nothing and error states don't throw).

**Primitive changes vs. the analog shell:**
- Replace `className="… z-20 …"` with `style={{ zIndex: config.ui.z.sheet }}` on content and `config.ui.z.sheetScrim` on the backdrop (D-04 — no raw `z-*`).
- Add `tabIndex={-1}` to the `role="dialog"` content div (container-focus fallback, per RESEARCH Pattern 1).
- Wire `useFocusTrap(ref, { active: modal })` + `useDialogDismiss(open, onClose)`.
- `aria-modal={modal}` (was hardcoded `"true"`).
- `fullscreen` variant swaps the shell for `fixed inset-0 bg-surface overflow-y-auto`, no backdrop, header-X slot — analog is `dex/CompareView.tsx:80,100`.

**Props shape:** RESEARCH.md §Pattern 3 (`open`, `onClose`, `ariaLabel`, `variant`, `modal`, `backdrop`, `initialFocusRef`, `children`). Deliberately does NOT own scroll/drag/content layout.

---

### `components/a11y/useFocusTrap.ts` (NEW — hook, event-driven) — NO ANALOG

**Nothing in `packages/app/src` reads `document.activeElement`, sets `inert`, or handles `Tab`.** Confirmed net-new. **Copy the full implementation from RESEARCH.md §Pattern 1** (initial-focus → `setRootInert(true)` → Tab-wrap keydown → cleanup restores focus + decrements inert). Do not invent an analog.

Only reusable local idiom to match: the `useEffect(() => { … return () => cleanup }, [deps])` add/remove-listener shape used at `NodeSheet.tsx:84-88`.

### `components/a11y/useDialogDismiss.ts` (NEW — hook, event-driven)

**Copy from RESEARCH.md §Pattern 2** (module-level LIFO `dialogStack` + one shared `document` keydown; only topmost handler fires on Escape, with `stopPropagation`). The shape matches the local listener idiom below; the LIFO discipline is the net-new part.

**Local lifecycle idiom to mirror** (`explore/NodeSheet.tsx:84-88`):
```tsx
useEffect(() => {
  const onResize = () => setVh(window.innerHeight);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);
```

### `components/a11y/dialogStack.ts` + `components/a11y/inertRoot.ts` (NEW — utilities) — NO ANALOG

Module-level singletons. `dialogStack` = LIFO array of dismiss callbacks (RESEARCH §Pattern 2). `inertRoot` = **ref-counted** `setRootInert(on)` toggling native `inert` on the app-content root (React 19 boolean prop; RESEARCH Pitfall 4 — counter, not boolean, so stacked modals compose). No existing singleton/store pattern in the app to copy; write per RESEARCH.

---

### `config.ts` (EDIT — config) — EXACT ANALOG (same file)

**Add the `z` tier object inside the existing `ui:` section** (`config.ts:178-187`), right after `FAB_ACTION_HEIGHT`. The existing block is the pattern to extend (single-config-file rule, CLAUDE.md):
```typescript
ui: {
  SUGGESTION_STRIP_HEIGHT: 56,
  SYNC_DOT_DIAMETER: 8,
  FAB_DIAMETER: 56,
  FAB_ACTION_HEIGHT: 48,
  // ADD → per RESEARCH §Pattern 4:
  z: {
    content: 10, toast: 20, fab: 30, fabScrim: 35,
    sheetScrim: 40, sheet: 50, focusedFab: 60,
  },
  FAB_SHEET_GAP_PX: 12,   // D-03 lift gap
},
```

**Orb-label retune** — edit the `show` block constants (verified present at `config.ts:89-99`): bump `ORB_LABEL_MAX_LINES` 3→4, `ORB_LABEL_MIN_FONT_PX` 11→10, and the `_CENTER` analogues, after on-device verification (D-05). These are read at `PredictionOrb.tsx:63-67` and the `CenterNode` equivalent — pure inputs, no structural change.

---

### The 6 true modals + WhyDetail (EDIT — components, event-driven)

All seven are the identical shell idiom. Each migration = delete the inline `role="dialog"`/backdrop/`stopPropagation` div (and its raw `z-*`) and wrap children in `<Sheet>`.

| File | Line | Current | Migrate to |
|------|------|---------|-----------|
| `components/AppMenu.tsx` | 40-52 | `z-20`, backdrop + X | `<Sheet modal variant="bottom-sheet">` |
| `show/TrailNodeSheet.tsx` | 82-94 | `z-30`, backdrop (swaps to SearchSheet — **stacked**, tests LIFO) | `<Sheet modal bottom-sheet>` |
| `show/EndShowDialog.tsx` | 95 | `z-30`, backdrop + cancel | `<Sheet modal bottom-sheet>` |
| `dex/ShareCardSheet.tsx` | 88 | `z-40`, backdrop + Close | `<Sheet modal bottom-sheet>` |
| `dex/CompareView.tsx` | 80 / 100 | `z-40`, fullscreen header-X, **no backdrop** | `<Sheet modal variant="fullscreen">` |
| `settings/SettingsView.tsx` | 269-299 | `z-40`, backdrop; text input has **no `autoFocus`** | `<Sheet modal bottom-sheet>` + `initialFocusRef` on the `#whose-dex` input |
| `show/WhyDetail.tsx` | 37 | `z-20`, backdrop + X | `<Sheet modal bottom-sheet>` — **confirm inclusion (Open Q1)** |

**Note for the settings prompt:** the input at `SettingsView.tsx:291-299` is the one place `initialFocusRef` matters (focus the text field on open). Adding it changes focus only, not validation — `maxLength`/escaped-React-text stay (V5, unchanged).

---

### `explore/NodeSheet.tsx` (EDIT — non-modal sheet, D-02 special case)

**Do NOT route through `<Sheet>`** — its dynamic drag/peek/height shell (`NodeSheet.tsx:104-159`) is genuinely different and would leak props (RESEARCH anti-pattern). Keep the bespoke shell; add **only**:
- `useDialogDismiss(true, onClose)` for Escape.
- Focus-restore-on-unmount (capture `document.activeElement` on mount, restore in cleanup) — the restore half of `useFocusTrap` WITHOUT the trap/inert/scrim.
- Migrate its `z-30` (`:135`) → `style={{ zIndex: config.ui.z.sheet }}`.
- `aria-modal={false}` stays (`:133`).

**Latent bug to fix here (Pitfall 3):** `NodeSheet.tsx:81-88` computes peek from `window.innerHeight` — the iOS *large* viewport, mismatched against the constellation's visible-viewport sizing. Share one visible-viewport source (`window.visualViewport?.height ?? window.innerHeight`) with the FAB lift + camera (Open Q3).

---

### `explore/ExploreFilterFab.tsx` (EDIT — FAB lift, A11Y-02 / D-03)

**Analog for the motion idiom is in the same file** (`ExploreFilterFab.tsx:81-85`) and the camera effect at `ConstellationCanvas.tsx:323-326`:
```tsx
// ConstellationCanvas.tsx:323-326 — the reduced-motion gate to mirror:
const reduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
const ms = reduced ? 0 : config.explore.FOCUS_CAMERA_DURATION_MS;
```

**Changes** (RESEARCH §Pattern 5): add a `lifted` prop driven by `ExploreView`'s `focusId != null` (`explore/ExploreView.tsx:41,175`). Replace the raw `z-30` on the wrapper (`:56`) with inline `zIndex: lifted ? config.ui.z.focusedFab : config.ui.z.fab`, and add:
```tsx
transform: `translateY(${-liftPx}px)`,
transition: reduced ? "none" : `transform ${config.explore.FOCUS_CAMERA_DURATION_MS}ms`,
```
`liftPx` computed from the **shared visible-viewport peek height** minus the FAB resting bottom offset (`:50` `calc(env(safe-area-inset-bottom) + 64px + 8px)`) + `config.ui.FAB_SHEET_GAP_PX`.

---

### `show/orbLabelFit.ts` (EDIT — pure utility, constants only)

**No structural change** — the two-pass wrap+scale algorithm stays. Only the injected constants change (via `config.ts` above). On-device verification may also require raising the **internal** `CHAR_WIDTH_FACTOR` (`:37`, currently `0.52`) and/or lowering `USABLE_WIDTH_FACTOR` (`:39`, currently `1`) to correct the optimistic drift (RESEARCH §drift sources) — these are the only in-file edits, and both are already isolated named constants at the top of the file (single-source idiom preserved). Fixture test at `packages/app/test/orbLabelFit.test.ts`; add a real-catalog test per RESEARCH §Validation.

---

## Shared Patterns

### Z-index tier migration (D-04 — apply to ALL 24 usages)
**Source:** new `config.ui.z` (RESEARCH §Pattern 4).
**Apply via:** inline `style={{ zIndex: config.ui.z.X }}` — **NOT** Tailwind `z-[...]` (Tailwind v4 resolves arbitrary values at author-time from static strings; a JS-config value must go through inline style to keep config.ts the single source, CLAUDE.md).

Complete grep-verified inventory and tier map (adopt `<Sheet>` for the audited 7 only; migrate the z-literal on ALL):

| File:line | Current | Tier |
|-----------|---------|------|
| `show/ShowView.tsx:145` | `relative z-10` (in-flow column) | `content` (10) |
| `components/InstallBanner.tsx:90` | `z-10` | `toast` (20) |
| `components/UpdateToast.tsx:33` | `z-10` | `toast` (20) |
| `show/FabMenu.tsx:99` | `z-20` scrim | `fabScrim` (35) |
| `show/FabMenu.tsx:105` | `z-30` menu | `fab` (30) |
| `explore/ExploreFilterFab.tsx:56` | `z-30` | `fab` (30) / `focusedFab` (60) when lifted |
| `explore/NodeSheet.tsx:135` | `z-30` (non-modal, no scrim) | `sheet` (50) |
| `components/AppMenu.tsx:45` | `z-20` | `sheetScrim`/`sheet` |
| `show/WhyDetail.tsx:37` | `z-20` | `sheetScrim`/`sheet` |
| `show/EndShowDialog.tsx:95` | `z-30` | `sheetScrim`/`sheet` |
| `show/TrailNodeSheet.tsx:87` | `z-30` | `sheetScrim`/`sheet` |
| `show/CometTrail.tsx:225` | `z-30` backdrop | `sheetScrim`/`sheet` |
| `dex/ShareCardSheet.tsx:88` | `z-40` backdrop | `sheetScrim`/`sheet` |
| `settings/SettingsView.tsx:274` | `z-40` backdrop | `sheetScrim`/`sheet` |
| `dex/CompareView.tsx:80,100` | `z-40` fullscreen | `sheet` (50) |
| `dex/RecapView.tsx:103,143` | `z-40` | `sheet` (50) |
| `dex/AlbumDetail.tsx:47` | `z-30` fullscreen | `sheet` (50) |
| `dex/ArchiveBrowser.tsx:250` | `z-30` fullscreen | `sheet` (50) |
| `dex/ArchiveBrowser.tsx:353` | `z-40` backdrop | `sheetScrim`/`sheet` |
| `dex/SetlistView.tsx:119,129` | `z-30` fullscreen | `sheet` (50) |
| `show/SearchSheet.tsx:99` | `z-30` fullscreen | `sheet` (50) |

(24 literals across 20 files. Fullscreen `bg-surface` route-overlays go to `sheet`; they are NOT migrated to `<Sheet>` — only their z-literal moves. Confirm scope Open Q2.)

### Reduced-motion gate (all new animation)
**Source:** `ConstellationCanvas.tsx:323-326` and `NodeSheet.tsx:62-67` (`prefersReducedMotion()` helper) and the `motion-safe:transition-*` class idiom (`ExploreFilterFab.tsx:84`).
**Apply to:** the D-03 FAB lift transition. `transition: reduced ? "none" : …`. **Wave 0 gap:** `packages/app/test/setup.ts` has no `matchMedia` stub — centralize one (RESEARCH §Wave 0).

### Closed-sheet guard / error preservation (V7)
**Source:** `AppMenu.tsx:21` `if (!open) return null;` (every sheet has it).
**Apply to:** `<Sheet>` and every migrated modal — the primitive must not turn a guarded error/empty state (e.g. `CompareView` error branch at `:75-89`, `NodeSheet` honest-zero at `:161-170`) into a throw; render `children` untouched.

---

## No Analog Found

Files with no codebase precedent — planner uses RESEARCH.md's shipped source, not an analog:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/a11y/useFocusTrap.ts` | hook | event-driven | No focus/`inert`/`Tab` handling exists anywhere in `packages/app/src`. Copy RESEARCH §Pattern 1. |
| `components/a11y/dialogStack.ts` | utility | event-driven | No module-level event/store singleton exists. Copy RESEARCH §Pattern 2. |
| `components/a11y/inertRoot.ts` | utility | event-driven | No `inert` usage; ref-counting is net-new. Copy RESEARCH (Pitfall 4). |
| `components/a11y/useDialogDismiss.ts` | hook | event-driven | Escape handling is net-new; only the `useEffect` add/remove-listener shape is local (`NodeSheet.tsx:84`). |

---

## Metadata

**Analog search scope:** `packages/app/src/{components,show,explore,dex,settings}`, `config.ts`.
**Files scanned:** AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, CompareView, SettingsView, WhyDetail, NodeSheet, ExploreFilterFab, FabMenu, ConstellationCanvas, orbLabelFit, PredictionOrb, config (14 read) + full-repo `z-*` grep (24 usages across 20 files).
**Key finding:** one shell idiom copied into 8 sheets, zero a11y machinery — the phase factors the first and builds the second from RESEARCH's shipped source.
**Pattern extraction date:** 2026-07-18
