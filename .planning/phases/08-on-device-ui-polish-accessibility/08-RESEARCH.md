# Phase 8: On-Device UI Polish & Accessibility - Research

**Researched:** 2026-07-18
**Domain:** React 19 dialog/focus accessibility, mobile web layering, canvas/SVG text-fit verification
**Confidence:** HIGH (grounded in the actual source of all 14 referenced files + the real 264-song matrix artifact)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Build ONE shared sheet/modal primitive + a `useFocusTrap` hook and migrate all 7 sheets onto it. The a11y logic lives in one place; this also retires the duplicated `rounded-t-2xl border-t border-hairline bg-elevated` + safe-area shell copied inline in every sheet.
- **D-02:** NodeSheet stays **non-modal** — Escape-to-dismiss + focus-restore-to-trigger, but **NO focus-trap and NO scrim** (focus must still reach the live graph + FilterFab). The 6 true modals — AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, CompareView, and the "Whose dex is this?" prompt — get the full trap + restore + Escape treatment. `WhyDetail.tsx` is a strong candidate to include (confirm). CompareView is a full-screen overlay (header X, no backdrop) — trap/restore still apply, dismiss affordances differ.
- **D-03:** Lift the FilterFab **above** the NodeSheet's top edge when a node is focused (and place it above the sheet in the new z-scale). Animates up to rest just above the sheet's top edge, returns to resting position on close. Rejected: raise-z-only and hide-while-focused.
- **D-04:** Fold the centralized z-index scale into this phase; **DEFER** the sheet slide/scrim animation. Named tiers in the single config file; every FAB strictly below the sheet tier by default (the D-03 focused-node FilterFab lift is the deliberate exception). Migrate ALL current `z-*` usages onto the tiers.
- **D-05:** Bar = every REAL song name renders fully on a small phone; verify + tune `fitOrbLabel`/`ORB_LABEL`, keep ellipsis as an unreachable safety net. Verify against ACTUAL rendered orbs, not the heuristic's self-report; retune `CHAR_WIDTH_FACTOR`/floors/line count. Document the chosen minimum-legibility font floor. Applies to both the orb variant (`PredictionOrb`→`orbLabelFit.ts`) and the `_CENTER` variant (`CenterNode`).

### Claude's Discretion
- **POLISH-02:** Verify D-20 FabMenu speed-dial and D-22 once-per-version InstallBanner behave as their originating todos intended, then formally move those todos to resolved. Confirm-and-file, not a design decision.
- **A11Y-03:** The focus-camera effect already lists `size.height` in deps (`ConstellationCanvas.tsx:315-334`), so resize re-fires `fg.zoom()`+`fg.centerAt()`. Treat as verify-on-device + fix snap-off edge cases (keyboard show/hide, orientation), not from-scratch.
- Exact z-tier names/values, the shared-primitive API shape, the focus-trap implementation (roving vs sentinel), the FAB lift distance/animation, and final orb-fit constants — planner/research discretion within the decisions above; all tunables land in the single config file.

### Deferred Ideas (OUT OF SCOPE)
- Sheet slide-up/down animation + scrim cross-fade (animation half of the bottom-sheets todo) — its own polish pass; todo stays pending, annotated.
- Any change to prediction scoring, the matrix artifact, Show/Explore logic, or the dex.
- The other three matched todos (edge-flow particles, app-wide date format, share-card totals) — separate scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-01 | Prediction-orb + center-node names render fully legible on a small phone — no truncation/overflow/oversizing; verify `orbLabelFit`/`ORB_LABEL` on-device, fix residual. | §Orb-Label Legibility — real-catalog simulation + on-device verification harness + concrete retune recommendation. |
| POLISH-02 | Verify D-20 FabMenu speed-dial + D-22 once-per-version InstallBanner against originating todos; move todos to resolved. | §POLISH-02 Verification Approach — behaviors already implemented, confirm-and-file; automated coverage already exists (`fabMenu.test.tsx`, `installBannerVersion.test.tsx`). |
| A11Y-01 | Every sheet/modal dismisses with Escape, traps focus while open, restores focus to trigger on close. | §Focus/Dismiss Architecture — `useFocusTrap` + `useDialogDismiss` hook design, `inert` (React 19 native), Escape stack, shared `<Sheet>` primitive. |
| A11Y-02 | While a node is focused, NodeSheet + FilterFab both usable — no occlusion. | §FAB Lift Choreography — transform keyed off focus, lift distance from shared peek height, z-tier exception. |
| A11Y-03 | Resizing the viewport with a node focused keeps the camera framed (no snap-off). | §Resize Reframe — visualViewport/dvh/ResizeObserver gotchas, the `window.innerHeight` vs visible-viewport mismatch already latent in NodeSheet. |
</phase_requirements>

## Summary

This is a **UI-layer-only** phase in `packages/app/src` — no core changes, no new user features, no schema touch. Three workstreams: (1) an accessibility layer (Escape/focus-trap/focus-restore) that is **entirely net-new** — there is no `useFocusTrap`, no `inert`, no Escape handler, no `autoFocus`, and no focus-restore anywhere in the app today; (2) a small design-system consolidation (one z-index scale + one sheet primitive) folding a pending todo; and (3) empirical verification + retune of the orb-label fit heuristic against the real catalog on real hardware.

The single most important correctness finding: **`aria-modal="true"` alone does not trap focus** — every one of the 6 "true modal" sheets sets it today, yet none actually trap keyboard focus or restore it. Robust cross-AT focus containment (VoiceOver swipe navigation + TalkBack + keyboard Tab) requires **making the background `inert`**, which React 19 now supports as a native boolean prop `[VERIFIED: React 19 changelog / facebook/react#24730]`. A JavaScript Tab-key trap catches keyboard Tab but NOT the screen-reader virtual cursor; `inert` catches both. Recommendation: `useFocusTrap` combines initial-focus + focus-restore + a Tab-wrap keyboard guard, and true modals additionally toggle `inert` on the app-content root via a small ref-counted helper (so stacked modals compose correctly).

For POLISH-01: simulated against the **real 264-node matrix artifact** (`data/normalized/transition-matrix.json`), the current heuristic (`base 13 / min 11 / 3 lines`, `CHAR_WIDTH_FACTOR 0.52`, `USABLE_WIDTH_FACTOR 1`) ellipsizes **16 names at a 56px orb, 2 at 70px, 1 at 84px, 0 at 112px**. The single worst outlier is `(You Gotta) Fight for Your Right (To Party!)` (44 chars). The heuristic has **three known drift sources vs. real rendering** (bold-weight advance > 0.52, circular chord narrowing on multi-line, `USABLE_WIDTH_FACTOR=1` ignoring the circle geometry) — all of which make the no-DOM estimate *optimistic*, so real text can overflow even when the heuristic reports a clean fit. Verification must therefore render real orbs and measure (`Canvas measureText` / DOM `scrollWidth`), not trust the heuristic.

**Primary recommendation:** Build a dependency-free `useFocusTrap` + `useDialogDismiss` hook pair and a `<Sheet>` primitive (modal + non-modal + fullscreen variants); add a named `z` tier object to `config.ui`; lift the FilterFab via a `translateY` transform computed from a *shared* viewport-height source (fixing a latent `window.innerHeight` vs visible-viewport mismatch); and retune orb-fit to `4 lines / min 10px` after verifying real overflow on-device with a throwaway dev harness that renders all 264 names.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Focus trap / restore / Escape | Browser / Client (React DOM) | — | Pure client-side DOM focus management; no server, no core. Lives in `packages/app/src` hooks/components. |
| `inert` background suppression | Browser / Client (React 19 DOM) | — | Native platform attribute; React 19 renders it. Toggled on the app-content root. |
| z-index tier scale | Client (config.ts + component styles) | — | Named constants in the single config file, applied via inline `style={{ zIndex }}` on `fixed` overlays. |
| FAB lift choreography | Client (CSS transform + React state) | — | `translateY` keyed off ExploreView's `focusId`; honors `prefers-reduced-motion`. |
| Orb-label fit heuristic | Client (pure `orbLabelFit.ts`, no-DOM) | — | Stays a pure, unit-tested function; only its *constants* change. Real-render verification is a separate client harness. |
| Viewport-height source | Client (visualViewport / ResizeObserver) | — | Shared between NodeSheet peek, FAB lift, and camera reframe so they never disagree. |

All capabilities are client/browser tier. No API, CDN, or database responsibility exists in this phase.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.7 (installed) | Focus management + native `inert` prop | Already the app's framework; React 19 added boolean `inert` support `[VERIFIED: React 19 changelog / facebook/react#24730]`. No new dependency. |
| Platform DOM APIs | baseline | `document.activeElement`, `HTMLElement.focus()`, `KeyboardEvent`, `visualViewport`, `Canvas.measureText`, `element.scrollWidth`, `100dvh` | All baseline-supported on iOS Safari + Android Chrome (the two target browsers). No polyfill needed. |

**Recommendation: this phase ships ZERO new npm dependencies.** The a11y layer is ~120 lines of hooks; adding a library would violate the "tight, low-risk, pre-show" bias for less code than the integration glue.

### Supporting (dev-only, optional)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/user-event` | 14.6.1 `[VERIFIED: npm registry — but see provenance note]` | `userEvent.tab()` for real Tab-order focus-trap tests under jsdom | Only if the planner wants automated Tab-wrap assertions. jsdom + bare `@testing-library/react` (installed) does NOT simulate real tab order — `fireEvent.keyDown` can assert the handler runs, but not that focus actually wrapped. Optional Wave 0 add. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `useFocusTrap` | `focus-trap-react` 12.0.3 / `focus-trap` 8.2.2 `[ASSUMED — discovered via websearch; npm view confirms existence + active maintenance 2026-06-22, but not authoritatively sourced]` | Battle-tested edge cases (iframe, shadow DOM, initial/return focus options) but adds ~10KB + a portal/wrapper idiom that fights the app's inline `fixed inset-0` sheets. Overkill for 7 sheets in a personal PWA. Keep as fallback if the hand-rolled hook proves flaky on-device. |
| Custom sheet primitive | Native `<dialog>` element + `showModal()` | `<dialog showModal()>` gives free focus-trap + `::backdrop` + top-layer + Escape, BUT: (a) it cannot express the **non-modal** NodeSheet (D-02 needs the graph interactive behind it — `showModal` makes everything else inert, `show()` gives no trap), (b) `::backdrop` + top-layer conflicts with the app's z-tier scheme and the D-03 FAB-lift-above-sheet requirement, (c) bottom-sheet drag geometry + safe-area styling is harder inside the top layer. Rejected — the manual approach gives the modal/non-modal split D-02 requires. |
| `inert` on background | JS-only sentinel/roving trap | Sentinel traps only catch keyboard Tab, missing the AT virtual cursor (VoiceOver/TalkBack can still read "behind" the modal). `inert` is the correct primitive; use the JS Tab-wrap only as belt-and-suspenders. |

**Installation:** None. (Optional dev-only: `pnpm --filter @guezzer/app add -D @testing-library/user-event` — gate behind `checkpoint:human-verify` per the provenance note.)

## Package Legitimacy Audit

> This phase installs **no runtime packages**. The only candidate is an optional dev dependency.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@testing-library/user-event` | npm | mature (14.x line, years) | very high | github.com/testing-library/user-event | not run (unavailable this session) | Optional — `[ASSUMED]`, planner gates behind `checkpoint:human-verify` if adopted |
| `focus-trap-react` | npm | mature (12.0.3, pub 2026-06-22) | high | github.com/focus-trap/focus-trap-react | not run | Alternative-considered, NOT recommended. `[ASSUMED]` |

**Packages removed due to slopcheck [SLOP] verdict:** none (no runtime installs).
**Packages flagged as suspicious [SUS]:** none.

*slopcheck was not available this session. Both packages above are widely-used Testing-Library / focus-trap ecosystem members, but per the package-name provenance rule they are tagged `[ASSUMED]` — if the planner adopts either, gate the install behind a `checkpoint:human-verify` task. The recommended path (zero new deps) sidesteps this entirely.*

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │  App content root  (<div id="app-content">)  │
                         │   ── toggled inert while a MODAL is open ──   │
   trigger button ──────►│  ShowView / ExploreView / DexView / Settings │
   (focus captured       │                                              │
    on open)             └───────────────┬──────────────────────────────┘
        ▲                                │ opens
        │                                ▼
        │            ┌──────────────────────────────────────────────┐
        │            │  <Sheet modal | non-modal | fullscreen>       │
        │            │  role="dialog"  aria-modal={modal}            │
        │            │  ┌────────────────────────────────────────┐  │
        │            │  │ useDialogDismiss(onClose)              │  │
        │            │  │   • push onClose to dialogStack (LIFO) │  │
        │            │  │   • global keydown: Esc → top only     │◄─┼── Escape (topmost wins)
        │            │  │ useFocusTrap(ref, {active: modal})     │  │
        │            │  │   • capture document.activeElement     │  │
        │            │  │   • focus first focusable / container  │  │
        │            │  │   • Tab keydown → wrap within ref      │◄─┼── Tab / Shift+Tab
        │            │  │   • set inert on app-content root      │  │
        │            │  └────────────────────────────────────────┘  │
        │            └──────────────────────┬───────────────────────┘
        │                                   │ onClose / unmount
        └───────────────────────────────────┘  restore focus to captured trigger

   NON-MODAL path (NodeSheet, D-02):  useDialogDismiss(onClose) + focus-restore ONLY.
   NO inert, NO Tab-trap, NO scrim → focus still reaches the live graph + FilterFab.

   z-order (config.ui.z):  content < toast/banner < fab < sheetScrim < sheet < focusedFab
                                                          └─ D-03 exception: FilterFab lifts
                                                             ABOVE the (non-modal) NodeSheet
                                                             when a constellation node is focused
```

### Recommended File Structure (net-new, under `packages/app/src`)
```
components/
├── Sheet.tsx              # NEW — the shared primitive (modal | non-modal | fullscreen variants)
├── a11y/
│   ├── useFocusTrap.ts    # NEW — initial focus + Tab-wrap + inert + restore
│   ├── useDialogDismiss.ts# NEW — Escape via a shared LIFO dialogStack
│   └── dialogStack.ts      # NEW — module-level LIFO of dismiss callbacks (topmost handles Esc)
└── a11y/inertRoot.ts       # NEW — ref-counted inert toggle on the app-content root
config.ts                   # EDIT — add config.ui.z (tiers) + orb-label retune + FAB lift consts
```
NodeSheet keeps its bespoke drag/height shell (it does not fit the standard bottom-sheet flexbox) and consumes only the hooks. The 6 true modals adopt `<Sheet>`.

### Pattern 1: `useFocusTrap` (initial focus + Tab-wrap + restore + inert)
**What:** One hook owns the entire focus lifecycle for a modal.
**When to use:** The 6 true modals. NodeSheet passes `{ active: false }` for the trap portion but still uses the restore portion (or use `useDialogDismiss` for restore-only).
**Example (grounded in the app's real idioms):**
```typescript
// Source: composed from React 19 inert support [VERIFIED: facebook/react#24730]
//         + MDN HTMLElement.inert + standard focus-restore pattern.
import { useEffect, useRef } from "react";
import { setRootInert } from "./inertRoot.ts";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),' +
  'select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  { active }: { active: boolean },
) {
  const restoreTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    setRootInert(true); // ref-counted: also correct for stacked modals

    // Initial focus: first focusable, else the container itself (needs tabindex=-1).
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && activeEl === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener("keydown", onKeyDown);

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      setRootInert(false);                 // ref-counted decrement
      restoreTo.current?.focus?.();        // restore focus to the trigger (D-01)
    };
  }, [active, ref]);
}
```
Notes: the container needs `tabIndex={-1}` so container-focus works when a sheet has no focusable child (rare). `setRootInert` is ref-counted so two stacked modals both restore/clear correctly (e.g. TrailNodeSheet → SearchSheet, or CompareView opened from Settings behind the name prompt).

### Pattern 2: Escape via a shared LIFO stack (no double-fire)
**What:** A module-level stack of dismiss callbacks; one global `keydown` listener invokes only the topmost on Escape.
**Why:** The app stacks dialogs (TrailNodeSheet swaps to SearchSheet; Settings shows the "Whose dex" prompt then CompareView). N independent per-dialog `document` listeners would all fire on one Escape and dismiss the whole stack. A single listener + LIFO guarantees one Escape closes exactly one (topmost) dialog.
```typescript
// Source: standard modal-stack pattern; grounded in the app's stacked-dialog reality.
const stack: Array<() => void> = [];
let installed = false;
function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return;
  e.stopPropagation();
  stack[stack.length - 1]!();           // topmost only
}
export function useDialogDismiss(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    if (!installed) { document.addEventListener("keydown", onKey); installed = true; }
    stack.push(onClose);
    return () => { const i = stack.indexOf(onClose); if (i >= 0) stack.splice(i, 1); };
  }, [active, onClose]);
}
```

### Pattern 3: Shared `<Sheet>` primitive shape (absorbs the 6 hand-rolled shells)
```typescript
interface SheetProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  variant?: "bottom-sheet" | "fullscreen"; // bottom-sheet default; fullscreen = CompareView
  modal?: boolean;                         // default true; false = NodeSheet (no scrim/trap/inert)
  backdrop?: boolean;                      // default = modal; fullscreen sets false
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}
```
The primitive renders: optional backdrop (`bg-black/50`, `onClick={onClose}` when modal), a content container with `role="dialog"`, `aria-modal={modal}`, `tabIndex={-1}`, the shell classes (`rounded-t-2xl border-t border-hairline bg-elevated` + `paddingBottom: calc(env(safe-area-inset-bottom) + 32px)` for bottom-sheet), `onClick` stopPropagation, and wires `useFocusTrap({active: modal})` + `useDialogDismiss(open, onClose)`, plus `style={{ zIndex: config.ui.z.sheet }}`. The `fullscreen` variant swaps to `fixed inset-0 bg-surface overflow-y-auto`, no backdrop, and a header-X slot. **The primitive deliberately does NOT own scroll internals, drag geometry, or content layout** — those stay in each sheet so it never over-abstracts.

**Migration map (the 6 modals + the special case):**
| File | Line | Current | Migrate to |
|------|------|---------|-----------|
| `components/AppMenu.tsx` | 40 | `z-20`, backdrop + X | `<Sheet modal bottom-sheet>` |
| `show/TrailNodeSheet.tsx` | 82 | `z-30`, backdrop | `<Sheet modal bottom-sheet>` (note: swaps to SearchSheet — stacked) |
| `show/EndShowDialog.tsx` | 90 | `z-30`, backdrop + cancel | `<Sheet modal bottom-sheet>` |
| `dex/ShareCardSheet.tsx` | 83 | `z-40`, backdrop + Close | `<Sheet modal bottom-sheet>` |
| `dex/CompareView.tsx` | 80/100 | `z-40`, fullscreen header-X | `<Sheet modal fullscreen>` |
| `settings/SettingsView.tsx` | 269 | `z-40`, backdrop; input needs `autoFocus` | `<Sheet modal bottom-sheet>` + `initialFocusRef` on the text input |
| `explore/NodeSheet.tsx` | 130 | `z-30`, non-modal, drag | Keep shell; add `useDialogDismiss` + focus-restore only (D-02) |
| `show/WhyDetail.tsx` | 37 | `z-20`, backdrop + X | **Confirm inclusion** — same idiom, easy win → `<Sheet modal bottom-sheet>` |

### Pattern 4: z-index tier scale in config
```typescript
// config.ts — add to the `ui:` section (single-config-file rule, CLAUDE.md).
ui: {
  // ...existing FAB_DIAMETER / FAB_ACTION_HEIGHT...
  /** Named stacking tiers (D-04). Every FAB tier sits STRICTLY below `sheet`;
   *  `focusedFab` is the ONE deliberate exception (D-03 FilterFab lift). Applied
   *  via inline `style={{ zIndex: config.ui.z.X }}` on each `fixed` overlay,
   *  replacing every raw Tailwind `z-NN` class so the fix can't relocate a collision. */
  z: {
    content: 10,     // in-flow raised content (ShowView column, currently z-10)
    toast: 20,       // UpdateToast + InstallBanner (transient bottom notifications)
    fab: 30,         // resting FABs + FabMenu action rows
    fabScrim: 35,    // FabMenu full-viewport scrim (below sheets, above content)
    sheetScrim: 40,  // modal sheet/dialog backdrops
    sheet: 50,       // sheet/dialog content (all modals + the non-modal NodeSheet)
    focusedFab: 60,  // D-03 exception: FilterFab lifted above NodeSheet when focused
  },
}
```
Apply via `style={{ zIndex: config.ui.z.sheet }}` (NOT Tailwind `z-[...]` arbitrary values — Tailwind v4 resolves arbitrary values at class-authoring time from static strings, so a JS-config value must go through inline style or a CSS custom property; inline style keeps the single source in config.ts per CLAUDE.md). **Migrate ALL 24 current `z-*` usages** — the grep found more than CONTEXT.md listed: also `AlbumDetail z-30`, `CometTrail z-30`, `ArchiveBrowser z-30/z-40`, `SearchSheet z-30`, `RecapView z-40`, `SetlistView z-30`, `ShowView z-10`. These are outside the A11Y-01 migration but IN the D-04 "migrate all" scope. Map each to a tier so no `z-NN` literal remains.

### Pattern 5: FAB lift above the sheet (A11Y-02 / D-03)
```typescript
// ExploreFilterFab — add a `lifted` prop driven by ExploreView's `focusId != null`.
// Lift distance = the sheet's PEEK height minus the FAB's resting bottom offset + a gap.
// CRITICAL: compute peek from a SHARED visible-viewport height, not window.innerHeight.
const liftPx = lifted ? Math.max(0, peekHeightPx - RESTING_BOTTOM_PX + config.ui.FAB_SHEET_GAP_PX) : 0;
// style:
transform: `translateY(${-liftPx}px)`,
transition: reducedMotion ? "none" : `transform ${config.explore.FOCUS_CAMERA_DURATION_MS}ms`,
zIndex: lifted ? config.ui.z.focusedFab : config.ui.z.fab,
```
Add config: `ui.FAB_SHEET_GAP_PX` (gap between the lifted FAB and the sheet's top edge, ~12). Honor `prefers-reduced-motion` → no transition (instant), matching the codebase's `motion-safe:` idiom and the camera effect at `ConstellationCanvas.tsx:323-326`.

### Anti-Patterns to Avoid
- **`aria-modal="true"` as the trap.** It is a hint to AT, not a focus trap. All 6 modals set it today and none trap — this is exactly the A11Y-01 gap. Fix with `inert` + Tab-wrap, keep `aria-modal`.
- **Per-dialog `document` Escape listeners.** They double-fire across the app's stacked dialogs. Use the shared LIFO stack.
- **Computing the FAB lift / sheet peek from `window.innerHeight`.** On iOS Safari that is the LARGE viewport (toolbars hidden), while the constellation container is sized to the real visible viewport (see `AppShell.tsx:28-36` — the app deliberately avoids `100vh`). NodeSheet currently uses `window.innerHeight` (`NodeSheet.tsx:82`) — a latent mismatch. Share one visible-viewport source.
- **Auto-abstracting NodeSheet into the primitive.** Its dynamic-height drag/peek shell is genuinely different; forcing it through `<Sheet>` leaks props. Keep it bespoke, share only the hooks.
- **Trusting the orb-fit heuristic's `ellipsized` flag as "verified fit."** It is optimistic (see drift sources below). Verify with real measurement.

## Orb-Label Legibility (POLISH-01 / D-05)

### Real-catalog simulation (grounded in `data/normalized/transition-matrix.json`, 264 nodes)
The bundled matrix that `ExploreView`/`ShowView` render has **264 song nodes** (`nodeCount: 264`). Name-length distribution: 13 names ≤4 chars, 79 at 5-9, 95 at 10-14, 48 at 15-19, 17 at 20-24, 7 at 25-29, 3 at 30-34, 1 at 35-39, 1 at 40-44. **26 names exceed 20 chars; 10 exceed 25.** Longest single word: `Polygondwanaland` (16). Longest name: `(You Gotta) Fight for Your Right (To Party!)` (44).

Running the **exact current `fitOrbLabel` algorithm** (base 13 / min 11 / 3 lines, `CHAR_WIDTH_FACTOR 0.52`, `USABLE_WIDTH_FACTOR 1`) over all 264 names:

| Orb diameter | Names that ellipsize (heuristic self-report) |
|--------------|----------------------------------------------|
| 56px (`ORB_MIN_DIAMETER`) | **16** (e.g. `Deserted Dunes Welcome Weary Feet` 33, `Han-Tyumi, The Confused Cyborg` 30, `I'm Not a Man…` 35, the 44-char outlier) |
| 64px | 4 |
| 70px | 2 (`Deserted Dunes…` 33, the 44-char outlier) |
| 84px | 1 (only the 44-char outlier) |
| 112px (`ORB_MAX_DIAMETER`) | 0 |
| Center 92px (`ORB_CENTER_DIAMETER 116` − 24 padding, base 18 / min 12 / 3 lines) | 1 (the 44-char outlier) |

Retune candidates over the same 264 names:

| Config | @56px | @64px | @70px |
|--------|-------|-------|-------|
| current (13/11/3ln) | 16 | 4 | 2 |
| min10 / 3ln | 9 | 2 | 1 |
| **min10 / 4ln** | **1** (only 44-char) | **0** | **0** |
| min9 / 4ln | 0 | 0 | 0 |
| min10 / 5ln | 1 | 0 | 0 |

**Recommendation:** bump `ORB_LABEL_MAX_LINES` **3→4** and `ORB_LABEL_MIN_FONT_PX` **11→10** (document **10px as the 600-weight system-font legibility floor** on a colored orb; below 10px is not legible in the dark at a show). This clears every real name at any orb ≥64px and leaves only the 44-char outlier at the theoretical 56px floor — verify that outlier's *actual rendered diameter* on-device (orbs grow toward `ORB_MAX_DIAMETER 112` via the ring solver, so the real diameter on a 375px phone is likely 70-95px, not 56). Only drop to `min 9` or add a 5th line if the outlier genuinely ellipsizes at its real size. Apply the analogous bump to the `_CENTER` variant (it already fits against `diameter − 24`).

### The heuristic drifts OPTIMISTIC vs. real rendering — three sources
1. **Bold advance > 0.52.** `CHAR_WIDTH_FACTOR = 0.52` approximates the *average* advance of the 600-weight system font. Real 600-weight glyph advance for mixed-case English trends **~0.55-0.58×** the font px. A too-low factor **over-estimates** chars-per-line → the heuristic thinks text fits when it overflows. Recommend measuring the true factor with `Canvas measureText` on a representative string and likely **raising** it — then compensating with the extra line / lower floor (raising the factor alone increases ellipsization, so it must be paired).
2. **Circular chord narrowing.** An orb is a circle. `USABLE_WIDTH_FACTOR = 1` treats every line's usable width as the full diameter, but only the vertical-center line gets the full chord; lines above/below sit where the circle is narrower. Multi-line labels (now up to 4) push lines further from center → top/bottom lines can overflow the arc even when each is ≤ diameter chars. Consider `USABLE_WIDTH_FACTOR ≈ 0.85` OR rely on the components' existing padding (`CenterNode` p-3 = 12px; `PredictionOrb` px-1 = 4px each side — thin). This geometry gap is the **most likely real-vs-heuristic divergence** and the reason D-05 mandates real-orb verification.
3. **Diacritics / punctuation.** Names like `Paper Mâché Dream Balloon`, `Float Along – Fill Your Lungs` (en-dash), `I Gotta Rock 'n' Roll` — the character *count* the heuristic uses treats every char as one advance, but `–`, `'`, `!`, `(` have very different advances. Minor, but measurement catches it.

### Verification harness (turn into a task) — measures REAL rendering, not the heuristic
The pure heuristic cannot be trusted for the "fully legible on real hardware" bar, and jsdom `Canvas.measureText` returns stubs (0). Two viable harnesses:
- **(A) Throwaway dev route/component (recommended for on-device, D-05).** A dev-only view (e.g. gated `#/dev/orb-fit` or a temporary mounted component) that renders **all 264 real names** as `PredictionOrb`s at the *smallest real rendered diameter* and at `CenterNode` size, then programmatically flags overflow via `el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight` and lists offenders. Load it on the owner's actual phone (the device-UAT cloudflared tunnel already in MEMORY.md). This is the literal "verify against actual rendered orbs" D-05 asks for. Delete after tuning.
- **(B) Automated heuristic-level guard (Wave 0 unit test).** The vitest app project already aliases `@matrix` to the real artifact (`vitest.config.ts`). A test can import it and assert `fitOrbLabel(name, MIN_DIAMETER, ORB_OPTS).ellipsized === false` for every one of the 264 `songName`s (orb + center variants). This *locks in* the retune and prevents regression, but only validates the heuristic's self-report — pair it with (A) for real rendering. Optionally calibrate the assertion diameter to the real minimum measured in (A).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Suppress background from AT + pointer while a modal is open | A JS "disable everything behind" system | `inert` on the app-content root (React 19 native boolean prop) | One attribute correctly removes the subtree from tab order, pointer, AND the AT accessibility tree — cross-browser baseline. A JS reimplementation misses the virtual cursor. |
| Real text width | Manual glyph-width tables | `Canvas measureText` (verification) + the existing pure heuristic (render-time) | measureText is the browser's own layout engine; a hand table drifts per-platform. |
| Keyboard-aware viewport height | `window.innerHeight` math | `window.visualViewport` (+ ResizeObserver on the container, already used) | innerHeight ignores the iOS keyboard/toolbar; visualViewport tracks the real visible box. |
| Full-height overlay sizing | `100vh` + JS correction | CSS `100dvh` | `dvh` is the dynamic viewport unit, baseline-supported; avoids the documented iOS `100vh` overshoot (`AppShell.tsx:28-36`). |
| Focus restore | Manually tracking "who opened me" | `document.activeElement` captured on open | The platform already knows the active element; capture it, restore on unmount. |

**Key insight:** every capability this phase needs is a baseline browser primitive. The only thing worth writing is the ~120 lines of glue that wire them to React's lifecycle. Adding `focus-trap-react` trades that glue for a dependency + a portal idiom that fights the app's inline sheets — a net loss at this scale.

## Runtime State Inventory

> This is a code-only UI refactor. Included for completeness because it touches many files (D-04 migrates all `z-*`), but there is no persisted/registered runtime state at stake.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB keys, collection names, or IDs reference sheet/z/orb config. `orbLabelFit` constants are read at render, not persisted. | None — verified by grep over `db/` and config usage. |
| Live service config | None — no external service (kglw, no backend) references any UI constant. | None. |
| OS-registered state | None — no Task Scheduler / launchd / pm2 state. | None. |
| Secrets / env vars | None. | None. |
| Build artifacts | The `@matrix` alias bundles `data/normalized/transition-matrix.json` — **read-only** here (POLISH-01 verifies against it; D-05 explicitly does NOT change the artifact). No rebuild needed. | None — artifact is input, not output, of this phase. |

**The canonical question — after every file is updated, what runtime systems still hold old state?** Answer: **none.** This phase changes render-time React/CSS/config only; there is no cache, registration, or datastore that outlives a page reload holding sheet/z/orb state.

## Common Pitfalls

### Pitfall 1: `aria-modal` mistaken for a focus trap
**What goes wrong:** Shipping `aria-modal="true"` and believing focus is trapped. All 6 modals do this today; keyboard/AT users tab straight out behind the sheet.
**Why:** `aria-modal` only *tells* AT the region is modal; it does not alter tab order or pointer.
**How to avoid:** `inert` on the background + a Tab-wrap guard. Keep `aria-modal` (it correctly informs AT alongside `inert`).
**Warning signs:** Tabbing past the last control moves focus to the page URL bar / content behind the sheet.

### Pitfall 2: Escape closes the whole dialog stack
**What goes wrong:** One Escape dismisses two stacked dialogs (e.g. SearchSheet opened from TrailNodeSheet, or the "Whose dex" prompt + CompareView).
**Why:** Each dialog attaches its own `document` keydown listener; all fire.
**How to avoid:** Shared LIFO `dialogStack`; only the topmost handler runs, with `stopPropagation`.
**Warning signs:** Backing out of a nested sheet skips a level.

### Pitfall 3: FAB lift / sheet peek measured against the wrong viewport
**What goes wrong:** The lifted FilterFab rests at the wrong height (over- or under-shoots the sheet edge), or the sheet peek doesn't match the camera framing, on iOS Safari with toolbars visible.
**Why:** `window.innerHeight` (large viewport) ≠ the constellation container's visible height (`AppShell` grounds `h-full` to `#root { height:100% }`). NodeSheet already computes peek from `window.innerHeight` (`NodeSheet.tsx:82`).
**How to avoid:** One shared visible-viewport height (visualViewport or the container's ResizeObserver `size.height`) feeding NodeSheet peek, the FAB lift, and the camera offset.
**Warning signs:** FAB floats over the sheet body, or a gap appears, only on a phone with the address bar showing.

### Pitfall 4: `inert` on stacked modals clears too early
**What goes wrong:** Closing the top modal un-inerts the background while a second modal is still open.
**Why:** A boolean toggle, not a counter.
**How to avoid:** Ref-count `setRootInert` (increment on open, decrement on close; inert while count > 0).
**Warning signs:** Background becomes interactive behind a still-open second modal.

### Pitfall 5: Orb-fit "verified" from the heuristic, then overflows on-device
**What goes wrong:** The retune passes the unit test (heuristic reports no ellipsis) but real bold text spills the orb.
**Why:** The three optimistic drift sources (bold advance, circular chord, `USABLE_WIDTH_FACTOR=1`).
**How to avoid:** The (A) dev-harness real-render check on the owner's phone before locking constants; make the heuristic conservative (raise `CHAR_WIDTH_FACTOR`, consider `USABLE_WIDTH_FACTOR<1`) then compensate with lines/floor.
**Warning signs:** Names like `Deserted Dunes Welcome Weary Feet` or the 44-char outlier touch/exceed the orb edge on a real 375px screen.

### Pitfall 6: prefers-reduced-motion not honored on the new FAB lift
**What goes wrong:** The FAB animates for users who requested no motion.
**Why:** Adding a `transition` without gating it.
**How to avoid:** `transition: reduced ? "none" : ...` (matches `ConstellationCanvas.tsx:323` and the `motion-safe:` classes used app-wide). The reduced-motion check pattern already exists in `NodeSheet.tsx:62-67`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `inert` via ref + `setAttribute` workaround | Native `inert` boolean prop (`<div inert={open}>`) | React 19 (2024-12) `[VERIFIED: facebook/react#24730]` | The app is on React 19.2.7 — use the prop directly, no ref hack. |
| `100vh` full-height overlays | `100dvh` dynamic viewport unit | Baseline ~2023 | Avoids the iOS large-viewport overshoot the app already fights in `AppShell`. |
| `focus-trap` libraries as default | Native `<dialog>` OR `inert` + minimal JS | 2023+ | For a modal/non-modal split (D-02), the manual `inert` approach beats both a library and `<dialog>`. |

**Deprecated/outdated:**
- Treating `aria-modal` as sufficient for focus management — never was; the app's current sheets demonstrate the gap.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Real rendered orb diameters on a small phone land ~70-95px (ring solver grows toward `ORB_MAX_DIAMETER 112`), so `4 lines / min 10px` clears all real names. | Orb-Label Legibility | If orbs render nearer 56px, the 44-char outlier still ellipsizes → need min 9 or a 5th line. **Retire via the on-device harness (A).** |
| A2 | `CHAR_WIDTH_FACTOR 0.52` under-estimates true 600-weight advance (real ~0.55-0.58). | Orb drift sources | If 0.52 is actually accurate on the target device, no factor change needed — measurement decides. |
| A3 | Circular chord narrowing (`USABLE_WIDTH_FACTOR=1`) causes real multi-line overflow the heuristic misses. | Orb drift sources | If component padding already absorbs it, no `USABLE_WIDTH_FACTOR` change needed. Verify on-device. |
| A4 | The recommended z-tier numbers (10/20/30/35/40/50/60) preserve every existing visual stacking relationship. | z-index scale | A miswired tier could put a toast over a modal or a FAB under content. **Enumerate all 24 usages and map explicitly during planning.** |
| A5 | jsdom + `@testing-library/react` (installed) cannot assert real Tab-wrap focus movement; needs `user-event`. | Validation Architecture | If a `fireEvent`-based assertion suffices for the team's bar, the optional dep is unneeded. |
| A6 | WhyDetail is in-scope for the migration (D-02 says "confirm"). | Migration map | Out of scope if the planner/owner excludes it — trivial to add later, same idiom. |

## Open Questions (RESOLVED)

> All three questions were resolved at planning (2026-07-18) per the recommendations below and are implemented across plans 08-01…08-06:
> - **Q1 — RESOLVED:** WhyDetail is IN scope for the `<Sheet>` migration (plan 08-02).
> - **Q2 — RESOLVED:** All 24 raw `z-*` literals migrate to `config.ui.z` tiers (plans 08-02…08-05); `<Sheet>` adoption is scoped to the audited 7 sheets only.
> - **Q3 — RESOLVED:** NodeSheet peek, FilterFab lift, and camera reframe share one source — `window.visualViewport?.height ?? window.innerHeight` (plan 08-04).

1. **Is WhyDetail one of the audited dialogs (A11Y-01)?**
   - What we know: it uses the identical hand-rolled `role="dialog"` + `bg-black/50` + `z-20` idiom (`WhyDetail.tsx:37`) and opens from a PredictionOrb long-press.
   - What's unclear: the requirement text lists 7 sheets and does not name WhyDetail; D-02's note calls it "a strong candidate — confirm."
   - Recommendation: include it — it is the cheapest possible win (drop-in `<Sheet modal>`), and leaving it non-accessible is an obvious inconsistency. Flag for owner confirm at planning.

2. **Does the D-04 "migrate ALL z-* usages" reach the non-audited fullscreen views (RecapView, SearchSheet, ArchiveBrowser, SetlistView, AlbumDetail, CometTrail, ShowView)?**
   - What we know: the grep found 24 `z-*` usages across the app; CONTEXT.md listed only ~8. D-04 says "migrate ALL current z-* usages so the fix doesn't just relocate the collision."
   - What's unclear: whether "all" includes these fullscreen overlays or only the sheet/FAB set.
   - Recommendation: migrate all 24 to tiers (the point of a scale is no stray literal); adopt `<Sheet>` only for the audited 7. Confirm scope with the planner.

3. **Which single visible-viewport source should NodeSheet, the FAB lift, and the camera share?**
   - What we know: NodeSheet uses `window.innerHeight` (:82); the canvas uses a container ResizeObserver (:192); AppShell avoids `100vh`.
   - Recommendation: standardize on `window.visualViewport?.height ?? window.innerHeight`, or lift the container height into ExploreView and pass it down. Decide during planning; it directly affects A11Y-02 and A11Y-03 correctness.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| React 19 (`inert` prop) | A11Y-01 | ✓ | 19.2.7 | — |
| iOS Safari VoiceOver | A11Y-01 on-device verify | owner device (MEMORY: cloudflared UAT tunnel) | — | Android TalkBack |
| Android Chrome TalkBack | A11Y-01 on-device verify | if a device is available (VALID-02 pattern) | — | Manual keyboard check on desktop |
| Vitest 4 + @testing-library/react + jsdom | Automated a11y + orb tests | ✓ | vitest 4, TL/react installed | — |
| `@testing-library/user-event` | Real Tab-wrap tests (optional) | ✗ | — | `fireEvent.keyDown` assertions (handler-level, not focus-movement) |
| Canvas `measureText` (real fonts) | Orb-fit real verification | ✓ in-browser only | — | jsdom returns stubs → use the dev harness on-device |
| cloudflared HTTPS tunnel | On-device orb + a11y checks | ✓ (MEMORY: device-uat-hosting) | — | — |

**Missing dependencies with no fallback:** none block execution — every gap has a documented fallback.
**Missing dependencies with fallback:** `@testing-library/user-event` (optional; `fireEvent` covers handler-level assertions).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + @testing-library/react + jsdom (app project), node env (core project) |
| Config file | `vitest.config.ts` (root, `test.projects`) — app project root `packages/app`, `@matrix`/`@archive`/`@dexAlbums` aliased to the real artifacts |
| Setup | `packages/app/test/setup.ts` (jest-dom + fake-indexeddb; **no matchMedia stub yet — Wave 0 gap**) |
| Quick run command | `pnpm vitest run packages/app/test/<file>.test.tsx` |
| Full suite command | `pnpm vitest run` (or `vitest run` from root) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| A11Y-01 | Escape dismisses the topmost dialog (calls `onClose`) | unit (jsdom) | `vitest run packages/app/test/sheet.a11y.test.tsx` | ❌ Wave 0 |
| A11Y-01 | Focus restores to the trigger on close | unit (jsdom) | render trigger → open → close → assert `document.activeElement === trigger` | ❌ Wave 0 |
| A11Y-01 | Initial focus lands inside the dialog on open | unit (jsdom) | assert `container.contains(document.activeElement)` | ❌ Wave 0 |
| A11Y-01 | Background gets `inert` while a modal is open (non-modal NodeSheet does NOT) | unit (jsdom) | assert app-root `inert` attribute toggles; NodeSheet leaves it unset | ❌ Wave 0 |
| A11Y-01 | Tab wraps within the dialog | unit — needs `user-event` | `userEvent.tab()` × N, assert focus stays inside | ❌ Wave 0 (+ optional dep) |
| POLISH-01 | No real catalog name ellipsizes at the tuned min diameter (orb + center) | unit (jsdom, imports real `@matrix`) | `vitest run packages/app/test/orbLabelFit.catalog.test.ts` | ❌ Wave 0 (extend existing `orbLabelFit.test.ts`) |
| POLISH-01 | Real rendered orbs show no overflow | manual on-device | dev harness (A) on cloudflared tunnel | ❌ manual — justify (jsdom measureText is a stub) |
| A11Y-02 | FilterFab is not occluded while a node is focused (lift applied, z > sheet) | unit (jsdom) | render focused → assert FAB transform + `zIndex === z.focusedFab` | ❌ Wave 0 |
| A11Y-03 | Camera reframes on container resize with a node focused | unit (jsdom) + manual | assert `fg.zoom`/`centerAt` re-fire when `size.height` changes; on-device orientation/keyboard check | partial — effect exists (`ConstellationCanvas.tsx:315`), no test |
| POLISH-02 | FabMenu speed-dial + once-per-version InstallBanner behave per todos | unit (existing) | `vitest run packages/app/test/fabMenu.test.tsx packages/app/test/installBannerVersion.test.tsx` | ✅ exists |

### Sampling Rate
- **Per task commit:** `pnpm vitest run packages/app/test/<touched>.test.tsx` (< 30s)
- **Per wave merge:** `pnpm vitest run` (full suite)
- **Phase gate:** full suite green + the on-device harness (A) run on the owner's phone before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/app/test/setup.ts` — add a `window.matchMedia` stub (jsdom lacks it; NodeSheet/FAB reduced-motion checks + the camera effect read it). Several existing tests already work around this per-file; centralize it.
- [ ] `packages/app/test/sheet.a11y.test.tsx` — Escape / restore / initial-focus / inert-toggle for `<Sheet>` (covers A11Y-01 across all 6 modals via the primitive).
- [ ] `packages/app/test/orbLabelFit.catalog.test.ts` — assert zero ellipsization over all 264 real `@matrix` names (orb + center), covers POLISH-01 at the heuristic level.
- [ ] (Optional) `@testing-library/user-event@14.6.1` — only if real Tab-wrap movement assertions are wanted; gate the install behind `checkpoint:human-verify`.
- [ ] Dev-only orb-fit harness component/route (A) — throwaway, for the on-device POLISH-01 check; remove after tuning.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`. This is a UI-only phase with essentially no new attack surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (project constraint). |
| V3 Session Management | no | No sessions/backend. |
| V4 Access Control | no | Local-only PWA. |
| V5 Input Validation / Output Encoding | yes (existing, unchanged) | The "Whose dex is this?" prompt (`SettingsView.tsx:291`) takes owner text — already `maxLength`-clamped (40) and rendered as escaped React text. Song names in orbs/sheets render as React text / canvas `fillText` only (T-07-02, T-04-05) — never `dangerouslySetInnerHTML`. **Adding `autoFocus`/`initialFocusRef` to this input changes focus, not validation** — no new surface. |
| V6 Cryptography | no | None involved. |
| V7 Error Handling | yes (preserve) | The migration must not turn a guarded error state (e.g. `ExploreView` matrix-load failure, `ShareCardSheet` build failure) into a throw. `<Sheet>` must render children as-is; keep existing `if (!open) return null` guards. |
| V14 Configuration | minor | New `config.ui.z` + orb constants are static build-time config — no secrets, no runtime config injection. |

### Known Threat Patterns for {React PWA, UI layer}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via kglw-derived song names in new sheet chrome | Tampering / Elevation | Render as React text / canvas `fillText` only — the invariant already enforced across the app; the `<Sheet>` primitive passes `children` through untouched, injects no HTML. |
| Focus-trap DoS (keyboard user cannot escape a modal) | Denial of Service (a11y) | Escape-to-dismiss (A11Y-01 itself) + focus-restore guarantee the user is never stuck; the LIFO stack ensures Escape always resolves the top dialog. |
| `inert` left applied after unmount (background permanently dead) | Denial of Service | Ref-counted `setRootInert` with cleanup in the hook's `useEffect` return — inert clears when the count hits zero. |

No high-severity findings; nothing blocks on `security_block_on: high`.

## Sources

### Primary (HIGH confidence)
- The 14 referenced source files under `packages/app/src` (read in full) + `AppShell.tsx`, `FabMenu.tsx`, `InstallBanner.tsx` — the ground truth for every current-state claim, line numbers, and the migration map.
- `data/normalized/transition-matrix.json` — the real bundled artifact; 264 nodes, name-length distribution, and the exact `fitOrbLabel` simulation results (run against the real data this session).
- `packages/app/src/show/orbLabelFit.ts` — the exact algorithm reproduced for the simulation.
- `vitest.config.ts`, `packages/app/test/` listing, `packages/app/test/setup.ts` — validation architecture ground truth.
- React 19 native `inert` boolean prop — [facebook/react#24730](https://github.com/facebook/react/pull/24730), corroborated by the WordPress React 19 upgrade note. `[VERIFIED]`
- `.planning/config.json` — nyquist_validation + security_enforcement flags.

### Secondary (MEDIUM confidence)
- [React v19 blog](https://react.dev/blog/2024/12/05/react-19) — React 19 feature set (does NOT list inert; the boolean-inert change is in the upgrade/changelog, not the headline blog).
- [MDN HTMLElement.inert](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert) — `inert` semantics (removes subtree from tab order, pointer, and AT tree). `[CITED]`
- [muffinman.io: HTML inert property and React fallback](https://muffinman.io/blog/html-inert-property/), [Hidde's blog: inert in React](https://hidde.blog/links/inert-in-react/) — inert-as-reversed-focus-trap pattern.

### Tertiary (LOW confidence — flagged)
- `focus-trap-react@12.0.3` / `focus-trap@8.2.2` versions via `npm view` (existence + maintenance confirmed) — but package identity `[ASSUMED]` per provenance rule; alternative-considered only, not recommended.
- `@testing-library/user-event@14.6.1` via `npm view` — optional dev dep, `[ASSUMED]`.
- CHAR_WIDTH_FACTOR true value (~0.55-0.58) — training knowledge; **must be measured on-device**, flagged A2.

## Metadata

**Confidence breakdown:**
- Current-state / migration map: HIGH — every claim read from the actual source with line numbers.
- Orb-fit simulation: HIGH for the heuristic self-report (run against real data); MEDIUM for real-render behavior (needs the on-device harness — that is exactly why D-05 mandates it).
- Focus/inert architecture: HIGH — React 19 inert verified; the hook design is standard, dependency-free, and grounded in the app's real stacked-dialog reality.
- z-tier numbers: MEDIUM — the *invariants* are HIGH (FAB < sheet < focusedFab), the specific integers are [ASSUMED] pending an explicit 24-usage map.

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 (stable domain — browser primitives + a pinned React 19; re-verify only if React or the matrix artifact changes)
