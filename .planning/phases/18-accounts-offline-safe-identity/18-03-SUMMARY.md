---
phase: 18-accounts-offline-safe-identity
plan: 03
subsystem: auth
tags: [react, localStorage, useSyncExternalStore, offline, identity]

# Dependency graph
requires:
  - phase: 18-accounts-offline-safe-identity (Wave 0 planning)
    provides: RESEARCH Pattern 2 / Pitfall 1 (app-owned record over getSession), PATTERNS §useAuthIdentity, useOnlineStatus idiom
provides:
  - App-owned identity record store (readIdentityRecord / writeIdentityRecord / clearIdentityRecord) on the gwf-identity localStorage key with a gwf-identity-change event
  - AuthIdentity type { userId, displayName }
  - useAuthIdentity() reactive hook (useSyncExternalStore) with a synchronous first snapshot
affects: [18-04 sign-in surface, 18-05 identity chrome/sign-out, 18-06 boot gate + read scoping, 18-07 write-side userId stamping + export/import scoping]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-owned identity record: the boot gate keys on presence of a synchronous localStorage record, NOT on a network getSession() (immune to offline-null, RESEARCH Pitfall 1)"
    - "useSyncExternalStore over a custom window event (gwf-identity-change) + native storage event — mirrors live/useOnlineStatus"
    - "Cached getSnapshot keyed on the raw stored string so useSyncExternalStore gets a stable reference"

key-files:
  created:
    - packages/app/src/auth/identityRecord.ts
    - packages/app/src/auth/useAuthIdentity.ts
    - packages/app/test/identityRecord.test.ts
  modified: []

key-decisions:
  - "getSnapshot must return a cached, stable reference — readIdentityRecord() builds a fresh object per call which loops useSyncExternalStore; cache keyed on the raw localStorage string (write/clear changes the string → recompute)"
  - "Defensive parse: both userId and displayName must be non-empty strings, else readIdentityRecord() returns null (never a half object) — malformed storage falls through to sign-in, never a crash (T-18-03-D)"
  - "New app-owned key gwf-identity, deliberately distinct from supabase-js's sb-<ref>-auth-token (library key never touched, D-06)"
  - "storage event added alongside the custom event for cross-tab sign-in/sign-out sync"

patterns-established:
  - "identityRecord.ts is a leaf module (localStorage only, no db import) so later db.ts → identityRecord.ts write-time stamping introduces no import cycle (18-07 relies on this)"

requirements-completed: [AUTH-02]

# Metrics
duration: ~20min
completed: 2026-07-22
---

# Phase 18 Plan 03: App-Owned Identity Record Summary

**Synchronous, offline-safe `{ userId, displayName }` localStorage store (gwf-identity) plus a useSyncExternalStore hook — the substrate that makes the boot gate immune to the getSession()-returns-null-offline bug.**

## Performance

- **Duration:** ~20 min (incl. worktree `npm install`)
- **Started:** 2026-07-22T17:20:00Z (approx)
- **Completed:** 2026-07-22T17:24:00Z (approx)
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (all created)

## Accomplishments
- `identityRecord.ts`: synchronous, zero-await `readIdentityRecord()` with a defensive parse (null on missing/malformed/partial), plus `writeIdentityRecord`/`clearIdentityRecord` that persist and dispatch a `gwf-identity-change` window event.
- `useAuthIdentity.ts`: reactive hook mirroring `live/useOnlineStatus.ts` — `useSyncExternalStore` over the custom event + native `storage` event, with a synchronous first snapshot (server snapshot `null`, D-05) and a cached snapshot so React never loops.
- 11 tests (store round-trip/clear/fresh/malformed/event-count + hook synchronous-snapshot/sign-in/sign-out re-render); full app suite 795 tests green, app `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: identity record store (RED)** - `8b1fd6c` (test)
2. **Task 1: identity record store (GREEN)** - `bd04e2e` (feat)
3. **Task 2: useAuthIdentity hook (RED)** - `e9ffeb7` (test)
4. **Task 2: useAuthIdentity hook (GREEN)** - `4f5b7e3` (feat)

_No standalone REFACTOR commit — the snapshot-caching fix was folded into the GREEN implementation before it first passed (see Deviations)._

## Files Created/Modified
- `packages/app/src/auth/identityRecord.ts` - App-owned identity record: `AuthIdentity` type, `IDENTITY_KEY`/`IDENTITY_CHANGE_EVENT` constants, `readIdentityRecord`/`writeIdentityRecord`/`clearIdentityRecord`.
- `packages/app/src/auth/useAuthIdentity.ts` - `useAuthIdentity()` reactive hook over the record via `useSyncExternalStore`, with a raw-string-keyed cached snapshot.
- `packages/app/test/identityRecord.test.ts` - 11 tests covering the store behaviors and the hook re-render behaviors.

## Decisions Made
- Kept `readIdentityRecord()` a plain synchronous fresh read (non-React callers in 18-07 use it directly); the stable-reference caching lives in the hook's `getSnapshot`, keyed on the raw localStorage string.
- Exported `IDENTITY_KEY` and `IDENTITY_CHANGE_EVENT` so tests (and later plans) reference the exact key/event name rather than hardcoding literals.
- Added the native `storage` event in `subscribe` for cross-tab sync (a second open tab's gate re-renders on sign-in/sign-out).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cached the hook's getSnapshot to stop a useSyncExternalStore render loop**
- **Found during:** Task 2 (useAuthIdentity hook)
- **Issue:** Passing `() => readIdentityRecord()` directly to `useSyncExternalStore` returned a NEW object every call. React's `Object.is` snapshot comparison then always saw a change → "Maximum update depth exceeded" (3 hook tests failed).
- **Fix:** Added a module-level cache in `useAuthIdentity.ts` keyed on the raw `localStorage.getItem(IDENTITY_KEY)` string: same string returns the same cached object reference; a write/clear changes the string → recompute. `readIdentityRecord()` itself stays an uncached synchronous read for non-React callers.
- **Files modified:** packages/app/src/auth/useAuthIdentity.ts
- **Verification:** All 11 tests green; full app suite 795 green; app `tsc --noEmit` clean.
- **Committed in:** `4f5b7e3` (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Installed workspace dependencies in the worktree**
- **Found during:** Setup (before Task 1)
- **Issue:** The freshly-spawned worktree had no `node_modules` (vitest, @testing-library/react, react all absent) — tests could not run.
- **Fix:** Ran `npm install` at the worktree root (npm workspaces, per project convention — never pnpm). Not a package-legitimacy concern (no new packages added; installs the existing committed lockfile).
- **Files modified:** none tracked (node_modules only; package.json/lock unchanged)
- **Verification:** vitest + @testing-library/react resolve; suite runs.
- **Committed in:** n/a (no tracked file change)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both were prerequisites to make the planned tests pass; no scope creep, no API surface change beyond the planned exports.

## Issues Encountered
- jsdom emits pre-existing "Not implemented: navigation / getContext()" stderr noise during the full suite — unrelated to this plan, all 103 files / 795 tests pass.

## User Setup Required
None - no external service configuration required (zero packages installed, no Supabase/network dependency this plan).

## Next Phase Readiness
- Unblocks Wave 2 in parallel: Plan 04 (sign-in surface calls `writeIdentityRecord`), Plan 05 (chrome/sign-out calls `clearIdentityRecord` + self-sources via `useAuthIdentity`), Plan 06 (boot gate keys on `readIdentityRecord`; read scoping via `useAuthIdentity`), Plan 07 (write-time `userId` stamping + export/import scoping via the non-React `readIdentityRecord` accessor — confirmed a leaf module, no db import, so no cycle).
- No blockers.

## Self-Check: PASSED

---
*Phase: 18-accounts-offline-safe-identity*
*Completed: 2026-07-22*
