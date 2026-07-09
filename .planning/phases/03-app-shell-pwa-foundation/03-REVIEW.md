---
phase: 03-app-shell-pwa-foundation
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - packages/app/index.html
  - packages/app/package.json
  - packages/app/public/apple-touch-icon.png
  - packages/app/public/icon-192.png
  - packages/app/public/icon-512-maskable.png
  - packages/app/public/icon-512.png
  - packages/app/src/App.tsx
  - packages/app/src/components/AppMenu.tsx
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/components/BottomTabBar.tsx
  - packages/app/src/components/InstallBanner.tsx
  - packages/app/src/components/IosInstallInstructions.tsx
  - packages/app/src/components/IosShareGlyph.tsx
  - packages/app/src/components/PlaceholderView.tsx
  - packages/app/src/components/UpdateToast.tsx
  - packages/app/src/components/VersionStamp.tsx
  - packages/app/src/config.ts
  - packages/app/src/db/db.ts
  - packages/app/src/main.tsx
  - packages/app/src/pwa/install/platform.ts
  - packages/app/src/pwa/install/useInstallState.ts
  - packages/app/src/pwa/persist.ts
  - packages/app/src/pwa/useRegisterSW.ts
  - packages/app/src/routing/useHashRoute.ts
  - packages/app/src/styles.css
  - packages/app/src/vite-env.d.ts
  - packages/app/test/db.test.ts
  - packages/app/test/persist.test.ts
  - packages/app/test/platform.test.ts
  - packages/app/test/route.test.ts
  - packages/app/test/setup.ts
  - packages/app/test/version.test.tsx
  - packages/app/tsconfig.json
  - packages/app/vite.config.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed the app-shell/PWA-foundation source tree: hash routing, install onboarding
(`beforeinstallprompt` capture + iOS manual-install fallback), Dexie v1 schema,
`navigator.storage.persist()` handling, the SW update-toast flow, and the shell/menu/tab-bar
UI. `tsc --noEmit` is clean and the full app test suite (19 tests) passes. No hardcoded
secrets, no `eval`/`innerHTML`/`dangerouslySetInnerHTML`, and the one live security control
(hash-route allow-listing, `useHashRoute.ts`) is implemented correctly — unknown/malformed
hashes normalize to `"show"` and the value is never passed to `innerHTML`, `location`
assignment beyond the hash itself, or `eval`.

No Critical findings. The most concrete issue is a real, provable layout bug: safe-area-inset
padding is applied redundantly at both the global `body` level (styles.css) and again per
component (header, tab bar, banner, toast, menu sheet), which double-counts the top inset and
can cause the bottom-anchored install banner/update toast to visually collide with the tab bar
on notched iOS devices — exactly the "in the dark, one thumb, at a live show" hardware this
project targets. There's also a missing-error-handling gap around the install prompt promise,
an accessibility gap in the menu modal, and a naming inconsistency in the Dexie schema that
contradicts its own docstring.

## Warnings

### WR-01: Duplicate safe-area-inset handling causes doubled top padding and possible bottom overlap on notched devices

**File:** `packages/app/src/styles.css:34-37`
**Also affects:** `packages/app/src/components/AppShell.tsx:16`, `packages/app/src/components/BottomTabBar.tsx:16`, `packages/app/src/components/InstallBanner.tsx:24-25`, `packages/app/src/components/UpdateToast.tsx:25-26`, `packages/app/src/components/AppMenu.tsx:42`

**Issue:** `body` applies `env(safe-area-inset-{top,bottom,left,right})` as its own padding:

```css
body {
  ...
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  ...
}
```

Every screen in this app renders through `AppShell`, whose `<header>` *also* sets
`paddingTop: "env(safe-area-inset-top)"` inline (`AppShell.tsx:16`). Since the header is a
normal-flow child nested inside `body`'s already-padded content box, the top safe-area inset
is applied twice — once as blank space above the header, once again as extra internal padding
inside the header — producing a gap roughly 2x the actual notch height at the very top of the
screen.

The same pattern repeats at the bottom: `body` reserves `padding-bottom: env(safe-area-inset-bottom)`
while `BottomTabBar` (fixed, `bottom: 0`) *also* adds its own `env(safe-area-inset-bottom)`
padding, growing its real on-screen height beyond the `bottom-16` (64px) offset that
`InstallBanner` and `UpdateToast` use to position themselves just above it. `BottomTabBar` has
no explicit `z-index`, while `InstallBanner`/`UpdateToast` set `z-10` — so in the overlap region
on a device with a non-zero `safe-area-inset-bottom` (e.g. any iPhone with a home indicator),
the banner/toast paints on top of part of the tab bar rather than sitting flush above it.

**Fix:** Pick one layer to own safe-area insets — remove the redundant padding from `body` in
`styles.css` since every screen already handles insets at the component level:

```css
body {
  margin: 0;
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  /* safe-area insets are handled per-component (header, tab bar, banners, sheets) */
}
```

Then reconcile `BottomTabBar`'s actual (safe-area-inclusive) height with `InstallBanner`/
`UpdateToast`'s `bottom-16` offset, e.g. `style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}`
or a shared CSS custom property for tab-bar height set once and reused by both.

---

### WR-02: `promptInstall()` has no error handling around the install-prompt promises

**File:** `packages/app/src/pwa/install/useInstallState.ts:53-60`
**Issue:**

```ts
const promptInstall = async () => {
  const deferred = deferredRef.current;
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferredRef.current = null;
  setCanInstall(false);
};
```

`deferred.prompt()` and `deferred.userChoice` can reject (e.g. calling `prompt()` a second time
on an already-consumed `BeforeInstallPromptEvent`, or a browser-specific rejection). Both call
sites invoke this as `void promptInstall()` (`InstallBanner.tsx:44`, `AppMenu.tsx:24` via
`handleInstallClick`), so a rejection becomes an unhandled promise rejection with no
user-visible fallback, and `deferredRef.current`/`canInstall` are left stale (menu/banner will
keep offering an install action tied to a now-invalid event).

**Fix:**
```ts
const promptInstall = async () => {
  const deferred = deferredRef.current;
  if (!deferred) return;
  try {
    await deferred.prompt();
    await deferred.userChoice;
  } catch {
    // Prompt failed/was stale — fall through to still clear state below.
  } finally {
    deferredRef.current = null;
    setCanInstall(false);
  }
};
```

---

### WR-03: `AppMenu` dialog lacks focus management and Escape-to-close

**File:** `packages/app/src/components/AppMenu.tsx:32-84`
**Issue:** The menu asserts `role="dialog" aria-modal="true"` but doesn't implement the
behavior that makes those attributes true: no focus is moved into the dialog on open, no focus
trap keeps Tab from escaping to background content, no `keydown` handler closes on Escape, and
background scrolling isn't suppressed. Backdrop click-to-close works, but keyboard/AT users
have no way to dismiss the menu other than tabbing to the close button, and the background
(`main`, which has `overflow-y-auto`) remains scrollable/focusable behind the sheet.

**Fix:** Add an `Escape` keydown listener scoped to the open state, move focus to the dialog
container (or first focusable element) on open, and restore focus to the trigger on close, e.g.:

```tsx
useEffect(() => {
  if (!open) return;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [open, onClose]);
```

---

### WR-04: `AttendedShow.show_id` breaks the codebase's camelCase convention and contradicts its own docstring

**File:** `packages/app/src/db/db.ts:26-29`
**Issue:** The docstring explicitly says this field "mirrors core `NormalizedShow.showId`"
(`packages/core/src/domain/types.ts:65`, which is camelCase), yet the actual field is declared
snake_case:

```ts
export interface AttendedShow {
  show_id: number;
  showDate: string; // ISO date string, indexed for later date queries
}
```

`showDate` on the very same interface is camelCase, so the inconsistency isn't even
internally uniform. Every other `showId` reference across `packages/core` (types.ts, matrix.ts,
holdout.ts, census.ts, normalize.ts) uses camelCase; only the raw API wire schema
(`api-types.ts`) uses `show_id` snake_case, and that's the wire-format boundary, not a domain
type. When Phase 4/5/6 wire this stub table to real core data, a naming mismatch like this
(`show.showId` vs `db row.show_id`) is exactly the kind of easy-to-miss mapping bug that causes
silent `undefined` writes.

**Fix:** Rename to `showId: number` in the `AttendedShow` interface and the Dexie schema string
(`"&showId, showDate"`), keeping `show_id` confined to the wire-format layer in
`packages/core/src/ingest/api-types.ts` where it already belongs.

## Info

### IN-01: `config.versionStampFormat` is declared but never used — `VersionStamp.tsx` duplicates it inline

**File:** `packages/app/src/config.ts:19-26`, `packages/app/src/components/VersionStamp.tsx:8-13`
**Issue:** `config.ts` documents a canonical format string (`"v{version} · {sha} · built {date}"`)
specifically to be the single source of truth for this format (per CLAUDE.md's "no scattered
magic numbers/strings" rule), but `VersionStamp.tsx` reconstructs the same literal string by
hand with its own separators (`` `v${__APP_VERSION__} · ` ``, `` ` · built ${__BUILD_DATE__}` ``)
and never reads `config.versionStampFormat`. The two can silently drift out of sync since
nothing enforces they match.

**Fix:** Either delete `versionStampFormat` from `config.ts` (it's dead data since the comment
itself admits it's "not a template string here"), or have `VersionStamp.tsx` derive its pieces
from a single exported constant so there's one place to change the separator.

### IN-02: No `base` configured in `vite.config.ts` — will break on GitHub Pages project-page deploys

**File:** `packages/app/vite.config.ts:21-58`
**Issue:** CLAUDE.md's own compatibility notes call out "set Vite `base` if using GitHub Pages
project pages," but no `base` is set here (defaults to `/`). Harmless for Vercel/Netlify root
deploys (the presumed default target), but if GitHub Pages project pages is ever chosen, absolute
asset paths (including `index.html`'s `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`)
will 404 under a `/repo-name/` subpath. Not a functional bug today — flagging so it isn't
forgotten when the deployment target is finalized.

### IN-03: Redundant `removeEventListener` call inside a `{ once: true }` listener

**File:** `packages/app/src/App.tsx:24-33`
**Issue:** `onFirstInteraction` is registered with `{ once: true }`, which already
self-removes the listener after it fires once. The handler also manually calls
`window.removeEventListener("pointerdown", onFirstInteraction)` on line 28 — harmless (a no-op
removal of an already-removed listener) but dead code that suggests the `{ once: true }`
contract wasn't fully trusted.

**Fix:** Drop the manual `removeEventListener` call inside the handler; keep only the
`{ once: true }` option and the `useEffect` cleanup (line 33), which is the one that actually
matters (covers the unmount-before-interaction case).

---

_Reviewed: 2026-07-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
