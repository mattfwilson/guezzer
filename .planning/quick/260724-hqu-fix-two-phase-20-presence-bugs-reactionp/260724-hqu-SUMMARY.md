---
status: complete
phase: 260724-hqu
plan: 01
subsystem: presence-interactions
tags: [presence, reactions, mobile, bugfix, tdd]
requires:
  - packages/app/src/dex/ReactionPalette.tsx
  - packages/app/src/sync/usePresence.ts
  - packages/app/src/sync/useVisibilityHidden.ts
provides:
  - ReactionPalette open-keyed two-step selection reset (WR-01)
  - usePresence visibleEpoch-driven gizz-room re-open on mobile foreground (IN-04)
affects:
  - packages/app/src/dex/ReactionPalette.tsx
  - packages/app/src/sync/usePresence.ts
tech-stack:
  added: []
  patterns:
    - "prevRef edge-detection: bump a monotonic epoch only on a real hidden->visible transition"
    - "open-keyed useEffect to re-seed component state on a permanently-mounted sheet"
key-files:
  created:
    - packages/app/test/dex/ReactionPalette.test.tsx
  modified:
    - packages/app/src/dex/ReactionPalette.tsx
    - packages/app/src/sync/usePresence.ts
    - packages/app/test/sync/usePresence.test.tsx
decisions:
  - "Reset selection via [open, initialTarget]-keyed effect rather than remounting the palette — FriendsList keeps it mounted by design"
  - "visibleEpoch bumps ONLY on the hidden->visible edge (not backgrounding, not in-app nav) to avoid reconnect storms"
metrics:
  duration: ~15m
  completed: 2026-07-24
---

# Phase 260724-hqu Plan 01: Fix Two Phase-20 Presence Bugs Summary

Two root-caused Phase-20 presence bugs fixed under TDD: `ReactionPalette` now resets its two-step selection on every open (WR-01), and `usePresence` re-opens the `gizz-room` channel on a mobile background→foreground transition via a `visibleEpoch` edge-detector (IN-04).

## What Was Built

### Task 1 — ReactionPalette selection reset (WR-01)
`FriendsList` keeps `ReactionPalette` permanently mounted and only toggles its `open` prop, so the mount-time `useState` initialisers never re-run after a send/close — leaving a stale `emoji`/`target`/`targetChosen`. A reopened palette therefore fired an unintended `sendWave` on the FIRST tap. Fix: an added `useEffect` keyed on `[open, initialTarget]` that, when `open` is true, re-seeds `setEmoji(null)`, `setTarget(initialTarget ?? null)`, `setTargetChosen(initialTarget != null)`. The existing `send`/`pickEmoji`/`pickTarget` logic, render, and `useState` declarations are untouched.

### Task 2 — gizz-room re-open on mobile foreground (IN-04)
On mobile, backgrounding suspends the WebSocket while `navigator.onLine` never flips, so the client silently misses peers' presence diffs and friend activity goes stale. Fix: a `visibleEpoch` state (init 0) plus a `prevHiddenRef` and a small `[hidden]`-keyed effect that increments the epoch ONLY on a real `hidden===true → hidden===false` edge. `visibleEpoch` was added to the lifecycle effect's dependency array (`[userId, online]` → `[userId, online, visibleEpoch]`), so a genuine foreground event tears down the prior channel and opens a fresh one (fresh subscribe → fresh presence `sync`). The effect body, `cancelled` guard, teardown, initial `track`, bound wave sender, and the separate `[activity]` re-track effect are all unchanged. `visibilitychange` does not fire on in-app route changes, and the backgrounding edge is intentionally NOT bumped — so in-app nav and backgrounding never churn the subscription.

## Tasks Completed

| Task | Name | RED commit | GREEN commit |
| ---- | ---- | ---------- | ------------ |
| 1 | ReactionPalette reset (WR-01) | 7966804 | 005006a |
| 2 | usePresence foreground re-open (IN-04) | 8159736 | ebb0a5e |

## Tests

- New: `packages/app/test/dex/ReactionPalette.test.tsx` — (a) stale-first-tap after reopen fires no wave; (b) changed `initialTarget` re-seeds the recipient. Mocks `presenceSync` to a single `sendWave` spy; friend names render as escaped React text.
- Extended: `packages/app/test/sync/usePresence.test.tsx` — (g) background→foreground re-opens gizz-room (channel opened twice, prior torn down once); (h) in-app route change does NOT re-open the channel. Existing engine tests (a–f) still green.
- Both new tests were confirmed RED against the unmodified source before implementing.

## Verification

- `npx tsc -p packages/app --noEmit` → clean (exit 0).
- `npm test` (repo root) → **125 files / 951 passed** (baseline 124/947 + 1 new file + 4 new tests). The `Not implemented: navigation / getContext` lines are pre-existing jsdom noise, not failures.

## Deviations from Plan

None — plan executed exactly as written. The correct single-file test env is the root `vitest.config.ts` `@guezzer/app` project (jsdom); running vitest from inside `packages/app` defaults to a node env (`document is not defined`), so single-file runs were invoked from the repo root with `--project @guezzer/app`. This is a run-invocation detail only — no source or config change.

## Outstanding / Follow-up

- **Two-device on-device recheck required for Task 2 (IN-04).** The unit test proves the re-open TRIGGER fires on the foreground edge; it does NOT prove live realtime presence recovery over a real suspended mobile socket. A mobile-observer two-device recheck (background one device, foreground it, confirm the other device's dot/activity reconciles) is still pending for next session before relying on this live.

## Self-Check: PASSED

- FOUND: packages/app/test/dex/ReactionPalette.test.tsx
- FOUND: packages/app/src/dex/ReactionPalette.tsx (open-keyed reset effect)
- FOUND: packages/app/src/sync/usePresence.ts (visibleEpoch in lifecycle deps)
- FOUND commits: 7966804, 005006a, 8159736, ebb0a5e
