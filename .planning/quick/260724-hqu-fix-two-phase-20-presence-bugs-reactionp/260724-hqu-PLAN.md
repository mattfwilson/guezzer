---
phase: 260724-hqu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/app/src/dex/ReactionPalette.tsx
  - packages/app/src/sync/usePresence.ts
  - packages/app/test/dex/ReactionPalette.test.tsx
  - packages/app/test/sync/usePresence.test.tsx
autonomous: true
requirements: [WR-01, IN-04]
must_haves:
  truths:
    - "Reopening the reaction palette after a send requires TWO fresh taps — no wave fires on the first tap"
    - "Reopening the palette from FriendDetail re-seeds the pre-selected target on each open"
    - "A mobile background→foreground transition re-opens the gizz-room channel, reconciling stale presence"
    - "In-app route/tab changes do NOT re-open the channel (no subscription churn)"
    - "The full app suite stays green and packages/app typechecks clean"
  artifacts:
    - path: "packages/app/src/dex/ReactionPalette.tsx"
      provides: "open-keyed selection reset effect"
      contains: "useEffect"
    - path: "packages/app/src/sync/usePresence.ts"
      provides: "visibleEpoch-driven channel re-open on foreground"
      contains: "visibleEpoch"
    - path: "packages/app/test/dex/ReactionPalette.test.tsx"
      provides: "stale-first-tap + re-seed regression tests"
    - path: "packages/app/test/sync/usePresence.test.tsx"
      provides: "foreground re-open + in-app-nav no-churn tests"
  key_links:
    - from: "packages/app/src/sync/usePresence.ts"
      to: "lifecycle effect dependency array"
      via: "visibleEpoch in deps"
      pattern: "\\[userId, online, visibleEpoch\\]"
---

<objective>
Fix two already-root-caused Phase-20 presence bugs in packages/app/src, each with an
accompanying unit test, keeping the full suite green and packages/app typecheck clean.

- WR-01 (from 20-REVIEW.md): `ReactionPalette` never resets its two-step selection
  state across open/close, so a permanently-mounted, reopened palette fires a wave with
  a stale emoji or stale recipient on the FIRST tap — an unintended network send.
- IN-04 (mobile presence staleness): the presence lifecycle effect only re-joins on
  `[userId, online]`. On mobile, backgrounding suspends the WebSocket, `navigator.onLine`
  never flips, and the client misses peers' presence diffs → friend activity goes stale.

Purpose: Restore trustworthy two-step wave sends and self-healing presence on mobile
foreground — both are live-show-critical for the summer 2026 shows.
Output: Two targeted source edits + two test files (one new, one extended).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/20-presence-interactions/20-REVIEW.md

# Bug 1 target + test-style mirror
@packages/app/src/dex/ReactionPalette.tsx
@packages/app/test/components/WaveToast.test.tsx

# Bug 2 target + existing engine tests to extend + visibility signal to reuse
@packages/app/src/sync/usePresence.ts
@packages/app/src/sync/useVisibilityHidden.ts
@packages/app/test/sync/usePresence.test.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Reset ReactionPalette selection state on each open (WR-01)</name>
  <files>packages/app/src/dex/ReactionPalette.tsx, packages/app/test/dex/ReactionPalette.test.tsx</files>
  <behavior>
    - After a completed emoji-first send closes the sheet, reopening (open false→true)
      and tapping a target does NOT immediately send — sendWave call count is unchanged
      until BOTH halves are re-picked this session (emoji reset to null).
    - Reopening with a DIFFERENT `initialTarget` re-seeds target + targetChosen, so a
      single emoji tap after reopen sends to the new initialTarget, not the stale one.
    - A first clean open with an `initialTarget` still sends to that target on the first
      emoji tap (existing pre-targeted FriendDetail path unbroken).
  </behavior>
  <action>
    In packages/app/src/dex/ReactionPalette.tsx, add `useEffect` to the existing React
    import (currently `import { useState } from "react"`). Add an effect keyed on
    `[open, initialTarget]` that, when `open` is true, resets the three selection states:
    `setEmoji(null)`, `setTarget(initialTarget ?? null)`, `setTargetChosen(initialTarget != null)`.
    This is the WR-01 fix from 20-REVIEW.md — FriendsList keeps the palette permanently
    mounted and only toggles `open`, so mount-time useState init never re-runs after a
    send/close, leaving stale `emoji`/`target`/`targetChosen`. Do NOT touch the existing
    `send`, `pickEmoji`, `pickTarget` logic, the render, or the useState declarations —
    only add the import symbol and the reset effect.

    Create packages/app/test/dex/ReactionPalette.test.tsx mirroring WaveToast.test.tsx
    style (@testing-library/react render/rerender/cleanup, vitest describe/it/expect/vi,
    `afterEach(cleanup)`). Mock `../../src/sync/presenceSync.ts` with a `sendWave: vi.fn()`
    spy (that module is ReactionPalette's only send dependency). Provide a small `friends`
    fixture (FriendRowData rows with `userId` + `displayName`, e.g. u-a/Alice, u-b/Bob).
    Locate emoji chips by their aria-label (config.copy.presence.chipLabels values) and
    target rows by displayName text / the Everyone label (config.copy.presence.targetEveryone).
    Cover: (a) render open with no initialTarget → click an emoji chip → click a friend row
    (asserts sendWave called once), then rerender open=false, then rerender open=true, then
    click a friend row → assert sendWave call count is STILL one (stale emoji was cleared, so
    the first tap only selects a target); (b) render open=true initialTarget="u-a", rerender
    open=false, rerender open=true initialTarget="u-b", click one emoji chip → assert the last
    sendWave call was made with target "u-b" (re-seeded), not "u-a".
    NEVER use dangerouslySetInnerHTML in the test; render friend names as plain text.
  </action>
  <verify>
    <automated>cd packages/app && npx vitest run test/dex/ReactionPalette.test.tsx</automated>
  </verify>
  <done>ReactionPalette resets emoji/target/targetChosen on every open; new test file
  passes both the stale-first-tap and initialTarget re-seed assertions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Re-open gizz-room on mobile foreground via visibleEpoch (IN-04)</name>
  <files>packages/app/src/sync/usePresence.ts, packages/app/test/sync/usePresence.test.tsx</files>
  <behavior>
    - A hidden→visible (background→foreground) transition triggers a fresh channel open
      (a second `supabase.channel("gizz-room")` + `.subscribe()` after teardown of the
      prior channel), producing a fresh presence `sync` that reconciles stale peers.
    - An in-app route/tab change (hidden stays false) does NOT re-open the channel — only
      the existing re-track effect fires (channel open count unchanged).
    - All existing invariants hold: still the SOLE gizz-room owner, still gated on
      userId+online, per-run `cancelled` guard + teardown preserved, the separate activity
      re-track effect unchanged, no re-open on background→(still hidden).
  </behavior>
  <action>
    In packages/app/src/sync/usePresence.ts, implement the IN-04 fix: a `visibleEpoch`
    that increments ONLY on a real hidden→visible edge, added to the lifecycle effect's
    dependency array so a foreground event tears down and re-opens `gizz-room` (fresh
    subscribe → fresh sync). Add `useState` to the existing react import
    (`useEffect, useMemo, useRef` → add `useState`). After the existing `hidden`
    (`useVisibilityHidden()`) line, add: a `visibleEpoch` state (init 0), a
    `prevHiddenRef` (init to `hidden`), and a small effect keyed `[hidden]` that, when
    `prevHiddenRef.current === true && hidden === false`, calls `setVisibleEpoch((n) => n + 1)`,
    then always updates `prevHiddenRef.current = hidden`. Change the lifecycle effect's
    dependency array from `[userId, online]` to `[userId, online, visibleEpoch]`. Do NOT
    change the effect body, the `cancelled` guard, the teardown, the initial `track`, the
    bound wave sender, or the separate `[activity]` re-track effect. Rationale (per task
    spec + IN-04): `visibilitychange` does NOT fire on in-app route changes and the
    false→true (backgrounding) edge is intentionally NOT bumped — only the genuine
    foreground edge re-opens, so in-app navigation never churns the subscription.

    Extend packages/app/test/sync/usePresence.test.tsx (do not rewrite it — the mock
    harness already mocks useVisibilityHidden to return `mock.state.hidden`). Add two `it`
    cases inside the existing describe: (g) mount with hidden=false (channelSpy called
    once), set `mock.state.hidden = true` + rerender (assert channelSpy STILL called once —
    backgrounding does not re-open), then set `mock.state.hidden = false` + rerender and
    assert `mock.channelSpy` has now been called twice AND `mock.removeChannelSpy` was
    called once (prior channel torn down before the fresh open); (h) mount, then change
    only `mock.state.route` (e.g. "dex" → "show") with hidden staying false + rerender, and
    assert `mock.channelSpy` is still called once (in-app nav does not re-open — mirrors the
    existing test (e) but asserts the no-re-open invariant explicitly). Wrap state changes +
    rerenders in `act(...)` as the existing tests do.

    NOTE in the SUMMARY: final confirmation of Task 2 requires a two-device on-device
    recheck (mobile observer) next session — the unit test proves the re-open TRIGGER fires
    on foreground, not the live realtime presence recovery over a real suspended socket.
  </action>
  <verify>
    <automated>cd packages/app && npx vitest run test/sync/usePresence.test.tsx</automated>
  </verify>
  <done>usePresence re-opens gizz-room on hidden→visible via visibleEpoch in the lifecycle
  deps; foreground re-open + in-app-nav no-churn tests pass; existing engine tests (a–f)
  still green; SUMMARY records the pending two-device recheck.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local UI → Supabase Realtime broadcast | wave sends cross into a network side-effect visible to friends |
| peer client → this client (presence/wave) | untrusted peer-supplied payloads enter via gizz-room |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hqu-01 | Spoofing/Elevation | ReactionPalette send path | mitigate | WR-01 fix: reset selection on open so a single stray tap can NOT fire a wave with a stale emoji/recipient — removes the unintended-send footgun |
| T-hqu-02 | Denial of Service | gizz-room subscription lifecycle | accept | visibleEpoch bumps only on real foreground edges (not in-app nav, not backgrounding) → bounded, no reconnect storm; teardown-before-reopen preserved |
| T-hqu-03 | Spoofing (`from` self-reported) | validateWave / presence key | accept | Documented in 20-REVIEW.md IN-03: <10 trusted friends, ephemeral non-persisted data; out of scope for this fix, unchanged |
</threat_model>

<verification>
Run from repo root after both tasks:
- `cd packages/app && npx tsc -p . --noEmit` → clean (no type errors)
- `npm test` (repo root) → all files green (baseline 124 files / 947 tests, plus the new
  ReactionPalette file and the two added usePresence cases)
</verification>

<success_criteria>
- ReactionPalette resets emoji/target/targetChosen whenever the sheet opens and re-seeds
  from initialTarget; no wave fires on the first tap of a reopened palette.
- usePresence re-opens gizz-room on background→foreground (visibleEpoch in lifecycle deps)
  while in-app route/tab changes cause zero channel churn; all engine invariants intact.
- `npx tsc -p packages/app --noEmit` clean and `npm test` green.
- SUMMARY notes the outstanding two-device on-device recheck for Task 2.
</success_criteria>

<output>
Create `.planning/quick/260724-hqu-fix-two-phase-20-presence-bugs-reactionp/260724-hqu-SUMMARY.md` when done.
</output>
