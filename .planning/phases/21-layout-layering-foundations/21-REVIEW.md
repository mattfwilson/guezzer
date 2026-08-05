---
phase: 21-layout-layering-foundations
reviewed: 2026-08-05T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/components/BackupToast.tsx
  - packages/app/src/components/BingoCelebration.tsx
  - packages/app/src/components/BottomTabBar.tsx
  - packages/app/src/components/InstallBanner.tsx
  - packages/app/src/components/UpdateToast.tsx
  - packages/app/src/components/WaveToast.tsx
  - packages/app/src/config.ts
  - packages/app/src/dex/AlbumDetail.tsx
  - packages/app/src/dex/ArchiveBrowser.tsx
  - packages/app/src/dex/SetlistView.tsx
  - packages/app/src/explore/NodeSheet.tsx
  - packages/app/src/layout/bottomSpace.ts
  - packages/app/src/pwa/bottomOverlayInset.ts
  - packages/app/src/show/FabMenu.tsx
  - packages/app/src/show/SearchSheet.tsx
  - packages/app/src/styles.css
  - packages/app/test/bottomOverlayInset.test.tsx
  - packages/app/test/bottomSpace.test.ts
  - packages/app/test/layerOrder.test.tsx
  - packages/app/test/sheet.a11y.test.tsx
findings:
  critical: 2
  warning: 14
  info: 4
  total: 20
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-08-05
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

The bottom-space ladder itself is sound. I traced the FOUND-01 arithmetic end to end
(`<main>` padding = `4rem + S + H`, overlay top = `4rem + S + H`, tab-bar top = `4rem + S`)
and it is flush on all three surfaces; the double count really is gone, and the
`bottomSpace.ts` / `styles.css` split of the one `env()` read is well argued and well
tested. The presence security control the brief flagged also holds: `reduceActivity`
allow-lists `tab` against a frozen `Set<Tab>` before construction, and `FriendRow.tsx:84`
resolves through `presence.activity[tab] ?? activityUnknown`, never `?? activity.tab` —
no peer-controlled string reaches the DOM. No injection, no `dangerouslySetInnerHTML`,
no secrets.

What the phase did **not** finish is the "one owner" claim it makes about itself. Two
defects are shipping-blocking:

1. Five bottom overlays now share **one** bottom anchor and **one** z-tier, so any two
   visible simultaneously stack on top of each other and one banner's buttons become
   unreachable — while `--gz-overlay-inset` reserves the *sum* of two heights that are
   not vertically stacked. The phase converted all five to `--gz-chrome-reserve` without
   ever asking what happens when two are up.
2. `SetlistView`'s newly-portaled loading dialog is an opaque, full-screen,
   `aria-modal="true"` box with no close control, no Escape, and a resolve path that can
   never terminate. It is an app-reload-only dead end.

Beyond that, the single-owner requirement has a hole the test suite *allowlists rather
than fixes* (`ExploreFilterFab`'s `64 + 8`), the tab-bar Dynamic-Type rationale in
`config.ts` is contradicted by the component's own `text-[14px]`, two surfaces still
hardcode `pb-16`, `ArchiveBrowser`'s list composes no bottom inset at all, and the
portal work left `aria-modal="true"` on four surfaces that have no focus trap, no
`inert`, and no Escape — with the portal itself moving them *after* all app content in
DOM order, which is a traversal regression.

## Critical Issues

### CR-01: Five bottom overlays share one anchor and one z-tier — concurrent overlays occlude each other's controls

**Files:**
`packages/app/src/components/InstallBanner.tsx:92-108`,
`packages/app/src/components/UpdateToast.tsx:35-49`,
`packages/app/src/components/BackupToast.tsx:73-86`,
`packages/app/src/components/BingoCelebration.tsx:219`,
`packages/app/src/components/WaveToast.tsx:175`,
`packages/app/src/App.tsx:131-135`,
`packages/app/src/pwa/bottomOverlayInset.ts:37-41`

**Issue:** All five overlays are now pinned to the *same* offset
(`bottom: var(--gz-chrome-reserve)`) at the *same* tier (`config.ui.z.toast === 20`).
Nothing lays them out relative to one another. When two are visible at once they occupy
the identical box; paint order falls back to DOM order in `App.tsx` (InstallBanner 131 →
UpdateToast 132 → BackupToast 133 → BingoCelebration 134 → WaveToast 135), so the later
one paints over the earlier one with an opaque `bg-elevated` and swallows its pointer
events.

This is reachable on ordinary paths, not a corner case:

- **New build, browser tab, not installed** → the SW update lands (`UpdateToast`,
  `needRefresh`) *and* the build stamp changed (`InstallBanner`, D-22 once-per-build).
  `UpdateToast` paints over `InstallBanner`'s "Install" / "Not now" buttons. Both are
  real controls with `onClick` handlers; the covered pair is unreachable.
- **Mid-show** → a `BingoCelebration` mark toast and a `WaveToast` routinely overlap
  (both are `pointer-events-none`, so taps are not eaten, but the two texts render on
  top of each other and neither is legible — in the dark, at a venue).
- **End Show** → `BackupToast` fires while either of the above may still be on screen.

The reserve arithmetic compounds it: `recompute()` (bottomOverlayInset.ts:37-41) **sums**
every registered height, so `--gz-overlay-inset` reserves `H₁ + H₂` for two boxes that
occupy `max(H₁, H₂)` of vertical space. The store's contract ("reserved space always
matches whatever is actually on screen", bottomOverlayInset.ts:18-20) is false whenever
more than one overlay is registered.

Note this is the exact failure class the phase charter names — "under-reserving is the
direction that covers a live control" — arrived at from the other side: not under-reserve,
but stacking two controls in one box.

**Fix:** Give the overlays a deterministic vertical stack instead of a shared anchor.
Either (a) enforce a single-slot policy in the store (only the highest-priority
registered overlay renders; the rest queue, as `WaveToast` already does internally), or
(b) compose each overlay's offset from the chrome reserve *plus the summed height of the
overlays below it*, which the store already knows:

```ts
// pwa/bottomOverlayInset.ts — expose ordered offsets, not just a total
const ORDER = ["installBanner", "updateToast", "backupToast", "bingoCelebration", "waveToast"] as const;

/** px offset above the chrome reserve at which overlay `id` should sit. */
export function offsetBelow(id: string): number {
  let total = 0;
  for (const key of ORDER) {
    if (key === id) break;
    total += heights.get(key) ?? 0;
  }
  return total;
}
```

```tsx
// each overlay
const stackOffset = useBottomOverlayStackOffset("updateToast"); // px
style={{ bottom: `calc(var(--gz-chrome-reserve) + ${stackOffset}px)` }}
```

Whichever route is chosen, add a regression test that registers two overlays and asserts
their rendered `bottom` values differ — the current `bottomOverlayInset.test.tsx:44-51`
("sums multiple simultaneously-registered overlays") locks in the summing behaviour
without ever checking that the two boxes do not overlap.

---

### CR-02: `SetlistView`'s loading dialog is an unrecoverable, unlabelled full-screen trap

**File:** `packages/app/src/dex/SetlistView.tsx:136-148` (with `92-129`)

**Issue:** The hold-the-frame early return renders an opaque, full-viewport
`role="dialog" aria-modal="true"` box at `config.ui.z.sheet` (50) that contains **nothing**
— no back control, no text, no Escape handler (the file's own D-23 note confirms "Escape
has never been handled here"), and no scrim to tap through. The user's only escape is a
full app reload.

It is not merely transient. `resolved` is `null` whenever the show is in neither source:

```ts
const arc = archive.shows.find((s) => s.id === showId);   // bundled corpus
if (arc) { … }
if (cache) { … }                                          // db.archiveShows row
return null;
```

`useLiveQuery(() => db.archiveShows.get(showId))` resolves to `undefined` both while
loading **and** when the row does not exist. There is no way to distinguish the two, so a
missing row parks the user on the blank overlay permanently. Reachable when:

- an `archiveShows` write failed during `handleMark` (see WR-07 — that write is
  unguarded), leaving an `attendedShows` row with no cached setlist;
- a v1/v2 backup is imported (pre-`archiveShows` envelopes carry no cache rows) and the
  restored `attendedShows` row points at a post-corpus show;
- the corpus is refreshed and a previously-bundled `show_id` moves.

Phase 21 is the commit that portaled this branch to `document.body` and blessed it with
`aria-modal="true"`, so the surface is in scope. The `aria-label` is also wrong: it is
`copy.albumBack` — VoiceOver announces the blank blocking dialog as **"Back"**.

**Fix:** Distinguish "still loading" from "not found", give the frame a dismiss control on
both paths, and label it honestly:

```tsx
// `undefined` = Dexie has not answered yet; `null`/missing row = genuinely absent.
const cacheSettled = cache !== undefined;

if (resolved == null) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={cacheSettled ? copy.setlistUnavailableHeading : copy.loading}
      className="fixed inset-0 flex flex-col bg-surface"
      style={{ zIndex: config.ui.z.sheet }}
    >
      <div className="flex items-center gap-3 border-b border-hairline bg-elevated px-4 py-3"
           style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <button type="button" aria-label={copy.albumBack} onClick={onClose}
                className="flex min-h-11 min-w-11 items-center justify-center text-text-muted">
          <ChevronLeft size={24} />
        </button>
      </div>
      {cacheSettled && (
        <p className="px-4 py-6 text-base leading-normal text-text-muted">
          {copy.setlistUnavailableBody}
        </p>
      )}
    </div>,
    document.body,
  );
}
```

Add the two copy strings to `config.copy.dex` (they must not be inline literals, per
CLAUDE.md). Also wire `useDialogDismiss(true, onClose)` here and on the resolved path so
Escape works — see WR-05.

## Warnings

### WR-01: `ExploreFilterFab` keeps a hardcoded px mirror of the tab-bar height, and the test suite allowlists it instead of fixing it

**Files:** `packages/app/src/explore/ExploreFilterFab.tsx:35,95`,
`packages/app/test/bottomSpace.test.ts:472-487`

**Issue:** `const RESTING_BOTTOM_PX = 64 + 8;` is a second owner of the tab-bar height,
in px, **with the safe-area inset omitted entirely**. FOUND-02's acceptance wording is "a
search for the tab-bar height returns exactly one owner"; this is a second one, and
`bottomSpace.test.ts` pins it as an approved exemption rather than closing it.

The consequence is a real geometry error, not just a style point. The FAB's *resting*
bottom is `calc(var(--gz-chrome-reserve) + 8px)` = `4rem + S + 8px` (line 85), but the
lift math at line 95 subtracts `72` — which is `4rem + 8px` with `S` dropped. On an
installed iPhone (S ≈ 34px) the FAB over-lifts by one full safe-area inset every time a
constellation node is focused. Under Dynamic Type it drifts further, because
`TAB_BAR_HEIGHT_REM: 4` scales and `64` does not — which is precisely the scaling D-04
chose `rem` to get.

The exemption comment argues `var()` cannot be read as a number in JS. True, but the
component does not need to read the var — it needs the same *number* the ladder is built
from, and it can measure or compose it:

```ts
// Compose the lift in CSS, not JS — no px mirror, and the inset rides along.
const liftPx = lifted
  ? Math.max(0, peekHeightPx + config.ui.FAB_SHEET_GAP_PX)  // sheet-relative term only
  : 0;
// …
transform: lifted
  ? `translateY(calc(-1 * (${liftPx}px - var(--gz-chrome-reserve) - 8px)))`
  : "none",
```

If that is judged too clever, at minimum move the literal into
`config.ui.bottomSpace` and derive it there, so the numeric owner stays singular.

---

### WR-02: `ArchiveBrowser`'s scroll list composes no bottom safe-area inset — the last rows sit under the home indicator

**File:** `packages/app/src/dex/ArchiveBrowser.tsx:334-396`

**Issue:** The sheet root is `fixed inset-0` and therefore **covers** the tab bar, so
nothing below it reserves the home-indicator gutter. The scrolling body
(`min-h-0 flex-1 overflow-y-auto`) ends flush at the viewport bottom; its last child is a
`px-4 py-4` block giving 16px. On an installed instance the bottom ~34px of the list —
including the last ≥44px show row and the "Search kglw.net for newer shows" button
(line 387-393) — lands inside the home-indicator swipe zone.

Note the D-12 source guard cannot catch this: the guard forbids *writing* the inset
elsewhere, not *omitting* it. The confirm card at line 411 correctly reads
`var(--gz-sheet-pad-bottom)`; the list it sits over does not.

**Fix:**

```tsx
<div
  className="min-h-0 flex-1 overflow-y-auto"
  style={{ paddingBottom: "var(--gz-sheet-pad-bottom)" }}
>
```

---

### WR-03: `AlbumDetail` and `SetlistView` hardcode `pb-16` instead of reading the ladder

**Files:** `packages/app/src/dex/AlbumDetail.tsx:104`,
`packages/app/src/dex/SetlistView.tsx:184`

**Issue:** Both content columns end with `className="flex flex-col pb-16"` — a bare 64px
gutter on a full-screen sheet that covers the tab bar. It happens to exceed a typical
34px inset today, so it is not currently a covered-control bug, but it is exactly the
"magic px instead of the ladder" the phase set out to eliminate, and it will silently
under-pad on any device whose inset exceeds 64px or under a large `rem` scale. The D-12
guard explicitly whitelists `pb-16` (bottomSpace.test.ts:508-516), so nothing catches it.

**Fix:** `style={{ paddingBottom: "var(--gz-sheet-pad-bottom)" }}` and drop `pb-16`, matching
`Sheet.tsx:110` and `ArchiveBrowser.tsx:411`.

---

### WR-04: Tab labels are fixed `px`, contradicting the D-04 Dynamic-Type rationale the bar's `rem` unit rests on

**Files:** `packages/app/src/components/BottomTabBar.tsx:59`,
`packages/app/src/config.ts:327-334`

**Issue:** `config.ts` justifies `TAB_BAR_HEIGHT_REM: 4` with "the 14px/600 tab labels
inside the bar scale with the user's iOS Dynamic Type setting, and a fixed-px bar would
clip them at the largest text size (NAV-01)." The labels are rendered with
`className="text-[14px] font-semibold leading-tight"` — a **fixed px** size that does not
scale with the root font size at all.

So the stated invariant is inverted in practice: the bar height grows with the user's
text-size setting while the labels stay 14px, wasting vertical space on a phone screen
the phase is otherwise fighting to reclaim, and the clipping risk D-04 exists to prevent
was never present. Either the comment or the component is wrong; a future reader will
trust the comment.

**Fix:** Make the labels scale so the rationale becomes true —

```tsx
<span className="text-[0.875rem] font-semibold leading-tight">{label}</span>
```

— and re-check the six-tab fit at 375px, since `GizzVerse` at a scaled-up size is the
widest label and the buttons carry no `min-w-0`/`truncate`.

---

### WR-05: Four portaled surfaces declare `aria-modal="true"` with no focus trap, no `inert`, and no Escape — and the portal moved them *after* all app content in DOM order

**Files:** `packages/app/src/show/SearchSheet.tsx:127-133`,
`packages/app/src/dex/AlbumDetail.tsx:67-74`,
`packages/app/src/dex/ArchiveBrowser.tsx:295-302`,
`packages/app/src/dex/SetlistView.tsx:150-157`

**Issue:** `aria-modal="true"` is a *promise* that the rest of the page is unavailable.
None of these four keeps it: no `useFocusTrap`, no `setRootInert`, no `useDialogDismiss`.
`Sheet.tsx` does all three; D-22 deliberately excludes these five from the primitive,
which is a defensible scope call — but the attribute should then match reality.

The portal makes it measurably worse rather than neutral. Before Phase 21 `SearchSheet`
rendered inside `#app-content`, so `Shift+Tab` off its first control walked back through
the show column that was visually *behind* it. It is now a direct child of
`document.body`, appended **after** `#root`, so:

- `Tab` off the last control falls out of the document into browser chrome;
- `Shift+Tab` off the search input walks into the portaled `FabMenu` (also a body child),
  then the entire app tree and the six tab-bar buttons — all of it invisible behind an
  opaque `bg-surface` overlay.

`sheet.a11y.test.tsx:20-33` honestly documents that it cannot assert VoiceOver order, and
`layerOrder.test.tsx` asserts only that `autoFocus` still lands. Neither notices the
traversal change.

**Fix:** Either drop the promise or keep it. Keeping it is ~4 lines per surface and
reuses machinery that already exists and is already tested:

```tsx
import { useDialogDismiss } from "../components/a11y/useDialogDismiss.ts";
import { useFocusTrap } from "../components/a11y/useFocusTrap.ts";
// …
const rootRef = useRef<HTMLDivElement>(null);
useFocusTrap(rootRef, { active: open });   // initial focus + Tab-wrap + ref-counted inert
useDialogDismiss(open, onClose);           // Escape via the shared LIFO stack
```

This is not the `<Sheet>` migration D-22 rules out — it is two hooks, and `NodeSheet`
already sets the precedent of using `useDialogDismiss` while staying hand-rolled
(`NodeSheet.tsx:115`). If it is genuinely out of scope, change the attribute to
`aria-modal="false"` so AT is not misinformed, and record the decision.

---

### WR-06: Portaling `FabMenu` out of `#app-content` silently drops the `inert` guarantee, and its doc block does not say so

**File:** `packages/app/src/show/FabMenu.tsx:127-141`

**Issue:** `App.tsx:102` puts `id="app-content"` on the wrapper that `setRootInert`
toggles while a modal `<Sheet>` is open. `FabMenu` used to be inside it (it renders from
`ShowView`, inside `<main>`). It is now a `document.body` child, so `inert` no longer
reaches it while `EndShowDialog`, `TrailNodeSheet`, `WhyDetail` or `StartShowNudge` is
open. Those are all show-route modals that co-exist with the FAB.

The residual exposure is narrow — pointer taps hit the `sheetScrim` (40) above the FAB
(30), `useFocusTrap` wraps `Tab` inside the sheet, and `aria-modal` hides the FAB from
AT — but "narrow" is not "audited", and this is the one surface in the whole phase whose
own doc calls itself "the worst symptom … in the LIVE-LOGGING LOOP". `SearchSheet.tsx:43-45`
explicitly raises the inert question for its own portal; the D-23 audit in `FabMenu.tsx`
never mentions `inert` at all, so a reader cannot tell whether it was considered or missed.

Sharper: the FAB is *also* left interactive under `SearchSheet` (WR-05), which sets no
`inert` and no trap. That combination is reachable today via the FAB's own
`onSearch` action.

**Fix:** Either subscribe `FabMenu` to the inert state, or move the inert target so it
covers the portaled show chrome:

```tsx
// FabMenu.tsx — suppress while any modal owns the screen
import { useRootInertActive } from "../components/a11y/inertRoot.ts"; // new selector hook
const suppressed = useRootInertActive();
// …
<div className="fab-menu fixed …" inert={suppressed || undefined} …>
```

At minimum, extend the D-23 audit comment to record the inert finding explicitly.

---

### WR-07: `ArchiveBrowser` leaks a timer and swallows write failures

**File:** `packages/app/src/dex/ArchiveBrowser.tsx:120,142-146,154-183,260,420`

**Issue:** Two separate defects in the same file:

1. `flashTimer` (line 120) is set in `triggerFlash` but **never cleared on unmount**.
   `ArchiveBrowser` is dismissible by the ✕ while the 1600ms flash is pending, so
   `setFlash(null)` fires on an unmounted component. Compare `BackupToast.tsx:58-61` and
   `BingoCelebration.tsx:186-190`, which both clear correctly — the pattern exists in the
   codebase and was not applied here.
2. `handleMark` (154-177) and `handleUnmark` (179-183) `await` Dexie writes with no
   `try`/`catch`, and both are invoked as `void handleMark(...)` (line 260) /
   `void handleUnmark()` (line 420). A rejected write produces an unhandled promise
   rejection and **no user-visible signal at all** — `triggerFlash` never runs, the row
   never flips to marked, and the user simply taps again. On the `fromFallback` path the
   failure also means no `archiveShows` cache row, which is one of the routes into CR-02.

**Fix:**

```tsx
useEffect(() => () => {
  if (flashTimer.current) clearTimeout(flashTimer.current);
}, []);
```

```tsx
const handleMark = useCallback(async (show, fromFallback, songsRecord) => {
  try {
    await markShowAttended(/* … */);
    triggerFlash(show.id, songCount(show));
  } catch {
    setMarkError(show.id);   // surface config.copy.archive.markFailed on the row
  }
}, [resolveName, triggerFlash]);
```

---

### WR-08: `BingoCelebration` re-keys its toast without flipping `visible`, so the registered height goes stale and the `ResizeObserver` observes a detached node

**Files:** `packages/app/src/components/BingoCelebration.tsx:152-155,182-184,196-224`,
`packages/app/src/pwa/bottomOverlayInset.ts:92-127`

**Issue:** `useBottomOverlayHeightRegistration(id, visible)` keys its effect on
`[id, visible]` and captures `el = ref.current` once. `BingoCelebration` replaces one
toast with another via `setToast({ id, text })` **without** passing through `null`
(line 182), so the `AnimatePresence` key changes, React mounts a new `motion.div` and
points `toastRef` at it — but `visible` stayed `true`, the effect never re-runs, and:

- `--gz-overlay-inset` keeps the *previous* toast's height for the new toast's entire
  lifetime (a two-line mark toast replaced by a one-line badge over-reserves; the reverse
  under-reserves and can cover page content underneath, which is the exact regression the
  store exists to prevent);
- the `ResizeObserver` stays attached to the outgoing element, which `AnimatePresence`
  removes from the DOM — so resize tracking is dead for the rest of the session.

`WaveToast` is immune only by accident: its drain loop sets `shown` to `null` between
items (line 123), which flips `visible` and re-runs the effect. That is a fragile
invariant to rely on and it is not written down anywhere.

**Fix:** Make the registration hook re-attach when the observed node changes, rather than
depending on callers to blink `visible`:

```ts
export function useBottomOverlayHeightRegistration(id: string, visible: boolean) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => setEl(node), []);

  useEffect(() => {
    if (!visible || !el) { setBottomOverlayHeight(id, 0); return; }
    const measure = () => setBottomOverlayHeight(id, el.offsetHeight);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    observer?.observe(el);
    return () => { observer?.disconnect(); setBottomOverlayHeight(id, 0); };
  }, [id, visible, el]);   // ← the node is now a dependency

  return ref;
}
```

(A callback ref changes the hook's return type; the five call sites pass it straight to
`ref=` so they are source-compatible.)

---

### WR-09: The `layerOrder` invariant has two holes that make it weaker than its own header claims

**File:** `packages/app/test/layerOrder.test.tsx:124-144,804-805,890-904`

**Issue:** The header is admirably explicit about the class-vs-inline hole. Two others are
not covered:

1. **`position: fixed` is missing from the detector.** `createsStackingContext` only
   returns `true` for a positioned element that *also* carries a non-auto inline
   `z-index`. In WebKit and Blink a `position: fixed` element forms a stacking context on
   its own (it is a containing block for fixed descendants), so a `fixed` ancestor with
   no `z-index` would sink a nested sheet in a real browser and pass this test. Given the
   codebase is dense with `fixed` overlays, that is not a hypothetical shape.
   The self-test at line 342-346 only pins `relative`, so the gap is not visible.
2. **The source scan is file-granular, not render-granular.**
   `PORTAL_CALL = /createPortal\(/` asserts the *file* contains a portal call somewhere.
   `SetlistView.tsx` has two `role="dialog"` returns at `config.ui.z.sheet`; had the plan
   portaled only the resolved one, the scan would still be green. The file's own comment
   (SetlistView.tsx:15-18) shows the authors knew this and handled it by hand — the guard
   did not.

**Fix:** Add `fixed`/`sticky` to the positioned-without-z-index branch (or at least a
self-test that documents the deliberate omission), and tighten the scan to count
occurrences rather than presence:

```ts
const sheetRenders = (src: string) => (src.match(/config\.ui\.z\.sheet\b/g) ?? []).length;
const portalCalls  = (src: string) => (src.match(/createPortal\(/g) ?? []).length;
// every sheet-tier render site needs its own portal
expect(portalCalls(src)).toBeGreaterThanOrEqual(sheetRenders(src));
```

---

### WR-10: The bare-numeric-mirror guard is repo-wide and will fail on unrelated changes

**File:** `packages/app/test/bottomSpace.test.ts:472-487`

**Issue:**

```ts
const bareMirror = /\b64\b/;
const sites = scannedFiles.filter(/* any line containing a standalone 64 */);
expect(sites).toEqual(["explore/ExploreFilterFab.tsx"]);
```

This asserts that the string `64` appears as a standalone token in **exactly one file in
the entire `src/` tree**. Any unrelated addition — a `64` in a canvas size, a colour
stop, a base-64 chunk size, an array literal, a share-card dimension — fails a
*bottom-space* test with a message about tab-bar mirrors. The guard is coupled to the
whole codebase to protect one known violation that should simply be fixed (WR-01).

**Fix:** Once WR-01 is closed, delete this case. Until then, scope it to the file it is
about:

```ts
const src = readFileSync(join(SRC_DIR, "explore/ExploreFilterFab.tsx"), "utf8");
expect(stripComments(src)).toContain("RESTING_BOTTOM_PX = 64 + 8"); // known, tracked
```

---

### WR-11: `styles.css` claims the left/right gutters "have no per-surface duplicate" — two surfaces duplicate them

**Files:** `packages/app/src/styles.css:268-270`,
`packages/app/src/show/FabMenu.tsx:125`,
`packages/app/src/explore/ExploreFilterFab.tsx:86`

**Issue:** The comment at styles.css:268 justifies keeping `padding-left`/`padding-right`
on `body` on the grounds that, unlike the bottom inset, they have no per-surface
duplicate. Both FABs read `env(safe-area-inset-right)` directly:

```ts
const rightOffset = "calc(env(safe-area-inset-right) + 16px)";
```

There is no double count *today*, because both boxes are `position: fixed` and therefore
ignore body padding — but that is the same reasoning that made the bottom double count
invisible until it was measured, and the D-12 guard is anchored on `bottom` (line 337-350,
"anchoring on `bottom` keeps `env(safe-area-inset-top/left/right)` … out of scope"), so
nothing will catch a future non-`fixed` surface that adds a third read.

**Fix:** Either correct the comment to state the real reason (the duplicates are on
viewport-anchored `fixed` boxes, so they cannot compound), or extend the ladder with a
`--gz-safe-right` and let both FABs compose from it, keeping the single-owner story true
on both axes.

---

### WR-12: Scattered magic numbers, against CLAUDE.md's single-config rule

**Files:** `packages/app/src/components/BackupToast.tsx:45`,
`packages/app/src/explore/NodeSheet.tsx:87,89,91`,
`packages/app/src/show/FabMenu.tsx:125`,
`packages/app/src/explore/ExploreFilterFab.tsx:85`,
`packages/app/src/components/AppShell.tsx:48` (+ `SearchSheet.tsx:138`,
`AlbumDetail.tsx:78`, `ArchiveBrowser.tsx:306`, `SetlistView.tsx:161`)

**Issue:** CLAUDE.md is unambiguous: "All model constants … in a single config file — no
scattered magic numbers", and `config.ts:8-11` restates it ("No other file under
packages/app/src should hardcode a copy string, an interval/timeout literal"). The phase
did this correctly for the bottom-space ladder and then left these behind:

- `BackupToast.AUTO_DISMISS_MS = 4000` — a component-local timeout, while its two sibling
  hosts read `config.ui.celebration.*` and `config.presence.*` for exactly this value.
- `NodeSheet.FULL_TOP_GAP_PX = 48`, `SHEET_DISMISS_FRACTION = 0.6`, `SNAP_MS = 200` — the
  peek/snap geometry, module-level, while `SHEET_PEEK_FRACTION` and `BARS_TOP_N` for the
  same sheet live in `config.explore`.
- The `16px` in both FABs' `rightOffset` and the `8px` in `ExploreFilterFab`'s
  `bottomOffset` — the latter with a comment instructing readers not to "re-litigate it
  into `config.ui.bottomSpace`", which is a standing exemption from the project's own rule.
- `calc(env(safe-area-inset-top) + 12px)` is copy-pasted verbatim into **five** files.
  The bottom axis got an owner this phase; the top axis has five.

**Fix:** Move each into `config.ui` / `config.explore` next to its siblings, and add
`TOP_HEADER_PAD_PX` (or a `--gz-safe-top`/`--gz-header-pad-top` rung on the same ladder)
for the five-way duplicate.

---

### WR-13: Test-only escape hatches and un-cleaned global state ship in the production bundle

**Files:** `packages/app/src/pwa/bottomOverlayInset.ts:130-134`,
`packages/app/src/layout/bottomSpace.ts:130-137`

**Issue:**

1. `__resetBottomOverlayInsetForTests()` is a plain named export of a production module.
   It calls `listeners.clear()`, which severs every live `useSyncExternalStore`
   subscription — the store would then silently stop updating `<main>`'s reserve for the
   rest of the session. Nothing prevents it being imported from app code, and tree-shaking
   will not always remove a named export that is re-exported or dynamically referenced.
2. `useBottomSpaceVars` has no cleanup. `applyBottomSpaceVars` writes six inline custom
   properties onto `document.documentElement` and never removes them when `AppShell`
   unmounts. Today `AppShell` is effectively permanent, so this is latent rather than
   live — but the phase explicitly ships `chromeVisible` as a Phase-22 seam, and a
   Phase-22 route that unmounts the shell will leave a stale ladder behind.

**Fix:** Guard the reset behind `import.meta.env.MODE === "test"` (or move it into a
`__testing` sub-module the app never imports), and return a cleanup from the layout effect:

```ts
useLayoutEffect(() => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  applyBottomSpaceVars(root, overlayInset);
  return () => {
    for (const name of BOTTOM_SPACE_VAR_NAMES) root.style.removeProperty(name);
  };
}, [overlayInset]);
```

---

### WR-14: `WaveToast` resolves the sender name from a non-reactive store read

**File:** `packages/app/src/components/WaveToast.tsx:86-91,150`

**Issue:** `resolveSenderName` calls `getSyncState().friends` during render. Nothing
subscribes to that store, so the name is frozen at whatever the roster held on the render
that showed the toast. The doc block itself names the transient case this is supposed to
handle — "a friend who joined presence before the next progress pull" — and that is
exactly the case that never recovers: the toast displays `"Someone"` for its full
`TOAST_MS` even if the roster arrives 50ms later.

**Fix:** Read the friends list through the same reactive path the rest of the app uses
(`useFriendsProgress`/`useSyncExternalStore` over `progressSync`) rather than a one-shot
`getSyncState()` call:

```tsx
const friends = useFriendsFromSyncStore();          // subscribing selector
const name = shown
  ? friends.find((f) => f.userId === shown.payload.from)?.displayName ?? UNKNOWN_SENDER
  : "";
```

## Info

### IN-01: `bottomSpace.ts`'s stated Safari `calc(env())` workaround does not exist

**File:** `packages/app/src/layout/bottomSpace.ts:27-30`

The module doc claims "composing from `var(--gz-safe-bottom)` removes all eight
`calc(env(...) + …)` expressions from the codebase. Hoisting `env()` into a custom
property and calc-ing the variable instead is itself the standard workaround for Safari's
historical trouble with `env()` nested inside `calc()`."

Custom-property substitution is *token* substitution: `--gz-chrome-reserve` resolves to
`calc(4rem + env(safe-area-inset-bottom))` at use time — byte-identical to what was
removed from the call sites. The refactor is a genuine single-ownership win, but it buys
nothing against the cited Safari bug. If that bug were still live the ladder would be
broken; harmless today, but the comment will mislead the next person debugging an inset.
Recommend deleting the second sentence.

---

### IN-02: `ArchiveBrowser` — unguarded year parse and a double type cast

**File:** `packages/app/src/dex/ArchiveBrowser.tsx:197,337,361`

`Number.parseInt(archive.latestShowDate.slice(0, 4), 10)` yields `NaN` on a malformed
artifact date, producing a request to `setlists/showyear/NaN.json`. `fetchRecentShows` is
tolerant so it degrades to an empty result rather than throwing, but the request is still
made against a volunteer-run API the project has an explicit etiquette constraint about.
Guard with `Number.isFinite`.

Separately, `archive.songs as unknown as Record<number, string>` (lines 337, 361) is a
double cast that lies about the key type — `ArchiveArtifact.songs` is
`Record<string, string>`. It works because JS coerces numeric index access, but the
`as unknown as` defeats the type system for the whole `songsRecord` parameter chain. Type
the parameter `Record<string | number, string>` and drop the cast.

---

### IN-03: `NodeSheet` reads `prefers-reduced-motion` imperatively, in a third copy

**File:** `packages/app/src/explore/NodeSheet.tsx:93-98,110`

`prefersReducedMotion()` is a plain function called during render, so it is not reactive
— a user toggling the OS setting while the sheet is open gets no update, unlike the
`useReducedMotion()` hook the toast hosts use. It is also the third copy of the same
`matchMedia` helper (`ExploreFilterFab.tsx` and `ConstellationCanvas.tsx` have their own).
Consolidate into one shared hook.

---

### IN-04: Module-singleton emitters silently drop a second host

**Files:** `packages/app/src/components/BackupToast.tsx:25,37-42`,
`packages/app/src/components/BingoCelebration.tsx:72,84-91`,
`packages/app/src/components/WaveToast.tsx:59,70-77`

All three use `let listener = …` with `subscribe` overwriting unconditionally. The
unsubscribe identity check (`if (listener === fn)`) is correct, so StrictMode double-mount
is safe — but if two hosts are ever mounted (a second `<BackupToast/>` added to a route, a
test that forgets `cleanup()`), the first is silently orphaned with no warning. A
dev-mode guard would make the invariant self-enforcing:

```ts
export function subscribeBackupToast(fn: () => void): () => void {
  if (import.meta.env.DEV && listener) {
    console.warn("BackupToast: a second host mounted; the first will stop receiving.");
  }
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}
```

---

_Reviewed: 2026-08-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
