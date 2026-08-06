---
phase: 22-surface-motion-the-chrome-mechanism
reviewed: 2026-08-06T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - packages/app/index.html
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/components/BackupToast.tsx
  - packages/app/src/components/BingoCelebration.tsx
  - packages/app/src/components/BottomTabBar.tsx
  - packages/app/src/components/InstallBanner.tsx
  - packages/app/src/components/IosInstallInstructions.tsx
  - packages/app/src/components/Sheet.tsx
  - packages/app/src/components/UpdateToast.tsx
  - packages/app/src/components/WaveToast.tsx
  - packages/app/src/components/a11y/useFocusTrap.ts
  - packages/app/src/config.ts
  - packages/app/src/dex/DexView.tsx
  - packages/app/src/dex/SetlistView.tsx
  - packages/app/src/explore/ChromeToggle.tsx
  - packages/app/src/explore/ExploreView.tsx
  - packages/app/src/layout/bottomSpace.ts
  - packages/app/src/layout/chromeVisibility.ts
  - packages/app/src/pwa/bottomOverlayInset.ts
  - packages/app/src/pwa/install/installStore.ts
  - packages/app/src/pwa/install/useInstallState.ts
  - packages/app/src/settings/InstallSection.tsx
  - packages/app/src/settings/SettingsView.tsx
  - packages/app/src/settings/installSectionFocus.ts
  - packages/app/src/show/TrailNodeSheet.tsx
  - packages/app/src/show/WhyDetail.tsx
  - packages/app/test/bottomOverlayInset.test.tsx
  - packages/app/test/bottomSpace.test.ts
  - packages/app/test/chromeResize.test.tsx
  - packages/app/test/chromeToggle.test.tsx
  - packages/app/test/dexView.test.tsx
  - packages/app/test/installSection.test.tsx
  - packages/app/test/installStore.test.tsx
  - packages/app/test/layerOrder.test.tsx
  - packages/app/test/setlistView.test.tsx
  - packages/app/test/sheet.a11y.test.tsx
  - packages/app/test/sheet.closeStart.test.tsx
  - packages/app/test/sheet.motion.test.tsx
  - packages/app/test/songRow.test.tsx
  - packages/app/test/trailNodeSheet.test.tsx
findings:
  critical: 2
  warning: 9
  info: 3
  total: 14
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-08-06
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

Reviewed the full Phase-22 surfacing change set: the `<Sheet>` motion/close-start
restructure, the shared chrome-visibility mechanism and its toggle, the ordered
bottom-overlay stacking store, the hoisted install singleton, and the relocated
Settings install section.

The areas flagged for extra scrutiny in the phase brief hold up better than
expected. `useFocusTrap`'s layout-destroy + passive-destroy pair is correctly
idempotent (`releasedRef` guards the shared inert count; `restoreFocus`
early-returns on an already-focused or disconnected trigger), and there is no
double-release or leak path I can construct. `chromeVisibility.ts` has both
`getServerSnapshot`s, both snapshots are cached and recomputed only in `notify()`,
and register/unregister are balanced and idempotent. `bottomOverlayInset.ts`'s
lazy offset cache is recomputed before fan-out and is order-independent for
declared ids. The new test files are unusually careful about vacuity — the
anti-vacuity `document.body.contains(node)` assertions, the deliberate
non-mocking of `motion/react` in the exit-window blocks, the `calc(env(...))`
wrapper rationale, and the `files.length > 100` / `ids.length >= 5` extraction
guard are all doing real work. I found no vacuous assertion worth flagging.

What I did find are two defects that ship broken behaviour, plus a cluster of
robustness gaps around the newly-shared module singletons and the newly-added
`aria-modal` surface.

The most serious is the install-section deep-link counter: it is never
acknowledged, so after the first "Add to Home Screen" tap **every** subsequent
mount of `SettingsView` scrolls to and focuses the install heading — exactly the
behaviour the code comment claims is prevented. Second is `promptInstall()`,
which is documented as never-throw but has no `try`/`catch` around a
`prompt()` call that Chromium rejects on a second invocation; both call sites
`void` it, so a double-tap produces an unhandled rejection *and* permanently
wedges `canInstall` at `true` with a dead event.

No security vulnerabilities found: no `dangerouslySetInnerHTML`, no `eval`, no
injection sink, no hardcoded secret, and every new user-visible string in
`InstallSection` / `SetlistView`'s error state is a fixed `config.copy.*`
constant rendered as escaped React text.

## Critical Issues

### CR-01: The install-section focus counter is never acknowledged — every later Settings visit steals focus

**File:** `packages/app/src/settings/SettingsView.tsx:84-94`, `packages/app/src/settings/installSectionFocus.ts:29-53`

**Issue:** `installSectionFocus` is a monotonically-increasing module counter that
is never reset outside tests. `SettingsView` guards only on `=== 0`:

```ts
useEffect(() => {
  if (installFocusRequest === 0) return;
  installHeadingRef.current?.scrollIntoView?.({ block: "start" });
  installHeadingRef.current?.focus();
}, [installFocusRequest]);
```

`SettingsView` is conditionally rendered by `App.tsx:120` (`route === "settings" ? <SettingsView /> : …`),
so leaving `#/settings` **unmounts** it and returning **remounts** it. React always
runs a mount effect regardless of deps, so on that remount `installFocusRequest`
is still `1` (or higher) and the body fires again.

Concrete repro: tap AppMenu → "Add to Home Screen" (correct: jumps to the install
section). Navigate to any tab. Open AppMenu → "Settings". The view mounts scrolled
to the bottom with focus parked on the install `<h2>` — a surface the user did not
ask for. It reproduces on every Settings visit for the rest of the session.

The comment on line 86 states the exact contract this violates: *"0 is 'never
requested' — do not steal focus on a plain visit to Settings."*

`test/installSection.test.tsx:192-220` covers the re-fire case (Pitfall 10) but
never unmounts and remounts, so the regression is untested.

**Fix:** make the request genuinely consumable. A naive `useRef(installFocusRequest)`
seed in `SettingsView` would break the cross-route deep link (the counter is bumped
*before* the view mounts, so the ref would initialise already-handled). Acknowledge
in the store instead:

```ts
// installSectionFocus.ts
let requestCount = 0;
let handledCount = 0;

export function requestInstallSectionFocus(): void {
  requestCount += 1;
  for (const listener of listeners) listener();
}

/** Called by the subscriber once it has performed the focus move. */
export function acknowledgeInstallSectionFocus(): void {
  if (handledCount === requestCount) return;
  handledCount = requestCount;
  for (const listener of listeners) listener();
}

/** 0 = nothing pending. Still a primitive — Pitfall 9 stays unreachable. */
export function getInstallSectionFocusSnapshot(): number {
  return requestCount - handledCount;
}

export function __resetInstallSectionFocusForTests(): void {
  requestCount = 0;
  handledCount = 0;
  listeners.clear();
}
```

```ts
// SettingsView.tsx
useEffect(() => {
  if (installFocusRequest === 0) return;
  installHeadingRef.current?.scrollIntoView?.({ block: "start" });
  installHeadingRef.current?.focus();
  acknowledgeInstallSectionFocus();
}, [installFocusRequest]);
```

Add a case that renders `<SettingsView />`, requests focus, `cleanup()`s, re-renders,
and asserts `document.activeElement` is **not** the heading.

---

### CR-02: `promptInstall()` is documented never-throw but can reject unhandled, permanently wedging `canInstall`

**File:** `packages/app/src/pwa/install/installStore.ts:136-143`; call sites `packages/app/src/components/InstallBanner.tsx:137` and `packages/app/src/settings/InstallSection.tsx:76`

**Issue:** The docstring claims *"Silent no-op when nothing is captured (never-throw
house style — `wakeLock.ts`, `persist.ts`)"*, but the body has no `try`/`catch`:

```ts
export async function promptInstall(): Promise<void> {
  const d = deferred;
  if (!d) return;
  await d.prompt();
  await d.userChoice;
  deferred = null;
  notify();
}
```

Three problems compound:

1. `deferred` is not cleared until **after** `userChoice` resolves — i.e. not until
   the user has dismissed the native Chromium dialog. Neither call site disables
   the button, so a second tap during that window re-enters with the same event.
2. Chromium's `BeforeInstallPromptEvent.prompt()` rejects with a `DOMException`
   ("The prompt() method may only be called once") on that second call.
3. Both call sites are `onClick={() => void promptInstall()}`, so the rejection is
   unhandled — a console error at minimum, and a `window.onunhandledrejection`
   report in any future error surface.

The lasting damage is worse than the log line: because the rejection escapes before
`deferred = null; notify();`, the store keeps `canInstall === true` while holding an
already-consumed event. Every subsequent tap of Install — in the banner **and** in
Settings, since D-33 deliberately shares one event — rejects again and does nothing.
The install affordance is dead for the session, with the button still offering it.

`test/installStore.test.tsx` only ever uses `prompt: vi.fn().mockResolvedValue(undefined)`,
so the rejecting path is untested.

**Fix:** clear the stash before awaiting the outcome, and honour the documented
never-throw contract:

```ts
export async function promptInstall(): Promise<void> {
  const d = deferred;
  if (!d) return;
  // Consume the one-shot event BEFORE awaiting anything: a second tap during the
  // native dialog must be a no-op, not a re-entry that rejects (T-22-23 still
  // holds — `d.prompt()` is the first await, nothing is awaited ahead of it).
  deferred = null;
  try {
    await d.prompt();
    await d.userChoice;
  } catch {
    // Never-throw house style. A rejected prompt only means the invitation did
    // not appear; the affordance is already gone from the snapshot below.
  } finally {
    notify();
  }
}
```

Note `deferred = null` runs synchronously before the first `await`, so the
gesture-bound `d.prompt()` remains the first awaited expression and T-22-23 is
preserved. Add a case whose `prompt` is `vi.fn().mockRejectedValue(new Error("x"))`
and assert `await expect(promptInstall()).resolves.toBeUndefined()` plus
`canInstall === false` afterwards.

## Warnings

### WR-01: `SetlistView`'s new "unresolvable" dialog is `aria-modal="true"` with no focus containment

**File:** `packages/app/src/dex/SetlistView.tsx:183-235`

**Issue:** CR-02's fix promotes the blank blocker into a real interactive surface —
a full-viewport `fixed inset-0 bg-surface` at `config.ui.z.sheet` (50) carrying
`role="dialog" aria-modal="true"`, a 44px Back button and an Escape handler. But
nothing moves focus into it, nothing traps focus inside it, and nothing sets
`inert` on `#app-content` behind it (the file explicitly stays off the `<Sheet>`
primitive, and only `useDialogDismiss` was adopted).

`aria-modal="true"` is a promise to AT that everything outside the dialog is
unavailable. Here it is false: on open, focus stays wherever it was (typically the
`ShowsList` row that triggered the drill-in, now completely occluded), and Tab walks
the user through the header, the tab bar and the whole dex behind an opaque overlay
they cannot see. A screen-reader user can be reading content they cannot interact
with while the announced dialog is off-screen in the virtual cursor.

The same applies to the pending branch (`SetlistView.tsx:197-212`), which is
pre-existing — but CR-02 is what turned the second branch into a control-bearing
dialog, which is where the mismatch starts to matter.

`test/setlistView.test.tsx` asserts the label, the copy, the Back button and Escape,
but makes no assertion about `document.activeElement`.

**Fix:** minimally, move focus to the Back button on mount and reuse the shared
inert helper, so the `aria-modal` claim is true for the duration:

```ts
const backRef = useRef<HTMLButtonElement>(null);
useEffect(() => {
  if (!missing) return;
  setRootInert(true);
  const previous = document.activeElement as HTMLElement | null;
  backRef.current?.focus();
  return () => {
    setRootInert(false);
    if (previous?.isConnected) previous.focus();
  };
}, [missing]);
```

The structural fix is the one the file's own doc defers — migrating the five
hand-rolled sheets onto `<Sheet>`, which already owns all three behaviours. If
that stays deferred, drop `aria-modal="true"` from the two unmigrated branches
rather than asserting a containment the code does not implement.

---

### WR-02: `useDialogDismiss`'s LIFO position depends on `onClose` identity; the two new consumers pass unstable closures

**File:** `packages/app/src/dex/SetlistView.tsx:184`, `packages/app/src/components/Sheet.tsx:157`, `packages/app/src/components/a11y/useDialogDismiss.ts:14-18`

**Issue:** `useDialogDismiss` deps on `[active, onClose]`, and `dialogStack.pushDialog`
appends to the top of a LIFO. So any re-render that produces a new `onClose`
identity pops the callback and **re-pushes it to the top of the stack**, silently
reordering which surface Escape dismisses.

`ChromeToggle.tsx:112` explicitly guards against this:

```ts
// Stable identity so the dismiss hook's effect does not tear down and re-push
// the callback on every render (`useDialogDismiss` deps on `[active, onClose]`).
const showChrome = useCallback(() => setChromeVisible(true), []);
```

Neither new consumer does. `SetlistView` receives `onClose={() => setOpenShow(null)}`
from `DexView.tsx:198` — a fresh arrow on every `DexView` render, and `DexView`
re-renders on every `useDexStats` live-query tick. `<Sheet>` has the same shape for
all nineteen of its consumers (`AppMenu`, `SettingsView`'s name prompt, etc. all
pass inline arrows).

Today the reordering is masked because the surfaces that can stack happen to be
siblings in one component, so tree-order re-pushes preserve the original order. That
is coincidence, not a property — a single re-render of only the *lower* surface's
parent inverts the stack, and one Escape then closes the wrong dialog.

**Fix:** make the hook independent of callback identity with a ref, so the effect
only depends on `active`:

```ts
export function useDialogDismiss(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const handler = () => onCloseRef.current();
    pushDialog(handler);
    return () => removeDialog(handler);
  }, [active]);
}
```

That also removes the need for consumers to remember `useCallback`.

---

### WR-03: The chrome-toggle header slot ignores `env(safe-area-inset-right)` — the toggle overlaps the Menu button in landscape

**File:** `packages/app/src/components/AppShell.tsx:173-181`, `packages/app/src/explore/ChromeToggle.tsx:131-135`, `packages/app/src/config.ts:426-431`

**Issue:** The toggle positions itself at
`right: calc(env(safe-area-inset-right) + 16px)` with a 44px diameter, so its left
edge sits at `W − insetRight − 60`. `AppShell` reserves for it with a **fixed**
`paddingRight: 52` inside a header whose own right padding is `px-4` (16px), so the
Menu button's right edge is at `W − 68`.

Clearance is therefore `68 − (60 + insetRight) = 8 − insetRight`. It is exactly the
documented 8px in portrait (`insetRight === 0`) and **negative for any right inset
above 8px**. On a notched iPhone in landscape, `env(safe-area-inset-right)` is
~44px, so the toggle sits ~36px on top of the Menu button — two overlapping 44px tap
targets in the region the user reaches for in the dark.

Nothing prevents landscape: `packages/app/vite.config.ts:92-98` sets
`display: "standalone"` with no `orientation` key, and `AppShell`'s header carries
no right-inset padding of its own.

`test/chromeToggle.test.tsx:367-400` asserts the toggle's `top`/`right` strings but
jsdom resolves `env()` to nothing, so no test can observe the collision.

**Fix:** make the reserve carry the same inset the toggle does, so the two
expressions cannot drift:

```tsx
style={{
  paddingRight: toggleMounted
    ? `calc(env(safe-area-inset-right) + ${config.ui.chrome.CHROME_TOGGLE_SLOT_PX}px)`
    : undefined,
}}
```

Alternatively add `orientation: "portrait"` to the manifest if landscape is out of
scope for this app — but say so explicitly rather than leaving it implied.

---

### WR-04: `setChromeVisible(false)` is reachable with zero registered toggles, and the D-11 reset never fires

**File:** `packages/app/src/layout/chromeVisibility.ts:117-149`

**Issue:** The module's T-22-12 mitigation rests on *"the toggle unmounts with its
view, so when the mount count returns to 0 the chrome is forced back to VISIBLE
unconditionally"*. But `setChromeVisible` is a public export with no relationship to
`toggleCount`:

```ts
export function setChromeVisible(next: boolean): void {
  if (visible === next) return;
  visible = next;
  notify();
}
```

If any consumer calls `setChromeVisible(false)` while `toggleCount === 0` — Phase
23's `ShowView` auto-hide is named in the module doc as exactly such a consumer, and
the "different trigger entirely (auto-hide while tracking, no button — D-03)"
framing implies no toggle will be mounted — the app enters a state with:

- no visible escape control (the toggle is what renders it),
- no Escape handler (`useDialogDismiss(!chromeVisible, showChrome)` lives in
  `ChromeToggle`, so it is not registered either),
- no reset on route change (the unregister that forces `visible = true` only runs
  when a count that was ≥1 drops to 0).

In an installed PWA that is force-quit territory, which is precisely the failure
T-22-12 exists to prevent. The current app happens not to reach it only because
`ChromeToggle` is the sole caller.

**Fix:** make the invariant structural rather than conventional:

```ts
export function setChromeVisible(next: boolean): void {
  // T-22-12: hiding the chrome requires a mounted control that can bring it back.
  // A hide with no registered toggle is the unescapable state, not a valid one.
  if (next === false && toggleCount === 0) return;
  if (visible === next) return;
  visible = next;
  notify();
}
```

Phase 23's auto-hide then has to register a (possibly invisible-but-focusable)
control before it can hide, which is the property the requirement actually wants.

---

### WR-05: Overlay heights deregister at exit-START, collapsing the stack under a still-painted toast

**File:** `packages/app/src/components/WaveToast.tsx:103`, `packages/app/src/components/BingoCelebration.tsx:155-158`, `packages/app/src/pwa/bottomOverlayInset.ts:192-218`

**Issue:** Both `AnimatePresence` toasts register visibility as
`useBottomOverlayHeightRegistration(id, shown != null)`. When the toast starts its
exit, `shown` goes null in that same commit, the effect's cleanup runs
`setBottomOverlayHeight(id, 0)`, and the store notifies — while the toast is still
painted for the full `TOAST_DURATION_MS`.

Two consequences during that window:

1. Every overlay declared **above** the exiting one re-reads its offset and drops by
   the exiting toast's height, painting on top of it for ~200ms — the exact overlap
   CR-01 (the folded todo) was written to eliminate.
2. `--gz-overlay-inset` shrinks, so `--gz-content-reserve` shrinks, so scrolling
   `<main>` content slides up underneath a toast that is still on screen.

The `§Pitfall 14 note` in both files (`WaveToast.tsx:110-116`,
`BingoCelebration.tsx:164-170`) reasons only about the *exiting* toast keeping its
own frozen offset, and concludes "That is harmless." That conclusion does not cover
the neighbours above it or the content reserve, both of which re-read live.

Impact is currently bounded because both `AnimatePresence` toasts are
`pointer-events-none`, so nothing becomes untappable — but the reserve is wrong for
the exit window, which is the property this store exists to make right.

**Fix:** keep the registration alive for the exit window. The simplest shape that
matches the rest of the phase is to derive visibility from presence rather than from
the state that drives it — e.g. register a wrapper that stays `visible` until
`onExitComplete`, or delay the clear:

```ts
// bottomOverlayInset.ts — opt-in tail so an animating overlay keeps its reserve
// until it actually leaves the DOM.
return () => {
  observer?.disconnect();
  if (clearDelayMs > 0) {
    const t = setTimeout(() => setBottomOverlayHeight(id, 0), clearDelayMs);
    return () => clearTimeout(t);
  }
  setBottomOverlayHeight(id, 0);
};
```

with `useBottomOverlayHeightRegistration(id, visible, config.ui.motion.TOAST_DURATION_MS)`
at the two `AnimatePresence` call sites.

---

### WR-06: `useBottomOverlayHeightRegistration` never re-measures when the `AnimatePresence` child's key swaps

**File:** `packages/app/src/pwa/bottomOverlayInset.ts:186-221`, `packages/app/src/components/BingoCelebration.tsx:177-207`

**Issue:** The registration effect deps are `[id, visible]` and it captures
`ref.current` once:

```ts
const el = ref.current;
…
const measure = () => setBottomOverlayHeight(id, el.offsetHeight);
observer = new ResizeObserver(measure);
observer.observe(el);
```

`BingoCelebration` sets `key={toast.id}` from a monotonic counter and replaces the
toast on a repeat emit **without** passing through null (`setToast({ id, text })`
overwrites directly, `BingoCelebration.tsx:198`). The key changes → React mounts a
new element and the old one begins its exit → but `visible` (`toast != null`) never
changed, so the effect does not re-run.

Result: the `ResizeObserver` stays attached to the outgoing (soon-detached) node, and
the registered height is whichever toast was measured first. A short "✦ song lit
square!" mark toast followed immediately by a longer badge string keeps the shorter
reservation, and the content reserve under-reserves for the taller toast — the exact
"static estimate falls out of sync with copy" failure the module's own doc
(`bottomOverlayInset.ts:15-21`) says it exists to prevent.

`WaveToast` is not affected today only because its drain loop passes through
`setShown(null)` between items.

**Fix:** make the effect track the element rather than only the flags. A callback
ref plus element state is the least surprising shape:

```ts
const [el, setEl] = useState<HTMLDivElement | null>(null);
const ref = useCallback((node: HTMLDivElement | null) => setEl(node), []);
useEffect(() => {
  if (!visible || !el) { setBottomOverlayHeight(id, 0); return; }
  …
}, [id, visible, el]);
```

Failing that, have `BingoCelebration` route repeat emits through a null frame the
way `WaveToast` does, and note the constraint at the hook.

---

### WR-07: `rankOf()` collides every undeclared id at the same rank, so two undeclared overlays still overlap

**File:** `packages/app/src/pwa/bottomOverlayInset.ts:84-102`

**Issue:**

```ts
function rankOf(id: string): number {
  const order = config.ui.BOTTOM_OVERLAY_ORDER as readonly string[];
  const index = order.indexOf(id);
  return index === -1 ? order.length : index;
}

export function offsetBelow(id: string): number {
  const rank = rankOf(id);
  let total = 0;
  for (const [otherId, h] of heights) {
    if (rankOf(otherId) < rank) total += h;   // STRICTLY less
  }
  return total;
}
```

Every unknown id gets rank `order.length`, and the sum uses a strict `<`. So two
simultaneously-visible undeclared overlays get **identical** offsets and paint on top
of each other, while `--gz-content-reserve` reserves the sum of both boxes — which
is verbatim the pre-CR-01 defect the whole feature removes.

`test/bottomOverlayInset.test.tsx:282-292` only ever exercises one undeclared id, so
the collision is not covered. The source omission guard
(`bottomOverlayInset.test.tsx:402-446`) is the real mitigation, but it only catches
ids written as string literals directly in the call — an id passed through a
variable or built by template literal slips past the regex and lands here silently.

**Fix:** break the tie deterministically instead of collapsing it, e.g. rank unknown
ids after the declared list by insertion order:

```ts
const unknownRank = new Map<string, number>();
function rankOf(id: string): number {
  const index = ORDER.indexOf(id);
  if (index !== -1) return index;
  if (!unknownRank.has(id)) unknownRank.set(id, ORDER.length + unknownRank.size);
  return unknownRank.get(id)!;
}
```

(and clear `unknownRank` in `__resetBottomOverlayInsetForTests`). Add a case with two
undeclared ids asserting distinct offsets.

---

### WR-08: `Sheet.tsx`'s `{...closing}` spread contributes a dead `style` — accumulated inconsistency from four layered edits

**File:** `packages/app/src/components/Sheet.tsx:310-313, 382-405`

**Issue:** `closing` bundles two things:

```ts
const closing = {
  "aria-hidden": isPresent ? undefined : (true as const),
  style: { pointerEvents: isPresent ? undefined : ("none" as const) },
};
```

The card then spreads the whole bundle **and** declares an explicit `style` prop
afterwards that re-spreads `closing.style` inside itself:

```tsx
<motion.div
  {...dialogProps}
  {...closing}          // ← its `style` key is unconditionally overwritten below
  key="sheet-card"
  className={…}
  style={{ zIndex, paddingBottom, ...closing.style }}   // ← the one that actually applies
```

Only the `aria-hidden` half of `{...closing}` survives; the `style` half is dead.
The scrim (line 358-380) does the opposite — it takes `...closing.style` only and
hard-codes `aria-hidden="true"`. Three different consumptions of one two-key object
across three sites, which is what four separate plans editing the same file
(22-01, 22-02, 22-08, 22-10) produced.

This is not currently a behaviour bug — `test/sheet.closeStart.test.tsx:130-131`
pins both `pointerEvents` values — but the shape actively invites the wrong edit:
anyone tidying the duplicate `...closing.style` out of the explicit `style` object
would reasonably assume `{...closing}` already covers it, and would silently drop
`pointer-events: none` from the exiting card.

**Fix:** split the bundle so each half has exactly one consumer:

```ts
const closingAria = isPresent ? undefined : (true as const);
const closingPointerEvents = isPresent ? undefined : ("none" as const);
```

```tsx
<motion.div key="sheet-scrim" style={{ zIndex: …, pointerEvents: closingPointerEvents }} aria-hidden="true" … />
<motion.div {...dialogProps} aria-hidden={closingAria} style={{ zIndex: …, paddingBottom: …, pointerEvents: closingPointerEvents }} … />
```

---

### WR-09: Test-reset hatches clear the live listener set, silently detaching mounted subscribers

**File:** `packages/app/src/layout/chromeVisibility.ts:152-158`, `packages/app/src/pwa/bottomOverlayInset.ts:224-229`, `packages/app/src/pwa/install/installStore.ts:176-188`, `packages/app/src/settings/installSectionFocus.ts:65-68`

**Issue:** All four `__reset…ForTests` helpers call `listeners.clear()`. React's
`useSyncExternalStore` holds no reference to that set beyond the unsubscribe closure
it was handed, so clearing it while components are still mounted leaves those
components permanently deaf to the store — with no error and no warning. Their
subsequent unsubscribe closures then `delete` from an already-empty set, which is a
silent no-op.

Every current call site happens to invoke `cleanup()` first
(`chromeToggle.test.tsx:157-163`, `chromeResize.test.tsx:142-154`,
`installStore.test.tsx:57-59`), so no test is currently broken. But the ordering is
load-bearing and undocumented, and `installStore.test.tsx:97-111` already interleaves
`cleanup()` / `__reset…` / `render()` in a way that only works by accident of
sequence. A future `beforeEach(__resetChromeVisibilityForTests)` — the more natural
placement — would produce tests that render, mutate the store, and observe nothing,
failing for a reason with no connection to the assertion.

**Fix:** either drop `listeners.clear()` from the resets (the state reset is what
tests need; the listener set drains naturally on `cleanup()`), or make the hazard
loud:

```ts
export function __resetChromeVisibilityForTests(): void {
  if (listeners.size > 0) {
    throw new Error(
      "__resetChromeVisibilityForTests() called with live subscribers — call " +
        "cleanup() first, or the mounted tree will be silently detached.",
    );
  }
  visible = true;
  toggleCount = 0;
  visibleSnapshot = true;
  toggleMountedSnapshot = false;
}
```

## Info

### IN-01: `installStore`'s capture-ordering guarantee is enforced only by a comment

**File:** `packages/app/src/pwa/install/installStore.ts:22-28`

**Issue:** The module relies on being imported during initial bundle evaluation so
its `beforeinstallprompt` listener is registered before the event can fire, and the
doc says *"If any consumer is ever converted to a lazy import, add an explicit
side-effect import of this module in `main.tsx` to keep that ordering true."* The
whole point of hoisting to a singleton (NAV-06) was that a late listener misses a
one-shot event — leaving the guarantee to a comment on a file nobody reads when
lazy-loading a route is the same class of latent failure.

**Fix:** add `import "./pwa/install/installStore.ts";` to `main.tsx` now. It costs
one line and makes the ordering independent of the component import graph.

---

### IN-02: `IosInstallInstructions` keys list items on the copy string

**File:** `packages/app/src/components/IosInstallInstructions.tsx:53`

**Issue:** `steps.map((step, index) => <li key={step} …>)`. Two identical step
strings in `config.copy.iosInstall.steps` would produce duplicate React keys. The
list is a fixed, deterministic, ordered array, so the index is the correct key here
(the same reasoning `BingoCelebration.tsx:129` already records for its orb burst).

**Fix:** `key={index}` with a one-line note matching the orb-burst comment.

---

### IN-03: `TrailNodeSheet` / `WhyDetail` retain their last payload indefinitely

**File:** `packages/app/src/show/TrailNodeSheet.tsx:61-63`, `packages/app/src/show/WhyDetail.tsx:50-52`

**Issue:** `lastEntryRef` / `lastCandidateRef` are never cleared, so the most recent
`TrackedEntry` / `OrbitCandidate` stays reachable for the lifetime of the mounted
component. Both components are now always-mounted (that is the 22-10 conversion), so
the retention is permanent rather than scoped to an open sheet. It is one small
object each and the T-22-36 rationale for never *reading* the ref in handlers is
sound, but it is worth clearing on exit-complete for hygiene.

**Fix:** optional — clear the ref from the card's `onAnimationComplete` when
`!isPresent`, or accept and note it. Not worth restructuring the primitive for.

---

_Reviewed: 2026-08-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
