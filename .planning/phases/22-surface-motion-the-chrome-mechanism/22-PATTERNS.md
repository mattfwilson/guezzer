# Phase 22: Surface Motion & the Chrome Mechanism - Pattern Map

**Mapped:** 2026-08-05
**Files analyzed:** 28 (5 new source, 12 modified source, 6 new tests, 5 amended tests)
**Analogs found:** 26 / 28

> **Read this AFTER `22-RESEARCH.md`, not instead of it.** The research owns the *mechanism*
> (why `AnimatePresence` must live inside the portal, which 9 of 19 `<Sheet>` sites are
> unmount-driven, jsdom's missing APIs). This document owns the *analog map*: for each file the
> phase creates or edits, which shipped file it should be modelled on and the exact idiom to copy.
> Nothing here re-derives a research finding.
>
> **Settled scope input (do not re-litigate):** only the sheets in D-21's device sample get
> converted from unmount-driven to prop-driven; the rest stay a documented seam.
> `SettingsView`'s name prompt — not `PinSheet` — is the `initialFocusRef` exemplar.

---

## The four idioms this phase copies over and over

Every new file in this phase is one of four shipped shapes. Learn these four and the per-file
table below is mostly bookkeeping.

| # | Idiom | Canonical shipped file | Used by |
|---|-------|------------------------|---------|
| **I-1** | **`useSyncExternalStore` module registry** — module-level `Map`/scalar + `Set<listener>` + **cached** `snapshot` recomputed only in `notify()` + `getServerSnapshot` + `__reset…ForTests()` | `packages/app/src/pwa/bottomOverlayInset.ts` | `chromeVisibility.ts`, `installStore.ts`, `bottomOverlayInset.ts` (CR-01 extension) |
| **I-2** | **`AnimatePresence` + `motion.div` + `useReducedMotion()`**, reduced path = opacity-only, `zIndex` from `config.ui.z.*` as an inline style | `packages/app/src/components/WaveToast.tsx:157-192` | `Sheet.tsx`, `AppShell.tsx` chrome |
| **I-3** | **Neutral 44px control** — `min-h-11 min-w-11 … rounded-full border border-hairline bg-elevated text-text-primary touch-manipulation focus-visible:outline-2 focus-visible:outline-accent`, `aria-label` from `config.copy`, glyph `aria-hidden` | `packages/app/src/explore/ExploreFilterFab.tsx:127-143` | `ChromeToggle.tsx`, `InstallSection` button, `AppMenu` row |
| **I-4** | **Composed CSS custom property, never JS arithmetic** — surfaces read `var(--gz-*)`; the arithmetic lives only in `layout/bottomSpace.ts`; numbers only in `config.ui.bottomSpace` | `packages/app/src/layout/bottomSpace.ts:71-100` | `bottomSpace.ts`, `AppShell.tsx`, `BottomTabBar.tsx`, all overlays |

---

## File Classification

### New source files

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `src/layout/chromeVisibility.ts` | store (module registry) | event-driven / pub-sub | `src/pwa/bottomOverlayInset.ts` | **exact** (I-1) |
| `src/explore/ChromeToggle.tsx` | component (control) | request-response (tap) | `src/explore/ExploreFilterFab.tsx` | **exact** (I-3; same surface, same tier family) |
| `src/pwa/install/installStore.ts` | store (module registry) | event-driven (one-shot DOM event) | `src/pwa/bottomOverlayInset.ts` | **exact** (I-1) |
| `src/settings/InstallSection.tsx` | component (section) | render-only, store-subscribed | `src/settings/SettingsView.tsx:185-320` (the Export/Import section) + `src/components/AppMenu.tsx:55-84` (the 3-way platform branch) | **role-match** (two analogs: styling from one, branching from the other) |
| `src/settings/installSectionFocus.ts` | utility (one-shot flag) | event-driven | `src/components/WaveToast.tsx:58-77` (module-level single listener + subscribe/emit) | **partial** — smaller than any shipped module; nearest shape is the WaveToast emitter minus the listener |

### Modified source files

| File | Role | Data flow | Analog for the *change* | Match |
|---|---|---|---|---|
| `src/components/Sheet.tsx` | component (primitive) | request-response | `src/components/WaveToast.tsx:157-192` (I-2) | **role-match** — the motion idiom is exact; the portal restructure has no shipped precedent |
| `src/components/a11y/useFocusTrap.ts` | hook (a11y lifecycle) | event-driven | itself (retime, do not re-derive); `useDialogDismiss.ts` for the add/remove-on-dep-change shape | **self** |
| `src/components/AppShell.tsx` | layout shell | render | `WaveToast` (I-2) for the slide; `AppShell` itself for the `var()` reservation | **role-match** |
| `src/components/BottomTabBar.tsx` | component (chrome) | render | `bottomSpace.ts` ladder (I-4) — must switch to the new never-collapsing `--gz-tab-bar-box` | **exact** (I-4) |
| `src/layout/bottomSpace.ts` | config/composition owner | transform (pure) | itself — add the new entry to `BOTTOM_SPACE_VAR_NAMES` + the returned tuple array | **self** |
| `src/config.ts` | config | — | `config.ui.bottomSpace` block (`config.ts:315-360`) — heavily-commented named group | **exact** |
| `src/components/WaveToast.tsx` | component (toast) | event-driven | itself — one-line move of `0.2` → `config.ui.motion.TOAST_DURATION_MS / 1000` | **self** |
| `src/components/AppMenu.tsx` | component (sheet) | request-response | its own neutral Settings row, `AppMenu.tsx:65-72` — copy that row *byte-for-byte* for the new install row | **exact** |
| `src/components/IosInstallInstructions.tsx` | component | render | — (deletion of its `<h2>` only) | n/a |
| `src/settings/SettingsView.tsx` | view | CRUD + render | its own `<section>` blocks, `SettingsView.tsx:163-183` and `:275-319` | **exact** |
| `src/pwa/install/useInstallState.ts` | hook | event-driven | `bottomOverlayInset.ts:82-84` (`useSyncExternalStore` wrapper over the module store) | **exact** (I-1) |
| `src/pwa/bottomOverlayInset.ts` | store | pub-sub | itself (add order + per-id offset; keep number snapshots) | **self** |
| `src/dex/SetlistView.tsx` | component (hand-rolled sheet) | CRUD read (Dexie) | `src/explore/ExploreView.tsx` `loadMatrix().ok === false` calm-error path (per CONTEXT §Established Patterns) | **role-match** |
| `src/dex/DexView.tsx` | view | render | — (add `key={openShow.showId}` at `DexView.tsx:186`) | n/a |
| `src/explore/ExploreView.tsx` | view | render | itself, `ExploreView.tsx:180-225` — render `<ChromeToggle />` as the **first** child of the returned fragment | **self** |
| `packages/app/index.html` | config | — | its existing Apple meta block | **exact** |

### Test files

| Test file | Status | Closest analog | Match |
|---|---|---|---|
| `test/sheet.motion.test.tsx` | new | `test/components/WaveToast.test.tsx:14-36` (the motion mock) | **exact** |
| `test/sheet.closeStart.test.tsx` | new | `test/sheet.a11y.test.tsx:100-120` (`rerender` open→closed, assert `inert`/focus) | **exact** |
| `test/explore/chromeToggle.test.tsx` | new | `test/explore/filterFabLift.test.tsx` | **exact** |
| `test/explore/chromeResize.test.tsx` | new | `test/explore/filterFabLift.test.tsx:17-49` (the `react-force-graph-2d` `vi.hoisted` spy mock) | **exact** |
| `test/installStore.test.tsx` | new | `test/bottomOverlayInset.test.tsx:22-59` (Probe + `act()` + `__reset…ForTests`) | **exact** |
| `test/installSection.test.tsx` | new | `test/installBannerVersion.test.tsx:21-49` (`matchMedia` stub, copy-string assertions) | **role-match** |
| `test/bottomSpace.test.ts` | amend | itself — extend the `D-16: the chrome-collapse seam` describe (`:137-156`) | **self** |
| `test/sheet.a11y.test.tsx` | amend | itself — the stacked-modals case (`:166-209`) needs a *closing* stacked sheet | **self** |
| `test/bottomOverlayInset.test.tsx` | amend | itself — the `sums multiple…` case (`:44-51`) gains ordering assertions | **self** |
| `test/setlistView.test.tsx` | amend | itself | **self** |
| `test/layerOrder.test.tsx` | amend | its numeric-guard block (WR-01 / CR-01) — add `peek < chrome < page` and `chrome < fab` | **self** |

---

## Pattern Assignments

### `src/layout/chromeVisibility.ts` (NEW — store, pub-sub)

**Analog:** `packages/app/src/pwa/bottomOverlayInset.ts` — copy its module shape verbatim.

**Store skeleton** (`bottomOverlayInset.ts:33-84`):

```ts
const heights = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot = 0;                      // ← CACHED. Recomputed ONLY in notify().

function notify(): void {
  snapshot = recompute();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function getSnapshot(): number { return snapshot; }
function getServerSnapshot(): number { return 0; }

export function useBottomOverlayInset(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

**Test escape hatch to reproduce** (`bottomOverlayInset.ts:129-134`) — every new store in this
phase needs one, because the tests import the module once per file:

```ts
/** Test-only escape hatch to reset module state between test cases/files. */
export function __resetBottomOverlayInsetForTests(): void {
  heights.clear();
  snapshot = 0;
  listeners.clear();
}
```

**Early-return-on-unchanged discipline to copy** (`bottomOverlayInset.ts:57-59`) — this is what
stops a `notify()` feedback loop:

```ts
if (heights.get(id) === rounded) return;
```

**Snapshot shape rule:** `bottomOverlayInset` returns a **number**, not an object, which is why it
has never tripped React 19's uncached-`getSnapshot` loop. If `chromeVisibility` needs two fields
(`visible`, `toggleMounted`), expose **two scalar hooks** over two cached scalars rather than one
object snapshot — same reason, no new footgun.

---

### `src/explore/ChromeToggle.tsx` (NEW — component, request-response)

**Analog:** `packages/app/src/explore/ExploreFilterFab.tsx` — same view, same layer family, same
"neutral not accent" rationale already written down there.

**Neutral-control class string to copy** (`ExploreFilterFab.tsx:127-143`):

```tsx
<button
  type="button"
  aria-label={config.copy.explore.filterFabAria}
  aria-expanded={open}
  onClick={() => onOpenChange(!open)}
  style={{ width: config.ui.FAB_DIAMETER, height: config.ui.FAB_DIAMETER }}
  className="flex min-h-11 min-w-11 items-center justify-center self-end rounded-full border border-hairline bg-elevated text-text-primary touch-manipulation focus-visible:outline-2 focus-visible:outline-accent"
>
  <SlidersHorizontal size={24} … />
</button>
```

Differences the toggle must make (all already decided): `Maximize2`/`Minimize2` at 24px,
`aria-label` swapping between `config.copy.explore.chromeHide` / `chromeShow`, **no**
`aria-expanded` (D-05 rejected `aria-pressed`; `aria-expanded` is the same class of new idiom —
the label carries the state), size from `config.ui.chrome.CHROME_TOGGLE_SIZE_PX` not
`FAB_DIAMETER`.

**Fixed-offset idiom** (`ExploreFilterFab.tsx:85-86`) — note the *right* inset keeps the shipped
per-surface `env()` form; only the **bottom** inset is guard-restricted:

```ts
const bottomOffset = "calc(var(--gz-chrome-reserve) + 8px)";
const rightOffset  = "calc(env(safe-area-inset-right) + 16px)";
```

The toggle's top offset copies `AppShell.tsx:48` verbatim — this exact string is the app's one
top-inset expression (D-13: introduce no second one):

```tsx
style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
```

**Escape wiring** — `useDialogDismiss` is a two-line hook; just call it (`useDialogDismiss.ts:13-19`):

```ts
export function useDialogDismiss(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    pushDialog(onClose);
    return () => removeDialog(onClose);
  }, [active, onClose]);
}
```
Call it as `useDialogDismiss(!chromeVisible, showChrome)` — active only while hidden, so it never
sits on the LIFO stack competing with a sheet in the normal state.

⚠️ **`ExploreFilterFab.tsx` is the one file allowlisted by the FOUND-02 bare-numeric-mirror guard**
(`test/bottomSpace.test.ts:472-487`, `expect(sites).toEqual(["explore/ExploreFilterFab.tsx"])`).
`ChromeToggle` sits in the same directory — if it copies `RESTING_BOTTOM_PX = 64 + 8` or any bare
`64`, **that test fails**. Put its two numbers in `config.ui.chrome` (44 / 52) as the UI-SPEC says.

---

### `src/pwa/install/installStore.ts` (NEW) + `useInstallState.ts` (MODIFIED)

**Analog:** `bottomOverlayInset.ts` for the store (I-1); the existing `useInstallState.ts` for the
public `InstallState` interface, which must not change shape.

**What is being hoisted** (`useInstallState.ts:41-66`) — the component-local capture that NAV-06
dies on:

```ts
const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
const [canInstall, setCanInstall] = useState(false);

useEffect(() => {
  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredRef.current = event as BeforeInstallPromptEvent;
    setCanInstall(true);
  };
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
}, []);
```

**What stays component-local** (`useInstallState.ts:46, 68`) — `dismissed`/`dismiss`. Only
`InstallBanner` reads them and D-37 says leave the banner alone:

```ts
const [dismissed, setDismissed] = useState(false);
const dismiss = () => setDismissed(true);
```

**The `BeforeInstallPromptEvent` interface moves as-is** (`useInstallState.ts:9-12`) — keep the
"not in lib.dom.d.ts, declared locally rather than pulling a types package" comment with it.

**Two call sites that currently disagree and must converge on the store:**
- `AppMenu.tsx:20` — `const { canInstall, promptInstall, isIos } = useInstallState();`
- `InstallBanner` — its own `useInstallState()` instance (unchanged code, D-37).

---

### `src/settings/InstallSection.tsx` (NEW — component, render)

**Analog A — section styling:** `SettingsView.tsx:275-319` (the rotation-reset block: `<h2>` +
muted `<p>` + neutral bordered button). Copy the button class string exactly:

```tsx
<button
  type="button"
  onClick={handleImport}
  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
>
  <Upload size={18} />
  {copy.importCta}
</button>
<p className="text-base leading-normal text-text-muted">{copy.importDescription}</p>
```
(`SettingsView.tsx:215-225` — the Import block, which the UI-SPEC names as the visual model.
Swap `Upload` → `Smartphone`.)

**Analog B — the three-way platform branch:** `AppMenu.tsx:55-84`. This is the exact logic being
relocated; move it, do not re-invent it:

```tsx
<button onClick={handleInstallClick} className="… bg-accent …">   {/* → becomes NEUTRAL */}
  {config.copy.installCta}
</button>

{isIos && (
  <div className="mt-3 border-t border-hairline pt-3">
    <IosInstallInstructions />
  </div>
)}

{!canInstall && !isIos && (
  <p className="mt-3 text-[14px] leading-normal text-text-muted">
    {config.copy.installUnavailable}
  </p>
)}
```

**Heading + focus target** — copy the `<h2>` treatment at `SettingsView.tsx:276`, add
`tabIndex={-1}` and the ref:

```tsx
<h2 className="text-[20px] font-semibold leading-tight text-text-primary">
  {copy.rotationResetHeading}
</h2>
```

**Placement:** the section is a sibling appended after `SettingsView.tsx:320`'s closing
`</section>` — inside the `gap-6 … pb-16` column opened at `SettingsView.tsx:160`.

---

### `src/components/Sheet.tsx` (MODIFIED — the highest-risk file)

**Analog:** `WaveToast.tsx:157-192` for the motion; `Sheet.tsx` itself for everything else.

**The motion idiom to copy** (`WaveToast.tsx:93-94, 157-176`):

```tsx
const reduce = useReducedMotion() ?? false;
…
<AnimatePresence>
  {shown && (
    <motion.div
      key={shown.id}
      ref={toastRef}
      role="status"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}          // ← D-25: this literal MOVES to config
      style={{ zIndex: config.ui.z.toast, bottom: "var(--gz-chrome-reserve)" }}
    >
```

**What is being replaced** (`Sheet.tsx:63-65`) — and the two properties that must survive the
replacement:

```tsx
// V7 / T-08-04: closed sheet renders nothing, never throws.
if (!open) return null;
if (typeof document === "undefined") return null;
```
The SSR/jsdom guard **stays**; the `!open` guard goes. `SetlistView.tsx:131-134` shows the same
guard copied outward with a comment explaining *why* it sits above the early return — mirror that
comment discipline when moving it.

**The prop bundle that must keep landing on the dialog node** (`Sheet.tsx:67-73`):

```tsx
const dialogProps = {
  ref: contentRef,
  role: "dialog" as const,
  "aria-modal": modal,
  "aria-label": ariaLabel,
  tabIndex: -1,
};
```
Close-start adds `aria-hidden={open ? undefined : true}` and `pointerEvents: open ? undefined : "none"`
to this bundle — one place, both variants.

**The padding var must not be re-derived** (`Sheet.tsx:104-110`) — its comment is the reason and is
pinned by `test/sheet.a11y.test.tsx:241-254`:

```tsx
paddingBottom: "var(--gz-sheet-pad-bottom)",
```

**Stale doc comment to correct** (`Sheet.tsx:12-14` and `:37`) — D-31:

```
 *   sheet (the NodeSheet variant, D-02) still gets Escape + focus-restore but leaves
…
  /** Default true. false = non-modal NodeSheet variant: no trap, no inert, no scrim (D-02). */
```

---

### `src/components/a11y/useFocusTrap.ts` (MODIFIED — hook)

**Analog:** itself. The teardown already fires at close-start (React runs effect cleanup on a dep
change), so the edit is a **re-timing**, not a rewrite.

**The cleanup that already does items 1 and 2 of the close-START table** (`useFocusTrap.ts:74-79`):

```ts
return () => {
  container.removeEventListener("keydown", onKeyDown);
  setRootInert(false);        // ref-counted decrement
  restoreTo.current?.focus?.(); // restore focus to the trigger (D-01)
};
}, [active, ref, initialFocusRef]);
```
`Sheet.tsx:60` passes `active: open && modal` — derived from `open`, never from presence. **That is
the invariant to preserve**, and it is worth a source comment.

**The initial-focus line D-27 splits out** (`useFocusTrap.ts:51-52`):

```ts
// Initial focus: explicit ref → first focusable → the container itself.
(initialFocusRef?.current ?? focusables()[0] ?? container).focus();
```
becomes: focus `focusables()[0] ?? container` on activate; the `initialFocusRef` branch moves into
the returned `focusInitialTarget()` that `Sheet` calls from `onAnimationComplete`.

**The double-release hazard** — `setRootInert` guards underflow only at zero, so add a per-instance
`releasedRef`. The test that must be extended to see it is `sheet.a11y.test.tsx:166-209`
(`"stacked modals: one Escape closes only the topmost; inert needs two clears"`), which currently
only exercises a *fully closed* stacked sheet.

---

### `src/layout/bottomSpace.ts` + `src/components/AppShell.tsx` + `BottomTabBar.tsx` (MODIFIED)

**Analog:** `bottomSpace.ts` itself. Three coupled edits.

**1. The composition array to extend** (`bottomSpace.ts:78-99`) — the new `--gz-tab-bar-box` entry
goes here, and its name must be added to `BOTTOM_SPACE_VAR_NAMES` (`:39-46`) or
`test/bottomSpace.test.ts:83-87` (`"emits exactly the six declared names, in composition order"`)
fails:

```ts
return [
  ["--gz-tab-bar-h", `${TAB_BAR_HEIGHT_REM}rem`],
  ["--gz-overlay-inset", `${overlayInsetPx}px`],
  [
    "--gz-chrome-reserve",
    chromeVisible
      ? "calc(var(--gz-tab-bar-h) + var(--gz-safe-bottom))"
      : "var(--gz-safe-bottom)",
  ],
  …
];
```

**2. The hook that is missing the third argument** (`bottomSpace.ts:130-137`) — `applyBottomSpaceVars`
already takes it; only `useBottomSpaceVars` does not, and `chromeVisible` must join the dep array:

```ts
export function useBottomSpaceVars(): void {
  const overlayInset = useBottomOverlayInset();
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    applyBottomSpaceVars(document.documentElement, overlayInset);
  }, [overlayInset]);
}
```
**Keep it a `useLayoutEffect`.** Its doc comment (`:120-128`) explains why, and the one-resize
contract depends on it.

**3. AppShell's two elements** (`AppShell.tsx:46-49` header, `:94` tab bar) — the header is where
`position: absolute` + `inert` + the `motion` transform land:

```tsx
<header
  className="flex items-center justify-between border-b border-hairline bg-elevated px-4 py-3"
  style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
>
```
`AppShell.tsx:31` (`useBottomSpaceVars();`) is the single call site that gains the argument.

⚠️ **Every new value must be a `var()` string, never a JS number.** `test/bottomSpace.test.ts:337-350`
fails any source file outside `bottomSpace.ts` / `config.ts` / `styles.css` / `dev/` containing
`4rem`, `64px`, `bottom-16`, `h-16`, `bottom-[`, or `env(safe-area-inset-bottom)`. The guard strips
comments first (`:357-365`), so prose explaining the value is fine.

---

### `src/pwa/bottomOverlayInset.ts` (MODIFIED — CR-01 ordering)

**Analog:** itself. The `Map<string, number>` and the `notify()` discipline already exist
(`:33-60`); the additions are `offsetBelow(id)` and a `useBottomOverlayOffset(id)` hook.

**Keep returning a number.** `getSnapshot()` at `:69-71` returns a scalar; a per-id offset hook must
do the same (a fresh object per call is the React 19 infinite-loop footgun).

**The registration call sites to enumerate for the omission-detecting guard** — grep for the
`useBottomOverlayHeightRegistration("<id>", …)` literal; the shipped example is
`WaveToast.tsx:100`:

```tsx
const toastRef = useBottomOverlayHeightRegistration("waveToast", shown != null);
```
Every such literal must appear in `config.ui.bottomOverlayOrder`. **This is the guard shape Phase 21
lacked** — it fails when a new overlay is added and *not* ordered, which a pattern-match cannot do.

---

### `src/dex/SetlistView.tsx` (MODIFIED — CR-02)

**The exact defect** (`SetlistView.tsx:136-148`) — one branch serving two states, with the
mislabelled `aria-label`:

```tsx
// Not in the bundle and the cache row hasn't resolved yet — hold the frame.
if (resolved == null) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.albumBack}      // ← announces "Back"; offers no Back
      className="fixed inset-0 bg-surface"
      style={{ zIndex: config.ui.z.sheet }}
    />,
    document.body,
  );
}
```

**The Dexie read to give a pending sentinel** (`SetlistView.tsx:90`):

```tsx
const cache = useLiveQuery(() => db.archiveShows.get(showId), [showId]);
```

**The error-state markup to model on** — the resolved branch's own header
(`SetlistView.tsx:150-169`) already has a portal root, a `role="dialog"`, a real `aria-label`, the
shipped top-inset expression, and a 44px back control. The missing-state frame should be that
markup minus the list:

```tsx
<div className="flex items-center gap-3 border-b border-hairline bg-elevated px-4 py-3"
     style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
  <button
    type="button"
    aria-label={copy.albumBack}
    onClick={onClose}
    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted touch-manipulation"
  >
    <ChevronLeft size={24} />
```

⚠️ Two shipped tests already stub `useLiveQuery` to `undefined` and assert the *resolved* branch —
`test/setlistView.test.tsx:26` and `test/sheet.a11y.test.tsx:39`, both
`vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => undefined }))`. If the sentinel is the
3-arg `defaultResult` form, **that mock silently returns `undefined` instead of the sentinel** and
both files start rendering the *missing* branch. `sheet.a11y.test.tsx:344-354` asserts
`SetlistView` exposes `aria-modal="true"` and a non-empty name; plan for updating both mocks in the
same commit.

---

### `src/components/AppMenu.tsx` (MODIFIED — D-34)

**Delete this** (`AppMenu.tsx:55-61` — the accent CTA) **and** `:74-84` (inline iOS steps + fallback):

```tsx
<button
  type="button"
  onClick={handleInstallClick}
  className="mt-3 flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-[14px] font-semibold text-surface"
>
  {config.copy.installCta}
</button>
```

**Replace with a byte-for-byte clone of the row directly beneath it** (`AppMenu.tsx:63-72`) — the
UI-SPEC's "identical to the shipped Settings row beside it" is literally this element:

```tsx
<button
  type="button"
  onClick={handleSettingsClick}
  className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary"
>
  <Settings size={20} />
  {config.copy.settings.menuLabel}
</button>
```
Swap `Settings` → `Smartphone`, `copy.settings.menuLabel` → `copy.install.menuRow`, and the handler
to `requestInstallSectionFocus(); navigate("settings"); onClose();` — the navigate+close pair is
already the shipped idiom at `AppMenu.tsx:34-37`.

---

### `src/config.ts` (MODIFIED)

**Analog:** the `ui.bottomSpace` block (`config.ts:315-360`) — a named group with a paragraph
explaining who owns the numbers and where the arithmetic lives. `config.ui.motion` and
`config.ui.chrome` should read the same way.

**The z-tier block to extend** (`config.ts:265-311`) — `chrome: 14` goes between `peek: 12` and
`page: 15`, and the INVARIANT comment above it (`:254-264`) is the model for the two new guard
prose lines. Note the block's existing convention: **every tier carries a comment naming the
surface and the regression it prevents**, and two carry a named guard reference (`WR-01`, `CR-01`)
that `test/layerOrder.test.tsx` pins.

---

## Shared Patterns

### Z-index — inline style, never a class
**Source:** `config.ts:254-264` (rationale), `WaveToast.tsx:175`, `Sheet.tsx:81/96/103`,
`ExploreFilterFab.tsx:113`
**Apply to:** `ChromeToggle`, animated header/tab bar, both `Sheet` variants
```tsx
style={{ zIndex: config.ui.z.fab }}
```
Production has **zero** `z-*` Tailwind utilities (one dev-only exception in `src/dev/`).
`test/layerOrder.test.tsx:35-51` says explicitly that its detector reads inline styles only and
silently loses coverage the moment a `z-*` class appears.

### Reduced motion — per-surface, opacity-only fallback
**Source:** `WaveToast.tsx:94, 164-166`; the alternate `matchMedia` form at
`ExploreFilterFab.tsx:37-42, 100`
**Apply to:** `Sheet` (opacity cross-fade), chrome (instant)
```tsx
const reduce = useReducedMotion() ?? false;
initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
```
Two shipped forms exist. **Use `useReducedMotion()` in anything that already renders `motion.div`**;
the `matchMedia` helper is for surfaces animating via CSS transitions only.

### User-facing strings live in `config.copy`
**Source:** `ExploreFilterFab.tsx:129` (`config.copy.explore.filterFabAria`), `AppMenu.tsx:60, 71`,
`SetlistView.tsx:87` (`const copy = config.copy.dex;`)
**Apply to:** toggle labels, install section, CR-02 states
The `const copy = config.copy.<area>;` alias at the top of a component is the shipped convention.

### Read `var()` values off the `style` **attribute** in tests
**Source:** `test/bottomOverlayInset.test.tsx:72-81`, `test/bottomSpace.test.ts:238-240`,
`test/sheet.a11y.test.tsx:236-240`
**Apply to:** every new layout assertion
```ts
expect(main.getAttribute("style")).toContain("var(--gz-content-reserve)");
```
> jsdom's CSS parser does not reliably round-trip a `var()` value through a typed longhand
> property.

### The `motion` mock for jsdom tests
**Source:** `test/components/WaveToast.test.tsx:14-36` — copy this verbatim into
`sheet.motion.test.tsx` / `sheet.closeStart.test.tsx`:
```tsx
let reduced = false;
vi.mock("motion/react", () => ({
  useReducedMotion: () => reduced,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: new Proxy({}, {
    get: (_target, tag: string) =>
      forwardRef(({ initial, animate, exit, transition, ...rest }: Record<string, unknown>, ref: unknown) =>
        createElement(tag, { ...rest, ref, "data-initial": JSON.stringify(initial) })),
  }),
}));
```
Two consequences the planner must design around: this mock **renders children immediately and never
defers unmount**, so it proves *prop* correctness (`data-initial`, `aria-hidden`,
`pointer-events`) but **not** the deferred-unmount window. The D-20 close-start test needs the
controllable variant `22-RESEARCH.md §Code Examples` specifies, not this one. Also note the mock
strips `transition`, so a config-constant assertion must read `data-*`, not `transition`.

### Store tests: Probe component + `act()` + reset hatch
**Source:** `test/bottomOverlayInset.test.tsx:22-58`
**Apply to:** `installStore.test.tsx`, any `chromeVisibility` test
```tsx
function Probe() {
  const inset = useBottomOverlayInset();
  return <div data-testid="inset">{inset}</div>;
}

afterEach(() => { cleanup(); __resetBottomOverlayInsetForTests(); });

it("reflects a registered overlay's real measured height", () => {
  render(<Probe />);
  act(() => setBottomOverlayHeight("installBanner", 220));
  expect(screen.getByTestId("inset").textContent).toBe("220");
});
```

### `vi.hoisted` spy mock for `react-force-graph-2d`
**Source:** `test/explore/filterFabLift.test.tsx:17-49` — the CHROME-05 one-resize test needs this
exact mock, plus a `d3ReheatSimulation` spy (already stubbed at `:39`) and a `zoomToFit` spy
(currently an anonymous `vi.fn()` at `:38` — promote it to a hoisted named spy so the test can
assert it is **not** re-called).

### Module-level emitter with subscribe/unsubscribe
**Source:** `WaveToast.tsx:58-77` — the nearest shipped shape for `installSectionFocus.ts`:
```ts
let listener: ((payload: WaveToastPayload) => void) | null = null;
export function showWaveToast(payload: WaveToastPayload): void { listener?.(payload); }
export function subscribeWaveToast(fn: …): () => void {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}
```
`installSectionFocus` is simpler (a consumable boolean, no listener) — the transferable part is the
module-level mutable + the named `request`/`consume` export pair.

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `Sheet.tsx`'s **portal → `AnimatePresence` → sibling scrim/card** restructure | component | request-response | No shipped surface portals *and* animates. `WaveToast` animates without a portal; all five hand-rolled sheets portal without animating. Follow `22-RESEARCH.md §Pattern 1` (option **b**, sibling children) — it is the only source, and it is the change that decides whether `dialog.parentElement === document.body` still holds in **two** shipped test files (`sheet.a11y.test.tsx:392`, `layerOrder.test.tsx`). |
| `AppShell` header **`position: absolute` at animation START** | layout | render | Nothing in the app takes an element out of flow ahead of its own exit. The one-commit ordering is a research finding (`§Pattern 4`), not a codebase pattern. |
| `test/explore/chromeResize.test.tsx`'s **"exactly one `ResizeObserver` callback"** assertion | test | — | jsdom has no `ResizeObserver` (`bottomOverlayInset.ts:112-113` documents this and simply skips it). No shipped test counts resize deliveries; the technique comes from `22-RESEARCH.md §Code Examples`. `filterFabLift.test.tsx` supplies only the surrounding graph mock. |

---

## Metadata

**Analog search scope:** `packages/app/src/{components,components/a11y,layout,explore,pwa,pwa/install,settings,dex}`, `packages/app/test/`, `packages/app/test/{components,explore,dex}`
**Files read for excerpts:** 16 source + 7 test
**Pattern extraction date:** 2026-08-05
**Not consulted:** `packages/core/src` — this phase touches no core module (strict core/UI separation; every capability here is browser-tier per `22-RESEARCH.md §Architectural Responsibility Map`).
