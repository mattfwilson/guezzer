---
phase: 13-interface-explore-polish
plan: 02
subsystem: app / show-mode wake lock
tags: [wake-lock, race-condition, browser-api, ux-02, show-mode]
requires:
  - packages/app/src/wakeLock.ts (existing acquire/release lifecycle)
provides:
  - "acquireWakeLock post-await showActive re-check (D-02) — closes the End-Show/in-flight leak"
  - "wakeLock.test.ts race regression covering release-during-in-flight-acquire"
affects:
  - Show Mode End Show teardown (screen reliably sleeps after End Show)
tech-stack:
  added: []
  patterns:
    - "Post-await state re-check for browser-API request races (reuses the module's never-throw swallow idiom)"
key-files:
  created: []
  modified:
    - packages/app/src/wakeLock.ts
    - packages/app/test/wakeLock.test.ts
decisions:
  - "D-02 (locked): re-check showActive after the await; release + return, never store sentinel, never call onUnsupported on the End-Show branch."
  - "A5 residual ACCEPTED & DOCUMENTED: rapid End-Show→Start-Show with an old acquire in flight can still orphan a lock (boolean showActive cannot distinguish shows). LOW severity, self-clears on background; the monotonic-epoch token is deliberately out of scope."
metrics:
  duration: ~7 min
  completed: 2026-07-19
  tasks: 2
  files-changed: 2
requirements: [UX-02]
---

# Phase 13 Plan 02: Wake Lock End-Show Race Fix Summary

Post-await `showActive` re-check in `acquireWakeLock` (D-02) that releases a late-resolving screen wake lock when `releaseWakeLock()` (End Show) races an in-flight `request("screen")` — closing UX-02's battery-draining leak while preserving the never-throw / silent-fallback contract, plus a jsdom regression test for the race.

## What Was Built

**Task 1 — `acquireWakeLock` re-check (`packages/app/src/wakeLock.ts`, commit `230a83c`)**
Immediately after `const next = await navigator.wakeLock.request("screen")` and before the existing `next.released` false-positive check, a `if (!showActive)` branch now:
- releases `next` best-effort, wrapping `next.release()` in a `try/catch` that swallows — copied verbatim from `releaseWakeLock`'s never-throw idiom;
- `return`s WITHOUT storing `sentinel` and WITHOUT calling `onUnsupported` (End Show is normal teardown, not an unsupported device — calling `onUnsupported` here would wrongly surface the wake-lock fallback notice).
A comment documents both why the re-check exists (D-02) and the accepted A5 rapid-restart residual. `releaseWakeLock`, the `next.released` branch, and the reacquire listener are unchanged.

**Task 2 — race regression test (`packages/app/test/wakeLock.test.ts`, commit `1e8d2d3`)**
New test using the module's existing deferred-request mock idiom (`freshModule()` / `liveSentinel()` / `flush()`): starts `acquireWakeLock` with a request promise that stays in flight, calls `releaseWakeLock()` (flipping `showActive` to false), then resolves the request with a live sentinel. Asserts the late sentinel's `release()` was called exactly once, the module retained nothing (a follow-up `releaseWakeLock()` is a no-op — still 1 release), and `onUnsupported` was never called.

## Verification

- `npx vitest run --project @guezzer/app wakeLock` → 6 passed (5 pre-existing + 1 new). Exit 0.
- `npx vitest run` (full suite) → 78 files, 628 tests passed. Exit 0. (The `Not implemented: ...canvas/navigation` lines are pre-existing jsdom stubs, unrelated to this change.)
- App `tsc --noEmit` → clean (exit 0).
- Regression is genuine: without the re-check, the late sentinel would be stored (`late.release` called 0 times), failing the `toHaveBeenCalledTimes(1)` assertion.

## Deviations from Plan

None affecting code behavior.

**Note (verify-command name):** The plan's `<verify>` blocks specify `npx vitest run --project app wakeLock`, but the root `vitest.config.ts` names the app project `@guezzer/app` (a bare `app` filter errors with "No projects matched"). Ran with the correct `--project @guezzer/app` filter. No code or test-logic change — invocation correction only.

## Known Stubs

None. Both `must_haves` artifacts are fully wired (no placeholder/empty-value patterns introduced).

## Threat Flags

None. Per the plan's threat register (T-13-02), this change REDUCES a self-inflicted resource leak and adds no new network, auth, storage, or input-trust surface. No `npm install` occurred.

## Follow-ups / Residuals

- **A5 (accepted LOW residual):** rapid End-Show→Start-Show while an OLD acquire is still in flight can still orphan a lock — the boolean `showActive` cannot distinguish "show 1" from "show 2". Self-clears on next background. Closing it would require a monotonic-epoch token, intentionally out of scope for D-02.
- **Device UX-02 confirmation** (screen sleeps after End Show) is to be recorded in `13-HUMAN-UAT.md` (authored by plan 13-01) before `/gsd-verify-work` — outside this plan's scope.

## Self-Check: PASSED
- FOUND: packages/app/src/wakeLock.ts (modified, commit 230a83c)
- FOUND: packages/app/test/wakeLock.test.ts (modified, commit 1e8d2d3)
- FOUND commit 230a83c
- FOUND commit 1e8d2d3
