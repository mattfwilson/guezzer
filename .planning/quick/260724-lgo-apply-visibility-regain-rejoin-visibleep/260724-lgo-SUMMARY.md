---
phase: quick-260724-lgo
plan: 01
subsystem: sync
tags: [realtime, mobile, visibility, postgres_changes, IN-04]
requires:
  - packages/app/src/sync/useVisibilityHidden.ts
  - packages/app/src/sync/usePresence.ts (proven sibling pattern, quick 260724-hqu)
provides:
  - "useProgressSync foreground-rejoin: visibleEpoch in the subscription lifecycle effect deps"
affects:
  - Friends PROGRESS feed reconciliation on mobile foreground
tech-stack:
  added: []
  patterns:
    - "visibleEpoch (hidden→visible edge via prevHiddenRef) added to a Realtime lifecycle effect's deps — verbatim mirror of usePresence.ts"
key-files:
  created: []
  modified:
    - packages/app/src/sync/useProgressSync.ts
    - packages/app/test/sync/useProgressSync.test.tsx
decisions:
  - "Copied the usePresence.ts visibleEpoch machinery verbatim (import, state/effect, single dep-array change) — no redesign; the existing lifecycle-effect teardown + re-subscribe + re-pull body does the reconciliation for free."
  - "Only the SUBSCRIPTION lifecycle effect gained visibleEpoch. The debounced own-row upsert and the reconnect-flush effects were left untouched, so a foreground edge produces zero spurious own-row writes."
metrics:
  duration: ~10min
  completed: 2026-07-24
---

# Phase quick-260724-lgo Plan 01: Apply visibility-regain rejoin (visibleEpoch) to useProgressSync Summary

Applied the proven `visibleEpoch` foreground-rejoin fix to
`packages/app/src/sync/useProgressSync.ts` so the Friends PROGRESS feed reconciles on a
genuine mobile hidden→visible edge — mirroring the Phase-20 `usePresence.ts` fix shipped
in quick 260724-hqu. This closes the **Phase-19 half** of the mobile friend-activity
staleness bug (IN-04).

## What Changed

### Task 1 — `useProgressSync.ts` (commit `7420b96`)
- Extended the React import to include `useState`; added
  `import { useVisibilityHidden } from "./useVisibilityHidden.ts"`.
- Added the `visibleEpoch` machinery **identical** to `usePresence.ts`: a
  `useState(0)`, a `prevHiddenRef`, and a `[hidden]`-keyed effect that bumps
  `visibleEpoch` **only** on the `prevHiddenRef.current === true && hidden === false`
  edge, with an explanatory IN-04 comment adapted to the `postgres_changes` subscription.
- Changed the subscription lifecycle effect's dep array from `[userId, online]` to
  `[userId, online, visibleEpoch]` (the effect owning
  `readFriendCache`/`setSyncState`/`subscribeProgress`/`removeChannel`/`pull`).
- **Untouched:** the debounced own-row upsert effect (`[userId, displayName, online,
  ready, dex]`) and the reconnect-flush effect (`[online, userId, displayName, ready,
  dex]`) — neither received `visibleEpoch`, so no spurious foreground writes.

### Task 2 — `useProgressSync.test.tsx` (commit `44c9ffc`)
- Mocked `useVisibilityHidden` and added a `hidden: false` field to `mock.state`
  (reset in `beforeEach`), mirroring `usePresence.test.tsx`.
- Added three cases:
  - **(g)** a hidden→visible edge re-subscribes (`subscribeSpy` ×2), re-pulls
    (`selectSpy` fires again), and tears the prior channel down (`removeChannelSpy` ×1);
    backgrounding and in-app rerenders cause zero subscription churn.
  - **(h)** an in-app re-render with no visibility edge does not re-subscribe.
  - **(i)** a foreground edge alone does not re-trigger the debounced own-row upsert
    (the upsert effect deps exclude `visibleEpoch`).

## Verification (real results)

- `npx tsc -p packages/app --noEmit` — **clean (exit 0)**, run after both tasks.
- `npx vitest run packages/app/test/sync/useProgressSync.test.tsx` — **8/8 passed**
  (5 pre-existing + 3 new; no existing assertion weakened).
- `npx vitest run packages/app/test/sync/` — **72/72 passed** (7 files).
- `npx vitest run packages/app` (full app suite) — **513/513 passed** (78 files). The
  "Not implemented: getContext / navigation" lines are benign jsdom warnings, not failures.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Status — NOT on-device verified

This is **unit-proven ONLY**. The tests prove the re-open **trigger** (a hidden→visible
edge re-runs the lifecycle effect: re-subscribe + re-pull) and the **no-churn /
no-spurious-write** invariants — they do **not** exercise live Realtime recovery over a
real suspended mobile WebSocket.

This closes the **Phase-19 half** of the mobile friend-activity bug; the **Phase-20 half**
(`usePresence.ts`) was fixed in quick 260724-hqu. **Both halves still await the owner's
two-device on-device mobile recheck** (mobile observer, next session).

## Self-Check: PASSED

- `packages/app/src/sync/useProgressSync.ts` — FOUND (modified, commit `7420b96`)
- `packages/app/test/sync/useProgressSync.test.tsx` — FOUND (modified, commit `44c9ffc`)
- Commit `7420b96` — FOUND in git log
- Commit `44c9ffc` — FOUND in git log
