---
phase: 22-surface-motion-the-chrome-mechanism
plan: 03
subsystem: pwa-install
tags: [install, useSyncExternalStore, singleton, NAV-06, D-33, D-36, D-37]
requires:
  - "packages/app/src/pwa/install/platform.ts (isStandalone, isIosSafari)"
  - "packages/app/src/pwa/bottomOverlayInset.ts (the I-1 store idiom copied)"
provides:
  - "packages/app/src/pwa/install/installStore.ts — module-level install singleton"
  - "subscribeInstall / getInstallSnapshot / getInstallServerSnapshot / promptInstall / __resetInstallStoreForTests"
  - "InstallSnapshot type"
  - "useInstallState() with an unchanged public InstallState shape, now singleton-backed"
affects:
  - "packages/app/src/components/AppMenu.tsx (consumer — unmodified, now reads the shared store)"
  - "packages/app/src/components/InstallBanner.tsx (consumer — unmodified, D-37)"
  - "plan 22-06 InstallSection (new consumer — the reason this plan exists)"
tech-stack:
  added: []
  patterns:
    - "I-1 useSyncExternalStore module registry (cached snapshot rebuilt only in notify())"
    - "module-scope DOM event capture behind a typeof window guard"
key-files:
  created:
    - packages/app/src/pwa/install/installStore.ts
    - packages/app/test/installStore.test.tsx
  modified:
    - packages/app/src/pwa/install/useInstallState.ts
decisions:
  - "D-33 implemented: one module-level beforeinstallprompt capture replaces the per-hook capture"
  - "D-36 implemented: isStandalone()/isIosSafari() evaluated once at module load, shared by every consumer"
  - "RESEARCH Open Question 6 resolved YES: the store also listens for appinstalled"
  - "D-37 honoured: InstallBanner and AppMenu are byte-unchanged"
  - "`ios` is a mutable let (not the const the plan sketched) so a test override survives notify()"
metrics:
  duration: ~15 min
  tasks: 3
  files: 3
  completed: 2026-08-06
---

# Phase 22 Plan 03: Install Store Singleton Summary

Hoisted the one-shot `beforeinstallprompt` capture (and both platform reads) out of per-hook
component state into a module-level `useSyncExternalStore` singleton, so a consumer mounted after
the event fired still reports `canInstall` — the precondition NAV-06 was dead without.

## What Was Built

### Task 1 — `packages/app/src/pwa/install/installStore.ts` (commit `a64bee1`)

Modelled shape-for-shape on `pwa/bottomOverlayInset.ts` (idiom I-1).

**Exported surface — this is what plan 22-06's `InstallSection` consumes:**

| Export | Signature | Notes |
|---|---|---|
| `InstallSnapshot` | `interface { canInstall: boolean; isIos: boolean; isInstalled: boolean }` | exported type |
| `subscribeInstall` | `(listener: () => void) => () => void` | returns unsubscribe |
| `getInstallSnapshot` | `() => InstallSnapshot` | one-line `return snapshot;` — the object is cached |
| `getInstallServerSnapshot` | `() => InstallSnapshot` | returns a frozen module constant (all three false) |
| `promptInstall` | `() => Promise<void>` | silent no-op when nothing captured |
| `__resetInstallStoreForTests` | `(overrides?: { isIos?: boolean; isInstalled?: boolean }) => void` | test-only |

`BeforeInstallPromptEvent` moved here from `useInstallState.ts` and is **not** exported (nothing
outside the store needs it).

**22-06 guidance:** do not subscribe to the store directly — call `useInstallState()`. It is the
public wrapper and its `InstallState` shape is unchanged, so
`const { canInstall, promptInstall, isIos, isInstalled } = useInstallState();` is the whole
integration. `promptInstall` is the store function passed through, so its reference is stable
across renders and it is safe to put directly in an `onClick` (`onClick={() => void promptInstall()}`).
Gate the section on `!isInstalled` exactly as D-34's AppMenu row does — both read the same value now,
so they cannot disagree. In tests, import `__resetInstallStoreForTests` and call it in `afterEach`;
pass `{ isIos: true }` / `{ isInstalled: true }` to reach those branches (the real reads are frozen
at module load, so `vi.stubGlobal("matchMedia", …)` after import will NOT move them).

Module internals:
- one module-scope `addEventListener("beforeinstallprompt")` that `preventDefault()`s, stashes the
  event and `notify()`s;
- one module-scope `addEventListener("appinstalled")` that clears the stash, sets `installed = true`
  and `notify()`s (RESEARCH Open Question 6 — makes NAV-05's "hidden once installed" true within the
  installing session, no reload);
- both inside a single `typeof window !== "undefined"` guard (T-22-07);
- `snapshot` rebuilt **only** inside `notify()` (Pitfall 9 — React 19 loops on an uncached object
  `getSnapshot`);
- `promptInstall()`'s first `await` is `await d.prompt()` — nothing awaited before it (T-22-23, the
  Chromium user-gesture chain);
- a source comment recording why the capture timing is safe (this module is imported transitively
  during initial bundle evaluation, before `createRoot().render()`; `beforeinstallprompt` fires
  strictly later) and what to do if a consumer is ever made a lazy import.

### Task 2 — `useInstallState()` rewritten over the store (commit `0c41a55`)

- Reads `{ canInstall, isIos, isInstalled }` from
  `useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallServerSnapshot)`.
- `promptInstall` is passed through from the store, not re-wrapped.
- `dismissed` / `dismiss` stay component-local `useState` with the long Phase-6 D-22 doc comment
  verbatim (D-37 — only `InstallBanner` reads them).
- The exported `InstallState` interface is unchanged: same five members, same names, same doc
  comments. The dead `deferredRef`, `canInstall` state, `useEffect` listener and local
  `promptInstall` are gone; `isIosSafari`/`isStandalone` are no longer imported here.
- Added a doc note naming the three things the hoist fixes.

### Task 3 — `packages/app/test/installStore.test.tsx` (commit `3fcd6f6`)

7 cases, all green (the plan asked for ≥6 — `isIos` got its own case alongside `isInstalled`):

1. late-mounted consumer sees an already-captured event (dispatch happens **before** the first
   `render(`) — the NAV-06 bug;
2. two independently-mounted Probes agree on `canInstall`, and both lose it when `promptInstall()`
   fires (D-33);
3. `isInstalled` is one shared evaluation, asserted at `true` and at `false` via the reset override
   (D-36);
4. `isIos` likewise;
5. `appinstalled` flips `isInstalled` true and `canInstall` false on both Probes, in-session;
6. `getInstallSnapshot()` returns a stable reference before and after a notify (Pitfall 9);
7. `promptInstall()` with nothing captured resolves and never throws.

`__resetInstallStoreForTests()` in `afterEach` alongside `cleanup()`; no `vi.resetModules()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ios` had to be a mutable `let`, not the `const` the plan/RESEARCH sketch showed**

- **Found during:** Task 1
- **Issue:** `__resetInstallStoreForTests({ isIos: true })` writes the override into the cached
  `snapshot`, but `notify()` rebuilds the snapshot from the module variables. With `ios` a `const`,
  the very next `beforeinstallprompt` / `appinstalled` notification would silently discard the
  override and the store would report `isIos: false` again mid-test — a real correctness bug in the
  documented test escape hatch, not a style preference.
- **Fix:** `ios` is a `let`, assigned inside `__resetInstallStoreForTests` exactly like `installed`.
  Nothing in production reassigns it; the reason is recorded in a source comment.
- **Files modified:** `packages/app/src/pwa/install/installStore.ts`
- **Commit:** `a64bee1`

### Tooling substitutions

**`npx tsc -b` → `npx tsc -b packages/core packages/app`.** The plan's verification blocks specify a
bare `npx tsc -b`, which is **vacuous in this repo**: there is no root `tsconfig.json` (only
`tsconfig.base.json` plus per-package configs), so the bare form prints
`TS5083: Cannot read file '.../tsconfig.json'` and still exits 0. Every typecheck gate in this plan
was run as `npx tsc -b packages/core packages/app`, which exits 0 for real.

No architectural changes, no checkpoints, no auth gates, no packages installed.

## Verification

| Gate | Result |
|---|---|
| `npx tsc -b packages/core packages/app` | exits 0 |
| `npx vitest run --project @guezzer/app packages/app/test/installStore.test.tsx` | 7 passed |
| `npx vitest run` (whole suite) | **136 files / 1154 tests passed** (base was 135 / 1147 — +1 file, +7 tests, zero regressions) |
| `git diff --stat e0ca708 HEAD` | exactly the 3 declared files |

`packages/app/test/platform.test.ts`, `packages/app/test/installBannerVersion.test.tsx`,
`packages/app/src/components/InstallBanner.tsx` and `packages/app/src/components/AppMenu.tsx` are
all **byte-unmodified**, as the plan required. Both pre-existing install tests pass unedited,
confirming the planner's audit: `test/setup.ts` defines `window.matchMedia` before any test file's
module graph is imported, so module-load `isStandalone()` resolves to `false` under jsdom.

## Success Criteria

- [x] A consumer mounted after `beforeinstallprompt` fired still reports `canInstall: true`
- [x] Firing the prompt clears `canInstall` for every consumer simultaneously
- [x] Completing an install in-session flips `isInstalled` everywhere without a reload
- [x] `isIos` / `isInstalled` come from one evaluation shared by every consumer
- [x] `InstallBanner` is byte-unchanged and its shipped once-per-build gate still passes

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access or schema surface. The only new browser-tier
surface is the `appinstalled` listener, which is already covered by T-22-06's `accept` disposition
(the event carries no payload; nothing from it reaches the DOM, Dexie or Supabase). T-22-07 and
T-22-23 are both mitigated as specified: `typeof window` guards on every platform read, a
never-throw `promptInstall()`, and no `await` ahead of `prompt()`.

## Self-Check: PASSED

- FOUND: `packages/app/src/pwa/install/installStore.ts`
- FOUND: `packages/app/src/pwa/install/useInstallState.ts`
- FOUND: `packages/app/test/installStore.test.tsx`
- FOUND: commit `a64bee1`
- FOUND: commit `0c41a55`
- FOUND: commit `3fcd6f6`
