---
phase: 20-presence-interactions
plan: 03
subsystem: sync
tags: [supabase, realtime, presence, react, external-store, useSyncExternalStore, singleton-engine, tdd]

# Dependency graph
requires:
  - phase: 20-presence-interactions
    plan: 01
    provides: "presenceSync.ts (openPresenceChannel/readPresence/validateWave/setPresenceState/resetPresenceState/removeChannel/setWaveSender/sendWave + PresenceState/WavePayload) + presenceActivity.ts (deriveActivity) + useVisibilityHidden.ts"
  - phase: 20-presence-interactions
    plan: 02
    provides: "WaveToast.tsx showWaveToast/WaveToastPayload toast host"
  - phase: 19-shared-dex-progress
    provides: "the useProgressSync singleton-engine precedent (subscription/upsert effect split, per-run cancelled guard) + useFriendsProgress pure-reader shape"
provides:
  - "usePresenceReaders.ts — pure usePresenceFor(userId) + useSelfPresence() readers gated on useOnlineStatus (D-16/D-17), open NO channel"
  - "usePresence.ts — the SOLE shell-mounted gizz-room engine: open/track/receive/re-track/teardown, routes validated waves to showWaveToast"
  - "App.tsx wiring: usePresence() mounted once beside useProgressSync() + <WaveToast/> host in the shell"
affects: [friends-fusion, friend-detail, presence-dots, wave-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton presence engine mirroring useProgressSync: [userId,online] lifecycle effect (open/track/teardown) + a SEPARATE activity-keyed effect (re-track without re-subscribe)"
    - "Memoize the broadcast activity on PRIMITIVE signals (route/hidden/atShowActive) so the re-track effect fires only on a real change, never per-render"
    - "Pure readers gate on the VIEWER's online status and return a single frozen OFFLINE constant (referentially stable dark render)"
    - "Self presence derived from LOCAL sources (deriveActivity over route/visibility/active-show), never a presenceState round-trip (Open Q3)"

key-files:
  created:
    - packages/app/src/sync/usePresenceReaders.ts
    - packages/app/src/sync/usePresence.ts
    - packages/app/test/sync/usePresenceReaders.test.tsx
    - packages/app/test/sync/usePresence.test.tsx
  modified:
    - packages/app/src/App.tsx

key-decisions:
  - "Activity is memoized on primitives (route, hidden, atShowActive) — the re-track effect keys on that stable object; the initial track reads it via a ref so the lifecycle effect never lists activity in its dep array (no channel churn)"
  - "The engine reset-to-pristine happens on the effect RE-RUN (offline/sign-out transition while mounted), matching the useProgressSync precedent; the cleanup path handles removeChannel + setWaveSender(null)"

patterns-established:
  - "TDD RED→GREEN per task: a failing spec (module absent) committed before implementation"

requirements-completed: [PRES-01, PRES-02, PRES-03, PRES-04]

# Metrics
duration: 8min
completed: 2026-07-24
---

# Phase 20 Plan 03: Presence Engine + Readers Wiring Summary

**The ephemeral layer goes live: a single shell-mounted `usePresence()` engine (the SOLE `gizz-room` owner — a carbon copy of the Phase-19 `useProgressSync` singleton) that broadcasts coarse activity, publishes friends' presence to the shared store, and routes validated inbound waves to `<WaveToast/>`, plus the pure `usePresenceFor`/`useSelfPresence` readers the Friends surface consumes and the once-only `App.tsx` mount.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (both TDD RED→GREEN)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- **`usePresenceReaders.ts`** — two pure `useSyncExternalStore` readers that open NO channel (the D-19 singleton guarantee):
  - `usePresenceFor(userId)` reads the shared presence store; when the viewer is offline it returns a single frozen `OFFLINE = {online:false, activity:null}` for EVERY userId (D-16 — all dots go dark), else `{online: onlineIds.has(userId), activity: activityByUser.get(userId) ?? null}`.
  - `useSelfPresence()` derives the "You" row from LOCAL signals — `useHashRoute` + `useVisibilityHidden` + the active-tracked-show liveQuery — through the same pure `deriveActivity` the engine broadcasts with (Open Q3, no store round-trip); returns `OFFLINE` when the viewer is offline (D-17).
- **`usePresence.ts`** — the SOLE `gizz-room` owner, a structural mirror of `useProgressSync`:
  - Lifecycle effect keyed `[userId, online]`: signed-out/offline → `resetPresenceState()` (pristine, D-16/17/20); else `openPresenceChannel(...)` once, `.track(activity)` with the current payload, and `setWaveSender` bound to stamp `from: userId`. Cleanup clears the sender + `removeChannel` under a per-run `cancelled` guard (Pitfall 6).
  - A SEPARATE effect keyed on the memoized `activity` re-`.track()`s on a tab/visibility/active-show change WITHOUT re-opening the channel (the subscription/upsert split).
  - Inbound broadcast waves pass through `validateWave(raw, userId)` before `showWaveToast({from, emoji, targeted: to != null})`; malformed/self/other-targeted/unknown-emoji are dropped silently (T-20-01).
- **`App.tsx`** — `usePresence()` mounted once, unconditional (gate lives inside), placed after `useProgressSync()` and BEFORE the `#/dev/orb-fit` early-return (rules of hooks); `<WaveToast/>` mounted in the shell beside `<BingoCelebration/>`.
- **13 new unit assertions** (7 reader + 6 engine) cover the full `<behavior>` tables; `packages/app` typechecks clean and the core-purity guard stays green.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): usePresenceReaders failing test** — `83965c2` (test)
2. **Task 1 (GREEN): usePresenceReaders pure gated readers** — `40ac19b` (feat)
3. **Task 2 (RED): usePresence engine failing test** — `7defc21` (test)
4. **Task 2 (GREEN): usePresence engine + App.tsx mount** — `e87a54a` (feat)

_No REFACTOR commits needed — GREEN implementations were clean._

## Files Created/Modified

- `packages/app/src/sync/usePresenceReaders.ts` — pure `usePresenceFor` + `useSelfPresence` readers, online-gated, channel-free.
- `packages/app/src/sync/usePresence.ts` — the singleton gizz-room engine (open/track/receive/re-track/teardown) routing validated waves to the toast host.
- `packages/app/src/App.tsx` — added `usePresence()` mount + `<WaveToast/>` host + the two imports.
- `packages/app/test/sync/usePresenceReaders.test.tsx` — reader behavior table: store read, online:true/activity:null, D-16 offline hide-all, D-17 self offline, D-02 hidden-wins, atShow stamping.
- `packages/app/test/sync/usePresence.test.tsx` — engine acceptance table: open-once + track + bound sender, signed-out no-op, presence:sync publishes store, validated-wave routing (broadcast/targeted/dropped), re-track-without-reopen, offline teardown + reset + sender-cleared.

## Decisions Made

- **Activity memoized on primitives, initial track via ref.** `deriveActivity` returns a fresh object each render; keying the re-track effect on it directly would fire every render. I memoized `activity` on `[route, hidden, atShowActive]` (the last from `active != null`, never the raw liveQuery object) so the re-track effect fires only on a real change, and the lifecycle effect seeds its initial `.track()` from an `activityRef` so `activity` never enters its `[userId, online]` dep array (no channel churn). This is the faithful analog of the plan's "subscription/upsert split" instruction.
- **Reset-on-transition, not on-unmount.** The store reset to pristine fires on the effect RE-RUN when `!userId || !online` (the offline/sign-out transition while mounted), exactly as `useProgressSync` handles its offline branch; the effect cleanup path owns `removeChannel` + `setWaveSender(null)`. The Task-2 test drives the real still-mounted offline transition via `rerender` to exercise this.

## Deviations from Plan

None — plan executed as written. Both tasks followed the prescribed structure (mirror `useProgressSync`, mirror the `useFriendsProgress` reader shape) with no source-level departures.

## TDD Gate Compliance

- **Task 1**: `test(20-03)` RED commit (`83965c2`, module-absent failure) preceded the `feat` GREEN commit (`40ac19b`).
- **Task 2**: `test(20-03)` RED commit (`7defc21`, module-absent failure) preceded the `feat` GREEN commit (`e87a54a`).

Both gates satisfied in git order.

## Threat Register Coverage

All `mitigate`-disposition threats assigned to this plan's files are implemented and unit-proven:
- **T-20-01** (input validation) — every inbound wave passes `validateWave(raw, userId)` before `showWaveToast`; the engine test asserts self / other-targeted / unknown-emoji / non-object payloads are all dropped.
- **T-20-10** (stale presence) — the `[userId, online]` effect teardown calls `removeChannel` + `setWaveSender(null)`, and the re-run resets the store to pristine; the engine test proves offline clears the dots and neutralizes `sendWave`.
- **T-20-03** (info disclosure) — the engine tracks only `deriveActivity(...)` = `{tab, atShow?}`; the active-show liveQuery contributes a boolean via `active != null`, never a song.
- **T-20-08** (persistence leak) — the engine touches only the channel + in-memory store; no Dexie/Postgres write on the presence path (enforced at the primitive layer by the 20-01 sync tests, still green).
- **T-20-SC** (installs) — no new dependencies added.

## Verification

- `npx tsc -p packages/app --noEmit` → exits 0.
- `npx vitest run packages/app/test/sync packages/core/test/purity.test.ts` → 9 files / 75 tests green (incl. the two new specs + the core-purity guard).
- `npx vitest run packages/app/test/components` → 2 files / 17 tests green (WaveToast host unaffected).

## Known Stubs

None — the engine, readers, and mount are fully wired to live sources. (The Friends-surface fusion that consumes `usePresenceFor`/`useSelfPresence` and the palette entry points are the remaining phase-20 plans; the interfaces they consume are shipped here.)

## Next Phase Readiness

- Presence is now live end-to-end at the primitive/engine level: the shell engine broadcasts activity, publishes friends' presence, and delivers waves; the Friends fusion can read via pure `usePresenceFor`/`useSelfPresence` without opening a second channel.
- Core stays Supabase-free (purity guard green); the Supabase import stays confined to `packages/app/src/sync/`.

## Self-Check: PASSED

All 4 created files + the modified App.tsx + this SUMMARY exist on disk; all 4 task commits (`83965c2`, `40ac19b`, `7defc21`, `e87a54a`) are in git history.

---
*Phase: 20-presence-interactions*
*Completed: 2026-07-24*
