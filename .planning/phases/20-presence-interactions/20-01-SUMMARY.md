---
phase: 20-presence-interactions
plan: 01
subsystem: infra
tags: [supabase, realtime, presence, react, external-store, useSyncExternalStore, tdd]

# Dependency graph
requires:
  - phase: 17-backend-foundation
    provides: "the single app-layer `supabase` client singleton (db/supabase.ts) + core-purity guard"
  - phase: 19-shared-dex-progress
    provides: "the progressSync.ts two-halves fence layout (stateless primitives + module external store) + validateFriendRow read-boundary discipline mirrored here"
provides:
  - "config.presence (QUEUE_CAP/TOAST_MS/DRAIN_GAP_MS/fixed 4-emoji EMOJIS) + config.copy.presence strings"
  - "presenceActivity.ts — pure ROUTE_TO_TAB + deriveActivity + reduceActivity (Tab/Activity types)"
  - "useVisibilityHidden.ts — useSyncExternalStore over document visibilitychange (zero timers)"
  - "presenceSync.ts — presence external store + openPresenceChannel(gizz-room) + readPresence + validateWave + removeChannel + setWaveSender/sendWave (WavePayload/PresenceState/RealtimeChannelHandle types)"
affects: [presence-engine, reaction-toast-host, reaction-palette, friends-fusion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presence fence: app-layer Supabase confined to packages/app/src/sync/, core stays Supabase-free (SETUP-04 purity guard)"
    - "Untrusted Realtime read boundary: validateWave mirrors validateFriendRow (malformed → null → skipped, never throws)"
    - "Module-level external store with stable-reference getSnapshot (Pitfall 4) — engine writes, hooks read"
    - "Null-safe module-level send seam (setWaveSender/sendWave) so UI components are pure callers holding no channel"

key-files:
  created:
    - packages/app/src/sync/presenceActivity.ts
    - packages/app/src/sync/useVisibilityHidden.ts
    - packages/app/src/sync/presenceSync.ts
    - packages/app/test/sync/presenceActivity.test.ts
    - packages/app/test/sync/presenceSync.test.ts
  modified:
    - packages/app/src/config.ts

key-decisions:
  - "config.presence.EMOJIS is the SINGLE source both validateWave's allow-list and the downstream palette consume"
  - "atShow is stamped only when show route is foregrounded AND a tracked show is active; key omitted when false (D-03 boolean-only)"
  - "hidden wins over everything in deriveActivity — a backgrounded tab is idle (D-02, zero timers)"
  - "presence runs on one dedicated gizz-room channel keyed by userId, separate from Phase-19 progress-feed (D-18)"

patterns-established:
  - "Pure activity derivation module (no Supabase/React/DOM) type-imports only Route"
  - "TDD RED→GREEN per task: failing test committed before implementation"

requirements-completed: [PRES-01, PRES-03, PRES-04, PRES-05]

# Metrics
duration: 12min
completed: 2026-07-24
---

# Phase 20 Plan 01: Presence Foundation Summary

**The pure, testable presence layer inside the app-layer Supabase fence — config.presence + config.copy.presence, a pure activity-derivation utility, the zero-timer visibility hook, and presenceSync.ts (external store + gizz-room channel primitives + untrusted-wave validation + a null-safe module-level sendWave).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-24T10:52:00Z
- **Completed:** 2026-07-24T10:57:30Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `config.presence` (QUEUE_CAP 4 / TOAST_MS 1600 / DRAIN_GAP_MS 150 / fixed EMOJIS `["👋","🔥","🦎","🎯"]`) and the full `config.copy.presence` string/function block, each JSDoc-commented per the single-config-file ethos.
- Pure `presenceActivity.ts`: `ROUTE_TO_TAB`, `deriveActivity` (hidden→idle wins; atShow boolean-only), `reduceActivity` (atShow entry wins, else last valid, else null — never throws) with `Tab`/`Activity` types. Imports only the `Route` type.
- `useVisibilityHidden.ts`: the `useOnlineStatus` structural twin over `document.visibilitychange`, zero timers.
- `presenceSync.ts`: the presence external store (stable-ref `getPresenceState`/`setPresenceState`/`resetPresenceState`), `openPresenceChannel("gizz-room", key+enabled:true)`, `readPresence`, `validateWave` (self/targeted-elsewhere/unknown-emoji rejection matrix), `removeChannel`, and the `setWaveSender`/`sendWave` null-safe seam.
- 35 unit assertions (13 activity + 22 sync) plus the core-purity guard, all green; app typechecks clean.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): presenceActivity test** - `b4a8c62` (test)
2. **Task 1 (GREEN): config.presence + activity derivation + visibility hook** - `e2937ac` (feat)
3. **Task 2 (RED): presenceSync test** - `c2b0f17` (test)
4. **Task 2 (GREEN): presenceSync store + channel + validateWave + sendWave** - `2c6445a` (feat)

_No REFACTOR commits needed — GREEN implementations were clean._

## Files Created/Modified
- `packages/app/src/sync/presenceActivity.ts` - Pure ROUTE_TO_TAB + deriveActivity + reduceActivity + Tab/Activity types.
- `packages/app/src/sync/useVisibilityHidden.ts` - useSyncExternalStore over visibilitychange (idle signal, zero timers).
- `packages/app/src/sync/presenceSync.ts` - Presence external store + gizz-room channel primitives + validateWave + module-level sendWave.
- `packages/app/src/config.ts` - Added config.presence constants + config.copy.presence copy blocks.
- `packages/app/test/sync/presenceActivity.test.ts` - Full deriveActivity/reduceActivity behavior table (PRES-04).
- `packages/app/test/sync/presenceSync.test.ts` - Channel open, validateWave rejection matrix, readPresence, stable-ref store, sendWave null-safety, PRES-03 no-persist assertion.

## Decisions Made
None beyond the plan — executed as specified. All decisions (D-02/D-03/D-14/D-18/D-21) were prescribed by the plan and honored structurally.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a test-file typecheck error surfaced by the verification step**
- **Found during:** Task 2 (presenceSync)
- **Issue:** The PRES-03 persistence test passed `mock.capture.presenceStateResult` (typed `Record<string, unknown>`) to `readPresence`, whose param is `RawPresenceState` (`Record<string, ReadonlyArray<unknown>>`) — the index signatures are incompatible, so `npx tsc -p packages/app` failed (TS2345) even though the test ran green.
- **Fix:** Replaced the argument with the equivalent inline literal `{ u1: [{ tab: "GizzDex" }] }` that the mock was already set to. No behavior change.
- **Files modified:** `packages/app/test/sync/presenceSync.test.ts`
- **Verification:** `npx tsc -p packages/app --noEmit` exits 0; the test still passes (22/22).
- **Committed in:** `2c6445a` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, test-only)
**Impact on plan:** The fix was required for the plan's own `<verification>` (`npx tsc -p packages/app` typechecks clean) to hold. No scope creep, no source change.

## Issues Encountered
None beyond the deviation above.

## Threat Register Coverage
All `mitigate`-disposition threats assigned to this plan's files are implemented and unit-proven:
- **T-20-01** (input validation) — validateWave rejects non-object/empty-from/bad-to/unknown-emoji.
- **T-20-05** (targeting access control) — a wave `to` a different userId is dropped.
- **T-20-03** (info disclosure) — activity payload is `{ tab, atShow?: boolean }`, coarse + boolean only.
- **T-20-07** (self-toast spoofing) — `from === myUserId` rejected.
- **T-20-08** (persistence leak, PRES-03) — presence path touches only the channel + in-memory store; the test asserts `.from()` is never called.

## User Setup Required
None - no new external service configuration (Supabase provisioned in Phase 17; no new dependencies this phase).

## Next Phase Readiness
- The presence contracts every later plan consumes are established interface-first: the store shape (`PresenceState`), the payload shape (`WavePayload`), the fixed emoji set, and the pure derivation/validation functions.
- Ready for the singleton presence engine (`usePresence()`), the reaction toast host, the ReactionPalette, and the Friends fusion — none has to reverse-engineer these shapes.
- Core stays Supabase-free (purity guard green); the Supabase import is confined to `packages/app/src/sync/`.

---
*Phase: 20-presence-interactions*
*Completed: 2026-07-24*
