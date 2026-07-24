---
phase: quick-260724-lgo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/sync/useProgressSync.ts
  - packages/app/test/sync/useProgressSync.test.tsx
autonomous: true
requirements:
  - "IN-04 (Phase-19 half): mobile friend-progress feed reconciles on foreground"
  - "todo: 2026-07-24-bug-mobile-friend-activity-inconsistent-updates.md"

must_haves:
  truths:
    - "On a genuine mobile hidden→visible edge, useProgressSync tears down and re-opens the postgres_changes subscription and re-pulls all friend rows (reconciling stale friend progress)."
    - "Backgrounding (visible→hidden) and in-app route changes cause ZERO subscription churn — the channel is not re-opened."
    - "A foreground edge alone does NOT re-trigger the debounced own-row upsert (no spurious writes on foreground)."
  artifacts:
    - path: "packages/app/src/sync/useProgressSync.ts"
      provides: "visibleEpoch state added to the subscription lifecycle effect deps"
      contains: "visibleEpoch"
    - path: "packages/app/test/sync/useProgressSync.test.tsx"
      provides: "foreground-reopen + no-churn + no-spurious-upsert assertions"
      contains: "visibleEpoch"
  key_links:
    - from: "packages/app/src/sync/useProgressSync.ts"
      to: "packages/app/src/sync/useVisibilityHidden.ts"
      via: "useVisibilityHidden() → hidden→visible edge increments visibleEpoch"
      pattern: "useVisibilityHidden"
    - from: "visibleEpoch"
      to: "subscription lifecycle effect deps"
      via: "[userId, online] → [userId, online, visibleEpoch]"
      pattern: "\\[userId, online, visibleEpoch\\]"
---

<objective>
Apply the proven visibility-regain rejoin (`visibleEpoch`) fix to
`packages/app/src/sync/useProgressSync.ts` so the Friends PROGRESS feed reconciles
on mobile foreground — mirroring the fix already shipped in the Phase-20 sibling
`usePresence.ts` (quick 260724-hqu).

Root cause (already proven, memory `realtime-mobile-suspension-rejoin`): the
subscription lifecycle effect is keyed `[userId, online]`. On mobile, backgrounding
suspends the Supabase Realtime WebSocket while `navigator.onLine` never flips, so the
client misses friends' `postgres_changes` diffs and friend progress goes stale until
the next unrelated event. Desktop rarely suspends the socket → mobile-only.

Mechanism: add a `visibleEpoch` state bumped ONLY on a genuine hidden→visible edge
and add it to the subscription lifecycle effect's dep array. That effect already
tears down the channel (`removeChannel`) and re-subscribes + re-pulls
(`subscribeProgress` + `pull()`), so a foreground edge reconciles stale friend rows
for free.

This is the Phase-19 half of the mobile friend-activity bug; the Phase-20
`usePresence.ts` half is already fixed (quick 260724-hqu). Both still await a
two-device on-device recheck by the owner — the plan/summary must NOT claim on-device
verification.

Purpose: close the mobile-only stale-friend-progress robustness gap before the
residency run.
Output: patched `useProgressSync.ts` + extended `useProgressSync.test.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md

# The file to fix (Phase-19 progress engine)
@packages/app/src/sync/useProgressSync.ts

# The ALREADY-FIXED sibling — copy its visibleEpoch pattern verbatim (import block ~29,
# the visibleEpoch state/effect ~lines 60-74, and the lifecycle-effect dep change ~149)
@packages/app/src/sync/usePresence.ts

# The hidden signal both hooks use
@packages/app/src/sync/useVisibilityHidden.ts

# Existing test file to EXTEND
@packages/app/test/sync/useProgressSync.test.tsx

# Reference for the foreground-reopen / in-app-nav-no-churn assertions to mirror
# (cases (g) and (h))
@packages/app/test/sync/usePresence.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply the visibleEpoch foreground-rejoin fix to useProgressSync.ts</name>
  <files>packages/app/src/sync/useProgressSync.ts</files>
  <action>
Copy the visibleEpoch pattern verbatim from usePresence.ts into useProgressSync.ts.

1. Extend the existing React import from `{ useEffect, useRef }` to
   `{ useEffect, useRef, useState }`.
2. Add a new import: `import { useVisibilityHidden } from "./useVisibilityHidden.ts";`
   (place it alongside the other `./` sync imports).
3. Inside the hook body, after the existing signal reads (`identity`/`userId`/
   `displayName`/`stats`/`online`), add: `const hidden = useVisibilityHidden();` then
   the visibleEpoch machinery IDENTICAL to usePresence.ts lines ~67-74 — a
   `const [visibleEpoch, setVisibleEpoch] = useState(0);`, a
   `const prevHiddenRef = useRef(hidden);`, and a `[hidden]`-keyed effect that
   increments visibleEpoch ONLY on the `prevHiddenRef.current === true && hidden === false`
   edge (then updates `prevHiddenRef.current = hidden`). Include an explanatory comment
   referencing the mobile-suspension root cause (mirror usePresence.ts's IN-04 comment,
   adapted to the postgres_changes subscription: a foreground edge re-opens the channel →
   fresh subscribe + re-pull reconciles stale friend rows).
4. Change ONLY the SUBSCRIPTION lifecycle effect's dep array from `[userId, online]`
   to `[userId, online, visibleEpoch]` (the effect at ~line 97 that owns
   readFriendCache / setSyncState / subscribeProgress / removeChannel / pull).

DO NOT touch the debounced own-row upsert effect (deps stay `[userId, displayName,
online, ready, dex]` — it must NOT get visibleEpoch, so no spurious writes on
foreground). DO NOT touch the reconnect-flush effect (deps stay `[online, userId,
displayName, ready, dex]`). No other logic changes — the lifecycle effect's existing
teardown + re-subscribe + re-pull body does the reconciliation for free.
  </action>
  <verify>
    <automated>npx tsc -p packages/app --noEmit</automated>
  </verify>
  <done>useProgressSync.ts imports useState + useVisibilityHidden, defines a visibleEpoch bumped only on the hidden→visible edge, and the subscription lifecycle effect dep array is `[userId, online, visibleEpoch]`; the upsert and reconnect-flush effect deps are unchanged; `npx tsc -p packages/app --noEmit` is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Extend useProgressSync.test.tsx with foreground-reopen / no-churn / no-spurious-upsert assertions</name>
  <files>packages/app/test/sync/useProgressSync.test.tsx</files>
  <action>
Extend the existing suite mirroring usePresence.test.tsx cases (g)/(h), using the
mocking idioms already present in useProgressSync.test.tsx (the hoisted `mock` with
supabase spies: `channelSpy`/`subscribeSpy`/`selectSpy`/`removeChannelSpy`/`upsertSpy`,
plus the identity/dex/online module mocks).

Because useProgressSync now imports useVisibilityHidden, add a mock for it exactly like
usePresence.test.tsx does:
- Add a `hidden: false` field to the hoisted `mock.state`.
- Add `vi.mock("../../src/sync/useVisibilityHidden.ts", () => ({ useVisibilityHidden:
  () => mock.state.hidden }));` beside the other `vi.mock` calls.
- Reset `mock.state.hidden = false;` in the existing `beforeEach`.

Add three assertions (as new `it(...)` cases in the existing describe block). Drive
visibility transitions with `mock.state.hidden = <bool>` + `rerender(<EngineOnly />)`
inside `act(...)`, mirroring the presence test:

1. Foreground edge re-runs the subscription lifecycle: render (subscribeSpy called
   once, channelSpy once). Then background: set `hidden = true`, rerender — assert NO
   new subscribe (subscribeSpy still 1, channelSpy still 1). Then foreground: set
   `hidden = false`, rerender — assert the lifecycle re-ran: `subscribeSpy` called a
   2nd time (re-subscribe) AND the re-pull fired again (clear `mock.selectSpy` right
   before the foreground rerender, then assert `selectSpy` was called after), and
   `removeChannelSpy` was called once (prior channel torn down).
2. In-app re-render that does NOT cross a visibility edge does NOT re-subscribe: render,
   then rerender with `hidden` unchanged (still false) — assert `subscribeSpy` /
   `channelSpy` call counts are unchanged (zero subscription churn).
3. A foreground edge alone does NOT re-trigger the debounced upsert: render, let the
   initial debounce elapse (`act(() => vi.advanceTimersByTime(config.friends.DEBOUNCE_MS))`)
   and capture `upsertSpy` call count, then do a hidden→visible edge (background then
   foreground rerenders) and advance timers again — assert `upsertSpy` call count is
   unchanged (the foreground edge does not re-run the upsert effect, whose deps exclude
   visibleEpoch).

Keep the existing fake-timers setup (beforeEach `vi.useFakeTimers()` after the async
cache clear) intact — the new cases run synchronously under fake timers like the
existing (a)/(b)/(c) cases. Do NOT weaken or remove any existing assertion.
  </action>
  <verify>
    <automated>npx vitest run packages/app/test/sync/useProgressSync.test.tsx</automated>
  </verify>
  <done>The three new cases pass: a genuine hidden→visible edge re-subscribes + re-pulls (subscribeSpy called twice, selectSpy fires again, removeChannelSpy once); an in-app re-render with no visibility edge does not re-subscribe; a foreground edge does not re-trigger the debounced upsert. All pre-existing cases in the file still pass.</done>
</task>

</tasks>

<verification>
- `npx tsc -p packages/app --noEmit` clean.
- Sync suite green: `npx vitest run packages/app/test/sync/`.
- Full app suite ideally green (~951+ tests): `npx vitest run packages/app` (or the
  repo's standard test command).
</verification>

<success_criteria>
- useProgressSync.ts's subscription lifecycle effect re-runs on a genuine mobile
  hidden→visible edge (re-subscribe + re-pull), with zero churn on backgrounding or
  in-app navigation, and no spurious own-row upsert on foreground.
- The `visibleEpoch` machinery is a verbatim mirror of usePresence.ts (import,
  state/effect, dep-array change) — no redesign.
- Tests prove the re-open TRIGGER and the no-churn / no-spurious-write invariants.
- Summary explicitly notes this is unit-proven ONLY and still awaits a two-device
  on-device recheck by the owner (mobile observer) — it must NOT claim on-device
  verification. This closes the Phase-19 half; the Phase-20 half (usePresence.ts) was
  fixed in quick 260724-hqu.
</success_criteria>

<output>
Create `.planning/quick/260724-lgo-apply-visibility-regain-rejoin-visibleep/260724-lgo-SUMMARY.md` when done.
</output>
