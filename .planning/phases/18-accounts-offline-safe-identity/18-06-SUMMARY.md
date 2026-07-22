---
phase: 18-accounts-offline-safe-identity
plan: 06
subsystem: auth-boot-gate
tags: [react, auth, offline, boot-gate, identity, namespacing, tdd, crux]

# Dependency graph
requires:
  - phase: 18-accounts-offline-safe-identity (Plan 03)
    provides: useAuthIdentity() reactive hook + readIdentityRecord()/clearIdentityRecord()
  - phase: 18-accounts-offline-safe-identity (Plan 04)
    provides: SignInScreen (name-picker + connect-once offline branch)
  - phase: 18-accounts-offline-safe-identity (Plan 05)
    provides: SyncDot reconnecting prop + IdentityAvatar sign-out (clearIdentityRecord) + test/setup.ts VITE_ env stubs
  - phase: 18-accounts-offline-safe-identity (Plan 02)
    provides: Dexie v7 userId index on the five domain tables
  - phase: 18-accounts-offline-safe-identity (Plan 07)
    provides: where("userId") scoping idiom for the four view consumers + scoped export
provides:
  - "AuthGate — the single offline-safe boot interposition: synchronous identity read -> App or SignInScreen + a background-only auth reconciler"
  - "main.tsx renders <AuthGate/> as the root (was <App/>) — zero-await first paint, no getSession on the boot path"
  - "reconnectContext — publishes the gate's reconnecting signal to the Show header SyncDot without prop-drilling"
  - "useDexStats reads scoped to the current userId (AUTH-05 read half for the dex-stats surface)"
affects:
  - "Phase 19 (progress sync) + Phase 20 (presence) build on this verified identity seam — gated behind the Task 3 device UAT"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate on identity PRESENCE, not token validity: the boot decision keys on the app-owned gwf-identity record, never supabase getSession() (RESEARCH Pitfall 1 — getSession returns null offline)"
    - "Background-only reconciler: getSession()/onAuthStateChange run in a post-paint useEffect; only an explicit SIGNED_OUT clears identity (Pitfall 3)"
    - "React context as an affordance channel: reconnectContext threads the gate's reconnecting boolean to a deep consumer (SyncDot) with a false default so isolated tests are unaffected"
    - "Scoped live reads mirror Plan 07: where(\"userId\").equals(currentUserId) with a null-identity unscoped fallback for the transient teardown window"

key-files:
  created:
    - packages/app/src/auth/AuthGate.tsx
    - packages/app/src/auth/reconnectContext.ts
    - packages/app/test/authGate.test.tsx
    - packages/app/test/authNamespacing.test.tsx
    - .planning/phases/18-accounts-offline-safe-identity/18-HUMAN-UAT.md
  modified:
    - packages/app/src/main.tsx
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/dex/useDexStats.ts

key-decisions:
  - "The gate keys on the app-owned identity record, NOT supabase getSession() — the owner-accepted belt-and-suspenders reading of D-05/D-06 that immunizes offline boot against Pitfall 1 (a friend's expired-but-present token still opens their full offline dex)"
  - "reconnecting is derived in the gate and published via a small React context (reconnectContext) rather than prop-drilled through App + the route switch — default false keeps isolated ShowView tests unchanged"
  - "App.tsx was NOT modified (listed in plan files_modified but required no change): the reconciler lives in AuthGate and the SyncDot signal flows via context, so App's tree is untouched"
  - "tokenFresh starts false so a cold boot reads as calm amber (reconnecting) until the background reconciler confirms a live session (green) — offline it simply stays amber, never a logout"

requirements-completed: [AUTH-02, AUTH-04, AUTH-05]

# Metrics
duration: ~20min
completed: 2026-07-22
tasks: 3
files: 8
---

# Phase 18 Plan 06: Offline-Safe AuthGate Boot (THE CRUX) Summary

**The boot gate now interposes a synchronous, offline-safe identity check between the DOM mount and `<App/>`: it keys on the presence of the app-owned `gwf-identity` record (never a network `getSession()`), so an expired-but-present session cold-boots the full dex fully offline; the auth reconciler runs background-only and clears identity solely on an explicit `SIGNED_OUT`; and `useDexStats` is scoped to the current userId so a borrowed phone shows only that identity's numbers.**

## What Was Built

**Task 1 — AuthGate boot interposition + background reconciler + sign-out teardown (AUTH-02/04, TDD):**
`packages/app/src/auth/AuthGate.tsx` reads the identity synchronously via `useAuthIdentity()` (a `useSyncExternalStore` snapshot of `readIdentityRecord()` — zero await, no `getSession()` on the boot path). Identity present → `<App/>` (the v1 synchronous offline boot tree, unchanged first paint); absent → `<SignInScreen online={useOnlineStatus()} />` (a full gate, D-02). A post-paint `useEffect` hosts the background reconciler: `supabase.auth.getSession()` (result used only to tint the dot, ignored for gating — it is null offline, Pitfall 1) and `supabase.auth.onAuthStateChange(...)`, which on `"SIGNED_OUT"` calls `clearIdentityRecord()` and otherwise flips `tokenFresh` green when a live session arrives — it NEVER clears identity on a pending/failed offline refresh (Pitfall 3). The subscription is unsubscribed on cleanup. `main.tsx` now renders `<AuthGate/>` inside `<StrictMode>` (was `<App/>`). Sign-out (the Plan 05 IdentityAvatar control) clears the record directly, which re-renders the gate to the sign-in screen instantly with no flash of the prior dex (D-10). A new `reconnectContext` publishes `reconnecting = identity present AND (offline OR token not yet refreshed)` to the Show header `SyncDot` (threaded into `ShowView.tsx` via `useContext`), which renders the calm amber affordance — never a logout.

**Task 2 — Scope useDexStats reads to the current userId (AUTH-05 read half, TDD):**
`useDexStats.ts` now self-sources `currentUserId` via `useAuthIdentity()` and scopes its four live reads (`attendedShows`/`trackedShows`/`trackedEntries`/`archiveShows`) from `db.X.toArray()` to `db.X.where("userId").equals(currentUserId).toArray()` — the SAME idiom the four Plan-07 view consumers use, with a `currentUserId == null` unscoped fallback that preserves the loading-safe `ready:false` shape for the transient teardown window. The derivation, memoization, and loader-guard shape are otherwise identical; the reactive re-derive on mark/unmark still works (the scoped live query re-runs).

**Task 3 — On-device offline cold-boot verification (AUTH-02 / SC-2): DEFERRED.**
This is a `checkpoint:human-verify` (gate="blocking") that can ONLY be performed by the owner on a real iPhone over an HTTPS tunnel (offline cold boot of the installed PWA with an expired token). It was NOT fabricated or auto-passed. A full 7-step device checklist scaffold was written to `.planning/phases/18-accounts-offline-safe-identity/18-HUMAN-UAT.md` with every step marked PENDING and `Result: PENDING`. The orchestrator will surface it to the owner after merge and record the real outcome. This gate blocks Phases 19–20.

## Deviations from Plan

### Auto-fixed / implementation choices

**1. [Rule 3 - Blocking] Added `reconnectContext.ts` (not in the plan file list)**
- **Found during:** Task 1 (threading the reconnecting signal to the SyncDot)
- **Issue:** The `reconnecting` boolean is derived in `AuthGate` but consumed by `SyncDot` deep inside `App → AppShell → ShowView`. Prop-drilling it through `App` and the route switch would touch several unrelated components.
- **Fix:** Added a tiny `packages/app/src/auth/reconnectContext.ts` (a `createContext<boolean>(false)`); `AuthGate` provides it, `ShowView` consumes it via `useContext`. The `false` default means any component rendered outside the provider (including isolated `ShowView`/`SyncDot` tests) behaves exactly as before. This also breaks what would otherwise be an `AuthGate → App → ShowView → AuthGate` import cycle.
- **Files modified:** packages/app/src/auth/reconnectContext.ts (new), packages/app/src/show/ShowView.tsx
- **Commit:** 4d76b83

**2. `App.tsx` required no change (listed in plan `files_modified`)**
- The plan listed `App.tsx` as modified, but the reconciler lives entirely in `AuthGate` and the SyncDot signal flows via context, so `App`'s tree is untouched. No edit was made rather than introduce a no-op change.

## TDD Gate Compliance

Both TDD tasks followed RED → GREEN with distinct commits:
- Task 1: `test(18-06)` 0189b30 (RED — AuthGate.tsx absent, import failure) → `feat(18-06)` 4d76b83 (GREEN, 4/4)
- Task 2: `test(18-06)` dede509 (RED — unscoped reads leaked A's 3 caught songs to a fresh identity) → `feat(18-06)` 79779c1 (GREEN, 2/2)
No REFACTOR commits were needed (both implementations were minimal and clean).

## Threat Model Compliance

- **T-18-06-D** (self-lockout at a dead-signal venue): mitigated — the gate keys on identity PRESENCE, not token validity; `getSession()`/`getUser()` are never on the boot path. Automated: authGate test proves App content paints with a never-resolving `getSession`. Device-verified in Task 3 (deferred). ✓
- **T-18-06-I** (cross-identity dex leak on a shared device): mitigated — `useDexStats` scoped here + the four Plan-07 view consumers + scoped export; instant sign-out teardown (D-10). Automated: authNamespacing test (A vs B vs fresh). ✓
- **T-18-06-A** (stale token rendered as a logout): mitigated — only an explicit `SIGNED_OUT` clears identity; a pending/failed offline refresh renders the calm reconnecting SyncDot. Automated: the "offline refresh failure does NOT clear identity" assertion. ✓
- **T-18-06-S** (forged local identity record): accepted residual (Phase 18 makes zero Supabase writes; a forged record opens only its own local namespace). ✓
- **T-18-06-SC** (package installs): no packages installed this plan. ✓

## Verification

- `npx vitest run packages/app/test/authGate.test.tsx packages/app/test/authNamespacing.test.tsx` — 6 green
- `npm test` full suite — 113 files / 845 tests green (no migrationV3/V5, exportImportRoundtrip, or v1-boot regression)
- `npx tsc --noEmit -p packages/app/tsconfig.json` — clean
- Source assertions: `main.tsx` renders `<AuthGate`; `AuthGate.tsx` contains `onAuthStateChange` inside a `useEffect` and no top-level `await` of `getSession`; `useDexStats.ts` contains `where("userId")`.
- Device-UAT (Task 3): DEFERRED — scaffolded in `18-HUMAN-UAT.md` (Result: PENDING), to be run by the owner.

## Known Stubs

None. The gate, reconciler, context, and scoped reads are fully wired. Task 3 is a genuine human device gate (deferred, not a code stub) — tracked in `18-HUMAN-UAT.md`.
